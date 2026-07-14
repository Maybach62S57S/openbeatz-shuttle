# Übergabe: Session 15 — Kleinkram vor dem Festival

Diese Datei ersetzt `UEBERGABE-Session-14.md`. Die dortigen Nachträge 1–3 zum
Feld "Festival-Tage" sind **erledigt** (Fix `234117b`) und nur noch historisch
interessant. Alles Aktuelle steht hier.

Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Pro Scheibe ein
eigener Chat. Erst `PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker per
grep gegenpruefen, Risikoabwaegung, dann nach OK bauen.

---

## Stand (14.07.2026, 21:45)

- Branch **`feature/mission-control-beta`**, letzter Code-Commit **`234117b`**
- Hauptdatei `src/ShuttleLeitstelle.jsx`, **10.479 Zeilen**, esbuild gruen
- Rueckweg: Tag `stabil-vor-design-2026-07-13` = Branch `backup/paket-3-fertig`
  = **`main`** (alle drei auf `4d13e59`)
- Festival: **23.–27.07.2026**. Diese Uebergabe entstand 9 Tage vorher.

**⚠️ Zeilennummern:** Sie sind gegen `234117b` verifiziert. An diesem Branch
arbeiten zeitweise mehrere Sessions parallel — heute hat ein fremder Commit
alles um 100 Zeilen verschoben, ein eigener um weitere 15. **Immer per grep
gegenpruefen, nie der Nummer vertrauen.** Vor dem Start `git fetch` und
schauen, ob der HEAD noch `234117b` ist.

---

## Was zuletzt passiert ist

- **`7c0d362` / `74db596`** — Effekt 10 (Kartenmarker gleiten weich), SVG per
  CSS-transform und Google per rAF-Interpolation. Damit ist das
  MC-Animationspaket komplett.
- **`cd2a194`** (parallele Session) — Emergency-Fallback: `MissionControlBoundary`
  umschliesst nur den MC-Zweig und faellt bei einem Render-Crash automatisch auf
  Classic zurueck.
- **`234117b`** — Fix im Feld "Festival-Tage" (Geisterzeile, Geisterwert,
  Index-Bug). Details unten unter "Zur Kenntnis".

---

## AUFTRAG fuer diesen Chat (klein, beides MC-only)

### 1. "Anstehend" in die MC-KPI-Leiste
Heute zeigt sie: Fahrten / Offen / Aktiv / Erledigt. Es fehlt "Anstehend".

**Stelle A — `kpi`-Objekt bei Zeile 9454 (MC-Shell).**

⚠️ **`const kpi = {` gibt es DREIMAL:** 3651 (Classic-Dashboard), 4083 (Mobile),
**9454 (MC)**. Nur 9454 anfassen, sonst trifft es Classic. Mit genug Kontext
ersetzen oder per Zeilennummer arbeiten.

Aktuell:
```js
  const kpi = {
    total: dayRides.filter((r) => r.status !== "cancelled").length,
    unassigned: dayRides.filter((r) => !r.assignedDriverId && r.status !== "cancelled").length,
    active: dayRides.filter((r) => ["accepted", "enroute_pickup", "onboard"].includes(r.status)).length,
    done: dayRides.filter((r) => r.status === "done").length,
  };
```
Ergaenzen (Definition 1:1 aus `OverviewTab` Zeile 7026, damit die Zahl zur
bisherigen Kachel passt):
```js
    pending: dayRides.filter((r) => r.status === "planned").length,
```

**Stelle B — Ausgabe-Array bei Zeile 9590.** Aktuell:
```js
{[["Fahrten", kpi.total, null], ["Offen", kpi.unassigned, kpi.unassigned ? "assigned" : null], ["Aktiv", kpi.active, "enroute"], ["Erledigt", kpi.done, "done"]].map(([l, v, st]) => (
```
Eintrag `["Anstehend", kpi.pending, "new"]` ergaenzen. Reihenfolge:
Fahrten / Offen / **Anstehend** / Aktiv / Erledigt. Statusfarbe `"new"` (blau)
passt zu `MC_STATUS.new`.

**Danach pruefen:** Die Leiste hat 5 statt 4 Kacheln. Auf schmalerem Desktop
darf nichts brechen (ggf. `flex-wrap`). Rein additiv, keine Datenlogik.

### 2. Menue-Label "Kalender" → "Timeline"
Zeile **10074** (MC-Nav-Array, eindeutig, kommt nur einmal vor):
```js
  { tab: "timeline",  label: "Kalender",        icon: Gauge,         group: "PLANUNG & KOMMUNIKATION" },
```
`label` auf `"Timeline"` aendern. Der Tab heisst intern laengst `timeline`, das
Label war schlicht falsch. Reine Kosmetik, MC-only.

Optional, nur auf Jordans Wunsch: das Icon `Gauge` passt fuer eine Timeline
maessig. Nicht ungefragt aendern.

**Zum Abschluss:** Diff-Beleg, dass Classic nicht getroffen ist.

---

## Zur Kenntnis (nicht bauen, nur wissen)

**"Offen" bedeutet an zwei Stellen Verschiedenes.** In der MC-KPI-Leiste ist
"Offen" = `unassigned` (ohne Fahrer). In den Ueberblick-Kacheln stand "Offen"
fuer etwas anderes (auf Jordans Screenshot: oben OFFEN 0, unten OFFEN 3 bei
4 gesamt / 1 erledigt). Vor dem Festival sollte klar sein, welche Bedeutung
im Ernstfall gilt. **Nicht ungefragt vereinheitlichen**, das ist Jordans
Entscheidung.

Ausserdem: "Anstehend" (planned) und "Offen" (ohne Fahrer) ueberschneiden sich,
eine Fahrt kann beides sein. Die Zahlen addieren sich nicht auf "Fahrten".

**Was `234117b` geloest hat** (falls Jordan darauf zurueckkommt): In der
Produktivdatenbank stand `config.festivalDates: [""]` — ein leerer String. Die
`map()` rendert dafuer eine Zeile mit X, `dayTabs()` filtert ihn per
`filter(Boolean)` weg (also kein Tag), und Safari stellte im leeren Datumsfeld
per Formular-Restore dauerhaft "14.07.2026" dar. Jordan klickte also gegen eine
Browser-Anzeige. Zusaetzlich liefen Loeschen/Bearbeiten ueber den Index der
ROHEN Liste, wodurch das X bei fuehrendem Leereintrag den falschen Datensatz
traf. Gefixt: leere Eintraege werden vor dem Rendern und in allen Schreibpfaden
gefiltert, die Handler arbeiten ueber den WERT statt den Index, das
Hinzufuegen-Feld hat eigenen State + `autoComplete="off"`. Node-Test 16/16.
**`SettingsTab` ist mit Classic geteilt** — bei Problemen dort zuerst schauen.

---

## Verbindliche Regeln (unveraendert)
- Nur `uiMode === "mission-control"`. Classic UI unveraendert (laufzeit-identisch).
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
  Schreiblogik anfassen.
- Keine neuen Libs, keine Supabase-Struktur-Aenderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Nach jeder Aenderung: esbuild + Duplikat-Grep + Referenz-Gegencheck + Node-Test
  fuer neue reine Logik + Diff-Beleg. Push auf den Feature-Branch.
- Commit-Messages ueber `/tmp/msg.txt` (Umlaut-sicher).
- esbuild kompiliert durch undefinierte JSX-Variablen durch → Referenzen immer
  gegenchecken, sonst Laufzeit-Crash ohne Build-Fehler.

## Anker / Greps
```
git fetch && git log --oneline -1          # steht HEAD noch auf 234117b?
grep -n 'const kpi = {' src/ShuttleLeitstelle.jsx            # 3 Treffer! Nur 9454 ist MC
grep -n '\[\["Fahrten", kpi.total' src/ShuttleLeitstelle.jsx  # KPI-Ausgabe 9590
grep -n 'label: "Kalender"' src/ShuttleLeitstelle.jsx         # 10074, eindeutig
grep -n 'const anstehend' src/ShuttleLeitstelle.jsx           # 7026, Vorlage
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
```

---

## Jordans offene Aufgaben (kein Code)

1. **Montags-Fahrten importieren** (Einstellungen → Pickup-Liste importieren).
   Wichtigster Punkt. `dayTabs()` sammelt alle `dayKey`s aus den Fahrten ein,
   der Tab **Mo 27.07.** erscheint dann automatisch. Die festivalDates-Liste ist
   nur fuer Tage OHNE Fahrten noetig.
2. **Festival-Tage 23.–27.07.2026 eintragen** (optional, nach Deploy von
   `234117b` sollte das Feld sich normal verhalten).
3. **Google Maps pruefen:** MC → Karte → oben auf "Google Maps" klicken. Der
   Umschalter steht per Default auf Schema-Karte, Google laedt nie von allein.
   Key `VITE_GOOGLE_MAPS_API_KEY` ist fuer Production UND Preview gesetzt
   (seit 11.07.), Builds seither gab es mehrere. **Ergebnis steht noch aus.**
4. **Serverseitige Env-Variablen pruefen** (Filter in Vercel auf Production/All
   stellen, nicht Preview): `ANTHROPIC_API_KEY`, `VAPID_*`,
   `SUPABASE_SERVICE_ROLE_KEY`, `AERODATABOX_*`, `INTERNAL_API_SECRET`.
   Davon haengen Chat-Assistent, echte Push-Benachrichtigungen und
   Flug-Live-Tracking ab. Ohne sie faellt Push auf Vordergrund-Toasts und
   Fluege auf manuelle Pflege zurueck. Kein Blocker, aber Jordan sollte wissen,
   was beim Festival wirklich laeuft.

**Wichtig zu wissen:** Production und Preview haengen an **derselben** Supabase-
Datenbank (`VITE_SUPABASE_URL` ist ein Eintrag fuer beide Umgebungen). Die
Preview ist also **kein Spielplatz** — jede Zuteilung, jeder Statuswechsel dort
sind echte Daten.

---

## Der grosse offene Punkt: Merge auf Production

**Ohne Merge laeuft Mission Control beim Festival nicht.** MC existiert nur auf
`feature/mission-control-beta`; `main` (= Production) kennt `obf:uiMode` gar nicht.

Lage:
- `main` fehlen 36+ Commits, Diff in `src` rund +3800 / -1200 Zeilen
  (netto ~2650 Zeilen, 7818 → 10479).
- Der Feature-Branch ist ein **sauberer Nachfahre** von `main` → Fast-Forward
  ohne Konflikte moeglich.
- Rueckweg exzellent: Tag + Backup-Branch liegen auf `4d13e59`, ein Merge ist
  jederzeit zurueckdrehbar.

Risiko ist **nicht MC** (standardmaessig aus, nur Dispo-Desktop, ErrorBoundary
faengt Crashes und faellt auf Classic zurueck), sondern die **geteilten
Komponenten**, die unterwegs angefasst wurden: `BoardMiniMap`, `MapTab`,
`LiveGoogleMap` (je additiver Prop mit Default = altes Verhalten) und jetzt
`SettingsTab`. Alles per Diff belegt, aber **nicht in Produktion getestet**.

Deshalb: **eigene Session**, mit Classic-Regressionsdurchlauf VOR dem Merge
(Fahrten zuteilen, Status wechseln, Karte, Timeline, Einstellungen, Fahrer-App,
Stage, Gast-Link). Danach Fast-Forward, dann Production durchklicken.

**Timing:** frueh mergen, nicht spaet. Am 21.07. reicht die Zeit fuer einen
Fehlerfund nicht mehr.

---

## Bewusst NICHT im Scope

- **Neon-Design:** ca. 3–4 Sessions. MC rendert 9 Tabs. Die MC-eigenen
  (MissionTimelinePage, MissionReturnsTab, MissionEmergencyTab,
  MissionMessagesInbox, MissionDriversTab) sind getokenisiert und faerben sich
  per Token-Wechsel automatisch. Aber **OverviewTab (39 Tailwind-Farbklassen),
  MapTab (35), FlightTab und SettingsTab sind mit Classic geteilt und
  Tailwind-gefaerbt** → reagieren NICHT auf die MC-Tokens. Ausgerechnet
  OverviewTab ist der Startbildschirm. Ein reiner Token-Wechsel ergaebe halb
  neon / halb alt. Realistisch: Slice A (Tokens + Glow-Regeln auf bestehende
  `.mc-*`-Klassen + Icon-Kacheln) = 1 Session. Slice B (`MissionOverviewTab`:
  Statuskacheln raus, KPI-Leiste groesser, getokenisiert) = 1 Session.
  Slice C (MapTab/FlightTab/SettingsTab) = 1–2 Sessions. Jordan hat Neon am
  14.07. vorerst zurueckgestellt.
- **Statuskacheln unter "Leitstelle · Ueberblick" entfernen:** klingt trivial,
  sitzt aber in `OverviewTab` (7008), das Classic (3940) UND MC (9813) rendern.
  Loeschen traefe Classic → braucht eine MC-eigene `MissionOverviewTab`,
  gehoert zu Slice B.
- **Google-Umschalter in der Ueberblick-Minikarte:** `BoardMiniMap` (ab 8477,
  45 Zeilen) kennt nur Schema. Additiver Prop `allowGoogle = false` analog zum
  bestehenden `SchematicComponent`-Muster, dann Umschalter + `LiveGoogleMap`.
  Ca. eine halbe Session. Der **Karte-Tab in MC hat den Umschalter bereits**.
  Hinweis: Google Maps kostet pro Map Load, Schema-Karte ist gratis.
- **3D-Stadtkarte, Fahrer-Fotos, KPI-Verlaufskurven** (aus Jordans Wunsch-Render):
  keine Datengrundlage bzw. echter Umbau. Nach dem Festival.
- **Datei-Splitting, Asset-Extraktion, SQL-RPC-Refactor:** nach dem Festival.

---

## Ready-to-paste Opener
```
Neuer Chat fuers Open Beatz Shuttle-Projekt. Erst PROJEKT-ANWEISUNGEN.md lesen,
dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta,
letzter Code-Commit 234117b. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), git checkout
feature/mission-control-beta, npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
Danach UEBERGABE-Session-15.md lesen (die ersetzt Session 14).
Pruef zuerst per git fetch, ob HEAD noch auf 234117b steht - an dem Branch
arbeiten zeitweise mehrere Sessions parallel, dann stimmen die Zeilennummern in
der Uebergabe nicht mehr und muessen per grep neu ermittelt werden.

Feste Regeln wie gehabt: nur uiMode mission-control, Classic laufzeit-identisch
lassen, keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/
Supabase-Schreiblogik aendern, keine neuen Libs, keine Supabase-Struktur-
Aenderung, kein neues top-level dyn-Feld, Stage Manager read-only.
Nach jeder Aenderung: esbuild + Duplikat-Grep + Referenz-Gegencheck + Node-Test
fuer neue reine Logik + Diff-Beleg, Commit ueber /tmp/msg.txt, Push auf den
Feature-Branch. Bevor du baust: Scope bestaetigen, Stelle lokalisieren,
Risikoabwaegung, dann nach OK in kleinen Scheiben. Sprache Deutsch, informell,
keine Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat
zu lang wird.

AUFTRAG SESSION 15 (klein, beides MC-only):
1) "Anstehend" in die MC-KPI-Leiste. kpi-Objekt bei 9454 um
   pending: dayRides.filter(r => r.status === "planned").length ergaenzen
   (ACHTUNG: 'const kpi = {' gibt es 3x - 3651 Classic, 4083 Mobile, 9454 MC.
   Nur 9454!). Ausgabe-Array bei 9590 um ["Anstehend", kpi.pending, "new"]
   ergaenzen, Reihenfolge Fahrten/Offen/Anstehend/Aktiv/Erledigt. Auf Umbruch
   achten (5 statt 4 Kacheln).
2) Menue-Label bei 10074 von "Kalender" auf "Timeline" (Tab heisst intern schon
   timeline, das Label war falsch).
Zum Schluss Diff-Beleg, dass Classic nicht getroffen ist.
```
