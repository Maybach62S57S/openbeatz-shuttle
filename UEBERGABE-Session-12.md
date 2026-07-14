# Übergabe: nach Session 12 — Effekt 10 komplett fertig

Hinweis: Diese Datei war ursprünglich als Vorbereitung für den Google-Teil
gedacht. Der Google-Teil wurde dann direkt in derselben Session mitgemacht,
darum ist sie jetzt eine Abschluss-Übergabe. Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute.

---

## Stand
Branch `feature/mission-control-beta`, letzter Code-Commit **`74db596`**.
Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch
`backup/paket-3-fertig`. Hauptdatei `src/ShuttleLeitstelle.jsx` (~10.360 Zeilen).

Effekt 10 (Kartenmarker gleiten weich) ist damit vollständig. Nach meinem Stand
war das der letzte offene der 10 MC-Animations-Effekte, also ist das
MC-Animationspaket komplett. Bitte gegen deine eigene Liste gegenprüfen.

## Was in dieser Session gebaut wurde

### Slice 11.1 (Commit `7c0d362`) — SVG-Schema-Karte
- `MissionDriverMarker`: Position als CSS-`transform` am äußeren `<g>` (Kinder
  relativ zu 0,0), `transition: transform var(--mc-anim-slow) var(--mc-ease)`.
- `MissionSchematicMap`: ein Knoten je Fahrer mit stabilem Key (Transition-
  Identität), ausgewählter nicht gedoppelt sondern nur zuletzt gezeichnet.
  Sprung-vs-Gleiten `mcMarkerAnimate` (Schwelle 90 SVG-Einheiten), letzte x/y
  je Fahrer in `useRef`, Update via `useLayoutEffect`.
- Verdrahtung: additiver Prop `SchematicComponent = SchematicMap` an
  `BoardMiniMap`/`MapTab`; nur die zwei MC-Render-Stellen übergeben
  `MissionSchematicMap`. Node-Test 13/13.

### Slice 11.2 (Commit `74db596`) — Google-Karte
- `LiveGoogleMap` bekommt `glide`-Prop (Default false). Bestehende Marker
  gleiten in MC per rAF-Interpolation alt->neu latLng über
  `GOOGLE_GLIDE_MS` (380 ms), sonst hart `setPosition`.
- `animRef` je driverId: pro Marker nur ein Loop, neuer Aufruf bricht den
  laufenden ab, kein Dauerloop, Aufräumen beim Marker-Entfernen und Unmount.
- reduced-motion via `prefersReducedMotion()` -> hart. Große latLng-Sprünge
  (`googleMarkerBigJump`, 0.02 deg ~2 km) -> hart. Node-Test 15/15.
- Verdrahtung: `MapTab` bekommt `glideMarkers = false` (Default), reicht es als
  `glide` an `LiveGoogleMap` durch; nur die MC-MapTab-Stelle setzt `glideMarkers`.

## Classic-Sicherheit
Alle geteilten Bausteine wurden nur additiv erweitert (Default = heutiges
Verhalten). `SchematicMap`, `DriverMarker`, `OpenRideMarker`, `MobileMapPane`
und die Classic-Aufrufe von `BoardMiniMap`/`MapTab`/`LiveGoogleMap` sind zur
Laufzeit byte-identisch. Rollen Fahrer/Stage/Gast sind nicht betroffen.

## Live-Test-Checkliste (echtes Gerät, Umgebungsgrenze)
- SVG (auch im Artifact ohne Google-Key): MC-Karte, Zeit in Simulation schieben
  oder live warten -> Fahrer-Marker gleiten bei kleiner Bewegung, teleportieren
  bei großen Sprüngen und erstem Erscheinen. Fahrer auswählen: Ring/Größe
  wechseln ohne Neu-Springen. „Bewegung reduzieren" -> hart.
- Google (nur mit `VITE_GOOGLE_MAPS_API_KEY`): in MapTab auf „Google Maps"
  umschalten -> Marker gleiten bei GPS-Update, springen bei großem Fix-Sprung,
  reduced-motion -> hart. Keine Loops nach Ankunft (CPU/Akku ruhig).
- Classic-Ansicht gegenprüfen: Marker weiterhin hart, unverändert.

## Nächste Schritte (deine Entscheidung, nichts davon dringend)
- MC-Beta insgesamt auf echtem Gerät durchklicken, dann ggf. Merge-Strategie
  feature -> staging/main überlegen.
- Vor dem Festival (dein Part): Multi-Fahrer-GPS-Test, Google-Key in Vercel,
  Produktivdaten laden.
- Nach dem Festival (bewusst zurückgestellt): Datei-Splitting, Asset-Extraktion,
  SQL-RPC-Refactor (Variante B).

## Ready-to-paste Opener für den nächsten Chat
```
Neuer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit 74db596. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen. Danach UEBERGABE-Session-12.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, kein neues top-level dyn-Feld, Stage Manager
read-only. Nach jeder Aenderung esbuild + Duplikat-Grep + Referenz-Gegencheck +
Node-Test + Diff-Beleg, Push auf Feature-Branch. Bevor du baust: Scope bestaetigen,
Stelle lokalisieren, Risikoabwaegung, dann nach OK in kleinen Scheiben.
Effekt 10 (SVG + Google) ist fertig. AUFTRAG bitte in der ersten Nachricht nennen.
```
