# Teilpaket G2 (UI zu G1) - Vorbereitung / Einbau-Kartierung

**Zweck:** Damit der G2-Chat sofort und sicher loslegen kann. Alles hier ist rein
lesende Analyse des Stands **10d7403** (G1-Commit). Zeilennummern vor dem Einbau
per grep gegenprüfen, sie können sich verschieben.

G2 ist **rein präsentational**: es zeigt die G1-Vorschläge an, ändert an der Logik
nichts. Kein neuer Ride/Status, keine Erstellen-/Umsetzen-Schaltfläche, kein
Schreibweg. `buildRepositionSuggestions` ist der einzige Einstieg.

---

## 1. G1-API (einziger Einstieg)

`buildRepositionSuggestions({ drivers, dyn, setup, now, dayKey, returnRideViewModels, waitRideSuggestions, groupRideSuggestions })`

Rückgabe:
- `ranked` - Array aller Fahrer-Vorschläge, anzeige-sortiert (direct < reposition < stay < not_evaluable, dann höherer Demand, kürzere Route, stabiler Tie-Break).
- `byDriver` - `{ [driverId]: suggestion }` (genau ein Vorschlag je Fahrer) - **das ist die primäre Lookup-Struktur für die Fahrerliste/Timeline**.
- `actionable` - nur `direct_to_next_pickup` / `reposition_to_festival`.
- `counts` - Zähler je Status.
- `driverPlannedPositions` - intern vorberechnet (für Coverage), i. d. R. nicht für die Anzeige nötig.

Einzelner Vorschlag (Felder für die Karte): `status`, `severity`
(`info` | `attention` | `neutral` | `warning`), `label` (deutscher Text),
`driverId`, `fromLocationId/Label`, `availableAt`, `toLocationId/Label`,
`nextRideId`, `demandRideIds`, `travelMinutes`, `departureAt`, `arrivalAt` (ISO),
`bufferBeforeNextRideMin`, `demandScore`, `routeReliable`, `hasConflict`,
`reasons[]`, `warnings[]`, `sortScore`.

`REPOSITION_STATUS_LABEL` liefert bereits fertige deutsche Labels.

---

## 2. Eingaben - wo sie herkommen

Alle Eingaben existieren bereits als reine Modelle. In `MissionReturnsTab`
(Z. 8282) sind sie sogar schon im Scope berechnet:

- **returnRideViewModels (D):** `viewModels` (Z. 8358) - Array `{ ride, op, ... }`
  mit `op.group` / `op.minutesUntilDeparture` / `op.driverAssigned`. Direkt als
  `returnRideViewModels` durchreichen.
- **waitRideSuggestions (E):** aus `waitModel.byReturn` (Z. 8373) ableiten:
  `[...waitModel.byReturn.values()].map(v => v.best).filter(Boolean)`. Jeder
  `best` trägt bereits `driverId` / `status` / `hasRideConflict` - exakt die
  Felder, die G1 für den E-Vorrang liest.
- **groupRideSuggestions (F):** `groupModel.primaries` (oder `groupModel.ranked`)
  aus Z. 8388 - Kandidaten mit `status` + `rideIds`. Direkt durchreichen.

Die drei Builder sind reine Funktionen und lassen sich überall dort mit
`setup/dyn/day/now` erneut per `useMemo` bilden, wo die Modelle noch nicht im
Scope sind (siehe primäre Ziele unten).

---

## 3. Anzeigeorte

### Sekundär (einfachster, risikoärmster Einstieg): `MissionReturnsTab` (Z. 8282)
Hier liegen `viewModels` / `waitModel` / `groupModel` und ein eigener `now`-Tick
(`const [now, setNow] = useState(Date.now())` + 60s-Interval, Z. ~8289/8292)
**bereits vor**. Ein zusätzliches `useMemo` mit `buildRepositionSuggestions(...)`
kostet null neue Berechnungsinfrastruktur. Anzeige z. B. als dezenter Hinweis an
der betroffenen Rückfahrt/dem Fahrer.

### Primär (gewünschtes Endbild): `MissionDriversTab` (Z. 6002) + `MissionTimelinePage` (Z. 9374)
Beide bekommen `{ setup, dyn, day }`, haben aber **nicht** die D/E/F-Modelle im
Scope (`MissionDriversTab` bildet sein `now` selbst via `dayNowMin(day)`, Z. 6009).
Zwei Wege:
- **(A) Selbstständig (empfohlen, additiv, kein Lifting):** In der jeweiligen
  Komponente per `useMemo` die drei Eingaben mit den vorhandenen reinen Buildern
  bilden (`baseModels`->`viewModels` analog Z. 8348-8361, `buildWaitRideCandidates`,
  `buildGroupRidePairCandidates`) und dann `buildRepositionSuggestions` aufrufen.
  Rein lokal, purely additive, kein Eingriff in andere Komponenten -> minimales
  Regressionsrisiko. Leicht duplizierte Berechnung, dafür isoliert.
- **(B) Hochheben in die MissionControl-Shell** und als Prop nach unten reichen:
  spart Doppelberechnung, berührt aber die Shell und mehrere Signaturen ->
  höheres Regressionsrisiko, kurz vor/nach Freeze unnötig.

**Empfehlung fürs Erste:** klein anfangen. Entweder nur sekundär in
`MissionReturnsTab`, oder primär in `MissionDriversTab` per Weg A. Timeline und
das Hochheben (B) als spätere, separate Scheibe. Jordan entscheidet den Zuschnitt.

---

## 4. now / Timer

Kein zweiter Timer nötig: `MissionReturnsTab` hat bereits einen 60s-Tick,
`MissionDriversTab`/`MissionTimelinePage` nutzen `dayNowMin(day)`. `now` ist in
G1 rechnerisch neutral (die Zeitlogik läuft über `dayKey` + Absolutminuten), dient
nur als useMemo-Abhängigkeit, damit die Anzeige mit dem Minuten-Tick der
D-Viewmodels aktuell bleibt. `now: 0` wäre ebenfalls korrekt.

---

## 5. Rollen-Gating

Gratis über `MC_ROLE_TABS` (Z. 11972): die Zielkomponenten sind bereits
role-gated Tabs (dispo sieht alle, stage/driver eingeschränkt). **Keinen neuen Tab
anlegen** -> dann ist nichts extra zu gaten.

---

## 6. Farb-/Severity-Vorschlag (Jordan-Freigabe zwingend vor dem Einbau)

Vorhandene MC-Variablen: `--mc-st-assigned` (Amber #f5a624), `--mc-st-idle`,
`--mc-st-new` (Blau), `--mc-st-enroute`, `--mc-st-done`, `--mc-st-problem` (Rot),
`--mc-brand` (Orange #ea580c). Konvention: Van=Amber, Car=Blau, **kein Alarmrot**
für G, Problem-Banner-Stil = 12% Füllung.

Vorschlag (zur Abstimmung, nicht final):
- `direct_to_next_pickup` (`info`) -> `--mc-st-new` (Blau), informativ.
- `reposition_to_festival` stark (`attention`) -> `--mc-st-assigned` (Amber), "prüfen".
- `reposition_to_festival` schwach / `stay` (`neutral`) -> `--mc-st-idle` (gedämpft).
- `not_evaluable` (`warning`) -> gedämpft/zurückhaltend, **NICHT** `--mc-st-problem`.

**Pflicht-Pause (wie bei früheren MC-Schritten):** vor dem Einbau die
Loudness-/Farbvarianten mit konkreten Kontrastzahlen zeigen und Jordans Freigabe
abwarten.

---

## 7. Verifikation für G2 (erwartete Abweichungen)

G2 berührt Render-Pfade, daher ändern sich Werte bewusst:
- `rendertest`: die fünf Referenzwerte (App-Root 25053 etc.) ändern sich **nur**,
  wenn eine der referenzierten Komponenten angefasst wird. Neue Referenzwerte nach
  Einbau festschreiben und begründen.
- `pruefe`: zeigt `GEAENDERT` für die tatsächlich angefassten Komponenten
  (erwartet), `ENTFERNT 0`, restliche Bausteine byte-identisch.
- **Neu:** `smoke-teilpaket-g2-ui.mjs` (Render-Smoke: Vorschläge erscheinen für die
  richtigen Fahrer, Read-only, keine Buttons/Schreibwege, Classic-Reste 0).
- `kontrast`: 0 Fehler inklusive der neuen G-Farbflächen.
- Bestehende G1-Tests (`smoke-teilpaket-g.mjs` 130/0, `gegenprobe-teilpaket-g.mjs`
  10/0) müssen unverändert grün bleiben (Logik unangetastet).

---

## 8. Ablauf im G2-Chat

1. Schritt 0 komplett (klonen nach `/home/claude/repo`, `npm ci`, git config,
   `git log --graph`, `git fetch`, Zeilenzahl prüfen, volle Bestands-Regression
   inkl. G1-Tests).
2. Dieses Dokument + `TEILPAKET-G-BERICHT.md` lesen, Anker per grep verifizieren.
3. **Vor jedem JSX-Eingriff:** Zuschnitt (welche Komponente zuerst), Verdrahtungs-
   plan, genaue Einfügestelle, Farbvarianten mit Kontrastzahlen und Regressions-
   risiko zeigen -> **Jordans Freigabe abwarten.**
4. Erst dann bauen, danach volle Kette + neue G2-Referenzwerte + G2-UI-Smoke +
   Diff-Beweis, Commit via `/tmp/msg.txt`, `git fetch` vor Push.

**Rollback:** `pre-teilpaket-G` = `7e797e3` (vor G1), `teilpaket-G1` = G1-Stand.
