# Teilpaket C3 - Timetable-Zeitbewertung (rein lesend)

Stand: 19.07.2026. Rein lesende Planungsbewertung, die auf dem C2-Match aufsetzt
und zeigt, ob eine geplante Fahrt rechtzeitig, knapp, kritisch oder zu spaet
zum Set-Beginn ankommt bzw. ob eine Rueckfahrt vor oder nach dem Set-Ende liegt.
Keine Schreibvorgaenge, keine Auto-Aenderungen, keine Live-ETA.

## Ruecksetzpunkt
- Tag `pre-teilpaket-C3` = `fc8ff23` (Stand vor dieser Session).
- Ausgangszeilenzahl 10536, nach C3: 10834.

## Geaenderte / neue Bausteine (belegt per pruefe.mjs)
- GEAENDERT (3): `AssignModal`, `RideForm`, `TimetableMatchInfo`.
- NEU (14): `TIMETABLE_WARNING_CONFIG`, `c3RideStartAbsMin`, `c3AbsToParts`, `c3HM`,
  `c3OperationalNodes`, `gradeArrivalMargin`, `c3ArrivalMessage`, `c3NeutralForMatch`,
  `evaluateTimetableTiming`, `C3_LABEL`, `c3SeverityColor`, `C3_GRADED`, `c3Diag`,
  `TimetableTimingInfo`.
- ENTFERNT: keine. 337 von 340 Bausteinen byte-identisch, keine undefinierten Referenzen.

Die drei GEAENDERTen Bausteine sind minimal und additiv:
- `TimetableMatchInfo`: optionaler `match`-Prop (bereits berechnetes Match durchreichen).
  Ohne Prop identisch zum Vorstand (rueckwaertskompatibel, im C3-UI-Smoke belegt).
- `AssignModal` / `RideForm`: Match einmal berechnen (`ttMatch`) und an C2-Anzeige und
  C3-Bewertung teilen; C3-Anzeige `<TimetableTimingInfo>` direkt unter der C2-Anzeige.
  In `RideForm` zusaetzlich `fromCustom`/`toCustom` in die abgeleitete Ride-Ansicht
  aufgenommen (operative Ortsaufloesung von Custom-Leonardo/HBF-Text). Beides additiv.

## Schwellwerte (einzige Quelle)
`TIMETABLE_WARNING_CONFIG = { arrivalOnTimeBufferMin: 40, arrivalTightBufferMin: 20, returnGraceAfterSetMin: 0 }`.
Keine zweiten Grenzwerte an anderer Stelle.

## Grenzlogik (lueckenlos, ueberschneidungsfrei)
Ankunfts-Puffer = Set-Beginn - geschaetzte Ankunft:
- Puffer >= 40 -> `on_time` (ok/gruen)
- 20 <= Puffer < 40 -> `tight` (warning/amber)
- 0 <= Puffer < 20 -> `critical` (critical/rot)
- Puffer < 0 -> `late` (critical/rot, eigenes Label "Zu spaet geplant")
Exakt zum Set-Beginn (Puffer 0) ist bewusst `critical`, nicht `late`.
Rueckfahrt (Abfahrt vom Festival gegen Set-Ende, Grace 0):
- Abfahrt >= Set-Ende -> `return_ok` (ok); exakt am Set-Ende eigenes Label.
- Abfahrt < Set-Ende -> `return_before_set_end` (critical).
Der Grader ist ueber alle Ganzminuten -120..+180 getestet: genau eine Stufe je Wert.

## Hinfahrt / Rueckfahrt / Richtung
Richtung aus den OPERATIVEN Knoten: Ziel = Festival -> Hinfahrt (`to_festival`),
Start = Festival -> Rueckfahrt (`from_festival`), sonst `none` -> `not_applicable`.
- Hinfahrt: geschaetzte Ankunft = Ride-Start + operative Fahrzeit; gegen Set-Beginn.
- Rueckfahrt: geplante Abfahrt (Ride-Start) gegen Set-Ende; Fahrzeit zum Ziel ist
  fuer die Bewertung nicht noetig (nur Diagnose).

## Fahrzeit-Quelle
Exakt der Teilpaket-B-Pfad: `resolveOperationalRideLocations` (Sheraton-Override fuer
Leonardo/HBF -> Festival) + `rideEndpointMatrixNode` + `travelMin(setup.matrix, ...)`.
`estDurationMin` wird NICHT verwendet (kann manuell/Fallback sein, nicht die operative
Matrixzeit). Fehlt die Matrixkante -> `timing_unknown`, keine Schaetzung, nie 0.

## Leonardo / HBF
- Leonardo/HBF -> Festival: operativ ab Sheraton (Fahrzeit 38), nicht ueber eine
  eigene Route. Bewertung erfolgt korrekt ueber den Sheraton-Knoten.
- Festival -> Leonardo/HBF: bleibt Rueckfahrt zum echten Ziel; Sheraton-Regel gilt hier
  nicht (nur die Abfahrtszeit gegen das Set-Ende zaehlt).

## Mitternacht
Alle Zeiten als Absolutminuten (Kalendertag * 1440 + Minuten), gleiche Tagesmathematik
wie `ttAbsMin`. Betriebstag ausschliesslich ueber `festDayKey`. Sets, die nach
Mitternacht enden/beginnen (echtes spaeteres Datum in `startAt`/`endAt`), und Fahrten
nach Mitternacht (die per `festDayKey` zur Vornacht gehoeren) werden korrekt verglichen.
Getestet: Set 23:30-00:30, Rueckfahrt 00:45, Set 01:00-02:00 (Betriebstag Vortag).

## Mehrdeutigkeit / fehlende Daten (keine harte Warnung)
- C2 nicht eindeutig (`multiple_candidates`/`no_match`/`missing_artist`/`invalid_artist`)
  -> Status gespiegelt, `severity: info`, neutrale Anzeige, keine Ampelfarbe.
- Fehlende/ungueltige Ride-Zeit oder -Datum, fehlende Fahrzeit, fehlende/ungueltige
  Set-Zeit -> `timing_unknown` (neutral), keine Schaetzung.
- Fahrt ohne Festivalbezug -> `not_applicable` (neutral).
- Zeitnaehe ohne sicheren Artist-Match erzeugt bewusst KEINE Warnung.

## UI-Integration (nur Leitstelle)
`<TimetableTimingInfo>` erscheint direkt unter der C2-Anzeige in genau zwei
Leitstellen-Komponenten: `RideForm` (Anlegen/Bearbeiten, deckt auch Rueckfahrten ab)
und `AssignModal` (Zuteilen). Nicht in DriverApp/StageApp/GuestApp (statisch belegt).
Nur bestehende, WCAG-gepruefte MC-Farbvariablen (done/assigned/problem/inset/border/
text-muted/-secondary), keine neue Farbe. Aufklappbare Diagnose je Fall (16 Felder).

## Read-only-Nachweis
`evaluateTimetableTiming` ist rein: Ride/Match/Timetable/Setup werden nicht mutiert
(JSON-Snapshots vor/nach identisch), deterministisch (`now` wird nicht zur Bewertung
genutzt -> gleiche Eingabe, gleiches Ergebnis). Statische Analyse der C3-Schicht:
keine Schreibwege/Handler (updateDyn/updateSetup/DB/Storage/onSave/onAssign/...).

## Testergebnisse (alle gruen)
- C3-Logik: 147/147 (Grenzwerte, Grid -120..+180, Spec-Beispiele, Rueckfahrt,
  Mitternacht, Leonardo/HBF, Match-Sicherheit, fehlende Daten, Read-only, Determinismus).
- C3-UI/Read-only: 35/35 (alle Status sichtbar, korrekte Labels/Farben, C2 weiter
  sichtbar, nur Leitstelle, genau zwei Einbindungen).
- Regression: esbuild gruen, keine Doppelfunktionen, keine undefinierten Referenzen,
  rendertest 5 Werte konstant (25053/2452/2413/2895/101), kontrast 0 Fehler,
  pruefe (nur 3 gewollte Aenderungen), C1 40, C1-UI 16, C2 65, C2-UI 14,
  B-Smoke 69 (B-Schicht byte-identisch), Springer 34, One-Tap 14, Personenzahl 24,
  Ridelist 10, smoke.mjs (RideForm/AssignModal Classic-Reste 0), smoke27* sauber.
- Gegenproben: kaputter Schwellwert (40->35) und verfaelschtes Label lassen die
  jeweiligen Smokes fehlschlagen -> die Tests messen echt.

## Restrisiken
- `matchLoc` (Z. ~7676) liest weiterhin nur 4 Hardcode-Orte statt `setup.locations`
  (bekannt, ausserhalb C3-Scope, unveraendert). Betrifft C3 nicht: C3 nutzt die
  Teilpaket-B-Ortsaufloesung, nicht `matchLoc`.
- `estDurationMin` bleibt fuer die uebrige Planung (evaluateInsertion) unveraendert;
  C3 nutzt sie bewusst nicht.
- Nur Vordergrund/Anzeige: C3 ist reine Planungsbewertung, keine Live-ETA.

## GO / NO-GO
GO. Additive, rein lesende Erweiterung; vollstaendige Verifikation gruen; keine
Kernpfad-Aenderung; alle Bestandsverhalten byte-identisch bis auf die drei gewollten,
minimalen und getesteten Aenderungen.
