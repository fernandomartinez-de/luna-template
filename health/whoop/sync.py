import os, requests, time
from datetime import datetime, timedelta, timezone
from supabase import create_client, Client

CLIENT_ID     = os.environ["WHOOP_CLIENT_ID"]
CLIENT_SECRET = os.environ["WHOOP_CLIENT_SECRET"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# WHOOP gives a new refresh token on every sync and the old one stops working.
# The current one is kept in the database (app_config "whoop_refresh_token"),
# put there first by the Connect WHOOP workflow.
TOKEN_KEY = "whoop_refresh_token"
_db = create_client(SUPABASE_URL.strip(), SUPABASE_KEY.strip())


def load_refresh_token():
    row = _db.table("app_config").select("value").eq("key", TOKEN_KEY).maybe_single().execute()
    if not row or not row.data:
        print("WHOOP is not connected yet. Run the Connect WHOOP workflow first.")
        raise SystemExit(1 if os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch" else 0)
    return row.data["value"]


def save_refresh_token(value):
    _db.table("app_config").upsert({"key": TOKEN_KEY, "value": value, "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
    print("Saved WHOOP's new refresh token")


REFRESH_TOKEN = load_refresh_token()

SPORT_NAMES = {
    -1: "Activity", 0: "Running", 1: "Cycling", 16: "Baseball", 17: "Basketball",
    18: "Rowing", 19: "Fencing", 20: "Field Hockey", 21: "Football", 22: "Golf",
    24: "Ice Hockey", 25: "Lacrosse", 27: "Rugby", 28: "Sailing", 29: "Skiing",
    30: "Soccer", 31: "Softball", 32: "Squash", 33: "Swimming", 34: "Tennis",
    35: "Track and Field", 36: "Volleyball", 37: "Water Polo", 38: "Wrestling",
    39: "Boxing", 42: "Dance", 43: "Pilates", 44: "Yoga", 45: "Weightlifting",
    47: "Cross Country Skiing", 48: "Functional Fitness", 49: "Duathlon",
    51: "Gymnastics", 52: "Hiking/Rucking", 53: "Horseback Riding",
    55: "Kayaking", 56: "Martial Arts", 57: "Mountain Biking", 59: "Powerlifting",
    60: "Rock Climbing", 61: "Paddleboarding", 62: "Triathlon", 63: "Walking",
    64: "Surfing", 65: "Elliptical", 66: "Stairmaster", 70: "Meditation",
    71: "Other", 73: "Diving", 74: "Operations - Tactical", 75: "Operations - Medical",
    76: "Operations - Flying", 77: "Operations - Water", 82: "Ultimate",
    83: "Climber", 84: "Jumping Rope", 85: "Australian Football", 86: "Skateboarding",
    87: "Coaching", 88: "Ice Bath", 89: "Commuting", 90: "Gaming",
    91: "Snowboarding", 92: "Motocross", 93: "Caddying", 94: "Obstacle Course Racing",
    95: "Motor Racing", 96: "HIIT", 97: "Spin", 98: "Jiu Jitsu",
    99: "Manual Labor", 100: "Cricket", 101: "Pickleball", 102: "Inline Skating",
    103: "Box Fitness", 104: "Spikeball", 105: "Wheelchair Pushing",
    106: "Paddle Tennis", 107: "Barre", 108: "Stage Performance",
    109: "High Stress Work", 110: "Parkour", 111: "Gaelic Football",
    112: "Hurling/Camogie", 113: "Circus Arts", 121: "Massage Therapy",
    125: "Watching Sports", 126: "Assault Bike", 127: "Kickboxing",
    128: "Stretching", 230: "Table Tennis", 231: "Badminton", 232: "Netball",
    233: "Sauna", 234: "Disc Golf", 235: "Yard Work", 236: "Air Compression",
    237: "Percussive Massage", 238: "Paintball", 239: "Ice Skating",
    240: "Handball", 248: "F45 Training", 249: "Padel", 250: "Barry's",
    251: "Dedicated Parenting", 252: "Stroller Walking", 253: "Stroller Jogging",
    254: "Toddlerwearing", 255: "Babywearing", 258: "Barre3", 259: "Hot Yoga",
    261: "Stadium Steps", 262: "Polo", 263: "Musical Performance", 264: "Kite Boarding",
    266: "Dog Walking", 267: "Water Skiing", 268: "Wakeboarding", 269: "Cooking",
    270: "Cleaning", 272: "Public Speaking",
}

def get_access_token():
    r = requests.post("https://api.prod.whoop.com/oauth/oauth2/token", data={
        "grant_type":    "refresh_token",
        "refresh_token": REFRESH_TOKEN,
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "offline",
    })
    if r.status_code in (400, 401):
        raise SystemExit("WHOOP refused the saved token. Run the Connect WHOOP workflow again to reconnect.")
    r.raise_for_status()
    payload = r.json()
    new_refresh = payload.get("refresh_token")
    if new_refresh and new_refresh != REFRESH_TOKEN:
        save_refresh_token(new_refresh)
    return payload["access_token"]

def whoop_get_all(token, path, days_back=365):
    all_records = []
    next_token = None
    page = 1
    start = (datetime.now(timezone.utc) - timedelta(days=days_back)).isoformat()
    end   = datetime.now(timezone.utc).isoformat()
    while True:
        params = {"limit": 25, "start": start, "end": end}
        if next_token:
            params["nextToken"] = next_token
        r = requests.get(
            f"https://api.prod.whoop.com/developer/v2/{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params
        )
        r.raise_for_status()
        data = r.json()
        records = data.get("records", [])
        all_records.extend(records)
        print(f"  {path} page {page}: {len(records)} records (total: {len(all_records)})")
        next_token = data.get("next_token")
        if not next_token:
            break
        page += 1
        if page > 100:
            print("  Stopped at 100 pages safety limit")
            break
    return all_records

def whoop_get(token, path):
    r = requests.get(
        f"https://api.prod.whoop.com/developer/v2/{path}",
        headers={"Authorization": f"Bearer {token}"}
    )
    r.raise_for_status()
    return r.json()

def ms_to_min(ms):
    return round(ms / 60000.0, 1) if ms else None

def retry_supabase_call(func, *args, max_retries=5, **kwargs):
    """Retry Supabase calls with exponential backoff for network errors."""
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_str = str(e).lower()
            # Retry on DNS/network errors
            if 'name or service not known' in error_str or 'connecterror' in error_str:
                if attempt < max_retries - 1:
                    wait = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                    print(f"  Network error (attempt {attempt + 1}/{max_retries}), retrying in {wait}s: {e}")
                    time.sleep(wait)
                    continue
            # Re-raise if not a retryable error or out of retries
            raise

def sync():
    token = get_access_token()
    print(f"Connecting to Supabase: {SUPABASE_URL[:30]}...")
    supabase: Client = create_client(SUPABASE_URL.strip(), SUPABASE_KEY.strip())

    print("Fetching all cycles...")
    cycles = whoop_get_all(token, "cycle")
    cycle_rows = []
    for c in cycles:
        score = c.get("score") or {}
        kj = score.get("kilojoule")
        cal = round(kj * 0.239, 1) if kj else None
        cycle_rows.append({
            'cycle_id': str(c["id"]),
            'start_time': c.get("start"),
            'end_time': c.get("end"),
            'strain': score.get("strain"),
            'average_heart_rate': score.get("average_heart_rate"),
            'max_heart_rate': score.get("max_heart_rate"),
            'kilojoules': kj,
            'calories_kcal': cal
        })
    if cycle_rows:
        print(f"Upserting {len(cycle_rows)} cycles...")
        retry_supabase_call(lambda: supabase.table('whoop_cycles').upsert(cycle_rows).execute())

    print("Fetching all recovery...")
    recoveries = whoop_get_all(token, "recovery")

    # Build cycle_id to date map from already-upserted cycles
    cycle_dates = {row['cycle_id']: row['start_time'] for row in cycle_rows}

    recovery_rows = []
    for r in recoveries:
        score = r.get("score") or {}
        cycle_id_str = str(r["cycle_id"])

        # Get date from our local cycle map
        rec_date = None
        if cycle_id_str in cycle_dates:
            start_time = cycle_dates[cycle_id_str]
            if start_time:
                rec_date = start_time.split('T')[0] if 'T' in start_time else start_time

        recovery_rows.append({
            'cycle_id': cycle_id_str,
            'recovery_date': rec_date,
            'recovery_score': score.get("recovery_score"),
            'resting_heart_rate': score.get("resting_heart_rate"),
            'hrv_rmssd_milli': score.get("hrv_rmssd_milli"),
            'spo2_percentage': score.get("spo2_percentage"),
            'skin_temp_celsius': score.get("skin_temp_celsius")
        })
    if recovery_rows:
        print(f"Upserting {len(recovery_rows)} recoveries...")
        retry_supabase_call(lambda: supabase.table('whoop_recovery').upsert(recovery_rows).execute())

    print("Fetching all sleep...")
    sleeps = whoop_get_all(token, "activity/sleep")
    sleep_rows = []
    for s in sleeps:
        score = s.get("score") or {}
        stages = score.get("stage_summary") or {}
        dur = None
        if s.get("start") and s.get("end"):
            dur = round((datetime.fromisoformat(s["end"].replace("Z","+00:00")) -
                   datetime.fromisoformat(s["start"].replace("Z","+00:00"))).seconds / 60, 1)

        sleep_rows.append({
            'sleep_id': str(s["id"]),
            'cycle_id': str(s.get("cycle_id")) if s.get("cycle_id") else None,
            'start_time': s.get("start"),
            'end_time': s.get("end"),
            'duration_minutes': dur,
            'performance_percentage': score.get("sleep_performance_percentage"),
            'sleep_efficiency_percentage': score.get("sleep_efficiency_percentage"),
            'light_sleep_minutes': ms_to_min(stages.get("total_light_sleep_time_milli")),
            'slow_wave_sleep_minutes': ms_to_min(stages.get("total_slow_wave_sleep_time_milli")),
            'rem_sleep_minutes': ms_to_min(stages.get("total_rem_sleep_time_milli")),
            'awake_minutes': ms_to_min(stages.get("total_awake_time_milli"))
        })
    if sleep_rows:
        print(f"Upserting {len(sleep_rows)} sleeps...")
        retry_supabase_call(lambda: supabase.table('whoop_sleep').upsert(sleep_rows).execute())

    print("Fetching all workouts...")
    workouts = whoop_get_all(token, "activity/workout")
    workout_rows = []
    for w in workouts:
        score = w.get("score") or {}
        kj = score.get("kilojoule")
        cal = round(kj * 0.239, 1) if kj else None
        sport_id = w.get("sport_id")
        sport_name = SPORT_NAMES.get(sport_id, f"Unknown ({sport_id})")

        workout_rows.append({
            'workout_id': str(w["id"]),
            'start_time': w.get("start"),
            'end_time': w.get("end"),
            'sport_name': sport_name,
            'strain': score.get("strain"),
            'average_heart_rate': score.get("average_heart_rate"),
            'max_heart_rate': score.get("max_heart_rate"),
            'kilojoules': kj,
            'calories_kcal': cal
        })
    if workout_rows:
        print(f"Upserting {len(workout_rows)} workouts...")
        retry_supabase_call(lambda: supabase.table('whoop_workouts').upsert(workout_rows).execute())

    try:
        data = whoop_get(token, "user/measurement/body")
        # Delete all existing body measurements
        retry_supabase_call(lambda: supabase.table('whoop_body').delete().neq('height_meter', -999999).execute())
        # Insert new one
        retry_supabase_call(lambda: supabase.table('whoop_body').insert({
            'height_meter': data.get("height_meter"),
            'weight_kilogram': data.get("weight_kilogram"),
            'max_heart_rate': data.get("max_heart_rate"),
            'vo2_max': data.get("vo2_max")
        }).execute())
    except Exception as e:
        print(f"Body measurement skipped: {e}")

    print(f"Sync complete: {datetime.now()}")
    print(f"Totals: {len(cycles)} cycles, {len(recoveries)} recoveries, {len(sleeps)} sleeps, {len(workouts)} workouts")

sync()
