# Übergabe: Session 10 — MC-Mikroanimationen Rest (frischer Chat)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert). Pro
Scheibe ein eigener Chat (lange Chats stürzen ab). Erst `PROJEKT-ANWEISUNGEN.md`
lesen, dann Repo holen, Anker prüfen, Risikoabwägung, dann nach OK bauen.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**,
  letzter Code-Commit `42c5e92` (Session 9 Slice 9.2)
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~10.130 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, Baseline grün:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-Schreiblogik anfassen.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Weg B (dünne await/sending/error-Schicht) erlaubt, Schreib-Mutation + onErr byte-identisch.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Referenz-/Icon-Gegencheck + Node-Test
  für neue reine Logik + Diff-Beleg. Push auf den Feature-Branch.

## Animations-Fundament (steht seit Session 9, in `MissionStyles`)
Alles unter `.mc-scope`, Tokens `--mc-anim-fast: 160ms / --mc-anim: 240ms /
--mc-anim-slow: 380ms`, Easing `--mc-ease`. Nur transform/opacity animiert.
`prefers-reduced-motion`-Block schaltet ALLE MC-Animationen + Transitions aus
(`.mc-scope *`). Vorhandene Keyframes: `mc-panel-in`, `mc-nav-ind-in`,
`mc-sheet-in`, `mc-entry-in`, plus bestehendes `mc-pulse-ring` (Live-Dot).
Hilfen: `prefersReducedMotion()`, `useCountUp(target, duration)`, `<MissionCount value>`.

## Session 9 fertig (Commits `b12718f`, `42c5e92`)
- **Slice 9.1 (reines CSS + Shell-Nav):**
  - 1 Panels weich rein (`.mc-panel` → `mc-panel-in`, opacity+6px)
  - 2 Karten Hover-Lift (`.mc-ride-card:hover` transform -1px)
  - 3 Statusbadge Farb-/Füllungs-Übergang (`.mc-badge` transition)
  - 5 Live-Indikator (war bereits dezent, unverändert)
  - 9 Mobil-Nav flüssig (`mc-navbtn` Farb-Transition, `mc-nav-ind` weicher
    Indikator, `mc-sheet-in` fürs Mehr-Sheet)
- **Slice 9.2 (additive JS):**
  - 6 KPI zählen hoch (`useCountUp`/`MissionCount`, easeOutCubic ~650ms, einmalig
    beim Mount; spätere Änderungen direkt; reduced-motion → sofort Ziel;
    Nicht-Zahlen Passthrough). Eingehängt: Board-Header-KPIs (Shell, ~9281) +
    MissionReturnsTab-KPIs (~6286). Node-Test 55/55.
  - 7 Neue Timeline-Einträge weich (`.mc-tl-block` → `mc-entry-in`, NUR opacity +
    fill-mode `backwards`, damit Inline-Drag-Opacity 0.25 + left/width unberührt).

## Offen für Session 10 (Rest der 10 Effekte)
1. **Effekt 4 — neue Probleme pulsieren einmal kurz rot.** In `MissionEmergencyTab`
   (Anker unten). Braucht ein **Seen-Set** (welche issue-IDs waren schon da), rein
   lesend, KEINE Schreiblogik. Neue → einmalige Puls-Klasse (`animation-iteration-count: 1`,
   z.B. box-shadow/border rot, kurz). Node-Test für die "neu"-Erkennung. Kein
   Dauerblinken. Mittleres Risiko.
2. **Effekt 8 — Modals öffnen/schließen weich.** Chassis (`Modal` 9065, `RideForm`
   4449, `WhatsAppModal`) ist GETEILT + Classic-gestylt, NICHT anfassen. Empfehlung
   aus Session 9: **nur weiches Öffnen** über einen MC-eigenen Wrapper (opacity-Fade
   um den MC-Render bei ~9634/9682), Schließen bleibt hart (Exit-Animation bräuchte
   verzögertes Unmount = Zustandslogik = out of scope). Wrapper darf nur `opacity`
   animieren (transform auf Wrapper bricht `position: fixed`-Kinder). Mit Jordan
   final klären: nur-Öffnen oder ganz raus.
3. **Effekt 10 — Kartenmarker weich.** VERTAGT. Marker leben in geteilten Bausteinen
   (`BoardMiniMap` 8227, `TimelineView` 7894, `MapTab` 8426), die Classic-Look
   behalten sollen. Sauber nur als eigene MC-Variante des Kartenbausteins (Kandidat
   5 aus Session 9). Eigener, sorgfältiger Chat.

## Anker / Greps (Code-Stand `42c5e92`)
```
grep -n 'function MissionStyles\|function useCountUp\|function MissionCount\|function prefersReducedMotion' src/ShuttleLeitstelle.jsx
grep -n 'function MissionEmergencyTab' src/ShuttleLeitstelle.jsx            # Effekt 4 (~6689)
grep -n 'function Modal\|function RideForm\|function WhatsAppModal' src/ShuttleLeitstelle.jsx  # Effekt 8 (geteilt, nicht anfassen)
grep -n 'editRide &&\|waRide &&' src/ShuttleLeitstelle.jsx                  # MC-Modal-Render im Shell (~9634/9682)
grep -n '@keyframes mc-\|prefers-reduced-motion' src/ShuttleLeitstelle.jsx  # Animations-Fundament
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Performance-Stand (Session 9 geprüft)
Nur transform/opacity in allen neuen Keyframes. Keine neuen Endlos-Loops (nur der
bestehende dezente `mc-live-dot`). Count-up-rAF gebounded + im Cleanup abgeräumt.
`prefers-reduced-motion` deckt alles ab. `.mc-panel` ausschließlich MC.

## Offen für Jordans Live-Test (Umgebungsgrenze)
Auf echtem Desktop/Handy den Feinschliff der Session-9-Effekte prüfen: Panel-Fade
beim Tab-Wechsel nicht zu träge, Hover-Lift dezent, KPI-Count-up-Tempo, Timeline-
Fade bei neuen Fahrten, Mobil-Nav-Indikator + Mehr-Sheet, reduced-motion an/aus.

## Ready-to-paste Opener für Session 10
```
Session 10, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit 42c5e92. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen. Danach UEBERGABE-Session-10.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, kein neues top-level dyn-Feld, Stage Manager
read-only. Nur transform/opacity, prefers-reduced-motion respektieren, kein
Dauerblinken. Nach jeder Aenderung esbuild + Duplikat-Grep + Referenz-Gegencheck +
Node-Test + Diff-Beleg, Push auf Feature-Branch. Bevor du baust: Scope bestaetigen,
Stelle lokalisieren, Risikoabwaegung, dann nach OK in kleinen Scheiben.
AUFTRAG SESSION 10: Effekt 4 (neue Probleme pulsieren 1x rot, Seen-Set in
MissionEmergencyTab). Danach ggf. Effekt 8 (Modals nur weiches Oeffnen) in eigenem
Chat. Effekt 10 (Marker) bleibt vertagt.
```
