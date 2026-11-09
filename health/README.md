# health

Scripts that collect health data. Each writes only to its own tables.

| Pipeline | Script | What it does | When | Writes to |
|----------|--------|--------------|------|-----------|
| **WHOOP** | `whoop/sync.py` | Pulls recovery, sleep, strain and workouts. WHOOP hands out a new login token on every run; it's kept in the database (`app_config`). | 5 times a day, Whoop Sync workflow | `whoop_recovery`, `whoop_cycles`, `whoop_sleep`, `whoop_workouts`, `whoop_body` |
| **WHOOP connect** | `whoop/connect.py` | One time connection (two runs: get link, then finish with the code). | By hand, Connect WHOOP workflow | `app_config` |
| **Scale** | `body/renpho_pull.py` | Pulls Renpho smart scale readings. | Every morning, Pull Body Composition workflow | `body_composition` |

Secrets: WHOOP needs `WHOOP_CLIENT_ID` and `WHOOP_CLIENT_SECRET`; Renpho needs `RENPHO_EMAIL` and `RENPHO_PASSWORD`. Both also use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

**If WHOOP stops syncing** (Whoop Sync fails saying WHOOP refused the token): run Connect WHOOP again, twice, same as the first time.
