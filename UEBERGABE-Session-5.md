# Übergabe: Session 5 — Mission-Control-App-Rahmen (neuer Chat)

Komplette Startnachricht für einen frischen Chat. Alles drin, um direkt zu bauen.
PAT unten selbst einsetzen (steht bewusst nicht drin). Sprache: Deutsch, informell,
keine Gedankenstriche, korrekte Umlaute.

---

## Auftrag

Baue den neuen Mission-Control-App-Rahmen (Shell) für `uiMode === "mission-control"`.
Bestehende Views werden vorerst nur unverändert in den neuen Rahmen eingesetzt, keine
Fachkomponente wird neu geschrieben. Der Rahmen enthält: linke Hauptnavigation, obere
Statusleiste, Hauptinhaltsbereich, mobile Navigation, Beta-Kennzeichnung, Live-Sync-
Anzeige, Nutzer-/Rollenanzeige, sicheren Rückwechsel auf Classic.

Erst `PROJEKT-ANWEISUNGEN.md` lesen, dann Repo-Stand holen und die unten genannten
Anker per grep gegenprüfen (Zeilen beziehen sich auf Commit `ece9aa1`, können minimal
abweichen).

## Repo / Setup

- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**, letzter Commit `ece9aa1`
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~8151 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), auf den Branch auschecken
  (`git checkout feature/mission-control-beta`), `npm ci`, dann Baseline:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln

- Nur für `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Bestehende Views nur einsetzen, nicht neu schreiben. Keine Funktionen/Tabs entfernen.
- Keine Datenlogik ändern. Keine Rollenlogik ändern. Login/PIN/Auth/Rechte nicht anfassen.
- Bestehende Rechteprüfung wiederverwenden, KEINE neue unabhängige Rollenlogik.
- Keine neuen Libs. Keine Supabase-Struktur-Änderung.
- Stabilität vor Performance vor Features. Erst Risikoabwägung, dann nach OK bauen.
- Stage Manager strikt read-only + Probleme melden. Niemals in Mission Control mehr
  sehen als Live-Ansicht + Problem melden.

---

## Stand jetzt (Sessions 1-4 fertig, alles auf dem Branch)

1. **UI-Modus (Slice 1):** In `App` gibt es `uiMode` (`classic|mission-control`), Init aus
   `localStorage["obf:uiMode"]`, harter Fallback auf `"classic"` (alles ausser exakt
   `"mission-control"`). Setter `setUiModeSafe` (Z. ~766). Gate im Dispo-Desktop-Zweig:
   `if (uiMode === "mission-control")` (Z. **1112**), NACH `if (useMobileView)` (Z. **1102**),
   Handy behält also Vorrang. Rendert `MissionControl` statt `Dashboard`.
2. **Umschalter:** Zwei-Segment-Control "Oberfläche [Classic] [Mission Control Beta]" im
   Dashboard-Kopf, nur sichtbar wenn Prop `onSetUiMode` gesetzt ist (= ausschliesslich
   Dispo-Desktop). Driver/Stage/Guest sehen ihn nie.
3. **Designsystem (Session 3):** `MissionStyles` (Z. **7913**) injiziert alle Tokens als
   CSS-Variablen unter `.mc-scope` (kann Classic technisch nicht erreichen). Zentrale
   Statusmap `MC_STATUS` (new/assigned/enroute/done/problem/idle). Basiskomponenten
   fertig und nutzbar: `SectionHeader` (8034), `MissionPanel` (8050), `StatusBadge` (8064),
   `MetricCard` (8074), `IconButton` (8091), `EmptyState` (8100), `LoadingState` (8116),
   `ErrorState` (8125), `LiveIndicator` (8143).
4. **`MissionControl` (Z. 7885):** aktuell noch Passthrough: `<><MissionStyles /><Dashboard {...props} /></>`.
   Das wird in dieser Session zum echten Shell umgebaut.

**Wichtig:** Damit die Tokens/Basiskomponenten greifen, muss der Shell-Wurzel-Container die
Klasse `mc-scope` tragen (z. B. `<div className="mc-scope min-h-screen">`).

---

## Sicherheitsentscheidung (am Code belegt, bitte so umsetzen)

**Mission Control bleibt vorerst dispo-only.** Der Umschalter existiert nur im Dispo-Desktop
(Z. 1112). Fahrer -> `DriverApp` (Z. 2176), Stage -> `StageApp` (Z. 2590), Gast -> `GuestApp`
(Z. 2933) laufen in eigenen Routing-Zweigen weiter oben (Z. 1088-1099) und werden NICHT
angefasst. Stage/Fahrer in den neuen Shell zu routen, wäre eine Rollenlogik-/Routing-Änderung
(verboten) und würde die Stage-Read-only-Garantie neu aufmachen. Das ist eine eigene spätere
Scheibe mit eigener Risikoabwägung, NICHT Teil von Session 5.

Trotzdem wird die Nav **rollenabhängig** gebaut, als wiederverwendbare Fähigkeits-Funktion
`mcNavForRole(role)`, die `session.role` nutzt (keine neue Rollenquelle) und pro Rolle exakt
den erlaubten Satz liefert:
- `dispo`: komplette Nav (unten).
- `stage`: NUR `overview` (Live/Mission Control) + `emergency` (Probleme). Sonst nichts.
- `driver`: minimal (`overview`), falls je gebraucht.

So ist die Spezifikation erfüllt und per Node-Test beweisbar (stage = exakt {overview,
emergency}), auch wenn nur `dispo` aktuell in den Shell geroutet wird.

---

## Nav-Mapping (nur real existierende Views, nichts erfunden)

Existierende Dashboard-Tabs (Nav-Array Z. **3598**), Body-Render Z. **3839-3852**, Board inline
Z. **3728**. Modals: `assignRide` (3855), `editRide` (3881), `waRide` (3940), `ChatPanel` (3945).

**Desktop-Nav (dispo), gruppiert wie gewünscht, jeder Punkt zeigt auf einen bestehenden Tab:**
- MISSION CONTROL: Mission Control -> `overview`; Karte -> `map`
- FAHRTEN: Fahrten -> `board`; Rückfahrten -> `returns`; Flughafen -> `flights`
- BETRIEB: Fahrer -> `drivers`; Probleme -> `emergency`
  (Fahrzeuge: kein eigener View vorhanden -> weggelassen, gedeckt durch "falls vorhanden")
- PLANUNG & KOMMUNIKATION: Kalender -> `timeline`; Chat -> `messages`
- SYSTEM: Einstellungen -> `settings`
  (Audit-Log/Backup/Setup haben KEINE eigenständigen Views, stecken in den Einstellungen ->
  keine eigenen Nav-Punkte, sonst neue Views/Eingriff in SettingsTab nötig = verboten)

Karte und Flughafen stehen im Auftrag nicht explizit in der Desktop-Nav, sind aber bestehende
Views, die die Dispo sehen darf. Sie werden NICHT entfernt (Regel "keine Tabs entfernen"),
sondern in die passende Gruppe einsortiert. Falls unerwünscht, kann Jordan sie umhängen/ausblenden.

**Mobile-Nav (dispo):** Live -> `overview`, Fahrten -> `board`, Rückfahrten -> `returns`,
Fahrer -> `drivers`, Mehr -> öffnet Restliste (timeline/flights/map/emergency/messages/settings).
Ebenfalls über `mcNavForRole` gefiltert.

---

## Bauansatz: A (Glue duplizieren, Dashboard unverändert)

Die Controller-Glue liegt in `Dashboard` (Signatur Z. **3492**): `me`, `meBy` (3494/3495),
`push` (3501), `days`/`day` (3502-3507), `tab`/`filter`/`q` (3509-3511), `assignRide`/`editRide`/
`waRide` States, `errToasts`/`notifyErr`, plus die drei Modal-Render-Blöcke mit ihren
Callbacks (3855-3944) und `<ChatPanel>` (3945).

`MissionControl` bekommt eine EIGENE Kopie dieser Glue (nach Ansatz A, ~200 Zeilen), rendert
im Inhaltsbereich die BESTEHENDEN Tab-Komponenten mit exakt denselben Props/Callbacks wie
Dashboard (3839-3852, Board-Block 3728), und unten dieselben `AssignModal`/`RideForm`/
`WhatsAppModal`/`ChatPanel`. Dashboard wird dabei NICHT verändert. Kein neues top-level
dyn-Feld, keine Schema-Änderung (alle Schreibwege laufen über vorhandenes `updateDyn` +
`logRide`/`setRideStatus`/`triggerPush`).

Live-Sync-Anzeige speist sich aus bestehendem State: `hasSupabase()` (Z. 51) + `isOffline`
(Z. 786) + `connIssue`. Diese drei muss `App` zusätzlich an `MissionControl` durchreichen
(additive Props), analog wie sie schon an `ConnIssueBanner` gehen. `LiveIndicator active` =
`hasSupabase() && !isOffline && !connIssue`.

Neue additive Props an `MissionControl` beim Gate (Z. 1112): zusätzlich zu den heutigen
(`setup, dyn, session, updateDyn, updateSetup, onLogout, onPreviewGuest, onUndo, undoCount,
onSwitchToMobile, uiMode, onSetUiMode`) noch `offline={isOffline}`, `connIssue={connIssue}`.

---

## Bauplan (Slices, jeweils esbuild + Duplikat-Grep + ggf. Node-Test, dann commit+push)

**Slice 5.1 — Rollen-Nav-Fähigkeit (reine Logik, kein UI)**
- Datei: `src/ShuttleLeitstelle.jsx`. Neu: Konstante `MC_NAV` (Gruppen + Items mit tab/label/
  icon/group) und Funktion `mcNavForRole(role)` am Dateiende (bei den MC-Komponenten).
- Unverändert: alles andere.
- Nutzen: zentrale, testbare Rollenfilterung. Risiko/Regression: null (nichts gerendert).
- Test: Node-Skript: `mcNavForRole("stage")` = exakt {overview, emergency};
  `mcNavForRole("dispo")` enthält alle gemappten Tabs; kein Item ausserhalb der bestehenden
  Tab-Keys.

**Slice 5.2 — MissionControl-Shell mit duplizierter Glue, Inhalt = bestehende Tabs**
- Datei: `src/ShuttleLeitstelle.jsx`. `MissionControl` von Passthrough auf echtes Shell umbauen:
  Wurzel `<div className="mc-scope min-h-screen">`, obere Statusleiste (Logo/Uhr, Rolle+Name,
  `LiveIndicator`, `BETA`-Badge, "Zu Classic"-Button immer sichtbar via `onSetUiMode("classic")`),
  linke Nav (Desktop) aus `mcNavForRole`, Hauptinhalt = bestehende Tabs (identische Props),
  darunter die drei Modals + ChatPanel (Glue dupliziert). Beim Gate zwei additive Props
  ergänzen (offline, connIssue).
- Unverändert: Dashboard (byte-genau), alle Tabs/Modals/ChatPanel, Datenschicht, Rollen,
  driver/stage/guest-Routing.
- Nutzen: voll funktionsfähiger Shell über gleiche Schreibwege. Risiko: mittel (Callback-
  Signaturen 1:1 treffen). Regression Classic: gering (additiv, Dashboard nicht angefasst).
- Test: jeden Tab öffnen; Zuteilen/Status/Problem/WhatsApp/Chat/Undo funktionieren und
  schreiben mit `dispo:<id>`; Wechsel Classic<->Mission verliert keinen Stand; "Zu Classic"
  immer erreichbar; Stage/Driver/Guest unverändert (per grep: Routing-Zweige unberührt).

**Slice 5.3 — Mobile-Nav im Shell**
- Datei: `src/ShuttleLeitstelle.jsx`. Untere mobile Leiste (Live/Fahrten/Rückfahrten/Fahrer/
  Mehr) innerhalb `MissionControl`, ebenfalls `mcNavForRole`-gefiltert. Desktop-Nav ab
  Breakpoint einblenden, mobile Leiste darunter.
- Unverändert: Classic, Desktop-Verhalten, Datenschicht.
- Nutzen: mobile Nutzbarkeit. Risiko/Regression: gering.
- Test: schmale Breite zeigt mobile Leiste; "Mehr" öffnet Restpunkte; Rollenfilter greift.

**Danach:** Abschlussprüfung wie immer: geänderte Dateien, Erklärungen, Regressionen,
Rolle-für-Rolle (Admin/Dispo/Fahrer/Stage) x (Classic/Mission) x (Desktop/Mobile). Dann
`PROJEKT-ANWEISUNGEN.md` fortschreiben, Übergabe für Session 6 vorbereiten.

---

## Nützliche Greps

```
grep -nE '^function [A-Z][a-zA-Z]+' src/ShuttleLeitstelle.jsx        # alle Komponenten
grep -n 'if (uiMode === "mission-control")' src/ShuttleLeitstelle.jsx # das Gate (Z.1112)
grep -n 'tab === "overview"' src/ShuttleLeitstelle.jsx               # Dashboard-Tab-Body
grep -n '{assignRide &&\|{editRide &&\|{waRide &&' src/ShuttleLeitstelle.jsx # Modals-Glue
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d    # Duplikate
```

## Erste konkrete Aktion im neuen Chat

Repo klonen, Branch `feature/mission-control-beta` auschecken, `npm ci`, Baseline-esbuild
grün bestätigen, Anker (1102/1112, 3492, 3598, 3839-3852, 3855-3945, 7885) gegen den echten
Stand verifizieren, dann Slice 5.1 vorschlagen und nach OK bauen.
