# Luna app

The phone app. React 18 + Vite, hosted on GitHub Pages, reading from Supabase.

**Live:** `https://<your-github-username>.github.io/<repo-name>/`

## Pages

| Page | Path | Shows |
|------|------|-------|
| Hub | `/` | Today at a glance: recovery, strain, stocks |
| Fitness | `/fitness` | Training volume, consistency, muscle balance, weight trend |
| Exercises | `/exercises`, `/exercise/:id` | Exercise library with muscle diagrams |
| Workouts | `/workouts`, `/workout/:id` | Weekly plan, runs, saved workouts; log a session and link it to a WHOOP workout |
| Programs | `/programs` | Training program (defined in `src/utils/program.js`) |
| Food | `/food` | Meal log and macros |
| Weight | `/weight` | Scale history |
| Finances | `/finances`, `/finances/investments` | Spending by month and category, money alerts, stocks |

## How it's put together

```
app/
├── src/
│   ├── main.jsx         entry point and router
│   ├── App.jsx          routes, navigation, sign in gates
│   ├── supabaseClient.js
│   ├── components/      shared pieces (AppLock, AuthGate, charts, modals...)
│   ├── pages/           one file per page; finances/ holds sub views
│   └── utils/           muscle mapping, program helpers
├── public/              icons and the home screen manifest
├── index.html           page shell
├── vite.config.js       base path comes from VITE_BASE (set by the deploy workflow)
└── package.json
```

The built site isn't committed; the deploy workflow builds and publishes it.

## Sign in

Two screens stand in front of the app:

1. **AppLock** (`components/AppLock.jsx`): a 4 digit quick unlock on every open. The code is stored hashed in `app_config` (set at the top of `supabase/schema.sql`). It's a convenience, not security.
2. **AuthGate** (`components/AuthGate.jsx`): the real sign in. Supabase emails a one time code to the owner's address. Each device signs in once and stays signed in.

The database only answers the owner's signed in account, so the public key inside the app can't read anything by itself. See [docs/tables.md](../docs/tables.md#security).

## Run it locally

```
cd app
npm install
npm run dev          # http://localhost:5173
```

Create `app/.env.local` first (copy `.env.example`):

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

To add `localhost` as a place sign in can return to, add `http://localhost:5173/**` under Supabase → Authentication → URL Configuration → Redirect URLs. Typing the emailed code works without it.

## Deploying

Push changes under `app/` to `main`. The **Deploy Luna** workflow then:

1. builds the app with the secrets `SUPABASE_URL` and `SUPABASE_KEY`,
2. copies `index.html` to `404.html` so links deep inside the app work,
3. publishes the built app to GitHub Pages (about 2 minutes total).

See [docs/setup.md](../docs/setup.md#6-publish-the-app) for the Pages settings.

## Notes

- **Muscle diagrams** use [`react-body-highlighter`](https://github.com/giavinh79/react-body-highlighter). The `exercises.muscle_group` values are mapped to its muscle names in `src/utils/muscleMapping.js`; add new values there if you add new muscle groups.
- **Stock values** on the Investments tab come from the Update Stock Prices workflow, which saves a snapshot every weekday. The tab's refresh button isn't wired to a live price service in this copy.
- **Personal settings** (your name, currency, kg or lb) are in `src/config.js`.
- **Home screen install:** Safari → Share → Add to Home Screen (iPhone), or Chrome menu → Add to Home Screen (Android).
