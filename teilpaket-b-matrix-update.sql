-- Teilpaket B: die drei bestaetigten Fahrzeitwerte in der Live-Datenbank nachtragen.
-- Im Supabase SQL-Editor ausfuehren (Projekt -> SQL Editor -> New query -> einfuegen -> Run).
--
-- Sicher fuer den Live-Betrieb: jsonb_set aendert NUR die drei genannten Keys in der
-- matrix-Spalte, alle anderen Eintraege (inkl. km-Werte, andere Strecken) bleiben
-- unangetastet. Kein Bezug zum rev-Zaehler noetig, da dies direkt in der DB passiert,
-- nicht ueber die App-Mutatoren.

update settings
set matrix = matrix
  || jsonb_build_object(
       'sheraton|festival', jsonb_build_object('min', 38,  'km', 28),
       'muc|festival',      jsonb_build_object('min', 105, 'km', 185),
       'muc|sheraton',      jsonb_build_object('min', 105, 'km', 185)
     ),
    updated_at = now()
where id = 1;

-- Zur Kontrolle direkt danach ausfuehren (soll die drei neuen/aktualisierten Eintraege zeigen):
select
  matrix -> 'sheraton|festival' as sheraton_festival,
  matrix -> 'muc|festival'      as muc_festival,
  matrix -> 'muc|sheraton'      as muc_sheraton,
  updated_at
from settings
where id = 1;

-- Erwartung nach dem Update:
--   sheraton_festival = {"min": 38, "km": 28}
--   muc_festival       = {"min": 105, "km": 185}
--   muc_sheraton        = {"min": 105, "km": 185}
--
-- Hinweis: die App liest settings ueber loadSetup() beim Start bzw. per Realtime-Abo neu ein
-- (supabaseStore.js, subscribeLive). Ein bereits offenes Fahrer-/Leitstellen-Fenster zeigt die
-- neuen Werte automatisch, ein manueller Reload ist im Zweifel aber die sicherste Kontrolle.
