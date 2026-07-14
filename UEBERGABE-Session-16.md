# Übergabe: Session 16: Merge auf Production, danach MC-Überblick

Diese Datei ersetzt `UEBERGABE-Session-15.md`. Der Auftrag von Session 15 ist
erledigt (vier Commits, siehe unten).

Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Pro Auftrag ein
eigener Chat. Erst `PROJEKT-ANWEISUNGEN.md` lesen, dann Repo holen, Anker per
grep gegenprüfen, Risikoabwägung, dann nach OK bauen.

---

## Stand (14.07.2026, 20:15)

- Branch **`feature/mission-control-beta`**, HEAD **`66e4c1e`**
- Hauptdatei `src/ShuttleLeitstelle.jsx`, **10.489 Zeilen**, esbuild grün
- `main` (= Production) steht auf **`4d13e59`**, kennt Mission Control **nicht**
- Rückweg: Tag `stabil-vor-design-2026-07-13` = Branch `backup/paket-3-fertig`
  = `main` (alle drei auf `4d13e59`)
- Festival: **23.–27.07.2026**. Diese Übergabe entstand 9 Tage vorher.

**Zeilennummern** sind gegen `66e4c1e` verifiziert. An dem Branch arbeiten
zeitweise mehrere Sessions parallel. Vor dem Start `git fetch` und schauen, ob
der HEAD noch `66e4c1e` ist. **Immer per grep gegenprüfen.**

---

## Was in Session 15 passiert ist

| Commit | Inhalt |
|---|---|
| `32a0ed6` | KPI-Kachel "Anstehend" in der MC-Leiste (`kpi.pending`) |
| `b74293a` | MC-Nav-Label "Kalender" auf "Timeline" |
| `b058887` | `--mc-st-*-soft` von 0.13/0.14 auf **0.30** |
| `66e4c1e` | Neue `--mc-st-*-fill` bei **0.45** nur für die Timeline-Balken, plus weißer Balkentext |

Alles MC-only, Classic per Prüfsumme gegen `234117b` unverändert.

---

# AUFTRAG A (zuerst!): Merge auf Production

**Ohne Merge läuft Mission Control beim Festival nicht.** Die komplette
Vorarbeit ist unten schon gemacht, die Session sollte kurz sein.

## Der Merge ist ein sauberer Fast-Forward

```
Merge-Base == main HEAD      -> JA, main ist direkter Vorfahre
Commits die main fehlen:     45
Commits die nur main hat:    0        -> Konflikte unmöglich
Geänderte Dateien:           1 Code-Datei + 12 Doku-Dateien
src/ShuttleLeitstelle.jsx:   7818 -> 10489 Zeilen
```

## Risiko ist kleiner als früher angenommen

Prüfsummen-Vergleich `main` gegen `feature/mission-control-beta`, pro Funktion:

| Komponente | Status | Bedeutung |
|---|---|---|
| `DriverApp` | **unverändert** | Fahrer-Rolle: null Risiko |
| `StageApp` | **unverändert** | Stage-Rolle: null Risiko |
| `GuestApp` | **unverändert** | Gast-Rolle: null Risiko |
| `OverviewTab` | **unverändert** | |
| `FlightTab` | **unverändert** | |
| `TimelinePage` | **unverändert** | Classic-Timeline unangetastet |
| `MapTab` | geändert (6 Zeilen) | nur neue Props mit Default |
| `BoardMiniMap` | geändert (2 Zeilen) | nur neuer Prop mit Default |
| `LiveGoogleMap` | geändert | Prop `glide = false`, gegatet |
| `Dashboard` | geändert (25 Zeilen) | Props + "Oberfläche"-Umschalter |
| `SettingsTab` | geändert (33 Zeilen) | **einzige echte Verhaltensänderung** |

**Drei von vier Rollen sind byte-identisch.** Der Testdurchlauf schrumpft
entsprechend.

**Beleg für die Karten-Komponenten:** die neuen Props haben Defaults, die das
alte Verhalten sind (`SchematicComponent = SchematicMap`, `glide = false`,
`glideMarkers = false`). Alle Classic-Aufrufstellen (3932, 4379, 6161, 6166,
7077, 7121) setzen sie **nicht**. Nur die MC-Stellen (9821, 9840) tun das.
`glide` ist zusätzlich gegatet (`if (glide && ...)`).

**`SettingsTab`** ist der festivalDates-Fix aus `234117b`: leere Einträge
werden gefiltert, Handler arbeiten über den WERT statt den Index,
`autoComplete="off"` gegen das Safari-Phantom. Node-Test war 16/16. Das ist
ein Fix, den Jordan haben **will** (siehe seine offene Aufgabe 2).

## Testdurchlauf VOR dem Merge (auf der Preview, in Classic)

Kurz, weil die Risikofläche klein ist:

1. **Leitstelle Desktop, Classic:** Kopfzeile prüfen (neuer "Oberfläche"-
   Umschalter ist gewollt und fällt auf), Fahrt zuteilen, Status wechseln,
   Rückgängig.
2. **Einstellungen → Festival-Tage:** 23.–27.07. eintragen, einen löschen,
   wieder anlegen. Das ist die einzige echte Änderung an Classic.
3. **Karte + Timeline in Classic:** einmal öffnen, muss aussehen wie immer.

Fahrer-App, Stage und Gast-Link brauchen **keinen** Durchlauf, die sind
byte-identisch.

## Merge

```bash
git checkout main
git merge --ff-only feature/mission-control-beta
git push origin main
```

Danach Vercel-Build abwarten und Production einmal durchklicken.

## Rückweg, falls etwas ist

```bash
git reset --hard 4d13e59
git push --force origin main
```

Tag und Backup-Branch liegen beide auf `4d13e59`. Production und Preview hängen
an **derselben** Supabase-DB, der Merge ändert nur das Frontend, keine Daten.

## Timing

**Früh mergen, nicht spät.** Jede weitere Bau-Session vergrößert den Diff, den
Jordan beim Merge durchtestet. Am 21.07. reicht die Zeit für einen Fehlerfund
nicht mehr. Jordan wollte am 14.07. zuerst bauen und dann mergen; die Empfehlung
lautet ausdrücklich umgekehrt.

---

# AUFTRAG B (Session 17): MC-Überblick aufwerten

Jordans Wunsch vom 14.07., wörtlich: auf der Mission-Control-Seite die Livekarte
mit Google ausstatten und die Timeline dort genauso machen wie im Timeline-Tab,
"von den Funktionen und den Fahrern und dem Design".

**Das ist 1,5 bis 2 Sessions, kein Kleinkram.** Bitte in Scheiben, eigener Chat
pro Scheibe.

## Warum es größer ist als es klingt

Beides sitzt in `OverviewTab` (**7008**, 126 Zeilen), und das rendern
**Classic (3940) UND MC (9829)**. Jede Änderung dort trifft Classic, ist also
verboten. Es braucht eine MC-eigene `MissionOverviewTab`. Das ist der in
Session 15 als "Slice B" beschriebene Umbau.

Dazu kommt: `OverviewTab` hat **39 Tailwind-Farbklassen** (stone/orange), die
auf die MC-Tokens **nicht** reagieren. Ein Fork muss die mit tokenisieren, sonst
wird es halb MC, halb Classic.

## Die beiden Bausteine

**1. Google in `BoardMiniMap` (8477, 45 Zeilen).**
Die Komponente kennt Google **gar nicht** (null Treffer), sie kann nur Schema.
Vorgehen analog zum bestehenden, bewährten Muster: additiver Prop
`allowGoogle = false`, dann Umschalter plus `LiveGoogleMap` (8560). Der
Karte-Tab in MC (`MapTab`, 8723) hat den Umschalter **bereits**, dort abschauen.
Ca. eine halbe Session.
**Hinweis:** Google Maps kostet pro Map Load, die Schema-Karte ist gratis. Der
Default muss Schema bleiben.

**2. Timeline im Überblick.**
Im Überblick steht `TimelineView` (**8029**, 81 Zeilen, kompakte Vorschau).
Der Timeline-Tab ist `MissionTimelinePage` (**7601**, 428 Zeilen) mit Zoom,
Filtern, Drag-and-Drop samt Bestätigung, Fahrerzeilen, Konflikterkennung und
Jetzt-Linie. Faktor 5. Entweder `MissionTimelinePage` einbetten oder eine
MC-Variante von `TimelineView` bauen. **Erst mit Jordan klären, was er
wirklich will**, bevor 400 Zeilen dupliziert werden.

## Wichtig: die Renderstellen sind mehr als gedacht

`BoardMiniMap` und `TimelineView` werden **nicht nur** von `OverviewTab`
gerendert:

| Zeile | Renderer | Komponente | Zweig |
|---|---|---|---|
| 3932 | `Dashboard` | BoardMiniMap | Classic |
| 6161 | `ReturnsTab` (5922) | BoardMiniMap | Classic |
| 6166 | `ReturnsTab` | TimelineView | Classic |
| 6451 | `MissionReturnsTab` (6181) | BoardMiniMap | **MC** |
| 6457 | `MissionReturnsTab` | TimelineView | **MC** |
| 7077 | `OverviewTab` | BoardMiniMap | geteilt |
| 7121 | `OverviewTab` | TimelineView | geteilt |
| 8846 | `MapTab` | TimelineView | geteilt |
| 9821 | `MissionControl` | BoardMiniMap | **MC** |

Wenn die MC-Varianten gebaut sind, sollten `MissionReturnsTab` und
`MissionControl` sie **mitbenutzen**, sonst sieht MC an drei Stellen
unterschiedlich aus.

## Vorgeschlagene Scheiben

- **17a:** `BoardMiniMap` bekommt `allowGoogle = false` + Umschalter. Nur der
  Prop und die Mechanik, noch kein Fork. Classic bleibt per Default außen vor.
- **17b:** `MissionOverviewTab` als Fork von `OverviewTab`, tokenisiert,
  `BoardMiniMap` mit `allowGoogle`. MC (9829) rendert sie statt `OverviewTab`,
  Classic (3940) bleibt auf `OverviewTab`.
- **17c:** Timeline im Überblick nach Jordans Entscheidung.

---

## Zur Kenntnis (nicht bauen, nur wissen)

**Vercel liefert pro Commit eine eigene Preview-URL.** Jordan hat am 14.07. Zeit
verloren, weil er auf der URL eines älteren Commits stand und die Änderung
"nicht sah". Immer die **neueste** Deployment für den Branch öffnen und den
Commit-Hash prüfen. `public/sw.js` enthält keinerlei Cache-Code, ein
Service-Worker-Cache ist als Ursache ausgeschlossen.

**`const kpi = {` gibt es dreimal** (3651 Classic, 4083 Mobile, 9454 MC), und
das Classic-Objekt ist **byte-identisch** mit dem MC-Objekt, inklusive der
Folgezeile. Der identische Block reicht mindestens 12 Zeilen nach oben. Ein
kontextbasiertes Ersetzen schlägt dort fehl oder trifft Classic. **Zeilengenau
arbeiten, mit Assertion auf die Zielzeile.**

**Die Farb-Tokens sind bewusst zwei Sets:**
- `--mc-st-*-soft` (**0.30**, ab 10133): Badges und Flächen. Dort steht die
  Akzentfarbe als **Text** auf der Füllung, deshalb ist das Set bei **0.31**
  gedeckelt. Engpass ist grau/idle auf `--mc-panel-raised` (WCAG 3.10). Ein
  Versuch mit 0.32 ist genau daran gescheitert (2.97).
- `--mc-st-*-fill` (**0.45**, ab 10142): **nur** die Timeline-Balken (7839).
  Dort steht weißer Text, der trägt mehr.
Beide unabhängig justierbar. Wer an `-fill` dreht: der weiße Text trägt bis
etwa 0.60 (dann noch ~5.5 schlechtester Kontrast).

**Classic-Stärke (0.8-0.9) ist auf der MC-Palette nicht erreichbar.** Classic
nutzt dunkle Sattfarben (`emerald-600` #059669), MC helle Akzente (#34d399).
Bei 0.8 fällt selbst weißer Text durch (3.00 auf assigned, 2.84 auf done).
Jordan hat sich am 14.07. bewusst für Palette-Konsistenz statt maximaler
Sattheit entschieden.

**Lehre aus Session 15:** ein Kontrast-Test muss **alle** Textebenen prüfen,
nicht nur die Überschrift. Der Test zu `b058887` hat nur die Kopfzeile geprüft
und deshalb übersehen, dass die kleine Mono-Zeitzeile auf 2.17 gerutscht war.
Mit `66e4c1e` behoben.

**Toter Code, nicht angefasst:**
- `barColor` (**7636**) in `MissionTimelinePage`: unbenutzte Kopie aus Classic,
  mitgeschleppt beim Duplizieren nach Ansatz A. Classics eigenes `barColor`
  (**7242**) ist aktiv und tabu.
- `ErrorState` (**10426**): definiert, nirgends verwendet.

**"Offen" bedeutet an zwei Stellen Verschiedenes.** In der MC-KPI-Leiste ist
"Offen" = `unassigned` (ohne Fahrer). In den Überblick-Kacheln steht "Offen"
für etwas anderes. Ausserdem überschneiden sich "Anstehend" (planned) und
"Offen"; eine Fahrt kann beides sein, die Zahlen addieren sich nicht auf
"Fahrten". **Nicht ungefragt vereinheitlichen**, das ist Jordans Entscheidung.

---

## Verbindliche Regeln (unverändert)
- Nur `uiMode === "mission-control"`. Classic UI unverändert (laufzeit-identisch).
- Keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
  Schreiblogik anfassen.
- Keine neuen Libs, keine Supabase-Struktur-Änderung, kein neues top-level `dyn`-Feld.
- Stage Manager strikt read-only + Probleme melden. MC ist dispatcher-only.
- Nach jeder Änderung: esbuild + Duplikat-Grep + Referenz-Gegencheck + Node-Test
  für neue reine Logik + Diff-Beleg. Push auf den Feature-Branch.
- Commit-Messages über `/tmp/msg.txt` (Umlaut-sicher).
- esbuild kompiliert durch undefinierte JSX-Variablen durch → Referenzen immer
  gegenchecken, sonst Laufzeit-Crash ohne Build-Fehler.

## Anker / Greps

| Was | Zeile |
|---|---|
| `Dashboard` (Classic) | 3593 |
| `ReturnsTab` (Classic) | 5922 |
| `MissionReturnsTab` | 6181 |
| `OverviewTab` (geteilt) | 7008 |
| `TimelinePage` (Classic) | 7207 |
| `barColor` Classic (aktiv) | 7242 |
| `MissionTimelinePage` | 7601 |
| `barColor` MC (tot) | 7636 |
| Balken-Füllung `-fill` | 7839 |
| `TimelineView` | 8029 |
| `SchematicMap` | 8280 |
| `MissionSchematicMap` | 8378 |
| `BoardMiniMap` | 8477 |
| `LiveGoogleMap` | 8560 |
| `MapTab` | 8723 |
| `SettingsTab` (geteilt) | 8852 |
| `MissionControl` | 9402 |
| MC `kpi` | 9454 |
| MC KPI-Ausgabe | 9591 |
| `mcRideStatusKey` | 10037 |
| `MC_NAV` | 10063 |
| `MissionStyles` | 10114 |
| `.mc-scope` Tokens | 10118 |
| `-soft`-Tokens (0.30) | 10133 |
| `-fill`-Tokens (0.45) | 10142 |
| `ErrorState` (tot) | 10426 |

```bash
git fetch && git log --oneline -1                              # HEAD noch 66e4c1e?
grep -n 'const kpi = {' src/ShuttleLeitstelle.jsx              # 3 Treffer, nur 9454 ist MC
grep -n '^function OverviewTab' src/ShuttleLeitstelle.jsx
grep -n '<OverviewTab\|<TimelineView\|<BoardMiniMap' src/ShuttleLeitstelle.jsx
grep -n 'mc-st-.*-soft *:\|mc-st-.*-fill *:' src/ShuttleLeitstelle.jsx
grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
```

---

## Jordans offene Aufgaben (kein Code)

1. **Merge auf Production** (Auftrag A oben). Wichtigster Punkt.
2. **Montags-Fahrten importieren** (Einstellungen → Pickup-Liste importieren).
   `dayTabs()` sammelt alle `dayKey`s ein, der Tab **Mo 27.07.** erscheint dann
   automatisch. Die festivalDates-Liste ist nur für Tage OHNE Fahrten nötig.
3. **Festival-Tage 23.–27.07.2026 eintragen.** Geht erst nach dem Merge
   zuverlässig, der Fix `234117b` ist nur auf dem Feature-Branch.
4. **Google Maps prüfen:** MC → Karte → oben auf "Google Maps" klicken. Der
   Umschalter steht per Default auf Schema, Google lädt nie von allein.
   Key `VITE_GOOGLE_MAPS_API_KEY` ist für Production UND Preview gesetzt
   (seit 11.07.). **Ergebnis steht weiter aus.**
5. **Serverseitige Env-Variablen prüfen** (Filter in Vercel auf Production/All,
   nicht Preview): `ANTHROPIC_API_KEY`, `VAPID_*`, `SUPABASE_SERVICE_ROLE_KEY`,
   `AERODATABOX_*`, `INTERNAL_API_SECRET`. Davon hängen Chat-Assistent, echte
   Push-Benachrichtigungen und Flug-Live-Tracking ab. Ohne sie fällt Push auf
   Vordergrund-Toasts und Flüge auf manuelle Pflege zurück.
6. **Live-Multi-Fahrer-GPS-Test** vor dem Festival.

**Wichtig:** Production und Preview hängen an **derselben** Supabase-Datenbank.
Die Preview ist **kein Spielplatz**, jede Zuteilung dort ist echt.

---

## Bewusst NICHT im Scope

- **Neon-Design:** Jordan hat es am 14.07. zurückgestellt. Slice A (Tokens +
  Glow auf bestehende `.mc-*`-Klassen) = 1 Session. Slice B ist inzwischen
  Auftrag B oben. Slice C (MapTab/FlightTab/SettingsTab, alle Tailwind-gefärbt
  und mit Classic geteilt) = 1–2 Sessions.
- **Statuskacheln unter "Leitstelle · Überblick" entfernen:** braucht dieselbe
  `MissionOverviewTab` wie Auftrag B, also dort mit erledigen.
- **3D-Stadtkarte, Fahrer-Fotos, KPI-Verlaufskurven:** keine Datengrundlage
  bzw. echter Umbau. Nach dem Festival.
- **Datei-Splitting, Asset-Extraktion, SQL-RPC-Refactor (Variante B):** nach
  dem Festival.
- **PIN-Sicherheit:** Jordan geht das vor dem Festival bewusst nicht an. Nicht
  ungefragt ansprechen.

---

## Ready-to-paste Opener: AUFTRAG A (Merge)

```
Neuer Chat fuers Open Beatz Shuttle-Projekt. Erst PROJEKT-ANWEISUNGEN.md lesen,
dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta,
HEAD 66e4c1e. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), git checkout
feature/mission-control-beta, npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
Danach UEBERGABE-Session-16.md lesen, Abschnitt "AUFTRAG A".
Pruef per git fetch, ob HEAD noch auf 66e4c1e steht.

AUFTRAG: Merge feature/mission-control-beta auf main (Production).
Die Vorarbeit steht in der Uebergabe: sauberer Fast-Forward, 45 Commits,
Risikotabelle pro Komponente, Testliste, Rueckweg.
Bitte zuerst nochmal selbst verifizieren (Fast-Forward, Pruefsummen der
geteilten Komponenten gegen main), mir das Ergebnis zeigen, dann warten bis
ich den Classic-Testdurchlauf auf der Preview gemacht habe. Erst nach meinem
ausdruecklichen OK auf main pushen.
Danach: Production durchklicken, und falls noetig Rueckweg erklaeren.
Sprache Deutsch, informell, keine Gedankenstriche, korrekte Umlaute.
Warn mich rechtzeitig, wenn der Chat zu lang wird.
```

## Ready-to-paste Opener: AUFTRAG B, Scheibe 17a (Google in der Minikarte)

```
Neuer Chat fuers Open Beatz Shuttle-Projekt. Erst PROJEKT-ANWEISUNGEN.md lesen,
dann Repo holen.
Repo: Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta.
PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config, git checkout feature/mission-control-beta, npm ci,
Baseline-esbuild gruen. Danach UEBERGABE-Session-16.md lesen, Abschnitt
"AUFTRAG B". Anker per grep gegenpruefen, die Zeilennummern stammen von 66e4c1e.

Feste Regeln wie gehabt: nur uiMode mission-control, Classic laufzeit-identisch
lassen, keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/
Supabase-Schreiblogik aendern, keine neuen Libs, keine Supabase-Struktur-
Aenderung, kein neues top-level dyn-Feld, Stage Manager read-only.
Nach jeder Aenderung: esbuild + Duplikat-Grep + Referenz-Gegencheck + Node-Test
fuer neue reine Logik + Diff-Beleg, Commit ueber /tmp/msg.txt, Push auf den
Feature-Branch. Bevor du baust: Scope bestaetigen, Stelle lokalisieren,
Risikoabwaegung, dann nach OK in kleinen Scheiben.

AUFTRAG SCHEIBE 17a: BoardMiniMap (8477) bekommt einen additiven Prop
allowGoogle = false plus Umschalter Schema/Google und LiveGoogleMap (8560).
Muster: der bestehende SchematicComponent-Prop und der Karte-Tab MapTab (8723),
der den Umschalter schon hat. Default bleibt Schema (Google kostet pro Map Load).
Classic-Aufrufstellen (3932, 6161, 7077) setzen den Prop nicht und muessen
laufzeit-identisch bleiben. Diff-Beleg zum Schluss.
Sprache Deutsch, informell, keine Gedankenstriche, korrekte Umlaute.
Warn mich rechtzeitig, wenn der Chat zu lang wird.
```
