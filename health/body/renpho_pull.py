"""Pull Renpho weigh-in history and upsert into public.body_composition.

One row per weigh-in, keyed on measured_at. Idempotent: re-runs never duplicate.
The complete original record is preserved in the raw jsonb column, so column
mappings below can be revised later without losing information.

Writes go through the Supabase REST client (SUPABASE_URL + SUPABASE_KEY) rather
than direct Postgres, because the direct db host is IPv6-only and GitHub
Actions runners are IPv4-only. This matches how health/whoop/sync.py works.
"""

import os
import sys
from datetime import datetime, timezone

from supabase import create_client, Client

try:
    from renpho import RenphoClient as _BaseRenphoClient, RenphoAPIError
    from renpho.constants import APP_VERSION, PLATFORM
except ImportError as e:
    print(f"ERROR: renpho-api not installed: {e}", file=sys.stderr)
    sys.exit(1)


class RenphoClient(_BaseRenphoClient):
    """renpho-api 0.2.0 with Renpho's October 2026 login change handled.

    Renpho's gateway now rejects the login request (code -114) unless it carries
    the appVersion and platform headers; the library only sends them after login.
    This adds them to every request. Remove once renpho-api ships the fix
    (danvaneijck/renpho-api pull request 13). Note: APP_VERSION must stay below
    8.0.0, which Renpho also rejects.
    """

    def _post(self, endpoint, body, *, auth=True, extra_headers=None):
        headers = {"appVersion": APP_VERSION, "platform": PLATFORM}
        if extra_headers:
            headers.update(extra_headers)
        return super()._post(endpoint, body, auth=auth, extra_headers=headers)


REQUIRED_ENV = ("RENPHO_EMAIL", "RENPHO_PASSWORD", "SUPABASE_URL", "SUPABASE_KEY")

# Renpho field semantics: `muscle`, `sinew`, `water`, `protein` are percentages.
# `bone` is mass in kg. `muscle_mass_kg` is derived from muscle % * weight.
# The raw column preserves the original record so any remapping can be done in
# SQL against public.body_composition.raw afterwards.
FIELD_CANDIDATES = {
    "weight_kg":           ("weight",),
    "bmi":                 ("bmi",),
    "body_fat_pct":        ("bodyfat", "body_fat", "body_fat_percentage"),
    "muscle_pct":          ("muscle",),
    "skeletal_muscle_pct": ("sinew", "skeletal_muscle_pct"),
    "water_pct":           ("water", "water_percentage"),
    "protein_pct":         ("protein",),
    "visceral_fat":        ("visfat", "visceral_fat"),
    "bone_mass_kg":        ("bone", "bone_mass_kg"),
    "bmr_kcal":             ("bmr",),
    "metabolic_age":       ("bodyage", "metabolic_age", "body_age"),
}

TIMESTAMP_CANDIDATES = ("time_stamp", "timeStamp", "timestamp", "created_at", "measured_at")


def require_env():
    missing = [k for k in REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        print(f"ERROR: missing required env vars: {', '.join(missing)}", file=sys.stderr)
        sys.exit(2)
    return {k: os.environ[k] for k in REQUIRED_ENV}


def pick(rec, keys):
    for k in keys:
        if k in rec and rec[k] not in (None, ""):
            return rec[k]
    return None


def to_float(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def to_int(v):
    if v is None:
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def parse_measured_at(rec):
    val = pick(rec, TIMESTAMP_CANDIDATES)
    if val is None:
        return None
    if isinstance(val, (int, float)) or (isinstance(val, str) and val.isdigit()):
        ts = int(val)
        if ts > 10_000_000_000:
            ts //= 1000
        return datetime.fromtimestamp(ts, tz=timezone.utc)
    if isinstance(val, str):
        s = val.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            return None
    return None


def normalize_weight_kg(rec):
    raw_weight = to_float(pick(rec, FIELD_CANDIDATES["weight_kg"]))
    if raw_weight is None:
        return None
    unit = rec.get("weight_unit")
    if unit == 1:
        return round(raw_weight * 0.45359237, 3)
    if unit == 2:
        return round(raw_weight * 6.35029318, 3)
    return raw_weight


def map_row(rec):
    measured_at = parse_measured_at(rec)
    if measured_at is None:
        return None
    weight_kg   = normalize_weight_kg(rec)
    body_fat    = to_float(pick(rec, FIELD_CANDIDATES["body_fat_pct"]))
    muscle_pct  = to_float(pick(rec, FIELD_CANDIDATES["muscle_pct"]))
    sinew_pct   = to_float(pick(rec, FIELD_CANDIDATES["skeletal_muscle_pct"]))
    water_pct   = to_float(pick(rec, FIELD_CANDIDATES["water_pct"]))
    protein_pct = to_float(pick(rec, FIELD_CANDIDATES["protein_pct"]))
    visfat      = to_float(pick(rec, FIELD_CANDIDATES["visceral_fat"]))
    bone_kg     = to_float(pick(rec, FIELD_CANDIDATES["bone_mass_kg"]))
    bmr         = to_int(pick(rec, FIELD_CANDIDATES["bmr_kcal"]))
    body_age    = to_int(pick(rec, FIELD_CANDIDATES["metabolic_age"]))
    bmi         = to_float(pick(rec, FIELD_CANDIDATES["bmi"]))

    # Weight-only weigh-ins (no bioimpedance) report body fat as 0. Preserve
    # the weight timepoint for the trend but null every composition field so
    # they do not skew averages.
    if body_fat is not None and body_fat == 0:
        body_fat = muscle_pct = sinew_pct = water_pct = protein_pct = None
        visfat = bone_kg = None
        bmr = body_age = None

    muscle_mass_kg = None
    if weight_kg is not None and muscle_pct is not None:
        muscle_mass_kg = round(weight_kg * muscle_pct / 100.0, 2)

    return {
        "measured_at":          measured_at.isoformat(),
        "weight_kg":            weight_kg,
        "bmi":                  bmi,
        "body_fat_pct":         body_fat,
        "muscle_pct":           muscle_pct,
        "muscle_mass_kg":       muscle_mass_kg,
        "skeletal_muscle_pct":  sinew_pct,
        "water_pct":            water_pct,
        "protein_pct":          protein_pct,
        "visceral_fat":         visfat,
        "bone_mass_kg":         bone_kg,
        "bmr_kcal":             bmr,
        "metabolic_age":        body_age,
        "source":               "renpho",
        "raw":                  rec,
    }


def main():
    env = require_env()

    print("Logging into Renpho...")
    client = RenphoClient(env["RENPHO_EMAIL"], env["RENPHO_PASSWORD"])
    try:
        client.login()
    except RenphoAPIError as e:
        print(f"ERROR: Renpho login failed: {e}", file=sys.stderr)
        sys.exit(3)

    print("Fetching measurement history...")
    measurements = client.get_all_measurements() or []
    print(f"  fetched {len(measurements)} raw records")

    rows = []
    dropped = 0
    for rec in measurements:
        if not isinstance(rec, dict):
            dropped += 1
            continue
        row = map_row(rec)
        if row is None:
            dropped += 1
            continue
        rows.append(row)

    if dropped:
        print(f"  dropped {dropped} records with no parseable timestamp")

    if not rows:
        print("No usable rows to upsert.")
        return

    print(f"Connecting to Supabase REST and upserting {len(rows)} rows...")
    # Prefer service_role when set (bypasses RLS); fall back to anon.
    sb_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env["SUPABASE_KEY"]).strip()
    supabase: Client = create_client(env["SUPABASE_URL"].strip(), sb_key)
    resp = supabase.table("body_composition").upsert(rows, on_conflict="measured_at").execute()
    written = len(resp.data) if getattr(resp, "data", None) else 0
    print(f"Upserted {written} rows into body_composition (of {len(rows)} sent).")


if __name__ == "__main__":
    main()
