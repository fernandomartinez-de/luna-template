# Operations

How Luna runs day to day, common tasks, and what to do when something breaks. For first time setup, see [setup.md](setup.md).

---

## Where everything lives

| What | Where |
|------|-------|
| The app | `https://USERNAME.github.io/luna/` |
| The automatic jobs and their logs | Your repo → **Actions** tab |
| Database, sign in settings | [supabase.com/dashboard](https://supabase.com/dashboard) → your project |
| Your stocks | Supabase → **Table Editor** → `holdings` |
| Bank connection app | [enablebanking.com](https://enablebanking.com) → Control Panel |
| WHOOP app | [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com) |
| Secrets | Your repo → **Settings** → **Secrets and variables** → **Actions** |
| Personal settings (name, currency, kg) | `app/src/config.js` |

---

## Schedule

Every workflow can also be started by hand: **Actions** tab → pick it → **Run workflow**. Every one is safe to rerun; nothing gets duplicated. Times are Spain time in winter (an hour later in summer).

| Workflow | Runs | Does |
|----------|------|------|
| Pull Bank Transactions | Every day, ~7:00 | New bank transactions, then money alerts |
| Pull Body Composition (Renpho) | Every day, ~10:00 | New scale readings |
| Whoop Sync | ~7:00, 11:00, 15:00, 19:00, 22:00 | Recovery, sleep, strain, workouts |
| Update Stock Prices | Weekdays, ~22:30 | Values your stocks |
| Deploy Luna | Whenever something in `app/` changes | Republishes the app |
| Connect Bank | Only by hand | Connects or reconnects the bank |
| Connect WHOOP | Only by hand | Connects or reconnects WHOOP |

A workflow for something you haven't set up yet just says "isn't set up yet" and stops. That's fine.

---

## Secrets

| Secret | Used by |
|--------|---------|
| `SUPABASE_URL` | Everything |
| `SUPABASE_KEY` | The app (the publishable key; it can't read anything without your sign in) |
| `SUPABASE_SERVICE_ROLE_KEY` | Every sync. The secret key: **never put it in the app or share it.** |
| `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_KEY` | Connect Bank, Pull Bank Transactions |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` | Connect WHOOP, Whoop Sync |
| `RENPHO_EMAIL`, `RENPHO_PASSWORD` | Pull Body Composition |
| `NTFY_TOPIC` (optional) | Money alerts as phone notifications |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL_TO` (optional) | Money alerts by email |

To change a secret: click it → **Update**. GitHub never shows the old value; you just type the new one.

---

## Common tasks

**Reconnect the bank (every few months).** When Luna shows "Reconnect your bank", run **Connect Bank** twice, exactly like the first time (empty code box, open link, approve, copy code, run again with the code).

**Add, change or sell a stock.** Supabase → **Table Editor** → `holdings`. Edit the row, add one with **Insert → Insert row**, or delete it (right click the row → **Delete row**). Changes show after the next Update Stock Prices run, or run it by hand.

**Fix a transaction's category.** In Luna: Finances → Expenses → open a month → tap the transaction → choose a category. Tick **Remember this** so future transactions with the same text get it too. A category you set yourself is never overwritten.

**Change the unlock code.** Supabase → **SQL Editor** → New query, paste this with your new code, and **Run**:

```sql
update app_config set value = encode(extensions.digest('luna-pin:' || '5678', 'sha256'), 'hex') where key = 'app_pin_sha256';
```

**Sign in on a new device.** Open the app, type your email, then the emailed code. Each device signs in once.

**Change the app.** Edit any file under `app/` on GitHub (pencil icon → **Commit changes**). Deploy Luna republishes it in about 2 minutes.

---

## Troubleshooting

Open the failed run (**Actions** → the red ✗ → click the job) and read the last lines. Most messages say exactly what to do.

| What you see | Likely cause | Fix |
|--------------|--------------|-----|
| A page in the app is empty | Not set up yet, or not signed in | Check that source is connected; close and reopen the app |
| Sign in email never arrives | Supabase only sends a few emails per hour | Wait 15 minutes; check spam |
| Code box won't accept the code | Code length setting | Supabase → Authentication → Sign In / Providers → Email → Email OTP Length `6` |
| Connect Bank: "Redirect address not allowed" | The redirect URL in Enable Banking doesn't match | Make it exactly `https://USERNAME.github.io/luna/callback.html` |
| Connect Bank: "No accounts came back" | The app wasn't activated with your bank | Enable Banking Control Panel → your app → **Link accounts** |
| Connect Bank or WHOOP: "That code didn't work" | The code expired or was used | Start again from the run with the empty code box, and paste within a few minutes |
| Pull Bank Transactions: "refused" or "expired" | The bank connection ran out | Reconnect the bank (above) |
| Whoop Sync: "WHOOP refused the saved token" | WHOOP disconnected | Run Connect WHOOP again, twice |
| Update Stock Prices: a stock "Skipped" | Wrong symbol | Check it on finance.yahoo.com, fix it in `holdings` |
| Renpho fails to sign in | Wrong password, or the account uses Apple/Google sign in | Set a Renpho password and update `RENPHO_PASSWORD` |
| Scheduled jobs stopped | GitHub pauses timers after 60 days without changes | Actions → each workflow → **Enable workflow**, or commit any small change |
| App shows an old version | The phone cached it | Close the app fully and reopen it |
