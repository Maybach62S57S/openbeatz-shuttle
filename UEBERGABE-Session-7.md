# Übergabe: Session 7 — Mission Control Beta (frischer Chat)

Startnachricht für einen neuen Chat. Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. PAT unten selbst einsetzen (wird nirgends gespeichert).
Pro Scheibe ein eigener Chat (lange Chats stürzen ab). Erst
`PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker prüfen, Risikoabwägung,
dann nach OK bauen.

---

## Repo / Setup
- Repo: `Maybach62S57S/openbeatz-shuttle`, Branch **`feature/mission-control-beta`**, letzter Commit `39098c0`
- Gesicherter Rückweg: Tag `stabil-vor-design-2026-07-13`, Branch `backup/paket-3-fertig`
- Hauptdatei: `src/ShuttleLeitstelle.jsx` (~8800 Zeilen)
- PAT hier einfügen: `<DEIN_FINE_GRAINED_PAT>`
- Nach dem Klonen: `git config` (user.name/email), `git checkout feature/mission-control-beta`,
  `npm ci`, Baseline grün:
  `./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js`

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Bestehende Views nur umgestalten/einsetzen, nicht neu schreiben, nichts entfernen.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Rechte-Logik anfassen.
- `mcNavForRole` nutzt nur `session.role`, keine zweite Rollenquelle.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Icon-/Referenz-Gegencheck
  (esbuild kompiliert durch undefinierte JSX-Refs!) + Node-Test für neue reine Logik.
- Commit über `git commit -F /tmp/msg.txt`, Push auf den Feature-Branch.

## Stand jetzt (Sessions 5 + 6 fertig, alles auf dem Branch)
- **5.1-5.3:** `MC_NAV`/`mcNavForRole`, `MissionControl`-Shell (Ansatz A, duplizierte
  Glue), Desktop-Nav + untere Mobil-Leiste (Live/Fahrten/Rückfahrten/Fahrer/Mehr),
  Chat-FAB-Lift via `--mc-fab-lift`.
- **6 (Commit `39098c0`):** `board`-Tab (Fahrtenansicht) in MC neu gestaltet -
  `.mc-ride-card` + Hover, Statusstreifen via reinem `mcRideStatusKey`, `mc`-StatusBadge,
  Filter-Segmented-Control, `.mc-input`-Suche, `mc`-EmptyState/LoadingState, mobiles
  Stapeln (`narrow < 560px`), Flash-Feedback (`flashIds`) nach `updatedAt`-Änderung.
  Nur Darstellung, alle Handler/Dialoge unverändert. Classic byte-identisch.
- **Design-Bausteine vorhanden:** `MissionStyles` (Tokens unter `.mc-scope`),
  `MC_STATUS`, Basiskomponenten `SectionHeader/MissionPanel/StatusBadge/MetricCard/
  IconButton/EmptyState/LoadingState/ErrorState/LiveIndicator`, plus die neuen Klassen
  `.mc-ride-card/.mc-input/.mc-btn-primary/.mc-btn-assign`.

## Kandidaten für Session 7 (mit Jordan priorisieren, erst Risikoabwägung)
1. **Weitere Tabs auf MC-Design umstellen** - genau EIN Tab pro Scheibe, gleiche Methode
   wie board (nur der duplizierte MC-Render, Handler/Dialoge unverändert). Kandidaten:
   `returns`, `emergency`, `flights`, `drivers`, `settings`, `overview` (echte Landing).
2. **MC-Varianten von `DriverRow` und `BoardMiniMap`** (heute noch Stone-Look im MC-Board,
   weil gemeinsame Komponenten mit Classic). Neue MC-Variante bauen, Classic-Version
   unangetastet lassen.
3. Nur falls gewünscht: kleinere Feinheiten (Dichte, Tag-Wechsel-Verhalten), immer additiv.

Bei allem: bestehende Views umgestalten, nicht neu erfinden; kein Datenmodell/Schema/
Rollen-Eingriff; Classic byte-genau unverändert.

## Nützliche Greps / Anker (Commit `39098c0`)
```
grep -n 'if (uiMode === "mission-control")' src/ShuttleLeitstelle.jsx   # Gate
grep -n 'function MissionControl' src/ShuttleLeitstelle.jsx            # Shell Z.~7886
grep -n 'tab === "board"' src/ShuttleLeitstelle.jsx                    # MC-Board (die zweite Fundstelle)
grep -n 'mcRideStatusKey\|mc-ride-card\|flashIds' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
```

## Erste konkrete Aktion im neuen Chat
Repo klonen, Branch auschecken, `npm ci`, Baseline-esbuild grün, Anker prüfen, dann
Session-7-Scope mit Jordan klären und nach OK die erste Scheibe (ein Tab) vorschlagen.

## Offen für Jordans Live-Test (Umgebungsgrenze, nicht im Chat prüfbar)
Board-Redesign auf echten Breiten (Desktop/Handy, Umbruch ~560px), Flash nach echtem
Zuteilen/Bearbeiten, Tailwind-Arbitrary-Values rendern sauber.
