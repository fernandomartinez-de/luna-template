"""Connect WHOOP to Luna, used by the Connect WHOOP workflow.

Run with no code: prints the WHOOP sign in link to the workflow summary.
Run with the code from the callback page: trades it for a refresh token and
saves that token in the database, where the daily sync picks it up.
"""
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests
from supabase import create_client

CLIENT_ID = os.environ.get("WHOOP_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("WHOOP_CLIENT_SECRET", "").strip()
CODE = os.environ.get("CODE", "").strip()
REPO = os.environ.get("GITHUB_REPOSITORY", "")
PAGES_REPO = (os.environ.get("PUBLISH_REPO") or REPO).strip()
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")

owner, name = PAGES_REPO.split("/")
REDIRECT = f"https://{owner.lower()}.github.io/{name}/callback.html"
SCOPES = "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement"


def say(text):
    print(text)
    if SUMMARY:
        with open(SUMMARY, "a") as f:
            f.write(text + "\n")


if not CLIENT_ID or not CLIENT_SECRET:
    say("## ❌ WHOOP secrets missing\nAdd the `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET` secrets first (guide step W2).")
    sys.exit(1)

if not CODE:
    link = "https://api.prod.whoop.com/oauth/oauth2/auth?" + urlencode({
        "client_id": CLIENT_ID, "redirect_uri": REDIRECT, "response_type": "code",
        "scope": SCOPES, "state": "lunawhoop",
    })
    say("## Step 1 of 2: open this link\n")
    say(f"### 👉 [Click here to connect WHOOP]({link})\n")
    say("Sign in to WHOOP and tap **Grant**. You'll land on a Luna page showing a code. "
        "Copy it, then run **Connect WHOOP** again and paste it in the **code** box.")
    say(f"\nThe redirect address in your WHOOP app must be exactly: `{REDIRECT}`")
    sys.exit(0)

r = requests.post("https://api.prod.whoop.com/oauth/oauth2/token", data={
    "grant_type": "authorization_code", "code": CODE, "client_id": CLIENT_ID,
    "client_secret": CLIENT_SECRET, "redirect_uri": REDIRECT,
})
if r.status_code != 200:
    say("## ❌ WHOOP didn't accept that code\nCodes expire after a few minutes and work only once. "
        "Run **Connect WHOOP** with the code box empty to get a fresh link, and try again.")
    print(r.status_code, r.text[:300])
    sys.exit(1)

token = r.json()["refresh_token"]
db = create_client(os.environ["SUPABASE_URL"].strip(), os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip())
db.table("app_config").upsert({"key": "whoop_refresh_token", "value": token,
                               "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
say("## ✅ WHOOP connected\nNow run **Whoop Sync** once to pull your data. After that it runs by itself 5 times a day.")
