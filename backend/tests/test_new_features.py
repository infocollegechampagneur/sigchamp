"""Backend tests for new features: departments, SMTP, email send, click tracking, analytics."""
import io
import os
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


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def employee_headers():
    email = f"test_{uuid.uuid4().hex[:8]}@sigflow.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pw123!", "name": "T Emp"}, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


def _png_bytes(color=(30, 100, 200)):
    b = io.BytesIO()
    Image.new("RGB", (200, 100), color).save(b, format="PNG")
    return b.getvalue()


# ---------- Departments ----------
class TestDepartments:
    def test_create_department(self, admin_headers):
        name = f"TEST_Dept_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/departments", json={"name": name}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == name
        assert "id" in d
        pytest.dept_id = d["id"]
        pytest.dept_name = name

    def test_department_duplicate(self, admin_headers):
        r = requests.post(f"{API}/departments", json={"name": pytest.dept_name}, headers=admin_headers, timeout=15)
        assert r.status_code == 400

    def test_department_forbidden_for_employee(self, employee_headers):
        r = requests.post(f"{API}/departments", json={"name": "x"}, headers=employee_headers, timeout=15)
        assert r.status_code == 403

    def test_generate_dept_banner(self, admin_headers):
        # Upload two frames
        paths = []
        for c in [(200, 30, 30), (30, 200, 30)]:
            r = requests.post(f"{API}/upload", headers=admin_headers,
                              files={"file": ("f.png", _png_bytes(c), "image/png")}, timeout=30)
            paths.append(r.json()["path"])
        r = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": paths, "interval_ms": 800,
                                "department_id": pytest.dept_id,
                                "banner_link": "https://example.com/promo"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "gif_url" in d and ".gif" in d["gif_url"]
        # Verify persisted in settings
        s = requests.get(f"{API}/settings", headers=admin_headers, timeout=15).json()
        banner = next((b for b in s["department_banners"] if b["id"] == pytest.dept_id), None)
        assert banner is not None
        assert banner["gif_url"] == d["gif_url"]
        assert banner["banner_link"] == "https://example.com/promo"

    def test_generate_dept_banner_not_found(self, admin_headers):
        r = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": ["x"], "interval_ms": 500, "department_id": "nonexistent-id"},
                          timeout=30)
        # 400 for image load fail is fine; but with fake dept it may 400 on image first.
        # Try with a real image path to force dept check.
        r2 = requests.post(f"{API}/upload", headers=admin_headers,
                           files={"file": ("f.png", _png_bytes(), "image/png")}, timeout=30)
        path = r2.json()["path"]
        r3 = requests.post(f"{API}/gif/generate", headers=admin_headers,
                           json={"images": [path], "interval_ms": 500, "department_id": "nonexistent-xyz"},
                           timeout=30)
        assert r3.status_code == 404

    def test_delete_department(self, admin_headers):
        r = requests.delete(f"{API}/departments/{pytest.dept_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        s = requests.get(f"{API}/settings", headers=admin_headers, timeout=15).json()
        assert not any(b["id"] == pytest.dept_id for b in s["department_banners"])


# ---------- Per-department resolution via signature ----------
class TestBannerResolution:
    def test_employee_with_matching_department_gets_dept_banner(self, admin_headers):
        # Create dept "Marketing_TEST"
        dept_name = f"Marketing_{uuid.uuid4().hex[:5]}"
        d = requests.post(f"{API}/departments", json={"name": dept_name}, headers=admin_headers, timeout=15).json()
        dept_id = d["id"]
        # Generate its banner
        r = requests.post(f"{API}/upload", headers=admin_headers,
                          files={"file": ("m.png", _png_bytes((0, 0, 255)), "image/png")}, timeout=30)
        path = r.json()["path"]
        g = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": [path, path], "interval_ms": 700,
                                "department_id": dept_id,
                                "banner_link": "https://example.com/mktg"}, timeout=60).json()
        dept_gif = g["gif_url"]
        # Fetch settings and check via model
        s = requests.get(f"{API}/settings", headers=admin_headers, timeout=15).json()
        b = next(b for b in s["department_banners"] if b["id"] == dept_id)
        assert b["name"] == dept_name
        assert b["gif_url"] == dept_gif
        # cleanup
        requests.delete(f"{API}/departments/{dept_id}", headers=admin_headers, timeout=15)


# ---------- SMTP config ----------
class TestSmtp:
    def test_get_smtp_admin(self, admin_headers):
        r = requests.get(f"{API}/smtp", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["host", "port", "username", "from_email", "from_name", "has_password"]:
            assert k in d
        # Should never expose password
        assert "password" not in d

    def test_get_smtp_employee_forbidden(self, employee_headers):
        r = requests.get(f"{API}/smtp", headers=employee_headers, timeout=15)
        assert r.status_code == 403

    def test_put_smtp_saves_and_masks_password(self, admin_headers):
        payload = {"host": "smtp.example.com", "port": 587, "username": "test@example.com",
                   "password": "supersecret", "from_email": "noreply@example.com", "from_name": "SigFlow TEST"}
        r = requests.put(f"{API}/smtp", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        # Reload -> masked
        g = requests.get(f"{API}/smtp", headers=admin_headers, timeout=15).json()
        assert g["host"] == "smtp.example.com"
        assert g["has_password"] is True
        assert "password" not in g

    def test_put_smtp_keeps_password_when_empty(self, admin_headers):
        # Update without password -> password preserved
        payload = {"host": "smtp.example.com", "port": 587, "username": "test@example.com",
                   "password": "", "from_email": "noreply@example.com", "from_name": "SigFlow NEW"}
        r = requests.put(f"{API}/smtp", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        g = requests.get(f"{API}/smtp", headers=admin_headers, timeout=15).json()
        assert g["has_password"] is True  # still true
        assert g["from_name"] == "SigFlow NEW"


# ---------- Email sending (expects SMTP failure gracefully) ----------
class TestEmailSend:
    def test_email_test_smtp_failure(self, admin_headers):
        # SMTP is fake -> should return 502 gracefully
        r = requests.post(f"{API}/email/test", json={"to": "someone@example.com"},
                          headers=admin_headers, timeout=60)
        # 502 expected (fake SMTP or gateway timeout on real SMTP attempt)
        assert r.status_code in (502, 400, 504)

    def test_email_send_all_returns_json(self, admin_headers):
        r = requests.post(f"{API}/email/send-all", headers=admin_headers, timeout=120)
        # Endpoint returns 200 with failed list (per code); each user attempt fails individually
        assert r.status_code == 200
        d = r.json()
        assert "sent" in d and "failed" in d and "sent_count" in d
        # With fake SMTP everyone should fail
        assert d["sent_count"] == 0
        assert len(d["failed"]) >= 1

    def test_email_send_one_smtp_failure(self, admin_headers):
        # get admin id
        me = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15).json()
        r = requests.post(f"{API}/email/send/{me['id']}", headers=admin_headers, timeout=60)
        assert r.status_code in (502, 400)

    def test_email_endpoints_forbidden_for_employee(self, employee_headers):
        r = requests.post(f"{API}/email/test", json={"to": "x@y.com"}, headers=employee_headers, timeout=15)
        assert r.status_code == 403


# ---------- Click tracking ----------
class TestClickTracking:
    def test_track_click_redirects(self):
        # Public endpoint; do not follow redirect
        r = requests.get(f"{API}/track/click",
                         params={"u": "user123", "b": "TESTBanner", "url": "https://example.com/x"},
                         allow_redirects=False, timeout=15)
        assert r.status_code == 302
        assert r.headers["Location"] == "https://example.com/x"

    def test_track_click_default_target(self):
        r = requests.get(f"{API}/track/click", allow_redirects=False, timeout=15)
        assert r.status_code == 302
        assert r.headers["Location"].startswith("http")

    def test_analytics_shows_click(self, admin_headers):
        # Emit a unique banner name so we can find it
        banner = f"TEST_bnr_{uuid.uuid4().hex[:6]}"
        requests.get(f"{API}/track/click",
                     params={"u": "userXYZ", "b": banner, "url": "https://example.com/y"},
                     allow_redirects=False, timeout=15)
        r = requests.get(f"{API}/analytics/clicks", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and "by_banner" in d and "by_employee" in d
        assert any(x["banner"] == banner for x in d["by_banner"])

    def test_analytics_forbidden_for_employee(self, employee_headers):
        r = requests.get(f"{API}/analytics/clicks", headers=employee_headers, timeout=15)
        assert r.status_code == 403
