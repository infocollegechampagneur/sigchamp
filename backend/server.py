from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import io
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from PIL import Image, ImageOps

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "sigflow"

BACKEND_PUBLIC_URL = os.environ.get("REACT_APP_BACKEND_URL", "")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ---------------------------------------------------------------------------
# Object storage helpers
# ---------------------------------------------------------------------------
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "svg": "image/svg+xml",
}

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request, creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    token = creds.credentials if creds else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Jeton invalide")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


class SocialLinks(BaseModel):
    linkedin: str = ""
    twitter: str = ""
    facebook: str = ""
    instagram: str = ""
    youtube: str = ""


class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_name: str = "Mon Entreprise"
    logo_url: str = ""
    website: str = ""
    phone_main: str = ""
    address: str = ""
    disclaimer: str = ""
    primary_color: str = "#2563EB"
    social: SocialLinks = Field(default_factory=SocialLinks)
    gif_images: List[str] = Field(default_factory=list)
    gif_interval_ms: int = 2500
    gif_url: str = ""
    gif_version: int = 0
    banner_link: str = ""


class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    role: str
    title: str = ""
    phone_ext: str = ""
    direct_line: str = ""
    department: str = ""
    avatar_url: str = ""


class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class EmployeeCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    title: str = ""
    phone_ext: str = ""
    direct_line: str = ""
    department: str = ""


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    phone_ext: Optional[str] = None
    direct_line: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None


class GifGenerateInput(BaseModel):
    images: List[str]
    interval_ms: int = 2500


def user_to_public(u: dict) -> dict:
    return {
        "id": str(u.get("id") or u.get("_id")),
        "email": u.get("email", ""),
        "name": u.get("name", ""),
        "role": u.get("role", "employee"),
        "title": u.get("title", ""),
        "phone_ext": u.get("phone_ext", ""),
        "direct_line": u.get("direct_line", ""),
        "department": u.get("department", ""),
        "avatar_url": u.get("avatar_url", ""),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email existe déjà")
    doc = {
        "email": email, "password_hash": hash_password(data.password), "name": data.name,
        "role": "employee", "title": "", "phone_ext": "", "direct_line": "",
        "department": "", "avatar_url": "", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    token = create_access_token(doc["id"], email, "employee")
    return {"token": token, "user": user_to_public(doc)}


@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    user["id"] = str(user["_id"])
    token = create_access_token(user["id"], email, user["role"])
    return {"token": token, "user": user_to_public(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_to_public(user)


@api_router.put("/auth/me")
async def update_me(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": update})
    fresh = await db.users.find_one({"_id": ObjectId(user["id"])})
    fresh["id"] = str(fresh["_id"])
    return user_to_public(fresh)


# ---------------------------------------------------------------------------
# Settings routes
# ---------------------------------------------------------------------------
async def load_settings() -> dict:
    doc = await db.settings.find_one({"key": "global"})
    if not doc:
        default = CompanySettings().model_dump()
        default["key"] = "global"
        await db.settings.insert_one(default)
        return CompanySettings().model_dump()
    return CompanySettings(**doc).model_dump()


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await load_settings()


@api_router.put("/settings")
async def update_settings(data: CompanySettings, admin: dict = Depends(require_admin)):
    payload = data.model_dump()
    await db.settings.update_one({"key": "global"}, {"$set": payload}, upsert=True)
    return await load_settings()


# ---------------------------------------------------------------------------
# Upload + file serving
# ---------------------------------------------------------------------------
@api_router.post("/upload")
async def upload(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    path = f"{APP_NAME}/assets/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ctype = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    result = put_object(path, data, ctype)
    stored = result["path"]
    return {"path": stored, "url": f"{BACKEND_PUBLIC_URL}/api/files/{stored}"}


@api_router.post("/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "bin").lower()
    path = f"{APP_NAME}/avatars/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ctype = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    result = put_object(path, data, ctype)
    stored = result["path"]
    url = f"{BACKEND_PUBLIC_URL}/api/files/{stored}"
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"avatar_url": url}})
    return {"path": stored, "url": url}


@app.get("/api/files/{path:path}")
async def serve_file(path: str):
    try:
        data, ctype = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return Response(content=data, media_type=MIME_TYPES.get(ext, ctype),
                    headers={"Cache-Control": "public, max-age=300"})


# ---------------------------------------------------------------------------
# Animated GIF generation
# ---------------------------------------------------------------------------
TARGET_W, TARGET_H = 600, 170


@api_router.post("/gif/generate")
async def generate_gif(data: GifGenerateInput, admin: dict = Depends(require_admin)):
    if len(data.images) < 1:
        raise HTTPException(status_code=400, detail="Ajoutez au moins une image")
    frames = []
    for src in data.images:
        try:
            content, _ = get_object(src)
            im = Image.open(io.BytesIO(content)).convert("RGB")
            im = ImageOps.fit(im, (TARGET_W, TARGET_H), Image.LANCZOS)
            frames.append(im)
        except Exception as e:
            logger.error(f"Frame load failed for {src}: {e}")
            raise HTTPException(status_code=400, detail=f"Image illisible: {src}")

    buf = io.BytesIO()
    duration = max(300, int(data.interval_ms))
    frames[0].save(
        buf, format="GIF", save_all=True,
        append_images=frames[1:], duration=duration, loop=0, disposal=2, optimize=True,
    )
    gif_bytes = buf.getvalue()
    gif_path = f"{APP_NAME}/brand/banner.gif"
    put_object(gif_path, gif_bytes, "image/gif")

    settings = await load_settings()
    version = settings.get("gif_version", 0) + 1
    gif_url = f"{BACKEND_PUBLIC_URL}/api/files/{gif_path}?v={version}"
    await db.settings.update_one(
        {"key": "global"},
        {"$set": {"gif_images": data.images, "gif_interval_ms": duration,
                  "gif_url": gif_url, "gif_version": version}},
        upsert=True,
    )
    return {"gif_url": gif_url, "version": version, "frames": len(frames)}


# ---------------------------------------------------------------------------
# Employees (admin)
# ---------------------------------------------------------------------------
@api_router.get("/employees")
async def list_employees(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("name", 1).to_list(1000)
    return [user_to_public({**u, "id": str(u["_id"])}) for u in users]


@api_router.post("/employees")
async def create_employee(data: EmployeeCreate, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email existe déjà")
    doc = {
        "email": email, "password_hash": hash_password(data.password), "name": data.name,
        "role": "employee", "title": data.title, "phone_ext": data.phone_ext,
        "direct_line": data.direct_line, "department": data.department, "avatar_url": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return user_to_public(doc)


@api_router.put("/employees/{emp_id}")
async def update_employee(emp_id: str, data: ProfileUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"_id": ObjectId(emp_id)}, {"$set": update})
    fresh = await db.users.find_one({"_id": ObjectId(emp_id)})
    if not fresh:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    fresh["id"] = str(fresh["_id"])
    return user_to_public(fresh)


@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(emp_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un administrateur")
    await db.users.delete_one({"_id": ObjectId(emp_id)})
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "SigFlow API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sigflow.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Administrateur", "role": "admin", "title": "Gestionnaire de marque",
            "phone_ext": "", "direct_line": "", "department": "Direction", "avatar_url": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    await load_settings()


@app.on_event("shutdown")
async def shutdown():
    client.close()
