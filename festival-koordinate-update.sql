-- Festival-Koordinate in der Live-Datenbank korrigieren.
-- Im Supabase SQL-Editor ausfuehren (Projekt -> SQL Editor -> New query -> einfuegen -> Run).
--
-- Hintergrund: Der App-Code hat die richtige Festival-Koordinate (49.52728, 10.83139),
-- aber die gespeicherte settings.locations-Zeile enthaelt noch die alte, falsche
-- Koordinate. Orte werden nur EINMAL beim allerersten Start geseedet; ein spaeterer
-- Redeploy ueberschreibt gespeicherte Orte NICHT. Deshalb muss der Wert einmal direkt
-- in der DB gesetzt werden. Danach lesen alle Geraete ihn ueber loadSetup()/Realtime neu.
--
-- Sicher fuer den Live-Betrieb: es wird NUR am Eintrag mit id='festival' das lat/lng
-- gesetzt. Reihenfolge und alle anderen Orte/Felder (Adresse, mapX/mapY, zone, ...)
-- bleiben unangetastet. Kein Bezug zum rev-Zaehler noetig (direkte DB-Aenderung).

-- 1) VORHER pruefen: was steht aktuell drin?
select elem->>'id' as id, elem->>'lat' as lat, elem->>'lng' as lng
from settings, jsonb_array_elements(locations) as elem
where id = 1 and elem->>'id' = 'festival';

-- 2) Korrigieren: nur den Festival-Eintrag auf die richtige Koordinate setzen.
update settings
set locations = (
      select jsonb_agg(
               case when elem->>'id' = 'festival'
                 then elem || jsonb_build_object('lat', 49.52728, 'lng', 10.83139)
                 else elem
               end
               order by ord
             )
      from jsonb_array_elements(locations) with ordinality as t(elem, ord)
    ),
    updated_at = now()
where id = 1;

-- 3) NACHHER kontrollieren: soll jetzt lat=49.52728, lng=10.83139 zeigen.
select elem->>'id' as id, elem->>'lat' as lat, elem->>'lng' as lng
from settings, jsonb_array_elements(locations) as elem
where id = 1 and elem->>'id' = 'festival';

-- Hinweis: Ein bereits offenes Fahrer-/Leitstellen-Fenster uebernimmt den neuen Wert
-- ueber das Realtime-Abo automatisch; im Zweifel die Seite auf dem Handy einmal neu laden.
-- Der Navigieren-Button nutzt fuer das Festival (venue) die Koordinate - danach fuehrt
-- er die Fahrer auf den richtigen Punkt.
