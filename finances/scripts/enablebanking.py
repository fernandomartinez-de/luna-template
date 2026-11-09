"""Shared helpers for talking to Enable Banking (bank data for European banks).

Enable Banking is a free service (in its personal, "restricted" mode) that reads
your own bank accounts through the official EU open banking rules (PSD2).

Secrets it needs (GitHub > Settings > Secrets and variables > Actions):
  ENABLE_BANKING_APP_ID   the Application ID shown in the Enable Banking control panel
  ENABLE_BANKING_KEY      the whole contents of the .pem file downloaded when the app was made
Optional repository variables (Settings > Secrets and variables > Actions > Variables):
  BANK_NAME     defaults to "Banco de Sabadell"
  BANK_COUNTRY  defaults to "ES"
"""
import json
import os
import time
from datetime import datetime, timezone

import jwt
import requests
from supabase import create_client

API = "https://api.enablebanking.com"
SESSION_KEY = "bank_session"  # app_config row holding the current bank connection

BANK_NAME = (os.environ.get("BANK_NAME") or "Banco de Sabadell").strip()
BANK_COUNTRY = (os.environ.get("BANK_COUNTRY") or "ES").strip().upper()
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")


def say(text=""):
    """Print, and also write to the workflow run's summary page."""
    print(text)
    if SUMMARY:
        with open(SUMMARY, "a") as f:
            f.write(text + "\n")


def fail(text):
    say(text)
    raise SystemExit(1)


def _key():
    app_id = os.environ.get("ENABLE_BANKING_APP_ID", "").strip()
    pem = os.environ.get("ENABLE_BANKING_KEY", "").strip().replace("\\n", "\n")
    if not app_id or not pem:
        fail("## ❌ Enable Banking secrets missing\nAdd `ENABLE_BANKING_APP_ID` and `ENABLE_BANKING_KEY` "
             "as GitHub secrets first (guide, bank step B3).")
    if "PRIVATE KEY" not in pem:
        fail("## ❌ ENABLE_BANKING_KEY looks wrong\nIt must be the whole .pem file, including the "
             "`-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines.")
    return app_id, pem


def headers():
    app_id, pem = _key()
    now = int(time.time())
    token = jwt.encode({"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 3600},
                       pem, algorithm="RS256", headers={"kid": app_id})
    return {"Authorization": f"Bearer {token}"}


def api(method, path, **kw):
    r = requests.request(method, API + path, headers=headers(), timeout=60, **kw)
    if r.status_code >= 400:
        print(f"Enable Banking {method} {path} -> {r.status_code}: {r.text[:500]}")
    return r


def find_bank():
    r = api("GET", "/aspsps", params={"country": BANK_COUNTRY, "psu_type": "personal"})
    if r.status_code == 401 or r.status_code == 403:
        fail("## ❌ Enable Banking didn't accept the app id or key\nCheck that `ENABLE_BANKING_APP_ID` matches "
             "the app in the control panel and `ENABLE_BANKING_KEY` is that app's .pem file.")
    r.raise_for_status()
    banks = r.json().get("aspsps", [])
    exact = [b for b in banks if b["name"].lower() == BANK_NAME.lower()]
    if exact:
        return exact[0]
    close = [b for b in banks if BANK_NAME.lower().split()[-1] in b["name"].lower()]
    if len(close) == 1:
        return close[0]
    names = ", ".join(sorted(b["name"] for b in (close or banks)))
    fail(f"## ❌ Couldn't find the bank \"{BANK_NAME}\"\nAdd a repository variable `BANK_NAME` set to the exact name from this list: {names}")


def db():
    return create_client(os.environ["SUPABASE_URL"].strip(), os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip())


def load_session(sb):
    row = sb.table("app_config").select("value").eq("key", SESSION_KEY).maybe_single().execute()
    return json.loads(row.data["value"]) if row and row.data else None


def save_session(sb, data):
    sb.table("app_config").upsert({"key": SESSION_KEY, "value": json.dumps(data),
                                   "updated_at": datetime.now(timezone.utc).isoformat()}).execute()


def callback_url():
    repo = (os.environ.get("PUBLISH_REPO") or os.environ.get("GITHUB_REPOSITORY", "")).strip()
    owner, name = repo.split("/")
    return f"https://{owner.lower()}.github.io/{name}/callback.html"
