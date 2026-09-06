from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import io
import uuid
import logging
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated
from email.message import EmailMessage

import bcrypt
import jwt
import requests
import aiosmtplib
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Request, Response, Query
from fastapi.responses import RedirectResponse
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


class DeptBanner(BaseModel):
    id: str
    name: str
    gif_images: List[str] = Field(default_factory=list)
    gif_interval_ms: int = 2500
    gif_url: str = ""
    gif_version: int = 0
    banner_link: str = ""


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
    department_banners: List[DeptBanner] = Field(default_factory=list)


class SmtpConfigInput(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: Optional[str] = None
    from_email: str = ""
    from_name: str = ""


class DeptCreate(BaseModel):
    name: str


class EmailTestInput(BaseModel):
    to: EmailStr


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
    department_id: Optional[str] = None
    banner_link: Optional[str] = None


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

    settings = await load_settings()

    if data.department_id:
        banners = settings.get("department_banners", [])
        target = next((b for b in banners if b["id"] == data.department_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Département introuvable")
        gif_path = f"{APP_NAME}/brand/banner_{data.department_id}.gif"
        put_object(gif_path, gif_bytes, "image/gif")
        version = target.get("gif_version", 0) + 1
        gif_url = f"{BACKEND_PUBLIC_URL}/api/files/{gif_path}?v={version}"
        target.update({"gif_images": data.images, "gif_interval_ms": duration,
                       "gif_url": gif_url, "gif_version": version})
        if data.banner_link is not None:
            target["banner_link"] = data.banner_link
        await db.settings.update_one({"key": "global"}, {"$set": {"department_banners": banners}})
        return {"gif_url": gif_url, "version": version, "frames": len(frames)}

    gif_path = f"{APP_NAME}/brand/banner.gif"
    put_object(gif_path, gif_bytes, "image/gif")
    version = settings.get("gif_version", 0) + 1
    gif_url = f"{BACKEND_PUBLIC_URL}/api/files/{gif_path}?v={version}"
    update = {"gif_images": data.images, "gif_interval_ms": duration,
              "gif_url": gif_url, "gif_version": version}
    if data.banner_link is not None:
        update["banner_link"] = data.banner_link
    await db.settings.update_one({"key": "global"}, {"$set": update}, upsert=True)
    return {"gif_url": gif_url, "version": version, "frames": len(frames)}


# ---------------------------------------------------------------------------
# Server-side signature builder (mirror of frontend, used for emails)
# ---------------------------------------------------------------------------
def _esc(v):
    return (str(v or "").replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _norm_url(u):
    t = str(u or "").strip()
    if not t:
        return ""
    return t if t.lower().startswith(("http://", "https://")) else f"https://{t}"


_SOCIAL = {"linkedin": ("LinkedIn", "#0A66C2"), "twitter": ("X", "#111827"),
           "facebook": ("Facebook", "#1877F2"), "instagram": ("Instagram", "#E1306C"),
           "youtube": ("YouTube", "#FF0000")}


def _resolve_banner(user, s):
    dept = (user.get("department") or "").strip().lower()
    for b in s.get("department_banners", []):
        if (b.get("name") or "").strip().lower() == dept and b.get("gif_url"):
            return {"gif_url": b["gif_url"], "banner_link": b.get("banner_link", ""), "key": b.get("name")}
    return {"gif_url": s.get("gif_url", ""), "banner_link": s.get("banner_link", ""), "key": "Défaut"}


def build_signature_html(user, s):
    color = s.get("primary_color") or "#2563EB"
    name = _esc(user.get("name") or "Nom Prénom")
    title = _esc(user.get("title") or "")
    dept = _esc(user.get("department") or "")
    email = _esc(user.get("email") or "")
    ext = _esc(user.get("phone_ext") or "")
    direct = _esc(user.get("direct_line") or "")
    phone_main = _esc(s.get("phone_main") or "")
    company = _esc(s.get("company_name") or "")
    website = s.get("website") or ""
    address = _esc(s.get("address") or "")
    disclaimer = _esc(s.get("disclaimer") or "")
    logo = user.get("avatar_url") or s.get("logo_url") or ""

    title_line = " · ".join([x for x in [title, dept] if x])
    phone_parts = [p for p in [phone_main, (f"poste {ext}" if ext else "")] if p]
    phone_str = " ".join(phone_parts)

    lines = []
    if phone_str:
        lines.append(f'<tr><td style="padding:1px 0;font-size:13px;color:#1f2937;"><span style="color:{color};font-weight:700;">Tél&nbsp;</span>{phone_str}</td></tr>')
    if direct:
        lines.append(f'<tr><td style="padding:1px 0;font-size:13px;color:#1f2937;"><span style="color:{color};font-weight:700;">Ligne directe&nbsp;</span>{direct}</td></tr>')
    if email:
        lines.append(f'<tr><td style="padding:1px 0;font-size:13px;"><span style="color:{color};font-weight:700;">Courriel&nbsp;</span><a href="mailto:{email}" style="color:#1f2937;text-decoration:none;">{email}</a></td></tr>')
    if website:
        lines.append(f'<tr><td style="padding:1px 0;font-size:13px;"><span style="color:{color};font-weight:700;">Web&nbsp;</span><a href="{_esc(_norm_url(website))}" style="color:#1f2937;text-decoration:none;">{_esc(website)}</a></td></tr>')
    if address:
        lines.append(f'<tr><td style="padding:1px 0;font-size:12px;color:#6b7280;">{address}</td></tr>')

    social = s.get("social", {}) or {}
    social_links = []
    for k, (label, c) in _SOCIAL.items():
        if social.get(k):
            social_links.append(f'<a href="{_esc(_norm_url(social[k]))}" style="color:{c};text-decoration:none;font-weight:600;font-size:12px;">{label}</a>')
    sep = ' <span style="color:#d1d5db;">|</span> '
    social_row = f'<tr><td style="padding-top:6px;font-family:Arial,Helvetica,sans-serif;">{sep.join(social_links)}</td></tr>' if social_links else ""

    logo_cell = (f'<td style="vertical-align:top;padding-right:18px;border-right:3px solid {color};">'
                 f'<img src="{_esc(logo)}" width="86" style="display:block;width:86px;border-radius:6px;" alt="{company}" /></td>') if logo else ""
    identity = (
        f'<td style="vertical-align:top;padding-left:{"18px" if logo else "0"};">'
        f'<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">'
        f'<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;color:#0f172a;padding-bottom:2px;">{name}</td></tr>'
        + (f'<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:{color};padding-bottom:2px;">{title_line}</td></tr>' if title_line else "")
        + (f'<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#0f172a;padding-bottom:6px;">{company}</td></tr>' if company else "")
        + "".join(lines)
        + social_row
        + "</table></td>"
    )
    rows = [f"<tr>{logo_cell}{identity}</tr>"]

    banner = _resolve_banner(user, s)
    if banner["gif_url"]:
        img = f'<img src="{_esc(banner["gif_url"])}" width="600" style="display:block;width:600px;max-width:100%;border-radius:8px;border:0;" alt="Bannière" />'
        link = _norm_url(banner["banner_link"])
        if link and user.get("id"):
            track = f'{BACKEND_PUBLIC_URL}/api/track/click?u={_esc(user["id"])}&b={urllib.parse.quote(banner["key"] or "Défaut")}&url={urllib.parse.quote(link)}'
            img = f'<a href="{_esc(track)}" target="_blank" style="text-decoration:none;">{img}</a>'
        elif link:
            img = f'<a href="{_esc(link)}" target="_blank" style="text-decoration:none;">{img}</a>'
        rows.append(f'<tr><td colspan="2" style="padding-top:16px;">{img}</td></tr>')

    if disclaimer:
        rows.append(f'<tr><td colspan="2" style="padding-top:14px;"><div style="border-top:1px solid #e5e7eb;padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#9ca3af;max-width:600px;">{disclaimer}</div></td></tr>')

    return f'<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">{"".join(rows)}</table>'


def _signature_file(sig_html):
    return f'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>{sig_html}</body></html>'


# ---------------------------------------------------------------------------
# Department banners
# ---------------------------------------------------------------------------
@api_router.post("/departments")
async def create_department(data: DeptCreate, admin: dict = Depends(require_admin)):
    settings = await load_settings()
    banners = settings.get("department_banners", [])
    if any(b["name"].strip().lower() == data.name.strip().lower() for b in banners):
        raise HTTPException(status_code=400, detail="Ce département existe déjà")
    banner = DeptBanner(id=str(uuid.uuid4()), name=data.name.strip()).model_dump()
    banners.append(banner)
    await db.settings.update_one({"key": "global"}, {"$set": {"department_banners": banners}}, upsert=True)
    return banner


@api_router.delete("/departments/{dept_id}")
async def delete_department(dept_id: str, admin: dict = Depends(require_admin)):
    settings = await load_settings()
    banners = [b for b in settings.get("department_banners", []) if b["id"] != dept_id]
    await db.settings.update_one({"key": "global"}, {"$set": {"department_banners": banners}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# SMTP configuration + email sending
# ---------------------------------------------------------------------------
@api_router.get("/smtp")
async def get_smtp(admin: dict = Depends(require_admin)):
    cfg = await db.smtp_config.find_one({"key": "global"}) or {}
    return {
        "host": cfg.get("host", ""), "port": cfg.get("port", 587),
        "username": cfg.get("username", ""), "from_email": cfg.get("from_email", ""),
        "from_name": cfg.get("from_name", ""), "has_password": bool(cfg.get("password")),
    }


@api_router.put("/smtp")
async def put_smtp(data: SmtpConfigInput, admin: dict = Depends(require_admin)):
    existing = await db.smtp_config.find_one({"key": "global"}) or {}
    payload = {"key": "global", "host": data.host.strip(), "port": int(data.port),
               "username": data.username.strip(), "from_email": data.from_email.strip(),
               "from_name": data.from_name.strip()}
    if data.password:
        payload["password"] = data.password
    elif existing.get("password"):
        payload["password"] = existing["password"]
    await db.smtp_config.update_one({"key": "global"}, {"$set": payload}, upsert=True)
    return {"ok": True}


async def _send_email(to, subject, html_body, attachment_html=None, attachment_name="signature.html"):
    cfg = await db.smtp_config.find_one({"key": "global"})
    if not cfg or not cfg.get("host"):
        raise HTTPException(status_code=400, detail="SMTP non configuré. Renseignez les paramètres d'envoi.")
    msg = EmailMessage()
    sender = cfg.get("from_email") or cfg.get("username")
    msg["From"] = f'{cfg.get("from_name", "")} <{sender}>'.strip()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Votre client de messagerie ne supporte pas le HTML. Voir la pièce jointe.")
    msg.add_alternative(html_body, subtype="html")
    if attachment_html:
        msg.add_attachment(attachment_html.encode("utf-8"), maintype="text",
                           subtype="html", filename=attachment_name)
    port = int(cfg.get("port", 587))
    kwargs = {"use_tls": True} if port == 465 else {"start_tls": True}
    try:
        await aiosmtplib.send(msg, hostname=cfg["host"], port=port,
                              username=cfg.get("username") or None,
                              password=cfg.get("password") or None, timeout=30, **kwargs)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
        raise HTTPException(status_code=502, detail=f"Échec de l'envoi SMTP : {e}")


def _email_body(user, signature_html):
    name = user.get("name", "")
    link = f"{BACKEND_PUBLIC_URL}/app/signature"
    return f"""
<div style="font-family:Arial,Helvetica,sans-serif;max-width:660px;margin:0 auto;color:#1f2937;">
  <h2 style="color:#111827;">Bonjour {name},</h2>
  <p>Voici votre <b>signature courriel officielle</b>. Vous pouvez la copier directement dans Outlook,
  ou utiliser le fichier <b>signature.html</b> joint à ce message.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:18px 0;">{signature_html}</div>
  <p style="font-size:14px;"><b>Installation dans Outlook :</b> Fichier → Options → Courrier → Signatures →
  créez une signature, cliquez dans la zone d'édition puis collez (Ctrl+V).</p>
  <p style="font-size:14px;">Mettez à jour vos coordonnées ici : <a href="{link}" style="color:#2563EB;">{link}</a></p>
  <p style="font-size:12px;color:#9ca3af;">Message envoyé automatiquement par SigFlow Office.</p>
</div>"""


@api_router.post("/email/test")
async def email_test(data: EmailTestInput, admin: dict = Depends(require_admin)):
    await _send_email(str(data.to), "Test SigFlow — configuration SMTP",
                      "<p>Ceci est un courriel de test. Votre configuration SMTP fonctionne. ✅</p>")
    return {"ok": True}


@api_router.post("/email/send/{emp_id}")
async def email_send_one(emp_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"_id": ObjectId(emp_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    user["id"] = str(user["_id"])
    settings = await load_settings()
    sig = build_signature_html(user, settings)
    await _send_email(user["email"], "Votre signature courriel officielle",
                      _email_body(user, sig), attachment_html=_signature_file(sig))
    return {"ok": True, "sent_to": user["email"]}


@api_router.post("/email/send-all")
async def email_send_all(admin: dict = Depends(require_admin)):
    settings = await load_settings()
    users = await db.users.find().to_list(1000)
    sent, failed = [], []
    for u in users:
        u["id"] = str(u["_id"])
        try:
            sig = build_signature_html(u, settings)
            await _send_email(u["email"], "Votre signature courriel officielle",
                              _email_body(u, sig), attachment_html=_signature_file(sig))
            sent.append(u["email"])
        except Exception as e:
            failed.append({"email": u["email"], "error": str(e)})
    return {"sent": sent, "failed": failed, "sent_count": len(sent)}


# ---------------------------------------------------------------------------
# Click tracking + analytics
# ---------------------------------------------------------------------------
@app.get("/api/track/click")
async def track_click(u: str = Query(""), b: str = Query("Défaut"), url: str = Query("")):
    target = url if url.lower().startswith(("http://", "https://")) else "https://www.google.com"
    try:
        await db.clicks.insert_one({"user_id": u, "banner": b, "target": target,
                                    "ts": datetime.now(timezone.utc).isoformat()})
    except Exception as e:
        logger.error(f"click log failed: {e}")
    return RedirectResponse(url=target, status_code=302)


@api_router.get("/analytics/clicks")
async def analytics_clicks(admin: dict = Depends(require_admin)):
    clicks = await db.clicks.find().to_list(20000)
    by_banner, by_user = {}, {}
    for c in clicks:
        key = c.get("banner", "Défaut")
        by_banner[key] = by_banner.get(key, 0) + 1
        uid = c.get("user_id", "")
        if uid:
            by_user[uid] = by_user.get(uid, 0) + 1
    users = await db.users.find().to_list(1000)
    umap = {str(x["_id"]): x.get("name", x.get("email", "")) for x in users}
    return {
        "total": len(clicks),
        "by_banner": sorted([{"banner": k, "count": v} for k, v in by_banner.items()], key=lambda x: -x["count"]),
        "by_employee": sorted([{"user_id": k, "name": umap.get(k, "Inconnu"), "count": v}
                               for k, v in by_user.items()], key=lambda x: -x["count"]),
    }


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
