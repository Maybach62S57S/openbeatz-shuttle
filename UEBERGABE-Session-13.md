# Übergabe: nach Session 13 — Emergency-Fallback (ErrorBoundary) für Mission Control

Deutsch, informell, keine Gedankenstriche, korrekte Umlaute.

---

## Stand
Branch `feature/mission-control-beta`, letzter Code-Commit **`cd2a194`**.
Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch
`backup/paket-3-fertig`. Hauptdatei `src/ShuttleLeitstelle.jsx` (~10.460 Zeilen).

Der Classic <-> Mission-Control-Umschalter ist damit vollständig und
abgesichert. Der Beta-Testmodus ist komplett angeschlossen: umschalten,
lokal merken, harter Fallback auf Classic, sicherer Absturz-Auffang.

## Was in dieser Session gebaut wurde (Commit `cd2a194`)

Auftrag war "Beta-Testmodus vollständig und sicher". Der grösste Teil war
schon da (aus den früheren MC-Sessions): `uiMode`-State in
`localStorage["obf:uiMode"]`, harter Fallback auf `"classic"` (alles ausser
exakt `"mission-control"`), Umschalter nur im Dispo-Desktop-Zweig sichtbar
(Driver/Stage/Guest rendern das Dashboard nie), "Zu Classic"-Button in der
MC-Shell, beide UIs auf derselben Datenschicht (dieselben
`setup`/`dyn`/`updateDyn`-Props). Die einzige echte Lücke war der
**Emergency-Fallback**, und der ist jetzt drin.

Neu:
- **`MissionControlBoundary`** (Klassen-Komponente, direkt nach
  `LoadErrorScreen`, ~Z. 1257). React-Error-Boundary
  (`getDerivedStateFromError` + `componentDidCatch`), umschliesst NUR den
  MC-Render-Zweig. `Component` dafür zusätzlich aus `react` importiert
  (Z. 1, keine neue Lib).
- **`MissionControlFallbackScreen`** (~Z. 1300): verständliche Meldung im
  Classic-Stone-Look (bewusst nicht im `mc-scope`, weil der MC-Baum in dem
  Moment als defekt gilt).
- **`handleMcFallback`** (im `App`, neben `setUiModeSafe`, ~Z. 771):
  setzt `uiMode`+localStorage auf `"classic"`, setzt `mcBlocked=true`
  (Session-Sperre gegen Crash-Loop) und eine Hinweis-Notiz `mcFailReason`.
  Fasst AUSSCHLIESSLICH uiMode/localStorage/Sperr-State an, KEIN
  `updateDyn`/`updateSetup`, keine Status-/Rollen-/Zuteilungsaenderung ->
  ein abgefangener Render-Fehler kann keine Daten verändern.
- **Verdrahtung MC-Zweig** (~Z. 1136): `if (uiMode === "mission-control"
  && !mcBlocked)`, MC in `<MissionControlBoundary onFallback={handleMcFallback}
  key={uiMode}>` gewickelt. `key={uiMode}` = Reset: nach Reload erneut MC
  wählen startet die Boundary frisch.
- **Verdrahtung Classic-Zweig**: dezenter amber-Hinweis (`mcFailReason`) über
  dem Dashboard, und `onSetUiMode={mcBlocked ? null : setUiModeSafe}`. Weil der
  Oberflächen-Umschalter (Dashboard-Header, ~Z. 3660) nur bei truthy
  `onSetUiMode` rendert, verschwindet er bei aktiver Sperre komplett -> MC kann
  nicht sofort neu getriggert werden (kein Crash-Loop).

## Verhalten im Crash-Fall (bewusste Design-Entscheidung)
Wenn der MC-Baum beim Rendern wirft:
1. Boundary fängt den Fehler (App crasht NICHT weiss)
2. `onFallback` -> uiMode zurück auf Classic, MC für die Session gesperrt
3. kurze verständliche Meldung ("Mission Control Beta hatte ein Problem,
   zur klassischen Ansicht zurückgewechselt, Daten unverändert")
4. keine Datenänderung

Die Session-Sperre (`mcBlocked`) lebt nur im Speicher, NICHT in localStorage.
Nach einem Reload ist MC wieder frei probierbar. So: kein Endlos-Crash-Loop,
aber der Nutzer ist auch nicht dauerhaft ausgesperrt.

## Classic-Sicherheit
Classic, Dashboard, Fahrer, Stage, Gast und die Mobil-Ansicht sind byte-genau
unverändert. Sie liegen als Render-Zweige VOR der Boundary (guestToken ->
driver -> stage -> useMobileView -> MC -> Classic) und erreichen sie nie. Der
Classic-Zweig hat nur zwei additive Änderungen: der `mcFailReason`-Hinweis
davor und die `mcBlocked ? null :`-Bedingung am `onSetUiMode`. Im Normalfall
(`mcBlocked === false`) ist das Verhalten identisch zu vorher.

## Verifikation (alles grün)
- esbuild `--bundle=false --format=esm` grün (~797 kb)
- keine Duplikat-Funktionsnamen
- Diff: 4 Hunks, nur die geplanten Stellen (Import, Fallback-State,
  MC-Zweig, neue Boundary-Komponente), 109 Zeilen +, 9 -
- Referenz-Check: alle Bezeichner (Icons `AlertTriangle`/`RefreshCw`,
  `Component`, `OB_HORIZ`, `obInvert`) definiert/importiert
- Node-Test `test_mc_fallback.mjs` 16/16 (uiMode-Init-Fallback, Render-
  Verzweigung mit/ohne Sperre, Crash-Loop-Schutz, Selbstheilung nach Reload,
  handleMcFallback-Zustandsübergang inkl. "fasst keine Daten an")
- echter jsdom-Client-Rendertest der Boundary 7/7 (Crash -> Fallback +
  onFallback + Fehlerobjekt, gesunder Baum unberührt, App lebt weiter).
  Wichtig: `renderToStaticMarkup` fängt Error Boundaries in React 18
  server-seitig NICHT ab (bekanntes API-Limit, kein Code-Problem) -> Test
  muss client-seitig mit jsdom laufen. jsdom war nur temporär im Container
  installiert, NICHT in package.json.

## Live-Test-Checkliste (echtes Gerät, Umgebungsgrenze)
- Als Leitstelle am Desktop einloggen -> Oberflächen-Umschalter oben rechts.
  Auf "Mission Control Beta" -> MC lädt, "Zu Classic" bringt zurück.
- Reload: uiMode bleibt gemerkt (localStorage).
- Fallback visuell prüfen: lässt sich nur mit einem echten/provozierten
  MC-Render-Fehler auslösen. Erwartung: kurzer Fallback-Screen, dann Classic,
  amber-Hinweis über dem Dashboard, Umschalter weg bis Reload. Daten unverändert.
- Gegenprobe: Fahrer/Stage/Gast/Handy-Ansicht sehen den Umschalter NIE.

## Nächste Schritte (deine Entscheidung, nichts davon dringend)
- Deine offene Gegenprüfung Effekte 1-9 (Animationspaket) — machst du selbst.
- MC-Beta insgesamt auf echtem Gerät durchklicken.
- Dann ggf. Merge-Strategie feature -> staging/main überlegen.
- Vor dem Festival (dein Part): Multi-Fahrer-GPS-Test, Google-Key in Vercel,
  Produktivdaten laden.
- Nach dem Festival (bewusst zurückgestellt): Datei-Splitting, Asset-Extraktion,
  SQL-RPC-Refactor (Variante B).

## Ready-to-paste Opener für den nächsten Chat
```
Neuer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit cd2a194. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
Danach UEBERGABE-Session-13.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, keine Supabase-Struktur-Aenderung, kein
neues top-level dyn-Feld, Stage Manager read-only. Nur transform/opacity animiert,
prefers-reduced-motion respektieren. Nach jeder Aenderung esbuild + Duplikat-Grep +
Referenz-/Icon-Gegencheck + Node-Test fuer neue reine Logik + Diff-Beleg, Push auf
Feature-Branch. Bevor du baust: Scope bestaetigen, Stelle lokalisieren,
Risikoabwaegung, dann nach OK in kleinen Scheiben.
Beta-Testmodus inkl. Emergency-Fallback (ErrorBoundary) ist fertig. AUFTRAG bitte
in der ersten Nachricht nennen.
```
