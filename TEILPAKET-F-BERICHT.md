# Teilpaket F1 - Sichere Sammelfahrt-Vorschlaege, Kern (Bericht)

Stand: 19.07.2026. Ruecksetzpunkt: Tag `pre-teilpaket-F` = `815e750`.
Datei: `src/ShuttleLeitstelle.jsx`. Umfang: rein additiv und rein lesend.

## 0. Slicing (bewusste Aufteilung)

Teilpaket F ist gross (Bewertungsmotor, Route/Umweg/Einsparung, C2/C3, Kapazitaet,
Fahrerkonflikte, UI fuer beide Richtungen, ~178 Testpunkte, Berichte). Um das vor
dem Code-Freeze (21.07.) sicher und einzeln pruefbar zu liefern, in Scheiben:

- **F1 (dieser Stand): reiner Logik-Kern.** 14 reine Funktionen + Konfiguration.
  KEINE UI, keine neuen Props, keine Renderpfade. Voll getestet und gegengeprueft.
- **F2 (naechste Scheibe): UI.** Read-only-Anzeige der Vorschlaege in der
  bestehenden Ansicht (`MissionReturnsTab` fuer Rueckfahrten; Hinfahrt-Host wird
  in F2 mit Jordan festgelegt), Zaehler + Filter. Kein neuer Schreibweg.
- **F3 (optional): Dreiergruppen.** Bewusst zurueckgestellt. Die Spec sagt selbst
  "Stabilitaet ist wichtiger als Dreiergruppen" (Abschnitt 31). F1/F2 liefern nur
  Paare (`maxGroupSize: 2`). Dreier nur, wenn sie spaeter sauber und performant
  moeglich sind, sonst dokumentiert als Paar-Beschraenkung.

## 1. Idee und Abgrenzung

Mehrere bestehende Fahrten koennten sinnvoll gemeinsam in einem Fahrzeug fahren
(gleiche Richtung, dicht beieinander, Kapazitaet passt, Umweg klein). F berechnet
und zeigt solche Vorschlaege **rein lesend**. Es gibt:

- keine automatische Zusammenlegung, keinen neuen Ride, keinen neuen Status,
- kein neues DB-Feld, keine gespeicherte Sammelfahrt, keinen Schreibweg,
- keine automatische Fahrer-/Fahrzeugzuweisung, keine Benachrichtigung, kein GPS.

Die Leitstelle entscheidet. Ein Vorschlag verweist immer auf die urspruenglichen
Ride-IDs; die bestehenden Fahrten bleiben unveraendert.

## 2. Wiederverwendung statt Neubau (keine Duplikate)

F1 baut ausschliesslich auf bestehende, gepruefte Bausteine auf:

- Richtung: `rideFestivalDirection` (toFestival/fromFestival/other). Kein zweiter
  Detektor (Spec 8).
- Operative Orte + Fahrzeit: `c3OperationalNodes` -> `resolveOperationalRideLocations`
  (Teilpaket B), `travelMin` (symmetrisch, fehlende Kante = `null`, nie 0).
- Betriebstag/Mitternacht: `festDayKey`, Absolutminuten `c3RideStartAbsMin`
  (mitternachtssicher), Rueckwandlung `c3AbsToParts`.
- Kapazitaet: `validPassengerCount` (null bei fehlend/ungueltig), `driver.seats`.
  Nur Sitzplatzlogik, keine Gepaeck-/Komfortlogik erfunden (Spec 17).
- C2/C3: `matchRideToTimetable`, `evaluateTimetableTiming`. Deren echte Rueckgabe-
  felder werden genutzt (siehe Abschnitt 5), kein Neuparsen.
- Zonen: bestehende `LOC_ZONE`-Zuordnung, keine neuen Zonen (Spec 23).

## 3. Zentrale Konfiguration (einzige Schwellenquelle)

```
GROUP_RIDE_CONFIG = {
  maxDepartureDifferenceMin: 20,       // groesserer Abstand -> kein positiver Vorschlag
  preferredDepartureDifferenceMin: 10, // Info-Bereich
  maxTotalDetourMin: 25,               // Obergrenze operativer Gesamtumweg
  minSavedDrivingMin: 15,              // Mindest-Einsparung fuer starke Empfehlung
  maxGroupSize: 2,                     // F1: nur Paare
}
```

Bewusste Trims gegenueber dem Spec-Entwurf (jeweils begruendet):

- `minTurnaroundBufferMin` **entfernt**: eine Sammelfahrt hat keine Wende, der
  Wert waere sinnleer.
- `maxPickupDetourMin`/`maxDropoffDetourMin` nicht als eigene Gates: der operative
  Gesamtumweg (`maxTotalDetourMin`) ist die klare, testbare Grenze. Getrennte
  Pickup/Dropoff-Detours haetten keine zusaetzliche Aussage in der Paar-Route.
- **Vier statt sechs Statuswerte.** `same_route_direct`/`already_planned` sind
  keine eigenen Status; "identische Route" laeuft ueber das Flag `identicalRoute`.
  Das haelt Statusmaschine und Ranking eindeutig.

Sichtbare Labels: group_recommended = "Sammelfahrt sinnvoll", group_possible =
"Sammelfahrt moeglicherweise sinnvoll", group_not_recommended = "Getrennte Fahrten
sinnvoller", group_not_evaluable = "Nicht sicher bewertbar".

## 4. Entscheidungskette (Statusleiter in `evaluateRidePairForGrouping`)

Reine Funktion, kanonisiert zuerst die Paarreihenfolge (fruehere Startzeit, dann
Ride-Id) fuer stabile Ausgabe. Danach:

1. Ungueltiges Paar / gleiche Fahrt -> `group_not_evaluable`.
2. Richtung ungleich oder "other" -> `group_not_recommended` (direction_incompatible).
3. Beteiligte Fahrt storniert/erledigt/laufend (cancelled/done/enroute_pickup/
   onboard) -> `group_not_recommended` (ride_state_excluded).
4. Ungueltige Zeit / unbekannter Betriebstag -> `group_not_evaluable`.
5. Unterschiedlicher Betriebstag -> `group_not_recommended`.
6. Fahrerreferenz nicht aufloesbar -> `group_not_evaluable` (driver_unresolved).
7. Personenzahl fehlt/ungueltig -> `group_not_evaluable` (passenger_count_missing).
8. Unbekannter Ort (Endpunkt nicht aufloesbar) -> `group_not_evaluable`.
9. Harte Ausschluesse: Abstand > 20, Kapazitaet reicht nicht, Umweg > 25,
   Einsparung <= 0, noetige gemeinsame Verschiebung > 20 -> `group_not_recommended`.
10. Deckelung (nur nach unten, nie Aufwertung): C3-Veto, unvollstaendige Route
    bzw. Einsparung unter 15, gemischte/zwei Fahrer -> hoechstens `group_possible`.
11. Sonst `group_recommended`.

## 5. Fachliche Details

- **Kapazitaet (Spec 17).** `combinedPassengerCount = paxA + paxB`. Passt, wenn ein
  Flottenfahrzeug genug Sitze hat (`groupFleetSeats` liefert maxSeats + kapazitiv
  passende Fahrzeug-IDs). BEWUSST keine Verfuegbarkeit behauptet - nur "welches
  Fahrzeug haette ueberhaupt genug Sitze". Fehlende Pax wird nie als 0 gewertet.
- **Fahrerzuweisung (Spec 18).** both_unassigned/same_driver koennen empfohlen
  werden; mixed (einer mit, einer ohne) und two_drivers werden auf `group_possible`
  gedeckelt (manuelle Pruefung), nie automatisch geaendert. Unbekannte Fahrer-ID ->
  not_evaluable.
- **Zeitfenster + Mitternacht (Spec 19).** `departureDifferenceMin` = Absolut-
  Abstand ueber `c3RideStartAbsMin` (mitternachtssicher, z. B. 23:55 + 00:05 = 10
  min, gleicher `festDayKey`). Gemeinsame Abfahrt = spaetere der beiden Zeiten; bei
  Rueckfahrten zusaetzlich nicht vor dem spaetesten relevanten Set-Ende. Die
  Verschiebung je Fahrt (`departureShift`) wird transparent ausgegeben, nie
  automatisch angewendet (Spec 27).
- **Hinfahrten (Spec 20).** C3-Veto: worst-of-both. `late` -> not_recommended;
  `tight`/`critical` -> hoechstens possible. Keine Feinrechnung "Marge minus Umweg";
  bewusst konservativ.
- **Rueckfahrten (Spec 21).** Set-Ende exakt aus C3 abgeleitet: `setEndAbs =
  Ride-Abfahrtsminute - minutesRelativeToSetEnd`. Gemeinsame Abfahrt nie vor dem
  spaetesten Set-Ende. `return_before_set_end` -> hoechstens possible. Uebersteigt
  die noetige Verschiebung 20 min, greift schon der harte Ausschluss (shift_too_
  large) vor dem Veto - noch konservativer.
- **Gleicher Ort / Zone / unterschiedliche Ziele (Spec 22-25).** `sameOrigin`,
  `sameDestination`, `sameZone`, `identicalRoute` werden ausgegeben. Bei
  identischer Route wird nicht neu gerechnet ausser fuer die Einsparung. Bei
  unterschiedlichen Zielen/Abholorten werden beide Reihenfolgen geprueft und die
  bessere fuer die Bewertung genutzt (nichts gespeichert).
- **Route/Einsparung/Umweg (Spec 26).** Getrennte Beine vs. beste gemeinsame
  Reihenfolge, asymmetriesicher ueber `travelMin`. Fehlt EINE noetige Kante ->
  `routeReliable: false`, keine Einsparung (null, nie 0/geschaetzt). Negative/0-
  Einsparung -> keine positive Empfehlung.
- **Ranking (Spec 30).** Deterministischer Comparator (Status, vollstaendige
  Route, keine Fahreraenderung, Kapazitaet, hoechste Einsparung, geringster Umweg,
  geringste Zeitdifferenz, stabiler Ride-Identifier). `rankGroupRideCandidates`
  sortiert eine KOPIE und markiert je Fahrt genau einen Hauptvorschlag
  (`isPrimary`); ueberlappende Kandidaten sind `overlapsPrimary`.
- **Kandidatenerzeugung/Performance (Spec 37).** `buildGroupRidePairCandidates`
  vorfiltert nach Betriebstag + Richtung + Status + gueltiger Zeit, buendelt nach
  (Tag, Richtung) und vergleicht je Bucket nur zeitlich benachbarte Paare (Fenster-
  Abbruch bei > 20 min). Keine Vollkombination ueber alle Tage.

## 6. Verifikation

- **esbuild** gruen (831.4kb), keine doppelten Funktionen.
- **pruefe** (pre-teilpaket-F `815e750` vs. Arbeitsstand): 377 -> 391 Bausteine,
  **GEAENDERT 0, ENTFERNT 0, NEU 14** (exakt die F1-Funktionen). Kein bestehender
  Top-Level-Baustein angefasst. var(--mc-*)-Check: keine undefinierte Variable.
- **Diff**: 444 Zeilen, rein additiv, 0 Loeschungen.
- **rendertest** konstant: 25053 / 2452 / 2413 / 2895 / 101.
- **kontrast**: 0 Fehler.
- **smoke-teilpaket-f.mjs** (Vollkopie der Quelle + Export, gegen die ECHTEN
  Funktionen): **120/120**. Deckt Richtung, Ausschluesse, Zeitfenster/Mitternacht,
  Betriebstag, Kapazitaet inkl. exakt-passend, Fahrerzuweisung, Route/Einsparung/
  Umweg inkl. Grenzwerte (saved 14/15, detour 25/26, saved 0), identische Route,
  asymmetrische Matrix, Zonen, C3-Veto beide Richtungen, Ranking/Primaervorschlag,
  Determinismus/Kanonisierung, Read-only und Performance-Vorfilter ab.
- **gegenprobe-teilpaket-f.mjs**: **8/8** Mutationen kippen je ein definiertes
  Verhalten (maxDepartureDifferenceMin, maxTotalDetourMin, minSavedDrivingMin,
  Kapazitaet >=/>, fehlende Kante als 0, return_before_set_end-Veto, two_drivers-
  Deckelung, mutierende Sortierung) und werden verworfen.
- **Regression** (unveraendert gruen): smoke.mjs (Classic-Reste 0),
  b/c1/c1-ui/c2/c2-ui/c3/c3-ui/d/d-ui, e (152/152), gegenprobe-e (8/8),
  27b/27b-guest/27b-sections/27b-settings/27c/27d/27e.

## 7. Read-only-Nachweis

Der F1-Kern enthaelt keinen `updateDyn`, keinen `supabase`-Aufruf, kein
`localStorage`, keinen DB-Zugriff. Kandidatenerzeugung, Bewertung, Routenvergleich,
Ranking und Sortierung sind reine Funktionen. Tests T55-T60: rideA/rideB/Fahrer/
Setup bleiben nach `evaluateRidePairForGrouping` byte-identisch; `rankGroupRide
Candidates` und `buildGroupRidePairCandidates` mutieren ihre Eingaben nicht.
Struktureller Beleg: `pruefe` GEAENDERT 0 (kein bestehender Schreibweg beruehrt).

## 8. Rollenbegrenzung (Spec 36)

In F1 trivial erfuellt: es gibt keine UI und keine Aufrufer der neuen Funktionen.
Nichts wird in Fahrer-, Stage- oder Gastansicht gerendert. Die Rollenbindung wird
in F2 durch Einbau ausschliesslich in die Leitstellen-Ansicht sichergestellt.

## 9. Bekannte Restrisiken / Grenzen (dokumentiert, nicht gefixt)

- **Airport-Zone als UNKNOWN.** `groupZoneOfNode` liest `LOC_ZONE` mit dem Matrix-
  Knoten. Fuer den Knoten "airport"/"muc" existiert kein `LOC_ZONE`-Eintrag (nur
  `airport_nue`/`airport_muc`), daher `sameZone=false` fuer Flughafen-Paare.
  Konservativ und harmlos: `sameZone` ist nur ein Anzeige-Signal, kein Status-Gate.
- **Leonardo/HBF teilen den Matrix-Knoten "sheraton".** Bei unterschiedlichen
  Anzeigezielen kann `sameDestination` operativ korrekt true werden. F aendert nie
  `ride.toId`; das ist die bestaetigte B-Aufloesung.
- **C3-Veto bewusst konservativ** (worst-of-both, keine Marge-minus-Umweg-Feinrech-
  nung). Lieber ein zu vorsichtiger als ein zu optimistischer Vorschlag.

## 10. Weitere gefundene Punkte (NICHT gefixt)

- `matchLoc` liest weiterhin nur 4 Hardcode-Orte statt `setup.locations` (bekannt,
  betrifft F nicht: F nutzt die zentrale B-Ortsauflösung). Kein neuer Punkt durch F.

## 11. Halt (Spec 43) und naechster Schritt

Ende von F1. NICHT implementiert und ohne Auftrag nicht geplant: automatische
Zusammenlegung, gespeicherte Sammelfahrt, automatische Zeit-/Ort-/Fahrer-/Fahrzeug-
aenderung, Umbuchung, Benachrichtigung, GPS. UI + manuelle Abnahme kommen in F2.

**GO/NO-GO F1:** GO. Rein additiv, 0 bestehende Bausteine geaendert, 120 Tests +
8 Gegenproben gruen, volle Regression gruen, geschuetzte Referenzwerte konstant.

### Ready-to-paste Opener fuer F2 (UI)

```
Teilpaket F2 (UI zu den Sammelfahrt-Vorschlaegen), frischer Chat. Erst
PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo: Maybach62S57S/openbeatz-shuttle,
main, letzter Code-Commit = F1-Commit (siehe git log). PAT setze ich unten ein: <PAT>
Nach Klon: git config user.name/email, npm ci, Schritt 0 komplett gruen fahren
(esbuild, Duplikat-Grep, rendertest 25053/2452/2413/2895/101, kontrast 0, pruefe
ZWEI Pfade HEAD vs Arbeitsstand, smoke.mjs Classic-Reste 0, alle bestehenden
smoke-teilpaket-* inkl. -f, gegenprobe-e und -f). Dann UEBERGABE-Session-18.md
lesen (F-Eintrag unten) und TEILPAKET-F-BERICHT.md.
Feste Regeln wie immer: rein lesend, additiv, keine Breaking Changes, nur
praesentational (className/style), keine neuen Schreibwege, kein neues dyn-Feld,
Stage/Fahrer/Gast unveraendert, ab 21.07. keine Loeschungen. Nur bestehende
WCAG-geprüfte MC-Farbvariablen, kein Alarmrot fuer group_possible.
AUFTRAG F2: buildGroupRidePairCandidates rein lesend in die Leitstellen-Ansicht
einbauen. Rueckfahrten-Seite in MissionReturnsTab (bestehender 60s-Tick, viewModels-
Memo, Filterleiste). VOR dem Bau: Hinfahrt-Host (eigene Hinfahrtenuebersicht?) mit
mir klaeren, Kartentext/Severity-Farben als Variante zeigen und meine Freigabe
abwarten. Zaehler + optionaler Filter "nur mit Sammelfahrt-Vorschlag", Aktionen nur
"Fahrten oeffnen"/"Zuweisung oeffnen", KEINE Zusammenlegen-Schaltflaeche. Danach
smoke-teilpaket-f-ui.mjs (Read-only + Rollen-Gating + Leerzustand) und volle
Regression, dann Commit/Push.
```


---

# Teilpaket F2 - UI zu den Sammelfahrt-Vorschlägen (Bericht)

Stand: 20.07.2026. Aufsetzend auf F1 (`c081e64`). Rein lesend, additiv,
ausschließlich präsentational (className/style + Anzeige). Kein neuer Schreibweg,
kein neues dyn-Feld, keine Änderung an Rollen/Workflow/DB.

## Entscheidungen (vor dem Bau mit Jordan geklärt)

- **Hinfahrt-Host:** nicht als eigene Übersicht, sondern in-context inline auf der
  Fahrtkarte, in beide Richtungen. Rückfahrten (`fromFestival`) inline in
  `MissionReturnsTab`, Hinfahrten (`toFestival`) inline im `board`/Fahrten-Tab.
  Konsistent mit dem bestehenden E-Muster (Wartefahrt-Vorschlag inline auf der
  Karte), kein neuer Nav-Eintrag, keine neue Rollen-Gating-Zeile, kein neues
  Konzept "Hinfahrten vs. Fahrten".
- **Severity-Farben (ruhig):** `group_recommended` -> Grün (`--mc-st-done`),
  `group_possible` -> Blau (`--mc-st-new`). Kein Alarmrot (`--mc-st-problem`), kein
  Amber. Darstellung als schmaler linker Akzentstrich, Farbe nur auf Icon + Label,
  Detailzeilen in `--mc-text-muted`. Deutlich ruhiger als die gefüllte E-Box.

## Was F2 gebaut hat

- **Neu (3 Bausteine, pruefe NEU):** `GroupSuggestionNote` (rein präsentationale
  Anzeige-Komponente, zeigt nur `group_recommended`/`group_possible`),
  `groupDriverHint`, `GROUP_C3_WARNING_LABEL`.
- **Geändert (2 Hosts, pruefe GEAENDERT):**
  - `MissionControl` (Shell): rein lesender `groupModel`-Memo (plan-basiert,
    `now: 0`, stabil auf `[dyn.rides, setup]`), `groupPrimaryByRide`-Lookup,
    `boardGroupPrimary`/`boardGroupCount`, `onlyGroup`-Filterstate. Im `board`-Tab:
    Filter-Toggle + Zähler "Sammelfahrt N", Leerzustand für den Filter, Notiz inline
    unter toFestival-Karten. Der Memo liegt bewusst auf Shell-Ebene (nicht im
    board-IIFE), um die Rules of Hooks nicht zu verletzen.
  - `MissionReturnsTab`: analoger `groupModel`-Memo (nutzt das vorhandene
    `ttMatchEntries`), `groupPrimaryFor`, Zähler, Toggle "nur mit Sammelfahrt",
    Integration in `passesFilters`/`anyFilter`/Filter-Reset, Notiz inline auf der
    Rückfahrt-Karte.
- **Aktionen:** genau zwei, beide über bestehende Wege - "Fahrt öffnen"
  (`onEdit`/`setEditRide` auf die Partnerfahrt) und "Zuweisung öffnen"
  (`onAssign`/`setAssignRide` auf die eigene Fahrt). **Keine**
  Zusammenlegen-Schaltfläche.

## Read-only-Nachweis

`GroupSuggestionNote` enthält keinen `updateDyn`, keinen Supabase-/Storage-Zugriff.
Beim Render von `MissionReturnsTab` und der board-Shell wird `updateDyn` nie
aufgerufen (Spy-Zähler = 0). Die Anzeige leitet sich rein aus
`buildGroupRidePairCandidates` (F1, reine Funktion) ab; die einzige F1-Nutzung ist
lesend. `pruefe`: GEAENDERT betrifft ausschließlich die zwei Anzeige-Hosts, kein
bestehender Schreibweg berührt.

## Rollenbegrenzung (Spec 36)

`GroupSuggestionNote` ist modul-eben und wird ausschließlich in `MissionControl`
(board) und `MissionReturnsTab` referenziert - nicht in `DriverApp`, `StageApp`,
`GuestApp`. Beide Hosts sind dispo-only (`returns`/`board` sind in `MC_ROLE_TABS`
für stage/driver nicht enthalten; stage = overview+emergency). Statisch und im
Smoke geprüft.

## Verifikation

- **esbuild** grün, keine doppelten Funktionen.
- **rendertest** konstant: 25053 / 2452 / 2413 / 2895 / 101.
- **kontrast**: 0 Fehler. Genutzte Akzentfarben WCAG-geprüft (done 4.93 / new 3.61
  Text-auf-soft, groß-AA).
- **pruefe** (HEAD `28b62e0` vs. Arbeitsstand): GEAENDERT 2 (MissionReturnsTab,
  MissionControl), NEU 3 (GroupSuggestionNote, groupDriverHint,
  GROUP_C3_WARNING_LABEL), ENTFERNT 0, keine undefinierte CSS-Variable.
- **smoke-teilpaket-f-ui.mjs**: 48/48. Deckt ab: ruhige Severity-Farben + kein
  Alarmrot, Kartentext (Einsparung/Umweg/Kapazität/Fahrer-Hinweis/C3-Warnung),
  routeReliable=false ohne Einsparungsbehauptung, fehlender Partner, nicht
  handlungsleitende/null-Kandidaten rendern nichts, echter Render von
  `MissionReturnsTab` mit gruppierbarem Paar (Notiz + Toggle), Solo/Leerzustand,
  **board-Renderpfad zur Laufzeit** (Toggle-Trap via geseedetem `tab="board"`),
  Read-only (updateDyn-Spy = 0 in beiden Hosts), Rollen-Gating, keine
  Zusammenlegen-Schaltfläche. Plus 2 Gegenproben (injizierter Schreibweg /
  Merge-Button würden erkannt). Counter-Proof: eine gebrochene Quelle (Alarmrot in
  der Note) erzeugt 6 gezielte FAILs.
- **Regression** unverändert grün: smoke.mjs (Classic-Reste 0),
  b/c1/c1-ui/c2/c2-ui/c3/c3-ui/d/d-ui, e (152), f (120), gegenprobe-e (8/8),
  gegenprobe-f (8/8), 27b/27b-guest/27b-sections/27b-settings/27c/27d/27e. F1-Kern
  (120) unangetastet.

## Bekannte Grenzen / bewusst nicht getan

- **F3 (Dreiergruppen) bleibt vertagt.** F1/F2 zeigen nur Paare (`maxGroupSize: 2`).
- Der board-Memo läuft über alle Tage von `dyn.rides` (Bucketing filtert intern
  nach Tag+Richtung). Bei ~60-70 Fahrten/Tag und Fenster-Abbruch unkritisch; bei
  Bedarf ließe sich später auf den aktiven Tag vorfiltern (nicht nötig).
- Die F1-Grenzen (Airport-Zone als UNKNOWN, Leonardo/HBF teilen Matrix-Knoten,
  C3-Veto konservativ) gelten unverändert und sind reine Anzeige-Signale.

**GO/NO-GO F2:** GO. Rein lesend, additiv, nur die zwei Anzeige-Hosts geändert,
48 UI-Tests + 2 Gegenproben + Counter-Proof grün, volle Regression grün,
geschützte Referenzwerte konstant. Vor dem Freeze (21.07.) sauber fertig.
