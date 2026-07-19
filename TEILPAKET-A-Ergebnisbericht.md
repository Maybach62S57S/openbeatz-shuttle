# Teilpaket A: Springerlogik, Verfügbarkeit, Team-Kennzeichnung

Rein additive Erweiterung des bestehenden Fahrervorschlagsmotors. Kein neuer Motor,
keine Zonen, kein Timetable-Tab, keine Sammelfahrten. Stand: 2026-07-19.

## Rücksetzpunkt vor der Änderung
- Commit: `ea74666d9bf9649dc00913bc558fe8b3d0762a90`
- Tag: `pre-teilpaket-A`
- Datei vorher: `src/ShuttleLeitstelle.jsx` = 9124 Zeilen, nachher = 9261 Zeilen (+137).

## Geänderte Dateien
- `src/ShuttleLeitstelle.jsx` (Motor + UI, rein additiv)
- `supabase-schema.sql` (drei optionale Spalten, gefahrlos erneut ausführbar)
- `test_springer_availability.mjs` (neu, 34 Testfälle)
- `TEILPAKET-A-Ergebnisbericht.md` (dieser Bericht)

## Geänderte / neue Funktionen (belegt via pruefe.mjs)
- GEÄNDERT (7): `fromDbDriver`, `toDbDriver`, `evaluateInsertion`, `suggestDrivers`,
  `AssignModal`, `MissionDriversTab`, `MissionEmergencyTab`.
- NEU (10): `DRIVER_PROFILES`, `normDriverName`, `driverProfile`, `driverCategoryOf`,
  `availableFromOf`, `teamGroupOf`, `TEAM_LABEL`, `teamLabelOf`, `parseWallClock`,
  `checkDriverAvailability`.
- ENTFERNT (0): keine. `computeDriverStats` und `reasonText` blieben unangetastet.

## Neue Fahrerfelder (optional, rückwärtskompatibel)
- `driverCategory`: `"regular" | "springer"`, Default `"regular"`.
- `availableFrom`: `string | null` im lokalen Format `"YYYY-MM-DD HH:MM"`, Default `null`.
- `teamGroup`: `string | null`, Default `null`.

Bewusst NICHT `role` benutzt (kollidiert mit `session.role`). Bestehende Fahrerobjekte
ohne diese Felder funktionieren ohne Migration weiter. Kein bestehendes Feld umbenannt
oder entfernt.

### Datenquelle und Präzedenz
Die Werte stammen aus `drivers_openbeatz.json` und liegen als eingebaute Konstante
`DRIVER_PROFILES` vor (keyed auf den normalisierten Vollnamen). Präzedenz in den Helfern:
explizites Feld am Fahrerobjekt gewinnt, sonst Profil, sonst Default. Dadurch kann die DB
die Werte später überschreiben (`fromDbDriver` reicht die drei Spalten als explizite Felder
durch), ohne dass jetzt eine Pflicht-Migration nötig ist.

## Mapping-Ergebnis aller 23 Fahrer
JSON-IDs (d01..d23) matchen die App-IDs (Slugs) NICHT, daher Match über den eindeutig
normalisierten Vollnamen. Kein Fuzzy, keine automatische Zuordnung bei Mehrdeutigkeit.
Alle 23 Namen eindeutig, alle App-IDs eindeutig.

| Fahrer | App-ID | Match-Art | Kategorie | Verfügbar ab | Teamgruppe |
|---|---|---|---|---|---|
| Leon Merg | leon-merg | Name (eindeutig) | springer | - | - |
| Philipp Stich | philipp-stich | Name (eindeutig) | springer | - | - |
| Finn Steinmetz | finn-steinmetz | Name (eindeutig) | regular | - | - |
| Jassin Salah | jassin-salah | Name (eindeutig) | regular | - | - |
| Björn Korn | bj-rn-korn | Name (eindeutig) | regular | - | - |
| Daniel Sakic | daniel-sakic | Name (eindeutig) | regular | - | - |
| Dominik Dittes | dominik-dittes | Name (eindeutig) | regular | - | - |
| Amar Piljevic | amar-piljevic | Name (eindeutig) | regular | - | - |
| Tim Kostka | tim-kostka | Name (eindeutig) | regular | - | - |
| Marian Mihalca | marian-mihalca | Name (eindeutig) | regular | - | - |
| Philipp Baumeister | philipp-baumeister | Name (eindeutig) | regular | 2026-07-25 14:00 | - |
| Patrick Ibrahimi | patrick-ibrahimi | Name (eindeutig) | regular | - | timmy-team |
| Mustafa Ünver | mustafa-nver | Name (eindeutig) | regular | - | timmy-team |
| Lukas Bieber | lukas-bieber | Name (eindeutig) | regular | - | timmy-team |
| Toni Penno | toni-penno | Name (eindeutig) | regular | - | - |
| Marco Haney | marco-haney | Name (eindeutig) | regular | - | - |
| Simon Schug | simon-schug | Name (eindeutig) | regular | - | - |
| Bennet Füger | bennet-f-ger | Name (eindeutig) | regular | - | - |
| Stefan Baumann | stefan-baumann | Name (eindeutig) | regular | - | - |
| Sandro Benz | sandro-benz | Name (eindeutig) | regular | - | - |
| Karim Salah | karim-salah | Name (eindeutig) | regular | - | - |
| David Schneider | david-schneider | Name (eindeutig) | regular | - | - |
| Maximilian Schneider | maximilian-schneider | Name (eindeutig) | regular | - | - |

Sitzplatz-Check: 16 Cars mit je 4 Sitzen, 7 Vans (Patrick Ibrahimi und Mustafa Ünver
mit 7 Sitzen, die anderen 5 Vans mit 6). Konsistent mit der Fahrerdatei.

## Genaue Springerlogik
Harter zweistufiger Filter in `suggestDrivers`, KEIN zusätzlicher Score:
1. Alle Fahrer mit der bestehenden `evaluateInsertion`-Logik prüfen (Eignung = eligible,
   kein Overlap, kein offenes Issue, verfügbar).
2. Reguläre geeignete Fahrer bilden die erste Runde. Ist mindestens einer dabei, werden
   ausschließlich diese gerankt und angezeigt (bestehende Sortierung unverändert).
3. Nur wenn kein regulärer Fahrer geeignet ist, werden Springer geprüft, gerankt und mit
   `emergencySpringer: true` markiert.
Ein Springer verdrängt also nie einen geeigneten regulären Fahrer. Die Rangfolge innerhalb
jeder Gruppe bleibt exakt die bestehende (`sortFn`).

## Genaue Behandlung von availableFrom
Harter Ausschlussfilter, verglichen gegen den frühesten benötigten Einsatzbeginn, nicht
gegen die offizielle Fahrtzeit. `checkDriverAvailability(driver, ride, anfahrtMin)`:
- Fehlt `availableFrom` -> keine Einschränkung.
- Ungültiges `availableFrom` -> Fahrer gilt NICHT still als verfügbar, sondern wird mit
  sichtbarem Grund ausgeschlossen.
- neededFrom = Fahrtbeginn minus nötige Anfahrt (aus der Matrix). Ist `availableFrom` nach
  neededFrom, wird der Fahrer ausgeschlossen mit Grund im Muster
  "Fahrer erst ab HH:MM verfügbar, benötigt ab HH:MM."
- Gleichheit (availableFrom == neededFrom) gilt als verfügbar.
`parseWallClock` liest strikt `"YYYY-MM-DD HH:MM"` (auch mit T) als lokale Browser-Zeit und
verwirft ungültige Kalenderwerte. Fahrten über Mitternacht funktionieren, weil gegen die
reale Wall-Clock aus `ride.date` + `ride.time` verglichen wird, nicht gegen den Festival-Tag.

## Team-Kennzeichnung
`teamGroup` ist in dieser Phase ausschließlich sichtbare Information. Kein Einfluss auf
Score, Eignung oder Reihenfolge. Anzeige "Timmy-Team" als kleines Badge im Vorschlagsdialog
und in der Fahrerliste. Keine automatische gemeinsame Zuteilung, Blockierung oder Bevorzugung.

## UI-Änderungen (rein additiv)
- AssignModal Vorschlagsliste: Fallback-Header "Kein regulärer Fahrer verfügbar" bei aktivem
  Springer-Fallback, pro Springer ein "Springer"-Badge, pro Fahrer mit Team ein Team-Badge.
- AssignModal manuelle Fahrerliste: Status "noch nicht verfügbar" (rot) plus Ausschlussgrund
  bei `availableFrom`, plus Springer-/Team-Info. Manuelle Zuteilung bleibt per Bestätigung
  übergehbar (unverändert).
- MissionDriversTab: kleines Springer-Badge und Team-Badge neben dem Fahrernamen.
- MissionEmergencyTab Vorschlagszeile: "(Springer)"-Marker und Fallback-Hinweis.
Bestehende Vorschläge für reguläre Fahrer ohne neue Felder sehen unverändert aus.

## Bestehende Zuweisungswege
AssignModal, Timeline-Schnellzuteilung, Timeline Drag-and-drop und Chat-Assistent bleiben
technisch unverändert. `updateDyn` nicht angefasst. Die neue Logik betrifft nur die
Vorschlags- und Eignungsberechnung.

## Testergebnisse
Neuer Test `test_springer_availability.mjs`: 34 bestanden, 0 fehlgeschlagen. Deckt die
Auftragsfälle 1 bis 19 plus parseWallClock-Randfälle ab (regulär vor Springer, Fallback,
mehrere Springer, weder-noch, fehlende Felder, availableFrom vor/exakt/nach neededFrom,
Mitternacht, ungültiges availableFrom, teamGroup ohne Ranking-Einfluss, keine Mutation der
Eingabedaten, identische Eingabe -> identisches Ergebnis).

### Bestehende Regressionstests (alle grün)
- rendertest 5 Referenzwerte exakt konstant: App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
- test_passengercount_safety: 24/24
- test_onetap_assign: 14/14
- test_ridelist_empty: 10/10
- smoke, smoke27b, smoke27b-guest, smoke27b-sections, smoke27b-settings, smoke27c,
  smoke27d, smoke27e: alle grün, Classic-Reste überall 0. AssignModal 5852 Zeichen
  (Baseline 5812, +40 durch die additiven Badges).
- kontrast: keine FAILs (WCAG).
- pruefe.mjs Baseline-Vergleich: 0 entfernt, CSS-Variablen keine undefiniert benutzt.
- esbuild grün, keine doppelten Funktionsnamen, JSX-Referenz-Cross-Check aufgelöst.

## Bekannte Restrisiken
1. Echter Motor-Eingriff (`evaluateInsertion`/`suggestDrivers`) kurz vor dem Festival.
   Abgesichert durch die additive Zwei-Runden-Struktur (reguläre Fahrer verhalten sich
   exakt wie vorher, solange mindestens einer geeignet ist) und die volle Testpipeline.
2. Keine Live-Supabase-Sicht aus dieser Umgebung. Die Werte stammen aus
   `drivers_openbeatz.json` und der Profil-Konstante. Der Schema-Nachtrag und der
   DB-Override-Pfad (`fromDbDriver`) sind vorbereitet, aber der DB-Weg wurde hier nicht
   live getestet. `pruefe-fahrerabgleich.mjs` (Live vs. JSON) braucht die echten
   DB-Zeilen und ist daher offen.
3. `matchLoc` bleibt wie vereinbart unangetastet und ist nicht Teil dieses Pakets.

## Manuelle Abnahme-Checkliste
1. Fahrt wählen, bei der ein regulärer Fahrer und ein Springer frei sind.
   Erwartung: nur der reguläre Fahrer erscheint.
2. Alle regulären Fahrer testweise blockieren (Overlap/Issue).
   Erwartung: Springer erscheinen mit sichtbarem Hinweis "Kein regulärer Fahrer verfügbar".
3. Fahrt vor Philipp Baumeisters `availableFrom` (2026-07-25 14:00, minus Anfahrt) wählen.
   Erwartung: Baumeister wird ausgeschlossen, Grund sichtbar.
4. Fahrt nach dem `availableFrom`-Zeitpunkt wählen.
   Erwartung: Baumeister kann normal vorgeschlagen werden.
5. Einen Timmy-Team-Fahrer (z. B. Patrick Ibrahimi) in der Fahrerliste ansehen.
   Erwartung: "Timmy-Team"-Hinweis sichtbar, aber keine automatische Zuteilung/Bevorzugung.

## GO/NO-GO-Empfehlung
GO mit einem Vorbehalt: vor dem Live-Betrieb einmal den DB-Weg gegenprüfen (Schema-Nachtrag
einspielen oder bewusst weglassen, dann `pruefe-fahrerabgleich.mjs` mit echten DB-Zeilen
gegen `drivers_openbeatz.json` laufen lassen). Der Code selbst ist rückwärtskompatibel und
funktioniert auch ohne den Schema-Nachtrag (dann aus der Profil-Konstante).
