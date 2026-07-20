# Teilpaket H - Abnahme (Härtetest der Schreibwege)

Stand 20.07.2026. Chat 1 + Chat 2 abgeschlossen. Reiner Nachweis-/
Doku-Durchlauf plus ein kleiner Testdatei-Fix - kein App-Code in H selbst
verändert (der einzige Diff an `src/ShuttleLeitstelle.jsx` in diesem
gesamten Teilpaket: keiner).

## Sicherheit / Additivität

- [x] `src/ShuttleLeitstelle.jsx` in Chat 1 UND Chat 2 unverändert
- [x] Alle neuen Dateien sind Testdateien oder Doku, kein Produktivpfad
- [x] Kein Schema-/RPC-Eingriff, `supabase-schema.sql` unverändert
- [x] esbuild grün, keine doppelten Funktions-/Const-Namen (mit korrektem
      Regex inkl. Ziffern verifiziert)
- [x] Volle Bestands-Regression zu Sessionbeginn grün nachgezogen

## Schreibweg-Inventur (Chat 1)

- [x] 34 `updateDyn`-Aufrufstellen inventarisiert
- [x] Sichere Wege bestätigt (`await` + `res.ok` geprüft, Guard vorhanden)
- [x] 5 fire-and-forget-Schwachstellen gefunden und klassifiziert, keine
      blind gefixt (Freeze/Freigabe-Regel eingehalten)
- [x] `smoke-teilpaket-h-concurrency.mjs` 21/0, aus der Quelle repliziert,
      3 Gegenproben bestätigen echte Messung

## SQL-RPC-Verifikation (Chat 2a) - Goldstandard, nicht nur statisch

- [x] Echtes Postgres 16 lokal, `supabase-schema.sql` unverändert eingespielt,
      lief fehlerfrei durch (Idempotenz-Beleg)
- [x] `security definer` + `search_path=public` aus `pg_proc` bestätigt (DB-
      Fakt, nicht Code-Lektüre)
- [x] 20 echte parallele Schreiber (node-pg, `Promise.all`): genau 1 Gewinner,
      Rest korrekt `ok=false` mit aktuellem Serverstand
- [x] Stale rev gewinnt nie, auch nicht nachträglich einzeln
- [x] Retry-Schleife: 20/20 Clients kommen am Ende durch, keiner verloren/doppelt
- [x] `write_setup_and_drivers_if_unchanged`: Transaktions-Rollback bei
      kaputtem Fahrer-Teil erfasst nachweislich auch `settings`
- [x] Gültiger kombinierter Aufruf geht in einer Transaktion durch
- [x] **Gegenprobe:** nicht-atomare Variante verliert unter derselben Last
      nachweislich Updates -> Testaussage ist belastbar

## Poll-/Apply-Pfad H19 (Chat 2b)

- [x] Frage untersucht: kann eine ältere rev eine neuere lokale überschreiben?
- [x] Mit zeilengetreu extrahiertem Code (Anker Z. 951) nachgewiesen: ja, in
      einem Race-Fall (späte Poll-Antwort nach frischerem lokalem Schreiben)
- [x] Tragweite eingeordnet: kein Datenverlust, rein UI-seitig, selbstheilend
      binnen einem Poll-Zyklus (≤3s)
- [x] Gegenprobe: möglicher monotoner Schutz bestätigt isoliert wirksam, ohne
      Normalfall zu brechen (**nicht umgesetzt**, siehe Entscheidung)
- [x] Entscheidung Jordan eingeholt und dokumentiert: nicht fixen, Selbst-
      heilung reicht für den Festivalzeitraum

## Entscheidung fire-and-forget-Fixes (Chat 2d)

- [x] Alle drei offenen Fixe (One-Tap, Drag-and-Drop, Stage-Meldung) Jordan
      zur Entscheidung vorgelegt
- [x] Entscheidung dokumentiert: keiner davon jetzt, alle auf spätere Session
      vertagt (siehe "Weitere gefundene Punkte" im Bericht)

## Nebenbefunde behoben (mit Freigabe)

- [x] Duplikat-Check-Regex-Artefakt aufgeklärt (kein echtes Duplikat)
- [x] `smoke-import-dauer.mjs` Fälle 17/18 an den seit `bb868a4` gültigen
      Stand angeglichen (Commit `0b1b60c`), jetzt 18/18

## Offen (bewusst, auf spätere Sessions vertagt)

- [ ] One-Tap-Zuweisung `quickAssign` async/await + sichtbarer Fehler
- [ ] Drag-and-Drop `applyDrop` async/await + sichtbarer Fehler
- [ ] Stage-Problemmeldung `reportIssue` async/await + sichtbarer Fehler
- [ ] Gast-Aktionen (niedrigere Priorität, nach Deploy über guest-RPCs)
- [ ] Dev "alle Fahrten löschen" (niedrigste Priorität)
- [ ] H19 monotoner Poll-Schutz (siehe `TEILPAKET-H-MIGRATION.md`)
- [ ] Per-Ride-rev-Migration (Post-Festival, siehe `TEILPAKET-H-MIGRATION.md`)
