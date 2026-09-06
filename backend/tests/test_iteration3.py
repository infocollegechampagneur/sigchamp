"""Backend tests for iteration 3: local storage, deploy scripts, send log, reminders, installed toggle."""
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
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def employee_headers():
    email = f"test_i3_{uuid.uuid4().hex[:8]}@sigflow.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "Pw123!", "name": "I3 Emp"}, timeout=15)
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def test_employee(admin_headers):
    email = f"emp_i3_{uuid.uuid4().hex[:8]}@sigflow.com"
    r = requests.post(f"{API}/employees", headers=admin_headers,
                      json={"email": email, "password": "Pw123!", "name": "TEST_I3 Emp", "title": "Dev"},
                      timeout=15)
    assert r.status_code == 200, r.text
    emp = r.json()
    yield emp
    # cleanup
    requests.delete(f"{API}/employees/{emp['id']}", headers=admin_headers, timeout=15)


def _png(color=(20, 80, 200)):
    b = io.BytesIO()
    Image.new("RGB", (150, 80), color).save(b, format="PNG")
    return b.getvalue()


# ---------- Local storage ----------
class TestLocalStorage:
    def test_upload_returns_local_path_and_serves(self, admin_headers):
        r = requests.post(f"{API}/upload", headers=admin_headers,
                          files={"file": ("t.png", _png(), "image/png")}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d and "url" in d
        # served via /api/files
        assert "/api/files/" in d["url"]
        # file should exist on local disk
        local_path = Path("/app/backend/storage") / d["path"]
        assert local_path.exists(), f"local file missing: {local_path}"
        # fetch via public URL
        full_url = d["url"] if d["url"].startswith("http") else f"{BASE_URL}{d['url']}"
        r2 = requests.get(full_url, timeout=15)
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        assert len(r2.content) > 100

    def test_gif_generation_writes_local(self, admin_headers):
        # upload two frames
        paths = []
        for c in [(255, 0, 0), (0, 255, 0)]:
            r = requests.post(f"{API}/upload", headers=admin_headers,
                              files={"file": ("f.png", _png(c), "image/png")}, timeout=30)
            paths.append(r.json()["path"])
        r = requests.post(f"{API}/gif/generate", headers=admin_headers,
                          json={"images": paths, "interval_ms": 600}, timeout=60)
        assert r.status_code == 200, r.text
        gif_url = r.json()["gif_url"]
        assert ".gif" in gif_url
        # fetch it
        full = gif_url if gif_url.startswith("http") else f"{BASE_URL}{gif_url}"
        r2 = requests.get(full, timeout=15)
        assert r2.status_code == 200
        assert r2.headers.get("content-type") in ("image/gif", "image/gif; charset=utf-8")

    def test_serve_file_404_for_missing(self):
        r = requests.get(f"{BASE_URL}/api/files/sigflow/does_not_exist_{uuid.uuid4().hex}.png", timeout=15)
        assert r.status_code == 404


# ---------- Installed toggle ----------
class TestInstalledToggle:
    def test_toggle_installed_persists(self, admin_headers, test_employee):
        emp_id = test_employee["id"]
        # initial state should be False/None
        r = requests.put(f"{API}/employees/{emp_id}/installed", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["signature_installed"] is True
        assert d.get("installed_at")
        # verify via GET /employees
        r2 = requests.get(f"{API}/employees", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        emp = next(e for e in r2.json() if e["id"] == emp_id)
        assert emp["signature_installed"] is True
        # toggle back
        r3 = requests.put(f"{API}/employees/{emp_id}/installed", headers=admin_headers, timeout=15)
        assert r3.status_code == 200
        assert r3.json()["signature_installed"] is False

    def test_toggle_forbidden_for_employee(self, employee_headers, test_employee):
        r = requests.put(f"{API}/employees/{test_employee['id']}/installed",
                         headers=employee_headers, timeout=15)
        assert r.status_code == 403

    def test_toggle_404(self, admin_headers):
        # Valid ObjectId shape but not present
        r = requests.put(f"{API}/employees/507f1f77bcf86cd799439011/installed",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ---------- Send log ----------
class TestSendLog:
    def test_send_log_after_failed_send(self, admin_headers, test_employee):
        emp_id = test_employee["id"]
        # trigger a send (will fail due to fake SMTP -> 502)
        r = requests.post(f"{API}/email/send/{emp_id}", headers=admin_headers, timeout=60)
        assert r.status_code in (502, 400)
        # send log should now have an entry
        r2 = requests.get(f"{API}/send-log", headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        entries = r2.json()
        assert isinstance(entries, list)
        matching = [e for e in entries if e.get("email") == test_employee["email"]]
        assert len(matching) >= 1, f"no send-log entry for {test_employee['email']}"
        e0 = matching[0]
        assert e0["status"] in ("failed", "sent")
        assert "ts" in e0
        # no mongo _id leakage
        assert "_id" not in e0

    def test_send_log_forbidden_for_employee(self, employee_headers):
        r = requests.get(f"{API}/send-log", headers=employee_headers, timeout=15)
        assert r.status_code == 403


# ---------- Reminders ----------
class TestReminders:
    def test_send_reminders_targets_not_installed(self, admin_headers, test_employee):
        # Ensure employee is NOT installed
        r0 = requests.get(f"{API}/employees", headers=admin_headers, timeout=15).json()
        emp = next(e for e in r0 if e["id"] == test_employee["id"])
        if emp.get("signature_installed"):
            requests.put(f"{API}/employees/{test_employee['id']}/installed",
                         headers=admin_headers, timeout=15)
        r = requests.post(f"{API}/email/send-reminders", headers=admin_headers, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("sent", "failed", "sent_count", "targeted"):
            assert k in d
        # target count > 0 since our test emp isn't installed
        assert d["targeted"] >= 1
        # SMTP fake -> all fail
        assert d["sent_count"] == 0
        assert len(d["failed"]) >= 1

    def test_send_reminders_forbidden(self, employee_headers):
        r = requests.post(f"{API}/email/send-reminders", headers=employee_headers, timeout=30)
        assert r.status_code == 403


# ---------- Deploy scripts ----------
class TestDeployScripts:
    def test_exchange_script(self, admin_headers):
        r = requests.get(f"{API}/deploy/exchange-script", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/plain")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "sigflow-exchange-signatures.ps1" in cd
        body = r.text
        assert "$signatures = @{}" in body
        assert "New-TransportRule" in body
        assert "ApplyHtmlDisclaimerText" in body

    def test_gpo_script(self, admin_headers):
        r = requests.get(f"{API}/deploy/gpo-script", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/plain")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd
        assert "sigflow-outlook-gpo.ps1" in cd
        body = r.text
        assert "$signatures = @{}" in body
        assert "MailSettings" in body
        assert "NewSignature" in body

    def test_deploy_forbidden_for_employee(self, employee_headers):
        r1 = requests.get(f"{API}/deploy/exchange-script", headers=employee_headers, timeout=15)
        r2 = requests.get(f"{API}/deploy/gpo-script", headers=employee_headers, timeout=15)
        assert r1.status_code == 403
        assert r2.status_code == 403

    def test_deploy_unauthenticated(self):
        r1 = requests.get(f"{API}/deploy/exchange-script", timeout=15)
        r2 = requests.get(f"{API}/deploy/gpo-script", timeout=15)
        assert r1.status_code in (401, 403)
        assert r2.status_code in (401, 403)
