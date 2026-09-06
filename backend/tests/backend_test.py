"""Backend API tests for SigFlow email signature app."""
import io
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path
from PIL import Image

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@sigflow.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def employee_creds():
    """Register (or reuse) a unique employee for the test session."""
    email = f"test_{uuid.uuid4().hex[:8]}@sigflow.com"
    password = "Employe123!"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "Test Employee"}, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.text}"
    return {"email": email, "password": password, "token": r.json()["token"], "user": r.json()["user"]}


@pytest.fixture(scope="session")
def employee_headers(employee_creds):
    return {"Authorization": f"Bearer {employee_creds['token']}"}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_admin_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_and_login_employee(self, employee_creds):
        r = requests.post(f"{API}/auth/login",
                          json={"email": employee_creds["email"], "password": employee_creds["password"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "employee"

    def test_register_duplicate(self, employee_creds):
        r = requests.post(f"{API}/auth/register",
                          json={"email": employee_creds["email"], "password": "x", "name": "dup"}, timeout=15)
        assert r.status_code == 400

    def test_update_me_persists(self, employee_headers):
        payload = {"title": "QA Engineer", "phone_ext": "1234", "department": "QA"}
        r = requests.put(f"{API}/auth/me", json=payload, headers=employee_headers, timeout=15)
        assert r.status_code == 200
        for k, v in payload.items():
            assert r.json()[k] == v
        r2 = requests.get(f"{API}/auth/me", headers=employee_headers, timeout=15)
        assert r2.json()["title"] == "QA Engineer"


# ---------- Settings ----------
class TestSettings:
    def test_get_settings_admin(self, admin_headers):
        r = requests.get(f"{API}/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for key in ["company_name", "logo_url", "primary_color", "social", "gif_images"]:
            assert key in d

    def test_get_settings_employee(self, employee_headers):
        r = requests.get(f"{API}/settings", headers=employee_headers, timeout=15)
        assert r.status_code == 200

    def test_update_settings_admin(self, admin_headers):
        # Fetch first to preserve existing state (department_banners etc.)
        current = requests.get(f"{API}/settings", headers=admin_headers, timeout=15).json()
        payload = {**current, **{
            "company_name": "TEST_Acme", "website": "https://acme.test", "phone_main": "+33 1 23",
            "address": "1 rue Test, Paris", "disclaimer": "Confidentiel.", "primary_color": "#123456",
            "social": {"linkedin": "https://linkedin.com/x", "twitter": "", "facebook": "", "instagram": "", "youtube": ""},
            "banner_link": "https://acme.test/promo",
        }}
        r = requests.put(f"{API}/settings", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["company_name"] == "TEST_Acme"
        # Verify persistence
        r2 = requests.get(f"{API}/settings", headers=admin_headers, timeout=15)
        assert r2.json()["company_name"] == "TEST_Acme"
        assert r2.json()["primary_color"] == "#123456"
        assert r2.json()["social"]["linkedin"] == "https://linkedin.com/x"

    def test_update_settings_employee_forbidden(self, employee_headers):
        r = requests.put(f"{API}/settings", json={"company_name": "x"}, headers=employee_headers, timeout=15)
        assert r.status_code == 403


# ---------- Upload / files ----------
def _make_png_bytes(color=(200, 30, 30), size=(200, 100)):
    img = Image.new("RGB", size, color)
    b = io.BytesIO()
    img.save(b, format="PNG")
    return b.getvalue()


class TestUploadAndFiles:
    def test_upload_admin(self, admin_headers):
        content = _make_png_bytes()
        r = requests.post(f"{API}/upload", headers=admin_headers,
                          files={"file": ("logo.png", content, "image/png")}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and "url" in data
        # Verify hosted URL is fetchable (public)
        fr = requests.get(data["url"], timeout=30)
        assert fr.status_code == 200
        assert fr.headers.get("Content-Type", "").startswith("image/")
        pytest.shared_upload_path = data["path"]

    def test_upload_employee_forbidden(self, employee_headers):
        r = requests.post(f"{API}/upload", headers=employee_headers,
                          files={"file": ("l.png", _make_png_bytes(), "image/png")}, timeout=30)
        assert r.status_code == 403

    def test_upload_avatar_employee(self, employee_headers):
        r = requests.post(f"{API}/upload-avatar", headers=employee_headers,
                          files={"file": ("a.png", _make_png_bytes((0, 128, 0)), "image/png")}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["url"].startswith("http")
        me = requests.get(f"{API}/auth/me", headers=employee_headers, timeout=15).json()
        assert me["avatar_url"] == r.json()["url"]


# ---------- GIF generation ----------
class TestGif:
    def test_generate_gif(self, admin_headers):
        # Upload 2 images first
        paths = []
        for color in [(200, 30, 30), (30, 200, 30)]:
            r = requests.post(f"{API}/upload", headers=admin_headers,
                              files={"file": (f"s.png", _make_png_bytes(color), "image/png")}, timeout=30)
            assert r.status_code == 200
            paths.append(r.json()["path"])
        r = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": paths, "interval_ms": 1000}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["gif_url"].startswith("http") and ".gif" in d["gif_url"]
        assert d["frames"] == 2
        # Fetch the GIF
        g = requests.get(d["gif_url"], timeout=30)
        assert g.status_code == 200
        assert g.headers.get("Content-Type", "").startswith("image/gif")
        assert g.content[:6] in (b"GIF87a", b"GIF89a")
        # Settings should reflect update
        s = requests.get(f"{API}/settings", headers=admin_headers, timeout=15).json()
        assert s["gif_url"] == d["gif_url"]
        assert s["gif_version"] == d["version"]

    def test_generate_gif_employee_forbidden(self, employee_headers):
        r = requests.post(f"{API}/gif/generate", headers=employee_headers,
                          json={"images": ["x"], "interval_ms": 1000}, timeout=15)
        assert r.status_code == 403

    def test_generate_gif_empty(self, admin_headers):
        r = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": [], "interval_ms": 1000}, timeout=15)
        assert r.status_code == 400


# ---------- Employees CRUD ----------
class TestEmployees:
    def test_list_employees_admin(self, admin_headers):
        r = requests.get(f"{API}/employees", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert any(u["email"] == ADMIN_EMAIL for u in r.json())

    def test_list_employees_forbidden(self, employee_headers):
        r = requests.get(f"{API}/employees", headers=employee_headers, timeout=15)
        assert r.status_code == 403

    def test_create_update_delete_employee(self, admin_headers):
        email = f"test_emp_{uuid.uuid4().hex[:8]}@sigflow.com"
        payload = {"email": email, "password": "Pass123!", "name": "Emp X",
                   "title": "Sales", "phone_ext": "42", "direct_line": "+33 1", "department": "Sales"}
        r = requests.post(f"{API}/employees", json=payload, headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        emp = r.json()
        assert emp["email"] == email
        emp_id = emp["id"]

        # Update
        r2 = requests.put(f"{API}/employees/{emp_id}", json={"title": "Head of Sales"},
                          headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["title"] == "Head of Sales"

        # Delete
        r3 = requests.delete(f"{API}/employees/{emp_id}", headers=admin_headers, timeout=15)
        assert r3.status_code == 200

        # Verify gone
        listing = requests.get(f"{API}/employees", headers=admin_headers, timeout=15).json()
        assert not any(u["id"] == emp_id for u in listing)

    def test_cannot_delete_admin(self, admin_headers):
        listing = requests.get(f"{API}/employees", headers=admin_headers, timeout=15).json()
        admin_user = next(u for u in listing if u["email"] == ADMIN_EMAIL)
        r = requests.delete(f"{API}/employees/{admin_user['id']}", headers=admin_headers, timeout=15)
        assert r.status_code == 400
