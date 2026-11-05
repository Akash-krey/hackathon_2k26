create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.urban_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  population integer not null default 0 check (population >= 0),
  demand_ml numeric(12, 3) not null default 0 check (demand_ml >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.infrastructure (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  zone_id uuid references public.urban_zones (id) on delete set null,
  name text not null,
  type text not null check (type in ('treatment_plant', 'reservoir', 'pumping_station', 'solar_installation', 'distribution_zone')),
  status text not null default 'online' check (status in ('online', 'maintenance', 'offline')),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.water_consumption (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.urban_zones (id) on delete cascade,
  infrastructure_id uuid references public.infrastructure (id) on delete set null,
  recorded_at timestamptz not null,
  supplied_ml numeric(12, 3) not null check (supplied_ml >= 0),
  consumed_ml numeric(12, 3) not null check (consumed_ml >= 0 and consumed_ml <= supplied_ml),
  is_simulated boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (zone_id, recorded_at)
);

create table if not exists public.energy_consumption (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.urban_zones (id) on delete cascade,
  infrastructure_id uuid references public.infrastructure (id) on delete set null,
  recorded_at timestamptz not null,
  pumping_mwh numeric(12, 3) not null default 0 check (pumping_mwh >= 0),
  treatment_mwh numeric(12, 3) not null default 0 check (treatment_mwh >= 0),
  distribution_mwh numeric(12, 3) not null default 0 check (distribution_mwh >= 0),
  cost_usd numeric(12, 2) not null default 0 check (cost_usd >= 0),
  is_simulated boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (zone_id, recorded_at)
);

create table if not exists public.reservoir_levels (
  id uuid primary key default gen_random_uuid(),
  infrastructure_id uuid not null references public.infrastructure (id) on delete cascade,
  recorded_at timestamptz not null,
  storage_ml numeric(12, 3) not null check (storage_ml >= 0),
  capacity_ml numeric(12, 3) not null check (capacity_ml > 0 and storage_ml <= capacity_ml),
  is_simulated boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pump_performance (
  id uuid primary key default gen_random_uuid(),
  infrastructure_id uuid not null references public.infrastructure (id) on delete cascade,
  recorded_at timestamptz not null,
  operating_hours numeric(8, 2) not null default 0 check (operating_hours between 0 and 24),
  energy_mwh numeric(12, 3) not null default 0 check (energy_mwh >= 0),
  efficiency_percent numeric(5, 2) not null check (efficiency_percent between 0 and 100),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.demand_forecasts (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.urban_zones (id) on delete cascade,
  forecast_type text not null check (forecast_type in ('water', 'energy')),
  generated_at timestamptz not null default now(),
  target_at timestamptz not null,
  predicted_value numeric(12, 3) not null check (predicted_value >= 0),
  lower_bound numeric(12, 3) not null check (lower_bound >= 0),
  upper_bound numeric(12, 3) not null check (upper_bound >= lower_bound),
  model_version text not null default 'baseline-v1',
  is_simulated boolean not null default true,
  user_id uuid references auth.users (id) on delete cascade
);

create table if not exists public.optimisation_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  inputs jsonb not null,
  result jsonb not null,
  feasible boolean not null,
  user_id uuid references auth.users (id) on delete cascade
);

create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references public.urban_zones (id) on delete set null,
  infrastructure_id uuid references public.infrastructure (id) on delete set null,
  title text not null,
  description text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.renewable_energy (
  id uuid primary key default gen_random_uuid(),
  infrastructure_id uuid references public.infrastructure (id) on delete set null,
  zone_id uuid references public.urban_zones (id) on delete set null,
  recorded_at timestamptz not null,
  source text not null check (source in ('solar', 'wind', 'other')),
  generation_mwh numeric(12, 3) not null check (generation_mwh >= 0),
  is_simulated boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists water_consumption_zone_time_idx on public.water_consumption (zone_id, recorded_at desc);
create index if not exists energy_consumption_zone_time_idx on public.energy_consumption (zone_id, recorded_at desc);
create index if not exists reservoir_levels_asset_time_idx on public.reservoir_levels (infrastructure_id, recorded_at desc);
create index if not exists pump_performance_asset_time_idx on public.pump_performance (infrastructure_id, recorded_at desc);
create index if not exists forecasts_zone_target_idx on public.demand_forecasts (zone_id, target_at);
create index if not exists optimisation_runs_user_time_idx on public.optimisation_runs (user_id, created_at desc);
create index if not exists alerts_status_time_idx on public.system_alerts (status, occurred_at desc);
create index if not exists renewable_zone_time_idx on public.renewable_energy (zone_id, recorded_at desc);
create index if not exists infrastructure_zone_idx on public.infrastructure (zone_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.urban_zones enable row level security;
alter table public.infrastructure enable row level security;
alter table public.water_consumption enable row level security;
alter table public.energy_consumption enable row level security;
alter table public.reservoir_levels enable row level security;
alter table public.pump_performance enable row level security;
alter table public.demand_forecasts enable row level security;
alter table public.optimisation_runs enable row level security;
alter table public.system_alerts enable row level security;
alter table public.renewable_energy enable row level security;

create policy "Users can view their own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Authenticated users can read zones" on public.urban_zones for select to authenticated using (true);

create policy "Users can read shared or owned infrastructure" on public.infrastructure for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their infrastructure" on public.infrastructure for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read shared or owned water data" on public.water_consumption for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their water data" on public.water_consumption for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned energy data" on public.energy_consumption for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their energy data" on public.energy_consumption for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read shared or owned reservoir data" on public.reservoir_levels for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their reservoir data" on public.reservoir_levels for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned pump data" on public.pump_performance for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their pump data" on public.pump_performance for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned forecasts" on public.demand_forecasts for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their forecasts" on public.demand_forecasts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned optimisation runs" on public.optimisation_runs for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their optimisation runs" on public.optimisation_runs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned alerts" on public.system_alerts for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their alerts" on public.system_alerts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read shared or owned renewable data" on public.renewable_energy for select to authenticated using (user_id is null or auth.uid() = user_id);
create policy "Users can manage their renewable data" on public.renewable_energy for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.urban_zones (id, name, population, demand_ml) values
  ('00000000-0000-4000-8000-000000000001', 'Northbank', 182000, 68),
  ('00000000-0000-4000-8000-000000000002', 'Riverside', 146000, 54),
  ('00000000-0000-4000-8000-000000000003', 'Midtown', 208000, 62),
  ('00000000-0000-4000-8000-000000000004', 'Southpoint', 119000, 44)
on conflict (id) do nothing;

insert into public.infrastructure (asset_code, zone_id, name, type, status, latitude, longitude) values
  ('WTP-001', '00000000-0000-4000-8000-000000000001', 'East River Treatment Works', 'treatment_plant', 'online', 40.748000, -73.965000),
  ('RES-014', '00000000-0000-4000-8000-000000000001', 'Northbank Reservoir', 'reservoir', 'online', 40.768000, -73.974000),
  ('PMP-104', '00000000-0000-4000-8000-000000000002', 'Riverside Lift Station', 'pumping_station', 'online', 40.735000, -73.999000),
  ('SOL-003', '00000000-0000-4000-8000-000000000002', 'Harbor Solar Array', 'solar_installation', 'online', 40.712000, -74.008000),
  ('DST-022', '00000000-0000-4000-8000-000000000003', 'Midtown Distribution Hub', 'distribution_zone', 'online', 40.754000, -73.985000),
  ('PMP-217', '00000000-0000-4000-8000-000000000003', 'Canal Street Booster', 'pumping_station', 'maintenance', 40.721000, -73.991000),
  ('RES-009', '00000000-0000-4000-8000-000000000004', 'Southpoint Storage', 'reservoir', 'online', 40.704000, -73.988000),
  ('WTP-002', '00000000-0000-4000-8000-000000000003', 'West Canal Purification Plant', 'treatment_plant', 'online', 40.741000, -74.016000)
on conflict (asset_code) do nothing;

insert into public.water_consumption (zone_id, recorded_at, supplied_ml, consumed_ml, is_simulated)
select zone.id, current_date - series.day_offset,
  round((zone.demand_ml / 0.914 * (1 + sin(series.day_offset * 0.58) * 0.018))::numeric, 3),
  round((zone.demand_ml * (1 + sin(series.day_offset * 0.58) * 0.018))::numeric, 3),
  true
from public.urban_zones as zone
cross join generate_series(0, 29) as series(day_offset)
on conflict (zone_id, recorded_at) do nothing;

insert into public.energy_consumption (zone_id, recorded_at, pumping_mwh, treatment_mwh, distribution_mwh, cost_usd, is_simulated)
select zone.id, current_date - series.day_offset,
  round((zone.demand_ml * 0.226 * (1 + sin(series.day_offset * 0.49) * 0.035))::numeric, 3),
  round((zone.demand_ml * 0.119 * (1 + sin(series.day_offset * 0.49) * 0.025))::numeric, 3),
  round((zone.demand_ml * 0.066 * (1 + sin(series.day_offset * 0.49) * 0.02))::numeric, 3),
  round((zone.demand_ml * 0.411 * 1000 * 0.16)::numeric, 2),
  true
from public.urban_zones as zone
cross join generate_series(0, 29) as series(day_offset)
on conflict (zone_id, recorded_at) do nothing;
