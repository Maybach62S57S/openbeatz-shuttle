# Teilpaket G - Abnahme (Teil G1: Logik-Kern)

Stand 20.07.2026. Alle Punkte für G1 erfüllt. G2 (UI) folgt in eigener Session.

## Sicherheit / Additivität

- [x] `pruefe`: GEAENDERT 0, ENTFERNT 0, 394/394 Bestandsbausteine byte-identisch
- [x] NEU 18 = exakt die G-Bausteine, nichts sonst
- [x] Kein Schreibweg im G-Code (kein updateDyn/Supabase/Storage) - im Smoke geprüft
- [x] Kein neues dyn-Feld, keine DB-Struktur berührt
- [x] G-Code nirgends im JSX eingebunden -> null Laufzeitrisiko fürs Festival
- [x] esbuild grün, keine doppelten Funktions-/Const-Namen

## Verhalten (Spec-Testmatrix, `smoke-teilpaket-g.mjs` 130/0)

- [x] Position nur aus Fahrplan; ohne relevante Fahrt unbekannt (keine Basis)
- [x] Aktive Fahrt -> Ziel als Position (Kennzeichnung active); stornierte ignoriert
- [x] Fahrtende über Matrix, nicht `estDurationMin`; fehlende Kante nicht bewertbar
- [x] Nächste zugeteilte Fahrt korrekt (storniert/erledigt/vor Verfügbarkeit/anderer
      Tag ausgeschlossen; Mitternacht korrekt; stabile Tie-Breaks)
- [x] Leerfahrt: Puffer 15 positiv, 14 nicht; gleicher Ort -> keine Bewegung
- [x] Rückstellung Festival: Bedarf >= 2, erreichbar, Fahrzeit <= 35 stark, sonst
      nur prüfbar; bereits am Festival / kein Bedarf -> stay
- [x] Demand Score gewichtet (overdue>driver_missing>due_soon); completed/cancelled/
      in_progress/needs_review/zugeteilt zählen nicht; Lookahead-Grenze; Knotenfilter
- [x] Deckung durch freie Fahrer (Spec 30): >= Bedarf -> keine starke Empfehlung
- [x] Erreichbarkeit über `evaluateInsertion` (Sitze, unbekannte Personenzahl)
- [x] Leonardo/HBF -> Festival über operativen Pickup Sheraton; Festival->Leonardo
      behält Anzeige-Ziel Leonardo; kein automatischer Rückweg zum Sheraton
- [x] E-Vorrang (`wait_recommended` konfliktfrei -> stay); `wait_possible` unterdrückt nicht
- [x] F nur neutraler Hinweis, nicht positionsbestimmend, F-Eingabe unverändert
- [x] not_evaluable trägt Gründe; Ranking (direct vor reposition, höherer Bedarf,
      kürzere Route, stabiler Tie-Break); genau ein Vorschlag je Fahrer
- [x] Read-only: eingefrorene Eingaben werden nicht mutiert; Sortierung kopiert

## Testqualität

- [x] `gegenprobe-teilpaket-g.mjs` 10/0: jede Mutation der echten Quelle kippt das
      erwartete Verhalten (Schwellen, Demand-Gruppen, Basis-Hardcode, E-Ignore,
      Kante-als-0, F-Gate, mutierende Sortierung)

## Offen (bewusst)

- [ ] G2: Anzeige der Vorschläge (eigene Session)
- [ ] `reposition_to_demand_zone` (Nicht-Festival-Zonen) - nach dem Festival
