# Übergabe: Session 11 — Effekt 10 (Kartenmarker gleiten weich)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert). Pro
Scheibe ein eigener Chat (lange Chats stürzen ab). Erst `PROJEKT-ANWEISUNGEN.md`
lesen, dann Repo holen, Anker prüfen, Risikoabwägung, dann nach OK bauen.

Effekt 10 ist der letzte offene der 10 MC-Animations-Effekte und der heikelste,
darum bewusst ein eigener, sorgfältiger Chat. Bitte in kleinen Scheiben.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**,
  letzter Code-Commit `f3c7444` (Slice 10.2, Effekt 8)
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~10.200 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, Baseline grün:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-Schreiblogik anfassen.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Nur transform/opacity animiert. `prefers-reduced-motion` respektieren. Kein Dauerblinken.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Referenz-/Icon-Gegencheck + Node-Test
  für neue reine Logik + Diff-Beleg. Push auf den Feature-Branch.

## Animations-Fundament (steht, in `MissionStyles`, 9836)
Alles unter `.mc-scope`, Tokens `--mc-anim-fast: 160ms / --mc-anim: 240ms /
--mc-anim-slow: 380ms`, Easing `--mc-ease`. Der `prefers-reduced-motion`-Block
(10032) schaltet ALLE MC-Animationen + Transitions ab (`.mc-scope *`), gilt also
automatisch auch für alles Neue, solange es unter `.mc-scope` liegt.
Vorhandene Keyframes: `mc-panel-in` (9903), `mc-pulse-ring` (9988),
`mc-flash-problem` (10001, Effekt 4), `mc-modal-in` (10016, Effekt 8),
`mc-nav-ind-in` (10021), `mc-sheet-in` (10023), `mc-entry-in` (10029).
Hilfen: `prefersReducedMotion()` (10170), `useCountUp()` (10174), `MissionCount` (10199).

## Session 10 fertig (Commits `f9fcad9`, `f3c7444`)
- **Slice 10.1 (Effekt 4):** neu gemeldete Probleme pulsieren im `MissionEmergencyTab`
  genau einmal kurz rot. Rein lesendes Seen-Set über offene issue-IDs, Seed beim
  ersten Lauf (kein Puls beim Laden), stabile issue-Signatur als Effekt-Dependency,
  Timer im Cleanup. CSS `mc-flash-problem` (box-shadow-Ring, iteration 1). Node-Test 17/17.
- **Slice 10.2 (Effekt 8):** die drei MC-Shell-Modals (AssignModal/RideForm/WhatsAppModal)
  bekommen einen Opacity-Fade-Wrapper `.mc-modal-fade` (fixed, inset:0, z-40, nur
  weiches Öffnen, Schliessen bleibt hart). Wrapper sitzt auf der bestehenden
  Modal-Ebene, damit die opacity<1-Phase das Stacking nicht verändert. Geteiltes
  Modal-Chassis und alle vier Classic-Render-Stellen unverändert.

---

## Offen für Session 11: Effekt 10 — Kartenmarker gleiten weich

### Ziel
Fahrer-Marker sollen bei Positionsaktualisierung (3s-Poll bzw. GPS-Ping) weich zur
neuen Position gleiten statt hart zu springen. NUR in MC, Classic behält den
harten Look byte-genau.

### Zwei Marker-Familien (unterschiedliche Technik!)
1. **Schematische SVG-Karte** (`SchematicMap` 8180). Ein Fahrer ist `DriverMarker`
   (8036): ein SVG-`<g>` mit Kreisen an festen `cx={pos.xy.x} cy={pos.xy.y}`
   (8045-8053). `pos.xy` kommt aus `estimateDriverPosition` (1642) /
   `projectGpsOnSegment` (1605) und wird bei jedem Poll neu berechnet. Offene
   Fahrten: `OpenRideMarker` (8061), Position über `x/y`.
2. **Echte Google-Karte** (`MapTab` 8461). Marker sind `google.maps.Marker` in
   `markersRef` (8336), versetzt per `setPosition` (8387), angelegt 8390, entfernt
   8407. MapTab hat ausserdem einen **SchematicMap-Fallback** (8535), wenn kein
   Google-Key da ist (so auch im Artifact).

### Wo die Karten in MC gerendert werden (nur diese Stellen umstellen)
- MC-Board-Minikarte: `<BoardMiniMap>` bei **9543**
- MC-Map-Tab: `<MapTab>` bei **9562**
- MC-Timeline: `<TimelineView>` (7929) wird über die geteilte Tab-Komponente
  gezogen; prüfen, ob MC dieselbe rendert und ob die Timeline-Marker überhaupt
  gleiten sollen (Timeline ist zeitbasiert, evtl. kein Kandidat).
- Classic-Render-Stellen NICHT anfassen: BoardMiniMap 3832/6061/6351/6977,
  MapTab 3851, TimelineView 6066/6357/7021/8584.

### Empfohlene Strategie (Ansatz A, Stabilität vor Eleganz)
Geteilte Bausteine NICHT editieren. Stattdessen MC-eigene Varianten bauen (z.B.
`MissionSchematicMap` + `MissionDriverMarker`) und im MC-Shell (9543/9562) statt
der geteilten Komponenten rendern. So bleibt Classic zu 100% erhalten.

**SVG (der machbare, risikoärmere Teil, zuerst):**
- Positionierung von per-Shape `cx/cy` auf ein `transform="translate(x,y)"` am
  `<g>` umstellen und `transition: transform var(--mc-anim-slow) var(--mc-ease)`
  setzen. Grund: `cx/cy` lassen sich per CSS-Transition nicht zuverlässig
  animieren, `transform` schon. Kinder-Kreise dann relativ zu 0,0 zeichnen.
- **Identität sichern**, sonst feuert keine Transition (das Element muss über die
  Renders bestehen bleiben): normale Fahrer sind ok (`key={p.driver.id}`, 8215),
  ABER der ausgewählte Fahrer wird SEPARAT ohne stabilen Key gerendert (8217) und
  `OpenRideMarker` hängt an `key={i}` (8206). In der MC-Variante alle Marker über
  einen stabilen, positions-unabhängigen Key rendern (den ausgewählten nicht als
  zweites Element doppeln, sondern denselben Knoten `selected` schalten).
- **Sprung-vs-Gleiten-Heuristik** (rein lesend, an transform-Anwendung gekoppelt):
  kleine Schritte gleiten, grosse teleportieren (erstes Erscheinen, Tageswechsel,
  GPS-Fix weit weg von der Schätzung). Umsetzung z.B. per useRef auf die letzte
  x/y je Fahrer und ein "kein-Transition-diesmal"-Flag bei Delta über Schwelle
  bzw. beim ersten Frame. KEINE Schreiblogik, nur Anzeige.
- reduced-motion: greift für die SVG-Variante automatisch über den `.mc-scope *`-
  Block, sofern die MC-Karte unter `.mc-scope` hängt (Shell-Root ist mc-scope, 9247).

**Google (der heikle Teil, eigene Sub-Scheibe oder später):**
- Google-Marker haben keine CSS-Transition. Weiches Gleiten braucht JS-Interpolation
  per requestAnimationFrame: alte -> neue latLng in Schritten über ~`--mc-anim-slow`
  setzen. rAF im Cleanup abräumen, Überlappung sauber abbrechen.
- `prefers-reduced-motion` hier per `prefersReducedMotion()` (10170) prüfen und dann
  hart `setPosition` (kein Interpolieren).
- Empfehlung: SVG zuerst als eigene Scheibe abschliessen und pushen. Google separat,
  weil eigener Mechanismus + höheres Risiko. Zur Not Google vorerst hart lassen.

### Risiken / Fallstricke
- Geteilte Bausteine: jede Änderung an `SchematicMap`/`DriverMarker`/`MapTab`
  träfe Classic. Darum MC-Varianten, kein Shared-Edit.
- `cx/cy` -> `transform`: struktureller Umbau des Markers, nicht nur eine CSS-Zeile.
  Sorgfältig testen, dass Warn-Badge (8050-8054), gestrichelter Schätz-Ring (8047)
  und Auswahl-Ring (8045) korrekt mitwandern.
- GPS-Schreibweg bleibt tabu: wir LESEN nur `pos.xy`, nichts an `upsert_driver_location`
  oder `estimateDriverPosition` anfassen.
- Kein Node-Test für die reine Logik vergessen (Sprung-vs-Gleiten-Schwelle,
  Delta-Berechnung) als eigenständiges .mjs.

### Anker / Greps (Code-Stand `f3c7444`)
```
grep -n 'function SchematicMap\|function DriverMarker\|function OpenRideMarker\|function MapTab\|function BoardMiniMap\|function TimelineView' src/ShuttleLeitstelle.jsx
grep -n 'function estimateDriverPosition\|function projectGpsOnSegment' src/ShuttleLeitstelle.jsx
grep -n 'cx={pos.xy\|key={p.driver.id}\|selectedPos && selectedPos\|<OpenRideMarker key={i}' src/ShuttleLeitstelle.jsx   # SVG-Marker + Identitaet
grep -n 'setPosition\|new maps.Marker\|markersRef' src/ShuttleLeitstelle.jsx                                            # Google-Marker
grep -n '<BoardMiniMap\|<MapTab\|<TimelineView' src/ShuttleLeitstelle.jsx                                               # Render-Stellen Classic vs MC (MC: 9543/9562)
grep -n '@keyframes mc-\|prefers-reduced-motion' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Performance-Stand (Session 9/10 geprüft)
Alle bestehenden Keyframes nur transform/opacity/box-shadow, keine neuen Endlos-Loops
ausser dem dezenten `mc-live-dot`. Effekt 4 pulst einmalig (iteration 1), Effekt 8
blendet einmalig ein. Für Effekt 10: Marker-Transitions sind je Fahrer eine
transform-Transition (GPU-kompositbar), unkritisch bei ~20 Fahrern. Bei Google
auf rAF-Sauberkeit achten (kein Dauerloop nach Ankunft).

## Offen für Jordans Live-Test (Umgebungsgrenze)
Auf echtem Desktop/Handy: Effekt 4 (Problem pulst 1x rot beim Reinkommen, kein
Dauerblinken), Effekt 8 (die drei MC-Modals öffnen weich, Schliessen instant,
Klick-daneben schliesst weiter, reduced-motion -> sofort). Nach Effekt 10: Marker
gleiten bei Bewegung, teleportieren bei grossen Sprüngen, reduced-motion -> hart.

## Ready-to-paste Opener für Session 11
```
Session 11, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit f3c7444. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen. Danach UEBERGABE-Session-11.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, kein neues top-level dyn-Feld, Stage Manager
read-only. Nur transform/opacity, prefers-reduced-motion respektieren, kein
Dauerblinken. Nach jeder Aenderung esbuild + Duplikat-Grep + Referenz-Gegencheck +
Node-Test + Diff-Beleg, Push auf Feature-Branch. Bevor du baust: Scope bestaetigen,
Stelle lokalisieren, Risikoabwaegung, dann nach OK in kleinen Scheiben.
AUFTRAG SESSION 11: Effekt 10 (Kartenmarker gleiten weich). Ansatz A, MC-eigene
Varianten (MissionSchematicMap/MissionDriverMarker), geteilte Bausteine NICHT
editieren. SVG zuerst (cx/cy -> transform + transition, Identitaet/Keys fixen,
Sprung-vs-Gleiten-Heuristik mit Node-Test), Google-MapTab per rAF-Interpolation
als eigene Sub-Scheibe oder spaeter. MC-Render-Stellen: BoardMiniMap 9543,
MapTab 9562. Classic unangetastet.
```
