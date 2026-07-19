# Teilpaket E – Sichere Wartefahrt-Vorschläge (Bericht)

Stand: 19.07.2026. Rücksetzpunkt: Tag `pre-teilpaket-E` = `2dbd3e5`
(= `8a4c107` + Testharness-Fix `extract-funcs-teilpaket-b.py`, kein App-Code).
Datei: `src/ShuttleLeitstelle.jsx`. Umfang: rein additiv und rein lesend.

## 0. Vorbemerkung zum Rücksetzpunkt (Anomalie, geklärt)

Der Tag `pre-teilpaket-E` lag beim Sessionstart bereits auf dem Remote (angelegt
rund 3 Minuten nach meinem Testharness-Fix, gleiche Committer-Identität, fremde
Tag-Nachricht). Auf `main` lag kein E-Code, kein Branch war `main` voraus. Nach
Rückfrage bestätigt: es läuft nichts parallel. Der vorhandene Tag wurde als
Rücksetzpunkt akzeptiert (nicht neu gesetzt). Historienprüfung: `c40cae5` (C3)
ist Vorfahr von `6fee451` (pre-teilpaket-D), dazwischen nur der D-Doku-Commit.

## 1. Idee und Abgrenzung

Ein Fahrer bringt jemanden zum Festival (Hinfahrt). Statt leer zurückzufahren und
später erneut anzufahren, könnte derselbe Fahrer am Festival **warten** und eine
noch unbesetzte Rückfahrt vom Festival übernehmen. Teilpaket E berechnet und zeigt
solche Vorschläge **rein lesend** an. Es gibt:

- keinen neuen Ride, keinen neuen Status, kein neues DB-Feld,
- keine automatische Zuteilung, keine Verknüpfung, keinen Schreibweg,
- keine Benachrichtigung, kein GPS.

Die Leitstelle entscheidet. Der Vorschlag nutzt ausschließlich die vorhandenen
Aktionen „Fahrer zuweisen“ und „Fahrt öffnen“.

## 2. Wiederverwendung statt Neubau (keine Duplikate)

- **Richtung:** `rideFestivalDirection` (zentrale C3-Logik). Kein zweiter Detektor.
- **Operative Orte/Ankunft:** `c3OperationalNodes` (+ Teilpaket-B-Auflösung,
  Sheraton-Pickup für Leonardo/HBF → Festival, Rückfahrt behält echtes Ziel),
  `travelMin` (Matrixzeit, `null` bei fehlender Kante, nie 0/geschätzt),
  `c3RideStartAbsMin`/`c3AbsToParts` (absolute Minuten, mitternachtssicher).
- **Konflikt/Verfügbarkeit:** `evaluateInsertion` (bestehender Motor, unverändert).
- **Rückfahrt-Status:** `RETURN_STATUS_COMPLETED`/`RETURN_STATUS_ACTIVE` (Teilpaket D).
- **Minuten-Tick:** der vorhandene 60-Sekunden-Tick der Rückfahrten-Ansicht.

`pruefe.mjs` belegt: `evaluateInsertion`, `computeDriverStats`, `suggestDrivers`,
`DriverApp`, `StageApp`, `GuestApp`, `IssueModal`, `StageIssueModal`,
`GuestIssueModal`, `Field`, `inp`, `SettingsTab`, `LocSelect` sind **byte-identisch**.
Von 363 Bausteinen ist genau **einer** geändert (`MissionReturnsTab`), 14 sind neu.

## 3. Bewertungslogik (reine Funktion `evaluateWaitRideCandidate`)

Schwellen (`WAIT_RIDE_CONFIG`): Wendezeit >= 10 min, sinnvolle Wartezeit ab 15 min,
Empfehlungsfenster bis 60 min, mögliches Fenster bis 120 min, Mindest-Einsparung
25 min für die starke Empfehlung.

Ankunft der Hinfahrt = Fahrtzeit + operative Matrixzeit (nur wenn Ziel = Festival
und Kante bekannt). Wartezeit = Rückfahrt-Abfahrt − Ankunft (absolute Minuten).

Statuszuordnung:

- Wartezeit < 0 oder < 10 min → `not_evaluable` (keine sichere Kombination).
- 10 bis < 15 min → `direct_connection` (direkter Anschluss).
- 15 bis 60 min, konfliktfrei, verfügbar, unbesetzt:
  - verlässliche Vergleichsroute mit >= 25 min Einsparung → `wait_recommended`,
  - sonst (keine verlässliche Route) → `wait_possible`.
- 61 bis 120 min, konfliktfrei, verfügbar → `wait_possible`.
- > 120 min → `return_recommended`.
- Konflikt oder nicht verfügbar im Wartefenster → `return_recommended`.
- verlässliche Route zeigt Einsparung < 25 min → `return_recommended`.
- Rückfahrt schon demselben Fahrer zugeteilt → `already_planned` (kein neuer
  dringlicher Vorschlag). Rückfahrt anderem Fahrer zugeteilt → kein Kandidat.

Das Ergebnisobjekt enthält alle Nachvollziehbarkeitsfelder (Ankunft, Abfahrt,
Wartezeit, Einsparung, Vergleichsroute-verlässlich, Konflikt-IDs, Verfügbarkeit,
Gründe, Warnungen, sortScore).

## 4. Zwei bewusste Entscheidungen (GO/NO-GO für Jordan)

### 4a. Vergleichs-Hub wird nie erfunden (Kernentscheidung, bitte bestätigen)

Ein „vermeidbare Fahrminuten“-Wert und damit `wait_recommended` (starke Empfehlung)
entsteht **nur**, wenn ein Fahrer-Hub **explizit** in `setup.config.driverHubLocationId`
gesetzt ist und auf einen bekannten Matrix-Knoten ungleich Festival zeigt. Ohne
diese Angabe bleibt `comparisonRouteReliable = false`, es wird **keine** Einsparung
behauptet, und die Bewertung fällt bevorzugt auf `wait_possible` (Spec 17/18).

Begründung: `baseLocationId` ist im Seed zwar „sheraton“, dient aber nur als
Positions-Fallback in `computeDriverStats`. Sheraton als generellen Rückkehr-Hub
zu unterstellen wäre eine erfundene Annahme (Spec 25 verbietet das ausdrücklich).

**Konsequenz im Ist-Zustand:** Da `driverHubLocationId` derzeit nicht gesetzt ist,
erscheint `wait_recommended` produktiv praktisch nicht; es dominieren
`wait_possible`, `direct_connection` und `return_recommended`. Das ist die
konservative, ehrliche Variante. **Ein einziges Konfigfeld** (`driverHubLocationId`
= z. B. „sheraton“) aktiviert die starke Empfehlung inklusive Minuten-Einsparung.

Optionen für Jordan:
1. So lassen (konservativ, keine Einsparungsbehauptung ohne Hub). Empfehlung.
2. `driverHubLocationId` in der Konfiguration setzen (dann feuert `wait_recommended`
   mit Rundlauf-Einsparung Festival ↔ Hub).

### 4b. Konfliktprüfung über den Bestandsmotor

`hasRideConflict`/`driverAvailable` stammen aus `evaluateInsertion` (Überschneidung,
zu späte Anfahrt, zu knappe Folgefahrt, availableFrom). Der Motor bleibt
unverändert. Bekannte Grenze: `evaluateInsertion` rechnet Überschneidungen in
Minuten des Tages (`sortMin`); über Mitternacht ist das das vorbestehende
Verhalten des Motors (kein E-Thema). Die Wartezeit-Mathematik von E selbst rechnet
absolut und ist mitternachtssicher (Test T100–T104).

## 5. UI (nur Leitstelle, rein lesend)

`MissionReturnsTab` wird ausschließlich in der Leitstellen-Shell gerendert
(`tab === "returns"`); DriverApp/StageApp/GuestApp sind unberührt (Rollen-Gating
ohne Zusatzcode, Spec 34). Ergänzt wurde:

- ein kompakter Wartefahrt-Block in der Rückfahrt-Karte (nur bei unbesetzter
  Rückfahrt mit handlungsleitendem Vorschlag): Kaffee-Symbol, Bewertung, Fahrer,
  geplante Ankunft, Wartezeit, Hinfahrt-Herkunft, Konfliktzeile, Einsparung bzw.
  Warnung, Hinweis „nur eine möglich“ bei Mehrfach-Bestem, Anzahl Alternativen.
- ein Filter „nur mit Wartevorschlag N“ (grün, Kaffee-Symbol) neben „nur ohne
  Fahrer“; der Reset-Knopf setzt ihn mit zurück.

Nur bestehende, WCAG-geprüfte MC-Farbvariablen (Severity → done/new/assigned/idle),
kein Alarmrot für `wait_possible`. `kontrast.mjs`: 0 Fehler. `pruefe.mjs`
var(--mc-*)-Check: keine undefinierte Variable.

## 6. Verifikation

- **esbuild** grün, keine doppelten Funktionen. Zeilen 11064 → 11469.
- **rendertest** konstant: 25053 / 2452 / 2413 / 2895 / 101.
- **kontrast**: 0 Fehler.
- **pruefe** (pre-teilpaket-E vs. Arbeitsstand): 362/363 byte-identisch,
  GEÄNDERT nur `MissionReturnsTab`, 14 NEU, 0 ENTFERNT.
- **smoke-teilpaket-e.mjs** gegen VERBATIM extrahierte Funktionen: **152/152**.
- **gegenprobe-teilpaket-e.mjs**: **8/8** Mutationen kippen ein definiertes
  Verhalten (Schwellen, Konflikt-Aus, fehlende Kante als 0, Fremdfahrer-Vorschlag,
  Comparator invertiert) und wurden verworfen.
- **Regression** (unverändert grün): smoke.mjs (Classic-Reste 0),
  b69, c1-40, c1ui16, c2-65, c2ui14, c3-147, c3ui35, d83, dui35,
  Springer34, One-Tap14, Personenzahl24, Ridelist10.
- **Read-only**: E-Kernblock ohne `updateDyn`/`supabase`/`localStorage`/DB-Aufrufe;
  eingefrorene Eingaben werfen nicht und bleiben unverändert (T125–T128).

## 7. Prioritäten (eingehalten)

Stabilität (kein Bestandscode geändert außer der einen Tab-Komponente) →
Datenintegrität (kein Schreibweg) → Sicherheit (keine neue Angriffsfläche,
Rollen-Gating erhalten) → Wartbarkeit (reine Funktionen, Tests, Gegenproben) →
Performance (Vorfilter, ein gemeinsames Memo, vorhandener Tick).

## 8. Weitere gefundene Punkte für spätere Sessions (NICHT gefixt)

- `matchLoc` liest weiterhin nur die 4 Hardcode-Orte statt `setup.locations`
  (bekannt, betrifft E nicht: E nutzt die zentrale Richtungs-/B-Ortsauflösung).
- Kein weiterer neuer Punkt durch E aufgedeckt.

## 9. Halt (Spec 42)

Ende der Umsetzung. NICHT implementiert und ohne neuen Auftrag auch nicht geplant:
automatische Zuteilung, automatische Verknüpfung, gespeicherte Wartefahrten,
Benachrichtigungen, GPS/Live-Tracking. Nächster Schritt wartet auf Jordans
Entscheidung zu 4a (Hub-Konfigfeld) und auf Freigabe/Feedback aus dem Fahrertest.
