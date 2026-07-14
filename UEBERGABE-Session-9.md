# Übergabe: Session 9 — Mission Control Beta (frischer Chat)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert).
Pro Scheibe ein eigener Chat (lange Chats stürzen ab). Erst
`PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker prüfen, Risikoabwägung,
dann nach OK bauen.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**, letzter Commit `99a2863` (Session 8 Teil 4: emergency)
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~10.076 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, Baseline grün:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Bestehende Views nur umgestalten/einsetzen, nicht neu schreiben, nichts entfernen.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-Schreiblogik anfassen.
- `mcNavForRole` nutzt nur `session.role`, keine zweite Rollenquelle.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Icon-/Referenz-Gegencheck
  (esbuild kompiliert durch undefinierte JSX-Refs!) + Node-Test für neue reine Logik.
- Commit über `git commit -F /tmp/msg.txt`, Push auf den Feature-Branch.

## Muster für Tab-Redesigns (so wurde alles bisher gemacht)
- **Tab ist ein duplizierter Inline-Block** (wie `board`): direkt dort umstylen,
  Handler/Datenzugriffe 1:1 lassen. Classic ist automatisch unberührt.
- **Tab ist eine GEMEINSAME Komponente** (wie `returns`/`drivers`/`timeline`/
  `messages`/`emergency`): eine eigene `Mission…`-Kopie anlegen, Logik + ALLE
  Schreib-Handler VERBATIM übernehmen, nur den Render neu (MC-Design), und im
  MC-Zweig die eine Zeile auf die neue Komponente umstellen. Classic-Komponente
  NIE anfassen. Danach per automatischem Diff belegen, dass Handler + Ableitungen
  byte-identisch sind.
- **Additive UI-Feedback-Schicht erlaubt (Weg B, von Jordan freigegeben):** Wenn
  Lade-/Sende-/Fehlerzustände gewünscht sind, darf ein dünner `await` + lokaler
  `sending`/`resolving`/`error`-State um einen Schreib-Handler gelegt werden -
  ABER die eigentliche Schreib-Mutation und der Fehlerkanal (`onErr`) bleiben
  byte-identisch (per Diff belegen). Kein neues dyn-Feld, kein neues Datenmodell.
  So gemacht bei `messages` (reply/undoReply) und `emergency` (resolveIssues).
- Gemeinsame Unterkomponenten (`ZoneChip`, `BoardMiniMap`, `TimelineView`,
  `DriverRow`, `PresenceManager`) unverändert wiederverwenden - nicht umstylen
  (sonst ändert sich Classic). Sie sehen in MC noch klassisch aus, das ist bewusst.

## Stand jetzt (Sessions 5-8 fertig, alles auf dem Branch)
- **5:** `MC_NAV`/`mcNavForRole`, `MissionControl`-Shell (Ansatz A), Desktop-Nav +
  untere Mobil-Leiste, Chat-FAB-Lift via `--mc-fab-lift`.
- **6:** `board`-Tab (Fahrtenansicht) MC-Design.
- **7:** `returns`-Tab als eigene `MissionReturnsTab`.
- **8 Teil 1:** `drivers`-Tab als `MissionDriversTab` (read-only, Render-Tausch).
- **8 Teil 2:** `timeline`-Tab (Fahrer-Gantt) als `MissionTimelinePage` (voller
  Drag-and-Drop verbatim, "ca."-Endzeit rein lesend).
- **8 Teil 3 (`4a44798`):** `messages`-Tab (Nav-Label "Chat") als `MissionMessagesInbox`.
  MC-Design, ungelesene/offene Hervorhebung, relative Zeitstempel (`fmtAgo`),
  Sendestatus + echte Fehleranzeige (additive sending/error-Schicht, reply-Mutation
  byte-identisch). Node-Test 21/21.
- **8 Teil 4 (`99a2863`):** `emergency`-Tab (Nav-Label "Probleme") als
  `MissionEmergencyTab`. MC-Design, Prioritäts-Badges (Kritisch/Warnung), Fall-Art-
  Tag, Prioritäts-Filter (rein anzeigeseitig), Ladezustand-Spinner am "Problem
  erledigt"-Button. resolveIssues-Mutation + onErr byte-identisch. Node-Test 15/15.
  Stage Manager unberührt (StageApp nutzt EmergencyTab nicht). Nav-Badge
  `emCount`/`emCrit` (Shell) nicht angefasst.

- **Design-Bausteine vorhanden:** `MissionStyles` (Tokens unter `.mc-scope`), `MC_STATUS`,
  `mcRideStatusKey`, Basiskomponenten `SectionHeader/MissionPanel/StatusBadge/MetricCard/
  IconButton/EmptyState/LoadingState/ErrorState/LiveIndicator`, plus Klassen
  `.mc-ride-card/.mc-input/.mc-btn-primary/.mc-btn-assign`. Tokens: `--mc-text/-secondary/
  -muted`, `--mc-border/-inset/-hover/-panel/-bg`, `--mc-st-{new|assigned|enroute|done|
  problem|idle}` je mit `-soft`.

## Kandidaten für Session 9 (mit Jordan priorisieren, erst Risikoabwägung)
Alle vier noch im MC-Zweig auf der Klassik-Komponente (Zeilen Stand `99a2863`):
1. **`overview`** (9516) -> `OverviewTab` (6873): die echte "Mission Control"-Landing
   (KPIs, Live-Karte, kompakte Listen, Timeline). Read + Navigation, keine Schreib-
   Handler -> niedrigstes Risiko. `BoardMiniMap`/`TimelineView` bleiben eingebettet
   unverändert (Stone-Look).
2. **`flights`** (9526) -> `FlightTab` (6363): hat Schreib-Handler (Flugstatus manuell
   pflegen) -> Handler verbatim, evtl. Weg-B fürs Feedback.
3. **`map`** (9527) -> `MapTab` (8426): read-only, aber nutzt viel geteilte Karten-Logik.
4. **`settings`** (9529) -> `SettingsTab` (8555): **Brocken (~290 Zeilen)**, viele
   Schreib-Handler, Gast-Token-Verwaltung. In EIGENEM Chat, sehr sorgfältig.
5. **MC-Varianten der geteilten Bausteine** `BoardMiniMap`/`TimelineView`/`DriverRow`/
   `PresenceManager`/`ZoneChip` (heute noch Stone-Look in MC). Neue MC-Variante bauen,
   Classic-Version unangetastet lassen.

## Nützliche Greps / Anker (Commit `99a2863`)
```
grep -n 'if (uiMode === "mission-control")' src/ShuttleLeitstelle.jsx   # Gate (1112)
grep -n 'function MissionControl' src/ShuttleLeitstelle.jsx            # Shell (9090)
grep -n 'function MissionReturnsTab\|function MissionDriversTab\|function MissionTimelinePage\|function MissionMessagesInbox\|function MissionEmergencyTab' src/ShuttleLeitstelle.jsx
grep -n 'tab === "overview"\|tab === "flights"\|tab === "map"\|tab === "settings"' src/ShuttleLeitstelle.jsx
grep -n 'function OverviewTab\|function FlightTab\|function MapTab\|function SettingsTab' src/ShuttleLeitstelle.jsx
grep -n 'function MissionStyles\|const MC_STATUS\|mcRideStatusKey\|const MC_NAV\|function mcNavForRole' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Erste konkrete Aktion im neuen Chat (Session 9)
Repo klonen, Branch auschecken, `npm ci`, Baseline-esbuild grün, Anker prüfen, dann
Scope mit Jordan klären (welcher Tab) und nach OK die Scheibe vorschlagen.

## Offen für Jordans Live-Test (Umgebungsgrenze, nicht im Chat prüfbar)
- **messages (MC):** Sende-Spinner + Fehleranzeige zeigen sich erst mit echter Latenz
  (Supabase), im Artifact blitzt der Spinner nur kurz. Auf echtem Handy: Button-
  Umbruch, Eingabebreite, Touch. Ungelesen-Markierung, relative Zeit.
- **emergency (MC):** Prioritäts-Filter (Alle/Kritisch/Warnung), Kritisch-zuerst-
  Sortierung, "Problem erledigt"-Spinner unter echter Latenz, Fehler-Toast via onErr,
  freie Fahrer / verschiebbare Fahrten in der Seitenspalte. Desktop + Handy.

## Ready-to-paste Opener für Session 9 (neuer Chat)
```
Session 9, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Commit 99a2863. PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen bestaetigen. Danach UEBERGABE-Session-9.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine Felder/Aktionen entfernen, keine neuen Libs, kein neues
top-level dyn-Feld. Stage Manager bleibt read-only + Probleme melden (MC dispatcher-
only). Weg B (duenne await/sending/error-Schicht um Handler) erlaubt, aber Schreib-
Mutation + onErr byte-identisch. Nach jeder Aenderung: esbuild + Duplikat-Grep +
Referenz-/Icon-Gegencheck + Node-Test fuer neue reine Logik + Diff-Beleg dass Handler/
Ableitungen byte-identisch sind. Automatisch auf den Feature-Branch pushen. Bevor du
baust: Scope bestaetigen, Stelle lokalisieren, Risikoabwaegung, dann nach meinem OK in
kleinen gepushten Scheiben bauen.
AUFTRAG SESSION 9: <einen Tab waehlen -- overview / flights / map / settings -- ODER
eine MC-Variante eines gemeinsamen Bausteins (BoardMiniMap/TimelineView/DriverRow/
PresenceManager/ZoneChip)>.
```
Achtung: `settings` ist ein Brocken (~290 Zeilen, viele Schreib-Handler, Gast-Token) -
unbedingt in einem eigenen Chat und in sehr kleinen Scheiben.
