# UEBERGABE Session 18 (15.07.2026)

Ersetzt UEBERGABE-Session-17.md.

> **NACHTRAG Session 19 weiter unten beachten** (Abschnitt
> "NACHTRAG (15.07.2026, aus Session 19)", direkt vor der Testliste). Er
> korrigiert die Aufwandsschaetzung fuer den Zustand NACH dem Classic-Ausbau
> und nimmt einen Umbau aus dem Plan, der nicht noetig ist.

## Stand

- `main` (Production) = `f7bb75d`. Merge aus Session 18 erledigt, Fast-Forward.
- `feature/mission-control-beta` = `f7bb75d`, identisch mit main.
- `src/ShuttleLeitstelle.jsx`: **10638 Zeilen**. esbuild gruen, Duplikat-Grep leer.
- Kein Schema-Re-Run offen.

## RUECKWEGE (wichtig, drei Stufen)

| Wohin | Tag / Branch | Commit |
|---|---|---|
| Stand mit vollstaendigem Classic + MC-Fallschirm | `stabil-classic-vorhanden-2026-07-15` = `backup/classic-vorhanden` | `f7bb75d` |
| Stand vor der ganzen MC-Arbeit | `stabil-vor-design-2026-07-13` = `backup/paket-3-fertig` | `4d13e59` |

Zurueck auf den Stand vor dem Classic-Ausbau:
```
git checkout main && git reset --hard f7bb75d && git push --force origin main
```
Zusaetzlich: **Vercel kann jedes fruehere Deployment per Klick wieder live
schalten** (Deployments -> altes Deployment -> Promote to Production). Das ist
der schnellste Rueckweg im Ernstfall, schneller als jeder Git-Befehl.

---

# JORDANS RICHTUNGSENTSCHEIDUNG vom 15.07.

**Mission Control wird die einzige Leitstellen-Oberflaeche. Classic fliegt raus,
noch vor dem Festival.** Jordan arbeitet kuenftig ausschliesslich mit MC, auch
auf dem Handy (MC gefaellt ihm dort besser als die Mobil-Ansicht).

Diese Entscheidung ist gefallen, nachdem ich zweimal fuer "nach dem Festival"
argumentiert habe. **Nicht ungefragt wieder aufmachen.** Die Gegenargumente
sind unten unter "Bekannte Risiken" dokumentiert, damit sie nicht verloren
gehen, nicht damit sie neu verhandelt werden.

## Befund: MC ist bereits funktionsgleich mit Classic (gemessen, nicht geschaetzt)

Das ist die Grundlage der Entscheidung und erspart dem naechsten Chat die
Analyse. **Nicht nochmal nachmessen, das steht.**

| Tab | Classic | Mission Control | Art |
|---|---|---|---|
| board | 3829 eigener Block | 9841 eigener Block | eigen |
| overview | `OverviewTab` 7008 | `MissionOverviewTab` 7161 | Fork |
| timeline | `TimelinePage` 7356 | `MissionTimelinePage` 7750 | Fork |
| returns | `ReturnsTab` 5922 | `MissionReturnsTab` 6181 | Fork |
| emergency | `EmergencyTab` 6656 | `MissionEmergencyTab` 6789 | Fork |
| messages | `MessagesInbox` 5563 | `MissionMessagesInbox` 5649 | Fork |
| drivers | `DriversTab` 4891 | `MissionDriversTab` 4964 | Fork |
| flights | `FlightTab` | `FlightTab` | **geteilt, identisch** |
| map | `MapTab` | `MapTab` (+MC-Props) | **geteilt** |
| settings | `SettingsTab` | `SettingsTab` | **geteilt, identisch** |

Schreibende Aktionen pro Fork-Paar, gezaehlt (`updateDyn`-Aufrufe):
returns 3:3, emergency 1:1, messages 2:2, overview 0:0, drivers 0:0.
**Kein Fork hat eine Aktion mehr oder weniger.** Dazu dieselben Modals
(`RideForm`, `AssignModal`, `WhatsAppModal`) und derselbe `ChatPanel` (10156).

**Der einzige echte inhaltliche Unterschied: der Ueberblick-Tab.**
Classic rendert dort `TimelineView`, Flughafen-Pickups und `Chip`s.
MC rendert stattdessen KPI-Kacheln (`Kpi`/`MetricCard`), `McList` und
"Was brennt" (`emergencyCases()`). Das war Jordans Entscheidung aus Session 17
("doppelt gemoppelt"), die Inhalte liegen in den Fachtabs. **Wenn Jordan sagt
"in MC fehlt was", ist es mit hoher Wahrscheinlichkeit das hier, und es ist
Absicht.**

## Codemessung (Grundlage fuer den Ausbau)

| Block | Zeilen |
|---|---|
| Nur Mission Control | ~2360 |
| Nur Classic | ~1900 |
| Geteilt | ~2000 |
| Datei gesamt | 10638 |

Classic raus spart also **~1900 Zeilen (18 %)**. Die Datei bleibt bei ~8700.
Laufzeit-Gewinn: **null** (die Zweige rendern konditional, React baut den
anderen Baum nie). Bundle: ~805 kb, evtl. ~100 kb weniger.
**Der echte Gewinn ist die Fork-Steuer:** heute muessen Fehler in den sechs
Fork-Paaren zweimal repariert werden.

---

# DER PLAN: erst unerreichbar, dann testen, dann loeschen

**Das Grundprinzip ist nicht verhandelbar und der Grund fuer die Reihenfolge:**
Classic unerreichbar zu machen sind ~10 Zeilen und ein `git revert` bringt es
zurueck. 1900 Zeilen zu loeschen ist das nicht. Deshalb erst unerreichbar
machen, scharf testen, und **erst nach Jordans Freigabe** loeschen.

**Wichtige Eigenschaft dieser Reihenfolge:** in Session 19 und 20 bleibt der
Fallschirm intakt. `MissionControlBoundary` (1257) faengt einen MC-Absturz und
wirft auf Classic. Der Code liegt noch da, das Netz traegt also waehrend der
ganzen Testphase. Es verschwindet erst in Session 24.

## Session 19: Classic unerreichbar machen (klein, voll reversibel)

Nur das Routing im `App`-Root (1109 bis 1145). MC wird der einzige Dispo-Zweig:

1. `if (useMobileView)` (1117) faellt fuer die Dispo-Rolle weg -> MC uebernimmt
   auch auf dem Handy.
2. `uiMode`-Weiche (1135) faellt weg, MC ist der einzige Zweig.
3. Umschalter "Oberflaeche" im Dashboard-Kopf: erstmal nur ausblenden, nicht
   loeschen.
4. `MissionControlBoundary` + `handleMcFallback` **bleiben unveraendert**.
   Der Fallschirm muss in der Testphase noch tragen.

Kein Loeschen. Classic-Komponenten bleiben vollstaendig im Code, nur nicht mehr
erreichbar. Fahrer/Stage/Gast: unveraendert, die laufen in eigenen Zweigen.

Risiko: niedrig. Regression: `revert` des einen Commits.

## Session 20: Jordan testet MC scharf (KEIN CODE)

Testliste siehe unten. Mit echten Daten auf Production. **Erst wenn Jordan
freigibt, geht es weiter.** Was hier gefunden wird, kommt als eigene Scheibe
VOR die Loesch-Sessions.

## Session 21: MobileDispatcherView raus

`MobileDispatcherView` (4060, 297 Zeilen) + `MobileMapPane` (4357, 41 Zeilen).
Dazu `viewOverride`/`useMobileView`/`setViewMode` und der "Zu Desktop"-Knopf.
**Achtung:** `NoGpsSharingPanel` (4392) und `LiveGoogleMap` (4379) werden von
`MobileMapPane` aufgerufen, haengen aber AUCH in `MapTab` (8943/8957). Sie
bleiben. Nur die Aufrufstellen verschwinden.

## Session 22: Dashboard + Umschalter raus

`Dashboard` (3593, 467 Zeilen), `uiMode`-State, `setUiModeSafe`,
`localStorage["obf:uiMode"]`.

## Session 23: die sechs Classic-Forks raus (~1100 Zeilen)

`OverviewTab` (7008), `TimelinePage` (7356), `ReturnsTab` (5922),
`EmergencyTab` (6656), `MessagesInbox` (5563), `DriversTab` (4891).

**Danach koennen die MC-Forks ihre `Mission`-Praefixe verlieren. NICHT machen,
solange Jordan es nicht ausdruecklich will** (kosmetisches Refactoring, seine
Regel).

## Session 24: Fallschirm umbauen (Entscheidung noetig!)

`MissionControlBoundary` faellt heute auf Classic zurueck. Ohne Classic hat sie
keinen Boden mehr. **Jordan muss entscheiden:**

- **a)** Boundary bleibt, zeigt aber eine Fehlerseite mit "Neu laden" statt
  Classic (`MissionControlFallbackScreen` ist dafuer schon fast fertig, 1288).
- **b)** Boundary raus, Absturz = weisser Bildschirm (wie Classic es heute
  hat).

Empfehlung: **a)**. Kostet fast nichts und ist besser als Classic es je war.

## Session 25: toter Code raus

Nach dem Ausbau tot und pruefbar per Grep:
- `Kpi` **global** (4398) — nur Classic-Dashboard nutzt es (3773 bis 3776).
  Das lokale `Kpi` in `MissionOverviewTab` (7180) bleibt.
- `freeCount` in `OverviewTab` (faellt mit weg), `barColor` in
  `MissionTimelinePage` (unbenutzte Kopie), `ErrorState`.

## Session 26: Stabilitaetspaket (die geparkten Befunde, siehe unten)

---

# ⚠ GETEILT, NICHT MIT CLASSIC LOESCHEN

**Das ist die Falle, die einen Loesch-Commit sprengt.** Vor jedem Loeschen jede
Aufrufstelle per Grep gegenpruefen, die Zeilennummern stammen von `f7bb75d`:

| Komponente | Aufrufstellen | Warum bleiben |
|---|---|---|
| `DriverRow` | 3923 (Classic), **9961 (MC)** | MC nutzt es |
| `StatusPill` | **2527 (DriverApp!)**, 3892, 6018 | Fahrer-App nutzt es |
| `StepProgress` | **2483 (DriverApp)** | Fahrer-App |
| `BoardMiniMap` | 3932, 6161, 7077 (Classic) / **6451, 7233, 9970 (MC)** | MC nutzt es |
| `TimelineView` | 6166, 7121 (Classic) / **6457 (MC), 8995 (MapTab)** | MC + geteilt |
| `NoGpsSharingPanel` | 4392 (Mobil) / **8957 (MapTab)** | geteilt |
| `LiveGoogleMap` | 4379 (Mobil) / **8943 (MapTab)** | geteilt |

Ebenfalls geteilt und tabu: `RideForm`, `AssignModal`, `WhatsAppModal`,
`ChatPanel`, `FlightTab`, `MapTab`, `SettingsTab`, `DriverApp`, `StageApp`,
`GuestApp`, die komplette Datenschicht.

---

# GEPARKT: Stabilitaetsbefunde aus Session 18 (Jordan hat sie bewusst vertagt)

**Alle fuenf liegen im GETEILTEN Code, keiner in Classic oder MC.** Sie waeren
vom Classic-Ausbau nie beruehrt worden und bleiben danach 1:1 offen.

**1. Statuswechsel-Race in der Fahrer-App (der kritischste Punkt).**
`advance()` (2336) und `goBack()` (2352) berechnen den Zielstatus aus dem
gerenderten Prop `ride.status`, wenden ihn aber im Mutator auf das FRISCHE `r`
aus der DB an, ohne nochmal zu pruefen. Die Zuteilungs-Handler machen es
richtig (`if (r.status !== "planned")` IM Mutator), diese zwei sind die
Ausreisser. **Mit Node-Test reproduziert, 4 von 4 Faellen:**

```
A: Fahrer tippt "Fahrt annehmen" zweimal  -> ["accepted","accepted"]
B: Leitstelle setzt zurueck, Fahrer tippt -> ["onboard","planned","done"]
   -> planned springt DIREKT auf done, drei Stufen uebersprungen
C: Fahrer tippt "zurueck" zweimal         -> doppeltes enroute_pickup
D: zwei Tabs desselben Fahrers            -> doppeltes enroute_pickup
```

Fix (analysiert, nicht gebaut): zentrale `ALLOWED_NEXT`-Tabelle aus den heute
real vorkommenden Uebergaengen, `setRideStatus` wird no-op bei gleichem Status
und bei unmoeglichem Uebergang, `advance`/`goBack` rechnen mit `r.status` AUS
DEM MUTATOR. Real vorkommende Uebergaenge (alle 17 Aufrufstellen geprueft):
`STATUS_FLOW`-Schritte vorwaerts, `STATUS_PREV`-Schritte rueckwaerts,
`* -> planned` (Zuteilungs-Reset, Chat, Import, neue Fahrt), `* -> cancelled`.
Genau diese Menge, keine engere, sonst brechen bestehende Ablaeufe.
Umfang ~30 Zeilen, beruehrt keinen MC-Renderzweig.

**2. Offline: die App macht eine falsche Aussage.** `ConnIssueBanner` Zeile
1315: "sobald die Verbindung zurueck ist, geht es automatisch weiter". Es gibt
**keine Warteschlange** (grep `queue|outbox|pending write`: 0 Treffer). Die
Aenderung ist weg. Dazu: 21 von 48 `updateDyn`-Aufrufen werten das Ergebnis
nicht aus, darunter `advance`/`goBack`/`reportIssue` beim Fahrer -> offline
passiert nichts und der Fahrer sieht keinen Fehler. `isOffline` (801) ist
bekannt, wird aber in `updateDyn`/`updateSetup` nicht geprueft.

**3. Polling ueberlappt.** `setInterval(async ...)` (896) wartet nicht auf den
Callback. Ein Poll macht bis zu drei Netzwerkrunden; auf schlechtem LTE > 3 s
laufen mehrere parallel. Folge: Out-of-Order, ein langsamer alter Poll
ueberschreibt einen frischen (`setDyn` 917 vergleicht nur auf Gleichheit, nicht
auf "aelter"), die Ansicht springt zurueck. `clearInterval` (935) stoppt nur
kuenftige Ticks, ein laufender Poll schreibt danach noch. `lastLocSigRef` (913
bis 915) wird von parallelen Polls verschraenkt geschrieben.
Zweiter Poll mit demselben Muster: `GuestApp` (3048), plus eigener Bug in 3044:
ein Netzwerkfehler wird zu `{valid:false}` -> der Gast sieht "Link ungueltig"
statt "Verbindung gestoert".

**4. `assertKnownDynKeys` (273) bricht nicht ab**, macht nur `console.error`.
Die RPC verwirft das unbekannte Feld dann still. Auf einem Fahrer-Handy sieht
niemand die Konsole. Jordan will: abbrechen (`throw`).
Nebenbefund: der Guard haengt nur in `sbSetDyn`, nicht im `window.storage`-Pfad.
Das ist **korrekt so** (dort geht nichts verloren), nur undokumentiert.

**5. Race Conditions um die Revisionen.**
`updateSetup` (1076): `(await sget(SETUP_KEY)) || setup` faellt auf das
VERALTETE `setup` aus der Closure zurueck und rechnet mit dessen `rev`.
`updateDyn` (1001): `|| emptyDyn()` -> im Artifact-Pfad liefert `sget` bei jedem
Fehler `null` (392), dann laeuft der Mutator auf einem LEEREN dyn und schreibt
es. Alle Fahrten weg. In Produktion nicht erreichbar (Supabase-Fehler werfen),
aber die Konstruktion ist scharf.
Retry-Schleife (1000/1075) ohne Backoff, 6 Versuche so schnell wie das Netz
hergibt. `last = result.value` (1014) wird nie benutzt, der naechste Durchlauf
macht wieder ein `sget` -> ein Roundtrip zu viel pro Kollision.

---

# NACHTRAG (15.07.2026, aus Session 19)

Zwei Teile. **Teil A ist Jordans Text, wortgleich uebernommen.** **Teil B ist
mein Messergebnis dazu**, klar getrennt, damit erkennbar bleibt, was
Entscheidung ist und was Befund.

## Teil A: Jordans Nachtrag (unveraendert)

```
1. GETEILTE KOMPONENTEN: KEIN UMBAU NOETIG.
Die in der Uebergabe als "geteilt, nicht mitloeschen" gelisteten Komponenten
werden automatisch MC-only, sobald der Classic-Aufrufer weg ist. Kein
Umbau, keine eigene Session. Geprueft per Aufrufstellen-Zuordnung:
- DriverRow: Dashboard + MissionControl -> danach MC-only
- BoardMiniMap: Dashboard/ReturnsTab/OverviewTab + MissionReturnsTab/
  MissionOverviewTab/MissionControl -> danach MC-only
- TimelineView: ReturnsTab/OverviewTab + MissionReturnsTab/MapTab -> MC-only
- NoGpsSharingPanel + LiveGoogleMap: MobileMapPane + MapTab -> MC-only
- MapTab/FlightTab/SettingsTab: Dashboard + MissionControl -> MC-only
Die Warnung in der Uebergabe heisst NUR "nicht zusammen mit Classic loeschen",
nicht "muss umgebaut werden".

2. AUSNAHME, WICHTIG: StatusPill (2527) und StepProgress (2483) haengen in
DriverApp, nicht in Classic. MC nutzt sie gar nicht (MC hat StatusBadge).
Sie koennen nicht "auf MC umgebaut" werden und bleiben beim Fahrer.
Fahrer ist tabu.

3. NEUE SESSION 27 (nach dem Loeschen, vor Session 26/Stabilitaet einsortieren
oder danach, Jordan entscheidet): FlightTab, MapTab und SettingsTab sind heute
WOERTLICH derselbe Code in Classic und MC. Damit sehen drei von zehn Tabs
innerhalb von Mission Control aus wie Classic. Sie wurden nie auf das
MC-Design gezogen, weil jede Aenderung daran Classic getroffen haette.
Sobald Classic raus ist, faellt dieser Grund weg -> die drei Tabs koennen
MC-Design bekommen. Das ist der eigentliche Gewinn des Classic-Ausbaus,
nicht die 1900 Zeilen.
Wenn Jordan sagt "in MC sieht was komisch aus": mit hoher Wahrscheinlichkeit
sind es genau diese drei Tabs.

4. Umbenennen der MC-Forks (MissionOverviewTab -> OverviewTab usw.) ist
kosmetisches Refactoring -> Jordans eigene Regel, NACH dem Festival.
```

## Teil B: gegengeprueft am Code (Session 19, Stand f205861)

Aufrufstellen automatisch ihren Eltern-Komponenten zugeordnet, nicht per Auge.

### Punkt 1: BESTAETIGT, exakt

| Komponente | Aufrufer heute | Nach Classic-Ausbau |
|---|---|---|
| `DriverRow` | Dashboard(3943), MissionControl(9990) | MissionControl |
| `BoardMiniMap` | Dashboard(3952), ReturnsTab(6181), OverviewTab(7097), MissionReturnsTab(6471), MissionOverviewTab(7253), MissionControl(9999) | 3 MC-Stellen |
| `TimelineView` | ReturnsTab(6186), OverviewTab(7141), MissionReturnsTab(6477), MapTab(9015) | MissionReturnsTab, MapTab |
| `NoGpsSharingPanel` | MobileMapPane(4412), MapTab(8977) | MapTab |
| `LiveGoogleMap` | MobileMapPane(4399), MapTab(8963) | MapTab |
| `MapTab` | Dashboard(3971), MissionControl(10018) | MissionControl |
| `FlightTab` | Dashboard(3970), MissionControl(10017) | MissionControl |
| `SettingsTab` | Dashboard(3973), MissionControl(10020) | MissionControl |

Keine dieser Komponenten wird durch den Ausbau tot, keine braucht einen Umbau.
**Zeilennummern sind der Stand NACH Session 19** (`f205861`), nicht `f7bb75d`.
Offset gegenueber den Tabellen weiter oben: **+20 Zeilen** ab ca. Zeile 1200,
**+29** ab ca. Zeile 9740.

### Punkt 2: BESTAETIGT

`StatusPill`: DriverApp(2547), Dashboard(3912), ReturnsTab(6038) -> danach nur
DriverApp. `StepProgress`: nur DriverApp(2503). MC nutzt `StatusBadge`
(Definition 10543, MC-Nutzung u. a. 9953). Fahrer bleibt tabu.

### Punkt 3: in der Sache richtig, im Umfang deutlich zu klein

Gemessen wurde jede geteilte Komponente, die MC nach dem Ausbau weiter rendert,
auf `var(--mc-*)` (MC-Design) gegen `stone-*` (Classic-Palette):

| Komponente | Zeilen | `var(--mc-*)` | `stone-*` | Optik |
|---|---|---|---|---|
| `SettingsTab` | 303 | 0 | 67 | Classic |
| `RideForm` | 290 | 0 | 9 | Classic |
| `FlightTab` | 166 | 0 | 29 | Classic |
| `LiveGoogleMap` | 135 | 0 | 3 | Classic |
| `MapTab` | 129 | 0 | 32 | Classic |
| `AssignModal` | 114 | 0 | 23 | Classic |
| `ChatPanel` | 106 | 0 | 22 | Classic |
| `TimelineView` | 81 | 0 | 12 | Classic |
| `BoardMiniMap` | 58 | 0 | 11 | Classic |
| `WhatsAppModal` | 34 | 0 | 6 | Classic |
| `NoGpsSharingPanel` | 28 | 0 | 3 | Classic |
| `DriverRow` | 27 | 0 | 7 | Classic |
| **Summe** | **1471** | **0** | | |

**Kein einziges geteiltes Stueck hat MC-Design.** Es sind also nicht drei Tabs,
sondern ~1470 Zeilen ueber zwoelf Komponenten. Besonders relevant: `RideForm`
(Bearbeiten-Dialog) und `AssignModal` (Zuteilen) sind die zwei Sachen, die im
Betrieb am haeufigsten aufgehen, und beide sind Classic-Optik mitten in MC.

Das aendert **nichts an der Richtungsentscheidung**. Es aendert die
Aufwandsschaetzung fuer Session 27: das ist kein Drei-Tab-Job und passt nicht in
eine Session. Vorschlag fuer die Aufteilung, wenn es soweit ist:
- 27a: `RideForm` + `AssignModal` + `WhatsAppModal` (die Modals, groesster
  spuerbarer Effekt)
- 27b: `SettingsTab` (303 Zeilen, alleine)
- 27c: `FlightTab` + `MapTab` + die Karten-Helfer
- 27d: die kleinen (`TimelineView`, `BoardMiniMap`, `DriverRow`,
  `NoGpsSharingPanel`)

**Alles davon ist nach dem Festival.** Es ist reines Design, kein
Stabilitaetsthema, und faellt damit unter Jordans eigene Regel "keine
kosmetischen Refactorings".

### Zwei Praezisierungen zu Punkt 3

- `FlightTab` und `SettingsTab` bekommen von Dashboard und MissionControl
  **wortwoertlich identische Props**. Da stimmt "1:1" exakt.
- `MapTab` **nicht**: MC uebergibt zusaetzlich
  `SchematicComponent={MissionSchematicMap}` und `glideMarkers`, Classic nicht.
  Die Karte darin ist also schon MC, nur der Rahmen drumherum ist Classic.
  Wer das spaeter umbaut, darf `MapTab` nicht als "identisch" behandeln.

### Punkt 4: BESTAETIGT, keine Anmerkung

---

# STAND SESSION 19 (15.07.2026)

Branch `fix/session-19-mc-only`, Code-Commit `f205861`. **Noch nicht auf main**,
wartet auf Jordans Testfreigabe, danach FF-Merge.

Umgesetzt, genau der Auftrag, nichts geloescht:
1. `if (useMobileView)` -> `MobileDispatcherView` entfaellt fuer die Dispo-Rolle.
   MC laeuft jetzt auch auf dem Handy.
2. `uiMode`-Weiche entfaellt. Gate ist nur noch `if (!mcBlocked)`.
3. Umschalter "Oberflaeche" ausgeblendet via `onSetUiMode={null}` in beiden
   Kopfzeilen. Dafuer musste der "Zu Classic"-Knopf im MC-Kopf konditional
   gemacht werden (`{onSetUiMode && (...)}`, gleiches Muster wie Dashboard 3762)
   - er war als einziger nicht konditional und haette sonst ueber `key={uiMode}`
   den MC-Baum remountet, also Tag/Tab/Filter zurueckgesetzt, ohne etwas zu
   wechseln.
4. Tote Knoepfe ausgeblendet: `onSwitchToMobile={null}` in beiden Zweigen,
   "Handy-Ansicht"-Notausstieg im Classic-Zweig auskommentiert (Original im
   Kommentar erhalten, faellt in Session 21 mit `viewOverride` weg).

**Fallschirm unveraendert, byte-fuer-byte:** `MissionControlBoundary`,
`handleMcFallback`, `setUiModeSafe`, `uiMode`-State. MC-Absturz -> `mcBlocked`
= true -> Classic-Dashboard faengt auf. Reload gibt MC wieder frei.

Fahrer/Stage/Gast/Login: unveraendert, eigene Zweige davor.

Belegt durch: esbuild gruen, Duplikat-Grep leer, **Kompilat** gegengeprueft
(`MobileDispatcherView` und beide alten Weichen sind aus dem App-Root raus),
Import-Liste unveraendert, Routing-Test 37/37.

Datei: 10638 -> **10667 Zeilen** (Zuwachs = Kommentar + auskommentiertes
Original).

## RAUCHTEST SESSION 19: DURCHGEFUEHRT 15.07.2026, BESTANDEN

Jordan, auf dem Vercel-Preview des Branches, echte Daten, Safari.

| Test | Ergebnis |
|---|---|
| T1 Laptop: MC oeffnet direkt, kein Umschalter/Zu-Classic/Handy-Icon | **gruen** |
| T1 Handy: dieselben drei Knoepfe weg | **gruen** |
| T4 iPhone: MC nutzbar | **brauchbar**, siehe unten |
| T5 Fahrer-App unveraendert | **gruen** (am Geraet belegt) |
| T6 Stage-App unveraendert, read-only | **gruen** (am Geraet belegt) |
| T6 Gast-Link | uebersprungen, siehe Begruendung |
| Browser-Konsole | **null Meldungen aus unserem Bundle** |

**Gast-Link bewusst uebersprungen:** der Gast-Zweig steht in Zeile 1102 als
allererste Weiche im App-Root, vor dem Login und weit vor allem, was Session 19
angefasst hat. Strukturell nicht erreichbar von dieser Aenderung.

**Konsole:** die sichtbaren Fehler stammen alle NICHT aus der App.
`DialogContent requires a DialogTitle` (radix-ui, `instrument.*.js`) ist die
**Vercel-Preview-Leiste** - die erklaert auch den runden Knopf am rechten
Bildschirmrand, den man auf den Preview-Screenshots sieht. Auf Production ist
beides weg. `h1-main.js`/`h1-searchEngine.js` (TimeoutError, `Cannot call a
class as a function`) ist eine Safari-Erweiterung. `favicon.ico` 404 gehoert
zum offenen PWA-Punkt. Radix-ui ist nirgends in unseren Abhaengigkeiten
(`@supabase/supabase-js, lucide-react, react, react-dom, web-push, xlsx`).
**Aus dem eigenen Bundle kam ueber mehrere Minuten mit laufendem Polling keine
einzige Meldung.**

### KORREKTUR: MC ist responsiv, das stand falsch in dieser Uebergabe

Die Uebergabe sagt "Shell dispatcher-only", und Session 19 hat daraus zunaechst
faelschlich "Desktop-only" gemacht. **Falsch.** MC hat eine eigene
Handy-Navigation, in Slice 5.3 gebaut:

- `md:hidden fixed bottom-0 left-0 right-0 z-30` (10071), untere Leiste
- `moreOpen` (9638) + `mobileMore` (9677) + `moreActive` (9682): "Mehr"-Blatt
  fuer die restlichen rollen-erlaubten Punkte
- dazu neun weitere Responsive-Regeln in der Shell (`md:hidden`, `hidden md:`,
  `hidden sm:`, `hidden lg:`)

Am iPhone bestaetigt: Seitenleiste klappt sauber in die untere Leiste
(Live / Fahrten / Rueckfahrten / Fahrer / Mehr), Kopfzeile vollstaendig,
kein seitliches Scrollen, alle fuenf Tage erreichbar, KPI-Kacheln brechen um,
Problem-Meldung inklusive der drei Aktions-Knoepfe voll lesbar.
**Das Risiko "MC auf dem Handy" aus dem Session-19-Plan ist damit erledigt.**

## RAUCHTEST-VORLAGE (falls Session 19 je wiederholt werden muss)

- [ ] Laptop, Dispo-Login -> MC sofort. Kein "Oberflaeche", kein "Zu Classic",
      kein Handy-Symbol. "Rueckgaengig"/"Push"/Logout muessen bleiben.
- [ ] Konsole `localStorage.setItem("obf:uiMode","classic")` + F5 -> trotzdem MC.
- [ ] Konsole `localStorage.setItem("obf:viewMode","mobile")` + F5 -> trotzdem
      MC. Danach `localStorage.removeItem("obf:viewMode")`.
- [ ] iPhone, Dispo-Login -> MC, untere Leiste da.
- [ ] Fahrer-Login, Stage-Login -> unveraendert.

## Rueckweg-Zeile

| Wohin | Ref | Commit |
|---|---|---|
| Stand mit erreichbarem Classic | `stabil-classic-vorhanden-2026-07-15` = `backup/classic-vorhanden` | `f7bb75d` |
| Session 19 zuruecknehmen | `git revert f205861` | |

## Weitere gefundene Punkte fuer spaetere Sessions (aus Session 19)

- `setUiModeSafe` (766) hat keinen Aufrufer mehr. Nur `handleMcFallback`
  schreibt `uiMode` noch (direkt ueber `setUiMode`). Faellt in Session 22 weg.
- `useMobileView` (755) hat keinen Aufrufer mehr; `viewOverride`/`isNarrow`/
  `setViewMode` haengen nur noch aneinander. Session 21.
- `key={uiMode}` an der Boundary (1150) ist faktisch konstant, weil `uiMode`
  sich nur noch bei `handleMcFallback` aendert und MC dann nicht mehr rendert.
  Bewusst nicht angefasst.
- Kommentare bei 4974, 8495, 9563 behaupten noch "gated ueber uiMode" bzw.
  "nach der useMobileView-Pruefung". Stimmt seit `f205861` nicht mehr.
  Kosmetik, bewusst stehen gelassen.
- **Neu und relevant:** der Fallschirm landet auf dem Handy jetzt im
  Classic-**Desktop**-Dashboard, nicht mehr in der Mobil-Ansicht. Stuerzt MC
  unterwegs ab, liegt eine Desktop-Oberflaeche auf 390 px. Daten sicher, Reload
  hilft. Faellt mit Session 24 (Fallschirm umbauen) ohnehin weg.
- **Chat-Knopf ueberlappt auf dem Handy** (Rauchtest 15.07., am iPhone gesehen).
  Der Chat-FAB ist `fixed right-5 z-50 w-12 h-12 rounded-full bg-orange-600`,
  die MC-Handy-Leiste ist `md:hidden fixed bottom-0 ... z-30`. Der Knopf liegt
  also darueber und landet dabei auf dem Zeit-Schieber der Live-Karte, dessen
  rechtes Ende dadurch nicht mehr greifbar ist. Ihm fehlt auf schmalen
  Bildschirmen ein Abstand nach unten, der die Leiste freihaelt.
  **Keine Regression von Session 19**: der Code ist unveraendert, MC auf dem
  Handy war vorher nur praktisch nie zu sehen, weil `useMobileView` vorher
  abgebogen ist. Session 19 macht es sichtbar, verursacht es nicht.
- **"Was brennt" widerspricht dem Banner** (Rauchtest 15.07., am Laptop
  gesehen). Oben im MC-Kopf steht "1 offene Problem-Meldung, 1x KRITISCH"
  (Finn S. / Will Sparks / Notfall), und die Kachel "Was brennt" darunter sagt
  gleichzeitig "alles ruhig". Verdacht: das eine filtert nach dem gewaehlten Tag
  (Di 21.07., 0 Fahrten), das andere nicht. Kann Absicht sein, kann ein Fehler
  sein. **Nicht analysiert**, liegt ausserhalb von Session 19. Gehoert in die
  Session-20-Testliste unter "Was brennt zeigt echte Probleme" und, falls es ein
  Fehler ist, in eine eigene Scheibe VOR die Loesch-Sessions.
- `favicon.ico` liefert 404. Kosmetisch, gehoert zum offenen PWA-Punkt
  (`manifest.webmanifest`, siehe BACKEND-README).

---

# TESTLISTE MISSION CONTROL (Session 20, Jordan, ca. 2 h)

Auf Production, echte Daten, Leitstellen-Login. Auf Handy UND Laptop je einmal.
**Vorbereitung:** Ansicht auf "Desktop", Oberflaeche auf "Mission Control"
(beides `localStorage`, pro Geraet, ueberlebt Neustart).

**Board**
- [ ] KPI-Leiste zeigt plausible Zahlen
- [ ] Fahrt anklicken -> Bearbeiten-Dialog oeffnet
- [ ] Fahrt zuteilen -> Fahrer erscheint, Fahrer-Handy bekommt sie
- [ ] Minikarte zeigt Fahrer an erwarteten Orten

**Ueberblick**
- [ ] "Was brennt" zeigt echte Probleme
- [ ] Kacheln klickbar, springen in den richtigen Tab
- [ ] Bewusst ANDERS als Classic (keine Timeline, keine Flug-Pickups) — ok?

**Timeline**
- [ ] Drag-and-Drop verschiebt eine Fahrt, Bestaetigung erscheint
- [ ] "Abbrechen" tut nichts, "Verschieben" wendet an
- [ ] "Rueckgaengig" nimmt es zurueck
- [ ] Jetzt-Linie an der richtigen Stelle

**Rueckfahrten**
- [ ] Neue Rueckfahrt anlegen
- [ ] Zuteilen, WhatsApp-Text kopieren
- [ ] Ueberfaellige rot markiert

**Notfall**
- [ ] Gemeldetes Problem erscheint
- [ ] "Problem erledigt" funktioniert und ist im Protokoll

**Nachrichten**
- [ ] Fahrer-Nachricht kommt an
- [ ] Antworten funktioniert

**Fluege / Karte / Einstellungen** (geteilter Code, sollte identisch sein)
- [ ] Flugstatus aendern, manuell/auto umschalten
- [ ] Karte zeigt Fahrer, Google-Umschalter geht
- [ ] Einstellungen speichern, Gast-Link erzeugen und Vorschau

**Fahrer / Stage / Gast (duerfen sich NICHT geaendert haben)**
- [ ] Fahrer-Login, Fahrt annehmen bis abschliessen
- [ ] Stage-Login, nur lesen + Problem melden
- [ ] Gast-Link oeffnen

**Robustheit**
- [ ] Flugmodus an -> Banner erscheint. **Achtung, bekannter Fehler:** der
      Banner verspricht, dass Aenderungen nachgeholt werden. Werden sie nicht
      (Befund 2 oben).
- [ ] Flugmodus aus -> "Wieder verbunden", Daten kommen nach
- [ ] Zwei Geraete gleichzeitig, beide sehen dieselbe Aenderung in ~3 s

---

# BEKANNTE RISIKEN DER ENTSCHEIDUNG (dokumentiert, nicht neu verhandeln)

1. **MC ist nie getestet worden.** Classic auch nicht. Beide sind ungetestet,
   das war Jordans richtige Korrektur an meiner Argumentation. Aber MC ist an
   sechs Stellen geforkter Code, und ein Fork ist der Ort, an dem Luecken sich
   verstecken. Deshalb ist Session 20 (Testen) der wichtigste Schritt des
   ganzen Plans, nicht das Loeschen.
2. **Der Fallschirm verschwindet in Session 24.** Bis dahin traegt er.
3. **Festival ist 23. bis 27. Juli.** Ab dem 21. sollte nichts mehr geloescht
   werden. Wenn der Plan bis dahin nicht durch ist: bei Session 19 stehen
   bleiben (Classic unerreichbar, aber im Code) und nach dem Festival
   weitermachen. Das ist ein voellig sauberer Zustand.

---

## Verbindliche Regeln (Jordans 8-Sessions-Regeln, gelten weiter)

- Keine Neuentwicklung. Keine Aenderung bestehender Workflows, Rollen, Stages.
- Keine DB-Struktur-Aenderung, ausser zwingend noetig.
- Keine kosmetischen Refactorings. Keine Performance-Optimierungen ausserhalb
  des Themas. Keine Aenderungen ausserhalb des jeweiligen Pakets.
- Immer zuerst bestehenden Code vollstaendig analysieren, dann aendern.
- Jede Aenderung begruenden, moeglichst klein halten. Keine Breaking Changes.
- Nach jeder Aenderung: Code pruefen, Build, **Regressionsrisiken nennen,
  konkrete manuelle Testfaelle auflisten**.
- Prioritaet: 1. Stabilitaet 2. Datenintegritaet 3. Sicherheit 4. Wartbarkeit
  5. Performance.
- Fehler ausserhalb der Session NICHT aendern, unter "Weitere gefundene Punkte
  fuer spaetere Sessions" auflisten.
- Fahrer/Stage/Gast sind tabu. Stage Manager read-only.
- **esbuild ist kein Beweis.** Jede Referenz, jedes Icon (Import-Liste oben!)
  und jede `var(--mc-*)`-CSS-Variable einzeln gegenpruefen.
- Commit ueber `/tmp/msg.txt` (Umlaute).
- **Chat-Laenge:** jedes Paket in einen frischen Chat. Jordans Chats stuerzen
  ab, wenn sie zu lang werden.

---

## Ready-to-paste Opener: Session 19 (Classic unerreichbar machen)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: main = f7bb75d, 10638 Zeilen. Rueckwege: Tag
stabil-classic-vorhanden-2026-07-15 = backup/classic-vorhanden = f7bb75d
(Stand mit Classic), Tag stabil-vor-design-2026-07-13 = 4d13e59 (davor).

Danach UEBERGABE-Session-18.md lesen, komplett. Anker per grep gegenpruefen,
die Zeilennummern stammen von f7bb75d.

ENTSCHEIDUNG STEHT: Mission Control wird die einzige Leitstellen-Oberflaeche,
Classic fliegt raus. Nicht neu verhandeln, die Gegenargumente stehen in der
Uebergabe.

AUFTRAG SESSION 19: Classic unerreichbar machen, NICHT loeschen. Nur das
Routing im App-Root (1109 bis 1145): useMobileView-Weiche (1117) faellt fuer
die Dispo-Rolle weg, uiMode-Weiche (1135) faellt weg, MC ist der einzige
Dispo-Zweig, auch auf dem Handy. Umschalter "Oberflaeche" nur ausblenden.
MissionControlBoundary und handleMcFallback bleiben UNVERAENDERT, der
Fallschirm muss in der Testphase noch tragen. Classic-Code bleibt vollstaendig
liegen. Fahrer/Stage/Gast nicht anfassen.

Branch: fix/session-19-mc-only von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
Danach teste ich MC scharf mit der Testliste aus der Uebergabe, bevor
irgendwas geloescht wird.

Feste Regeln wie in der Uebergabe. Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu
lang wird.
```

---

# STAND SESSION 21 (15.07.2026) — AUF MAIN, PRODUCTION

`main` = `ff05974`, FF-Merge aus `fix/session-21-mobile-raus` erledigt.
`src/ShuttleLeitstelle.jsx`: **10298 Zeilen** (vorher 10667, -369).
Bundle 803.8 kb -> 783.0 kb. esbuild gruen, Duplikat-Grep leer.
Kein Schema-Re-Run offen. **Jordan hat Session 21 noch NICHT am Geraet
getestet**, die Testfaelle unten stehen offen.

## Geloescht

- `MobileDispatcherView` (vormals 4080, 293 Zeilen) samt `onSwitchToDesktop`
  ("Zu Desktop"-Knopf), lokalem `RideCard`, `FILTER_CHIPS`, `assignOneTap`.
- `MobileMapPane` (vormals 4377, 40 Zeilen).
- `viewOverride`/`setViewOverride`, `isNarrow`/`setIsNarrow` + resize-Effekt,
  `useMobileView`, `setViewMode`, localStorage `"obf:viewMode"`.
- Der in Session 19 auskommentierte Notausstieg-Block (vormals 1184 bis 1198).
- `Phone` aus dem lucide-Import.

## Zwei Korrekturen an der Session-21-Vorgabe (gemessen, nicht geschaetzt)

- **`LayoutGrid` ist NICHT tot geworden.** Die Vorgabe nannte es als Beispiel.
  Es lebt an fuenf Stellen (2829, 3697, 6705, 6863, 9874), u. a. als MC-Navi-
  Icon. Blindes Loeschen haette MC beim Rendern zerlegt.
- **`Phone` war das einzige tote Icon** und stand in keiner Liste.
  Methode: alle 43 Icons auf `94157e0` und auf dem neuen Stand automatisch
  gegen die Datei gepruefT. Vorher 0 tot, nachher genau 1. Dieselbe Pruefung
  fuer alle Top-Level-Bezeichner: **kein einziger neu tot**.

## Belege

esbuild gruen, Duplikat-Grep leer, Kompilat gegengeprueft (`MobileDispatcherView`,
`MobileMapPane`, `viewOverride`, `useMobileView`, `setViewMode`, `isNarrow`,
`obf:viewMode` je 0 Treffer; MC/MapTab/NoGpsSharingPanel/LiveGoogleMap/Dashboard/
DriverApp/StageApp/GuestApp/`obf:uiMode` alle vorhanden). Pruefsummen von
Dashboard, MissionControl, den sechs Forks, DriverApp/StageApp/GuestApp gegen
`94157e0`: identisch. Routing-Test 3840 Kombinationen, 0 Abweichungen.

`NoGpsSharingPanel` (jetzt Def. 8495, Aufruf `MapTab` 8608) und `LiveGoogleMap`
(jetzt Def. 8360, Aufruf `MapTab` 8594) leben wie vorgesehen weiter.

---

# ✅ ERLEDIGT IN SESSION 22: DIE KAPUTTE PLAN-REIHENFOLGE S22 -> S24

> **Stand 15.07.2026: erledigt, Commit `1033d26` auf main.** Der Fallschirm
> faellt nicht mehr auf Classic, `Dashboard` hat null Aufrufer. Der Abschnitt
> bleibt als Begruendung stehen, warum die Reihenfolge getauscht wurde.
> Details siehe "STAND SESSION 22" ganz unten.

**Das war der wichtigste Punkt dieser Uebergabe.**

Der Fallschirm laeuft heute so:
1. MC stuerzt beim Rendern ab -> `MissionControlBoundary` (1255)
   `getDerivedStateFromError` -> `MissionControlFallbackScreen` (1286) fuer
   EINEN Render-Tick.
2. `componentDidCatch` -> `handleMcFallback` (771) -> `mcBlocked = true`.
3. App rendert neu -> `if (!mcBlocked)` (1139) faellt durch ->
   **`<Dashboard>` in Zeile 1172 faengt auf.**

**`Dashboard` IST der Boden des Fallschirms.** Session 22 loescht laut Plan
`Dashboard`, Session 24 baut erst danach den Fallschirm um. In der Reihenfolge
zeigt Zeile 1172 nach S22 auf eine geloeschte Komponente.

**Und das faellt in keiner unserer Pruefungen auf:** esbuild kompiliert durch
undefinierte JSX-Referenzen durch (bekannte Projekt-Erfahrung, steht in den
Projekt-Anweisungen). Build gruen, Duplikat-Grep leer, und der `ReferenceError`
schlaegt erst zur Laufzeit zu — und zwar ausschliesslich in dem Moment, in dem
MC schon abgestuerzt ist. Also im schlechtesten denkbaren Moment, waehrend des
Festivals, ohne Netz darunter.

**Konsequenz: S24 muss VOR S22.** Neue Reihenfolge:

| Neu | Alt | Inhalt |
|---|---|---|
| **S22** | war S24 | Fallschirm umbauen: Boundary zeigt Fehlerseite statt Classic |
| **S23** | war S22 | `Dashboard` + `uiMode`/`setUiModeSafe`/`obf:uiMode` raus |
| **S24** | war S23 | die sechs Classic-Forks raus |
| S25 | S25 | toter Code |

Beim Fallschirm-Umbau (Jordans Empfehlung war Variante a) zusaetzlich beachten:
`MissionControlFallbackScreen` (1286) sagt heute woertlich "Zur klassischen
Ansicht zurückgewechselt" und "Classic wird geladen…". Ohne Classic ist das
eine Falschaussage und muss mit umgeschrieben werden (-> "Neu laden").

Alternativ: `Dashboard` und Fallschirm in EINER Session, dann aber bewusst als
ein Paket, nicht nebenbei.

## Anker fuer den Fallschirm-Umbau (Stand `ff05974`)

- `MissionControlBoundary` 1255 bis 1281, `MissionControlFallbackScreen` 1286
- `handleMcFallback` 771, `mcBlocked` 769, `mcFailReason` 770
- `uiMode` 755, `setUiModeSafe` 759 (kein Aufrufer mehr), `obf:uiMode` 756/762/775
- Gate `if (!mcBlocked)` 1139, `key={uiMode}` 1143, Fallschirm-Zweig 1172

## Anker fuer "Dashboard raus" (Stand `ff05974`)

- `Dashboard` 3591 bis 4047 (**457 Zeilen**, nicht 467)
- Einziger Aufrufer: 1172 (der Fallschirm, siehe Warnung oben)
- **`Dashboard` ist der einzige Aufrufer aller sechs Classic-Forks:**
  `OverviewTab` 3938, `TimelinePage` 3940, `ReturnsTab` 3942,
  `EmergencyTab` 3945, `MessagesInbox` 3947, `DriversTab` 3950.
  Nach dem Dashboard-Ausbau sind alle sechs verwaist, aber harmlos.
- Umschalter "Oberflaeche" im Dashboard-Kopf 3734 bis 3752, "Zu Classic" im
  MC-Kopf 9376
- `Kpi` global wird von Dashboard (3771 bis 3774) und 6874 bis 6877 genutzt.
  Vor dem Loeschen pruefen, ob 6874 bis 6877 das globale `Kpi` oder das lokale
  in `MissionOverviewTab` meinen. Nicht raten.

---

# REVIDIERT: die Nicht-Anfassen-Liste (Jordan, 15.07.)

"Classic bleibt byte-fuer-byte unveraendert" und "wegen Classic-Regressions-
risiko lieber nichts anfassen" sind **keine Argumente mehr**. Das war der Grund
fuer Approach A (doppelte Controller-Glue). Classic wird geloescht, nicht
konserviert.

**Weiterhin tabu, hatte nie mit Classic zu tun:** `DriverApp`/`StageApp`/
`GuestApp` (Stage read-only), die Datenschicht, das `dyn_data`/RPC-Thema.

**Weiterhin tabu bis zum Fallschirm-Umbau:** `MissionControlBoundary`,
`handleMcFallback`, `mcBlocked`, `mcFailReason` — und damit faktisch auch
`Dashboard`, weil der Fallschirm dort aufkommt (siehe Warnung).

**Gilt weiter:** keine Aenderungen ausserhalb des jeweiligen Pakets. Classic-
Teile nur in ihrer eigenen Session loeschen, nicht nebenbei mitnehmen.

**Stichtag: ab 21.07. nichts mehr loeschen** (Festival 23. bis 27.07.). Wenn der
Plan bis dahin nicht durch ist: stehen bleiben, nach dem Festival weitermachen.
Der jetzige Stand (Session 21 auf main) ist ein sauberer Halt.

---

# OFFENE TESTFAELLE SESSION 21 (Jordan, auf Production)

1. [ ] Laptop, Dispo-Login: MC oeffnet. Kein Handy-Symbol, kein "Zu Desktop".
2. [ ] Konsole `localStorage.setItem("obf:viewMode","mobile")` + F5 -> trotzdem
       MC. Danach `localStorage.removeItem("obf:viewMode")`.
3. [ ] iPhone, Dispo-Login: MC mit unterer Leiste, alle fuenf Punkte + "Mehr".
4. [ ] **Karte-Tab: Schema/Google umschalten.** Der Test fuer
       `NoGpsSharingPanel` + `LiveGoogleMap`, deren Aufrufer geloescht wurde.
5. [ ] Fahrt zuteilen (`AssignModal`), Chat-Knopf oeffnet.
6. [ ] Fahrer-Login: annehmen bis abschliessen. **Anrufen-Knopf muss da sein**
       (`tel:`-Link, anderes Icon als das entfernte `Phone`).
7. [ ] Stage-Login: nur lesen + Problem melden.
8. [ ] Gast-Link oeffnen.
9. [ ] Zwei Geraete, Aenderung in ~3 s auf beiden.

Rueckweg: `git revert ff05974 0859041`, Tag `stabil-classic-vorhanden-2026-07-15`
= `f7bb75d`, oder Vercel -> altes Deployment -> Promote to Production.

---

# Weitere gefundene Punkte fuer spaetere Sessions (aus Session 21)

- `IconButton` (10201) und `tsToDayMin` (1737) haben **keinen Aufrufer, schon
  auf `94157e0`**. Nicht von Session 21 verursacht. Gehoeren zu `ErrorState`
  (10235) in die Session-25-Liste, die kannte nur `ErrorState`.
- `onSwitchToMobile` steckt weiter in den Signaturen von `Dashboard` (3591) und
  `MissionControl` (9202), an beiden Aufrufstellen (1147, 1175) fest `null`.
  Die Knoepfe (3732, 9366) sind unerreichbar. Faellt fuer Dashboard mit dem
  Dashboard-Ausbau, fuer MC braucht es eine eigene kleine Scheibe.
- Haengende Kommentar-Verweise auf `obf:viewMode`: 751 (im `uiMode`-Block,
  faellt mit dem uiMode-Ausbau weg) und 2621 (Stage-Filter, tabu). Dazu 9193
  "nach der useMobileView-Pruefung" (stand schon in der Session-19-Liste).
- Offen aus Session 19, unveraendert: Chat-FAB ueberlappt die MC-Handy-Leiste;
  "Was brennt" widerspricht dem Kopf-Banner (nicht analysiert, Verdacht
  Tagesfilter); `favicon.ico` 404.
- Die fuenf geparkten Stabilitaetsbefunde aus Session 18 sind alle unveraendert
  offen. Sie liegen im geteilten Code und werden vom Classic-Ausbau nie
  beruehrt.

---

# STAND SESSION 22 (15.07.2026) — AUF MAIN, PRODUCTION

`main` = `1033d26`, FF-Merge aus `fix/session-22-fallschirm` erledigt.
`src/ShuttleLeitstelle.jsx`: **10322 Zeilen** (vorher 10298, +24, netto Kommentare).
Bundle 783.0 -> 782.6 kb. esbuild gruen, Duplikat-Grep leer. Kein Schema-Re-Run offen.
**Jordan hat Session 22 noch NICHT am Geraet getestet** (Session 21 ebenfalls nicht,
deren Testfaelle stehen weiter offen).

## Umgesetzt: Fallschirm-Umbau, Variante a

Der Fallschirm faellt nicht mehr auf Classic, sondern zeigt eine Fehlerseite.

| Stelle | vorher | nachher |
|---|---|---|
| Fallschirm-Zweig im App-Root | `<Dashboard .../>` + separater `mcFailReason`-Banner | `<MissionControlFallbackScreen reason={mcFailReason} />` |
| `handleMcFallback` | `setUiMode("classic")` + `localStorage["obf:uiMode"]="classic"` + Sperre | nur noch `setMcBlocked` + `setMcFailReason` |
| Boundary | `key={uiMode}` | kein key |
| `MissionControlFallbackScreen` | "Zur klassischen Ansicht zurueckgewechselt", "Classic wird geladen…", Spinner | "Die Leitstelle hatte ein Problem", `reason`-Prop, **"Neu laden"-Knopf** |
| `console.error` | "Rueckfall auf Classic" | "Fehlerseite statt Absturz" |

`ConnIssueBanner` ist aus dem Fallschirm-Zweig raus: ueber einer Vollbild-Fehlerseite
ohne Bedienelemente hat ein Netzwerk-Hinweis keinen Nutzen. Bewusst, nicht vergessen.

`mcBlocked` und `mcFailReason` BLEIBEN. `mcBlocked` ist die Sperre auf App-Root-Ebene;
ohne sie wuerde der naechste Poll-Re-Render (3 s) den abgestuerzten Baum erneut
versuchen. Die Boundary allein reicht dafuer nicht.

**Nicht angefasst:** Dashboard-Definition, die sechs Classic-Forks, `uiMode`-State,
`setUiModeSafe`, `obf:uiMode`, die Prop `uiMode={uiMode}` an `MissionControl` (1157),
DriverApp/StageApp/GuestApp, die Datenschicht.

## Belege (esbuild war ausdruecklich nicht der Beweis)

- **Render-Test in jsdom mit echtem React-Baum, 18/18.** Boundary, Fehlerseite,
  State-Block und Fallschirm-Zweig wurden per Skript **wortwoertlich aus der Datei
  extrahiert**, nicht nachgebaut. Gestubbt nur die Blaetter drumherum. Belegt:
  Fehlerseite erscheint und bleibt stehen, kein Classic-Boden, Daten byte-identisch,
  null `updateDyn`/`updateSetup`, null localStorage-Schreibzugriffe, Reload-Knopf
  loest `reload()` aus, nach dem Reload laeuft MC wieder.
- **Gegenprobe gegen `ff05974`:** derselbe Test faellt dort 9x durch und weist den
  Schreibzugriff `["obf:uiMode","classic"]` nach. Der Test misst also wirklich.
  (Die erste Testfassung hat diesen Punkt NICHT gemessen: `localStorage` wird im
  Code ohne `window.`-Praefix gerufen, lief in jsdom gegen `globalThis` ins Leere,
  und das `try/catch` hat es geschluckt. Wer den Test nachbaut: `globalThis.localStorage`
  UND `dom.window.localStorage` setzen.)
- **Kompilat:** `createElement(MissionControlBoundary, { onFallback: handleMcFallback },
  createElement(MissionControl, {...}))`, kein key, `Dashboard` null Aufrufe,
  `MissionControlFallbackScreen` bekommt `reason`.
- **Echtes throw** in `MissionControl` eingebaut, im Kompilat als Kind der Boundary
  nachgewiesen, wieder entfernt, md5 der Datei identisch. **esbuild hat das throw zu
  keinem Zeitpunkt gemeldet** — der Punkt aus der Warnung, praktisch bestaetigt.
- **Icons:** 42 importiert, Liste unveraendert, keines neu tot.
  **Top-Level-Bezeichner:** genau einer neu ohne Aufrufer, `Dashboard`, beabsichtigt.

Der jsdom-Test liegt NICHT im Repo (`jsdom` ist keine Projekt-Dependency, "keine
neuen Libraries"). Er wurde mit `npm install --no-save jsdom` gefahren und danach
entfernt. Bei Bedarf als devDependency wieder aufbauen.

## Offene Testfaelle Session 22 (Jordan, am Geraet)

1. [ ] MC oeffnet normal, Oberflaeche unveraendert.
2. [ ] Absturz erzwingen (Wegwerf-Branch mit `throw` in `MissionControl`):
       Fehlerseite mit Logo, "Die Leitstelle hatte ein Problem", Meldungstext,
       "Deine Daten sind unveraendert", **"Neu laden"-Knopf**. Kein weisser
       Bildschirm, **kein Classic-Dashboard**.
3. [ ] "Neu laden" druecken -> MC ist wieder da.
4. [ ] Nach dem Absturz eine Fahrt pruefen: Status, Zuteilung, Protokoll unveraendert.
5. [ ] Konsole nach einem Absturz: `localStorage.getItem("obf:uiMode")` darf **nicht**
       auf `"classic"` gesprungen sein.
6. [ ] Fahrer-, Stage-, Gast-Login unveraendert.
7. [ ] Die offenen Testfaelle aus Session 21 stehen weiter aus, besonders Nr. 4
       (Karte-Tab Schema/Google umschalten).

Rueckweg: `git revert 1033d26`, Tag `stabil-classic-vorhanden-2026-07-15` = `f7bb75d`,
Tag `stabil-vor-design-2026-07-13` = `4d13e59`, oder Vercel -> Promote to Production.

## AKTUELLE ANKER FUER SESSION 23 (Dashboard raus), Stand `1033d26`

- `Dashboard` **3615 bis 4071 (457 Zeilen)**, **null Aufrufer** (der Fallschirm ist
  weg). Loeschen ist damit gefahrlos, das war vorher nicht so.
- `Dashboard` ist weiterhin der einzige Aufrufer aller sechs Classic-Forks:
  `OverviewTab` 3962, `TimelinePage` 3964, `ReturnsTab` 3966, `EmergencyTab` 3969,
  `MessagesInbox` 3971, `DriversTab` 3974. Definitionen: `DriversTab` 4566,
  `MessagesInbox` 5238, `ReturnsTab` 5597, `EmergencyTab` 6331, `OverviewTab` 6683,
  `TimelinePage` 7031. Nach dem Dashboard-Ausbau alle sechs verwaist, aber harmlos
  (Session 24).
- uiMode-Kette: `uiMode` 755, `setUiModeSafe` 759 (kein Aufrufer), `obf:uiMode`
  756/762, Prop `uiMode={uiMode}` an `MissionControl` 1157. **Seit Session 22
  schreibt niemand mehr `uiMode`**, der State ist konstant `"classic"` oder
  `"mission-control"` je nach altem localStorage-Wert und steuert nichts mehr.
- Umschalter "Oberflaeche" im Dashboard-Kopf: faellt mit dem Dashboard weg.

## BEANTWORTET: die offene Kpi-Frage aus der Session-25-Liste

Die Uebergabe fragte, ob die MC-Stelle das globale `Kpi` oder ein lokales meint.
**Gemessen, Antwort: das lokale.**

- Globales `Kpi`: Definition **4073**, Signatur `{ label, value, tone }`.
  Aufrufer ausschliesslich `Dashboard` 3795 bis 3798. **Nach Session 23 tot.**
- Lokales `Kpi` in `MissionOverviewTab` (6836 bis 6955): **Zeile 6855**, ein
  `const Kpi = ({ label, value, icon, status, go }) => ...`, das `MetricCard`
  rendert. Es beschattet das globale innerhalb der Komponente. Die Aufrufe
  6898 bis 6901 meinen dieses lokale (erkennbar an den Props `icon`/`status`/`go`,
  die das globale gar nicht kennt). **Bleibt.**
- **Achtung fuer den, der es sucht:** das lokale ist ein `const`, kein `function`.
  Ein Grep auf `^function Kpi` findet es NICHT und legt den Fehlschluss nahe, es
  gebe nur eines.

## Weitere gefundene Punkte fuer spaetere Sessions (aus Session 22)

- `dynToRpcParams` hat **keinen Aufrufer, schon auf `ff05974`**. Nicht von Session 22
  verursacht. Gehoert zu `tsToDayMin` (1737), `IconButton`, `ErrorState` in die
  Session-25-Liste, die kannte es nicht.
- Zeile 9395: Kommentar im MC-Kopf verweist noch auf `key={uiMode}`, den es seit
  Session 22 nicht mehr gibt. Kosmetik, ausserhalb des Pakets gelassen, faellt mit
  dem uiMode-Ausbau in Session 23.
- Alle Punkte aus den Sessions 19 und 21 sind unveraendert offen (Chat-FAB ueberlappt
  die MC-Handy-Leiste, "Was brennt" widerspricht dem Kopf-Banner, `favicon.ico` 404,
  `onSwitchToMobile` in der `MissionControl`-Signatur). Ebenso die fuenf geparkten
  Stabilitaetsbefunde aus Session 18.

---

## Ready-to-paste Opener: Session 23 (Dashboard + uiMode raus)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: main = 1033d26, 10322 Zeilen. Session 22 (Fallschirm umgebaut) ist
gemerged und auf Production, von mir aber noch NICHT am Geraet getestet.
Session 21 ebenfalls noch nicht. Rueckwege: git revert 1033d26, Tag
stabil-classic-vorhanden-2026-07-15 = f7bb75d, Tag
stabil-vor-design-2026-07-13 = 4d13e59. Vercel: altes Deployment per
Promote to Production zurueckholen.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, inklusive Nachtrag und der
Abschnitte "STAND SESSION 19", "STAND SESSION 21" und "STAND SESSION 22".
Die Anker im Abschnitt "AKTUELLE ANKER FUER SESSION 23" sind auf 1033d26,
alle weiter oben in der Datei sind aelter. Per grep gegenpruefen.

ENTSCHEIDUNG STEHT: Mission Control ist die einzige Leitstellen-Oberflaeche,
Classic wird geloescht, nicht erhalten. Nicht neu verhandeln. Classic-Schutz
ist hinfaellig. Weiter tabu: DriverApp/StageApp/GuestApp (Stage read-only),
die Datenschicht, das dyn_data/RPC-Thema.

AUFTRAG: Dashboard raus. Der Fallschirm ist seit Session 22 umgebaut,
Dashboard hat null Aufrufer, Loeschen ist damit gefahrlos.
- Dashboard (3615 bis 4071, 457 Zeilen) loeschen.
- uiMode-State (755), setUiModeSafe (759), localStorage "obf:uiMode" (756/762)
  und die Prop uiMode={uiMode} an MissionControl (1157) raus. Achtung: die
  Prop haengt in der MissionControl-Signatur (9226), dort mit weg.
- Das globale Kpi (4073) wird danach tot. Das LOKALE const Kpi in
  MissionOverviewTab (6855) bleibt, es ist ein anderes. Nicht verwechseln,
  Beleg steht in der Uebergabe.
- Die sechs Classic-Forks in DIESER Session NICHT loeschen, sie sind danach
  verwaist, aber harmlos. Das ist Session 24.
- Fallschirm (MissionControlBoundary/handleMcFallback/mcBlocked/mcFailReason/
  MissionControlFallbackScreen) NICHT anfassen, der ist frisch umgebaut.

Branch: fix/session-23-dashboard-raus von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
esbuild ist kein Beweis: jede Referenz und jedes Icon einzeln gegenpruefen,
Kompilat gegenpruefen, Pruefsummen der nicht angefassten Komponenten gegen
den Vorstand vergleichen. Commit ueber /tmp/msg.txt. Sprache Deutsch,
informell, keine Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig,
wenn der Chat zu lang wird.

STICHTAG: ab 21.07. wird nichts mehr geloescht (Festival 23. bis 27.07.).
```

---

## Ready-to-paste Opener: Session 22 (erledigt, Historie)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: main = ff05974, 10298 Zeilen. Session 21 ist gemerged und auf
Production. Rueckwege: git revert ff05974 0859041, Tag
stabil-classic-vorhanden-2026-07-15 = f7bb75d, Tag
stabil-vor-design-2026-07-13 = 4d13e59. Vercel: altes Deployment per
Promote to Production zurueckholen.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem den Abschnitt
"STAND SESSION 21" und die Warnung "DIE PLAN-REIHENFOLGE S22 -> S24 IST
KAPUTT". Anker per grep gegenpruefen, die sind schon auf ff05974.

ENTSCHEIDUNG STEHT: Mission Control ist die einzige Leitstellen-Oberflaeche,
Classic wird geloescht. Nicht neu verhandeln.

AUFTRAG: Fallschirm umbauen, VOR dem Dashboard-Ausbau. Grund steht in der
Warnung: Dashboard ist heute der Boden des Fallschirms (Zeile 1172), und
esbuild wuerde einen kaputten Fallschirm nicht melden.
- MissionControlBoundary (1255) faellt kuenftig NICHT mehr auf Classic,
  sondern zeigt eine Fehlerseite mit "Neu laden" (Variante a).
- MissionControlFallbackScreen (1286) umschreiben, der Text sagt heute
  "Zur klassischen Ansicht zurückgewechselt" / "Classic wird geladen…".
- handleMcFallback/mcBlocked/mcFailReason entsprechend anpassen.
- Dashboard, die sechs Classic-Forks und uiMode/setUiModeSafe in DIESER
  Session NICHT loeschen, das ist die naechste.
- DriverApp/StageApp/GuestApp und die Datenschicht nicht anfassen.

Branch: fix/session-22-fallschirm von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
Wichtig: einen absichtlichen MC-Absturz testbar machen (z. B. kurzzeitig ein
throw im MC-Baum) und belegen, dass die Fehlerseite kommt und Reload hilft.

Feste Regeln wie in der Uebergabe. esbuild ist kein Beweis, jede Referenz und
jedes Icon einzeln gegenpruefen. Commit ueber /tmp/msg.txt. Sprache Deutsch,
informell, keine Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig,
wenn der Chat zu lang wird.
```
