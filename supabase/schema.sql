-- =============================================================================
-- Luna database setup (Supabase / Postgres)
-- =============================================================================
-- Paste this whole file into Supabase > SQL Editor > New query, change the two
-- lines marked EDIT just below, then click Run. It builds every table, rule and
-- setting Luna needs. Safe to run again later; nothing is duplicated or lost.
-- =============================================================================

select set_config('luna.owner_email', 'you@example.com', false);   -- EDIT: the email you will sign in to Luna with
select set_config('luna.unlock_code',  '1234',            false);   -- EDIT: the 4 digit code Luna asks for when it opens

create extension if not exists pgcrypto;


-- -----------------------------------------------------------------------------
-- Sequences (for tables that use serial ids)
-- -----------------------------------------------------------------------------
create sequence if not exists public.category_mapping_id_seq;
create sequence if not exists public.completed_workout_exercises_id_seq;
create sequence if not exists public.exercises_id_seq;
create sequence if not exists public.expense_transactions_id_seq;
create sequence if not exists public.finance_alert_mutes_id_seq;
create sequence if not exists public.finance_alerts_id_seq;
create sequence if not exists public.real_estate_history_id_seq;
create sequence if not exists public.stocks_crypto_history_id_seq;
create sequence if not exists public.whoop_body_id_seq;
create sequence if not exists public.workout_exercises_id_seq;
create sequence if not exists public.workouts_id_seq;


-- =============================================================================
-- Finance
-- =============================================================================

-- Bank transactions (from the bank sync, daily).
create table if not exists public.expense_transactions (
    id bigint default nextval('expense_transactions_id_seq'::regclass) not null,
    transaction_date date not null,
    post_date date,
    description text not null,
    amount numeric(10,2) not null,
    category text,
    source text not null,
    month text not null,
    created_at timestamp with time zone default now(),
    plaid_transaction_id text,
    category_manual boolean default false not null,
    constraint expense_transactions_pkey primary key (id),
    constraint expense_transactions_plaid_transaction_id_key unique (plaid_transaction_id)
);

-- Rules that assign a category from the transaction description.
create table if not exists public.category_mapping (
    id integer default nextval('category_mapping_id_seq'::regclass) not null,
    category text not null,
    pattern text not null,
    pattern_type text not null,
    priority integer default 100,
    notes text,
    created_at timestamp without time zone default now(),
    updated_at timestamp without time zone default now(),
    constraint category_mapping_pkey primary key (id),
    constraint category_mapping_pattern_pattern_type_key unique (pattern, pattern_type),
    constraint category_mapping_pattern_type_check check (pattern_type = any (array['exact','contains','starts_with','regex']))
);

-- Not used in this copy (left from an older bank sync).
create table if not exists public.plaid_accounts (
    account_id text not null,
    item_id text,
    name text,
    official_name text,
    mask text,
    type text,
    subtype text,
    source_code text,
    updated_at timestamp with time zone default now(),
    constraint plaid_accounts_pkey primary key (account_id)
);

-- Not used in this copy (left from an older bank sync).
create table if not exists public.plaid_sync_state (
    item_id text not null,
    cursor text,
    institution_name text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    constraint plaid_sync_state_pkey primary key (item_id)
);

-- Daily holdings snapshots (stocks, crypto, retirement, brokerage).
create table if not exists public.stocks_crypto_history (
    id integer default nextval('stocks_crypto_history_id_seq'::regclass) not null,
    snapshot_date date not null,
    asset_type character varying(20) not null,
    asset_name character varying(50) not null,
    quantity numeric(18,8) not null,
    price_per_unit numeric(12,2) not null,
    total_value numeric(12,2) not null,
    cost_basis numeric(12,2) not null,
    unrealized_gain_loss numeric(12,2),
    created_at timestamp without time zone default now(),
    constraint stocks_crypto_history_pkey primary key (id),
    constraint stocks_crypto_history_snapshot_date_asset_name_key unique (snapshot_date, asset_name),
    constraint stocks_crypto_history_asset_type_check check ((asset_type)::text = any (array['Stock','Crypto','Retirement','Brokerage']))
);

-- Your stocks and funds. Edit this like a spreadsheet in Supabase > Table Editor.
-- The Update Stock Prices workflow values them every weekday.
create table if not exists public.holdings (
    ticker text not null,          -- Yahoo Finance symbol, e.g. AAPL, VWCE.DE, SAN.MC
    shares numeric not null,       -- how many you own (decimals are fine)
    total_cost numeric,            -- what you paid for all of them, in your currency
    notes text,
    constraint holdings_pkey primary key (ticker)
);

-- Home value snapshots (not used yet).
create table if not exists public.real_estate_history (
    id integer default nextval('real_estate_history_id_seq'::regclass) not null,
    snapshot_date date not null,
    asset_name character varying(100) not null,
    asset_type character varying(50) default 'Real Estate' not null,
    home_value numeric(12,2) not null,
    mortgage_balance numeric(12,2) default 0,
    net_equity numeric(12,2) not null,
    cost_basis numeric(12,2) not null,
    unrealized_gain_loss numeric(12,2),
    location character varying(200),
    notes text,
    created_at timestamp with time zone default now(),
    data_source character varying(20) default 'Redfin',
    constraint real_estate_history_pkey primary key (id),
    constraint real_estate_history_unique_snapshot unique (snapshot_date, asset_name, data_source)
);

-- Money alerts (double charges, new subscriptions, fees...) shown in Luna.
create table if not exists public.finance_alerts (
    id bigint default nextval('finance_alerts_id_seq'::regclass) not null,
    alert_key text not null,
    alert_type text not null,
    severity text default 'medium' not null,
    title text not null,
    detail text,
    merchant text,
    amount numeric,
    txn_date date,
    transaction_ids bigint[] default '{}'::bigint[] not null,
    status text default 'open' not null,
    created_at timestamp with time zone default now() not null,
    notified_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    constraint finance_alerts_pkey primary key (id),
    constraint finance_alerts_alert_key_key unique (alert_key),
    constraint finance_alerts_severity_check check (severity = any (array['high','medium','low'])),
    constraint finance_alerts_status_check check (status = any (array['open','dismissed']))
);

-- Alert types muted per merchant.
create table if not exists public.finance_alert_mutes (
    id bigint default nextval('finance_alert_mutes_id_seq'::regclass) not null,
    alert_type text not null,
    merchant text not null,
    created_at timestamp with time zone default now() not null,
    constraint finance_alert_mutes_pkey primary key (id),
    constraint finance_alert_mutes_alert_type_merchant_key unique (alert_type, merchant)
);


-- =============================================================================
-- Health: WHOOP and body composition
-- =============================================================================

create table if not exists public.whoop_recovery (
    cycle_id text not null,
    recovery_score numeric,
    resting_heart_rate numeric,
    hrv_rmssd_milli numeric,
    spo2_percentage numeric,
    skin_temp_celsius numeric,
    inserted_at timestamp with time zone default now(),
    recovery_date date,
    constraint whoop_recovery_pkey primary key (cycle_id)
);

create table if not exists public.whoop_cycles (
    cycle_id text not null,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    strain numeric,
    average_heart_rate integer,
    max_heart_rate integer,
    kilojoules numeric,
    calories_kcal numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_cycles_pkey primary key (cycle_id)
);

create table if not exists public.whoop_sleep (
    sleep_id text not null,
    cycle_id text,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    duration_minutes numeric,
    performance_percentage numeric,
    sleep_efficiency_percentage numeric,
    light_sleep_minutes numeric,
    slow_wave_sleep_minutes numeric,
    rem_sleep_minutes numeric,
    awake_minutes numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_sleep_pkey primary key (sleep_id)
);

create table if not exists public.whoop_workouts (
    workout_id text not null,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    sport_name text,
    strain numeric,
    average_heart_rate integer,
    max_heart_rate integer,
    kilojoules numeric,
    calories_kcal numeric,
    inserted_at timestamp with time zone default now(),
    constraint whoop_workouts_pkey primary key (workout_id)
);

create table if not exists public.whoop_body (
    id integer default nextval('whoop_body_id_seq'::regclass) not null,
    recorded_at timestamp with time zone default now(),
    height_meter numeric,
    weight_kilogram numeric,
    max_heart_rate integer,
    vo2_max numeric,
    constraint whoop_body_pkey primary key (id)
);

-- Smart scale readings (Renpho, daily).
create table if not exists public.body_composition (
    id bigint generated always as identity not null,
    measured_at timestamp with time zone not null,
    weight_kg numeric(6,2),
    bmi numeric(5,2),
    body_fat_pct numeric(5,2),
    muscle_mass_kg numeric(6,2),
    skeletal_muscle_pct numeric(5,2),
    water_pct numeric(5,2),
    protein_pct numeric(5,2),
    visceral_fat numeric(5,1),
    bone_mass_kg numeric(5,2),
    bmr_kcal integer,
    metabolic_age integer,
    source text default 'renpho' not null,
    raw jsonb,
    created_at timestamp with time zone default now() not null,
    muscle_pct numeric(5,2),
    constraint body_composition_pkey primary key (id),
    constraint body_composition_measured_at_key unique (measured_at)
);




-- =============================================================================
-- Nutrition
-- =============================================================================

create table if not exists public.nutrition_log (
    id bigint generated always as identity not null,
    logged_date date not null,
    meal text,
    item text not null,
    quantity text,
    calories_kcal numeric(7,1) not null,
    protein_g numeric(6,1),
    carbs_g numeric(6,1),
    fat_g numeric(6,1),
    fiber_g numeric(6,1),
    source text default 'chat' not null,
    note text,
    created_at timestamp with time zone default now() not null,
    constraint nutrition_log_pkey primary key (id)
);

create table if not exists public.meal_templates (
    id bigint generated always as identity not null,
    meal text not null,
    name text not null,
    items text not null,
    calories numeric(7,1) not null,
    protein_g numeric(6,1) default 0,
    carbs_g numeric(6,1) default 0,
    fat_g numeric(6,1) default 0,
    tags text[] default '{}'::text[],
    active boolean default true,
    created_at timestamp with time zone default now(),
    constraint meal_templates_pkey primary key (id)
);

create table if not exists public.meal_plan (
    id bigint generated always as identity not null,
    plan_date date not null,
    meal text not null,
    item text not null,
    note text,
    created_at timestamp with time zone default now(),
    constraint meal_plan_pkey primary key (id)
);


-- =============================================================================
-- Training
-- =============================================================================

-- Exercise library (about 870 rows, imported once).
create table if not exists public.exercises (
    id integer default nextval('exercises_id_seq'::regclass) not null,
    name character varying(255) not null,
    slug character varying(255) not null,
    muscle_group character varying(50) not null,
    secondary_muscles text[],
    equipment character varying(100),
    category character varying(50),
    force character varying(50),
    level character varying(50),
    mechanic character varying(50),
    instructions text[],
    images text[],
    source_id character varying(255),
    created_at timestamp with time zone default now(),
    constraint exercises_pkey primary key (id),
    constraint exercises_slug_key unique (slug)
);

-- Saved workout templates and their exercises.
create table if not exists public.workouts (
    id integer default nextval('workouts_id_seq'::regclass) not null,
    name character varying(255) not null,
    description text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    constraint workouts_pkey primary key (id)
);

create table if not exists public.workout_exercises (
    id integer default nextval('workout_exercises_id_seq'::regclass) not null,
    workout_id integer not null,
    exercise_id integer not null,
    order_index integer default 0 not null,
    sets integer default 3,
    reps integer default 10,
    notes text,
    created_at timestamp with time zone default now(),
    weight numeric,
    set_details jsonb,
    constraint workout_exercises_pkey primary key (id),
    constraint workout_exercises_workout_id_exercise_id_key unique (workout_id, exercise_id)
);

-- Workouts actually performed (optionally linked to a WHOOP workout).
create table if not exists public.completed_workouts (
    id bigint generated always as identity not null,
    workout_id integer,
    workout_name text,
    whoop_workout_id text,
    sport_name text,
    performed_at timestamp with time zone not null,
    strain numeric,
    calories_kcal numeric,
    notes text,
    created_at timestamp with time zone default now() not null,
    constraint completed_workouts_pkey primary key (id),
    constraint completed_workouts_whoop_workout_id_key unique (whoop_workout_id)
);

create table if not exists public.completed_workout_exercises (
    id integer default nextval('completed_workout_exercises_id_seq'::regclass) not null,
    completed_workout_id integer,
    exercise_id integer,
    order_index integer,
    set_details jsonb,
    constraint completed_workout_exercises_pkey primary key (id)
);

-- Weekly plan and run log.
create table if not exists public.training_plan (
    dow text not null,
    training_type text,
    load text,
    notes text,
    updated_at timestamp with time zone default now(),
    constraint training_plan_pkey primary key (dow)
);

create table if not exists public.running_log (
    run_date date not null,
    distance_km numeric,
    updated_at timestamp with time zone default now() not null,
    constraint running_log_pkey primary key (run_date)
);

-- Legacy strength log (kept for history; nothing writes to it today).
create table if not exists public.strength_exercises (
    exercise_id bigint generated always as identity not null,
    name text not null,
    equipment text,
    primary_muscle text,
    default_category text,
    created_at timestamp with time zone default now() not null,
    constraint strength_exercises_pkey primary key (exercise_id),
    constraint strength_exercises_name_key unique (name)
);

create table if not exists public.strength_sessions (
    session_id bigint generated always as identity not null,
    session_date date not null,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    category text,
    whoop_workout_id text,
    source text default 'whoop' not null,
    notes text,
    created_at timestamp with time zone default now() not null,
    constraint strength_sessions_pkey primary key (session_id),
    constraint strength_sessions_whoop_workout_id_key unique (whoop_workout_id)
);

create table if not exists public.strength_sets (
    set_id bigint generated always as identity not null,
    session_id bigint not null,
    exercise_id bigint not null,
    order_index integer not null,
    set_number integer not null,
    reps integer not null,
    weight_kg numeric(6,2) not null,
    is_warmup boolean default false not null,
    volume_kg numeric(10,2) generated always as ((reps)::numeric * weight_kg) stored,
    created_at timestamp with time zone default now() not null,
    constraint strength_sets_pkey primary key (set_id),
    constraint strength_sets_session_id_exercise_id_set_number_key unique (session_id, exercise_id, set_number)
);

create table if not exists public.strength_ingest_log (
    file_id text not null,
    session_id bigint,
    status text not null,
    note text,
    processed_at timestamp with time zone default now() not null,
    constraint strength_ingest_log_pkey primary key (file_id)
);


-- =============================================================================
-- Config
-- =============================================================================

create table if not exists public.app_config (
    key text not null,
    value text not null,
    updated_at timestamp with time zone default now() not null,
    constraint app_config_pkey primary key (key)
);


-- =============================================================================
-- Foreign keys
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'completed_workout_exercises_completed_workout_id_fkey') then
    alter table public.completed_workout_exercises add constraint completed_workout_exercises_completed_workout_id_fkey foreign key (completed_workout_id) references completed_workouts(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completed_workout_exercises_exercise_id_fkey') then
    alter table public.completed_workout_exercises add constraint completed_workout_exercises_exercise_id_fkey foreign key (exercise_id) references exercises(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'completed_workouts_workout_id_fkey') then
    alter table public.completed_workouts add constraint completed_workouts_workout_id_fkey foreign key (workout_id) references workouts(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_ingest_log_session_id_fkey') then
    alter table public.strength_ingest_log add constraint strength_ingest_log_session_id_fkey foreign key (session_id) references strength_sessions(session_id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sessions_whoop_workout_id_fkey') then
    alter table public.strength_sessions add constraint strength_sessions_whoop_workout_id_fkey foreign key (whoop_workout_id) references whoop_workouts(workout_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sets_exercise_id_fkey') then
    alter table public.strength_sets add constraint strength_sets_exercise_id_fkey foreign key (exercise_id) references strength_exercises(exercise_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'strength_sets_session_id_fkey') then
    alter table public.strength_sets add constraint strength_sets_session_id_fkey foreign key (session_id) references strength_sessions(session_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_exercises_exercise_id_fkey') then
    alter table public.workout_exercises add constraint workout_exercises_exercise_id_fkey foreign key (exercise_id) references exercises(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'workout_exercises_workout_id_fkey') then
    alter table public.workout_exercises add constraint workout_exercises_workout_id_fkey foreign key (workout_id) references workouts(id) on delete cascade;
  end if;
end $$;


-- =============================================================================
-- Indexes
-- =============================================================================

create index if not exists idx_body_comp_measured on public.body_composition using btree (measured_at);
create index if not exists completed_workouts_performed_at_idx on public.completed_workouts using btree (performed_at desc);
create index if not exists idx_exercises_muscle_group on public.exercises using btree (muscle_group);
create index if not exists idx_exercises_category on public.exercises using btree (category);
create index if not exists idx_exercises_equipment on public.exercises using btree (equipment);
create index if not exists idx_expense_date on public.expense_transactions using btree (transaction_date desc);
create index if not exists idx_expense_month on public.expense_transactions using btree (month);
create index if not exists idx_expense_category on public.expense_transactions using btree (category);
create index if not exists finance_alerts_open_idx on public.finance_alerts using btree (status, txn_date desc);
create index if not exists idx_nutrition_log_date on public.nutrition_log using btree (logged_date);
create index if not exists idx_real_estate_asset_name on public.real_estate_history using btree (asset_name);
create index if not exists idx_real_estate_snapshot_date on public.real_estate_history using btree (snapshot_date desc);
create index if not exists idx_stocks_crypto_type on public.stocks_crypto_history using btree (asset_type);
create index if not exists idx_stocks_crypto_asset on public.stocks_crypto_history using btree (asset_name);
create index if not exists idx_stocks_crypto_date on public.stocks_crypto_history using btree (snapshot_date);
create index if not exists idx_strength_sessions_date on public.strength_sessions using btree (session_date);
create index if not exists idx_strength_sets_session on public.strength_sets using btree (session_id);
create index if not exists idx_strength_sets_exercise on public.strength_sets using btree (exercise_id);
create index if not exists idx_workout_exercises_exercise_id on public.workout_exercises using btree (exercise_id);
create index if not exists idx_workout_exercises_workout_id on public.workout_exercises using btree (workout_id);
create index if not exists idx_workout_exercises_order on public.workout_exercises using btree (workout_id, order_index);


-- =============================================================================
-- Functions and triggers
-- =============================================================================

-- Returns the category for a transaction description, using category_mapping.
create or replace function public.apply_category_mapping(transaction_desc text)
 returns text language plpgsql immutable
 set search_path to 'public', 'pg_temp'
as $function$
declare
    matched_category text;
    rule record;
begin
    for rule in
        select pattern, category, pattern_type
        from category_mapping
        order by priority asc, id asc
    loop
        case rule.pattern_type
            when 'exact' then
                if upper(transaction_desc) = upper(rule.pattern) then
                    matched_category := rule.category; exit;
                end if;
            when 'contains' then
                if upper(transaction_desc) like '%' || upper(rule.pattern) || '%' then
                    matched_category := rule.category; exit;
                end if;
            when 'starts_with' then
                if upper(transaction_desc) like upper(rule.pattern) || '%' then
                    matched_category := rule.category; exit;
                end if;
            else null;
        end case;
    end loop;
    return matched_category;
end;
$function$;

-- Categorizes new transactions automatically.
create or replace function public.auto_categorize_transaction()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    if new.category is null or new.category = 'Uncategorized' then
        new.category := apply_category_mapping(new.description);
    end if;
    return new;
end;
$function$;

-- Keeps a category you set by hand from being overwritten by a later sync.
create or replace function public.keep_manual_category()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.category_manual
     and new.category is distinct from old.category
     and coalesce(current_setting('luna.manual_category', true), '') <> 'on' then
    new.category := old.category;
    new.category_manual := true;
  end if;
  return new;
end;
$function$;

create or replace function public.update_updated_at_column()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

drop trigger if exists trigger_auto_categorize on public.expense_transactions;
create trigger trigger_auto_categorize before insert or update on public.expense_transactions
  for each row execute function auto_categorize_transaction();

drop trigger if exists trg_keep_manual_category on public.expense_transactions;
create trigger trg_keep_manual_category before update on public.expense_transactions
  for each row execute function keep_manual_category();

drop trigger if exists update_workouts_updated_at on public.workouts;
create trigger update_workouts_updated_at before update on public.workouts
  for each row execute function update_updated_at_column();

-- Called from Luna when you change a transaction's category (optionally saving a rule).
create or replace function public.recategorize_transaction(p_id bigint, p_category text, p_remember_pattern text default null)
 returns jsonb language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  v_category text := nullif(btrim(p_category), '');
  v_pattern  text := nullif(upper(btrim(coalesce(p_remember_pattern, ''))), '');
  v_applied  int := 0;
begin
  if v_category is not null and length(v_category) > 60 then
    raise exception 'Category name too long';
  end if;
  if v_pattern is not null and length(v_pattern) < 3 then
    raise exception 'Rule text must be at least 3 characters';
  end if;

  perform set_config('luna.manual_category', 'on', true);

  update expense_transactions
     set category = v_category,
         category_manual = (v_category is not null)
   where id = p_id;
  if not found then
    raise exception 'Transaction % not found', p_id;
  end if;

  if v_pattern is not null and v_category is not null then
    insert into category_mapping (category, pattern, pattern_type, priority, notes)
    values (v_category, v_pattern, 'contains', 50, 'Added from Luna');

    update expense_transactions
       set category = v_category
     where category is null
       and upper(description) like '%' || v_pattern || '%';
    get diagnostics v_applied = row_count;
  end if;

  return jsonb_build_object('id', p_id, 'category', v_category, 'also_applied', v_applied);
end;
$function$;

-- Called from Luna when you dismiss (and optionally mute) a money alert.
create or replace function public.dismiss_finance_alert(p_id bigint, p_mute boolean default false)
 returns jsonb language plpgsql security definer
 set search_path to 'public'
as $function$
declare
  a finance_alerts%rowtype;
begin
  update finance_alerts
     set status = 'dismissed', dismissed_at = now()
   where id = p_id
   returning * into a;
  if not found then
    raise exception 'Alert % not found', p_id;
  end if;

  if p_mute and a.merchant is not null then
    insert into finance_alert_mutes (alert_type, merchant)
    values (a.alert_type, a.merchant)
    on conflict do nothing;
    update finance_alerts
       set status = 'dismissed', dismissed_at = now()
     where status = 'open' and alert_type = a.alert_type and merchant = a.merchant;
  end if;

  return jsonb_build_object('id', p_id, 'muted', p_mute and a.merchant is not null);
end;
$function$;

create or replace function public.get_cycles_by_date(start_d date, end_d date)
 returns table(d date, strain numeric, kilojoules numeric, average_heart_rate integer, max_heart_rate integer)
 language sql stable
 set search_path to 'public', 'pg_temp'
as $function$
    select (start_time at time zone 'UTC')::date as d, strain, kilojoules, average_heart_rate, max_heart_rate
    from public.whoop_cycles
    where (start_time at time zone 'UTC')::date between start_d and end_d
    order by start_time;
$function$;


-- =============================================================================
-- Views (spending summaries for the Expenses tab)
-- =============================================================================
-- Which categories count as fixed costs, and which are left out of spending
-- (money moving between your own accounts, salary, cash). Edit to taste.

create or replace view public.vw_category_groups with (security_invoker = on) as
 select category,
        case
            when category = any (array['Rent','Mortgage Payment','Community Fees','Electricity','Water','Gas','Internet / Phone','Insurance','Gym']) then 'Fixed Costs'
            when category = any (array['ATM','Bizum','Transfer','Credit Card Payment','Savings','Payroll','Income']) then 'Excluded'
            else 'Discretionary'
        end as category_group
   from expense_transactions
  group by category;

create or replace view public.vw_category_mapping with (security_invoker = on) as
 select category,
    string_agg(pattern, ', ' order by priority, pattern) as aliases,
    count(*) as pattern_count,
    min(priority) as min_priority
   from category_mapping
  group by category
  order by (min(priority)), category;

create or replace view public.vw_dashboard_summary with (security_invoker = on) as
 select t.month, t.category,
    sum(abs(t.amount)) as total,
    count(*) as transaction_count,
    max(t.created_at) as last_updated
   from expense_transactions t
     left join vw_category_groups g on t.category = g.category
  where g.category_group = any (array['Fixed Costs','Discretionary'])
    and not (t.category = 'Miscellaneous' and abs(t.amount) > 100000)
  group by t.month, t.category;

create or replace view public.vw_discretionary_summary with (security_invoker = on) as
 select t.month, t.category,
    sum(abs(t.amount)) as total,
    count(*) as transaction_count
   from expense_transactions t
     left join vw_category_groups g on t.category = g.category
  where g.category_group = 'Discretionary'
    and not (t.category = 'Miscellaneous' and abs(t.amount) > 100000)
  group by t.month, t.category;

create or replace view public.vw_fixed_costs_summary with (security_invoker = on) as
 with latest_per_category as (
     select distinct on (category) category,
        abs(amount) as latest_amount,
        transaction_date
       from expense_transactions
      where category = any (array['Rent','Mortgage Payment','Community Fees','Electricity','Water','Gas','Internet / Phone','Insurance','Gym'])
      order by category, transaction_date desc
 )
 select category,
    latest_amount as avg_per_month,
    latest_amount as total_all_months,
    1 as months_with_data
   from latest_per_category;

-- These two depend on the views above.
create or replace function public.get_net_remaining()
 returns table(avg_payroll numeric, avg_fixed_costs numeric, avg_net_remaining numeric, months_tracked integer)
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    return query
    with last_two_payrolls as (
        select abs(amount) as amount from expense_transactions
        where category = 'Payroll' order by transaction_date desc limit 2
    ),
    payroll_sum as (select sum(amount) as monthly_income, 2 as months from last_two_payrolls),
    electricity_12mo_avg as (
        select coalesce(avg(abs(amount)), 0) as elec_avg from expense_transactions
        where category = 'Electricity' and transaction_date >= (now() - interval '1 year')::date
    ),
    fixed_avg as (
        select sum(case when category = 'Electricity' then (select elec_avg from electricity_12mo_avg)
                        else avg_per_month end) as avg_fixed
        from vw_fixed_costs_summary
    ),
    last_complete_month as (select to_char((now() - interval '1 month')::date, 'YYYY-MM') as month),
    mta_amount as (
        select coalesce(sum(abs(amount)), 0) as mta_total from expense_transactions, last_complete_month
        where category = 'Transport' and expense_transactions.month = last_complete_month.month
    ),
    subscriptions_amount as (
        select coalesce(sum(abs(amount)), 0) as subs_total from expense_transactions, last_complete_month
        where category = 'Subscriptions' and expense_transactions.month = last_complete_month.month
    ),
    total_expenses as (
        select f.avg_fixed + m.mta_total + s.subs_total as total_exp
        from fixed_avg f, mta_amount m, subscriptions_amount s
    )
    select p.monthly_income::decimal(10,2), e.total_exp::decimal(10,2),
           (p.monthly_income - e.total_exp)::decimal(10,2) as net, p.months::int
    from payroll_sum p, total_expenses e;
end;
$function$;

create or replace function public.get_dashboard_stats()
 returns table(net_remaining numeric, discretionary_avg numeric, months_tracked integer)
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
    return query
    with net_calc as (select * from get_net_remaining()),
    disc_avg as (select sum(total) / count(distinct month) as avg_disc from vw_discretionary_summary),
    total_months as (select count(distinct month) as months from expense_transactions)
    select n.avg_net_remaining, d.avg_disc::decimal(10,2), m.months::int
    from net_calc n, disc_avg d, total_months m;
end;
$function$;


-- =============================================================================
-- Security: only the owner's signed in account can read or write anything
-- =============================================================================
-- Luna signs in with Supabase Auth (email code). The public "anon" key that is
-- built into the app gets no access at all. Backend workflows use the service
-- role key, which bypasses these rules.

do $$
declare t record;
declare owner text := lower(trim(current_setting('luna.owner_email', true)));
begin
  if owner is null or owner = 'you@example.com' then
    raise exception 'Change you@example.com at the top of the file to your own email, then run again.';
  end if;
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);
    execute format('drop policy if exists owner_only on public.%I', t.relname);
    execute format(
      'create policy owner_only on public.%I for all to authenticated
         using ((select auth.jwt() ->> ''email'') = %L)
         with check ((select auth.jwt() ->> ''email'') = %L)',
      t.relname, owner, owner);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

revoke execute on function public.dismiss_finance_alert(bigint, boolean) from anon, public;
revoke execute on function public.recategorize_transaction(bigint, text, text) from anon, public;
revoke execute on function public.get_dashboard_stats() from anon, public;
grant execute on function public.dismiss_finance_alert(bigint, boolean) to authenticated;
grant execute on function public.recategorize_transaction(bigint, text, text) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;


-- =============================================================================
-- Your unlock code (stored scrambled, never as the plain number)
-- =============================================================================
insert into public.app_config (key, value)
select 'app_pin_sha256', encode(digest('luna-pin:' || trim(current_setting('luna.unlock_code', true)), 'sha256'), 'hex')
on conflict (key) do update set value = excluded.value, updated_at = now();


-- =============================================================================
-- Starter category rules for Spanish bank descriptions
-- =============================================================================
-- Each rule: if a transaction's description contains the pattern, it gets that
-- category. Add your own in Table Editor > category_mapping, or in the app by
-- changing a transaction's category and ticking "Remember this".
insert into public.category_mapping (category, pattern, pattern_type, priority, notes) values
  ('Payroll','NOMINA','contains',10,'starter'),
  ('Bizum','BIZUM','contains',20,'starter'),
  ('Transfer','TRANSFERENCIA','contains',30,'starter'),
  ('Transfer','TRASPASO','contains',30,'starter'),
  ('ATM','CAJERO','contains',20,'starter'),
  ('ATM','REINTEGRO','contains',20,'starter'),
  ('Rent','ALQUILER','contains',20,'starter'),
  ('Community Fees','COMUNIDAD','contains',40,'starter'),
  ('Fees & Adjustments','COMISION','contains',40,'starter'),
  ('Food Delivery','UBER EATS','contains',15,'starter'),
  ('Food Delivery','GLOVO','contains',20,'starter'),
  ('Food Delivery','JUST EAT','contains',20,'starter'),
  ('Groceries','MERCADONA','contains',50,'starter'),
  ('Groceries','CARREFOUR','contains',50,'starter'),
  ('Groceries','LIDL','contains',50,'starter'),
  ('Groceries','ALDI','contains',50,'starter'),
  ('Groceries','ALCAMPO','contains',50,'starter'),
  ('Groceries','EROSKI','contains',50,'starter'),
  ('Groceries','CONSUM','contains',50,'starter'),
  ('Groceries','SUPERMERCADO','contains',60,'starter'),
  ('Transport','RENFE','contains',50,'starter'),
  ('Transport','METRO','contains',60,'starter'),
  ('Transport','CABIFY','contains',50,'starter'),
  ('Transport','UBER','contains',55,'starter'),
  ('Transport','BOLT','contains',50,'starter'),
  ('Transport','GASOLINERA','contains',50,'starter'),
  ('Transport','REPSOL','contains',55,'starter'),
  ('Transport','CEPSA','contains',50,'starter'),
  ('Subscriptions','NETFLIX','contains',50,'starter'),
  ('Subscriptions','SPOTIFY','contains',50,'starter'),
  ('Subscriptions','DISNEY','contains',50,'starter'),
  ('Subscriptions','HBO','contains',50,'starter'),
  ('Subscriptions','AMAZON PRIME','contains',45,'starter'),
  ('Subscriptions','APPLE.COM','contains',50,'starter'),
  ('Subscriptions','YOUTUBE','contains',50,'starter'),
  ('Subscriptions','WHOOP','contains',50,'starter'),
  ('Shopping','AMAZON','contains',60,'starter'),
  ('Shopping','ZARA','contains',60,'starter'),
  ('Shopping','EL CORTE INGLES','contains',60,'starter'),
  ('Electricity','IBERDROLA','contains',50,'starter'),
  ('Electricity','ENDESA','contains',50,'starter'),
  ('Electricity','NATURGY','contains',50,'starter'),
  ('Electricity','HOLALUZ','contains',50,'starter'),
  ('Water','CANAL DE ISABEL','contains',50,'starter'),
  ('Water','AGUAS DE','contains',50,'starter'),
  ('Internet / Phone','MOVISTAR','contains',50,'starter'),
  ('Internet / Phone','VODAFONE','contains',50,'starter'),
  ('Internet / Phone','ORANGE','contains',50,'starter'),
  ('Internet / Phone','DIGI SPAIN','contains',50,'starter'),
  ('Internet / Phone','MASMOVIL','contains',50,'starter'),
  ('Internet / Phone','JAZZTEL','contains',50,'starter'),
  ('Insurance','MAPFRE','contains',50,'starter'),
  ('Insurance','MUTUA','contains',50,'starter'),
  ('Insurance','SANITAS','contains',50,'starter'),
  ('Insurance','ADESLAS','contains',50,'starter'),
  ('Insurance','LINEA DIRECTA','contains',50,'starter'),
  ('Insurance','SEGURO','contains',70,'starter'),
  ('Gym','GIMNASIO','contains',50,'starter'),
  ('Gym','BASIC FIT','contains',50,'starter'),
  ('Gym','ANYTIME FITNESS','contains',50,'starter'),
  ('Restaurants','RESTAURANTE','contains',70,'starter'),
  ('Restaurants','BAR ','starts_with',70,'starter'),
  ('Restaurants','CAFETERIA','contains',70,'starter')
on conflict (pattern, pattern_type) do nothing;
