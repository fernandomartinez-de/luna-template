# Set up Luna

Everything happens in your web browser. You don't need to write code or use the Terminal.

**Time:** about 1 hour for the app, then 15 to 20 minutes for each extra (bank, stocks, WHOOP, scale).
**You need:** a Mac, your phone, and accounts on GitHub and Supabase (free).

Throughout this guide, replace:

| Placeholder | With |
|---|---|
| `USERNAME` | your GitHub username, **in lowercase** |
| `you@example.com` | the email you'll sign in to Luna with |

Your app's address will be `https://USERNAME.github.io/luna/`.

```mermaid
flowchart LR
    A[1. Your copy<br/>on GitHub] --> B[2. Database<br/>on Supabase] --> C[3. Sign in<br/>settings] --> D[4. Secrets] --> E[5. Publish] --> F[6. On your phone]
    F --> G[Bank]
    F --> H[Stocks]
    F --> I[WHOOP]
    F --> J[Renpho]
```

> **Words you'll see.** A **repo** is a project folder on GitHub. A **workflow** is a small job GitHub runs for you, on a timer or when you click **Run workflow**. A **secret** is a password you hand to GitHub so the workflows can use it; once saved, nobody can read it back, not even you.

---

## Part 1: Get your own copy

1. Sign in to GitHub and open [github.com/fernandomartinez-de/luna-template](https://github.com/fernandomartinez-de/luna-template).
2. Click the green **Use this template** → **Create a new repository**.
3. **Owner:** you. **Repository name:** `luna`. Choose **Public**. Click **Create repository**.

Public is fine: the code has no passwords or personal data in it. Your data lives in your private database.

## Part 2: Create the database

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   * **Name:** `luna`
   * **Database password:** click **Generate a password**, then save it in your Passwords app (you'll rarely need it).
   * **Region:** a European one, such as **West EU (Paris)** or **Central EU (Frankfurt)**.
   * Click **Create new project** and wait about 2 minutes.
2. In your GitHub repo, open the `supabase` folder → `schema.sql` → click the **Copy raw file** button (two squares icon, top right of the file).
3. In Supabase, click **SQL Editor** (left sidebar, the `>_` icon) → **New query**. Click inside the big empty box and press **⌘V** to paste.
4. Near the top, change the two lines marked `EDIT`:
   * `you@example.com` → your email (keep the quote marks around it)
   * `1234` → the 4 digit code you want Luna to ask for when it opens
5. Click **Run** (bottom right), or press **⌘↩**. If Supabase warns about "destructive operations", click **Run this query**. That warning is normal; this file is safe to run.
6. You should see **Success. No rows returned**.

```mermaid
flowchart LR
    A[GitHub: schema.sql] -- Copy raw file --> B[Supabase SQL Editor]
    B -- edit 2 lines --> C[Run]
    C --> D[Success]
```

7. Get three values you'll need in Part 4. Click **Project Settings** (gear icon, bottom left):
   * **Data API** → copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
   * **API Keys** → copy the **Publishable key** (starts with `sb_publishable_`)
   * **API Keys** → under **Secret keys**, click the eye icon and copy the **secret** key (starts with `sb_secret_`). Treat this one like a password.

   Paste all three into a note for now.

## Part 3: Sign in settings

In Supabase, open **Authentication** (left sidebar, the people icon):

1. **URL Configuration**
   * **Site URL:** `https://USERNAME.github.io/luna/` → **Save**
   * **Redirect URLs** → **Add URL** → `https://USERNAME.github.io/luna/**` → **Save**
2. **Sign In / Providers** → **Email**: make sure it's on, and set **Email OTP Length** to `6` → **Save**.
3. **Emails** → **Templates** → **Magic Link**. In the message body, add this line on its own, then **Save**:
   ```
   Your code: {{ .Token }}
   ```

Leave **Allow new users to sign up** on for now. You'll turn it off in Part 6.

## Part 4: Give GitHub the keys

In your GitHub repo: **Settings** (top tab) → **Secrets and variables** (left menu) → **Actions** → **New repository secret**. Add these three, one at a time (Name exactly as written, Secret is the value):

| Name | Secret |
|------|--------|
| `SUPABASE_URL` | the Project URL |
| `SUPABASE_KEY` | the Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the secret key |

## Part 5: Publish the app

1. Repo **Settings** → **Pages** (left menu) → under **Build and deployment**, set **Source** to **GitHub Actions**.
2. Click the **Actions** tab. If you see a green button saying "I understand my workflows, go ahead and enable them", click it.
3. In the left list, click **Deploy Luna** → **Run workflow** (right side) → green **Run workflow**.
4. Wait for the yellow dot to turn into a green check (about 2 minutes). Refresh the page if it doesn't change.

```mermaid
flowchart LR
    A[Actions tab] --> B[Deploy Luna] --> C[Run workflow] --> D((yellow:<br/>running)) --> E((green:<br/>done))
```

Your app is now live at `https://USERNAME.github.io/luna/`.

## Part 6: Sign in and put it on your phone

1. On your iPhone, open Safari and go to `https://USERNAME.github.io/luna/`.
2. Type your email → you get an email with a 6 digit code → type it in.
3. Type your 4 digit code from Part 2.
4. Tap **Share** (square with an arrow) → **Add to Home Screen** → **Add**.
5. Open Luna from the home screen icon and sign in once more (the home screen app keeps its own sign in).
6. Back in Supabase: **Authentication** → **Sign In / Providers** → turn **off** **Allow new users to sign up** → **Save**. Now nobody else can make an account.

The app works. Pages stay empty until you connect your data below.

## Part 7: Put your name in

1. In your GitHub repo, open `app` → `src` → `config.js` → click the pencil icon (**Edit this file**).
2. Put your first name between the quotes: `export const OWNER_NAME = 'Diego'`
3. Click **Commit changes...** → **Commit changes**.

That's how every change works: edit, commit, and Deploy Luna republishes the app by itself in about 2 minutes. The same file sets euros and kg; they're already right for you.

---

## Bank (Banco Sabadell)

Luna reads your transactions through **Enable Banking**, a free service that uses the official EU open banking rules. It's read only: it can see transactions, never move money.

```mermaid
sequenceDiagram
    participant You
    participant GH as GitHub (Connect Bank)
    participant EB as Enable Banking
    participant Bank as Sabadell
    participant Luna
    You->>GH: Run 1 (code box empty)
    GH-->>You: a link
    You->>EB: open the link, accept
    EB->>Bank: you sign in and approve
    Bank-->>Luna: back to Luna's code page
    Luna-->>You: a code to copy
    You->>GH: Run 2 (paste the code)
    GH-->>You: ✅ Bank connected
```

**B1. Sign up.** Go to [enablebanking.com](https://enablebanking.com) → **Get started**, register, and confirm your email. You'll end up in the **Control Panel**.

**B2. Create your app.** Control Panel → **API applications** → **Add a new application**:
* **Environment:** **Production**
* **Key generation:** leave the default (generate in the browser)
* **Application name:** `Luna`; **Description:** `Personal dashboard`
* **Allowed redirect URLs:** `https://USERNAME.github.io/luna/callback.html`
* **Email for data protection matters:** your email
* **Privacy Policy URL** and **Terms of Service URL:** `https://USERNAME.github.io/luna/` for both
* Click **Register**. Your Mac downloads a file ending in `.pem` into **Downloads**. That's your app's private key; keep it.

**B3. Activate it with your bank.** Still in **API applications**, find Luna and click **Link accounts** → choose **Spain** → **Banco de Sabadell** → sign in and approve (Sabadell may ask you to confirm in its app). The app then shows **Restricted** and **Active**. That's correct: restricted means it can only see your own accounts.

**B4. Add two secrets** (repo **Settings** → **Secrets and variables** → **Actions** → **New repository secret**):

| Name | Secret |
|------|--------|
| `ENABLE_BANKING_APP_ID` | the **Application ID** shown for Luna in the Control Panel |
| `ENABLE_BANKING_KEY` | the whole `.pem` file. In Finder, right click it → **Open With** → **TextEdit**, then **⌘A**, **⌘C**, and paste. It must start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----`. |

**B5. Connect.** **Actions** → **Connect Bank** → **Run workflow**, leave **code** empty → **Run workflow**. When it's green, click the run's name: the summary page shows **Click here to connect Banco de Sabadell**. Click it, accept, sign in to Sabadell and approve. You land on a Luna page with a code and a **Copy code** button. Copy it, go back to **Connect Bank** → **Run workflow**, paste the code into the **code** box → **Run workflow**. Within a few minutes, before the code expires.

**B6. First pull.** **Actions** → **Pull Bank Transactions** → **Run workflow**. Open **Luna → Finances**. From now on it runs by itself every morning.

**Every few months:** banks only allow access for up to 180 days at a time. Two weeks before it runs out, Luna shows a red alert on the Finances page. Just repeat B5.

**Categories:** common Spanish shops and bills (Mercadona, Iberdrola, Movistar, Bizum, Nómina...) are sorted automatically. To fix one, tap it in **Finances → Expenses**, choose a category, and tick **Remember this** so future ones match too.

---

## Stocks

You list what you own once; Luna prices it every weekday evening from Yahoo Finance.

**S1. Find each symbol.** Search the stock or fund on [finance.yahoo.com](https://finance.yahoo.com) and use the symbol it shows, including any ending: US stocks have none (`AAPL`), Madrid ends in `.MC` (`SAN.MC`), Germany `.DE` (`VWCE.DE`), Amsterdam `.AS`, Milan `.MI`, Paris `.PA`, London `.L`.

**S2. Enter them.** Supabase → **Table Editor** (left sidebar, the grid icon) → **holdings** → **Insert** → **Insert row**:
* **ticker:** the symbol
* **shares:** how many you own (decimals are fine)
* **total_cost:** what you paid in total, in euros (optional; used for gain or loss)

Click **Save**, and repeat for each one. When you buy or sell, just edit the row.

**S3. First update.** **Actions** → **Update Stock Prices** → **Run workflow**. The summary page shows a table of your stocks and the total. Then check **Luna → Finances → Investments**.

---

## WHOOP

```mermaid
flowchart LR
    A[WHOOP developer<br/>dashboard: make app] --> B[2 secrets<br/>on GitHub] --> C[Connect WHOOP<br/>run 1: link] --> D[approve in WHOOP] --> E[Connect WHOOP<br/>run 2: code] --> F[Whoop Sync]
```

**W1. Make a WHOOP app.** Go to [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com) and sign in with your WHOOP account. Create a team if asked (any name), then **Create App**:
* **Name:** `Luna`
* **Scopes:** tick all the `read:` ones (recovery, cycles, sleep, workout, profile, body measurement)
* **Redirect URL:** `https://USERNAME.github.io/luna/callback.html`
* **Privacy policy:** `https://USERNAME.github.io/luna/`
* Save, then note the **Client ID** and **Client Secret**.

**W2. Add two secrets:** `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`.

**W3. Connect.** Same two runs as the bank: **Actions** → **Connect WHOOP** → **Run workflow** with **code** empty → open the link on the summary page → **Grant** → copy the code → **Connect WHOOP** again with the code pasted.

**W4. First sync.** **Actions** → **Whoop Sync** → **Run workflow**. After that it runs 5 times a day.

---

## Renpho scale

**R1.** Renpho needs an email and password. If you signed up to the Renpho app with Apple or Google, first set a password in the Renpho app (**Me** → **Account**) or with "Forgot password" on its sign in screen.

**R2. Add two secrets:** `RENPHO_EMAIL` and `RENPHO_PASSWORD`.

**R3.** **Actions** → **Pull Body Composition (Renpho)** → **Run workflow**. After that it runs every morning.

---

## Money alerts on your phone (optional)

Luna always shows alerts (double charges, new subscriptions, bank fees) on the Finances page. To also get a push notification: install the free **ntfy** app, subscribe to a long random topic name only you know (for example `luna-diego-8f3k2q`), and add it as the secret `NTFY_TOPIC`.

---

## Checklist

- [ ] Your own `luna` repo (Public)
- [ ] `schema.sql` run with your email and code
- [ ] Sign in settings: URLs, OTP length 6, code in the Magic Link email
- [ ] 3 Supabase secrets in GitHub
- [ ] Pages source set to GitHub Actions, Deploy Luna green
- [ ] Signed in on your phone, added to home screen, sign ups turned off
- [ ] Bank connected, first pull done
- [ ] Stocks entered, first update done
- [ ] WHOOP connected, first sync done
- [ ] Renpho secrets added, first pull done

Something not working? See [operations.md](operations.md#troubleshooting).
