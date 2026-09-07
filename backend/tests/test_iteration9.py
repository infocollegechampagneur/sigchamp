"""Iteration 9: M365 Graph enrichment + booking_url profile field."""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://email-sig-gallery.preview.emergentagent.com').rstrip('/')
ADMIN_EMAIL = "informatique@champagneur.qc.ca"
ADMIN_PASSWORD = "sig3713+"


def _token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def test_m365_test_endpoint():
    tok = _token()
    r = requests.get(f"{BASE_URL}/api/m365/test", headers={"Authorization": f"Bearer {tok}"}, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("graph_ok") is True, data
    assert data.get("exchange_ok") is True, data


def test_m365_push_slynch_enriched():
    tok = _token()
    r = requests.post(f"{BASE_URL}/api/m365/push",
                      headers={"Authorization": f"Bearer {tok}"},
                      json={"emails": ["s.lynch@champagneur.qc.ca"]},
                      timeout=180)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("applied_count") == 1, data
    assert "s.lynch@champagneur.qc.ca" in data.get("applied", []), data
    assert data.get("failed") in ([], None) or len(data.get("failed", [])) == 0, data


def test_booking_url_persistence():
    tok = _token()
    h = {"Authorization": f"Bearer {tok}"}

    # SET
    url = "https://outlook.office.com/bookwithme/user/test"
    r = requests.put(f"{BASE_URL}/api/auth/me", headers=h, json={"booking_url": url}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("booking_url") == url, r.json()

    # GET verifies persistence
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=30)
    assert r.status_code == 200
    assert r.json().get("booking_url") == url

    # CLEAR
    r = requests.put(f"{BASE_URL}/api/auth/me", headers=h, json={"booking_url": ""}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("booking_url") in ("", None)

    r = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=30)
    assert r.json().get("booking_url") in ("", None)
