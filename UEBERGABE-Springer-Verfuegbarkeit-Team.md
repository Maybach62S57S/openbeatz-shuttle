# Übergabe: Springer-Logik, Verfügbarkeit, Team-Kennzeichnung

Diese Übergabe schließt an `UEBERGABE_Shuttle_OpenBeatz.md` (Ursprungs-Chat, Excel-Zuteilung +
Bau-Spec), `PHASE-0-ANALYSE-Vorschlag-Knopf.md`, `PHASE-0B-ANALYSE-Ergaenzung.md` und
`SCHRITT-1/6` (Vor-Festival-Sicherheitsphase) an. Alle liegen im Repo-Root. Diese Datei fasst den
Stand zusammen, damit ein neuer Chat direkt bei Springer/`available_from`/Timmy-Team einsteigen
kann, ohne alles neu herzuleiten.

## Repo-Stand bei Abgabe dieser Übergabe

- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch `main`.
- Letzter Commit: **`d6908df`** ("Vor-Festival-Sicherheitsphase: fehlende Personenzahl nicht mehr
  still auf 1, Zuteilung dann gesperrt").
- `src/ShuttleLeitstelle.jsx`: **9124 Zeilen**.
- Working Tree bei Abgabe: clean.
- **Wichtig:** Wie immer per `git log --graph --oneline --all` und Zeilenzahl-Check gegenprüfen,
  nicht blind übernehmen (Grundregel des Projekts).

## Was seit der letzten großen Übergabe passiert ist (chronologisch)

1. **Phase-0-Analyse** (`PHASE-0-ANALYSE-Vorschlag-Knopf.md`): wichtigster Fund — ein lesender,
   reisezeit-bewusster Fahrervorschlag existiert bereits produktiv (`computeDriverStats`,
   `evaluateInsertion`, `suggestDrivers`, `reasonText`), verdrahtet in `AssignModal` und der
   Rückfahr-Ansicht. Kein Neubau nötig, nur additive Erweiterung.
2. **Phase-0b-Analyse** (`PHASE-0B-ANALYSE-Ergaenzung.md`): tiefere Prüfung mit `drivers_openbeatz.json`.
   Fahrer-Mapping, Sitzplatz-Codepfad, die vier Zuteilungswege, Race-Conditions, Matrix-Verifikation,
   16 Testfälle. Sehr wichtig für die nächste Phase, siehe "Kritische Erkenntnisse" unten.
3. **Vor-Festival-Sicherheitsphase** (`SCHRITT-1...6`, Commit `d6908df`): `passengerCount`-Silent-
   Default entfernt (`validPassengerCount()`), Zuteilung bei fehlender Personenzahl in `AssignModal`
   hart gesperrt. Race-Condition-Fix (Schritt 5) bewusst NICHT gebaut (2 von 4 Zuteilungswegen hätten
   neue Async-/UI-Infrastruktur gebraucht), auf nach dem Festival verschoben.
4. **Live-Datenbank korrigiert** (außerhalb des Codes, per SQL durch Jordan ausgeführt):
   - Die vier Vans mit falscher Sitzzahl (7 statt 6) sind korrigiert: Finn Steinmetz, Björn Korn,
     Amar Piljevic, Lukas Bieber stehen jetzt korrekt auf 6 Sitzen.
   - Die drei fehlenden Fahrer sind jetzt in der DB: **Leon Merg** (`leon-merg`, Car, SUV15),
     **Philipp Stich** (`philipp-stich`, Car, SUV16), **Maximilian Schneider**
     (`maximilian-schneider`, Van, V7, 6 Sitze).
   - Bestätigt per Kontrollabfrage: 23 Fahrer total, Vans exakt 2×7 (Patrick Ibrahimi, Mustafa
     Ünver) + 5×6, alle 16 Cars auf 4 Sitzen, keine doppelten Fahrzeug-IDs.
   - **Offen:** die drei neuen Fahrer haben noch KEINE PIN gesetzt (`pin` leer in der DB), können
     sich also noch nicht in der App einloggen. Muss noch gesetzt werden (per App-Einstellungen
     oder SQL), war bei Abgabe dieser Übergabe noch nicht erledigt.

`SHUTTLE-VORSCHLAG-SPEC.md` (die vollständige Bau-Spezifikation für Vorschlag-Knopf, Timetable,
Warnungen, Sammelfahrten, Wartefahrten, Van-Vorrangregel) und `timetable_openbeatz.json` lagen
bisher nur im Chat, nicht im Repo — sind mit dieser Übergabe jetzt mit committet.

## Kritische Erkenntnisse — bitte NICHT neu herleiten, direkt übernehmen

Diese Punkte kamen erst beim echten Code-Lesen raus, standen so nicht in der ursprünglichen Spec:

1. **`role`-Namenskollision.** `session.role` (Z. 1101, Werte `driver`/`dispo`/`stage`) ist die
   Session-Rolle. Ein neues Fahrer-Feld für die Springer-Unterscheidung darf NICHT `role` heißen.
   Vorschlag: `driverTier` (JS, camelCase) / `driver_tier` (DB-Spalte, snake_case, passend zur
   bestehenden Konvention `vehicle_type`, `first_name` etc.). Im Code steht bei Z. 8600-8620-Bereich
   (Zeile kann sich verschoben haben, per Grep `KEINE neue, unabhaengige Rollenlogik` suchen) ein
   expliziter Warnkommentar dazu.
2. **DB-Schema hat noch KEINE Spalten für Rolle/Verfügbarkeit/Team.** `supabase-schema.sql` müsste
   um `alter table drivers add column if not exists driver_tier text not null default 'regular';`,
   `available_from timestamptz;`, `timmy_team boolean not null default false;` (oder ähnlich)
   ergänzt werden — nach demselben Muster wie die bestehenden `phone`/`plate`/`pin`-Ergänzungen
   (Z. ~231-233 in `supabase-schema.sql`). Das ist jetzt ein echter Schema-Change, anders als der
   `passengerCount`-Fix, der ohne Schema-Änderung auskam.
3. **Vier, nicht ein oder drei, Zuteilungswege setzen `assignedDriverId`:** `AssignModal.onAssign`
   (aktuell Z. 8495), Timeline-Schnellzuteilung `quickAssign` (Z. 6209), Timeline-Drag&Drop
   `applyDrop` (Z. 6245), Chat-Assistent `applyChatAction` (Z. 3580). Alle laufen durch dieselbe
   sichere `updateDyn` (Z. 989), aber jede dupliziert ihre eigene Zuteilungs-Business-Logik separat.
   Für Springer-Filterung: am besten NICHT an jedem der vier Wege einzeln ansetzen, sondern wie beim
   `passengerCount`-Fix zentral in `evaluateInsertion`/`suggestDrivers` (aktuell Z. 1534 / Z. 1595),
   dann propagiert es automatisch überallhin.
4. **`djName` ist ein echtes, strukturiertes Feld** (nicht nur Freitext `passengers`), schon für den
   Gast-Link genutzt (`guestRidesFor`, normalisierter Vergleich). Timmy-Team-Fahrten lassen sich
   darüber sauber erkennen (`r.djName === "Timmy Trumpet"`, normalisiert), kein fragiles
   Freitext-Parsing nötig.
5. **`matchLoc` kennt nur 4 Orte** (airport, moevenpick, sheraton, festival), `zoneOf()` für Karl
   August/Leonardo/HBF/MUC existiert noch nicht, `matchLoc` selbst bleibt laut Absoluter Regel
   unangetastet.
6. **`validPassengerCount(v)`** (neu, Z. 1522) ist ein gutes Vorbild für additive Prüf-Funktionen:
   eine zentrale Funktion, an allen relevanten Stellen genutzt (Motor, Formular, Import), statt
   verstreuter Einzel-Fixes. Für Springer/`available_from` denselben Ansatz verwenden.
7. **Es gibt keine "Fahrer anlegen"-Funktion in der App.** Die drei neuen Fahrer wurden per
   direktem SQL-Insert angelegt (siehe `KORREKTURVORSCHLAG-Live-DB.md`, nicht mehr im Repo, war ein
   Chat-Deliverable). Für diese Phase nicht direkt relevant (Fahrer existieren jetzt alle), aber
   falls weitere Fahrer-Stammdaten-Arbeit ansteht, gilt dieselbe Einschränkung.
8. **Zeitzone/Zeitmodell:** App rechnet mit lokalen `"HH:MM"`/`"YYYY-MM-DD"`-Strings plus
   `dateForNightTime()` für Mitternacht, kein ISO/`Europe/Berlin`. Für `available_from`
   (Format in `drivers_openbeatz.json`: `"2026-07-25 14:00"`) muss der Vergleich gegen
   `ride.date`/`ride.time` über denselben Mechanismus laufen wie der Rest der App, nicht ISO
   drüberstülpen (siehe Phase-0b, Widerspruch 5).

## Live-Fahrerdaten, aktueller Stand (zur Erinnerung, per SQL bestätigt)

23 Fahrer: 16 Car (alle 4 Sitze), 7 Van (2× 7 Sitze: Patrick Ibrahimi `patrick-ibrahimi`/V4,
Mustafa Ünver `mustafa-nver`/V5; 5× 6 Sitze: Finn Steinmetz `finn-steinmetz`/V1, Björn Korn
`bj-rn-korn`/V2, Amar Piljevic `amar-piljevic`/V3, Lukas Bieber `lukas-bieber`/V6, Maximilian
Schneider `maximilian-schneider`/V7).

Springer laut `drivers_openbeatz.json`: Leon Merg (`leon-merg`), Philipp Stich (`philipp-stich`).
Timmy-Team laut Datei: Patrick Ibrahimi, Mustafa Ünver, Lukas Bieber (`timmy_team: true`).
`available_from` laut Datei: nur Philipp Baumeister (`philipp-baumeister`), `2026-07-25 14:00`.

Diese Zuordnungen (wer Springer/Timmy-Team/`available_from` ist) müssen aus `drivers_openbeatz.json`
kommen, stehen in der Live-DB noch nirgends, weil die Spalten dafür fehlen (siehe oben).

## Auftrag für den neuen Chat

Springer-Logik, Verfügbarkeit-ab-Datum, Team-Kennzeichnung (Timmy-Team) bauen, wie in
`SHUTTLE-VORSCHLAG-SPEC.md` Abschnitt 2.2 / 0 (Grundentscheidungen) beschrieben, jetzt additiv auf
den tatsächlich vorhandenen Motor (`evaluateInsertion`/`suggestDrivers`) aufgesetzt statt auf der
ursprünglichen (falschen) Annahme eines fehlenden Motors.

**Empfohlener Einstieg für den neuen Chat, Schritt 0:**
1. Repo klonen, `git log --graph --oneline --all`, Zeilenzahl gegen `9124` (oder neuer, falls
   zwischenzeitlich was dazukam) prüfen.
2. Diese Übergabe, `PHASE-0B-ANALYSE-Ergaenzung.md` und `SHUTTLE-VORSCHLAG-SPEC.md` vollständig
   lesen, in dieser Reihenfolge.
3. Die "Kritische Erkenntnisse" oben und die aktuellen Zeilenangaben per Grep gegenprüfen (können
   sich seit dieser Übergabe leicht verschoben haben).
4. Erst dann einen kurzen Umbauplan zeigen: welches DB-Schema-Update, welcher Feldname
   (`driverTier`-Vorschlag), wie die Zwei-Runden-Springer-Logik in `evaluateInsertion`/
   `suggestDrivers` andockt, ohne den bestehenden Score/die bestehende Fairness-Gewichtung zu
   ersetzen.
5. Nicht bauen, bevor der Plan bestätigt ist.

**Offene Entscheidungen, die der neue Chat mit Jordan klären muss, nicht selbst annehmen:**
- Exakter DB-Spaltenname und -Typ für die Springer-Rolle (Vorschlag: `driver_tier`).
- Ob `available_from` als `timestamptz` oder als Text im bestehenden `"YYYY-MM-DD HH:MM"`-Format
  gespeichert wird (Konsistenz mit dem restlichen Zeitmodell spricht für Text/lokal statt `timestamptz`,
  aber das ist eine Entscheidung, keine Vorwegnahme).
- Wie Timmy-Team-Fahrten konkret erkannt werden (`djName`-Match reicht vermutlich, aber gegen echte
  Ride-Daten verifizieren, nicht raten).
- PIN für die drei neuen Fahrer (siehe oben, offener Punkt aus dieser Session).

## Arbeitsweise (Kurzfassung, gilt weiter)

Deutsch, informell, keine Gedankenstriche. Erst lesen, dann Plan zeigen, dann bauen. Nach jeder
Änderung: esbuild + Dupli-Grep + `pruefe.mjs`-Diff (Vorher/Nachher-Commit) + `rendertest.mjs`
(5 Referenzwerte: App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
Field ohne mc 101 — müssen konstant bleiben) + `kontrast.mjs` + bestehende `test_*.mjs`/`smoke*.mjs`
weiterhin grün. Frischer GitHub-PAT pro Session, sofort nach dem Klonen aus der Remote-URL
gescrubbt. `git fetch` direkt vor jedem Push, nicht nur zu Sessionbeginn. Ehrliche Einschätzung vor
jeder Architektur-Entscheidung, erst nach Bestätigung bauen.

---

## Fertiger Opener-Text zum Reinkopieren in den neuen Chat

> Lies im Repo `Maybach62S57S/openbeatz-shuttle` zuerst `UEBERGABE-Springer-Verfuegbarkeit-Team.md`
> vollständig, dann `PHASE-0B-ANALYSE-Ergaenzung.md` und `SHUTTLE-VORSCHLAG-SPEC.md`. Prüfe die
> darin genannten Zeilenangaben per Grep gegen, sie können sich verschoben haben. Bau noch nichts.
> Zeig mir danach einen kurzen Umbauplan für die additive Springer-Logik, `available_from` und die
> Timmy-Team-Kennzeichnung: welches DB-Schema-Update (Spaltenname, Typ), wie es in
> `evaluateInsertion`/`suggestDrivers` andockt ohne den bestehenden Score zu ersetzen, und welche
> der in der Übergabe genannten offenen Entscheidungen du von mir brauchst, bevor du anfängst.
