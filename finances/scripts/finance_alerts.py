"""
Finance alerts.

Runs after the bank sync. Scans recent expense_transactions for things worth
a look, saves each finding once to finance_alerts (deduped by alert_key), and
sends new findings to:
  * ntfy push      (NTFY_TOPIC; optional NTFY_SERVER, default https://ntfy.sh)
  * Gmail email    (GMAIL_USER + GMAIL_APP_PASSWORD; ALERT_EMAIL_TO defaults to GMAIL_USER)
  * Luna           (reads finance_alerts directly)
Any channel whose secrets are missing is skipped.

Checks
  duplicate            same merchant + same amount within DUP_WINDOW_DAYS
  subscription_new     a Subscriptions charge not seen in the past year
  subscription_change  a known subscription billed at a different price
  fee                  interest, late, foreign transaction, ATM, overdraft fees
  fixed_increase       a fixed cost above its recent typical amount
  returned_payment     returned / retried / NSF payments

Usage
  python finances/scripts/finance_alerts.py               # normal run
  python finances/scripts/finance_alerts.py --dry-run     # print, write nothing
  python finances/scripts/finance_alerts.py --fixture f.json --dry-run
"""

import argparse
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from statistics import median

LOOKBACK_DAYS = int(os.environ.get("ALERT_LOOKBACK_DAYS", "35"))   # only alert on recent activity
HISTORY_DAYS = 400                                                 # baselines look back this far
DUP_WINDOW_DAYS = 2
# Link in alerts. Set the LUNA_URL secret to override; otherwise it is worked out
# from the repo this runs in (https://<owner>.github.io/<repo>/finances).
_REPO = os.environ.get("GITHUB_REPOSITORY", "")
LUNA_URL = os.environ.get("LUNA_URL") or (
    f"https://{_REPO.split('/')[0]}.github.io/{_REPO.split('/')[1]}/finances" if "/" in _REPO else "")

FIXED_CATEGORIES = {"Rent", "Mortgage Payment", "Community Fees", "Electricity", "Water", "Gas", "Internet / Phone", "Insurance", "Gym"}
# Categories that are the same bill under different names, compared as one.
FIXED_ALIASES = {}
# Increase needed before alerting: (fraction, minimum amount). Electricity swings by season.
FIXED_THRESHOLDS = {"Electricity": (0.30, 25.0)}
FIXED_DEFAULT_THRESHOLD = (0.05, 5.0)

NO_DUP_CATEGORIES = {"Transport", "Credit Card Payment", "Payroll", "ATM", "Bizum", "Transfer"}

RETURNED_RE = re.compile(r"DEVOLUCION RECIBO|RECIBO DEVUELTO|RETURNED PAYMENT|RETURN(ED)? ITEM|RETRY PYMT|\bNSF\b|INSUFFICIENT FUNDS|PAYMENT RETURNED", re.I)
FEE_RULES = [
    # (regex, label, severity)
    (re.compile(r"INTERESES|INTEREST CHARGE|INTEREST DEBIT|PURCH(ASE)? INTEREST", re.I), "Interest charge", "high"),
    (re.compile(r"DESCUBIERTO|EXCEDIDO", re.I), "Overdraft fee", "high"),
    (re.compile(r"COMISION|COMISIÓN", re.I), "Bank fee", "medium"),
    (re.compile(r"LATE (FEE|PAYMENT)", re.I), "Late fee", "high"),
    (re.compile(r"OVERDRAFT|OD FEE", re.I), "Overdraft fee", "high"),
    (re.compile(r"RETURNED PAYMENT FEE", re.I), "Returned payment fee", "high"),
    (re.compile(r"ANNUAL (MEMBERSHIP )?FEE", re.I), "Annual fee", "medium"),
    (re.compile(r"FOREIGN (TRANSACTION|EXCHANGE RATE ADJUSTMENT) FEE", re.I), "Foreign transaction fee", "medium"),
    (re.compile(r"ATM FEE", re.I), "ATM fee", "medium"),
    (re.compile(r"(MONTHLY )?SERVICE (FEE|CHARGE)", re.I), "Service fee", "medium"),
]
SMALL_FEE = 5.00   # fees under this are 'low' (email and Luna only, no push)


# ---------------------------------------------------------------- helpers

def d(v):
    return v if isinstance(v, date) else datetime.strptime(str(v)[:10], "%Y-%m-%d").date()


CURRENCY_SYMBOL = os.environ.get("CURRENCY_SYMBOL", "€")


def money(x):
    v = f"{abs(float(x)):,.2f}"
    if CURRENCY_SYMBOL == "$":
        return f"${v}"
    return v.replace(",", "X").replace(".", ",").replace("X", ".") + f" {CURRENCY_SYMBOL}"


_PREFIX = re.compile(r"^(TST\*|SQ \*|CPP\*|SP |GLF\*|POS DEBIT |PAY BY BANK PURCHASE )\s*", re.I)


def merchant_key(desc):
    """Stable-ish merchant name: drop processor prefixes, ids, dates, digits."""
    s = _PREFIX.sub("", (desc or "").upper())
    s = re.sub(r"\b(PPD|CCD|WEB) ID:?.*$", "", s)
    s = re.sub(r"\d{2}/\d{2}", " ", s)
    s = re.sub(r"[^A-Z&' ]+", " ", s)
    words = [w for w in s.split() if len(w) > 1 or w == "&"]
    return " ".join(words[:3]) or (desc or "").upper()[:20]


def spend(t):
    return -float(t["amount"]) if float(t["amount"]) < 0 else 0.0


# ---------------------------------------------------------------- checks

def find_alerts(txns, today=None, mutes=frozenset()):
    today = today or date.today()
    since = today - timedelta(days=LOOKBACK_DAYS)
    for t in txns:
        t["_date"] = d(t["transaction_date"])
        t["_m"] = merchant_key(t.get("description"))
    txns = sorted(txns, key=lambda t: (t["_date"], t["id"]))
    recent = [t for t in txns if t["_date"] >= since]
    out = {}

    def add(key, **a):
        if (a["alert_type"], a.get("merchant")) in mutes:
            return
        out.setdefault(key, {"alert_key": key, **a})

    # returned / failed payments
    for t in recent:
        if RETURNED_RE.search(t.get("description") or ""):
            add(f"returned:{t['id']}", alert_type="returned_payment", severity="high",
                title=f"Returned payment {money(t['amount'])}",
                detail=f"{t['description']} on {t['_date']:%b %-d} ({t.get('source') or 'account'}). A bounced payment can bring late fees; check the funding account.",
                merchant=t["_m"], amount=abs(float(t["amount"])), txn_date=str(t["_date"]), transaction_ids=[t["id"]])

    # fees and interest
    for t in recent:
        if float(t["amount"]) >= 0:
            continue
        for rx, label, sev in FEE_RULES:
            if rx.search(t.get("description") or ""):
                amt = spend(t)
                if sev == "medium" and amt < SMALL_FEE:
                    sev = "low"
                add(f"fee:{t['id']}", alert_type="fee", severity=sev,
                    title=f"{label} {money(amt)}",
                    detail=f"{t['description']} on {t['_date']:%b %-d} ({t.get('source') or 'account'}).",
                    merchant=label.upper(), amount=amt, txn_date=str(t["_date"]), transaction_ids=[t["id"]])
                break

    # duplicate charges
    by_key = defaultdict(list)
    for t in recent:
        if float(t["amount"]) >= 0 or t.get("category") in NO_DUP_CATEGORIES:
            continue
        if RETURNED_RE.search(t.get("description") or ""):
            continue
        by_key[(t["_m"], round(spend(t), 2))].append(t)
    for (m, amt), group in by_key.items():
        for a, b in zip(group, group[1:]):
            if (b["_date"] - a["_date"]).days <= DUP_WINDOW_DAYS:
                when = f"{a['_date']:%b %-d}" if a["_date"] == b["_date"] else f"{a['_date']:%b %-d} and {b['_date']:%b %-d}"
                add(f"dup:{a['id']}:{b['id']}", alert_type="duplicate", severity="medium",
                    title=f"Possible double charge: {m.title()} {money(amt)}",
                    detail=f"Charged {money(amt)} twice on {when}. If one was a mistake, dispute it with the card issuer.",
                    merchant=m, amount=amt, txn_date=str(b["_date"]), transaction_ids=[a["id"], b["id"]])

    # subscriptions: new merchant or changed price
    subs = [t for t in txns if t.get("category") == "Subscriptions" and float(t["amount"]) < 0]
    for t in subs:
        if t["_date"] < since:
            continue
        prior = [p for p in subs if p["_date"] < t["_date"] and (t["_date"] - p["_date"]).days <= HISTORY_DAYS]
        same_merchant = [p for p in prior if p["_m"] == t["_m"]]
        same_amount = [p for p in prior if abs(spend(p) - spend(t)) <= max(0.01 * spend(t), 0.02)]
        if not same_merchant and not same_amount:
            add(f"subnew:{t['id']}", alert_type="subscription_new", severity="medium",
                title=f"New subscription: {t['_m'].title()} {money(t['amount'])}",
                detail=f"First charge from {t['description']} on {t['_date']:%b %-d}. If you didn't sign up, cancel it.",
                merchant=t["_m"], amount=spend(t), txn_date=str(t["_date"]), transaction_ids=[t["id"]])
        elif same_merchant:
            last = same_merchant[-1]
            diff = spend(t) - spend(last)
            if abs(diff) >= 1.00 and abs(diff) / max(spend(last), 0.01) >= 0.05:
                verb = "went up" if diff > 0 else "went down"
                add(f"subchg:{t['id']}", alert_type="subscription_change", severity="medium" if diff > 0 else "low",
                    title=f"{t['_m'].title()} {verb} to {money(t['amount'])}",
                    detail=f"Was {money(last['amount'])} on {last['_date']:%b %-d}, now {money(t['amount'])} on {t['_date']:%b %-d}.",
                    merchant=t["_m"], amount=spend(t), txn_date=str(t["_date"]), transaction_ids=[last["id"], t["id"]])

    # fixed cost increases vs the median of the previous six charges
    fixed = defaultdict(list)
    for t in txns:
        if t.get("category") in FIXED_CATEGORIES and float(t["amount"]) < 0:
            fixed[FIXED_ALIASES.get(t["category"], t["category"])].append(t)
    for cat, rows in fixed.items():
        pct, floor = FIXED_THRESHOLDS.get(cat, FIXED_DEFAULT_THRESHOLD)
        for i, t in enumerate(rows):
            if t["_date"] < since:
                continue
            prev = [spend(p) for p in rows[max(0, i - 6):i]]
            if len(prev) < 2:
                continue
            base = median(prev)
            diff = spend(t) - base
            if diff >= floor and diff / base >= pct:
                add(f"fixed:{t['id']}", alert_type="fixed_increase", severity="high" if diff / base >= 0.5 else "medium",
                    title=f"{cat} up {diff / base:.0%}: {money(t['amount'])}",
                    detail=f"Usually about {money(base)} (median of last {len(prev)}). {t['description']} on {t['_date']:%b %-d} was {money(diff)} more.",
                    merchant=cat.upper(), amount=spend(t), txn_date=str(t["_date"]), transaction_ids=[t["id"]])

    order = {"high": 0, "medium": 1, "low": 2}
    # most important first, newest first within a severity
    return sorted(out.values(), key=lambda a: (order[a["severity"]], -d(a["txn_date"]).toordinal()))


# ---------------------------------------------------------------- delivery

def send_push(alerts):
    topic = os.environ.get("NTFY_TOPIC", "").strip()
    if not topic:
        print("push: NTFY_TOPIC not set, skipping")
        return
    server = os.environ.get("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
    pushable = [a for a in alerts if a["severity"] in ("high", "medium")]
    if not pushable:
        return
    if len(pushable) > 4:
        msgs = [(f"Luna: {len(pushable)} new money alerts",
                 "\n".join(f"• {a['title']}" for a in pushable[:10]),
                 "high" if any(a["severity"] == "high" for a in pushable) else "default")]
    else:
        msgs = [(a["title"], a["detail"], "high" if a["severity"] == "high" else "default") for a in pushable]
    for title, body, prio in msgs:
        req = urllib.request.Request(
            f"{server}/{topic}", data=body.encode("utf-8"), method="POST",
            headers={"Title": title.encode("ascii", "ignore").decode(), "Priority": prio,
                     "Tags": "moneybag", "Click": LUNA_URL})
        with urllib.request.urlopen(req, timeout=20) as r:
            r.read()
    print(f"push: sent {len(msgs)}")


def send_email(alerts):
    user = os.environ.get("GMAIL_USER", "").strip()
    pw = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()
    if not user or not pw:
        print("email: GMAIL_USER / GMAIL_APP_PASSWORD not set, skipping")
        return
    to = os.environ.get("ALERT_EMAIL_TO", "").strip() or user
    high = sum(a["severity"] == "high" for a in alerts)
    msg = EmailMessage()
    msg["Subject"] = f"Luna: {len(alerts)} new money alert{'s' if len(alerts) != 1 else ''}" + (f" ({high} important)" if high else "")
    msg["From"] = user
    msg["To"] = to
    lines = []
    for a in alerts:
        lines.append(f"[{a['severity'].upper()}] {a['title']}\n  {a['detail']}\n")
    lines.append(f"Review and dismiss in Luna: {LUNA_URL}")
    msg.set_content("\n".join(lines))
    rows = "".join(
        f"<tr><td style='padding:6px 10px;color:{ {'high': '#dc2626', 'medium': '#d97706', 'low': '#6b7280'}[a['severity']] };font-weight:600'>{a['severity'].upper()}</td>"
        f"<td style='padding:6px 10px'><b>{a['title']}</b><br><span style='color:#555'>{a['detail']}</span></td></tr>"
        for a in alerts)
    msg.add_alternative(
        f"<table style='font-family:sans-serif;font-size:14px;border-collapse:collapse'>{rows}</table>"
        f"<p style='font-family:sans-serif'><a href='{LUNA_URL}'>Review and dismiss in Luna</a></p>", subtype="html")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context()) as s:
        s.login(user, pw)
        s.send_message(msg)
    print(f"email: sent to {to}")


# ---------------------------------------------------------------- main

def load_from_supabase():
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]
    sb = create_client(url, key)
    start = (date.today() - timedelta(days=HISTORY_DAYS)).isoformat()
    rows, offset = [], 0
    while True:
        r = (sb.table("expense_transactions")
               .select("id, transaction_date, description, amount, category, source")
               .gte("transaction_date", start).order("id").range(offset, offset + 999).execute())
        rows += r.data or []
        if len(r.data or []) < 1000:
            break
        offset += 1000
    mutes = sb.table("finance_alert_mutes").select("alert_type, merchant").execute().data or []
    return sb, rows, frozenset((m["alert_type"], m["merchant"]) for m in mutes)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--fixture")
    ap.add_argument("--today")
    args = ap.parse_args()
    today = d(args.today) if args.today else date.today()

    if args.fixture:
        sb, mutes = None, frozenset()
        with open(args.fixture) as f:
            raw = json.load(f)
        rows = [dict(zip(["id", "transaction_date", "description", "amount", "category", "source"], r)) if isinstance(r, list) else r for r in raw]
    else:
        sb, rows, mutes = load_from_supabase()

    alerts = find_alerts(rows, today=today, mutes=mutes)
    print(f"scanned {len(rows)} transactions, {len(alerts)} findings in the last {LOOKBACK_DAYS} days")

    if args.dry_run or sb is None:
        for a in alerts:
            print(f"  [{a['severity']:<6}] {a['alert_type']:<19} {a['title']}  |  {a['detail']}")
        return

    existing = set()
    keys = [a["alert_key"] for a in alerts]
    for i in range(0, len(keys), 200):
        r = sb.table("finance_alerts").select("alert_key").in_("alert_key", keys[i:i + 200]).execute()
        existing |= {x["alert_key"] for x in r.data or []}
    new = [a for a in alerts if a["alert_key"] not in existing]
    print(f"{len(new)} new alerts")
    if not new:
        return
    sb.table("finance_alerts").insert(new).execute()

    failures = []
    for fn in (send_push, send_email):
        try:
            fn(new)
        except Exception as e:     # one channel failing shouldn't block the other
            failures.append(f"{fn.__name__}: {e}")
            print(f"{fn.__name__} failed: {e}", file=sys.stderr)
    if len(failures) < 2:
        sb.table("finance_alerts").update({"notified_at": datetime.now(timezone.utc).isoformat()}) \
          .in_("alert_key", [a["alert_key"] for a in new]).execute()
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
