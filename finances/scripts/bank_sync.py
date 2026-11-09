"""Daily bank sync through Enable Banking, used by the Pull Bank Transactions workflow.

Reads the bank connection saved by Connect Bank, pulls booked transactions for
each account, and upserts them into expense_transactions. Safe to rerun: every
transaction gets a stable id (stored in plaid_transaction_id, the table's
unique column, with an "eb:" prefix), so nothing is ever duplicated.
Categories are filled in by the database from the category_mapping rules.
"""
import hashlib
import os
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from enablebanking import api, db, fail, load_session, say

sb = db()
session = load_session(sb)
if not session:
    say("## The bank isn't connected yet\nRun the **Connect Bank** workflow first.")
    raise SystemExit(1 if os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" else 0)

valid_until = datetime.fromisoformat(session["valid_until"].replace("Z", "+00:00"))
days_left = (valid_until - datetime.now(timezone.utc)).days
if days_left < 0:
    fail("## ❌ The bank connection has expired\nRun **Connect Bank** again (two runs, same as the first time).")
if days_left <= 14:
    key = f"bank_reconnect_{valid_until.date()}"
    exists = sb.table("finance_alerts").select("id").eq("alert_key", key).execute().data
    if not exists:
        sb.table("finance_alerts").insert({
            "alert_key": key, "alert_type": "bank_reconnect", "severity": "high",
            "title": f"Reconnect your bank in {days_left} days",
            "detail": "Banks only allow access for a few months at a time. On GitHub, run Connect Bank "
                      "again (two runs, same as the first time) to keep transactions coming in.",
        }).execute()
    say(f"⚠️ Bank connection ends in {days_left} days. Run **Connect Bank** again soon.")


def describe(t):
    party = (t.get("creditor") if t.get("credit_debit_indicator") == "DBIT" else t.get("debtor")) or {}
    name = (party.get("name") or "").strip()
    info = " ".join(x.strip() for x in (t.get("remittance_information") or []) if x and x.strip())
    text = name or info or (t.get("bank_transaction_code") or {}).get("description") or "(no description)"
    if name and info and info.upper() not in name.upper():
        text = f"{name} · {info}"
    return " ".join(text.split())[:200]


def pull(uid, date_from):
    out, key = [], None
    while True:
        params = {"date_from": date_from, "transaction_status": "BOOK"}
        if key:
            params["continuation_key"] = key
        r = api("GET", f"/accounts/{uid}/transactions", params=params)
        if r.status_code >= 400:
            return None, r
        body = r.json()
        out += body.get("transactions") or []
        key = body.get("continuation_key")
        if not key:
            return out, r


total = 0
for acct in session["accounts"]:
    label = acct["label"]
    last = (sb.table("expense_transactions").select("transaction_date").eq("source", label)
            .order("transaction_date", desc=True).limit(1).execute().data)
    start = (date.fromisoformat(last[0]["transaction_date"]) - timedelta(days=10)) if last else date.today() - timedelta(days=365)

    txns, r = pull(acct["uid"], start.isoformat())
    if txns is None and not last:
        # Many banks only share 90 days of history; try again with that.
        txns, r = pull(acct["uid"], (date.today() - timedelta(days=89)).isoformat())
    if txns is None:
        if r.status_code in (401, 403) or "expired" in r.text.lower() or "session" in r.text.lower():
            fail("## ❌ The bank refused the connection\nRun **Connect Bank** again to reconnect.")
        r.raise_for_status()

    rows, seen = [], Counter()
    for t in txns:
        amt = float((t.get("transaction_amount") or {}).get("amount") or 0)
        amt = -abs(amt) if t.get("credit_debit_indicator") == "DBIT" else abs(amt)
        tdate = t.get("transaction_date") or t.get("booking_date") or t.get("value_date")
        if not tdate:
            continue
        desc = describe(t)
        ref = t.get("transaction_id") or t.get("entry_reference")
        if not ref:
            base = f"{acct['uid']}|{tdate}|{amt:.2f}|{desc}"
            seen[base] += 1  # two identical coffees on one day still get different ids
            ref = hashlib.sha1(f"{base}|{seen[base]}".encode()).hexdigest()[:24]
        rows.append({
            "transaction_date": tdate[:10],
            "post_date": (t.get("booking_date") or tdate)[:10],
            "description": desc,
            "amount": round(amt, 2),
            "source": label,
            "month": tdate[:7],
            "plaid_transaction_id": f"eb:{acct['uid'][:8]}:{ref}",
        })

    for i in range(0, len(rows), 500):
        sb.table("expense_transactions").upsert(rows[i:i + 500], on_conflict="plaid_transaction_id",
                                                ignore_duplicates=True).execute()
    total += len(rows)
    say(f"✅ {label}: {len(rows)} transactions checked since {start}")

say(f"\nDone. Connection valid for {days_left} more days.")
