# Übergabe: Session 12 — Effekt 10, Teil 2 (Google-Marker gleiten weich)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert). Pro
Scheibe ein eigener Chat (lange Chats stürzen ab). Erst `PROJEKT-ANWEISUNGEN.md`
lesen, dann Repo holen, Anker prüfen, Risikoabwägung, dann nach OK bauen.

Effekt 10 (SVG) ist fertig und gepusht. Offen ist nur noch der Google-Teil, der
bewusst als eigene, kleine Scheibe läuft, weil Google-Marker keinen CSS-Weg
haben und die Interpolation per requestAnimationFrame das höhere Risiko ist.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**,
  letzter Code-Commit **`7c0d362`** (Slice 11.1, Effekt 10 SVG)
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~10.320 Zeilen)
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

---

## Session 11 fertig (Commit `7c0d362`)
Slice 11.1: Effekt 10 für die **SVG-Schema-Karte**.
- Neu `MissionDriverMarker`: Position als CSS-`transform` am äußeren `<g>` (Kinder
  relativ zu 0,0), `transition: transform var(--mc-anim-slow) var(--mc-ease)`.
  Grund: `cx/cy` transitionen nicht zuverlässig, `transform` schon.
- Neu `MissionSchematicMap`: EIN Knoten je Fahrer mit stabilem Key (Transition-
  Identität), ausgewählter nicht mehr gedoppelt sondern nur zuletzt gezeichnet
  (oben). Sprung-vs-Gleiten-Heuristik `mcMarkerAnimate` (Schwelle
  `MC_GLIDE_MAX_JUMP = 90` SVG-Einheiten): kleine Schritte gleiten, große und
  erste Erscheinung teleportieren. Letzte x/y je Fahrer in `useRef`, Update nach
  Commit via `useLayoutEffect`.
- Verdrahtung über additiven Prop (Ansatz B): `BoardMiniMap`/`MapTab` haben jetzt
  `SchematicComponent = SchematicMap` (Default = heutiges Verhalten). MC übergibt
  `SchematicComponent={MissionSchematicMap}`. Classic-Aufrufer unverändert, weil
  ohne Prop = Default = SchematicMap.
- reduced-motion greift automatisch über `.mc-scope * { transition: none }`.
- Checks: esbuild grün, keine Duplikate, Node-Test 13/13.
- Klargestellt: `MobileMapPane` (Classic-Mobile-Karte) rendert weiter das echte
  `SchematicMap` und bleibt hart, korrekt so.

---

## Offen für Session 12: Effekt 10, Teil 2 — Google-Marker gleiten weich

### Ziel
Die echten `google.maps.Marker` in `LiveGoogleMap` sollen bei
Positionsaktualisierung weich zur neuen latLng gleiten statt hart zu springen.
Nur relevant, wenn ein Google-Maps-Key gesetzt ist und der Nutzer in `MapTab`
auf „Google Maps" umschaltet (im Artifact ohne Key nicht sichtbar, deshalb
primär für Jordans Live-Test). Ohne Key bleibt alles bei der Schema-Karte, die
schon gleitet.

### Wo (Code-Stand `7c0d362`)
- `LiveGoogleMap` bei **8448**, `markersRef = useRef({})` bei **8451**.
- Update-Effekt: bestehender Marker -> `markersRef.current[d.id].setPosition(pos)`
  bei **8502**; neuer Marker `new maps.Marker(...)` bei **8505**; Aufräumen
  entfernter Marker bei **8521**.
- Helfer `prefersReducedMotion()` bei **10285** (schon vorhanden, nutzen).

### Warum eigener Mechanismus
Google-Marker haben KEINE CSS-Transition. Weiches Gleiten braucht JS-Interpolation
per `requestAnimationFrame`: alte -> neue `latLng` in Schritten über ca.
`--mc-anim-slow` (~380 ms) per `setPosition` setzen. Der `.mc-scope`-CSS-Block
fasst rAF NICHT an, also reduced-motion hier explizit per `prefersReducedMotion()`
prüfen und dann hart `setPosition` (kein Interpolieren).

### Empfohlene Strategie (Ansatz A, MC-eigen, Stabilität vor Eleganz)
- `LiveGoogleMap` wird nur in `MapTab` gerendert, und `MapTab` bekommt in MC schon
  `SchematicComponent={MissionSchematicMap}` übergeben. Für Google gibt es aktuell
  KEINE MC/Classic-Trennung, weil `LiveGoogleMap` in beiden UIs dieselbe ist.
  Zwei saubere Wege, bitte zuerst kurz mit Jordan abstimmen:
  1. Analog Ansatz B: `LiveGoogleMap` bekommt einen additiven Prop
     `glide = false` (Default = heutiges hartes `setPosition`). MC-`MapTab` reicht
     `glide` durch (MapTab müsste dann einen `glide`-Prop von der MC-Render-Stelle
     bekommen, Default false). Classic bleibt hart, MC gleitet. Kleiner Touch,
     Classic-Laufzeit identisch.
  2. Reine MC-Kopie `MissionLiveGoogleMap`. Sauberer getrennt, aber ~90 Zeilen
     Duplikat inkl. Karten-Init und InfoWindow. Für den kleinen Unterschied
     (nur der `setPosition`-Zweig) eher zu viel.
  Empfehlung: **Weg 1** (additiver `glide`-Prop), konsistent mit Slice 11.1.
- Interpolation als kleiner Helfer, rAF im Cleanup abräumen, laufende
  Interpolation je Marker sauber abbrechen, bevor eine neue startet (sonst
  überlagern sich zwei rAF-Loops auf demselben Marker). Nach Ankunft KEIN
  Dauerloop (rAF stoppen, nicht endlos weiterlaufen lassen).
- Sprung-vs-Gleiten analog SVG: sehr große latLng-Differenz (erste Anzeige,
  Fahrer taucht neu auf, GPS-Fix weit weg) -> hart setzen statt über die halbe
  Karte zu fliegen. Schwelle in Grad/Metern, klein halten.

### Risiken / Fallstricke
- rAF-Sauberkeit: pro Marker maximal ein aktiver Loop; alten `cancelAnimationFrame`
  vor neuem Start; alle Loops im Effekt-Cleanup und beim Entfernen des Markers
  (Zeile 8521-Bereich) abräumen. Sonst Loops, die nach Unmount weiterlaufen.
- Kontingent NICHT verschlechtern: Interpolation nutzt nur `setPosition` auf
  bestehenden Markern (zählt nicht als Map Load). Karte weiterhin nur einmal
  erzeugen. Nichts an der Init (8448 ff.) umbauen.
- reduced-motion: rAF ignoriert CSS, also zwingend `prefersReducedMotion()`
  abfragen -> hart.
- Node-Test für die reine Interpolations-/Schwellen-Logik (z.B.
  `lerp(a, b, t)`, Abbruchschwelle) als eigenständiges `.mjs`.
- GPS-/Datenschreibweg bleibt tabu: nur `fix.lat/fix.lng` LESEN, nichts an
  `upsert_driver_location`/`driverState` schreiben.

### Anker / Greps
```
grep -n 'function LiveGoogleMap\|markersRef\|setPosition\|new maps.Marker\|prefersReducedMotion' src/ShuttleLeitstelle.jsx
grep -n '<LiveGoogleMap\|<MapTab' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Offen für Jordans Live-Test (Umgebungsgrenze)
- SVG (Slice 11.1, jetzt live testbar auf echtem Gerät und im Artifact ohne Key):
  MC-Karte anzeigen, Zeit in Simulation schieben oder live warten -> Fahrer-Marker
  gleiten bei kleiner Bewegung weich, teleportieren bei großen Sprüngen und beim
  ersten Erscheinen. Auswahl eines Fahrers: Ring/Größe wechseln, kein Neu-Springen.
  Mit System-Einstellung „Bewegung reduzieren" -> Marker springen hart (kein Gleiten).
  Classic-Ansicht gegenprüfen: unverändert hart.
- Google (nach Slice 11.2): nur mit gesetztem `VITE_GOOGLE_MAPS_API_KEY`,
  Umschalter „Google Maps" in MapTab, Marker gleiten, reduced-motion -> hart.

## Ready-to-paste Opener für Session 12
```
Session 12, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit 7c0d362. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen. Danach UEBERGABE-Session-12.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, kein neues top-level dyn-Feld, Stage Manager
read-only. Nur transform/opacity, prefers-reduced-motion respektieren, kein
Dauerblinken. Nach jeder Aenderung esbuild + Duplikat-Grep + Referenz-Gegencheck +
Node-Test + Diff-Beleg, Push auf Feature-Branch. Bevor du baust: Scope bestaetigen,
Stelle lokalisieren, Risikoabwaegung, dann nach OK in kleinen Scheiben.
AUFTRAG SESSION 12: Effekt 10 Teil 2 (Google-Marker gleiten weich). LiveGoogleMap
bei 8448, setPosition bei 8502. rAF-Interpolation alt->neu latLng ueber ~380ms,
pro Marker nur ein Loop, alten cancelAnimationFrame vor neuem Start, alle Loops im
Cleanup/beim Marker-Entfernen abraeumen, kein Dauerloop nach Ankunft.
prefersReducedMotion() (10285) -> hart setPosition. Grosse latLng-Spruenge hart.
Verdrahtung bevorzugt ueber additiven glide-Prop (Ansatz B, Default hart), analog
Slice 11.1. Node-Test fuer lerp/Abbruchschwelle. Zur Not Google vorerst hart lassen.
```
