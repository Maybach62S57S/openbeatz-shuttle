# Übergabe: Session 8 — Mission Control Beta (frischer Chat)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert).
Pro Scheibe ein eigener Chat (lange Chats stürzen ab). Erst
`PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker prüfen, Risikoabwägung,
dann nach OK bauen.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**, letzter Commit `07bdfb9` (Session 8 Teil 1: drivers)
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~9160 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, Baseline grün:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Bestehende Views nur umgestalten/einsetzen, nicht neu schreiben, nichts entfernen.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/Supabase-Schreiblogik anfassen.
- `mcNavForRole` nutzt nur `session.role`, keine zweite Rollenquelle.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Icon-/Referenz-Gegencheck
  (esbuild kompiliert durch undefinierte JSX-Refs!) + Node-Test für neue reine Logik.
- Commit über `git commit -F /tmp/msg.txt`, Push auf den Feature-Branch.

## Muster für Tab-Redesigns (so wurde board + returns gemacht)
- **Tab ist in MC ein duplizierter Inline-Block** (wie `board`): direkt dort umstylen,
  Handler/Datenzugriffe 1:1 lassen. Classic ist automatisch unberührt (eigener Block).
- **Tab ist eine GEMEINSAME Komponente** (wie `ReturnsTab`): eine eigene `Mission…Tab`-Kopie
  anlegen, Logik + Schreib-Handler VERBATIM übernehmen, nur den Render neu (MC-Design),
  und im MC-Zweig die eine Zeile auf die neue Komponente umstellen. Classic-Komponente
  NIE anfassen. Danach per automatischem Diff belegen, dass Handler + Datenableitungen
  byte-identisch sind (so wie bei `MissionReturnsTab`).
- Gemeinsame Unterkomponenten (z.B. `PresenceManager`, `BoardMiniMap`, `TimelineView`,
  `DriverRow`) unverändert wiederverwenden - nicht umstylen (sonst ändert sich Classic).

## Stand jetzt (Sessions 5-7 fertig, alles auf dem Branch)
- **5.1-5.3:** `MC_NAV`/`mcNavForRole`, `MissionControl`-Shell (Ansatz A), Desktop-Nav +
  untere Mobil-Leiste, Chat-FAB-Lift via `--mc-fab-lift`.
- **6 (`39098c0`):** `board`-Tab (Fahrtenansicht) MC-Design - `.mc-ride-card`+Hover,
  Statusstreifen via `mcRideStatusKey`, `mc`-StatusBadge, Filter-Segmented-Control,
  `.mc-input`-Suche, `mc`-EmptyState/LoadingState, mobiles Stapeln, Flash-Feedback (`flashIds`).
- **7 (`ea69768`):** `returns`-Tab als eigene `MissionReturnsTab` - überfällig/nächste-
  Hervorhebung, Abholort->Ziel getrennt, View-Suche, mc-KPIs/EmptyState. Logik verbatim,
  Classic byte-identisch.
- **Design-Bausteine vorhanden:** `MissionStyles` (Tokens unter `.mc-scope`), `MC_STATUS`,
  `mcRideStatusKey`, Basiskomponenten `SectionHeader/MissionPanel/StatusBadge/MetricCard/
  IconButton/EmptyState/LoadingState/ErrorState/LiveIndicator`, plus Klassen
  `.mc-ride-card/.mc-input/.mc-btn-primary/.mc-btn-assign`.

## Session 8 Fortschritt (4 Teile geplant)
- **Teil 1 fertig (`07bdfb9`):** `drivers`-Tab als eigene `MissionDriversTab`
  (Z.~4853, direkt nach `DriversTab`). Read-only Tab, daher reiner Render-Tausch,
  keine Schreib-Handler. Datenableitung + Sortierung VERBATIM aus `DriversTab`
  (per Diff belegt byte-identisch). Neu sichtbar: aktueller Auftrag (`s.active`),
  Online/Offline + letzter Kontakt (nur gelesen aus `driverState[id].gps` mit
  `GPS_MAX_AGE_MS`/`fmtAgo`, exakt wie Live-Karte). MC-Design: Fahrzeug-Badge,
  Status-Badge frei/auf Fahrt, Auslastungsbalken (rot ab `softHoursMin`),
  `EmptyState`, 2 Spalten ab `xl`. Classic `DriversTab` byte-genau unverändert,
  nur MC-Zweig-Zeile umgestellt. Node-Tests: `gpsInfo`/`activeRoute` + Grenzfall.
- **Teil 2 fertig (Etappe A `b73e509`, Etappe B `78ee018`):** `timeline`-Tab
  (Fahrer-Gantt) als eigene `MissionTimelinePage` (direkt nach `TimelinePage`,
  Z.~7116). Muster wie `returns`/`drivers`: GESAMTE Logik + ALLE Schreib-Handler
  VERBATIM (`quickAssign`/`applyDrop`/`beginDrag`+Drag-Effekt/`timeFromClientX`/
  `driverIdFromClientY`/`confirmPendingDrop`/`cancelPendingDrop`/`evalFor`), nur
  Render neu im MC-Design. Drag-and-Drop voll funktionsfaehig (keine read-only-
  Strippung). NEU rein lesend: geplante Endzeit im Balken `HH:MM -> HH:MM`, bei
  unbekannter Dauer sichtbar als "ca." markiert (aus `effDur`/`estDurationMin`,
  keine erfundenen Zeiten, kein neues dyn-Feld). MC-Zweig-Zeile `tab==="timeline"`
  auf `MissionTimelinePage` umgestellt. Classic `TimelinePage` byte-genau
  unveraendert (Diff-Exit 0). Handler-Block + Drag-Ableitungen per Diff byte-
  identisch zu Classic belegt (nur Namenszeile weicht ab). Node-Test 7/7 fuer die
  ETA-Logik (bekannt/unbekannt/Nacht-Umbruch/Config-Fallback). esbuild gruen,
  keine Duplikate, Icon-/Referenz-Check bestanden.
- **Teil 3-4 offen:** konkreten Tab jeweils frisch mit Jordan festlegen. Jede
  Scheibe in EIGENEM Chat starten (Crash-Risiko bei langen Chats). Kandidaten
  siehe unten.

### Teil 2 erledigt (Fahrer-Timeline / Dispositionsplan, MC)
Umgesetzt wie oben unter "Teil 2 fertig". Offen geblieben (bewusst, nur auf Ansage):
Klick-Verhalten ist weiter verbatim (Tap auf zugeteilte Fahrt = Fahrer aendern per
Assign, Tap auf offene Fahrt = passende Fahrer hervorheben, Stift = bearbeiten).
Umstellung auf "Klick = Fahrt oeffnen" nur wenn Jordan es ausdruecklich sagt.

### Ready-to-paste Opener fuer Teil 3 (neuer Chat)
```
Session 8 Teil 3, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Commit 78ee018. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen bestaetigen. Danach UEBERGABE-Session-8.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Fahrten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine Felder/Aktionen entfernen, keine neuen Libs, kein neues
top-level dyn-Feld. Stage Manager kriegt keine Rechte (MC dispatcher-only). Nach jeder
Aenderung: esbuild + Duplikat-Grep + Referenz-/Icon-Gegencheck + Node-Test fuer neue
reine Logik + Diff-Beleg dass Handler/Ableitungen byte-identisch sind. Automatisch auf
den Feature-Branch pushen. Bevor du baust: Scope bestaetigen, Stelle lokalisieren,
Risikoabwaegung, dann nach meinem OK bauen.
AUFTRAG TEIL 3: <einen der offenen Tabs waehlen -- emergency / flights / settings /
echte overview-Landing -- ODER MC-Variante eines gemeinsamen Bausteins (DriverRow/
BoardMiniMap/PresenceManager/TimelineView)>.
```
Achtung Teil 3: `settings` ist ein Brocken (~288 Zeilen), `emergency` speist den
Nav-Badge (`emCount`/`emCrit`) -> im Tab nicht anfassen. Stage Manager bleibt ueberall
unberuehrt (MC dispatcher-only).

## Kandidaten für die restlichen Teile (mit Jordan priorisieren, erst Risikoabwägung)
1. **Nächsten Tab auf MC-Design** - genau EINEN pro Scheibe. Offene Kandidaten:
   `emergency` (Probleme), `flights` (Flughafen), `settings`, oder eine echte
   `overview`-Landing (KPIs/Live). `drivers` ist in Teil 1 erledigt. Alle vier
   offenen rendern im MC-Zweig noch die gemeinsame Klassik-Komponente -> `returns`/
   `drivers`-Muster (eigene `Mission…Tab`-Kopie). Achtung `settings` ~288 Zeilen
   (Brocken), `emergency` speist Nav-Badge `emCount`/`emCrit` (in der Shell, nicht
   im Tab anfassen).
2. **MC-Varianten der gemeinsamen Bausteine** `DriverRow`/`BoardMiniMap`/`PresenceManager`/
   `TimelineView` (heute noch Stone-Look in MC). Neue MC-Variante bauen, Classic-Version
   unangetastet lassen.
3. Nur falls gewünscht: kleinere Feinheiten, immer additiv.

## Nützliche Greps / Anker (Commit `78ee018`)
```
grep -n 'if (uiMode === "mission-control")' src/ShuttleLeitstelle.jsx   # Gate
grep -n 'function MissionControl' src/ShuttleLeitstelle.jsx            # Shell
grep -n 'function MissionReturnsTab\|function MissionDriversTab\|function MissionTimelinePage' src/ShuttleLeitstelle.jsx
grep -n 'tab === "emergency"\|tab === "flights"\|tab === "overview"\|tab === "settings"' src/ShuttleLeitstelle.jsx
grep -n 'mcRideStatusKey\|mc-ride-card\|function MissionStyles\|const MC_STATUS' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Erste konkrete Aktion im neuen Chat (Teil 3)
Repo klonen, Branch auschecken, `npm ci`, Baseline-esbuild grün, Anker prüfen, dann
Teil-3-Scope mit Jordan klären (welcher Tab) und nach OK die Scheibe vorschlagen.

## Offen für Jordans Live-Test (Umgebungsgrenze, nicht im Chat prüfbar)
board- + returns- + drivers-Redesign auf echten Breiten (Desktop/Handy). Bei drivers
konkret: Online/Offline-Punkt + "letzter Kontakt" bei echter GPS-Freigabe eines
Fahrers, aktueller Auftrag während einer laufenden Fahrt, Auslastungsbalken/rot ab
Soft-Limit, frei-zuerst-Sortierung zur echten Uhrzeit.
- **timeline (MC, neu):** Fahrt ziehen -> Zeit aendern; in andere Zeile ziehen ->
  Fahrer wechseln; Bestaetigungs-Popover + "Rueckgaengig"-Hinweis; Zoom/Passend;
  Konflikt-Ring; Tap auf offene Fahrt -> passende Fahrer leuchten; "ca."-Endzeit bei
  Fahrten ohne hinterlegte Dauer. Auf Desktop + Handy pruefen (Drag mit Touch,
  horizontaler Scroll bei Zoom, sticky Kopf/Fahrerspalte).
