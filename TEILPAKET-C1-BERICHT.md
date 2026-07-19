# Teilpaket C1 - Abschlussbericht: Rein lesender Timetable-Tab

## GO / NO-GO
**GO empfohlen.** Rein additiv (550 Einfuegungen, 0 Loeschungen), kein Kernpfad
beruehrt, alle Verifikationen gruen, Fahrer-/Stage-/Gastansicht auf Quelltext-
Ebene byte-identisch.

## Ruecksetzpunkt
- Git-Tag `pre-teilpaket-C1` = Commit `6d0054c` (Stand nach Teilpaket B).
- Rueckweg: `git reset --hard pre-teilpaket-C1` (bzw. Revert des C1-Commits).

## Geaenderte Dateien
- `src/ShuttleLeitstelle.jsx`: +550 Zeilen, 0 entfernt. 9522 -> 10072 Zeilen.
  Drei Einhaengepunkte:
  1. Neuer Block vor `MissionDriversTab`: Konstante `TIMETABLE_META` +
     `TIMETABLE_RAW` (229 Sets) + Helfer (`ttHash`, `ttAbsMin`, `ttIsB2B`,
     `ttNorm`, `ttCompare`, `normalizeTimetableEntries`) + Komponente
     `TimetableTab`.
  2. Eine Zeile in `MC_NAV` (Tab "timetable", Gruppe "Planung & Kommunikation").
  3. Eine Render-Zeile `{tab === "timetable" && <TimetableTab />}`.
- Neu: `smoke-teilpaket-c1.mjs`, `smoke-teilpaket-c1-ui.mjs` (Testskripte).
- Neu: `TEILPAKET-C1-ABNAHME.md`, `TEILPAKET-C1-BERICHT.md`.

## Timetable-Struktur (selbst gemessen)
- 229 Sets, je 5 Felder (alle Strings, in jedem Set vorhanden): `festival_day`
  (DD/MM/YYYY), `stage`, `artist`, `start`/`end` ("YYYY-MM-DD HH:MM"). Kein
  ID-Feld -> IDs werden stabil erzeugt.
- 4 Festival-Tage: Do 23.07. (8 Sets, nur Preparty), Fr 24.07. (82), Sa 25.07.
  (81), So 26.07. (58).
- 10 Stages: Gruener Stadl (38), CALDERA (31), Zone III (30), "House of Remix"
  by IQOS (26), Magical Forest (25), Darkwoods (25), STONELANDS (23), Goa Garden
  (21), CAMPINGSTAGE PREPARTY (8), EDEKA CAMPINGSTAGE (2).
- 216 eindeutige Artists, 12 mehrfach. 16 B2B-Sets (alle Schreibweise "b2b").
- Datenqualitaet: 0 Leerwerte, 0 Formatfehler, 0 nicht-positive Dauern, 0
  Duplikate, 0 Slot-Kollisionen. Ein bewusster Ausreisser: "GOA Sammelrider"
  (idx 49) laeuft 24h - bleibt als gueltiger operativer Platzhalter erhalten.

## Normalisierung, Mitternacht, Suche, Filter, B2B, Diagnose
- `normalizeTimetableEntries` liefert je Set: `id`, `sourceIndex`, `artist`,
  `stage`, `startAt`/`endAt` (kanonische, sortierbare Strings), `date`, `dayKey`,
  `startsAfterMidnight`, `durationMin`, `isB2B`, `valid`, `problems[]`, `raw`
  (Originalwerte). Originaldaten werden nicht mutiert.
- **Mitternacht:** Betriebstag ausschliesslich ueber den BESTEHENDEN App-Helfer
  `festDayKey` (00:00-05:59 = Vortagsnacht). Verifiziert: `festDayKey(start)`
  reproduziert das `festival_day`-Feld fuer alle 229 Sets, 0 Abweichungen. Keine
  zweite Datumslogik. `festival_day` dient nur zur Gegenpruefe (bei Abweichung
  Diagnose statt stiller Wahl).
- **Stabile IDs:** `tt-<FNV-1a-Hash von festival_day|stage|artist|start|end>-<sourceIndex>`,
  deterministisch, kein Zufall.
- **Suche:** case-insensitiv, umlaut-/diakritika-normalisiert, Mehrfach-Leerzeichen
  toleriert, alle Tokens muessen vorkommen (Artist, Stage, Uhrzeit).
- **Filter:** Festival-Tag (Chips, dynamisch) + Stage (Auswahl, dynamisch, ohne
  Duplikate). Kombinierbar, "Zuruecksetzen" stellt die volle Liste her.
- **B2B:** nur echte Namensmuster `b2b`/`vs.` (Gross-/Kleinschreibung egal).
  Kollaborationen (`x`, `&`, `feat.`) sind kein B2B. Originalname bleibt erhalten.
- **Diagnose:** ungueltige Eintraege werden NICHT still repariert, sondern mit
  Grund gekennzeichnet (aufklappbare Zusammenfassung), Zeiten bleiben `null`
  statt geraten. Reale Datei: 0 ungueltige -> Diagnosebereich bleibt verborgen.

## UI-Aenderungen
- Ein neuer Tab "Timetable" (Icon Uhr) unter "Planung & Kommunikation", **nur
  fuer die Leitstelle** sichtbar. Steuerung allein ueber `MC_ROLE_TABS`
  (`dispo` bekommt alle Tabs; `stage`/`driver` ihre Allowlist ohne "timetable";
  `guest` bekommt keinerlei MC-Nav).
- Darstellung im bestehenden MC-Design (Tokens, `MissionPanel`, `EmptyState`,
  `mc-badge`, `mc-input`). Keine neuen CSS-Klassen erfunden, keine neuen Imports.
- Gruppierung nach Betriebstag (chronologisch), je Set Zeitspanne, Dauer, Stage-
  Badge, B2B- und "nach Mitternacht"-Kennzeichen.

## Read-only-Nachweis
- Statische Analyse des `TimetableTab`-Koerpers: KEIN `updateDyn`, `updateSetup`,
  Supabase, Storage-Write, `.insert/.update/.delete`, keine Zuweisungsfunktion.
- Genau 3 lokale `useState` (Suche, Tag-Filter, Stage-Filter) - reiner UI-State.
- Komponente nimmt keine Schreib-Props entgegen (propslos gerendert).

## Test- und Regressionsergebnisse
- esbuild: gruen. Keine doppelten Funktionsnamen.
- JSX-Referenz-Cross-Check: keine unbekannten Tags (4 Vorbestand-Fehlalarme:
  MissionControlBoundary=class, Ic/I=dynamische Locals, SchematicComponent=Prop).
- `smoke-teilpaket-c1.mjs`: 40/40 (Datenanalyse, Normalisierung, Zeitlogik,
  Suche, Filter, B2B) inkl. Gegenprobe. Getestet gegen die ECHTEN, aus der
  Quelle gebundelten Funktionen (kein Nachbau).
- `smoke-teilpaket-c1-ui.mjs`: 16/16 (Rollen-Gating, echtes Rendern, Diagnose,
  leere/kaputte Datei per Toggle-Trap, Read-only-Statik).
- `rendertest.mjs`: 5 Referenzwerte EXAKT konstant (App-Root 25053, IssueModal
  2452, StageIssueModal 2413, GuestIssueModal 2895, Field 101).
- `kontrast.mjs`: 0 WCAG-Fehler. `pruefe.mjs`: DriverApp/StageApp/GuestApp/
  IssueModal/StageIssueModal/GuestIssueModal/MissionStyles/Field/inp/SettingsTab
  unveraendert; 0 undefinierte CSS-Variablen.
- Byte-Diff Kernpfad/Tabu (Baseline pre-C1 vs. aktuell): evaluateInsertion,
  suggestDrivers, computeDriverStats, driverDay, dayNowMin, travelMin, effDur,
  validPassengerCount, festDayKey, matchLoc, resolveLocation, resolveTravelMinutes,
  rideEndpointMatrixNode, driverCategoryOf, availableFromOf, teamGroupOf,
  normDriverName, logRide, fmtDate = ALLE byte-identisch.
- Bestehende Logiktests gegen aktuelle Quelle: Springer 34/34, Personenzahl
  24/24, One-Tap 14/14, leere Ridelist 10/10.

## Restrisiken / bewusste Auslassungen
- "Jetzt / Als Naechstes"-Filter verschoben: nur mit Echtzeit sinnvoll und erst
  waehrend des Festivals testbar. Bewusste Entscheidung, dokumentiert.
- Ein-Datei-Fehler-Bug waehrend der Entwicklung gefunden und behoben: `\uXXXX`-
  Escapes rendern in JSX-Text/Attributen literal -> durch echte Zeichen ersetzt.
  Die Diakritika-Regex in `ttNorm` (`\u0300-\u036f`) bleibt korrekt als Escape.
- `regression-teilpaket-b.mjs` referenziert `/tmp`-Extrakte der Vorsession; der
  dort gemeinte Motor-Vergleich ist hier staerker durch den Byte-Diff oben
  abgedeckt (evaluateInsertion/suggestDrivers identisch).

## Weitere gefundene Punkte fuer spaetere Sessions
- (unveraendert offen aus Vorsessions) `matchLoc` Z. ~7676 liest nur 4
  Hardcode-Orte, nicht `setup.locations` - NICHT Teil von C1, hier nicht angefasst.
