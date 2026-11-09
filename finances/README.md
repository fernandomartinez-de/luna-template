# finances

Scripts that collect money data. They feed the **Finances** pages in Luna.

| Script | What it does | When | Writes to |
|--------|--------------|------|-----------|
| `scripts/bank_connect.py` | Connects the bank through Enable Banking (two runs: get link, then finish with the code). | By hand, Connect Bank workflow | `app_config` (`bank_session`) |
| `scripts/bank_sync.py` | Pulls new booked transactions for every connected account. Warns two weeks before the bank connection expires. | Every morning, Pull Bank Transactions workflow | `expense_transactions`, `finance_alerts` |
| `scripts/finance_alerts.py` | Looks for double charges, new or changed subscriptions, bank fees, interest and returned payments. | Right after the bank sync | `finance_alerts` |
| `scripts/stock_prices.py` | Values the stocks in `holdings` with Yahoo Finance prices, converted to euros. | Weekday evenings, Update Stock Prices workflow | `stocks_crypto_history` |
| `scripts/enablebanking.py` | Shared helpers for the two bank scripts. | | |

All of them are safe to rerun; they never create duplicates.

**Bank:** set the repository variables `BANK_NAME` / `BANK_COUNTRY` (Settings → Secrets and variables → Actions → Variables) only if you use a bank other than Banco de Sabadell in Spain. If the name doesn't match, Connect Bank lists the exact names it knows.

**Currency:** stocks are converted to euros. For another currency, add a repository variable `CURRENCY` (for example `USD`) and change `CURRENCY` in `app/src/config.js` to match.
