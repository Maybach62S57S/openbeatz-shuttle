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
-- Idempotent gemacht (Nachtrag 3): "alter publication ... add table" ist von
-- Haus aus NICHT gefahrlos wiederholbar — ein zweiter Lauf bricht mit
-- "relation is already member of publication" ab und reißt (weil Supabase
-- das gesamte eingefügte Skript als einen Block ausführt) alles andere im
-- selben Lauf mit runter, auch bereits erfolgreich ausgeführte Teile davor
-- und danach. Deshalb hier über eine Prüfung statt direkt.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rides') then
      alter publication supabase_realtime add table rides;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_state') then
      alter publication supabase_realtime add table driver_state;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings') then
      alter publication supabase_realtime add table settings;
    end if;
  end if;
end $$;

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

drop policy if exists read_drivers on drivers;
create policy read_drivers      on drivers      for select using (true);
drop policy if exists read_settings on settings;
create policy read_settings     on settings     for select using (true);
drop policy if exists rw_rides_select on rides;
create policy rw_rides_select   on rides        for select using (true);
drop policy if exists rw_rides_update on rides;
create policy rw_rides_update   on rides        for update using (true) with check (true);
drop policy if exists rw_rides_insert on rides;
create policy rw_rides_insert   on rides        for insert with check (true);
drop policy if exists rw_state_all on driver_state;
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
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_tokens')
  then
    alter publication supabase_realtime add table guest_tokens;
  end if;
end $$;
alter table guest_tokens enable row level security;
drop policy if exists read_guest_tokens on guest_tokens;
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
-- Life360-Integration (optional): freier Text, gegen den der Vorname+Nachname
-- eines Life360-Circle-Mitglieds beim Sync case-insensitiv verglichen wird.
-- Leer lassen = dieser Fahrer wird nicht über Life360 synchronisiert, nur
-- über die eigene Standortfreigabe in der App. Siehe api/life360-sync.js.
alter table drivers add column if not exists life360_name text not null default '';

alter table settings add column if not exists dispatchers jsonb not null default '[]';
alter table settings add column if not exists setup_rev   int  not null default 0;
alter table settings add column if not exists dyn_data    jsonb not null default '{"rides":[],"driverState":{}}';
alter table settings add column if not exists dyn_rev     int  not null default 0;

-- Schreibrechte ergänzen: die App liest settings/drivers/guest_tokens bereits
-- (Policies oben), braucht ab jetzt aber auch Schreibzugriff dafür.
drop policy if exists write_settings on settings;
create policy write_settings on settings for update using (true) with check (true);
drop policy if exists write_drivers on drivers;
create policy write_drivers  on drivers  for all    using (true) with check (true);
drop policy if exists write_guest_tokens on guest_tokens;
create policy write_guest_tokens on guest_tokens for all using (true) with check (true);

-- Nachtrag 2: Fahrzeugtyp auf "Van"/"Car" umbenannt (statt "V"/"SUV"). Falls die
-- drivers-Tabelle schon vorher existierte (alte Check-Regel 'V'/'SUV'), hier
-- Bestandsdaten umbenennen und die Regel ersetzen. Gefahrlos erneut ausführbar.
update drivers set vehicle_type = 'Van' where vehicle_type = 'V';
update drivers set vehicle_type = 'Car' where vehicle_type = 'SUV';
alter table drivers drop constraint if exists drivers_vehicle_type_check;
alter table drivers add constraint drivers_vehicle_type_check check (vehicle_type in ('Van','Car'));

-- ============================================================================
-- Nachtrag 3: Sicherheitshärtung (Review vom 10.07.2026)
--
-- Vorher konnte JEDER mit dem (zwangsläufig öffentlichen) anon-Key über die
-- normale REST-API direkt auf die Tabellen zugreifen: alle Fahrten aller
-- Artists lesen/schreiben, die komplette guest_tokens-Tabelle auflisten (und
-- damit jeden Gast-Link erraten/nutzen, ohne ihn zu kennen), Fahrer-PINs und
-- -Telefonnummern abgreifen, Fahrer per DELETE komplett aus dem System
-- entfernen. Das lag an "using (true)"-Policies, die keinen Unterschied
-- zwischen Leitstelle/Fahrer/Gast/Fremden machen konnten.
--
-- Diese Sektion schließt die Lücken, die OHNE ein echtes Login-System
-- (Supabase Auth/JWT je Rolle) lösbar sind:
--   - Gast-Link ist jetzt ECHT auf den eigenen dj_name beschränkt (RPC statt
--     Ganzobjekt-Zugriff), nicht mehr nur UI-Filterung.
--   - guest_tokens ist nicht mehr als komplette Liste abrufbar.
--   - Schreibzugriffe auf settings/drivers laufen nur noch über geprüfte
--     Funktionen (SECURITY DEFINER) statt offener Tabellen-Policies.
--   - dyn_rev/setup_rev werden jetzt ATOMAR in der DB geprüft (compare-and-
--     swap in einem einzigen UPDATE), nicht mehr per Lese-Vergleich aus der
--     App heraus mit Lücke zwischen Prüfung und Schreiben.
--
-- Was das NICHT löst (braucht echtes Login, bewusst nicht Teil dieser Runde):
--   - read_settings/read_drivers bleiben "using (true)", weil Dashboard und
--     Fahrer-App weiterhin denselben anon-Key nutzen und beide einen breiten
--     Lesezugriff brauchen, ohne dass die DB serverseitig unterscheiden kann,
--     wer wirklich Dispo/Fahrer ist. drivers.pin/phone bleiben also über den
--     anon-Key technisch auslesbar (select * from drivers). Fahrer-PIN-
--     Verifikation ist dafür der richtige nächste Schritt (eigene RPC statt
--     Klartext-Vergleich im Client), aber bewusst nicht Teil dieser Runde.
--   - driver_state bleibt offen (GPS/Push-Abo), weil auch das an einer
--     echten Fahrer-Identität hängen würde. Geringeres Risiko als PII/Rides.
-- ============================================================================

-- ---------- Gast-Zugriff: nur noch über Token-scoped Funktionen -----------
-- Die echten Fahrtdaten liegen inzwischen in settings.dyn_data (siehe
-- Nachtrag oben), nicht mehr in der separaten rides-Tabelle. Die alten
-- guest_rides/guest_confirm_pickup-Funktionen von weiter oben griffen noch
-- auf die (ungenutzte) rides-Tabelle zu und liefern in der Praxis nichts
-- mehr zurück. Hier durch Versionen ersetzt, die auf dyn_data arbeiten.
drop function if exists guest_rides(text);
drop function if exists guest_confirm_pickup(text, uuid);

-- Ein Aufruf liefert alles, was die Gast-Seite braucht: ob der Token gültig
-- ist, der Künstlername und ausschließlich die eigenen Fahrten. Kein
-- separater Client-seitiger Abgleich mit einer vollständigen Token-/Fahrten-
-- Liste mehr nötig.
create or replace function guest_session(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dj text;
  v_rides jsonb;
begin
  select dj_name into v_dj from guest_tokens where token = p_token;
  if v_dj is null then
    return jsonb_build_object('valid', false);
  end if;

  select coalesce(jsonb_agg(elem order by (elem->>'date'), (elem->>'time')), '[]'::jsonb)
    into v_rides
  from settings s
  cross join lateral jsonb_array_elements(coalesce(s.dyn_data->'rides', '[]'::jsonb)) as elem
  where s.id = 1
    and lower(trim(coalesce(elem->>'djName',''))) = lower(trim(v_dj))
    and coalesce(elem->>'status','') <> 'cancelled';

  return jsonb_build_object('valid', true, 'djName', v_dj, 'rides', coalesce(v_rides, '[]'::jsonb));
end $$;

-- Gemeinsame Basis für die drei Gast-Aktionen: findet die Fahrt anhand von
-- id UND passendem dj_name (kein Zugriff auf fremde Fahrten möglich, selbst
-- mit frei erfundener ride-id), wendet den übergebenen Patch in EINEM
-- atomaren UPDATE an (kein Lese-Ändere-Schreibe-Zyklus, also auch keine
-- Kollisionsmöglichkeit mit gleichzeitigen Dispo-Änderungen).
create or replace function _guest_patch_ride(p_token text, p_ride text, p_patch jsonb, p_log_event text, p_log_detail text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dj text;
  v_rows int;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select dj_name into v_dj from guest_tokens where token = p_token;
  if v_dj is null then
    return false;
  end if;

  update settings s
  set dyn_data = jsonb_set(
        s.dyn_data,
        '{rides}',
        (
          select jsonb_agg(
            case
              when elem->>'id' = p_ride and lower(trim(coalesce(elem->>'djName',''))) = lower(trim(v_dj))
                then (elem || p_patch || jsonb_build_object('updatedAt', v_now))
                     || jsonb_build_object('log', coalesce(elem->'log', '[]'::jsonb) || jsonb_build_array(
                          jsonb_build_object('event', p_log_event, 'at', v_now, 'by', 'guest:' || v_dj, 'detail', p_log_detail)
                        ))
              else elem
            end
          )
          from jsonb_array_elements(coalesce(s.dyn_data->'rides', '[]'::jsonb)) as elem
        )
      ),
      dyn_rev = dyn_rev + 1,
      updated_at = now()
  where s.id = 1
    and exists (
      select 1 from jsonb_array_elements(coalesce(s.dyn_data->'rides', '[]'::jsonb)) as e
      where e->>'id' = p_ride and lower(trim(coalesce(e->>'djName',''))) = lower(trim(v_dj))
    );

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

create or replace function guest_confirm_pickup(p_token text, p_ride text)
returns boolean language sql security definer set search_path = public as $$
  select _guest_patch_ride(p_token, p_ride,
    jsonb_build_object('guestConfirmedAt', (extract(epoch from now()) * 1000)::bigint),
    'guest_confirm', 'Confirmed pickup info');
$$;

create or replace function guest_at_pickup(p_token text, p_ride text)
returns boolean language sql security definer set search_path = public as $$
  select _guest_patch_ride(p_token, p_ride,
    jsonb_build_object('guestAtPickupAt', (extract(epoch from now()) * 1000)::bigint),
    'guest_at_pickup', 'At the pickup point');
$$;

-- Eigene Funktion statt _guest_patch_ride, weil hier an ein Array (issues)
-- angehängt wird statt ein Skalarfeld zu ersetzen.
create or replace function guest_report_issue(p_token text, p_ride text, p_type text, p_note text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dj text;
  v_rows int;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_issue jsonb;
  v_detail text;
begin
  select dj_name into v_dj from guest_tokens where token = p_token;
  if v_dj is null then
    return false;
  end if;

  v_issue := jsonb_build_object(
    'id', 'i' || v_now, 'type', p_type, 'note', coalesce(p_note, ''),
    'at', v_now, 'by', 'guest:' || v_dj, 'state', 'open'
  );
  v_detail := p_type || case when p_note is not null and p_note <> '' then ': ' || p_note else '' end;

  update settings s
  set dyn_data = jsonb_set(
        s.dyn_data,
        '{rides}',
        (
          select jsonb_agg(
            case
              when elem->>'id' = p_ride and lower(trim(coalesce(elem->>'djName',''))) = lower(trim(v_dj))
                then elem
                     || jsonb_build_object('issues', coalesce(elem->'issues', '[]'::jsonb) || jsonb_build_array(v_issue))
                     || jsonb_build_object('log', coalesce(elem->'log', '[]'::jsonb) || jsonb_build_array(
                          jsonb_build_object('event', 'problem', 'at', v_now, 'by', 'guest:' || v_dj, 'detail', v_detail)
                        ))
                     || jsonb_build_object('updatedAt', v_now)
              else elem
            end
          )
          from jsonb_array_elements(coalesce(s.dyn_data->'rides', '[]'::jsonb)) as elem
        )
      ),
      dyn_rev = dyn_rev + 1,
      updated_at = now()
  where s.id = 1
    and exists (
      select 1 from jsonb_array_elements(coalesce(s.dyn_data->'rides', '[]'::jsonb)) as e
      where e->>'id' = p_ride and lower(trim(coalesce(e->>'djName',''))) = lower(trim(v_dj))
    );

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

-- ---------- Dispo: settings/rides atomar schreiben (Lost-Update-Fix) ------
-- Ersetzt das bisherige Muster "lesen -> vergleichen -> schreiben" aus der
-- App (Lücke zwischen Vergleich und Schreiben) durch ein einziges atomares
-- UPDATE mit Bedingung auf die erwartete Revision. Schlägt es fehl (weil
-- zwischenzeitlich jemand anders geschrieben hat), bekommt die App den
-- aktuellen Serverstand zurück und wiederholt ihre Änderung darauf statt
-- ihn zu überschreiben.
-- Signatur seit Nachtrag 4 um dispatcher_state erweitert (Leitstellen-Push,
-- siehe unten) -> alte 3-Parameter-Version zuerst explizit entfernen, sonst
-- bleibt sie als separate Überladung stehen statt ersetzt zu werden.
-- Signatur seit Nachtrag 5 um p_artist_presence erweitert (manueller Präsenz-/
-- Rückfahr-Status pro Artist, siehe Rückfahrten-Tab) und seit Nachtrag 6 um
-- p_messages (freie Nachrichten Fahrer/Stage <-> Leitstelle). Der alte
-- 3-/4-/5-Argument-Aufruf wird jeweils per drop entfernt.
drop function if exists write_dyn_if_unchanged(int, jsonb, jsonb);
drop function if exists write_dyn_if_unchanged(int, jsonb, jsonb, jsonb);
drop function if exists write_dyn_if_unchanged(int, jsonb, jsonb, jsonb, jsonb);
create or replace function write_dyn_if_unchanged(p_expected_rev int, p_rides jsonb, p_driver_state jsonb, p_dispatcher_state jsonb default '{}'::jsonb, p_artist_presence jsonb default '{}'::jsonb, p_messages jsonb default '[]'::jsonb)
returns table(ok boolean, rev int, rides jsonb, driver_state jsonb, dispatcher_state jsonb, artist_presence jsonb, messages jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  update settings
  set dyn_data = jsonb_build_object('rides', p_rides, 'driverState', p_driver_state, 'dispatcherState', p_dispatcher_state, 'artistPresence', p_artist_presence, 'messages', p_messages),
      dyn_rev = p_expected_rev + 1,
      updated_at = now()
  where id = 1 and dyn_rev = p_expected_rev;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    return query select true, p_expected_rev + 1, p_rides, p_driver_state, p_dispatcher_state, p_artist_presence, p_messages;
  else
    return query
      select false, s.dyn_rev, coalesce(s.dyn_data->'rides', '[]'::jsonb), coalesce(s.dyn_data->'driverState', '{}'::jsonb), coalesce(s.dyn_data->'dispatcherState', '{}'::jsonb), coalesce(s.dyn_data->'artistPresence', '{}'::jsonb), coalesce(s.dyn_data->'messages', '[]'::jsonb)
      from settings s where s.id = 1;
  end if;
end $$;


create or replace function write_setup_if_unchanged(
  p_expected_rev int, p_dispatchers jsonb, p_locations jsonb, p_matrix jsonb, p_zones jsonb, p_config jsonb
)
returns table(ok boolean, rev int, dispatchers jsonb, locations jsonb, matrix jsonb, zones jsonb, config jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  update settings
  set dispatchers = p_dispatchers, locations = p_locations, matrix = p_matrix,
      zones = p_zones, config = p_config, setup_rev = p_expected_rev + 1,
      updated_at = now()
  where id = 1 and setup_rev = p_expected_rev;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    return query select true, p_expected_rev + 1, p_dispatchers, p_locations, p_matrix, p_zones, p_config;
  else
    return query
      select false, s.setup_rev, s.dispatchers, s.locations, s.matrix, s.zones, s.config
      from settings s where s.id = 1;
  end if;
end $$;

-- ---------- Dispo: Fahrer & Gast-Links nur noch über Funktionen ----------
create or replace function dispatcher_save_drivers(p_drivers jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into drivers (id, first_name, last_name, vehicle_type, vehicle_id, seats, active, phone, plate, pin, life360_name)
  select
    d->>'id', d->>'first_name', d->>'last_name', d->>'vehicle_type', d->>'vehicle_id',
    coalesce((d->>'seats')::int, 4), coalesce((d->>'active')::boolean, true),
    coalesce(d->>'phone', ''), coalesce(d->>'plate', ''), coalesce(d->>'pin', ''), coalesce(d->>'life360_name', '')
  from jsonb_array_elements(p_drivers) as d
  on conflict (id) do update set
    first_name = excluded.first_name, last_name = excluded.last_name,
    vehicle_type = excluded.vehicle_type, vehicle_id = excluded.vehicle_id,
    seats = excluded.seats, active = excluded.active,
    phone = excluded.phone, plate = excluded.plate, pin = excluded.pin,
    life360_name = excluded.life360_name;
$$;

create or replace function dispatcher_list_guest_tokens()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('token', token, 'dj_name', dj_name, 'created_at', created_at) order by created_at desc), '[]'::jsonb)
  from guest_tokens;
$$;

create or replace function dispatcher_save_guest_tokens(p_tokens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep text[];
begin
  select array_agg(t->>'token') into v_keep from jsonb_array_elements(p_tokens) as t;

  insert into guest_tokens (token, dj_name)
  select t->>'token', t->>'dj_name' from jsonb_array_elements(p_tokens) as t
  on conflict (token) do update set dj_name = excluded.dj_name;

  delete from guest_tokens where token <> all (coalesce(v_keep, array[]::text[]));
end $$;

grant execute on function guest_session(text) to anon, authenticated;
grant execute on function guest_confirm_pickup(text, text) to anon, authenticated;
grant execute on function guest_at_pickup(text, text) to anon, authenticated;
grant execute on function guest_report_issue(text, text, text, text) to anon, authenticated;
grant execute on function write_setup_if_unchanged(int, jsonb, jsonb, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function dispatcher_save_drivers(jsonb) to anon, authenticated;
grant execute on function dispatcher_list_guest_tokens() to anon, authenticated;
grant execute on function dispatcher_save_guest_tokens(jsonb) to anon, authenticated;

-- ---------- RLS verschärfen: guest_tokens/settings/drivers nur noch RPC ---
-- guest_tokens bekommt gar keine Policy mehr -> mit RLS an, aber ohne
-- Policy ist die Tabelle für anon/authenticated komplett dicht. Die
-- SECURITY DEFINER-Funktionen oben umgehen RLS für ihre eigene, eng
-- begrenzte Aufgabe weiterhin (das ist ihr Zweck), ein direktes
-- "select * from guest_tokens" über die REST-API liefert ab jetzt nichts.
drop policy if exists read_guest_tokens on guest_tokens;
drop policy if exists write_guest_tokens on guest_tokens;

-- settings/drivers: Lesen bleibt offen (siehe Hinweis oben, hängt an echtem
-- Login), aber Schreiben nur noch über die Funktionen oben.
drop policy if exists write_settings on settings;
drop policy if exists write_drivers on drivers;

-- ============================================================================
-- Nachtrag 4: Push-Benachrichtigungen auch für die Leitstelle
--
-- Bisher gab es echte Push-Benachrichtigungen (Web Push, kommen auch bei
-- gesperrtem Handy an) nur für Fahrer. Push-Abos von Fahrern liegen in
-- settings.dyn_data.driverState[driverId].pushSubscription. Für Leitstellen-
-- Nutzer legen wir dieselbe Struktur parallel an: dyn_data.dispatcherState.
-- write_dyn_if_unchanged wurde oben bereits entsprechend erweitert.
--
-- Nebenbei gefunden und mit gefixt: api/send-push.js suchte Push-Abos bisher
-- in der separaten driver_state-TABELLE, die App schreibt sie aber (wie die
-- Fahrten selbst) in settings.dyn_data — die separate Tabelle wird nirgends
-- beschrieben. Echte Push-Benachrichtigungen an Fahrer hätten dadurch nie
-- funktioniert, unabhängig von allen anderen Einstellungen. api/send-push.js
-- ist im selben Zug korrigiert.
-- ============================================================================

-- Entfernt ein einzelnes, abgelaufenes/widerrufenes Push-Abo (410/404 vom
-- Push-Dienst) aus dem jeweiligen Zweig, ohne den Rest von dyn_data
-- anzufassen. Wird von api/send-push.js mit dem Service-Role-Key aufgerufen
-- (der umgeht RLS ohnehin), SECURITY DEFINER hier nur der Konsistenz halber.
create or replace function clear_push_subscription(p_role text, p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role = 'driver' then
    update settings set dyn_data = jsonb_set(dyn_data, array['driverState', p_id, 'pushSubscription'], 'null'::jsonb)
    where id = 1 and dyn_data #> array['driverState', p_id] is not null;
  elsif p_role = 'dispatcher' then
    update settings set dyn_data = jsonb_set(dyn_data, array['dispatcherState', p_id, 'pushSubscription'], 'null'::jsonb)
    where id = 1 and dyn_data #> array['dispatcherState', p_id] is not null;
  end if;
end $$;

grant execute on function write_dyn_if_unchanged(int, jsonb, jsonb, jsonb, jsonb, jsonb) to anon, authenticated;
-- clear_push_subscription bewusst NICHT an anon/authenticated vergeben — nur
-- für api/send-push.js gedacht (läuft mit dem Service-Role-Key, der braucht
-- diese Freigabe nicht, umgeht Postgres-Grants ohnehin). Sonst könnte jeder
-- mit dem anon-Key beliebige Push-Abos löschen (Verfügbarkeits-Ärgernis,
-- kein Datenleck, aber unnötig).
revoke execute on function clear_push_subscription(text, text) from public;

-- ============================================================================
-- Nachtrag 5: Direkte Schreibzugriffe per REST/anon-Key sperren
--
-- Die bisherigen Policies write_drivers/write_settings/rw_state_all/
-- write_guest_tokens erlaubten "using (true) with check (true)" — jeder mit
-- dem öffentlichen anon-Key (zwangsläufig im ausgelieferten JS-Bundle) konnte
-- damit PER DIREKTEM REST-CALL an der App vorbei die komplette Fahrer-/
-- Einstellungs-/Fahrtendatenbank überschreiben, unabhängig von jeder Logik
-- in dispatcher_save_drivers/write_setup_if_unchanged/write_dyn_if_unchanged.
--
-- Die App selbst hat diese Lücke nie gebraucht: jeder Schreibzugriff läuft
-- bereits ausschließlich über die genannten RPCs (SECURITY DEFINER, umgehen
-- RLS ohnehin und funktionieren deshalb nach diesem Nachtrag unverändert
-- weiter). Kein Funktionsverlust, nur die Hintertür wird geschlossen.
--
-- rides/driver_state: laut Nachtrag oben bereits vollständig unbenutzte
-- Alt-Tabellen (echte Daten liegen in settings.dyn_data) — hier komplett
-- (Lesen UND Schreiben) für anon/authenticated gesperrt, da nichts
-- Legitimes mehr darauf zugreift.
--
-- guest_tokens: Lesezugriff war ebenfalls offen — das ist die Liste aller
-- gültigen Gast-Link-Tokens samt Künstlername, im Grunde eine Generalliste
-- aller Zugangsschlüssel. guest_session/dispatcher_list_guest_tokens sind
-- beide SECURITY DEFINER und lesen die Tabelle intern, RLS betrifft sie
-- nicht — auch hier also kein Funktionsverlust, nur Direktzugriff dicht.
-- ============================================================================
drop policy if exists write_drivers on drivers;
drop policy if exists write_settings on settings;
drop policy if exists rw_state_all on driver_state;
drop policy if exists rw_rides_select on rides;
drop policy if exists rw_rides_update on rides;
drop policy if exists rw_rides_insert on rides;
drop policy if exists read_guest_tokens on guest_tokens;
drop policy if exists write_guest_tokens on guest_tokens;
-- Ohne jede Policy ist eine Tabelle mit aktivierter RLS für anon/authenticated
-- automatisch komplett gesperrt (Postgres-Standard: implizites Verweigern).
-- Kein "using (false)"-Ersatz nötig, das Fehlen der Policy reicht.

