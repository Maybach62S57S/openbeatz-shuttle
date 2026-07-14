# Übergabe: Session 6 — Mission Control Beta (frischer Chat)

Komplette Startnachricht für einen neuen Chat. Sprache: Deutsch, informell,
keine Gedankenstriche, korrekte Umlaute. PAT unten selbst einsetzen (steht
bewusst nicht drin, wird nirgends gespeichert).

Wichtig zur Arbeitsweise: pro Scheibe ein eigener Chat (Chat-Länge = Qualitäts-
tor, lange Chats stürzen ab). Erst `PROJEKT-ANWEISUNGEN.md` lesen, dann Repo
holen, Anker gegenprüfen, Risikoabwägung, dann nach OK bauen.

---

## Repo / Setup

- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**, letzter Commit `717d363`
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~8767 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, dann Baseline grün bestätigen:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)

- Nur für `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Bestehende Views nur einsetzen, nicht neu schreiben, nichts entfernen.
- Keine Datenlogik / Rollenlogik / Login / PIN / Auth / Rechte anfassen.
- Bestehende Rechteprüfung wiederverwenden (`mcNavForRole` nutzt nur `session.role`),
  KEINE zweite Rollenquelle.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stabilität vor Performance vor Features. Erst Risikoabwägung, dann nach OK bauen.
- Stage Manager strikt read-only + Probleme melden. Nie mehr als Live-Ansicht + Problem melden.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Icon-/Referenz-Gegencheck
  (esbuild kompiliert durch undefinierte JSX-Refs!) + Node-Test für neue reine Logik.
- Commit über `git commit -F /tmp/msg.txt` (Umlaut-Sicherheit), Push auf den Feature-Branch.

---

## Stand jetzt (Session 5 komplett, alles auf dem Branch)

**Slice 5.1** — `MC_NAV` (flaches Item-Array, jedes Item mit `tab/label/icon/group`),
`MC_NAV_GROUPS`, `MC_ROLE_TABS` (dispo=null=alle, stage=`{overview,emergency}`,
driver=`{overview}`), `mcNavForRole(role)`. Reine, testbare Logik. Anker ~Z. 8447-8516.

**Slice 5.2** — `MissionControl` (Z. **7886**) ist ein echtes Shell (Ansatz A = eigene,
duplizierte Dashboard-Glue, KEINE Hook-Extraktion). Obere Statusleiste (Logo/Uhr,
Rolle+Name, `LiveIndicator`, `BETA`, Undo, „Zu Classic\" immer erreichbar, Logout),
Tage+KPIs, linke Desktop-Nav aus `mcNavForRole`, Hauptinhalt = die BESTEHENDEN Tabs
(`overview/board/returns/emergency/messages/flights/map/drivers/settings/timeline`)
mit exakt denselben Props/Callbacks wie Dashboard, darunter `AssignModal`/`RideForm`/
`WhatsAppModal`/`ChatPanel`. Wurzel trägt `mc-scope` (Designsystem greift). Gate im
Dispo-Desktop-Zweig Z. **1112**, NACH `if (useMobileView)` Z. **1102**.

**Slice 5.3 (Commit `717d363`)** — untere feste Mobil-Navigationsleiste in MissionControl:
- `MC_MOBILE_PRIMARY = ["overview","board","returns","drivers"]` + `MC_MOBILE_LABEL =
  {overview:"Live"}` neben `MC_NAV` (~Z. 8518).
- In `MissionControl`: State `moreOpen`; Ableitungen `mobilePrimary` (Schnitt aus
  `MC_MOBILE_PRIMARY` x `navItems`, feste Reihenfolge), `mobileMore` (Rest der rollen-
  erlaubten Punkte in `MC_NAV`-Reihenfolge), `moreActive/moreBadge/moreCrit`.
- Untere fixe Leiste `md:hidden fixed bottom-0 z-30` mit Live/Fahrten/Rückfahrten/Fahrer
  + „Mehr\". „Mehr\" öffnet ein Blatt (`z-30`, Klick daneben/X schließt) mit
  map/flights/emergency/timeline/messages/settings. Aktiv-Indikator (Linie oben) +
  Badges (Probleme/Chat) auch mobil.
- Linke Desktop-Nav jetzt `hidden md:block` (bewusst `block`, nicht `flex`, sonst kippen
  die vertikalen Nav-Gruppen in eine Zeile). `main` bekommt `pb-24 md:pb-5`.
- Chat-FAB responsive: neue CSS-Var `--mc-fab-lift` in `MissionStyles` (Default
  `calc(56px + safe-area)` auf schmal, ab md `0px`), an `ChatPanel` als `liftOffset`
  durchgereicht. Kein FAB/Leisten-Überlapp.
- `MoreHorizontal` aus lucide ergänzt (nur ein weiterer Icon-Name, keine neue Lib).

Rollen per Node-Test bewiesen: dispo primary+more = komplette Nav ohne Überschneidung;
stage = nur „Live\" + „Mehr\"(Probleme); driver = nur „Live\"; unbekannte Rolle = nichts.

**z-Ordnung:** Leiste/Blatt `z-30` unter den Modals (`Modal` = `z-40`, `ChatPanel` =
`z-50`), ein offenes Modal überdeckt die Leiste sauber.

---

## Sicherheitsentscheidung (unverändert, bitte so lassen)

Mission Control bleibt vorerst **dispo-only** geroutet. Fahrer/Stage/Gast laufen
unverändert in ihren eigenen Routing-Zweigen (weiter oben). Die Nav ist trotzdem
rollenabhängig (`mcNavForRole`), damit ein späteres Routing beweisbar sicher wäre —
Stage/Fahrer tatsächlich in den Shell zu routen ist aber eine EIGENE Scheibe mit
eigener Risikoabwägung, NICHT nebenbei.

---

## Kandidaten für Session 6 (mit Jordan priorisieren, erst Risikoabwägung)

Nichts davon ist beschlossen — im neuen Chat kurz vorschlagen, Jordan entscheidet:
1. **Echte Mission-Control-Landing/Overview** statt nur den bestehenden `overview`-Tab
   einzubetten (KPIs, offene Probleme, Live-Fahrten kompakt). Rein additive Anzeige,
   nur lesend, über bestehende Selektoren — kein neuer Schreibweg.
2. **Feinschliff/Live-Test der Shell** auf echten Geräten (schmal/breit, Tag-Wechsel,
   „Mehr\"-Blatt, FAB-Lift, Umschalten Classic<->Mission ohne Statusverlust).
3. Nur falls gewünscht: Desktop-Nav-Feinheiten (Karte/Flughafen-Einsortierung,
   Badges), immer additiv.

Bei allem gilt: bestehende Views einsetzen, nicht neu schreiben; kein Datenmodell/
Schema/Rollen-Eingriff.

---

## Nützliche Greps / Anker (Commit `717d363`)

```
grep -n 'if (uiMode === "mission-control")' src/ShuttleLeitstelle.jsx   # Gate Z.1112
grep -n 'function MissionControl' src/ShuttleLeitstelle.jsx             # Shell Z.7886
grep -n 'const MC_NAV \|MC_ROLE_TABS\|mcNavForRole\|MC_MOBILE_PRIMARY' src/ShuttleLeitstelle.jsx
grep -n 'mc-fab-lift\|function MissionStyles' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d   # Duplikate
```

## Erste konkrete Aktion im neuen Chat

Repo klonen, Branch auschecken, `npm ci`, Baseline-esbuild grün bestätigen, die Anker
(1102/1112, 7886, 8447-8521) gegen den echten Stand prüfen, dann Session-6-Scope mit
Jordan klären und nach OK die erste Scheibe vorschlagen.
