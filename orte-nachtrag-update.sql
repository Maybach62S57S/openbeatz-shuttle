-- matchLoc-/Orts-Fix (21.07.2026): die 5 neuen echten Orte in der Live-Datenbank
-- nachtragen. Im Supabase SQL-Editor ausfuehren (Projekt -> SQL Editor -> New query
-- -> einfuegen -> Run).
--
-- Passend zur App-Aenderung in seedLocations() (src/ShuttleLeitstelle.jsx). seedLocations
-- greift NUR beim rein lokalen Erststart ohne Supabase; im Live-Betrieb liegen die Orte
-- in settings.locations (jsonb), deshalb dieser Nachtrag.
--
-- Sicher fuer den Live-Betrieb:
--   * IDEMPOTENT: jeder Ort wird nur angehaengt, wenn seine id noch nicht existiert.
--     Mehrfaches Ausfuehren aendert nichts und legt keine Duplikate an.
--   * Bestehende Orte (airport/moevenpick/sheraton/festival) bleiben unangetastet.
--   * Kein Schema-Eingriff, keine Aenderung an matrix/zones/config/drivers.
--   * Kein Bezug zum rev-Zaehler noetig (direkter DB-Schreibzugriff, nicht ueber die
--     App-Mutatoren). Die App liest settings per loadSetup()/Realtime neu ein.
--
-- Fahrzeit: Leonardo/HBF/Karl August rechnen ueber LOC_MATRIX_NODE wie Sheraton,
-- GAT wie Flughafen NUE, Muenchen ueber den Matrix-Knoten "muc" (bereits per
-- teilpaket-b-matrix-update.sql in der matrix hinterlegt: muc|festival, muc|sheraton).
-- Karl August bekommt bewusst KEINEN mapX/mapY (kein eigener Kartenpunkt); die App
-- routet ihn ueber MAP_NODE_ALIAS am Sheraton-Knoten.

with neu(loc) as (
  values
    ('{"id":"leonardo","name":"Hotel Nürnberg City-Center by Leonardo Hotels","short":"Leonardo","address":"Eilgutstraße 8, 90443 Nürnberg","venue":false,"type":"hotel","mapX":700,"mapY":520,"labelDx":-6,"labelDy":22,"lat":49.4460,"lng":11.0850}'::jsonb),
    ('{"id":"hbf_nue","name":"Nürnberg Hauptbahnhof","short":"HBF","address":"Bahnhofsplatz 9, 90443 Nürnberg","venue":false,"type":"hotel","mapX":690,"mapY":452,"labelDx":-10,"labelDy":4,"lat":49.4456,"lng":11.0820}'::jsonb),
    ('{"id":"gat_nue","name":"GAT / Private Jet Nürnberg","short":"GAT","address":"Flughafenstraße 100, 90411 Nürnberg (General Aviation Terminal)","venue":false,"type":"airport","mapX":812,"mapY":205,"labelDx":22,"labelDy":4,"lat":49.5010,"lng":11.0640}'::jsonb),
    ('{"id":"airport_muc","name":"Flughafen München","short":"Flughafen MUC","address":"Nordallee 25, 85356 München-Flughafen","venue":false,"type":"airport","mapX":860,"mapY":590,"labelDx":0,"labelDy":24,"lat":48.3538,"lng":11.7861}'::jsonb),
    ('{"id":"karl_august","name":"Karl August Hotel Nürnberg","short":"Karl August","address":"Karl-August-Straße, Nürnberg","venue":false,"type":"hotel","lat":49.4470,"lng":11.0800}'::jsonb)
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

-- Kontrolle direkt danach: alle Orts-IDs auflisten (soll die 4 Bestands-IDs PLUS
-- leonardo/hbf_nue/gat_nue/airport_muc/karl_august zeigen, jede genau einmal).
select jsonb_agg(e ->> 'id') as location_ids
from settings, jsonb_array_elements(locations) e
where id = 1;

-- Erwartung nach dem Update (Reihenfolge kann abweichen, jede ID GENAU einmal):
--   ["airport","moevenpick","sheraton","festival",
--    "leonardo","hbf_nue","gat_nue","airport_muc","karl_august"]
--
-- Hinweis: Falls einer der neuen Orte bei euch schon von Hand angelegt wurde, wird er
-- durch die not-exists-Pruefung NICHT ueberschrieben und NICHT dupliziert. Ein bereits
-- vorhandener Eintrag mit derselben id bleibt so wie er ist.
