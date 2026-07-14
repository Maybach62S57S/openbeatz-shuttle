# Übergabe: Session 14 — Minimal-Paket (4 Punkte, davon 2 ohne Code)

Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Pro Scheibe ein
eigener Chat. Erst `PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker prüfen,
Risikoabwägung, dann nach OK bauen.

---

## Stand
Branch `feature/mission-control-beta`, letzter Code-Commit **`cd2a194`**
(Emergency-Fallback/ErrorBoundary, Session 13), Doku-HEAD `1dc4d01`. Rückweg: Tag `stabil-vor-design-2026-07-13`,
Branch `backup/paket-3-fertig`. Hauptdatei `src/ShuttleLeitstelle.jsx` (~10.464 Zeilen).

Festival: 23.–27.07.2026. Diese Übergabe entstand am 14.07.2026, also 9 Tage vorher.
Deshalb bewusst das kleinste sinnvolle Paket.

---

## ⚠️ Wichtig: parallel gearbeitet
Waehrend diese Uebergabe entstand, hat eine parallele Session den
Emergency-Fallback (ErrorBoundary, `cd2a194`) gepusht. Dadurch sind ALLE
Zeilennummern unterhalb von ~1100 um rund 100 nach unten gerutscht. Die Nummern
unten sind gegen `1dc4d01` **neu verifiziert**, nicht hochgerechnet. Trotzdem
gilt wie immer: vor jedem Edit per grep gegenpruefen, nicht der Nummer vertrauen.
Wenn zwischenzeitlich weiter gepusht wurde, stimmen sie erneut nicht.

---

## TEIL 1 — Jordans Aufgaben, kein Code nötig

### 1.1 Google-Maps-Key setzen
**Problem:** Google Maps ist nirgends sichtbar. Ursache ist NICHT fehlender Code.
`MapTab` (auch in MC) hat den Schema/Google-Umschalter längst. Die App prüft
`hasGoogleMaps()` (Zeile 77) auf `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` und
fällt ohne Key sauber auf die Schema-Karte zurück (Hinweistext bei 8674).

**Lösung:** In Vercel `VITE_GOOGLE_MAPS_API_KEY` setzen.
- Zwingend für **Preview**, nicht nur Production (die MC-Beta läuft als Preview
  vom Feature-Branch).
- `VITE_`-Variablen werden **beim Bauen** eingebacken, nicht zur Laufzeit gelesen.
  Nach dem Setzen also **neu deployen**, sonst passiert nichts.

**Kosten-Hinweis:** Google Maps kostet pro Map Load. Der Schema-Fallback ist gratis.
Bei 20 Fahrern im Dauerbetrieb das Kontingent im Auge behalten.

### 1.2 Montag (27.07.) ergänzen
**Problem:** Die Tagesleiste zeigt nur Do–So, der Montag fehlt, obwohl es an dem
Tag Fahrten gibt.

**Ursache:** Kein Code-Fehler. `dayTabs()` baut die Leiste aus
`setup.config.festivalDates` plus allen `dayKey`s aus vorhandenen Fahrten. Der
Standard in `seedConfig()` (Zeile 509) enthält alle fünf Tage inkl. `2026-07-27`.
Im Livebetrieb kommt `config` aber aus der Supabase-`settings`-Zeile, und dort
fehlt der 27.07.

**Lösung:** In der App unter **Einstellungen → Festival-Tage** (Abschnitt ab ~9007)
im leeren Feld unten `2026-07-27` eintragen. Kein SQL nötig.
Danach prüfen, dass die Montags-Fahrten auch wirklich importiert sind.

---

## TEIL 2 — Auftrag für den Chat (2 kleine Code-Änderungen, beide MC-only)

### 2.1 "Anstehend" in die MC-KPI-Leiste
Heute zeigt die Leiste: Fahrten / Offen / Aktiv / Erledigt. Es fehlt "Anstehend".

**Stelle A — `kpi`-Objekt bei Zeile 9439 (im MC-Shell).**

⚠️ **ACHTUNG, Anker ist NICHT eindeutig:** `const kpi = {` kommt DREIMAL vor
(3651 = Classic-Dashboard, 4083 = Mobile, 9439 = MC-Shell). Nur **9439** anfassen.
Immer mit genug Kontext ersetzen oder per Zeilennummer arbeiten, sonst trifft
man Classic.

Heutiger Stand bei 9439:
```js
  const kpi = {
    total: dayRides.filter((r) => r.status !== "cancelled").length,
    unassigned: dayRides.filter((r) => !r.assignedDriverId && r.status !== "cancelled").length,
    active: dayRides.filter((r) => ["accepted", "enroute_pickup", "onboard"].includes(r.status)).length,
    done: dayRides.filter((r) => r.status === "done").length,
  };
```
Ergänzen (Definition 1:1 aus `OverviewTab` Zeile 7026 übernommen, damit die Zahl
identisch zur bisherigen Kachel ist):
```js
    pending: dayRides.filter((r) => r.status === "planned").length,
```

**Stelle B — Ausgabe-Array bei Zeile 9575.** Heute:
```js
{[["Fahrten", kpi.total, null], ["Offen", kpi.unassigned, kpi.unassigned ? "assigned" : null], ["Aktiv", kpi.active, "enroute"], ["Erledigt", kpi.done, "done"]].map(([l, v, st]) => (
```
Eintrag `["Anstehend", kpi.pending, "new"]` ergänzen, Reihenfolge:
Fahrten / Offen / **Anstehend** / Aktiv / Erledigt.
Statusfarbe `"new"` (blau) passt zu `MC_STATUS.new`.

**Prüfen:** Die Leiste hat dann 5 statt 4 Kacheln. Sicherstellen, dass sie auf
schmalerem Desktop nicht bricht (ggf. `flex-wrap`). Rein additiv, keine
Datenlogik geändert, Classic unberührt.

### 2.2 Menü-Label "Kalender" → "Timeline"
Zeile **10059** (im MC-Nav-Array, eindeutig, kommt nur einmal vor):
```js
  { tab: "timeline",  label: "Kalender",        icon: Gauge,         group: "PLANUNG & KOMMUNIKATION" },
```
`label` auf `"Timeline"` ändern. Der Tab heißt intern ohnehin schon `timeline`,
das Label war schlicht falsch. Reine Kosmetik, MC-only.

Optional (Jordan fragen, nicht ungefragt machen): das Icon `Gauge` passt für eine
Timeline mäßig. Nur ändern, wenn Jordan es will.

---

## Wichtige Erkenntnis aus der Analyse (für später)

**"Offen" bedeutet an zwei Stellen Verschiedenes.** In der MC-KPI-Leiste ist
"Offen" = `unassigned` (ohne Fahrer). In den Überblick-Kacheln stand "Offen" für
etwas anderes (auf Jordans Screenshot: oben OFFEN 0, unten OFFEN 3 bei 4 gesamt /
1 erledigt). Vor dem Festival sollte klar sein, welche Bedeutung im Ernstfall gilt.
Nicht ungefragt vereinheitlichen, das ist eine Entscheidung von Jordan.

Ausserdem: "Anstehend" (planned) und "Offen" (ohne Fahrer) ueberschneiden sich,
eine Fahrt kann beides sein. Die Zahlen addieren sich also nicht auf "Fahrten".

---

## Bewusst NICHT in diesem Paket

- **Neon-Design:** ca. 3–4 Sessions. Grund: MC rendert 9 Tabs. MC-eigene
  (MissionTimelinePage, MissionReturnsTab, MissionEmergencyTab,
  MissionMessagesInbox, MissionDriversTab) sind getokenisiert und färben sich per
  Token-Wechsel automatisch. Aber **OverviewTab (39 Tailwind-Farbklassen), MapTab
  (35), FlightTab und SettingsTab sind geteilt mit Classic und Tailwind-gefärbt**,
  reagieren also NICHT auf die MC-Tokens. Ausgerechnet OverviewTab ist der
  Startbildschirm. Ein reiner Token-Wechsel ergäbe halb neon / halb alt.
  Realistisch: Slice A (Tokens + Glow-Regeln auf bestehende `.mc-*`-Klassen +
  Icon-Kacheln) = 1 Session. Slice B (`MissionOverviewTab`: Kacheln raus,
  KPI-Leiste grösser, getokenisiert) = 1 Session. Slice C (MapTab/FlightTab/
  SettingsTab) = 1–2 Sessions.
- **Statuskacheln unter "Leitstelle · Überblick" entfernen:** klingt trivial,
  sitzt aber in `OverviewTab` (7008), das Classic (3940) UND MC (9813) rendern.
  Löschen träfe Classic. Braucht eine MC-eigene `MissionOverviewTab` → gehört zu
  Slice B oben.
- **Google-Umschalter in der Überblick-Minikarte:** `BoardMiniMap` (ab 8477, 45 Zeilen) kennt nur Schema. Additiver Prop `allowGoogle = false` analog zum
  bestehenden `SchematicComponent`-Muster, dann Umschalter + `LiveGoogleMap`.
  Ca. eine halbe Session. Der **Karte-Tab in MC hat den Umschalter bereits**,
  dafür reicht der Key aus 1.1.
- **3D-Stadtkarte, Fahrer-Fotos, Verlaufskurven** (aus Jordans Wunsch-Render):
  keine Datengrundlage bzw. echter Umbau. Nach dem Festival.

---

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI byte-genau unverändert.
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
  Schreiblogik anfassen.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Referenz-Gegencheck + Node-Test
  für neue reine Logik + Diff-Beleg. Push auf den Feature-Branch.
- Commit-Messages über `/tmp/msg.txt` (Umlaut-sicher).

## Anker / Greps
```
grep -n 'const kpi = {' src/ShuttleLeitstelle.jsx            # 3 Treffer! Nur 9439 ist MC
grep -n '\[\["Fahrten", kpi.total' src/ShuttleLeitstelle.jsx  # KPI-Ausgabe 9575
grep -n 'label: "Kalender"' src/ShuttleLeitstelle.jsx         # 10059, eindeutig
grep -n 'const anstehend' src/ShuttleLeitstelle.jsx           # 7026, Vorlage
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
```

## Live-Test danach (Jordan, echtes Gerät)
- KPI-Leiste zeigt 5 Kacheln, "Anstehend" plausibel, Umbruch sauber.
- Menü sagt "Timeline", öffnet dieselbe Seite wie vorher.
- Nach Key + Redeploy: MC → Karte → Umschalter auf Google, Karte lädt.
- Nach Festival-Tag: Montag 27.07. taucht in der Tagesleiste auf, Fahrten sichtbar.
- Classic gegenprüfen: KPI-Leiste und Navigation unverändert.

## Ready-to-paste Opener für Session 14
```
Session 14, frischer Chat. Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta, letzter
Code-Commit cd2a194 (Doku-HEAD 1dc4d01). PAT setze ich unten ein: <PAT>
Nach Klon: git config (user.name/email), checkout feature/mission-control-beta,
npm ci, Baseline-esbuild gruen. Danach UEBERGABE-Session-14.md lesen.
Feste Regeln wie gehabt: nur uiMode mission-control, Classic byte-genau unveraendert,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, kein neues top-level dyn-Feld, Stage Manager
read-only. Nach jeder Aenderung esbuild + Duplikat-Grep + Referenz-Gegencheck +
Node-Test + Diff-Beleg, Push auf Feature-Branch. Bevor du baust: Scope bestaetigen,
Stelle lokalisieren, Risikoabwaegung, dann nach OK in kleinen Scheiben.
AUFTRAG SESSION 14 (klein, beides MC-only):
1) "Anstehend" in die MC-KPI-Leiste. kpi-Objekt bei 9439 um
   pending: dayRides.filter(r => r.status === "planned").length ergaenzen
   (ACHTUNG: 'const kpi = {' gibt es 3x - 3651 Classic, 4083 Mobile, 9439 MC.
   Nur 9439!). Ausgabe-Array bei 9575 um ["Anstehend", kpi.pending, "new"]
   ergaenzen, Reihenfolge Fahrten/Offen/Anstehend/Aktiv/Erledigt. Auf Umbruch achten.
2) Menue-Label bei 10059 von "Kalender" auf "Timeline" (Tab heisst intern schon
   timeline, Label war falsch).
Danach Diff-Beleg, dass Classic nicht getroffen ist.
```

---

## NACHTRAG (14.07., aus Jordans Live-Test): Bug im Feld "Festival-Tage"

**Befund:** `setup.config.festivalDates` war in der Produktivdatenbank **leer**.
Die Tagesleiste zeigte Do–So nur deshalb, weil `dayTabs()` zusaetzlich alle
`dayKey`s aus vorhandenen Fahrten einsammelt. Der Montag fehlte, weil er weder
in der Liste stand noch Fahrten hatte. Jordan traegt die fuenf Tage per
Kalender-Picker nach (Workaround, siehe unten).

**Zwei echte Bugs im Abschnitt "Festival-Tage" (Einstellungen, ~9007):**

1. **Sortieren bei jedem Tastendruck zerstoert andere Eintraege.**
   Der Edit-Handler macht:
   ```js
   const arr = [...(s.config.festivalDates || [])]; arr[i] = e.target.value;
   s.config.festivalDates = [...new Set(arr.filter(Boolean))].sort();
   ```
   `<input type="date">` feuert onChange pro Segment. Beim Tippen der Jahreszahl
   entstehen unterwegs gueltige Zwischen-Daten (Jahr 2 -> 20 -> 202 -> 2026).
   Jede Zwischenstufe wird uebernommen UND neu sortiert -> der bearbeitete
   Eintrag wandert auf eine andere Position, `i` zeigt danach auf einen ANDEREN
   Tag, der naechste Tastendruck ueberschreibt den. So frisst das Feld beim
   Tippen fremde Eintraege.
   **Fix-Richtung:** nicht bei jedem onChange schreiben/sortieren, sondern erst
   onBlur (oder lokalen Entwurfs-State pro Zeile halten und erst beim Verlassen
   committen). Sortieren nur beim Commit, nicht waehrend der Eingabe.

2. **Das Hinzufuegen-Feld leert sich nicht.**
   ```jsx
   <input type="date" value="" onChange={...} />
   ```
   Der `value=""` ist konstant, React sieht zwischen den Renders keine
   Aenderung und fasst das DOM nicht an -> der vom Nutzer gewaehlte Wert bleibt
   sichtbar stehen, obwohl er schon in der Liste ist. Verwirrend, aber harmlos.
   **Fix-Richtung:** eigener State fuer das Feld, nach erfolgreichem Hinzufuegen
   auf "" zuruecksetzen (oder `key` hochzaehlen, um das Feld neu zu mounten).

**Workaround bis zum Fix:** Datum ausschliesslich per Kalender-Picker auswaehlen,
nie tippen. Der Picker feuert ein einziges Ereignis mit vollstaendigem Datum.
Bestehendes Datum aendern: loeschen und neu anlegen statt editieren.

**Prioritaet:** niedrig fuers Festival (einmal korrekt eingetragen, fasst es
niemand mehr an), aber der Datenverlust beim Tippen ist haesslich. Achtung: das
ist die GETEILTE `SettingsTab`, also Classic UND MC. Kein MC-only-Fix, deshalb
Risikoabwaegung mit Jordan vor dem Bauen.
