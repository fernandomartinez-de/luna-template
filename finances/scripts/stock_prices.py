"""Value your stocks every weekday, used by the Update Stock Prices workflow.

Reads what you own from the holdings table (edit it in Supabase > Table Editor),
looks up today's prices on Yahoo Finance (no account or key needed), converts
them to your currency, and saves a snapshot to stocks_crypto_history, which the
Investments tab shows. Safe to rerun; a rerun on the same day replaces that
day's snapshot.
"""
import os
from datetime import date

import yfinance as yf
from supabase import create_client

CURRENCY = (os.environ.get("CURRENCY") or "EUR").strip().upper()
SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")


def say(text=""):
    print(text)
    if SUMMARY:
        with open(SUMMARY, "a") as f:
            f.write(text + "\n")


def last_price(symbol):
    hist = yf.Ticker(symbol).history(period="7d")
    return float(hist["Close"].dropna().iloc[-1]) if not hist.empty else None


_fx = {}


def to_home(amount, cur):
    if cur == "GBp":  # London prices are in pence
        amount, cur = amount / 100, "GBP"
    cur = (cur or CURRENCY).upper()
    if cur == CURRENCY:
        return amount
    if cur not in _fx:
        _fx[cur] = last_price(f"{cur}{CURRENCY}=X")
    if not _fx[cur]:
        raise ValueError(f"no exchange rate for {cur} to {CURRENCY}")
    return amount * _fx[cur]


sb = create_client(os.environ["SUPABASE_URL"].strip(), os.environ["SUPABASE_SERVICE_ROLE_KEY"].strip())
holdings = sb.table("holdings").select("*").execute().data
if not holdings:
    say("No stocks in the **holdings** table yet. Add them in Supabase > Table Editor > holdings (guide, part S).")
    raise SystemExit(0)

today = date.today().isoformat()
rows, problems, total = [], [], 0.0
say(f"| Stock | Shares | Price ({CURRENCY}) | Value ({CURRENCY}) |\n|---|---|---|---|")
for h in holdings:
    sym = (h.get("ticker") or "").strip().upper()
    shares = float(h.get("shares") or 0)
    try:
        t = yf.Ticker(sym)
        price = last_price(sym)
        if price is None:
            raise ValueError("Yahoo Finance has no price for this symbol")
        try:
            cur = t.fast_info["currency"]
        except Exception:
            cur = (t.info or {}).get("currency")
        cur = cur or CURRENCY
        price_home = to_home(price, cur)
    except Exception as e:
        problems.append(f"* **{sym}**: {e}. Check the symbol on finance.yahoo.com.")
        continue
    value = price_home * shares
    cost = float(h.get("total_cost") or 0)
    total += value
    rows.append({"snapshot_date": today, "asset_type": "Stock", "asset_name": sym[:50], "quantity": shares,
                 "price_per_unit": round(price_home, 2), "total_value": round(value, 2),
                 "cost_basis": round(cost, 2), "unrealized_gain_loss": round(value - cost, 2) if cost else None})
    say(f"| {sym} | {shares:g} | {price_home:,.2f} | {value:,.2f} |")

if rows:
    sb.table("stocks_crypto_history").upsert(rows, on_conflict="snapshot_date,asset_name").execute()
say(f"\n**Total: {total:,.2f} {CURRENCY}**")
if problems:
    say("\n### ⚠️ Skipped\n" + "\n".join(problems))
