# Ergebnisbericht: Vor-Festival-Sicherheitsphase

Stand: 19.07.2026. Rücksetzpunkt vor dieser Änderung: **`e6d3a34`** (9076 Zeilen, Working Tree
davor clean, verifiziert per `git fetch` zu Beginn der Session).

---

## 1. Geänderte Dateien

- `src/ShuttleLeitstelle.jsx` — Produktivcode, 62 Zeilen hinzugefügt, 14 entfernt (netto +48,
  9124 statt 9076 Zeilen).
- `test_passengercount_safety.mjs` — neu, Testkatalog (Schritt 4), testet den echten Code per
  Export+Import (gleiches Muster wie `rendertest.mjs`), keine Nachbildung.
- `SCHRITT-1-Live-Datenpruefung.md` — neu, Checkliste + read-only SQL-Abfrage (Schritt 1).
- `pruefe-fahrerabgleich.mjs` — neu, Abgleich-Skript für das Ergebnis der SQL-Abfrage gegen
  `drivers_openbeatz.json`.
- `drivers_openbeatz.json` — neu im Repo, reine Referenzdaten (war zuvor nur im Chat vorhanden).

## 2. Geänderte Funktionen (bestätigt per `pruefe.mjs`-Diff gegen `e6d3a34`)

- **`evaluateInsertion`** (Kernstelle): `need` kommt jetzt aus der neuen `validPassengerCount()`
  statt `ride.passengerCount || 1`. Neues Feld `capacityUnknown` im Rückgabewert. `eligible` ist
  bei `capacityUnknown` immer `false`. Neue, eigene Problem-Meldung "Personenzahl fehlt – Kapazität
  kann nicht geprüft werden", unterscheidbar von "zu wenig Sitzplätze".
- **`AssignModal`**: neuer Warnbanner (exakter Text wie gefordert), Vorschlagsliste zeigt bei
  `capacityUnknown` einen eigenen Hinweis statt der normalen Liste, die manuelle Zuweisungsliste
  sperrt jeden Fahrer-Button hart (`disabled`) statt wie bisher per `window.confirm(...)`
  übergehbar zu sein. Kopfzeile zeigt `?` statt `undefined` bei fehlender Zahl.
- **`RideForm`**: Eingabefeld zeigt bei fehlender Zahl jetzt leer statt vorbelegt mit "1"
  (verhindert, dass bloßes Öffnen+Speichern einer alten Fahrt die fehlende Zahl unbemerkt auf "1"
  festschreibt). Speichern nutzt `validPassengerCount()` statt `Number(...) || 1`, speichert `null`
  statt "1" bei ungültiger Eingabe. Neuer, weicher Hinweis im bestehenden `inputWarnings`-Muster
  (blockiert das Speichern NICHT, wie von der bestehenden Konvention vorgegeben).
- **`parseRow`** (CSV/Excel-Import): gleicher Fix, `validPassengerCount(get(...))` statt
  `Number(get(...)) || 1`.
- **Neu: `validPassengerCount(v)`**: zentrale, einmal definierte Prüf-Funktion, von allen vier
  obigen Stellen genutzt (kein zweiter, abweichender Maßstab an verschiedenen Stellen).

**Nicht verändert** (per Diff bestätigt, 287 von 291 Bausteinen byte-identisch): `DriverApp`,
`StageApp`, `GuestApp`, `IssueModal`-Varianten, `MissionStyles`, `Field`, `SettingsTab`,
`LocSelect`, `updateDyn`, `matchLoc`, alle vier Zuteilungswege bis auf die reine Eligibility-Prüfung
selbst (die Schreiblogik der vier Wege wurde NICHT angefasst, siehe Abschnitt 5 unten).

## 3. Genaue Verhaltensänderung

**Vorher:** Eine Fahrt ohne (oder mit ungültiger) Personenzahl wurde intern still als "1 Person"
behandelt. Jeder Fahrer, auch ein 4-Sitzer-Auto, galt als kapazitiv geeignet, ohne jeden Hinweis,
dass die tatsächliche Zahl unbekannt war. Zuteilung war ganz normal möglich.

**Jetzt:** Bei fehlender/ungültiger Personenzahl (`undefined`, `null`, `""`, `"   "`, `0`, `"0"`,
nicht-numerische Strings, negative Zahlen, Dezimalzahlen) gilt **kein** Fahrer mehr als kapazitiv
geprüft. Im Zuteilungsdialog erscheint der geforderte Warnbanner, die Vorschlagsliste bleibt leer,
und **keine** der beiden Zuteilungswege in diesem Dialog (Vorschlag antippen, manuell zuweisen inkl.
Override-Bestätigung) lässt sich mehr abschließen — die Buttons sind hart gesperrt, nicht nur
markiert. Gültige Personenzahlen (positive ganze Zahl) funktionieren exakt wie zuvor, keine
Verhaltensänderung dort.

Beim Speichern einer Fahrt (neu oder bearbeitet) wird eine fehlende/ungültige Zahl ab sofort nicht
mehr still zu "1" — sie bleibt als fehlend gespeichert (`null`), mit sichtbarem, nicht-blockierendem
Hinweis im Formular. Gleiches beim CSV/Excel-Import.

**Bewusst nicht verändert:** bestehende, bereits gespeicherte Fahrten mit dem alten, silently
defaulteten Wert "1" werden nicht rückwirkend angefasst (keine Migration, wie gefordert) — diese
sind vom Datenmodell her nicht mehr von einer echt eingetragenen "1" unterscheidbar. Siehe
Restrisiken.

## 4. Testergebnisse

**Neu, `test_passengercount_safety.mjs`, gegen den echten Code (nicht nachgebaut):**
24 von 24 Prüfungen bestanden. Deckt alle 10 geforderten Rohwerte (undefined/null/""/"   "/0/"0"/
"abc"/-1/1/"6"), die drei Personen-Sitze-Kombinationen (6/6, 7/6, 7/7), den Vorschlagsdialog-Fall
(leere Vorschlagsliste + alle Fahrer capacityUnknown+nicht eligible bei fehlender Zahl), unveränderte
bestehende Vorschläge bei gültiger Zahl, sowie Seiteneffektfreiheit (keine Mutation von `ride`/
`setup`).

**Bestehende Regressionstests, alle weiterhin grün:**
- `test_onetap_assign.mjs`: 14/14
- `test_ridelist_empty.mjs`: 10/10
- `smoke.mjs`: RideForm/AssignModal/WhatsAppModal — überall 0 Classic-Reste
- `rendertest.mjs`: alle 5 Referenzwerte exakt unverändert (App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101)
- `kontrast.mjs`: alle Werte weiterhin AA-konform, keine neuen Verstöße
- `pruefe.mjs` (Diff `e6d3a34` → jetzt): genau 4 geänderte Bausteine + 1 neuer, 0 entfernt, 287 von
  291 unverändert, keine undefinierten `var(--mc-*)`

**Manuell nicht headless testbar, per Code-Lesen verifiziert:** dass die Buttons im UI tatsächlich
`disabled` sind bei `capacityUnknown` — das folgt direkt aus `disabled={assigning || ev.capacityUnknown}`
im JSX, aber ein echter Klick-Test bräuchte einen Browser/E2E-Test, nicht Teil dieser Testebene.
Empfehlung: einmal manuell im Fahrertest/vor dem Festival kurz durchklicken.

## 5. Bekannte Restrisiken

1. **Schritt 5 nicht umgesetzt.** Timeline-Schnellzuteilung (`quickAssign`) und Drag&Drop
   (`applyDrop`) awaiten `updateDyn` nicht und haben keine Fehleranzeige. Der doppelte-Zuteilung-
   Case aus der Race-Condition-Analyse (Phase 0b, Abschnitt 6) bleibt für diese zwei Wege bestehen.
   AssignModal und Chat-Assistent wären technisch absicherbar gewesen, wurden aber bewusst NICHT
   isoliert nur für zwei von vier Wegen umgesetzt, um keine trügerische Teilsicherheit zu erzeugen.
2. **Altdaten nicht erkennbar.** Fahrten, die vor diesem Fix mit der alten stillen "1" gespeichert
   wurden, sind von einer echten "1" nicht mehr unterscheidbar. Der Fix wirkt ab sofort für neue/
   bearbeitete/importierte Fahrten, nicht rückwirkend.
3. **Live-Sitzzahlen noch nicht bestätigt/korrigiert.** Schritt 1 liefert nur das Werkzeug, die
   eigentliche Prüfung/Korrektur an der echten DB steht noch aus (siehe Checkliste).
4. **Drei fehlende Fahrer weiterhin nicht anlegbar über die App-UI** (siehe Phase-0b-Analyse) —
   nicht Teil dieses Auftrags, nur zur Erinnerung.

## 6. Manuelle Prüfcheckliste

Siehe `SCHRITT-1-Live-Datenpruefung.md` im Repo (read-only SQL-Abfrage + Checkliste + Abgleich-
Skript `pruefe-fahrerabgleich.mjs`). Kurzfassung der nötigen manuellen Schritte:
1. SQL-Abfrage im Supabase SQL-Editor ausführen (rein lesend).
2. Ergebnis exportieren, mir hier zurückgeben ODER `pruefe-fahrerabgleich.mjs` selbst mit dem
   Ergebnis füttern und lokal laufen lassen.
3. Abweichungen bei den vier bekannten Van-Kandidaten (Finn Steinmetz, Björn Korn, Amar Piljevic,
   Lukas Bieber) sowie den drei vermutlich fehlenden Fahrern (Leon Merg, Philipp Stich, Maximilian
   Schneider) gezielt gegenprüfen.
4. Etwaige Korrekturen NICHT automatisch, sondern erst nach deiner Bestätigung als eigener,
   separater Mini-Schritt.

## 7. Rücksetzpunkt

Vor dieser Änderung: Commit **`e6d3a34`** (main), 9076 Zeilen, Working Tree clean. Bei Bedarf:
`git checkout e6d3a34 -- src/ShuttleLeitstelle.jsx`.

## 8. Empfehlung

**GO für den Festivalbetrieb mit den umgesetzten Änderungen (Schritt 1-4).** Klein, isoliert,
vollständig getestet, 287 von 291 Code-Bausteinen nachweislich unverändert, alle bestehenden
Regressionstests weiterhin grün. Das schließt die zwei ursprünglich benannten Risiken
(Personenzahl, Sitzplatz-Sichtbarkeit im Zuteilungsdialog) für den Haupt-Zuteilungsweg.

**Restrisiko aus Schritt 5 bewusst in Kauf genommen, nicht "NO-GO"**: die Lücke bei Timeline-
Schnellzuteilung/Drag&Drop existierte schon vorher unverändert, wird durch diese Änderung weder
besser noch schlechter. Empfehlung: nach dem Festival nachziehen, wenn Zeit für die zusätzliche
Async-/UI-Arbeit an diesen zwei Wegen da ist.

**Bedingung für das GO:** Schritt 1 (Live-Datenprüfung) sollte trotzdem noch vor dem Festival
durchgeführt werden, das ist reine Datenprüfung/-korrektur, kein Code-Risiko, aber inhaltlich der
zweite der beiden ursprünglich genannten Risikopunkte.
