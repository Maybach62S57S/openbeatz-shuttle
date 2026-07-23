-- =====================================================================
-- DB-Nachtrag 23.07.2026 - Fahrerliste OB26 + drei neue Orte
-- Passend zu den Commits d8f080a und 8a0a1d9.
--
-- ANLEITUNG
--   Supabase -> Projekt -> SQL Editor -> New query -> Block einfuegen -> Run.
--   Die Bloecke sind einzeln ausfuehrbar und in dieser Reihenfolge gedacht:
--   SCHRITT 0 (nur lesen) -> SCHRITT 1 (Orte) -> SCHRITT 2 (Matrix)
--   -> SCHRITT 3 (Fahrer, erst nach Rueckmeldung von Schritt 0).
--
-- FESTIVAL LAEUFT. Produktiv und Preview haengen an derselben Datenbank.
-- Deshalb: Schritt 0 zuerst und das Ergebnis zurueckschicken, bevor
-- Schritt 3 ausgefuehrt wird.
-- =====================================================================


-- =====================================================================
-- SCHRITT 0 - BESTANDSAUFNAHME (aendert NICHTS, nur lesen)
-- Bitte das Ergebnis aller vier Abfragen zurueckschicken.
-- =====================================================================

-- 0a) Alle Fahrer mit Fahrzeug und Sitzen.
--     Wichtig: ich brauche die vehicle_id, um die vier Fahrzeugwechsel
--     sauber zu schreiben (ein Car mit vehicle_id "Van3" waere Murks).
select id, first_name, last_name, vehicle_type, vehicle_id, seats, active
from drivers
order by vehicle_type, vehicle_id;

-- 0b) Wie viele Fahrten stehen wirklich drin? (Du sagtest erst leer,
--     dann Testfahrten. Vor dem Loeschen wissen wir es genau.)
select count(*) as fahrten_gesamt,
       count(*) filter (where assigned_driver_id is not null) as mit_fahrer,
       min(date) as erster_tag,
       max(date) as letzter_tag
from rides;

-- 0c) Haengt an Sandro Benz noch etwas?
select 'rides' as tabelle, count(*) as treffer
  from rides where assigned_driver_id = 'sandro-benz'
union all
select 'driver_state', count(*)
  from driver_state where driver_id = 'sandro-benz';

-- 0d) Welche Orts-IDs sind schon angelegt?
select jsonb_agg(e ->> 'id') as location_ids
from settings, jsonb_array_elements(locations) e
where id = 1;


-- =====================================================================
-- SCHRITT 1 - DREI NEUE ORTE (kann sofort laufen, unabhaengig von Schritt 0)
--
-- Idempotent: legt einen Ort nur an, wenn die id noch nicht existiert.
-- Mehrfaches Ausfuehren aendert nichts und erzeugt keine Duplikate.
-- Bestehende Orte bleiben unangetastet.
-- =====================================================================

with neu(loc) as (
  values
    ('{"id":"melter","name":"MELTER - a Neighborhood Hotel","short":"MELTER","address":"Nürnberg","venue":false,"type":"hotel","lat":49.4472,"lng":11.0795}'::jsonb),
    ('{"id":"flugplatz_herzo","name":"Flugplatz Herzogenaurach","short":"Flugplatz Herzo","address":"Am Birkenbühl 1, 91074 Herzogenaurach","venue":false,"type":"airport","lat":49.5826,"lng":10.8829}'::jsonb),
    ('{"id":"bahnhof_puschendorf","name":"Bahnhof Puschendorf","short":"Bhf Puschendorf","address":"Puschendorf","venue":false,"type":"hotel","lat":49.5236,"lng":10.8256}'::jsonb)
)
update settings s
set locations = s.locations || coalesce(
      (select jsonb_agg(n.loc)
       from neu n
       where not exists (
         select 1 from jsonb_array_elements(s.locations) e
         where e ->> 'id' = n.loc ->> 'id'
       )),
      '[]'::jsonb
    ),
    updated_at = now()
where id = 1;

-- Kontrolle: soll die Bestands-IDs PLUS melter, flugplatz_herzo,
-- bahnhof_puschendorf zeigen, jede genau einmal.
select jsonb_agg(e ->> 'id') as location_ids
from settings, jsonb_array_elements(locations) e
where id = 1;


-- =====================================================================
-- SCHRITT 2 - FAHRZEITEN FUER DIE ZWEI NEUEN KNOTEN
--
-- MELTER braucht KEINEN Eintrag: die App routet ihn im Code ueber den
-- Sheraton-Knoten (LOC_MATRIX_NODE), genau wie Karl August und Leonardo.
--
-- Die Matrix ist symmetrisch, travel() prueft a|b UND b|a. Ein Eintrag
-- pro Strecke reicht also.
--
-- ACHTUNG, ZWEI WERTE SIND VON MIR GESCHAETZT UND VON DIR ZU PRUEFEN:
--   festival|flugplatz_herzo      = 20 min  <- dein Wert
--   festival|bahnhof_puschendorf  = 10 min  <- dein Wert
--   sheraton|flugplatz_herzo      = 40 min  <- GESCHAETZT, bitte pruefen
--   sheraton|bahnhof_puschendorf  = 35 min  <- GESCHAETZT, bitte pruefen
-- Die beiden Sheraton-Strecken braucht der Vorschlag-Knopf, wenn ein
-- Fahrer danach eine Fahrt am Sheraton uebernehmen soll. Fehlt der Wert,
-- rechnet er "Fahrzeit unbekannt" und sortiert den Fahrer aus.
-- Die km-Werte sind Naeherungen und werden nur angezeigt, nicht gerechnet.
-- =====================================================================

update settings
set matrix = matrix
  || jsonb_build_object(
       'festival|flugplatz_herzo',     jsonb_build_object('min', 20, 'km', 8),
       'festival|bahnhof_puschendorf', jsonb_build_object('min', 10, 'km', 7),
       'sheraton|flugplatz_herzo',     jsonb_build_object('min', 40, 'km', 30),
       'sheraton|bahnhof_puschendorf', jsonb_build_object('min', 35, 'km', 27)
     ),
    updated_at = now()
where id = 1;

-- Kontrolle
select
  matrix -> 'festival|flugplatz_herzo'     as festival_flugplatz,
  matrix -> 'festival|bahnhof_puschendorf' as festival_puschendorf,
  matrix -> 'sheraton|flugplatz_herzo'     as sheraton_flugplatz,
  matrix -> 'sheraton|bahnhof_puschendorf' as sheraton_puschendorf
from settings where id = 1;


-- =====================================================================
-- SCHRITT 3 - FAHRER
--
-- NOCH NICHT AUSFUEHREN. Die vier Fahrzeugwechsel brauchen die
-- vehicle_id aus Schritt 0a, sonst behaelt ein Car eine Van-Nummer.
-- Schick mir das Ergebnis von 0a, dann trage ich die Werte ein.
--
-- Was hier hin kommt:
--   - Finn Steinmetz   Van -> Car, seats 4
--   - Lukas Bieber     Van -> Car, seats 4
--   - Dominik Dittes   Car -> Van, seats 6
--   - Mustafa Uenver   seats 7 -> 8
--   - Sandro Benz      loeschen (siehe Hinweis unten)
--   - Raphael Swiety   anlegen, Van, 6 Sitze
--
-- HINWEIS ZU SANDRO BENZ, wichtig:
-- Die Tabelle drivers hat zwar eine Spalte "active", aber die App wertet
-- sie NICHT aus. Ich habe das im Code geprueft: active wird gelesen und
-- gemappt, aber nirgends zum Filtern der Fahrerliste benutzt.
-- "active = false" wuerde Sandro also NICHT verstecken, er stuende
-- weiter in jeder Auswahl. Deshalb bleibt nur das echte Loeschen,
-- und dann zusammen mit seinem driver_state.
--
-- Sein Login liegt im localStorage seines Handys, nicht in der DB.
-- Falls das Geraet noch im Umlauf ist: einmal ausloggen lassen.
-- =====================================================================
