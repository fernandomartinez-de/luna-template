"""Connect (or reconnect) the bank, used by the Connect Bank workflow.

Run with no code: asks Enable Banking for a bank sign in link and shows it on
the workflow summary page.
Run with the code from Luna's callback page: finishes the connection and saves
it in the database (app_config "bank_session"), where the daily sync uses it.
"""
import os
from datetime import datetime, timedelta, timezone

from enablebanking import api, callback_url, db, fail, find_bank, save_session, say

CODE = os.environ.get("CODE", "").strip()

if not CODE:
    bank = find_bank()
    days = min(180, int(bank.get("maximum_consent_validity") or 7776000) // 86400)
    until = (datetime.now(timezone.utc) + timedelta(days=days)).replace(microsecond=0)
    r = api("POST", "/auth", json={
        "access": {"valid_until": until.isoformat()},
        "aspsp": {"name": bank["name"], "country": bank["country"]},
        "state": "lunabank",
        "redirect_url": callback_url(),
        "psu_type": "personal",
    })
    if r.status_code == 422 and "redirect" in r.text.lower():
        fail(f"## ❌ Redirect address not allowed\nIn the Enable Banking control panel, the app's redirect URL "
             f"must be exactly:\n\n`{callback_url()}`")
    r.raise_for_status()
    say("## Step 1 of 2: open this link\n")
    say(f"### 👉 [Click here to connect {bank['name']}]({r.json()['url']})\n")
    say("Approve the Enable Banking screen, then sign in to your bank and approve access. "
        "You'll land on a Luna page showing a code. Copy it, then run **Connect Bank** again "
        "and paste it in the **code** box.")
    say(f"\nThis connection will last about {days} days. Luna warns you before it runs out.")
    raise SystemExit(0)

r = api("POST", "/sessions", json={"code": CODE})
if r.status_code >= 400:
    fail("## ❌ That code didn't work\nCodes expire after a few minutes and work only once. "
         "Run **Connect Bank** with the code box empty to get a fresh link, and try again.")
s = r.json()
accounts = []
for a in s.get("accounts", []):
    iban = ((a.get("account_id") or {}).get("iban") or "")
    label = (a.get("name") or a.get("product") or "Account").strip()
    if iban:
        label = f"{label} {iban[-4:]}"
    accounts.append({"uid": a["uid"], "label": label[:40]})
if not accounts:
    fail("## ❌ No accounts came back\nIn the Enable Banking control panel, open your app and use "
         "**Link accounts** to activate it with your bank first (guide, bank step B2).")

save_session(db(), {"session_id": s["session_id"], "valid_until": s["access"]["valid_until"],
                    "bank": s.get("aspsp", {}).get("name"), "accounts": accounts,
                    "connected_at": datetime.now(timezone.utc).isoformat()})
say("## ✅ Bank connected\n")
for a in accounts:
    say(f"* {a['label']}")
say(f"\nValid until {s['access']['valid_until'][:10]}. Now run **Pull Bank Transactions** once; "
    "after that it runs by itself every morning.")
