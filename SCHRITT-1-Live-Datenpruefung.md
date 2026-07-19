# Schritt 1: Live-Datenprüfung — Checkliste + Read-only-Abfrage

Kein Code-Zugriff auf die produktive Supabase-DB vorhanden. Diese Abfrage musst du selbst im
Supabase SQL-Editor ausführen (Projekt → SQL Editor → einfügen → Run). Sie liest ausschließlich,
schreibt nichts.

## Read-only SQL-Abfrage

```sql
select
  id,
  first_name,
  last_name,
  vehicle_type,
  seats,
  vehicle_id,
  plate,
  phone,
  (pin <> '') as pin_vorhanden,
  active
from drivers
order by vehicle_type, last_name, first_name;
```

Reine `select`, kein `insert`/`update`/`delete`, keine Nebenwirkung. `pin_vorhanden` zeigt `true`/
`false` statt der PIN selbst (PIN nicht nötig für den Abgleich, bewusst nicht mit ausgegeben).

## Ergebnis exportieren

Im Supabase SQL-Editor: nach dem Run oben rechts "Export" → CSV oder direkt die Ergebnistabelle
kopieren. Wenn du mir das Ergebnis (CSV oder als Text/Tabelle) hier reinkopierst, gleiche ich es
automatisch mit `drivers_openbeatz.json` ab (Skript liegt bereit, siehe unten) — dann musst du
selbst nichts von Hand vergleichen.

## Manuelle Prüfcheckliste (falls du lieber selbst durchgehst)

Für jeden der 23 Fahrer aus `drivers_openbeatz.json` in der Live-Tabelle prüfen:

| Prüfpunkt | Worauf achten |
|---|---|
| Fehlt der Fahrer komplett? | Kein Treffer per `id` UND kein Treffer per normalisiertem Vor+Nachname |
| Abweichende ID | Name matcht, aber `id` in der DB ≠ erwartete ID aus der externen Datei |
| Abweichender Fahrzeugtyp | `vehicle_type` (Van/Car) stimmt nicht mit `vehicle` aus der externen Datei überein |
| Abweichende Sitzplatzzahl | `seats` in der DB ≠ `seats` aus der externen Datei |
| **Besonders: Vans mit 6 vs. 7 Sitzen** | Laut externer Datei müssten Patrick Ibrahimi und Mustafa Ünver 7 Sitze haben, Finn Steinmetz/Björn Korn/Amar Piljevic/Lukas Bieber müssten 6 Sitze haben. Jede Abweichung hier direkt notieren, das ist das konkrete Überbuchungsrisiko. |

**Bekannt aus der Code-Analyse (Phase-0b), noch nicht an Live-Daten bestätigt:**
Vermutung: Leon Merg, Philipp Stich, Maximilian Schneider fehlen komplett; die vier genannten
Vans stehen mit 7 statt 6 Sitzen in der DB. Diese Abfrage bestätigt oder widerlegt das an den
echten Daten.

**Keine automatische Migration.** Diese Abfrage und der Abgleich sind rein diagnostisch. Etwaige
Korrekturen (Sitzzahlen, fehlende Fahrer) werden nicht automatisch ausgeführt, sondern erst nach
deiner Bestätigung als separater, sehr kleiner Schritt.
