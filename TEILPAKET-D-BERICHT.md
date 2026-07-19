# Teilpaket D - Operativer Rueckfahrten-Leitstand (Abschlussbericht)

Datum: 19.07.2026. Rein lesende Professionalisierung der bestehenden
Rueckfahrten-Ansicht der Leitstelle. Keine neue Datenstruktur, keine Migration,
kein neuer Schreibweg, keine gespeicherten operativen Zustaende.

## Ruecksetzpunkt

- Tag: `pre-teilpaket-D` = `6fee451` (echter HEAD vor der Aenderung).
- Hinweis: Die Spec nannte `HEAD = c40cae5`; das ist der C3-Code-Commit. Der
  Doku-Commit `6fee451` lag darueber und war der tatsaechliche HEAD. In
  Schritt 0 verifiziert (Zeilenzahl 10834, alle fuenf alten Tags vorhanden).
- Commit dieses Teilpakets: siehe Git-Log (Commit-Message "Teilpaket D ...").
- Neue Zeilenzahl `src/ShuttleLeitstelle.jsx`: 11064 (vorher 10834).

## Geaenderte Dateien

- `src/ShuttleLeitstelle.jsx` - genau EINE bestehende Komponente geaendert
  (`MissionReturnsTab`), neun neue Top-Level-Bausteine ergaenzt, nichts entfernt.
- `smoke-teilpaket-d.mjs` (neu) - 83 Logiktests.
- `smoke-teilpaket-d-ui.mjs` (neu) - 35 UI-/Read-only-Tests.
- `TEILPAKET-D-BERICHT.md`, `TEILPAKET-D-ABNAHME.md` (neu).
- `UEBERGABE-Session-18.md` - D-Abschnitt + Opener ergaenzt.

## Bestehende Rueckfahrten-Architektur (vor der Aenderung)

- Ansicht: `MissionReturnsTab` (die Classic-`ReturnsTab` ist seit Session 19-24
  geloescht, es gab nur noch diese eine). Eingehaengt bei `tab === "returns"`.
- Rueckfahrt-Erkennung (zentral, bereits an mehreren Stellen verwendet):
  `r.dayKey === day && r.status !== "cancelled" && (r.type === "return" || r.fromId === "festival")`.
  `classify()` liefert `"return"` fuer Festival -> Sheraton/Moevenpick/Airport;
  Festival -> HBF/Leonardo fallen bei `classify` auf `"transfer"`, werden aber
  ueber `fromId === "festival"` trotzdem erfasst. Deckt Spec 21 exakt ab.
- Bisherige Gruppierung: drei Bloecke (offen ohne Fahrer / zugeteilt-unterwegs /
  erledigt) plus vier KPIs (Offen/Unterwegs/Erledigt/Probleme).
- Bereits vorhanden: Suche, Sortierung (Zeit/Ziel), einfache Overdue-Markierung,
  "naechste"-Markierung, Anwesenheits-Verwaltung (PresenceManager), Fahrer-am-
  Festival-Liste, BoardMiniMap, TimelineView.
- Fahrtstatuswerte (verifiziert, unveraendert uebernommen):
  `planned, accepted, enroute_pickup, onboard, done, cancelled`.
  nicht gestartet = planned|accepted, aktiv = enroute_pickup|onboard,
  abgeschlossen = done, storniert = cancelled (bereits herausgefiltert).

## Neue zentrale Klassifizierungsfunktion

`deriveReturnRideOperationalState({ ride, driver, timetableMatch, timingEvaluation, now, setup })`
ist die einzige Quelle der operativen Gruppierung. Rein lesend, deterministisch
fuer (ride, now), veraendert keine Eingabe. Liefert (Spec 30):

```
group, severity, label, stKey, sortPriority, scheduledDepartureAt,
minutesUntilDeparture, minutesOverdue, driverAssigned, driverResolved,
rideStarted, rideCompleted, timetableStatus, requiresReview, reasons, secondaryInfo
```

## Verwendete Gruppen und deutsche Labels

```
needs_review    -> Prüfen
overdue         -> Überfällig
driver_missing  -> Fahrer fehlt
due_soon        -> Bald fällig
driver_assigned -> Fahrer zugeteilt
in_progress     -> Läuft
not_due         -> Später
completed       -> Erledigt
```

## Prioritaetsreihenfolge (Anzeige und Filter)

`needs_review, overdue, driver_missing, due_soon, driver_assigned, in_progress,
not_due, completed` (RETURN_OPERATIONAL_GROUP_ORDER: 10..80). Entspricht Spec 6.
`Läuft` bleibt nach `Fahrer zugeteilt`: laufende Fahrten erledigen sich selbst
und brauchen weniger Aufmerksamkeit als noch offene, zeitkritische.

## Schwellenwerte (einzige Quelle: RETURN_CONTROL_CONFIG)

```
dueSoonWindowMin: 60
urgentDriverMissingWindowMin: 90
overdueGraceMin: 10
```

## Genaue Overdue-Grenze

`m` = Minuten bis Abfahrt (>0 = Zukunft). Overdue gilt bei `m < -10`, also
STRENG mehr als 10 Minuten nach Planabfahrt. Exakt 10 Minuten vorbei ist noch
NICHT overdue (Grace). 11 Minuten vorbei ist overdue. Per Test 21/22/23 belegt.

## Behandlung konkurrierender Zustaende (Entscheidungskette, Spec 8)

Genau EINE Primaergruppe pro Fahrt, in dieser Reihenfolge:

1. abgeschlossener Status (`done`) -> completed
2. aktiver Status (`enroute_pickup`/`onboard`) -> in_progress
3. harter Pruefgrund -> needs_review
4. Abfahrt mehr als 10 min vorbei (nicht gestartet/erledigt) -> overdue
5. kein Fahrer und Abfahrt bis 90 min (inkl. Grace-Zone) -> driver_missing
6. Abfahrt bis 60 min (mit Fahrer) -> due_soon
7. Fahrer vorhanden, mehr als 60 min hin -> driver_assigned
8. sonst -> not_due

Die Grace-Zone (0 bis 10 min nach Planabfahrt) faellt bewusst NICHT in
`not_due`, sondern in `due_soon` (mit Fahrer) bzw. `driver_missing` (ohne
Fahrer): unmittelbar bevorstehend, nicht "spaeter". Begruendung im Bericht,
per Test 21/27 belegt.

## Behandlung fehlender Fahrer

`driverAssigned` = echte Fahrerreferenz `ride.assignedDriverId` (nicht nur der
sichtbare Name). Zukuenftige Abfahrt bis 90 min ohne Fahrer -> `driver_missing`.
Bereits ueberfaellige Abfahrt ohne Fahrer -> primaer `overdue` mit Zusatzhinweis
"Kein Fahrer zugeteilt" (overdue hat die hoehere Prioritaet, Spec-Empfehlung).

## Behandlung unbekannter Fahrerreferenz (Spec 23)

Fahrer-ID vorhanden, Fahrerobjekt aber nicht aufloesbar -> `driver_unresolved`
in `reasons`, Zusatzhinweis "Fahrerzuweisung pruefen", Primaergruppe
`needs_review`. Keine automatische Entfernung der Fahrer-ID.

## Behandlung von C2- und C3-Ergebnissen

- C2 (`matchRideToTimetable`) und C3 (`evaluateTimetableTiming`) werden 1:1
  wiederverwendet, es gibt KEINE zweite Set-Ende-/Zeitbewertung.
- `return_before_set_end` (C3) -> needs_review + Hinweis "Rueckfahrt X min vor
  Set-Ende".
- `return_ok` allein -> KEIN Pruefgrund.
- `multiple_candidates` MIT Artist -> needs_review (Set-Zeit operativ benoetigt);
  ohne Artist -> kein erzwungenes Review.
- `no_match` mit Artist -> Zusatzhinweis "Kein passendes Timetable-Set gefunden",
  KEINE erfundene Set-Zeit, kein erzwungenes Review.
- `invalid_artist` -> needs_review.
- eindeutiger Match, aber `timing_unknown` (Set-Zeit nicht auswertbar) ->
  needs_review (`set_time_invalid`).
- `missing_artist`/`not_applicable`/`timing_unknown` bei nicht-eindeutigem Match
  werden NICHT pauschal rot dargestellt.

## Rueckfahrt vor Set-Ende (Spec 12)

Auf der Karte sichtbar: geplante Abfahrt (prominent), Set-Ende (aus C3),
Minuten vor Set-Ende (Zusatzhinweis), Artist, Fahrer, gespeicherter Fahrtstatus.
Keine automatische Anpassung der Rueckfahrt.

## Mitternachtslogik

Abfahrts-Timestamp = echte Wanduhr aus `ride.date` + `ride.time` (dayKey rollt
nur die Betriebstag-Zuordnung zurueck, date/time bleiben echt). Betriebstag
weiterhin ueber `festDayKey`. Sortierung, Ueberfaellig-Berechnung und
Set-Ende-Vergleich funktionieren ueber die Mitternachtsgrenze (Test 43-48).

## Filter

- Bestehende Suche (Artist/Ziel/Abholort/Treffpunkt) und der Sort-Umschalter
  (Zeit/Ziel) bleiben erhalten und funktionsfaehig.
- NEU: Gruppenfilter-Chips in operativer Prioritaet (Alle + acht Gruppen) plus
  "nur ohne Fahrer". Klick auf eine Zaehler-Kachel filtert die zugehoerige
  Gruppe (Toggle). Der externe Tagesfilter (`day`) bleibt unveraendert.

## Sortierung innerhalb der Gruppen (Spec 18)

- Prueflauf (needs_review): groesste Set-Ende-Abweichung zuerst, dann naechste
  Abfahrt, fehlende Daten ans Ende, dann Ride-ID.
- overdue: frueheste (staerkste) Abfahrt zuerst.
- driver_missing/due_soon/driver_assigned/in_progress/not_due: naechste Abfahrt
  zuerst.
- completed: neueste (spaeteste Planzeit) zuerst.
- Stabiler Tie-Breaker: Ride-ID. Sort-Umschalter "nach Ziel" wirkt als
  vorgelagerter Schluessel (dann Gruppensortierung).

## Uebersichtszaehler

Fuenf operative Zaehler-Kacheln (Pruefen, Ueberfaellig, Fahrer fehlt, Bald
faellig, Laeuft), ersetzen die bisherigen vier KPIs. Echte Tages-Totale,
unabhaengig von Suche/Filter. Rein lesend, Klick filtert.

## Timer / Aktualisierungslogik

Bestehender 30s-Timer auf 60s angehoben (Spec 19: hoechstens einmal pro Minute).
Reiner Re-Render (setNow), kein Schreibvorgang, kein DB-Abruf, wird beim Unmount
per clearInterval entfernt. Das operative View-Model wird EINMAL pro Render
abgeleitet und von Zaehlern, Gruppen, Filter, Sortierung und Karten gemeinsam
genutzt (memoisiert, Spec 26). Basis (C2/C3) haengt nicht von `now` ab.

## UI-Integration

Bestehende Kopfzeile, Anwesenheits-Chips, PresenceManager, Fahrer-am-Festival-
Liste, BoardMiniMap und TimelineView bleiben unveraendert erhalten. Neu:
gruppierte Abschnitte (Ueberschrift + Anzahl + Farbpunkt) in Prioritaets-
reihenfolge, Erledigt als Akkordeon. Leere Gruppen werden ausgeblendet. Alle
bestehenden Aktionen (Fahrer zuweisen, umteilen, Text, Fahrt oeffnen, Anrufen)
bleiben funktional. Nur bestehende, WCAG-gepruefte `--mc-st-*`-Farbvariablen,
keine neue Farbe.

## Read-only-Nachweis

- pruefe.mjs (alt vs. neu): GEAENDERT nur `MissionReturnsTab`, NEU die neun
  D-Bausteine, ENTFERNT keine, 353/354 byte-identisch, geschuetzte Kern-
  funktionen (DriverApp/StageApp/GuestApp/IssueModal/StageIssueModal/
  GuestIssueModal/MissionStyles/Field/inp/SettingsTab/LocSelect) unveraendert.
- deriveReturnRideOperationalState enthaelt keinen Schreibweg (Test 87-90).
- D-Ableitung/Anzeige rufen kein updateDyn auf; updateDyn wird beim Render nie
  aufgerufen (UI-Test). Die drei Presence-Handler sind byte-gleich uebernommen.
- Keine neuen gespeicherten Felder, keine Supabase-/Schema-Aenderung, keine
  Migration.

## Testergebnisse

- smoke-teilpaket-d.mjs: 83 Logiktests, 0 Fehler. Gegenproben belegt:
  dueSoonWindowMin 60->61 laesst Test 7 fehlschlagen, overdueGraceMin 10->9
  laesst Test 22 fehlschlagen.
- smoke-teilpaket-d-ui.mjs: 35 UI-/Read-only-Tests, 0 Fehler. Gegenproben
  belegt: kaputter Titel und 60000->30000 lassen die passenden Tests
  fehlschlagen.

## Regressionstests (alle gruen)

- C1 40, C1-UI 16, C2 65, C2-UI 14, C3 147, C3-UI 35, Teilpaket-B 69.
- Springer 34, One-Tap 14, Personenzahl 24, Ridelist 10.
- smoke.mjs: RideForm/AssignModal/WhatsAppModal Classic-Reste 0.
- rendertest: fuenf Referenzwerte konstant (25053/2452/2413/2895/101).
- kontrast: 0 Fehler. pruefe: keine undefinierten CSS-Variablen.
- esbuild gruen, keine doppelten Funktionen.

## Byte-Diff geschuetzter Funktionen

Alle in pruefe.mjs gelisteten Kernfunktionen "unveraendert" (353 von 354
Bausteinen byte-identisch; einzige Aenderung: MissionReturnsTab).

## Bekannte Restrisiken

- `MissionReturnsTab` ist Leitstellen-Kern; erstmals werden C2/C3 pro Fahrt in
  dieser Tab berechnet. Kosten sind vernachlaessigbar (~Anzahl Rueckfahrten pro
  Minute, memoisiert), aber neu in diesem Render-Pfad.
- Die operative Einordnung nutzt die Client-Uhr (`Date.now()`). Falsche
  Geraetezeit verschiebt Gruppen. Das war auch bei der bisherigen Overdue-
  Markierung so; kein neuer Datenpfad.
- Gruppen due_soon und driver_missing teilen sich den Amber-Farbschluessel;
  Unterscheidung ueber die Abschnittsueberschrift.

## GO / NO-GO

GO. Alle Verifikationen gruen, rein lesend, geschuetzte Funktionen byte-
identisch, keine Schema-/Migrationsaenderung. Kein Eingriff in Fahrer-, Stage-
oder Gastansicht.

## Nicht implementiert (bewusst, laut Spec)

Keine automatische Fahrerzuweisung, Rueckfahrtzeit-Aenderung, Rueckfahrt-
Erzeugung, Fahrerbenachrichtigung, Live-GPS/ETA, Warte-/Sammel-/Rueckstell-/
Leerfahrten-Automatik, keine neuen persistenten Statuswerte, keine
Supabase-Schemaaenderung.
