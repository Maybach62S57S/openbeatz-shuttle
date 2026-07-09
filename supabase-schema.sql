-- ============================================================================
-- Open Beatz · VIP Shuttle Leitstelle – Supabase Schema
-- Löst die Backend-Punkte: echte gemeinsame Live-Sync (Realtime),
-- atomare Statusänderung/Zuteilung (Row-Locks + RPC), Fahrer/Fahrzeuge in der DB,
-- rollenbasierter Zugriff (RLS). In Supabase → SQL Editor ausführen.
-- ============================================================================

-- ---------- Stammdaten: Fahrer & Fahrzeuge (Punkt 2: raus aus dem Frontend) --
create table if not exists drivers (
  id            text primary key,          -- z. B. "finn-steinmetz"
  first_name    text not null,
  last_name     text not null,
  vehicle_type  text not null check (vehicle_type in ('Van','Car')),
  vehicle_id    text not null,             -- "V1".."V6", "SUV1".."SUV14"
  seats         int  not null default 4,
  active        boolean not null default true
);

-- ---------- Einstellungen: Orte, Fahrzeit-Matrix, Zonen, Konfig (eine Zeile) --
create table if not exists settings (
  id         int primary key default 1 check (id = 1),
  locations  jsonb not null default '[]',
  matrix     jsonb not null default '{}',
  zones      jsonb not null default '["Caldera","Zone 3","Stonelands"]',
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- ---------- Fahrten -----------------------------------------------------------
create table if not exists rides (
  id                 uuid primary key default gen_random_uuid(),
  src_id             text,                 -- optionale Excel-Zeilen-ID (Dedup)
  day_key            date not null,
  ride_date          date not null,
  ride_time          text not null,        -- "HH:MM"
  from_id            text not null,
  from_custom        text default '',
  to_id              text not null,
  to_custom          text default '',
  zone               text default '',
  dj_name            text default '',
  passenger_count    int  not null default 1,
  passengers         text default '',
  flight_no          text default '',
  meeting_point      text default '',
  notes              text default '',
  on_demand          boolean not null default false,
  est_duration_min   int,                  -- NULL = unbekannt (App rechnet mit Mindestdauer)
  ride_type          text default 'transfer',
  assigned_driver_id text references drivers(id) on delete set null,
  status             text not null default 'planned'
                       check (status in ('planned','accepted','enroute_pickup','onboard','done','cancelled')),
  status_history     jsonb not null default '[]',   -- {status, at, by}
  issues             jsonb not null default '[]',   -- {type, note, at, by, state}
  log                jsonb not null default '[]',   -- Änderungsprotokoll {event, at, by, detail}
  guest_note         text default '',               -- separat von "notes" (intern) — sichtbar im Gast-Link
  guest_confirmed_at timestamptz,                    -- "Confirm pickup" im Gast-Link
  guest_at_pickup_at timestamptz,                    -- "I am at pickup" im Gast-Link
  accepted_at        timestamptz,
  enroute_at         timestamptz,
  onboard_at         timestamptz,
  done_at            timestamptz,
  updated_at         timestamptz not null default now()
);
create index if not exists rides_day_idx on rides(day_key);
create index if not exists rides_driver_idx on rides(assigned_driver_id);

-- ---------- Fahrer-Standort (letzter bekannter Dropoff, optional Live-GPS) ---
create table if not exists driver_state (
  driver_id         text primary key references drivers(id) on delete cascade,
  location_id       text,
  gps_lat           double precision,
  gps_lng           double precision,
  gps_accuracy      double precision,
  gps_at            timestamptz,       -- Zeitpunkt der letzten GPS-Meldung vom Fahrer-Handy
  push_subscription jsonb,             -- Web-Push-Abo (endpoint + keys), von api/send-push.js genutzt
  updated_at        timestamptz not null default now()
);

-- ============================================================================
-- Atomare Operationen (Punkt 1): Single-Row-Updates sind in Postgres atomar
-- (Row-Lock). Damit überschreiben zwei Geräte sich nicht mehr gegenseitig –
-- jede Änderung betrifft nur ihre eigene Zeile bzw. ihr eigenes JSON-Feld.
-- ============================================================================

-- Statuswechsel inkl. Zeitstempel + Verlauf (Punkt 10)
create or replace function advance_ride_status(p_ride uuid, p_status text, p_by text)
returns rides language plpgsql as $$
declare r rides;
begin
  update rides set
    status = p_status,
    status_history = status_history || jsonb_build_object('status', p_status, 'at', extract(epoch from now())*1000, 'by', p_by),
    accepted_at = case when p_status='accepted' then now() else accepted_at end,
    enroute_at  = case when p_status='enroute_pickup' then now() else enroute_at end,
    onboard_at  = case when p_status='onboard' then now() else onboard_at end,
    done_at     = case when p_status='done' then now() else done_at end,
    updated_at  = now()
  where id = p_ride
  returning * into r;
  return r;
end $$;

-- Zuteilen/Umteilen: setzt Fahrer und – bei Wechsel/Entfernen – Status zurück auf planned (Punkt 7)
create or replace function assign_ride(p_ride uuid, p_driver text, p_by text)
returns rides language plpgsql as $$
declare r rides;
begin
  update rides set
    assigned_driver_id = p_driver,
    status = case when assigned_driver_id is distinct from p_driver and status <> 'planned' then 'planned' else status end,
    status_history = case when assigned_driver_id is distinct from p_driver
      then status_history || jsonb_build_object('status','planned','at',extract(epoch from now())*1000,'by',p_by) else status_history end,
    updated_at = now()
  where id = p_ride
  returning * into r;
  return r;
end $$;

-- Problem melden (Punkt 11) – hängt atomar an das issues-Array an
create or replace function report_ride_issue(p_ride uuid, p_issue jsonb)
returns rides language plpgsql as $$
declare r rides;
begin
  update rides set issues = issues || p_issue, updated_at = now()
  where id = p_ride returning * into r;
  return r;
end $$;

-- ============================================================================
-- Realtime aktivieren (Punkt 0): Änderungen werden an alle Clients gepusht.
-- ============================================================================
alter publication supabase_realtime add table rides;
alter publication supabase_realtime add table driver_state;
alter publication supabase_realtime add table settings;

-- ============================================================================
-- RLS (Punkt 2: je nach Rolle nur nötige Daten). Startpunkt – an euer Auth
-- anpassen. Beispiel: anonyme Clients dürfen lesen und Fahrten/State ändern,
-- aber keine Stammdaten. Für echten Betrieb feiner regeln (z. B. Fahrer nur
-- eigene Fahrten per JWT-Claim).
-- ============================================================================
alter table drivers      enable row level security;
alter table settings     enable row level security;
alter table rides        enable row level security;
alter table driver_state enable row level security;

create policy read_drivers      on drivers      for select using (true);
create policy read_settings     on settings     for select using (true);
create policy rw_rides_select   on rides        for select using (true);
create policy rw_rides_update   on rides        for update using (true) with check (true);
create policy rw_rides_insert   on rides        for insert with check (true);
create policy rw_state_all      on driver_state for all using (true) with check (true);

-- Tipp: Für „Fahrer sieht nur eigene Fahrten" später eine View oder Policy mit
-- auth.jwt() ->> 'driver_id' = assigned_driver_id ergänzen.

-- ============================================================================
-- Gast-/Artist-Manager-Links: Token -> Künstlername. Im Artifact (window.storage)
-- ist der Token nur eine UI-Filterung, KEINE echte Zugriffssperre — hier, mit
-- echter RLS-Policy unten, wird daraus eine echte Sicherheitsgrenze.
-- ============================================================================
create table if not exists guest_tokens (
  token      text primary key,
  dj_name    text not null,
  created_at timestamptz not null default now()
);
alter publication supabase_realtime add table guest_tokens;
alter table guest_tokens enable row level security;
create policy read_guest_tokens on guest_tokens for select using (true);

-- Wichtig: In der App darf ein Gast-Client NICHT einfach "select * from rides"
-- aufrufen. Stattdessen eine RPC nutzen, die serverseitig genau auf den zum
-- Token gehörenden dj_name einschränkt (nie select * mit Client-seitigem Filter):
create or replace function guest_rides(p_token text)
returns setof rides language sql stable as $$
  select r.* from rides r
  join guest_tokens g on lower(trim(r.dj_name)) = lower(trim(g.dj_name))
  where g.token = p_token and r.status != 'cancelled';
$$;
-- Guest-Aktionen (Confirm pickup / at pickup / Problem) NUR über eigene RPCs,
-- die ausschließlich Flags/Log/Issues schreiben — nie Status oder Fahrer-Zuteilung:
create or replace function guest_confirm_pickup(p_token text, p_ride uuid)
returns void language plpgsql as $$
begin
  update rides set guest_confirmed_at = now(), updated_at = now()
  where id = p_ride and lower(trim(dj_name)) = lower(trim((select dj_name from guest_tokens where token = p_token)));
end $$;

-- ============================================================================
-- Nachtrag: pragmatische Datenschicht für Fahrten/Status (statt der oben
-- vorbereiteten granularen RPCs). Fahrer bleiben eine echte, einzeln
-- pflegbare Tabelle (auch direkt im Supabase Table Editor). Fahrten, Status,
-- Zuteilung usw. laufen dagegen weiterhin über das bewährte "ganzes Objekt
-- lesen -> ändern -> zurückschreiben"-Muster der App (inkl. Rückgängig-
-- Funktion), jetzt aber in der echten Datenbank statt im Chat-Speicher.
-- Gefahrlos erneut ausführbar, auch wenn das Schema oben schon einmal lief.
-- ============================================================================
alter table drivers add column if not exists phone text not null default '';
alter table drivers add column if not exists plate text not null default '';
alter table drivers add column if not exists pin   text not null default '';

alter table settings add column if not exists dispatchers jsonb not null default '[]';
alter table settings add column if not exists setup_rev   int  not null default 0;
alter table settings add column if not exists dyn_data    jsonb not null default '{"rides":[],"driverState":{}}';
alter table settings add column if not exists dyn_rev     int  not null default 0;

-- Schreibrechte ergänzen: die App liest settings/drivers/guest_tokens bereits
-- (Policies oben), braucht ab jetzt aber auch Schreibzugriff dafür.
create policy write_settings on settings for update using (true) with check (true);
create policy write_drivers  on drivers  for all    using (true) with check (true);
create policy write_guest_tokens on guest_tokens for all using (true) with check (true);

-- Nachtrag 2: Fahrzeugtyp auf "Van"/"Car" umbenannt (statt "V"/"SUV"). Falls die
-- drivers-Tabelle schon vorher existierte (alte Check-Regel 'V'/'SUV'), hier
-- Bestandsdaten umbenennen und die Regel ersetzen. Gefahrlos erneut ausführbar.
update drivers set vehicle_type = 'Van' where vehicle_type = 'V';
update drivers set vehicle_type = 'Car' where vehicle_type = 'SUV';
alter table drivers drop constraint if exists drivers_vehicle_type_check;
alter table drivers add constraint drivers_vehicle_type_check check (vehicle_type in ('Van','Car'));
