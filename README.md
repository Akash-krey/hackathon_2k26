# NEXUS — Urban Water–Energy Nexus Optimisation Framework

NEXUS is a responsive, interactive city-operations dashboard for water and energy monitoring, demand forecasting, pump-schedule optimisation, infrastructure mapping, sustainability analytics and report generation.

## Run locally

```sh
npm install
npm run dev
```

The app starts in **Simulation** mode and works without hardware or cloud credentials. Its synthetic Metrovale dataset is labelled as demonstration data. Alert acknowledgements persist in browser storage.

## Demo sign-in

The welcome screen includes two prototype-only accounts. Select an account there to fill the login form:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@nexus.demo` | `NexusAdmin2026!` |
| Standard user | `user@nexus.demo` | `NexusUser2026!` |

The demo administrator can reset demonstration data; the standard user cannot. These credentials and role checks run in the browser and are visible in the frontend bundle, so they are not secure and must never be used for production or sensitive data. Use Supabase Auth and server-enforced authorization for real accounts.

## Supabase (optional)

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using your project URL and public anon key. Never put a service-role key in the browser.
3. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor.
4. Create an email/password user in Supabase Auth and sign in from the welcome screen. You can also use one of the prototype demo accounts. Select **Connected** after adding non-simulated water, energy and renewable readings. Shared seed records are intentionally marked simulated and are not presented as live telemetry.

The schema includes profiles, zones, infrastructure, water and energy readings, reservoir levels, pump performance, forecasts, optimisation runs, alerts, and renewable generation. It enables Row Level Security and seeds fictional zones, assets and 30 days of simulated readings. Connected mode requires both water and energy readings marked `is_simulated = false`; those readings power the overview, water and energy trends. Other demo-only indicators remain labelled as simulated.

## Application modules

- Overview: network KPIs, resource trends, alerts and data-driven operational insights.
- Water and energy management: zone filters, infrastructure/pump tables and interactive charts.
- Demand forecasting: 7/15/30-day rolling-mean and trend baseline with an uncertainty band; this is explicitly not an ML model.
- Optimisation: a weighted search over feasible pump-concurrency schedules with supply, capacity, reservoir and reserve validation. It balances daily flow across selected operating hours and scores estimated part-load and concurrent-pump energy penalties; the default objective gives energy a 60% weight, with a one-click energy-priority preset. Energy-efficiency and pressure-related loss reduction values are modelled estimates, not measured savings, and should be calibrated with pump telemetry before operational use.
- Infrastructure map: Leaflet/OpenStreetMap map with selectable demonstration assets.
- Sustainability: emissions, renewable share, intensity metrics and calculation formulas.
- Reports: filtered CSV and PDF exports.

## Build

```sh
npm run build
```
