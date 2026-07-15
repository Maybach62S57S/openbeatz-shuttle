# UEBERGABE Session 17 (15.07.2026)

Ersetzt UEBERGABE-Session-16.md. Der dortige "AUFTRAG A" (Merge) ist erledigt,
"AUFTRAG B" ist durch Jordans Entscheidung vom 15.07. inhaltlich neu geschnitten
(siehe unten "Richtungswechsel").

## Stand

- Branch `feature/mission-control-beta` steht auf **`12ca278`**.
- `main` (Production) steht auf **`8499232`**, also eine Scheibe hinterher.
  **Nicht direkt auf main pushen.** Merge spaeter per Fast-Forward.
- Rueckweg unveraendert: Tag `stabil-vor-design-2026-07-13` = Branch
  `backup/paket-3-fertig` = `4d13e59`.
- `src/ShuttleLeitstelle.jsx`: **10638 Zeilen**.
- Kein Schema-Re-Run offen.

## Richtungswechsel vom 15.07. (wichtig, das ueberschreibt AUFTRAG B aus Session 16)

Jordans Befund: der MC-Ueberblick und der Karte-Tab waren "doppelt gemoppelt".
Gegengeprueft und bestaetigt, sogar dreifach:

| Was | Wo es in MC rendert |
|---|---|
| Schema-Karte | board + overview + map |
| TimelineView | overview + map + eigener timeline-Tab |
| KPI-Zahlen | board (`kpi`) + overview (Kacheln) |

**Damit ist der alte AUFTRAG B (Scheibe 17c: volle `MissionTimelinePage` in den
Ueberblick einbetten) hinfaellig.** Er wuerde genau die Dopplung bauen, die
Jordan loswerden will. Nicht ungefragt wiederbeleben.

Neuer Leitgedanke fuer den Ueberblick: in zehn Sekunden sehen ob was brennt.
Alles zum Arbeiten liegt in den Fachtabs.

## Scheibe 1 ERLEDIGT (Commit `12ca278`)

`MissionOverviewTab` (**7161**) als Fork von `OverviewTab` (**7008**), Ansatz A
(OverviewTab ist geteilt: Classic 3940 + MC). Classic byte-identisch, einzige
geaenderte Bestandszeile ist der MC-Renderzweig (**9978**).

Bewusst weniger als Classic: Flughafen-Pickups raus (flights-Tab), TimelineView
raus (timeline-Tab), Chips raus (linke Nav). Neu: "Was brennt" aus
`emergencyCases()` (vorhandener reiner Helfer, keine neue Logik). Toter Code aus
Classic (`freeCount`, 7023) nicht mituebernommen.

Rein praesentational, kein Schreibweg. `rep.open` behaelt die Classic-Bedeutung.
Verifiziert: esbuild gruen, keine Duplikate, Node-Test 17/17.

## Aktuelle Anker (Stand `12ca278`, per grep gegenpruefen)

| Was | Zeile |
|---|---|
| `MissionDriversTab` | 4964 |
| `OverviewTab` (Classic, tabu) | 7008 |
| `MissionOverviewTab` (MC) | 7161 |
| `BoardMiniMap` | 8626 |
| `LiveGoogleMap` | 8709 |
| `NoGpsSharingPanel` | 8844 |
| `MapTab` | 8872 |
| `MissionControl` | 9551 |

Aufrufstellen `BoardMiniMap`: 3932 (Classic), 6161 (`ReturnsTab`, Classic),
6451 (`MissionReturnsTab`, **MC**), 7077 (`OverviewTab`, Classic),
7233 (`MissionOverviewTab`, **MC**), 9970 (`MissionControl` board, **MC**).

Aufrufstellen `NoGpsSharingPanel`: 4392 (Mobil-Karte, Classic), 8957 (in
`MapTab`, also **beide** Zweige).
Aufrufstellen `MapTab`: 3951 (Classic), 9989 (MC).
Aufrufstellen `LiveGoogleMap`: 4379 (Mobil-Karte), 8943 (in `MapTab`).

---

# OFFEN: Scheibe 2 (Google in der Minikarte)

Jordans Auftrag. **Vorher fragen, ob er es nach dem neuen Ueberblick-Zuschnitt
ueberhaupt noch will**: der Ueberblick hat jetzt bewusst eine kleine Karte, die
grosse mit Google liegt im map-Tab. Google kostet pro Map Load.

Vorgehen (analysiert, noch nicht gebaut):

1. `LiveGoogleMap` (8709) bekommt additiven Prop `height = 420`.
   Die 420 sind heute **fest inline verdrahtet** (im Render-Teil, `style={{...
   height: 420 ...}}`). Default = heutiger Wert -> Aufrufstellen 4379 und 8943
   laufzeit-identisch.
2. `BoardMiniMap` (8626) bekommt additiven Prop `allowGoogle = false` plus
   `mapView`-State (Default `"schema"`) und Umschalter. Muster: der bestehende
   `SchematicComponent`-Prop und der Umschalter in `MapTab` (8872, `mapView`
   ab ca. 8883, Segmented-Control im Render).
3. Verdrahten: **nur MC-Aufrufstellen** 9970 und 7233 (beide MC). Classic
   (3932, 6161, 7077) setzt den Prop nicht und bleibt laufzeit-identisch.
   6451 (`MissionReturnsTab`) ist auch MC, mit Jordan klaeren ob mit rein.

**Container-Hoehe/Resize: entschaerft.** Die MC-Tabs rendern konditional
(`{tab === "..." && ...}`), nicht per CSS versteckt. Die Karte wird beim
Tab-Wechsel frisch gemountet, der Container liegt dann schon im Layout. Kein
0px-Init. Trotzdem feste Hoehe fuer die Minikarte vorgeben (Vorschlag 260),
weil 420 in der schmalen Sticky-Spalte zu hoch ist.

**Kostenhinweis fuer Jordan:** jedes `new google.maps.Map()` ist ein Map Load.
`mapView` ist lokaler State und ueberlebt das Unmount nicht, die Minikarte
steht nach jedem Tab-Wechsel wieder auf Schema. Kostenseitig gut, aber er soll
sich nicht wundern. `loadGoogleMapsApi` (79) ist ein Singleton, das Skript
laedt nur einmal, nur die Map-Instanzen zaehlen.

# ERLEDIGT/HINFAELLIG: Scheibe 3 (NoGps-Panel)

War geplant als "Panel vom Karte-Tab in den Fahrer-Tab ziehen". **Jordan hat am
15.07. entschieden, dass es im Karte-Tab bleibt.** Damit ist nichts zu tun:
`NoGpsSharingPanel` (8844) haengt in `MapTab` (8872), und `MapTab` rendern
Classic (3951) UND MC (9989). Das Panel ist also in beiden Oberflaechen im
Karte-Tab bereits vorhanden. Kein Code noetig.

Nicht ungefragt wieder aufmachen.

# NICHT BAUEN ohne eigene Risikoabwaegung (Jordan hat es angesprochen, ist vertagt)

**"Online" gibt es nicht.** `lastSeen` kommt null Mal im Code vor. Das einzige
Signal in `driverState` ist `gps`. "Wer ist online" ist also nur ableitbar aus
"wer teilt GPS". Ein Fahrer mit ausgeschalteter Standortfreigabe sieht ewig
offline aus, obwohl seine App laeuft. Echtes Online braucht einen Heartbeat,
also ein neues Feld plus Schreibpfad. Vor dem Festival nicht empfohlen.

**Reminder/Push von Hand: neuer Aktionspfad, bricht die MC-Regel.** Bisher
gilt fuer MC "nur Darstellung, keine neuen Aktionen". `triggerPush(driverId,
title, body, tag)` (2138) existiert, wird aber an allen 7 Stellen automatisch
als Reaktion auf Datenaenderungen ausgeloest. Ein Knopf "Reminder senden" waere
die erste von der Leitstelle von Hand ausgeloeste Push. Geht auf ein echtes
Handy raus.

**Leitstelle-schreibt-zuerst-Nachricht: existiert nicht.** Die
Nachrichtenfunktion laeuft Fahrer -> Leitstelle mit einer Antwort.
`MessageComposer` (2202) kennt nur `from` = Fahrer oder Stage. Waere ein neuer
Schreibpfad.

Empfehlung: beides nach dem Festival. Wenn Jordan es vorher will, eigene
Scheibe, eigener Chat, eigene Risikoabwaegung.

---

## Verbindliche Regeln (unveraendert)

- Nur `uiMode === "mission-control"` anfassen. Classic laufzeit-identisch lassen.
- Keine Daten-, Status-, Rollen-, Login-, PIN-, Auth-, Zeit-, Zuteilungs-,
  GPS- oder Supabase-Schreiblogik aendern.
- Keine neuen Libs, keine Supabase-Struktur-Aenderung, kein neues top-level
  dyn-Feld. Stage Manager read-only.
- Geteilte Komponente? Dann Fork (Ansatz A) oder additiver Prop mit Default,
  nie die Classic-Komponente umbauen.
- Nach jeder Aenderung: esbuild + Duplikat-Grep + **Referenz-Gegencheck** +
  Node-Test fuer neue reine Logik + Diff-Beleg.
- Commit ueber `/tmp/msg.txt` (Umlaute), Push auf den Feature-Branch.
- Vor dem Bauen: Scope bestaetigen, Stelle lokalisieren, Risikoabwaegung, dann
  in kleinen Scheiben.

## Lehren aus Session 17 (bitte lesen, das hat konkret was gefangen)

- **esbuild ist kein Beweis.** In Session 17 war `--mc-accent` benutzt worden,
  eine CSS-Variable, die es **nicht gibt** (es existiert keine generische
  Akzentfarbe, nur statusgebundene `--mc-st-*`). esbuild war gruen, das Icon
  waere auf der Preview farblos gewesen. Nur der Gegencheck jeder Referenz UND
  jeder CSS-Variable hat es gefangen. Immer machen.
- **Beim Forken keinen toten Code mitschleppen.** `OverviewTab` berechnet
  `freeCount` und benutzt es nie. Beim Kopieren rutscht sowas automatisch mit.
- **Testerwartungen koennen falsch sein, nicht nur der Code.** Zwei Tests fielen
  durch, weil die Erwartung falsch war (13:30 gehoert bei "jetzt 12:00" nicht in
  "Naechste 60 Minuten"). Erst pruefen wer recht hat, dann korrigieren.
- **Vercel liefert pro Commit eine eigene Preview-URL.** Immer die neueste
  Deployment fuer den Branch oeffnen und den Commit-Hash pruefen.
- **"Offen" bedeutet an zwei Stellen Verschiedenes** (MC-KPI-Leiste: ohne
  Fahrer. Ueberblick-Kacheln: `rep.open`). "Anstehend" und "Offen" ueberschneiden
  sich, die Zahlen addieren sich nicht auf "Fahrten". **Nicht ungefragt
  vereinheitlichen**, das ist Jordans Entscheidung.
- **Farb-Tokens sind zwei Sets:** `--mc-st-*-soft` (0.30, Badges/Flaechen, bei
  0.31 gedeckelt wegen WCAG grau/idle auf `--mc-panel-raised`) und
  `--mc-st-*-fill` (0.45, nur Timeline-Balken, weisser Text traegt bis ca. 0.60).
- **Toter Code, nicht anfassen:** `barColor` in `MissionTimelinePage` (unbenutzte
  Kopie; Classics eigenes `barColor` ist aktiv und tabu), `ErrorState`.

## Jordans offene Aufgaben (operativ, nicht Bauen)

1. **MC-Ueberblick auf der Preview durchklicken** (Commit `12ca278`). Zuschnitt
   ok? Wenn nicht, jetzt sagen, bevor Scheibe 2 und 3 drauf aufbauen.
2. Entscheiden, ob Scheibe 2 (Google in der Minikarte) ueberhaupt noch gewollt
   ist. Empfehlung: nein, die grosse Karte im map-Tab hat Google schon.
3. Vor dem Festival: Merge `feature/mission-control-beta` -> `main` per
   Fast-Forward, Produktivdaten laden (Fahrer, Orte, Fahrzeugmatrix),
   Live-Test mit mehreren Fahrer-GPS, Google-Maps-Key in Vercel pruefen.
4. Festival ist **23. bis 27. Juli**. Ab jetzt gilt: je naeher, desto weniger
   Umbau.

---

## Ready-to-paste Opener: Scheibe 2 (Google in der Minikarte)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle, Branch feature/mission-control-beta.
PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), git checkout
feature/mission-control-beta, npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: Branch steht auf 12ca278, 10638 Zeilen. main (Production) steht auf
8499232, also eine Scheibe hinterher. Nicht direkt auf main pushen. Rueckweg
Tag stabil-vor-design-2026-07-13 = 4d13e59.

Danach UEBERGABE-Session-17.md lesen, Abschnitt "OFFEN: Scheibe 2". Anker per
grep gegenpruefen, die Zeilennummern stammen von 12ca278.

AUFTRAG SCHEIBE 2: BoardMiniMap (8626) bekommt additiven Prop allowGoogle =
false plus Umschalter Schema/Google und LiveGoogleMap (8709). LiveGoogleMap
bekommt additiven Prop height = 420 (heute fest inline verdrahtet). Muster:
SchematicComponent-Prop und der Umschalter in MapTab (8872). Default bleibt
Schema, Google kostet pro Map Load. Verdrahten nur an den MC-Aufrufstellen
9970 und 7233. Classic (3932, 6161, 7077) setzt den Prop nicht und muss
laufzeit-identisch bleiben. Diff-Beleg zum Schluss.

WICHTIG: Frag mich zuerst, ob ich das nach dem neuen Ueberblick-Zuschnitt
ueberhaupt noch will, bevor du baust.

Feste Regeln wie gehabt: nur uiMode mission-control, Classic laufzeit-identisch,
keine Daten-/Status-/Rollen-/Login-/PIN-/Auth-/Zeit-/Zuteilungs-/GPS-/Supabase-
Schreiblogik aendern, keine neuen Libs, keine Supabase-Struktur-Aenderung, kein
neues top-level dyn-Feld, Stage Manager read-only.
Nach jeder Aenderung: esbuild + Duplikat-Grep + Referenz-Gegencheck (auch jede
CSS-Variable, esbuild faengt das nicht) + Node-Test fuer neue reine Logik +
Diff-Beleg. Commit ueber /tmp/msg.txt (Umlaute), Push auf den Feature-Branch.
Bevor du baust: Scope bestaetigen, Stelle lokalisieren, Risikoabwaegung, dann
nach OK in kleinen Scheiben.
Sprache Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Warn mich
rechtzeitig, wenn der Chat zu lang wird.
```

## Ready-to-paste Opener: MERGE auf Production (wichtigster naechster Schritt)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci.

STAND: feature/mission-control-beta steht auf 48c74e2 (Doku) bzw. 12ca278
(letzte Code-Aenderung, MissionOverviewTab). main (Production) steht auf
8499232, ist also zwei Commits hinterher. Rueckweg: Tag
stabil-vor-design-2026-07-13 = Branch backup/paket-3-fertig = 4d13e59.

Danach UEBERGABE-Session-17.md lesen.

AUFTRAG: Merge feature/mission-control-beta auf main (Production).
Vorgehen:
1. Pruefen, ob der Merge ein echter Fast-Forward ist (git merge-base --is-
   ancestor main feature/mission-control-beta). Wenn nicht, STOPP und mir
   sagen warum, nicht einfach mergen.
2. Baseline auf feature/mission-control-beta: esbuild gruen
   (./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false
   --format=esm --outfile=/tmp/x.js), Duplikat-Grep leer.
3. Diff main..feature zusammenfassen: was genau geht auf Production, welche
   Renderzweige sind betroffen, was aendert sich fuer Fahrer/Stage/Gast
   (Erwartung: nichts, es ist alles MC-only).
4. Erst nach meinem OK: git checkout main, git merge --ff-only
   feature/mission-control-beta, push auf main.
5. Danach bestaetigen, dass main und feature auf demselben Hash stehen.

WICHTIG: main ist Production und das Festival ist am 23.-27. Juli. Kein
Umbau nebenbei, nur der Merge. Wenn dir beim Diff etwas auffaellt, sag es
mir, statt es zu reparieren.
Sprache Deutsch, informell, keine Gedankenstriche, korrekte Umlaute.
```

## Ready-to-paste Opener: Scheibe 2 (nur falls Jordan es doch will)

Siehe Abschnitt "OFFEN: Scheibe 2" oben. Opener steht direkt darueber.
Empfehlung bleibt: weglassen, die grosse Karte im map-Tab hat Google schon.
