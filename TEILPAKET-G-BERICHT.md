# Teilpaket G - Bericht (Teil G1: Logik-Kern)

**Stand:** 20.07.2026. **G1 fertig und verifiziert. G2 (UI) offen.**

## Ziel

Der Leitstelle rein lesend Rückstellungs- und Leerfahrt-Vorschläge zeigen: wenn
ein Fahrer nach Plan an einem operativ ungünstigen Ort frei wird, empfiehlt G
entweder eine Leerfahrt zur nächsten bereits zugeteilten Fahrt oder eine
Rückstellung zu offenem Festival-Bedarf. Ausschließlich Anzeige - kein neuer
Ride, kein Typ, kein gespeicherter Status, keine DB-Schreibung, keine
automatische Umsetzung.

## Abgrenzung

G1 (dieser Bericht) ist der reine Logik-Kern: eine Sammlung reiner Funktionen,
die nirgends im JSX eingebunden ist. G2 verdrahtet diese Funktionen in die
Anzeige (Fahrerliste/Timeline, MissionReturnsTab) und ist eine eigene Session.

`reposition_to_demand_zone` (Nicht-Festival-Bedarfszonen) ist bewusst vertagt:
es bräuchte eine zweite Bedarfsquelle (offene Hinfahrten aus `dyn.rides`) und
eine now-Absolutminuten-Umrechnung, die vor dem Freeze nicht überhastet gebaut
wird. Das Status-Feld existiert, feuert in G1 aber nie.

## Kernentscheidungen

- **Position** nur aus dem Fahrplan (aktive oder zuletzt planmäßig beendete
  Fahrt), nie aus Basis, State oder GPS. Ohne relevante Fahrt: Position unbekannt.
- **Fahrtende/Fahrzeit** über die verbindliche Matrix (`c3OperationalNodes` +
  `travelMin`), nie über `estDurationMin`. Fehlende Kante -> nicht bewertbar
  (nie 0, kein Fallback).
- **Erreichbarkeit/Konflikt/Kapazität** über den Bestandsmotor `evaluateInsertion`
  (unverändert); löst Leonardo/HBF-Pickup auf Sheraton auf.
- **Bedarf** aus den D-Rückfahrt-Viewmodels (`op.group`, `op.minutesUntilDeparture`,
  `op.driverAssigned`) als Eingabe. Nur `overdue`/`driver_missing`/`due_soon`
  zählen; `completed`/`cancelled`/`in_progress`/`needs_review`/bereits zugeteilt
  zählen nicht.
- **E-Vorrang:** ein konfliktfreier `wait_recommended` für den Fahrer schlägt jede
  G-Bewegung als Hauptvorschlag (G tritt auf `stay` zurück, kein Widerspruch).
- **F:** nur optionaler neutraler Hinweis (`group_suggestion_exists`), nie
  positionsbestimmend.
- **Keine Basis:** `baseLocationId="sheraton"` wird für G nicht als Position/Ziel
  angenommen; kein automatischer Rückweg zum Sheraton.

## Status-Modell

Je Fahrer genau ein primärer Status, Priorität (klein = wichtig):
`direct_to_next_pickup` (0), `reposition_to_festival` (1),
`reposition_to_demand_zone` (2, in G1 inaktiv), `stay_at_current_location` (3),
`not_evaluable` (4). Severity: direct -> `info`, reposition stark -> `attention`,
reposition schwach (zu weit / gedeckt) -> `neutral`, stay -> `neutral`,
not_evaluable -> `warning`. Farb-Mapping erst in G2.

## Schwellen (`REPOSITION_CONFIG`)

minArrivalBufferMin 15, preferredArrivalBufferMin 25, demandLookaheadMin 90,
maxRepositionTravelMin 35, minDemandScoreForReposition 2, Demand-Gewichte
overdue 3 / driver_missing 2 / due_soon 1 (+1 Bonus ab zwei passenden Fahrten).

## Umsetzung

18 neue Bausteine, nach `buildGroupRidePairCandidates` eingefügt (+388 Zeilen,
Datei 12055 -> 12443). Rein lesend, additiv, kein Schreibweg, kein neues dyn-Feld.

## Verifikation

- esbuild grün, keine doppelten Namen.
- rendertest 25053 / 2452 / 2413 / 2895 / 101 konstant.
- `pruefe`: GEAENDERT 0, NEU 18 (exakt die G-Bausteine), ENTFERNT 0, 394/394
  byte-identisch. Kein Bestandsbaustein berührt.
- kontrast 0 Fehler.
- Volle Bestands-Regression unverändert grün.
- `smoke-teilpaket-g.mjs`: 130 OK / 0 FAIL.
- `gegenprobe-teilpaket-g.mjs`: 10 OK / 0 FAIL (jede Quell-Mutation kippt das
  erwartete Verhalten).

## Neue Dateien

`extract-funcs-teilpaket-g.py`, `smoke-teilpaket-g.mjs`, `gegenprobe-teilpaket-g.mjs`,
`TEILPAKET-G-ABNAHME.md`.

## Weitere gefundene Punkte für spätere Sessions

Keine neuen. (Der bereits dokumentierte `travelMin`-0-Fall bei doppelt unbekanntem
Ort und das `matchLoc`-Thema bleiben unverändert und außerhalb des G-Scopes.)
