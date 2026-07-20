# Teilpaket H - Migration/Zukunft (bewusst nicht umgesetzt)

Stand 20.07.2026. Diese Datei ist ein Bauplan für spätere Sessions, kein
Protokoll bereits erledigter Arbeit. Nichts hier ist umgesetzt.

## 1. H19 - monotoner Poll-Schutz (kleiner Fix, jederzeit nachholbar)

**Problem:** `setDyn`-Apply nach dem 3s-Poll (Z. 951) und das analoge
Setup-Apply (Z. 962) prüfen nur Gleichheit der rev, nicht Aktualität. Eine
verspätete Poll-Antwort kann den lokalen State kurzzeitig auf einen älteren
Stand zurückwerfen (siehe `TEILPAKET-H-BERICHT.md`, Abschnitt b, und
`gegenprobe-teilpaket-h19-poll.mjs`).

**Vorgeschlagener Fix (per Gegenprobe bestätigt, nicht umgesetzt):**

```js
// Z. 951, statt:
setDyn((prev) => (prev && prev.rev === merged.rev && locSig === prevSig ? prev : merged));
// so:
setDyn((prev) => (prev && (merged.rev < prev.rev || (prev.rev === merged.rev && locSig === prevSig)) ? prev : merged));
```

Und analog Z. 962 für `setSetup` mit `s.rev`/`prev.rev` statt `merged.rev`.

**Einordnung:** eine Zeile pro Stelle, reine Prädikat-Änderung, kein neuer
State, kein neuer Datenfluss. Regressionsrisiko: gering, aber nicht null -
der Poll-Pfad ist der zentrale Live-Sync-Mechanismus der App, deshalb auch in
H19 bewusst NICHT ohne Freigabe angefasst. Vor Umsetzung: Verdrahtungsplan +
manuelle Testfälle (u. a. absichtlich verzögerte Poll-Antwort simulieren)
zeigen und Freigabe abwarten, wie bei jeder Core-Path-Änderung.

**Warum jetzt vertagt:** Selbstheilung binnen einem Poll-Zyklus (≤3s) reicht
für den Festivalzeitraum, kein Datenverlust. Jordans Entscheidung, siehe
Bericht.

## 2. Fire-and-forget-Fixe (One-Tap, Drag-and-Drop, Stage-Meldung)

Ebenfalls kleine, isolierte Fixe, aus Chat 1 bereits mit konkretem Muster
vorgeschlagen (siehe `TEILPAKET-H-BEFUNDE-Zwischenstand.md`):
`quickAssign`/`applyDrop`/Stage-`reportIssue` jeweils `async` machen, das
Ergebnis der Schreiboperation `await`en, bei `!res.ok` eine sichtbare Meldung
über den vorhandenen Fehlerkanal der jeweiligen Komponente zeigen, und
`triggerPush` erst nach bestätigtem Erfolg auslösen. Keine Änderung an der
eigentlichen Zuweisungs-/Statuslogik.

Jede der drei Stellen ist unabhängig von den anderen umsetzbar (nicht "alles
oder nichts"). Für die nächste Session: pro Stelle einzeln Verdrahtungsplan +
Einfügestelle + Regressionsrisiko zeigen, wie in allen anderen Teilpaketen.

## 3. Per-Ride-rev-Migration (echte Architekturmigration, Post-Festival)

**Ist-Zustand:** alle Fahrten liegen als ein JSON-Array in einem einzigen
`settings.dyn_data`-Blob, geschützt durch ein einziges `dyn_rev`. Zwei
Dispatcher, die an VERSCHIEDENEN Fahrten gleichzeitig arbeiten, kollidieren
trotzdem auf derselben rev - kein Datenverlust (sauberer Retry auf frischem
Stand), aber unnötige Wiederholungen bei höherer gleichzeitiger Last als beim
aktuellen Team (~20-22 Nutzer).

**Migrationsrichtung (nicht ausgearbeitet, nur Zielbild):** Rides-Blob zu
echten Rides-Zeilen mit je eigener rev/eigenem Lock - die `rides`-Tabelle
existiert im Schema strukturell bereits (aktuell ungenutzte Alt-Tabelle,
siehe `supabase-schema.sql` Nachtrag 5), müsste aber zur echten
Datenquelle werden statt `settings.dyn_data.rides`. Betrifft:

- Datenmodell (Blob -> Zeilen)
- Alle 34 Schreibwege (heute alle über `write_dyn_if_unchanged` mit dem
  gesamten `rides`-Array)
- Realtime-Abo (heute eine `settings`-Row, dann viele `rides`-Rows)
- Den Read-Pfad (`loadRides`/`sbGetDyn`)

**Warum das explizit KEIN H-Thema ist:** echte Architekturmigration, von H
selbst untersagt ("keine DB-Struktur-Änderungen, unless strictly necessary").
Frühestens nach dem Festival (23.-27.07.), wenn Zeit für eine vollständige
Migration mit eigener Session-Serie da ist, nicht unter Zeitdruck.

## 4. Edit-Konflikthinweis auf rev statt updatedAt (Minor, Post-Festival)

Der Konflikthinweis beim Bearbeiten einer Fahrt (Z. 12099-12105) vergleicht
`updatedAt` (Client-Zeitstempel), H würde `rev` bevorzugen. Reiner UX-
Hinweis, durch CAS + Feld-Whitelist ohnehin datensicherheitsmäßig
abgesichert - keine Dringlichkeit, siehe Zwischenstand-Doku.
