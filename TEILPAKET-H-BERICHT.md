# Teilpaket H - Bericht (Härtetest der Schreibwege)

**Stand:** 20.07.2026. **H fertig.** Zwei Chats: Chat 1 (Inventur +
Client-Nebenläufigkeit), Chat 2 (SQL-RPC-Goldstandard + Poll-Pfad + Doku +
Fixentscheidung).

## Ziel

Prüfen, ob die Schreibwege der App (34 `updateDyn`-Aufrufstellen + die beiden
zentralen Setup-/Dyn-RPCs) wirklich das leisten, was H vorsieht: atomarer
serverseitiger CAS statt Client-seitigem "lesen->vergleichen->schreiben", kein
verlorenes Update, kein blindes Überschreiben, sichtbare Fehler bei
kritischen Nutzeraktionen. Kein Neubau, kein Architekturumbau - Nachweis und
gezielte Einzelfixe nach Freigabe.

## Wichtige Prämisse (bereits in Chat 1 geklärt)

H ging ursprünglich davon aus, die zentrale CAS-Absicherung müsse erst noch
gebaut werden. Das trifft auf dieses Repo nicht zu: `write_dyn_if_unchanged`
und `write_setup_and_drivers_if_unchanged` existieren bereits mit
Compare-and-Swap auf `dyn_rev`/`setup_rev`, `security definer` + festem
`search_path`, Feld-Whitelist und Transaktionalität. H wurde deshalb als
**Härtetest + Nachweis** gefahren, nicht als Neubau.

## Chat 1 - Ergebnis (Kurzfassung, Details siehe Zwischenstand-Doku)

- Vollständige Schreibweg-Inventur: alle sicheren Wege bestätigt (`await` +
  `res.ok` geprüft, Guard vorhanden).
- 5 Schwachstellen gefunden, alle "fire-and-forget" (kein `await`, kein
  `res.ok`-Check, UI schaltet trotzdem weiter): One-Tap-Zuweisung (KRITISCH),
  Drag-and-Drop (KRITISCH), Stage-Problemmeldung (MITTEL), Gast-Aktionen
  (MITTEL/NIEDRIG), Dev-"alle Fahrten löschen" (NIEDRIG). Keine davon
  gefixt (Freeze/Freigabe-Regel) - siehe Entscheidung unten.
- `smoke-teilpaket-h-concurrency.mjs`: 21/0, aus der Quelle zeilengetreu
  repliziert, 3 Gegenproben bestätigen, dass der Test wirklich misst.

## Chat 2 - (a) SQL-RPC-Verifikation: echtes Postgres (Goldstandard)

Statt nur statischer Code-Lektüre: echtes Postgres 16 lokal aufgesetzt,
`supabase-schema.sql` unverändert eingespielt (inkl. `anon`/`authenticated`-
Rollen, `pgcrypto` für `gen_random_uuid()`), Schema lief fehlerfrei durch
(einziger Beleg für Idempotenz/Konsistenz, den es vorher nicht gab). Beide
RPCs per `pg_proc` aus der echten DB gegengeprüft: `security definer` = true,
`search_path=public` fest gesetzt - keine Behauptung aus dem Code, sondern
DB-Fakt.

Dann mit einem echten Node-`pg`-Client (separate parallele Verbindungen,
`Promise.all`, kein simulierter Ablauf) angegriffen:

- 20 echte Parallelschreiber auf `write_dyn_if_unchanged` mit identischer
  `p_expected_rev`: genau 1 Gewinner, 19x `ok=false` mit dem tatsächlichen
  aktuellen Serverstand, kein Mischzustand, `dyn_rev` exakt 1 danach.
- Stale-rev-Test: ein Schreibversuch mit einer bereits überholten rev
  scheitert immer, auch nachträglich einzeln (nicht nur im Gedränge).
- 20 Clients mit vollständiger Retry-Schleife (wie `updateDyn` im Frontend):
  am Ende alle 20 Einträge vorhanden, keiner doppelt, keiner verloren.
- `write_setup_and_drivers_if_unchanged`: ein bewusst ungültiger Fahrer
  (`vehicle_type` außerhalb des Check-Constraints) wirft, und der
  `settings`-Teil wird nachweislich mit zurückgerollt (kein Teilerfolg). Ein
  gültiger kombinierter Aufruf geht dagegen sauber in einer Transaktion durch.
- **Gegenprobe:** dieselbe Last gegen eine bewusst kaputte, nicht-atomare
  "lesen->vergleichen->schreiben"-Variante verliert tatsächlich Updates (1
  von 20 Schreibern kam durch) - beweist, dass die obigen Tests wirklich die
  CAS-Absicherung messen und nicht zufällig grün sind.

**Ergebnis: 20/20 grün.** Nachweis: `gegenprobe-teilpaket-h-rpc-postgres.mjs`
(kein Teil der Standard-Regression, braucht echtes Postgres, siehe Dateikopf
für Reproduktion; berührt die echte Supabase-Instanz nicht).

## Chat 2 - (b) Poll-/Realtime-Apply-Pfad (H 19)

Frage: kann beim 3s-Poll eine ältere rev eine neuere lokale überschreiben?

Antwort: **ja, in einem engen Race-Fall**, mit zeilengetreu extrahiertem Code
nachgewiesen (`gegenprobe-teilpaket-h19-poll.mjs`, Anker Z. 951). Das
Apply-Prädikat prüft nur Gleichheit der rev (`prev.rev === merged.rev`),
nicht Aktualität. Trifft eine Poll-Antwort verspätet ein (normale
Netzwerk-Latenz) - abgeschickt vor, aber aufgelöst nach einem frischen
lokalen Schreibvorgang -, überschreibt sie kurzzeitig den frischeren
lokalen Stand mit veralteten Daten. Gleiches Muster beim Setup-Poll (Z. 962),
strukturell identisch, nicht separat gegengeprobt.

**Tragweite:**
- Kein Datenverlust in der DB - betrifft nur den lokal angezeigten React-
  State in genau diesem Browser-Tab.
- Selbstheilend: der nächste Poll-Zyklus (≤3s) liest wieder den echten
  aktuellen Serverstand, `merged.rev` weicht dann vom (jetzt veralteten)
  `prev.rev` ab -> wird korrekt übernommen.
- Mit Gegenprobe bestätigt: ein monotoner Schutz (`merged.rev < prev.rev` ->
  verwerfen) würde den Fall isoliert auffangen, ohne den Normalfall
  (echte neuere Serverdaten) zu brechen.

**Entscheidung Jordan:** nicht fixen, nur dokumentieren - Selbstheilung
innerhalb von 3 Sekunden reicht für den Festivalzeitraum. Kein Code
geändert.

## Chat 2 - (d) Entscheidung: fire-and-forget-Fixes

Alle drei aus Chat 1 gefundenen Fixes (One-Tap-Zuweisung, Drag-and-Drop,
Stage-Problemmeldung) **bewusst nicht in diesem Chat umgesetzt** - auf später
vertagt. Siehe "Weitere gefundene Punkte für spätere Sessions" unten.

## Verifikation (Chat 2, zusätzlich zu Chat 1)

- esbuild grün, keine doppelten Funktionsnamen (korrekt geprüft inkl. Ziffern/
  Unterstrich - der einfache `[a-zA-Z]+`-Check meldet bei Teilpaket-C3-
  Funktionsnamen wie `c3RideStartAbsMin` falsche Duplikate, siehe unten).
- Volle Bestands-Regression zu Sessionbeginn nachgezogen und grün (zwei
  vorher fehlende Extrakt-Sets für Teilpaket B/E/G neu generiert, ein
  veralteter Testfall in `smoke-import-dauer.mjs` korrigiert, siehe unten).
- `smoke-teilpaket-h-concurrency.mjs` weiterhin 21/0 (unverändert).
- Neue Beweis-Skripte `gegenprobe-teilpaket-h-rpc-postgres.mjs` (20/0) und
  `gegenprobe-teilpaket-h19-poll.mjs` (6/0), beide grün.
- `src/ShuttleLeitstelle.jsx` in Chat 2 an **keiner Stelle** verändert - alle
  Chat-2-Commits betreffen ausschließlich Testdateien und Doku.

## Nebenbefund: Grep-Regex-Artefakt beim Duplikat-Check

Der Standard-Duplikat-Check (`grep -oE '^function [a-zA-Z]+' | sort | uniq -d`)
meldete zu Sessionbeginn 8x "function c" als vermeintliches Duplikat. Ursache:
die Regex `[a-zA-Z]+` enthält keine Ziffern und bricht deshalb bei Namen wie
`c3RideStartAbsMin`, `c3AbsToParts` usw. (Teilpaket-C3-Konvention) direkt nach
dem `c` ab - kein echtes Duplikat, reines Regex-Artefakt. Mit
`[a-zA-Z0-9_]+` bestätigt: 0 echte Duplikate. Für künftige Sessions relevant,
falls der Kurzbefehl aus der Projekt-Doku 1:1 übernommen wird.

## Nebenbefund: veralteter Testfall behoben

`smoke-import-dauer.mjs` Fälle 17/18 gingen noch vom Stand vor dem
matchLoc-/Orts-Fix (`bb868a4`) aus ("matchLoc bleibt bei `__custom`"). Der
spätere, absichtliche Fix hat das geändert (matchLoc erkennt München/Leonardo
jetzt echt), ohne dass dieser ältere Test nachgezogen wurde. Mit Jordans
Freigabe korrigiert (nur Erwartungswerte + Kommentar, kein App-Code). Jetzt
18/18. Commit `0b1b60c`.

## Neue Dateien (Chat 2)

`gegenprobe-teilpaket-h-rpc-postgres.mjs`, `gegenprobe-teilpaket-h19-poll.mjs`,
`TEILPAKET-H-BERICHT.md`, `TEILPAKET-H-ABNAHME.md`, `TEILPAKET-H-MIGRATION.md`.
Geändert: `smoke-import-dauer.mjs` (2 Erwartungswerte).

## Weitere gefundene Punkte für spätere Sessions

1. **KRITISCH** - One-Tap-Zuweisung `quickAssign` (Z. 9725-9738 Stand Chat 1):
   `async` machen, `await`en, bei `!res.ok` sichtbare Meldung, `triggerPush`
   erst nach Erfolg. Verdrahtungsplan + Freigabe in eigener Session.
2. **KRITISCH** - Drag-and-Drop `applyDrop` (Z. 9761-9781 Stand Chat 1):
   identisches Muster wie 1.
3. **MITTEL** - Stage-Manager-Problemmeldung `reportIssue` (Z. 3280-3293
   Stand Chat 1): dito, append-only (kein Clobber), aber stiller Fehlschlag
   möglich.
4. **MITTEL/NIEDRIG** - Gast-Aktionen (3613/3635/3652 Stand Chat 1): gleiche
   Klasse, niederfrequent; nach Deploy über dedizierte `guest_*`-RPCs lösbar.
5. **NIEDRIG** - Dev "alle Fahrten löschen" (11203 Stand Chat 1):
   Entwickler-Werkzeug mit `confirm`, aber fire-and-forget.
6. **NIEDRIG** - H19 Poll-Race (Z. 951/962): monotoner Schutz möglich, siehe
   `TEILPAKET-H-MIGRATION.md`. Von Jordan explizit für jetzt zurückgestellt.
7. Architekturnotiz (nicht unter Freeze änderbar): grobkörniges einzelnes
   `dyn_rev` für den ganzen Rides-Blob statt Per-Ride-rev - siehe
   `TEILPAKET-H-MIGRATION.md`.

Alle Punkte 1-6 sind isolierte Einzelfixe, keiner davon braucht einen
Architekturumbau. Punkt 7 wäre eine echte Migration (Post-Festival).
