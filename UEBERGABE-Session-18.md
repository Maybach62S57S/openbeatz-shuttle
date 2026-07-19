# UEBERGABE Session 18 (15.07.2026)

Ersetzt UEBERGABE-Session-17.md.

> **AKTUELLSTER STAND: Abschnitt "STAND SESSION 23" ganz unten**, dazu
> "VORARBEIT FUER SESSION 24". Diese Datei waechst nach UNTEN an. Alle
> Zeilennummern und Stand-Angaben weiter oben sind aelter und stimmen nicht
> mehr. Reihenfolge der Staende in der Datei: 18 (oben), 19, 21, 22, 23 (unten).
> Jede Zeilennummer vor der Benutzung per grep gegenpruefen.

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

---

# STAND SESSION 23 (15.07.2026): AUF MAIN, PRODUCTION

`main` = `10401ca`, FF-Merge aus `fix/session-23-dashboard-raus` erledigt.
Code-Commits: `7e4fc47` (Dashboard + uiMode) und `8aa1bfe` (globales Kpi).
`src/ShuttleLeitstelle.jsx`: **9861 Zeilen** (vorher 10322, -461).
esbuild gruen, Duplikat-Grep leer. Kein Schema-Re-Run offen.

**ACHTUNG, DER WICHTIGSTE SATZ DIESER UEBERGABE: Jordan hat Session 21, 22
UND 23 noch NICHT am Geraet getestet.** Das sind vier Loeschungen
uebereinander, die alle nur maschinell belegt sind. Seit Session 22 gibt es
keinen Classic-Boden mehr unter dem Fallschirm, seit Session 23 ist Classic
gar nicht mehr im Code. Faellt bei den Tests etwas auf, ist der Rueckweg
Vercel -> Promote to Production, nicht Git.

## Geloescht

- `Dashboard` (vormals 3615 bis 4071, 457 Zeilen) samt "Oberflaeche"-Umschalter
  im Kopf. An der Stelle steht jetzt ein Erklaerungsblock.
- `uiMode`-State, `setUiModeSafe` (hatte seit Session 19 keinen Aufrufer),
  localStorage-Schluessel `"obf:uiMode"`.
- Prop `uiMode={uiMode}` am MissionControl-Aufruf und aus der
  `MissionControl`-Signatur.
- Zwei Kommentare mitgezogen, die sonst Falschaussagen gewesen waeren: der
  Routing-Kommentar im App-Root ("State + Setter bleiben bestehen, weil
  handleMcFallback sie weiter benutzt") und der Kommentar am "Zu Classic"-Knopf
  im MC-Kopf (verwies auf `key={uiMode}` und den Dashboard-Umschalter).

## Zwei Messergebnisse, die Raten ersetzt haben

**1. Die uiMode-Prop an MissionControl war ohne Wirkung.** Alle 8
`uiMode`-Vorkommen im Kompilat von `1033d26` einzeln aufgelistet: State,
localStorage lesen, localStorage schreiben, die Prop am Aufruf,
Dashboard-Signatur, zwei Umschalter-Zeilen im Dashboard-Kopf,
MissionControl-Signatur. **Im RUMPF von MissionControl: null Vorkommen.** Das
Entfernen ist deshalb keine Verhaltensaenderung.

**2. Die Kpi-Falle ist maschinell geklaert, der Beleg ist esbuild selbst.**
esbuild benennt das lokale `Kpi` in `MissionOverviewTab` von sich aus nach
`Kpi2` um, weil es das globale beschattet. Im Kompilat: `Kpi2` hat Definition
plus 4 Aufrufe (lebt), `Kpi` hat nur seine Definition (tot).
**Warnung fuer den, der das nachbaut:** ein zaehlender Totholz-Test kann
beschattete Namen prinzipiell NICHT sehen und meldet `Kpi` faelschlich als
"benutzt". Nur das Kompilat gibt die richtige Antwort.

## Belege (esbuild war ausdruecklich nicht der Beweis)

- **Gegenprobe, der Kern:** absichtlich eine `<Dashboard />`-Referenz in einen
  erreichbaren Zweig gebaut. **esbuild: GRUEN. Duplikat-Grep: leer.** Beide
  blind, genau wie in dieser Uebergabe beschrieben. Kompilat-Scan (1 Treffer)
  und Laufzeit-Rendertest ("Dashboard is not defined") schlagen an. Danach
  Gegenprobe entfernt, md5 der Datei identisch.
- **Kompilat:** `Dashboard`, `uiMode`, `setUiMode`, `setUiModeSafe`,
  `"obf:uiMode"` je **0 Treffer**. Das ist erschoepfend, nicht stichprobenhaft:
  was 0 mal im Bundle steht, kann kein Pfad referenzieren, auch kein
  unerreichbarer. Fallschirm, Fahrer/Stage/Gast, die geteilten Komponenten und
  die sechs Forks alle weiter vorhanden.
- **Pruefsummen aller 206 Top-Level-Bausteine** (inkl. `export default function
  App` und `class MissionControlBoundary`, die eine naive Funktions-Erfassung
  uebersieht): genau drei beruehrt. `Dashboard` entfernt, `App` -8 Zeilen,
  `MissionControl` -2 Zeilen. **204 byte-identisch**, darunter der komplette
  Fallschirm.
- **Laufzeit-Test mit echtem React** (`react-dom/server`, keine neue Library,
  kein jsdom): Modul laedt, App-Root rendert (25053 Zeichen). Nicht im Repo,
  Jordan hat ihn nicht angefordert. Aufbau: esbuild mit `--jsx=automatic`
  bauen (die Projekt-Standardpruefung nutzt `transform`, das Ergebnis ist in
  Node nicht lauffaehig), dann `renderToString(createElement(App))`.
  `globalThis.localStorage` stubben, `navigator` NICHT (Node 22 hat nur einen
  Getter dafuer).
- **Icons: 42 importiert, 0 tot vorher wie nachher.** Importliste unveraendert.
  Kein Icon ist durch den Dashboard-Ausbau tot geworden.

## ERLEDIGT: das globale Kpi ist raus (Commit `8aa1bfe`)

Jordan hat es in derselben Session entschieden ("Kpi mit raus"), deshalb ein
eigener dritter Commit statt Session 25. Das globale `Kpi` (vormals 3624, 9
Zeilen, Signatur `{ label, value, tone }`) hatte als einzigen Aufrufer das
geloeschte Dashboard.

**Der Beleg, dass das richtige getroffen wurde, ist elegant:** vorher benannte
esbuild das lokale Kpi nach `Kpi2` um (Beschattung). Nach dem Loeschen gibt es
`Kpi2` null mal mehr und das lokale heisst wieder `Kpi`, mit Definition plus
genau seinen vier Aufrufen. Waere das falsche erwischt worden, haette es null
Aufrufer. Pruefsummen: genau ein Baustein entfernt, 205 von 205 uebrigen
byte-identisch, darunter `MissionOverviewTab`.

Das **lokale** `const Kpi` in `MissionOverviewTab` (jetzt **6396**) bleibt und
ist damit ab sofort das einzige `Kpi` in der Datei. Die Verwechslungsgefahr aus
den frueheren Uebergaben existiert nicht mehr.

## Rueckweg

`git revert 8aa1bfe 7e4fc47` (beide, in dieser Reihenfolge), Tag
`stabil-classic-vorhanden-2026-07-15` = `f7bb75d`, Tag
`stabil-vor-design-2026-07-13` = `4d13e59`, oder Vercel -> altes Deployment ->
Promote to Production.

## Offene Testfaelle Session 23 (Jordan, auf Production)

1. [ ] Laptop, Dispo-Login: MC oeffnet. Kein "Oberflaeche"-Umschalter, kein
       "Zu Classic".
2. [ ] **Der wichtigste:** Absturz erzwingen (Wegwerf-Branch mit `throw` in
       `MissionControl`) -> Fehlerseite mit "Neu laden". Kein weisser
       Bildschirm, kein Classic. Prueft S22 und S23 zusammen. **Ab jetzt gibt
       es keinen Classic-Boden mehr, der einen Fehler im S22-Umbau auffangen
       wuerde.**
3. [ ] "Neu laden" -> MC ist wieder da.
4. [ ] Konsole `localStorage.setItem("obf:uiMode","classic")` + F5 -> trotzdem
       MC, nichts kaputt. Der Wert wird ab jetzt ignoriert (wie
       "obf:viewMode" seit S21), er muss nicht geloescht werden.
5. [ ] Ueberblick-Tab: die vier KPI-Kacheln (Erledigt / Offen / Anstehend /
       Gesamt) sind da und klickbar. **Sichttest fuer das lokale Kpi.**
6. [ ] Fahrt zuteilen, Timeline verschieben, Rueckgaengig, Chat-Knopf.
7. [ ] iPhone: MC mit unterer Leiste.
8. [ ] Fahrer-, Stage-, Gast-Login unveraendert.
9. [ ] Die offenen Testfaelle aus S21 (besonders Nr. 4, Karte-Tab
       Schema/Google) und S22 stehen weiter aus.

---

# VORARBEIT FUER SESSION 24 (gemessen in Session 23, nicht nochmal messen)

**Alle Zeilennummern hier sind auf `8aa1bfe`**, dem letzten Commit des
Branches, nicht auf `7e4fc47`. Der Kpi-Ausbau liegt VOR den Forks und hat
alles darunter um 10 Zeilen verschoben. Trotzdem per grep gegenpruefen.

## Anker, Stand `8aa1bfe`

| Fork (raus) | Def. | Zeilen | Gegenstueck (bleibt) | Def. |
|---|---|---|---|---|
| `DriversTab` | 4107 | 61 | `MissionDriversTab` | 4180 |
| `MessagesInbox` | 4779 | 82 | `MissionMessagesInbox` | 4865 |
| `ReturnsTab` | 5138 | 248 | `MissionReturnsTab` | 5397 |
| `EmergencyTab` | 5872 | 129 | `MissionEmergencyTab` | 6005 |
| `OverviewTab` | 6224 | 124 | `MissionOverviewTab` | 6377 |
| `TimelinePage` | 6572 | 393 | `MissionTimelinePage` | 6966 |

**Summe: 1037 Zeilen** (die Uebergabe schaetzte ~1100). Alle sechs haben seit
`7e4fc47` **null Aufrufer**, belegt im Kompilat (je genau 1 Vorkommen = nur die
Definition).

## DIE "GETEILT"-FALLE IST ENTSCHAERFT (das ist der wichtige Teil)

Automatisch gemessen: jede Verwendung ihrer Eltern-Funktion zugeordnet
(Klammerzaehlung, Kommentare vorher entfernt), dann gefragt, welche Bezeichner
NUR von den sechs Forks benutzt werden.

**Ergebnis: null.** Keine einzige Komponente und kein Helfer stirbt mit den
sechs Forks. Session 24 ist ein reines Rausschneiden von sechs Bloecken, es
gibt nichts, was mitgeloescht werden muesste oder duerfte.

22 Bezeichner werden von den Forks benutzt UND von anderen. Sie bleiben alle.
Die, bei denen der Fork-Aufrufer der vorletzte ist, also nach S24 nur noch
einen Nutzer haben:

| Bezeichner | Nutzer heute | nach S24 |
|---|---|---|
| `StatusPill` | DriverApp, ReturnsTab | **DriverApp (Fahrer, tabu)** |
| `computeArtistPresence` | ReturnsTab, MissionReturnsTab | MissionReturnsTab |
| `PresenceManager` | ReturnsTab, MissionReturnsTab | MissionReturnsTab |
| `useElementWidth` | OverviewTab, MissionOverviewTab, MissionControl | 2 MC-Stellen |

`StatusPill` bestaetigt Punkt 2 des Nachtrags: es landet beim Fahrer und ist
damit tabu, nicht "auf MC umbauen".

## Was in S24 zusaetzlich tot wird

Nach dem Fork-Ausbau ist zu pruefen (nicht vorab geloescht): `flightAlert`
haengt heute u. a. an `OverviewTab`, hat aber genug andere Nutzer und bleibt.
Die vorhandene Totholz-Liste fuer Session 25 waechst voraussichtlich nicht
durch S24, weil nichts fork-exklusiv ist. **Trotzdem nach dem Loeschen erneut
messen**, das ist eine Prognose, kein Beleg.

---

# Weitere gefundene Punkte fuer spaetere Sessions (aus Session 23)

- **`dynToRpcParams` hat zwei Vorkommen, nicht null.** Die Session-22-Notiz
  sagt "keine Aufrufer, schon auf ff05974". Zwei Vorkommen heisst Definition
  plus eine Verwendung. Nicht analysiert, ausserhalb des Pakets, aber die
  Session-25-Liste stimmt an dieser Stelle moeglicherweise nicht. Vor dem
  Loeschen nachmessen.
- Kommentar bei **8761** ("reiner PASSTHROUGH auf Dashboard", "Ansatz A, ohne
  Classic anzufassen") beschreibt einen Zustand, den es nicht mehr gibt.
  Gehoert zu S24.
- `onSetUiMode` und `onSwitchToMobile` stecken weiter in der
  `MissionControl`-Signatur (**8767**), beide am Aufruf fest `null`, ihre
  Knoepfe unerreichbar. Eigene kleine Scheibe, absichtlich nicht hier.
- Totholz-Liste fuer Session 25, Stand `8aa1bfe`: `ErrorState`, `IconButton`,
  `tsToDayMin`, evtl. `dynToRpcParams` (siehe oben). Das globale `Kpi` ist
  bereits raus. Vorher jeweils per Kompilat gegenpruefen, nicht per Grep auf
  die Quelle (Beschattung, siehe Kpi).
- Unveraendert offen: Chat-FAB ueberlappt die MC-Handy-Leiste, "Was brennt"
  widerspricht dem Kopf-Banner (nicht analysiert, Verdacht Tagesfilter),
  `favicon.ico` 404. Ebenso die fuenf geparkten Stabilitaetsbefunde aus
  Session 18.

---

## Ready-to-paste Opener: Session 24 (die sechs Classic-Forks raus)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: main = 10401ca, Code-Stand 8aa1bfe, 9861 Zeilen. Session 23 (Dashboard,
uiMode und das globale Kpi raus) ist gemerged und auf Production, von mir aber
noch NICHT am Geraet getestet. Session 21 und 22 ebenfalls nicht.
Rueckwege: git revert 8aa1bfe 7e4fc47, Tag
stabil-classic-vorhanden-2026-07-15 = f7bb75d, Tag
stabil-vor-design-2026-07-13 = 4d13e59. Vercel: altes Deployment per
Promote to Production zurueckholen.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem "STAND SESSION 23"
und "VORARBEIT FUER SESSION 24". Die Anker dort sind auf 7e4fc47, alles
weiter oben in der Datei ist aelter. Per grep gegenpruefen.

ENTSCHEIDUNG STEHT: Mission Control ist die einzige Leitstellen-Oberflaeche,
Classic wird geloescht. Nicht neu verhandeln. Weiter tabu:
DriverApp/StageApp/GuestApp (Stage read-only), die Datenschicht, das
dyn_data/RPC-Thema, der Fallschirm.

AUFTRAG: die sechs verwaisten Classic-Forks raus, zusammen 1037 Zeilen.
DriversTab (4107), MessagesInbox (4779), ReturnsTab (5138),
EmergencyTab (5872), OverviewTab (6224), TimelinePage (6572).
Alle sechs haben seit Session 23 null Aufrufer.
- Die Mission-Gegenstuecke bleiben, nicht verwechseln: MissionDriversTab
  (4180), MissionMessagesInbox (4865), MissionReturnsTab (5397),
  MissionEmergencyTab (6005), MissionOverviewTab (6377),
  MissionTimelinePage (6966).
- In Session 23 bereits gemessen: NICHTS stirbt mit den sechs Forks, kein
  Helfer ist fork-exklusiv. Nach dem Loeschen trotzdem neu messen.
- StatusPill faellt danach auf DriverApp zurueck, also Fahrer, tabu.
- Umbenennen der MC-Forks (MissionOverviewTab -> OverviewTab): NICHT,
  kosmetisches Refactoring, nach dem Festival.
- Die Totholz-Liste (ErrorState, IconButton, tsToDayMin): Session 25.

Branch: fix/session-24-forks-raus von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
esbuild ist kein Beweis, das ist in Session 23 mit einer Gegenprobe belegt
worden (kaputte Referenz -> esbuild gruen, Duplikat-Grep leer). Kompilat
gegenpruefen, Pruefsummen der nicht angefassten Bausteine gegen den Vorstand,
Icons einzeln. Commit ueber /tmp/msg.txt. Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu
lang wird.

STICHTAG: ab 21.07. wird nichts mehr geloescht (Festival 23. bis 27.07.).
```

---

# STAND SESSION 24 (16.07.2026): AUF MAIN

`main` = `e8c6246`, FF-Merge aus `fix/session-24-forks-raus` erledigt.
Code-Commit `fce0635` (der Doku-Commit `e8c6246` liegt direkt danach).
`src/ShuttleLeitstelle.jsx`: **8812 Zeilen** (vorher 9861, -1049).
Bundle 752,8 -> 687,4 kb. esbuild gruen, Duplikat-Grep leer. Kein Schema-Re-Run offen.

**Weiterhin gilt der wichtigste Satz: Jordan hat Session 21, 22, 23 UND 24 noch
NICHT am Geraet getestet.** Das sind jetzt fuenf Loeschungen uebereinander, alle
nur maschinell belegt. Rueckweg im Zweifel: Vercel -> Promote to Production.

## Geloescht: die sechs verwaisten Classic-Forks

Je Block der eigene Kommentarkopf, die Funktion und eine Leerzeile:

| Fork | Bereich (Stand `0085061`) | Zeilen |
|---|---|---|
| `DriversTab` | 4106..4168 | 63 (61 + Kopf "Fahrer-Tab") |
| `MessagesInbox` | 4775..4861 | 87 (82 + 4 Zeilen Kopf) |
| `ReturnsTab` | 5138..5386 | 249 (248, kein Kopf) |
| `EmergencyTab` | 5872..6001 | 130 (129, kein Kopf) |
| `OverviewTab` | 6223..6348 | 126 (124 + Kopf "Punkt 12") |
| `TimelinePage` | 6572..6965 | 394 (393, kein Kopf) |

1037 Funktionszeilen + 12 Kommentar/Leerzeilen = **1049**. Die 1037 aus der
Vorarbeit haben exakt gestimmt.

**Sonst nichts.** Keine Umbenennung, kein Refactoring, keine Kommentar-Korrektur
ausserhalb der Bloecke, kein Totholz (das ist S25).

## Belege (esbuild war ausdruecklich nicht der Beweis)

- **Pruefsummen aller Top-Level-Bausteine, mit echtem Parser** (`@babel/parser`,
  schon transitive Abhaengigkeit ueber `@vitejs/plugin-react`, also keine neue
  Library): 292 -> 286. **Genau 6 entfernt, 0 geaendert, 0 neu, 286 von 286
  byte-identisch**, darunter der komplette Fallschirm, alle Mission-Teile und
  DriverApp/StageApp/GuestApp. Das ist der staerkste Beleg dieser Session.
- **Kompilat:** die sechs Forks je **0 Vorkommen**. Erschoepfend, nicht
  stichprobenhaft. Gegenstuecke je 2 (Definition + Aufruf).
- **AST-Referenzzaehlung:** ohne jede echte Referenz vorher 9, nachher 3.
  Differenz = genau die sechs Forks. **Nichts ist neu tot geworden**, die
  Prognose aus Session 23 ist bestaetigt, kein Helfer war fork-exklusiv.
- **Geteilte Nachbarn** fallen wie vorhergesagt um einen Nutzer, keiner auf null:
  `StatusPill` 2->1 (nur noch DriverApp, Fahrer, **tabu**), `computeArtistPresence`
  und `PresenceManager` -> `MissionReturnsTab`, `useElementWidth` -> 2 MC-Stellen,
  `TL_LABEL_W` 4->2, `CASE_ICON` 3->2, `emergencyCases` 4->3, `flightAlert` lebt.
- **Icons:** 42 importiert, Importliste unveraendert, 0 tot vorher wie nachher.
- **Laufzeit-Test mit echtem React** (`react-dom/server`, keine neue Library):
  App-Root rendert, **25053 Zeichen, exakt dieselbe Zahl wie in Session 23**.
- **Gegenprobe:** `<DriversTab />` in den erreichbaren MC-Zweig (Zeile 1142)
  eingebaut. **esbuild GRUEN, Duplikat-Grep leer** — beide blind, die Warnung ist
  erneut praktisch bestaetigt. Der AST-Scan schlaegt an. Danach zurueckgebaut,
  md5 der Datei identisch.
- **Diff:** `--patience` und `--histogram` zeigen **1049 Loeschungen, 0
  Einfuegungen**, sechs Hunks, in jedem genau ein Fork.

## FALLE FUER DEN NAECHSTEN: der Standard-Diff luegt hier

`git diff --stat` zeigt **"9 insertions(+), 1058 deletions(-)"**. Das sind KEINE
echten Einfuegungen. `MissionEmergencyTab` ist eine fast byte-gleiche Kopie von
`EmergencyTab`; der Standard-Algorithmus verankert lieber die gemeinsamen
Rumpfzeilen und stellt das als "Signatur getauscht" dar, statt einen ganzen Block
zu loeschen. Netto 1058 - 9 = 1049, dieselbe Zahl. Mit `--patience` oder
`--histogram` loest es sich auf. **Nicht erschrecken, nicht "korrigieren".**

## ZWEITE FALLE: Textsuche im Kompilat zaehlt zu viel

Beim Messen zweimal reingefallen, beide Male gemerkt:
- **esbuilds `transform` behaelt Kommentare.** Ein `grep` auf das Kompilat zaehlt
  Kommentar-Erwaehnungen mit.
- **Bezeichner in Strings zaehlen auch mit.** `IconButton` sah mit 2 Vorkommen
  lebendig aus. Das zweite ist `/* IconButton */` **in einem CSS-String** in
  `MissionStyles` (Quelle 8532). Es ist tot.
- Ebenso: `scope.hasGlobal()` von Babel liefert fuer jede ungebundene Referenz
  `true` und macht einen Undefiniert-Scan wertlos. `scope.getBinding()` nehmen.

**Konsequenz: Totholz nur ueber AST-Referenzen messen, nicht per Grep.** (Die
0-Treffer-Aussage fuer die sechs Forks ist davon unberuehrt: 0 ist 0, auch in
Strings und Kommentaren.)

## KORREKTUR AN DER TOTHOLZ-LISTE FUER SESSION 25 (gemessen, Stand `fce0635`)

| Bezeichner | Def. | Befund |
|---|---|---|
| `tsToDayMin` | 1753 | **tot**, 0 echte Referenzen |
| `IconButton` | 8715 | **tot**, 0 echte Referenzen (das CSS-`/* IconButton */` bei 8532 taeuscht) |
| `ErrorState` | 8749 | **tot**, 0 echte Referenzen |
| `dynToRpcParams` | 264 | **LEBT**, 1 echte Referenz in **Zeile 307** (`...dynToRpcParams(val)`) im RPC-Schreibpfad. **NICHT loeschen.** |

Damit ist die offene Frage aus Session 23 beantwortet: `dynToRpcParams` gehoert
nicht auf die Liste. Die Liste fuer S25 ist genau: `tsToDayMin`, `IconButton`,
`ErrorState`. Vorher trotzdem neu messen, die Anker verschieben sich.

## Anker, Stand `fce0635`

| Was | Zeile |
|---|---|
| `MissionControlBoundary` (class) | 1253 |
| `MissionControlFallbackScreen` | 1296 |
| erreichbarer MC-Zweig / `if (!mcBlocked)` | 1140 |
| `MissionDriversTab` | 4117 |
| `MissionMessagesInbox` | 4715 |
| `MissionReturnsTab` | 4998 |
| `MissionEmergencyTab` | 5476 |
| `MissionOverviewTab` | 5722 |
| `MissionTimelinePage` | 5917 |
| `MissionControl` (Signatur) | 7718 |
| Kommentar "reiner PASSTHROUGH auf Dashboard" | 7712 |

## Rueckweg

`git revert fce0635` (nur dieser Commit, sauber). Weiter zurueck:
`git revert fce0635 8aa1bfe 7e4fc47`, Tag `stabil-classic-vorhanden-2026-07-15`
= `f7bb75d`, Tag `stabil-vor-design-2026-07-13` = `4d13e59`, oder
Vercel -> altes Deployment -> Promote to Production.

## Offene Testfaelle Session 24 (Jordan, auf Production)

Der Sinn: die sechs Forks waren seit S23 unerreichbar, also darf **nichts**
anders sein. Jeder Tab muss genau so aussehen wie vor dem Merge. Getestet wird
faktisch, ob versehentlich das Mission-Gegenstueck statt des Forks getroffen
wurde. **Deshalb alle sechs Tabs einmal oeffnen, das ist der Kern.**

1. [ ] **Fahrer-Tab** oeffnet, Fahrerliste mit Online/Offline + letztem Kontakt.
2. [ ] **Chat/Nachrichten** oeffnet, Fahrer-Nachricht da, Antworten geht.
3. [ ] **Rueckfahrten** oeffnet, Liste + Suche + "ueberfaellig"-Markierung.
       Neue Rueckfahrt anlegen, zuteilen, WhatsApp-Text.
4. [ ] **Probleme/Notfall** oeffnet, gemeldetes Problem da, Prioritaets-Filter
       geht, "Problem erledigt" landet im Protokoll.
5. [ ] **Ueberblick** oeffnet, die vier KPI-Kacheln da und klickbar, "Was brennt".
6. [ ] **Timeline** oeffnet, Drag-and-Drop + Bestaetigung + Rueckgaengig,
       Jetzt-Linie.
7. [ ] Fahrt zuteilen (`AssignModal`), Fahrt bearbeiten (`RideForm`), Chat-Knopf.
8. [ ] iPhone: MC mit unterer Leiste, alle Punkte + "Mehr".
9. [ ] **Fahrer-Login: annehmen bis abschliessen.** Der Test fuer `StatusPill`,
       das jetzt nur noch dort haengt.
10. [ ] Stage-Login: nur lesen + Problem melden. Gast-Link oeffnen.
11. [ ] Absturz-Test aus S23 (Wegwerf-Branch mit `throw`) -> Fehlerseite mit
        "Neu laden", kein weisser Bildschirm.
12. [ ] Die offenen Testfaelle aus S21 (besonders Nr. 4, Karte-Tab Schema/Google),
        S22 und S23 stehen weiter aus.

## Regressionsrisiken

- **Sehr niedrig, aber nicht null.** Der Beleg "0 Vorkommen im Kompilat" ist
  erschoepfend, und 286 von 286 verbliebenen Bausteinen sind byte-identisch. Es
  gibt keinen bekannten Pfad, auf dem sich etwas geaendert haben koennte.
- **Das echte Risiko liegt nicht in dieser Session, sondern darunter:** S21 bis
  S24 sind vier ungetestete Loeschungen uebereinander. Faellt beim Testen etwas
  auf, ist die Ursache mit hoeherer Wahrscheinlichkeit in S21/S22/S23 als hier.
- Kein Verhalten geaendert: die Forks waren seit S23 nicht erreichbar.
- Kein Schema-Re-Run.

---

# Weitere gefundene Punkte fuer spaetere Sessions (aus Session 24)

- **Die Kommentarkoepfe der Mission-Varianten sind jetzt Falschaussagen.** Sie
  gehoeren dem Nachbarn und lagen damit ausserhalb dieses Pakets, deshalb
  bewusst nicht angefasst (Prioritaet Stabilitaet, Nutzen null). Betroffen,
  Stand `fce0635`: 4106..4115 ("Eigenstaendige Kopie von DriversTab",
  "Classic DriversTab bleibt byte-genau unveraendert"), 4121, 4712..4714
  ("Classic MessagesInbox bleibt unangetastet"), 4988..4997, 5007, 5018,
  5473..5475, 5695, 5712. Dazu 4107 "nur fuer uiMode === mission-control" —
  `uiMode` gibt es seit S23 nicht mehr. **Eine eigene kleine Scheibe nach dem
  Festival**, zusammen mit dem Umbenennen der MC-Forks. Beides ist Kosmetik.
- Kommentar **7712** ("Slice 1: reiner PASSTHROUGH auf Dashboard mit identischen
  Props") und **7715** ("sichtbar am Umschalt-Button, der ueber onSetUiMode...")
  beschreiben einen Zustand, den es nicht mehr gibt. Stand schon als S24-Punkt
  in der Liste, bleibt offen: er haengt an `MissionControl`, nicht an den Forks,
  und "keine Aenderungen ausserhalb des Pakets" gilt. Gehoert in dieselbe
  Kosmetik-Scheibe.
- `onSetUiMode` und `onSwitchToMobile` stecken weiter in der
  `MissionControl`-Signatur (**7718**), am Aufruf fest `null` (1148/1149), ihre
  Knoepfe unerreichbar. Eigene kleine Scheibe.
- Unveraendert offen: Chat-FAB ueberlappt die MC-Handy-Leiste, "Was brennt"
  widerspricht dem Kopf-Banner (nicht analysiert, Verdacht Tagesfilter),
  `favicon.ico` 404. Ebenso die fuenf geparkten Stabilitaetsbefunde aus
  Session 18.

---

## Ready-to-paste Opener: Session 25 (toter Code raus)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: Code-Stand fce0635, 8812 Zeilen (main zeigt auf den Doku-Commit danach).
Session 24 (die sechs Classic-Forks raus) ist gemerged und auf Production.
Session 21, 22, 23 und 24 sind von mir noch NICHT am Geraet getestet.
Jordans Entscheidung 16.07.: Session 25 kommt NACH dem Festival, zusammen mit
der Kommentar-Kosmetik. Vor dem Festival wird nur noch getestet und, falls die
Tests etwas finden, repariert.
Rueckwege: git revert fce0635 8aa1bfe 7e4fc47, Tag
stabil-classic-vorhanden-2026-07-15 = f7bb75d, Tag
stabil-vor-design-2026-07-13 = 4d13e59. Vercel: altes Deployment per
Promote to Production zurueckholen.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem "STAND SESSION 24"
ganz unten. Die Datei waechst nach UNTEN an, alles weiter oben ist aelter.
Die Anker unten sind auf fce0635. Per grep gegenpruefen.

ENTSCHEIDUNG STEHT: Mission Control ist die einzige Leitstellen-Oberflaeche,
Classic ist geloescht. Nicht neu verhandeln. Weiter tabu:
DriverApp/StageApp/GuestApp (Stage read-only), die Datenschicht, das
dyn_data/RPC-Thema, der Fallschirm.

AUFTRAG: toter Code raus. Genau drei, in Session 24 per AST gemessen:
tsToDayMin (1753), IconButton (8715), ErrorState (8749).
- dynToRpcParams (264) LEBT, 1 echte Referenz in Zeile 307. NICHT loeschen.
  Die alte Uebergabe hatte es faelschlich auf der Liste, das ist geklaert.
- Achtung beim Messen: Grep auf das Kompilat zaehlt Kommentare UND Strings mit.
  IconButton sieht dadurch lebendig aus (/* IconButton */ im CSS bei 8532).
  Totholz nur ueber AST-Referenzen messen. @babel/parser ist schon da
  (transitiv ueber @vitejs/plugin-react), das ist keine neue Library.
- Kommentar-Kosmetik (die MC-Kommentarkoepfe verweisen auf geloeschte Forks,
  7712/7715, Umbenennen der MC-Forks): NICHT, nach dem Festival.

Branch: fix/session-25-totholz von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
esbuild ist kein Beweis, das ist in Session 23 und 24 je mit einer Gegenprobe
belegt worden (kaputte Referenz -> esbuild gruen, Duplikat-Grep leer).
Kompilat gegenpruefen, Pruefsummen der nicht angefassten Bausteine gegen den
Vorstand, Icons einzeln. Achtung: git diff --stat kann bei fast gleichen
Bloecken scheinbare Einfuegungen zeigen, --patience nutzen.
Commit ueber /tmp/msg.txt. Sprache Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu lang wird.

STICHTAG: ab 21.07. wird nichts mehr geloescht (Festival 23. bis 27.07.).
```

---

# STAND SESSION 24b (16.07.2026): AUF MAIN

`main` = `413042e`, FF-Merge aus `fix/session-24b-notfall-knopf` erledigt.
`src/ShuttleLeitstelle.jsx`: **8816 Zeilen** (8812 + 4 Zeilen Kommentar).
esbuild gruen, Duplikat-Grep leer. Kein Schema-Re-Run offen.

## ANALYSIERT: "Was brennt" widerspricht dem Kopf-Banner (stand seit Session 19 offen)

**Ergebnis: "Was brennt" ist NICHT kaputt.** Es waren drei verschiedene Dinge,
nur eins davon war ein Fehler. Der ist behoben.

### 1. Dass der Banner den Tag ignoriert, ist Absicht und richtig. NICHT "reparieren".

| | Filter |
|---|---|
| Kopf-Banner (**7968**) | `rideHasOpenIssue(r) && r.status !== "cancelled"` |
| `emergencyCases` (**5450**) | `r.dayKey === day && r.status !== "cancelled" && r.status !== "done"` |

Der Verdacht "Tagesfilter" aus Session 19 stimmt, aber die Richtung ist
andersrum als es aussieht. Der Banner haengt in **7966** direkt in `<main>` und
ist damit ueber JEDEM Tab sichtbar. Er ist die tagUEBERGREIFENDE Aufgabenliste:
eine offene Problem-Meldung hoert nicht auf zu existieren, weil man den
Tag-Reiter wechselt. Das ist gutes Verhalten.

"Was brennt" ist bewusst etwas anderes: tagesbezogen, dafuer breiter (Probleme
PLUS kritische Fluege, Fahrten ohne Fahrer, Fahrer nicht gestartet). Zwei
Begriffe, beide heissen "kritisch". Das ist die eigentliche Verwirrung, aber
kein Logikfehler.

### 2. Der echte Fehler war der "Notfall"-Knopf. BEHOBEN in `413042e`.

Der Banner-Knopf machte nur `setTab("emergency")`, ohne den Tag. Der
Probleme-Tab ist tagesgefiltert. Also: Alarm sagt "1x KRITISCH", Klick auf
"Notfall", leerer Tab. Der Knopf EINE ZEILE DARUNTER ("oeffnen") machte es
schon immer richtig (`setDay(r.dayKey); setEditRide(r);`).

Fix: `onClick={() => { setDay(r.dayKey); setTab("emergency"); }}`.
Beleg: Pruefsummen 285 -> 285, genau ein Baustein geaendert (`MissionControl`),
284 byte-identisch. Node-Test: alter Knopf bei falschem Tag = 0 Faelle, neuer =
1 Fall; bei richtigem Tag alt und neu identisch, also keine Regression.

### 3. OFFEN, NEUER BEFUND: der `done`-Unterschied

Der Banner nimmt `done`-Fahrten mit, `emergencyCases` schliesst sie aus.
Node-Test, beide Filter verbatim nachgebaut:

```
Fall                                | Banner oben      | Was brennt   | stimmt?
A  gleicher Tag, Fahrt laeuft       | 1 offen, 1 krit. | 1 Fall       | ja
B  ANDERER Tag gewaehlt             | 1 offen, 1 krit. | alles ruhig  | Widerspruch (= Punkt 2, behoben)
C  gleicher Tag, Fahrt ERLEDIGT     | 1 offen, 1 krit. | alles ruhig  | >>> WIDERSPRUCH, OFFEN
D  storniert                        | nichts           | alles ruhig  | ja
E  Problem erledigt                 | nichts           | alles ruhig  | ja
```

**Fall C konkret:** Fahrer meldet "Stau", Fahrt wird abgeschlossen, niemand hakt
die Meldung ab -> sie steht FUER IMMER im Banner und taucht im Probleme-Tab nie
auf. Ueber fuenf Festivaltage sammelt sich das an, der rote Alarm wird zu
Hintergrundrauschen. Abhaken geht, aber nur ueber den "erledigt"-Knopf im
Banner selbst (**8010**).

**Bewusst NICHT angefasst:** dafuer muesste man entscheiden, was "offen"
bedeuten soll, und genau das ist laut UEBERGABE-Session-16 schon einmal bewusst
nicht vereinheitlicht worden ("Offen bedeutet an zwei Stellen Verschiedenes,
nicht ungefragt vereinheitlichen"). **Nach dem Festival, mit Kopf.**

## Testfaelle Session 24b (Jordan, auf Production)

1. [ ] Ein Problem an einer Fahrt an Tag X melden (oder ein vorhandenes nehmen).
2. [ ] Einen ANDEREN Tag Y waehlen. Der rote Banner oben muss trotzdem stehen.
3. [ ] **Im Banner auf "Notfall" klicken -> Probleme-Tab MIT dem Problem drin,
       und der Tag oben muss auf X gesprungen sein.** Das ist der Fix.
4. [ ] Auf Tag X klicken, im Banner "Notfall" -> unveraendert, Problem da.
5. [ ] "oeffnen" im Banner -> Bearbeiten-Dialog der Fahrt, Tag springt auf X.
6. [ ] "in Arbeit" und "erledigt" im Banner -> Meldung verschwindet, Protokoll.

## Rueckweg

`git revert 413042e`. Der Commit haengt an nichts.

---

# Weitere gefundene Punkte fuer spaetere Sessions (aus Session 24b)

- **Fall C oben** (Banner behaelt Probleme von `done`-Fahrten, `emergencyCases`
  nicht). Nach dem Festival.
- **Zwei Begriffe, ein Wort:** der Banner zaehlt nur Problem-Meldungen,
  "Was brennt"/`emergencyCases` zaehlt Probleme + Fluege + ohne Fahrer + nicht
  gestartet. Beide sagen "kritisch". Kein Fehler, aber die Zahlen werden nie
  uebereinstimmen und das verwirrt. Falls es je vereinheitlicht wird: erst
  entscheiden, was der Kopf-Alarm eigentlich melden soll.
- Unveraendert offen: Chat-FAB ueberlappt die MC-Handy-Leiste, `favicon.ico`
  404, die MC-Kommentarkoepfe verweisen auf geloeschte Forks, 7712/7715,
  `onSetUiMode`/`onSwitchToMobile` in der `MissionControl`-Signatur, die fuenf
  geparkten Stabilitaetsbefunde aus Session 18, Session 25 (Totholz).

---

# KORREKTUR (16.07.2026): "Chat-FAB ueberlappt die MC-Handy-Leiste" ist FALSCH diagnostiziert

Diese Notiz steht seit Session 19 in der Liste und wurde durch S21, S22 und S23
unveraendert weitergereicht. **Sie stimmt nicht.** Kein Code geaendert, nur
gemessen.

## Was die Notiz behauptet

> "Der Chat-FAB ist `fixed right-5 z-50 w-12 h-12 rounded-full bg-orange-600`,
> die MC-Handy-Leiste ist `md:hidden fixed bottom-0 ... z-30`. Der Knopf liegt
> also darueber. Ihm fehlt auf schmalen Bildschirmen ein Abstand nach unten,
> der die Leiste freihaelt."

## Was tatsaechlich im Code steht

**Der Abstand existiert, seit es die Leiste gibt.** Beides kam im selben Commit
`717d363` ("Session 5 / Slice 5.3: Mobile-Nav im MissionControl-Shell").

| Stelle | Inhalt |
|---|---|
| `ChatPanel` **3544** | `style={{ bottom: \`calc(1.25rem + ${liftOffset \|\| "0px"})\` }}` |
| `MissionControl` **8334** | `<ChatPanel ... liftOffset="var(--mc-fab-lift)" />` |
| `MissionStyles` **8496** | `--mc-fab-lift: calc(56px + env(safe-area-inset-bottom));` |
| `MissionStyles` **8654** | `@media (min-width: 768px) { .mc-scope { --mc-fab-lift: 0px; } }` |
| `MissionControl` Wurzel **7841** | `<div className="mc-scope min-h-screen">` — `ChatPanel` (8334) haengt DRIN, die CSS-Variable vererbt sich also |

Die Leiste ist 56px hoch (+ safe-area). Der FAB sitzt bei
`1.25rem + 56px + safe-area`, also **rund 20px UEBER der Leiste**. Ab 768px
faellt der Lift auf 0, weil es dort keine Leiste gibt.

**Warum die Notiz danebenlag:** ihr Autor hat den `className` gelesen und den
`bottom`-Wert im `style`-Attribut (3544) uebersehen. Ein Grep auf den className
findet den Abstand nicht.

## Was Jordan am iPhone wirklich gesehen hat

Der FAB ist `fixed` und liegt damit ueber dem, was gerade an dieser
Bildschirmposition steht. Auf dem Board ist das der Zeit-Schieber der
`BoardMiniMap` (**6815**):

- Der Schieber rendert **nur bei `!isToday`** (6812). Jordan war auf Di 21.07.,
  deshalb war er ueberhaupt da. An "heute" gibt es ihn nicht.
- Weder `BoardMiniMap` noch `MapTab` haben irgendetwas `sticky` oder `fixed`
  (geprueft ueber beide Komponenten). Die Karte scrollt mit, der Kommentar bei
  8144 sagt das auch woertlich ("mitscrollend").
- Der Schieber ist `flex-1` und reicht bis an den rechten Kartenrand, der FAB
  deckt dessen letzte ~48px ab, WENN die Karte gerade auf FAB-Hoehe steht.

**Also: einmal scrollen und der Schieber ist frei.** Aergerlich, kein Blocker,
und nur an Nicht-heute-Tagen ueberhaupt sichtbar.

## Empfehlung: NICHT anfassen, schon gar nicht vor dem Festival

Der behauptete Defekt existiert nicht. Was bleibt, ist das generische Verhalten
eines schwebenden Knopfes ueber mitscrollendem Inhalt. Jeder "Fix" dafuer
(Karte rechts einruecken, FAB verschieben) ist Design-Arbeit ohne Testabdeckung
an `BoardMiniMap`, die an drei MC-Stellen haengt. Prioritaet 1 ist Stabilitaet.

**Nach dem Festival**, falls es Jordan dann noch stoert: der ehrlichere Weg
waere, dem Board auf schmal unten rechts Platz freizuhalten, nicht am FAB zu
drehen.

## Konsequenz fuer die offene Liste

Der Punkt "Chat-FAB ueberlappt die MC-Handy-Leiste" ist **erledigt/hinfaellig**
und faellt aus der Liste der offenen Punkte. Ersetzt durch: "FAB liegt auf
schmal ueber dem mitscrollenden BoardMiniMap-Schieber (nur !isToday),
Kosmetik, nach dem Festival."

---

# STAND SESSION 24c/24d (16.07.2026): AUF MAIN, PRODUCTION

`main` = `a38d118`, FF-Merge aus `fix/session-24c-status-race`.
Code-Commits: `a4e302d` (from-Waechter), `a7e12c1` (Doppeltipp-Sperre),
`a38d118` (Offline-Ehrlichkeit). 8883 Zeilen. esbuild gruen, Duplikat-Grep leer.
Kein Schema-Re-Run offen.

**Bewusst VOR dem Wochenende gemergt**, obwohl ungetestet: Jordan testet Sa/So
18./19.07. mit mehreren Fahrern. Der Test muss das treffen, was am Festival
laeuft, sonst testen die Fahrer einen Stand, der danach ersetzt wird.
Stichtag 21.07., also zwei Tage Puffer. Rueckweg: Vercel -> altes Deployment ->
Promote to Production.

## Erledigt: zwei der fuenf geparkten Stabilitaetsbefunde aus Session 18

**Befund 1 (Statuswechsel-Race), zwei Mechanismen, sie decken VERSCHIEDENE Loecher:**

1. `from`-Waechter in `advance`/`goBack`: der Zielstatus wurde aus dem
   GERENDERTEN Prop berechnet und blind auf das FRISCHE `r` angewendet. Jetzt
   `if (!r || r.status !== from) return d`. Muster wie die Zuteilungs-Handler.
   Deckt Fall B (Leitstelle setzt zurueck) und D (zwei Tabs): andere
   JS-Kontexte, dort hilft keine lokale Sperre.
2. `STATUS_LOCK_MS = 500` + `mitSperre()`: `busyRef` (Ref, greift im selben Tick)
   + `busyRide` (State, nur Anzeige). Alle vier Statusknoepfe `disabled`, der
   gedrueckte zeigt "speichert…". Deckt den Doppeltipp im EIGENEN Browser.

**JORDANS EINWAND WAR RICHTIG, das ist die Lehre dieser Session:** der
`from`-Waechter allein schuetzt nur, SOLANGE der Schreibzyklus laeuft. Danach
hat React neu gezeichnet, der zweite Tipp liest den neuen Status und laeuft
legitim weiter. Gemessen: ab ~400 ms Tippabstand zwei Stufen, und **je
schneller das Netz, desto kleiner das Schutzfenster**. Bei 20 ms Latenz rutscht
schon ein 150-ms-Doppeltipp durch. Mein erster Node-Test hat das NICHT gesehen,
weil er fuer beide Tipps denselben eingefrorenen Prop benutzt hat, also nur den
Fall "keine Neuzeichnung dazwischen" modellierte. **Wer Races testet, muss die
Zeit mitmodellieren, sonst misst er die Haelfte.**

**WICHTIG, aus Jordans Screenshot (16.07.):** `nextRide` (2466) wird aus der
Liste NICHT herausgefiltert, `rides.map(...)` rendert alles. Dieselbe Fahrt hat
damit ZWEI aktive Statusknoepfe auf einem Bildschirm (Hero-Karte + Liste). Das
ist der realistischere Doppeltipp: oben tippen, scheinbar passiert nichts,
unten nochmal tippen. `busyRef` deckt es ab, weil beide in derselben `DriverApp`
haengen und sich die Sperre teilen.

**Befund 2 (Offline-Falschaussage):**
- `ConnIssueBanner` (1329) versprach "geht automatisch weiter". Es gibt KEINE
  Warteschlange (0 Treffer queue/outbox/pendingWrite). Text sagt jetzt die
  Wahrheit. Der Abgleich-Banner (1333) darf "automatisch" sagen, dort stimmt es:
  das Polling LIEST von selbst weiter, nur Schreiben wird nicht nachgeholt.
- `mitSperre` wertet das `updateDyn`-Ergebnis aus (`{ok,value,error}` gab es
  immer, `advance`/`goBack` haben es als einzige ignoriert) -> `notify()`.
- `reportIssue`: der gefaehrlichste stille Fehler. Fahrer meldet "Notfall",
  Dialog schliesst, ohne Netz kam NIE etwas an. Jetzt Toast. Und
  `triggerDispatcherPush` geht nur noch bei ERFOLG raus, vorher immer (man
  konnte also eine Push-Meldung ueber ein Problem bekommen, das nicht in den
  Daten steht).
- Dialog schliesst bewusst weiter SOFORT: `IssueModal` (3342) hat keinen
  Sende-Schutz, bliebe er offen, waere ein zweiter Tipp eine zweite Meldung.
  Preis: der Fahrer verliert im Fehlerfall seinen Text, erfaehrt es aber klar.

**NICHT angefasst:** `isOffline` in `updateDyn`/`updateSetup` (Datenschicht,
tabu), eine echte Warteschlange (Neuentwicklung), die ALLOWED_NEXT-Tabelle aus
der Uebergabe (haette `setRideStatus` und alle 17 Aufrufstellen getroffen, zu
grosser Radius vor dem Festival -> Session 26), `setRideStatus`,
`STATUS_FLOW`/`STATUS_PREV`, Leitstelle, StageApp/GuestApp (0 Treffer im Diff).

## Belege

- Race A bis D: ALT 4 von 4 kaputt, NEU 4 von 4 korrekt. Reproduziert die
  Uebergabe exakt, inkl. B = `["onboard","planned","done"]`.
- Doppeltipp ueber Latenz 20/150/600 ms: Abstand 0 bis 400 ms IMMER eine Stufe,
  bei allen drei Latenzen identisch (vorher latenzabhaengig). Ab 700 ms zwei
  Stufen, gewollt: zweite Entscheidung auf neu beschriftetem Knopf.
- Normale Ablaeufe 7 von 7, Offline-Test 7 von 7.
- Pruefsummen (@babel/parser): 1 neu (`STATUS_LOCK_MS`), 0 entfernt, genau ZWEI
  geaendert (`ConnIssueBanner`, `DriverApp`), 283 von 286 byte-identisch.
- Laufzeit-Test mit echtem React: 25053 Zeichen, ueber alle Commits konstant.
- esbuild gruen, Duplikat-Grep leer.

## TESTLISTE WOCHENENDE (Sa/So 18./19.07., mehrere Fahrer, Production)

Das hier findet KEIN Einzelgeraet. Die drei mit >>> sind der Kern.

**Fahrer-App, normal**
1. [ ] Fahrt annehmen bis abschliessen, fluessig. Die halbe Sekunde Sperre pro
       Stufe: Schutz oder Haenger? Zahl ist eine Zeile (`STATUS_LOCK_MS`).
2. [ ] "speichert…" erscheint kurz auf dem gedrueckten Knopf.
3. [ ] Einmal "zurueck", dann wieder vor.

**>>> Der Doppeltipp**
4. [ ] Zweimal ganz schnell auf "Fahrt annehmen". Genau EINE Stufe.
5. [ ] Dasselbe auf "Gast eingestiegen". Darf NIEMALS auf "abgeschlossen"
       springen. Das ist der teuerste Fall: Fahrt zu, bevor sie stattfand,
       und `driverState.locationId` springt aufs Ziel (Karte zeigt den Fahrer
       am Hotel).
6. [ ] **Zwei Knoepfe, eine Fahrt:** oben in der Hero-Karte tippen, sofort
       runterscrollen und denselben Knopf in der Liste tippen. Eine Stufe.
       Beide muessen gleichzeitig gesperrt sein.

**>>> Flugmodus (Befund 2)**
7. [ ] Flugmodus an, Status tippen -> Fehlermeldung MUSS kommen.
8. [ ] Flugmodus an, "Notfall" melden -> "NICHT gesendet" MUSS kommen. Vorher
       verschwand die Meldung lautlos und die Leitstelle bekam trotzdem einen
       Push.
9. [ ] Banner sagt jetzt "gehen verloren … bitte noch einmal tippen", nicht
       mehr "geht automatisch weiter".
10. [ ] Flugmodus aus -> "Wieder verbunden", Daten kommen nach.

**>>> Fall B, braucht zwei Geraete**
11. [ ] Fahrer laesst den Bildschirm auf "Gast an Bord" stehen, ANFASSEN
        VERBOTEN. Du setzt die Fahrt in der Leitstelle zurueck auf "geplant".
        Dann tippt der Fahrer seinen alten Knopf. Darf NICHT auf
        "abgeschlossen" springen. Nach ~3 s beschriftet sich der Knopf neu.

**Mehrere Fahrer gleichzeitig**
12. [ ] Zwei Fahrer aendern gleichzeitig Status -> beide kommen an, kein
        Ueberschreiben.
13. [ ] GPS-Konflikttest (stand ohnehin offen): mehrere Fahrer teilen Standort,
        Karte zeigt alle.
14. [ ] Leitstelle sieht alles in ~3 s.

**Alles andere (S21 bis S24 sind weiter ungetestet)**
15. [ ] Alle sechs MC-Tabs oeffnen: Fahrer, Chat, Rueckfahrten, Probleme,
        Ueberblick, Timeline.
16. [ ] Karte-Tab Schema/Google umschalten (steht seit S21 offen).
17. [ ] Banner "Notfall"-Knopf: Problem an Tag X, Tag Y gewaehlt, klicken ->
        Problem da UND Tag springt auf X (Session 24b).
18. [ ] Stage-Login nur lesen + Problem melden. Gast-Link oeffnen.
19. [ ] Absturz-Test: Fehlerseite mit "Neu laden", kein weisser Bildschirm.

## Rueckweg

**Vercel -> altes Deployment -> Promote to Production.** Ein Klick, schneller
als jeder Git-Befehl, und der richtige Weg waehrend eines laufenden Tests.
Git: `git revert a38d118 a7e12c1 a4e302d` (nur die Fahrer-App-Fixes, in dieser
Reihenfolge). Tags: `stabil-classic-vorhanden-2026-07-15` = `f7bb75d`,
`stabil-vor-design-2026-07-13` = `4d13e59`.

---

# SESSION 27: MC-Design fuer die geteilten Komponenten (Jordan will das, 16.07.)

## Frisch gemessen auf `a38d118`, ersetzt die Zahlen aus Session 19

| Komponente | Def. | Zeilen | `var(--mc-*)` | `stone-*` | Optik |
|---|---|---|---|---|---|
| `SettingsTab` | 7235 | 301 | 0 | 67 | Classic |
| `RideForm` | 3832 | 287 | 0 | 9 | Classic |
| `FlightTab` | 5347 | 162 | 0 | 29 | Classic |
| `LiveGoogleMap` | 6943 | 127 | 0 | 3 | Classic |
| `MapTab` | 7106 | 127 | 0 | 32 | Classic |
| `AssignModal` | 3718 | 112 | 0 | 23 | Classic |
| `ChatPanel` | 3568 | 105 | 0 | 22 | Classic |
| `TimelineView` | 6412 | 78 | 0 | 12 | Classic |
| `BoardMiniMap` | 6860 | 46 | 0 | 11 | Classic |
| `WhatsAppModal` | 4348 | 27 | 0 | 6 | Classic |
| `NoGpsSharingPanel` | 7078 | 27 | 0 | 3 | Classic |
| `DriverRow` | 3691 | 25 | 0 | 7 | Classic |

**1424 Zeilen, 12 von 12 komplett Classic, null MC-Token.**

## BELEGT: keine der zwoelf landet beim Fahrer/Stage/Gast

Aufrufstellen per AST ihren Eltern-Komponenten zugeordnet, **0 Treffer in
DriverApp/StageApp/GuestApp**:

- `MissionControl` rendert: `RideForm`, `AssignModal`, `WhatsAppModal`,
  `ChatPanel`, `DriverRow`, `FlightTab`, `MapTab`, `SettingsTab`, `BoardMiniMap`
- `MapTab` rendert: `LiveGoogleMap`, `NoGpsSharingPanel`, `TimelineView`
- `MissionOverviewTab`/`MissionReturnsTab` rendern: `BoardMiniMap`, `TimelineView`

**Konsequenz: ein Re-Skin ist reine Optik, leitstellenseitig, ohne Logik,
Schreibwege oder Daten.** Anderes Kaliber als die Fahrer-App. Schlimmster Fall
ist "sieht komisch aus", nicht Datenverlust. Jordan ist die Leitstelle und
merkt es sofort.

## Timing-Logik (wichtig, gilt auch fuer alles Weitere)

Jordan testet Sa/So 18./19.07. mit mehreren Fahrern. **Was am Festival laufen
soll, muss VOR dem Test rein**, sonst wird ein Stand getestet, der danach
ersetzt wird. Damit gibt es nur zwei sinnvolle Fenster:

| Wann | Bewertung |
|---|---|
| Do/Fr 16./17.07. | Test deckt es ab, Mo/Di Puffer. **Richtig.** |
| Mo/Di 20./21.07. | geht UNGETESTET ins Festival. **Schlechteste Option.** |
| nach dem Festival | null Risiko |

## Aufteilung, nach Nutzen sortiert

- **27a: `RideForm` + `AssignModal` + `WhatsAppModal` = 426 Zeilen.**
  Die zwei Dialoge, die im Betrieb staendig aufgehen. Groesster spuerbarer
  Effekt, eine Familie, ein Muster. **Das ist die Scheibe fuer vor dem Festival.**
- **27d: `TimelineView` + `BoardMiniMap` + `NoGpsSharingPanel` + `DriverRow`
  = 176 Zeilen.** Sitzen direkt IN den MC-Seiten, also die auffaelligsten
  Classic-Inseln, und winzig. Zweitbester Kandidat.
- 27c: `FlightTab` + `MapTab` + `LiveGoogleMap` = 416 Zeilen.
  **Achtung:** `MapTab` ist NICHT "identisch mit Classic gewesen", MC uebergibt
  zusaetzlich `SchematicComponent={MissionSchematicMap}` und `glideMarkers`.
  Die Karte darin ist schon MC, nur der Rahmen ist Classic.
- 27b: `SettingsTab` = 301 Zeilen. Groesster Brocken, wird einmal eingerichtet
  und nie wieder angefasst. Lohnt vor dem Festival nicht.
- `ChatPanel` (105) nach Bedarf.

## Hinweise fuer den Umbau

- Designsystem: `MissionStyles`, CSS-Custom-Properties unter `.mc-scope`.
  Aesthetik: enterprise dark, ruhig, nachtschichttauglich. **Kein Gaming, kein
  Cyberpunk, kein Neon, keine uebertriebenen Animationen.**
- Alles unter `.mc-scope` gescopt. Die Modals werden von `MissionControl`
  gerendert, haengen also im Scope (Wurzel `<div className="mc-scope ...">`).
- **Nur `className`/Style anfassen. Keine Props, keine Handler, keine
  Feldlogik.** `RideForm` ist ein Formular mit Schreibweg, das ist die Grenze.
- Beleg: Pruefsummen muessen GENAU die umgebauten Bausteine als geaendert
  zeigen, alles andere byte-identisch. Dazu Laufzeit-Test (`react-dom/server`,
  App-Root muss 25053 Zeichen rendern) und jede `var(--mc-*)` einzeln gegen
  `MissionStyles` pruefen (eine Variable, die es nicht gibt, macht die ganze
  CSS-Regel ungueltig, und esbuild meldet das nie).

---

## Ready-to-paste Opener: Session 27a — FINAL, Variante B, Stand 16.07.

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: main = 635d2d6, Code-Stand a38d118, 8883 Zeilen. Classic ist komplett
raus (Sessions 19 bis 24), Mission Control ist die einzige Leitstellen-
Oberflaeche. Die Fahrer-App-Fixes (from-Waechter, Doppeltipp-Sperre,
Offline-Ehrlichkeit) sind auf Production, aber noch ungetestet.

RUECKWEG fuer den Design-Umbau: Tag stabil-vor-mc-design-2026-07-16 =
Branch backup/vor-mc-design = 676b02b. Gefaellt mir das Design nicht, gehe ich
da zurueck. Sonst: Vercel -> altes Deployment -> Promote to Production.
Aeltere Tags: stabil-classic-vorhanden-2026-07-15 = f7bb75d,
stabil-vor-design-2026-07-13 = 4d13e59.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem die zwei Abschnitte
ganz unten: "SESSION 27: MC-Design fuer die geteilten Komponenten" und
"SESSION 27a: DIE FALLE, DIE DEN UMBAU SPRENGT". Die Datei waechst nach UNTEN
an, alles weiter oben ist aelter. Anker sind auf a38d118, per grep gegenpruefen.

AUFTRAG 27a: RideForm (3832), AssignModal (3718), WhatsAppModal (4348) auf
MC-Design. Zusammen 426 Zeilen, alle drei heute komplett Classic
(0 var(--mc-*), gemessen). Transitiv belegt: nur von MissionControl
erreichbar, nicht von DriverApp/StageApp/GuestApp.

MEINE ENTSCHEIDUNG, Variante B: Modal (7760) bekommt eine optionale Prop mc.
Gesetzt -> MC-Design, nicht gesetzt -> rendert exakt wie heute. Die drei
Leitstellen-Dialoge setzen sie, IssueModal/StageIssueModal/GuestIssueModal
nicht. KEIN zweites McModal: wir haben gerade sechs Sessions lang Forks
rausgeworfen, ich baue mir keinen neuen. Eine Huelle, ein Fehler, eine
Reparatur.
- Modal haengt ueber IssueModal/StageIssueModal/GuestIssueModal in ALLEN drei
  Rollen-Apps. Der Beleg, den ich sehen will: Render-Test von IssueModal
  vorher/nachher, ZEICHENIDENTISCH. Ohne den geht es nicht auf main.
- NUR className/Style. KEINE Handler, KEINE Feldlogik. RideForm ist ein
  Formular mit Schreibweg, das ist die Grenze. Die mc-Prop ist die einzige
  erlaubte Signatur-Aenderung.
- Designsystem ist MissionStyles, alles unter .mc-scope gescopt. Vorhandene
  Klassen wiederverwenden statt neu bauen: .mc-panel, .mc-input,
  .mc-btn-primary, .mc-btn-assign, .mc-badge, .mc-eyebrow, .mc-iconbtn,
  .mc-modal-fade. Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming,
  kein Cyberpunk, kein Neon, keine uebertriebenen Animationen.
- Die anderen neun geteilten Komponenten NICHT anfassen, das sind 27b/c/d.
- NICHT aufmachen: ob Fahrer/Stage/Gast auch auf MC-Design sollen. Eigenes
  Thema, nach dem Festival, siehe Uebergabe.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm,
  Stage bleibt read-only.

Branch: fix/session-27a-modals von main. Nach meinem OK FF-Merge auf main.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.
esbuild ist kein Beweis, das ist in Session 23 und 24 je mit einer Gegenprobe
belegt worden (kaputte Referenz -> esbuild gruen, Duplikat-Grep leer).
Belege, die ich sehen will:
- Pruefsummen ueber @babel/parser (schon transitive Abhaengigkeit ueber
  @vitejs/plugin-react, keine neue Library): genau RideForm, AssignModal,
  WhatsAppModal, Modal geaendert. ALLES andere byte-identisch, insbesondere
  DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal, GuestIssueModal.
- Render-Test von IssueModal ohne mc-Prop: zeichenidentisch zu vorher.
- Laufzeit-Test mit echtem React (react-dom/server, --jsx=automatic):
  App-Root muss 25053 Zeichen rendern, die Zahl ist ueber alle Sessions
  konstant.
- Jede var(--mc-*) einzeln gegen MissionStyles pruefen. Eine Variable, die es
  nicht gibt, macht die ganze CSS-Regel ungueltig und esbuild meldet das NIE.
  Achtung: --mc-st-new-soft steht auf einer GETEILTEN Zeile (8527), ein
  zeilenweiser Grep findet sie nicht.
- Erreichbarkeit IMMER transitiv messen (Rendergraph), nie ueber direkte
  Eltern. Genau daran ist die Modal-Falle fast durchgerutscht.
- git diff --stat kann bei aehnlichen Bloecken scheinbare Einfuegungen zeigen,
  --patience nutzen.
Commit ueber /tmp/msg.txt. Sprache Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu lang wird.

ZEITFENSTER: bis Freitagabend 17.07. darf gebaut werden, auch am Fahrer-Pfad.
Ab Samstag 18.07. ist Ruhe, dann teste ich mit mehreren Fahrern. Was am
Festival laufen soll, muss VOR dem Test drin sein, sonst testen wir einen
Stand, der danach ersetzt wird. Ab 21.07. wird nichts mehr geloescht.
Festival 23. bis 27.07.
```

---

# ⚠ SESSION 27a: DIE FALLE, DIE DEN UMBAU SPRENGT (gefunden 16.07., VOR dem Bauen)

**`Modal` (7760) darf NICHT umgestylt werden.** Es ist die geteilte Huelle
ALLER Dialoge, auch der von Fahrer, Stage und Gast.

Direkte Eltern von `Modal`:
`AssignModal`, `RideForm`, `WhatsAppModal` (Leitstelle) **und**
`IssueModal` (DriverApp), `StageIssueModal` (StageApp), `GuestIssueModal`
(GuestApp).

**Ein Re-Skin von `Modal` landet also im Tabu-Bereich.** Der Rahmen ist heute
`bg-stone-900 border-stone-800 rounded-2xl` mit `border-b border-stone-800`
Kopfzeile.

## METHODEN-WARNUNG, wichtiger als der Befund selbst

Die erste Messung (direkte Eltern) meldete fuer `Modal` **"0 Treffer in
DriverApp/StageApp/GuestApp"** — und das war FALSCH. `Modal`s direkte Eltern
sind alles Modals, keine Rollen-App. Der Weg zum Fahrer geht ueber
`DriverApp -> IssueModal -> Modal`, also EINE Ebene tiefer.

**Erreichbarkeit muss TRANSITIV gemessen werden, nicht ueber direkte Eltern.**
Rendergraph bauen (Eltern -> Kinder ueber JSXOpeningElement, Aufrufstelle per
Textbereich der Top-Level-Funktion zuordnen), dann von `DriverApp`/`StageApp`/
`GuestApp` aus die Huelle bilden. Alles darin ist tabu.

## Transitiv nachgemessen, Stand `a38d118`: die zwoelf sind sauber

| Komponente | von MissionControl | von Fahrer/Stage/Gast |
|---|---|---|
| `RideForm`, `AssignModal`, `WhatsAppModal` | ja | **nein** |
| `SettingsTab`, `FlightTab`, `MapTab`, `LiveGoogleMap` | ja | **nein** |
| `ChatPanel`, `TimelineView`, `BoardMiniMap` | ja | **nein** |
| `NoGpsSharingPanel`, `DriverRow` | ja | **nein** |
| **`Modal`** | ja | **JA -> TABU** |

## Konsequenz: JORDANS ENTSCHEIDUNG 16.07. = VARIANTE B (eine Huelle, mit Schalter)

```
Modal({ title, children, onClose, wide, mc })
```

`mc` gesetzt -> MC-Design. Nicht gesetzt -> rendert **exakt wie heute**. Die drei
Leitstellen-Dialoge setzen es, `IssueModal`/`StageIssueModal`/`GuestIssueModal`
nicht.

**Begruendung (Jordans, nicht meine):** wir haben sechs Sessions lang Forks
rausgeworfen, um die Fork-Steuer loszuwerden. Eine zweite Modal-Huelle daneben
zu bauen waere genau das wieder, nur in klein. Eine Huelle = ein Fehler = eine
Reparatur. Und wenn nach dem Festival entschieden wird "Fahrer/Stage auch auf
MC", setzt man den Schalter um oder wirft ihn raus. Bei einem `McModal` muesste
man erst wieder zusammenfuehren, was man vorher getrennt hat.

**Beweislast:** Render-Test des Fahrer-Dialogs (`IssueModal`) vorher/nachher,
muss **zeichenidentisch** sein. Ohne diesen Beleg geht es nicht auf main.

### ZWEI FEHLER VON MIR, die Jordan gefunden hat. Nicht wiederholen.

**1. "Ansatz A" war ein totes Argument.** Ich habe zuerst ein eigenes `McModal`
empfohlen mit der Begruendung "lieber duplizieren als eine geteilte Komponente
umbauen". Das war der Ansatz A aus der MC-Fork-Zeit, und sein Grund war
*"Classic bleibt byte-fuer-byte unveraendert"*. **Diesen Grund hat Jordan am
15.07. selbst kassiert** (siehe Abschnitt "REVIDIERT: die Nicht-Anfassen-Liste").
`Modal` ist nicht mit Classic geteilt, Classic gibt es nicht mehr. Es ist mit
Fahrer/Stage/Gast geteilt, und die waren nie Classic. Der Befund (Modal ist
geteilt) stimmt, meine Schlussfolgerung war aus der Mottenkiste.

**2. Ich habe den Fahrer-Pfad zwei Tage zu frueh eingefroren.** Ich habe
argumentiert "bis Samstag nichts am Fahrer anfassen" und im selben Chat das
Gegenteil begruendet, naemlich warum die Fahrer-Fixes VOR dem Test auf main
muessen: was am Festival laeuft, muss der Test treffen. **Richtig ist: bis
Freitagabend darf alles gebaut werden, ab Samstag ist Ruhe.** Nicht frueher.

**3. Ich habe "ENTSCHEIDUNG STEHT" ueber etwas geschrieben, das Jordan nie
entschieden hatte.** Er hatte nur nicht widersprochen. Der Marker ist fuer
Sachen reserviert, die Jordan wirklich entschieden hat.

## BEWUSST OFFEN, NICHT in 27a beantworten

**Sollen Fahrer-App, Stage-App und Gast-App auch auf MC-Design?** Diese Frage
hat noch nie jemand gestellt. Der Beschluss vom 15.07. sagt woertlich "Mission
Control ist die einzige **Leitstellen**-Oberflaeche" - die Rollen-Apps waren nie
Teil davon, es gab nie eine Classic- und eine MC-Variante von ihnen.

Inhaltlich sind es verschiedene Aufgaben: MC ist Laptop, dichte Panels, viele
Zustaende. Die Fahrer-App ist Handy im Auto, nachts, einhaendig, grosse Knoepfe.
Gleiches Aussehen ist kein Selbstzweck.

**Das ist ein eigenes Projekt, kein Nebeneffekt einer Modal-Huelle. Nach dem
Festival, und nur wenn Jordan es aufmacht.**

## Designsystem-Notizen fuer den Umbau (gemessen)

- **54 Tokens definiert, 41 benutzt.** Keine benutzte Variable ist undefiniert
  (geprueft). `--mc-st-new-soft` steht auf einer GETEILTEN Zeile (8527), ein
  zeilenweiser Grep findet sie nicht -> nicht faelschlich fuer fehlend halten.
- `var(--mc-st-${key})` wird dynamisch aus `MC_STATUS` gebaut (new, assigned,
  enroute, done, problem, idle). Alle sechs haben auch eine `-soft`-Variante.
- **Fertige Klassen wiederverwenden statt neu bauen:** `.mc-panel`,
  `.mc-input` (inkl. `:focus`-Ring), `.mc-btn-primary`, `.mc-btn-assign`,
  `.mc-badge` (+ `--new/--assigned/--enroute/--done/--problem/--idle`),
  `.mc-eyebrow`, `.mc-iconbtn`, `.mc-modal-fade`, `.mc-sheet-in`,
  `.mc-ride-card`.
- Radien: `--mc-r: 10px`, `--mc-r-lg: 14px`, `--mc-r-sm: 6px`, `--mc-r-pill`.
  Abstaende: `--mc-space-1` bis `-6` (4/8/12/16/24/32px).
- Ungenutzt und damit frei: die sechs `--mc-st-*-fill`, `--mc-font-mono`.
- **Alles ist unter `.mc-scope` gescopt.** Die drei Modals werden von
  `MissionControl` gerendert, dessen Wurzel (7841) `.mc-scope` traegt. Ein
  eigenes `McModal` muss innerhalb dieses Baums bleiben, sonst greifen die
  Tokens nicht (`var()` ohne Wert macht die ganze Regel ungueltig, und esbuild
  meldet das NIE).

## Rueckweg fuer den Design-Umbau

Tag **`stabil-vor-mc-design-2026-07-16`** = Branch `backup/vor-mc-design`
= `676b02b` (Classic raus, Fahrer-App-Fixes drin, 8883 Zeilen).
Gefaellt Jordan das neue Design nicht: `git reset --hard` auf den Tag, oder
Vercel -> altes Deployment -> Promote to Production.

---

# SESSION 27a: ERLEDIGT (16.07.), Branch `fix/session-27a-modals`

`RideForm`, `AssignModal`, `WhatsAppModal` sind auf MC-Design. Variante B wie
von Jordan entschieden: `Modal` hat jetzt eine optionale Prop `mc`.

## ⚠ DIE FALLE HAT EINE ZWEITE EBENE, die in der 27a-Analyse fehlte

`Modal` war nicht der einzige geteilte Baustein. `RideForm` haengt ausserdem an:

| Baustein | von MissionControl | von Fahrer/Stage/Gast | Behandlung |
|---|---|---|---|
| **`inp`** (1455) | ja | **JA -> TABU** | nicht angefasst, `mcInp` daneben |
| **`Field`** (1456) | ja | **JA -> TABU** | `mc`-Schalter wie bei Modal |
| `LocSelect` | ja | nein | fest auf MC |
| `RideHistory` | ja | nein | **NICHT angefasst, siehe unten** |

Weg: `DriverApp -> IssueModal -> Field/inp`, dazu **der Login-Screen**
(1421/1422/1441) in allen vier Rollen und `SettingsTab` (= 27b).

**`inp` ist im ersten Rendergraph durchgerutscht**, weil das Skript nur
Top-Level-*Funktionen* als Bausteine gesammelt hat. `inp` ist ein
String-`const`. Wer den Graph baut: **Konstanten mitsammeln**, sonst meldet er
faelschlich "nicht erreichbar". `rg.mjs` macht das jetzt richtig.

## Umsetzung

- **`inp` bleibt byte-identisch.** Neue Konstante `mcInp` direkt daneben, die
  die bereits vorhandene Klasse `.mc-input` nutzt. Das Design liegt damit in
  `MissionStyles`, in `mcInp` stehen nur Breite/Abstand/Schriftgroesse.
  Bei einem String geht keine Prop, deshalb hier kein Schalter.
- **`Field` bekommt `mc`**, gleiche Bauart wie `Modal`. Ohne `mc`
  zeichenidentisch. Login, `IssueModal`, `StageIssueModal`, `GuestIssueModal`
  und `SettingsTab` setzen ihn nicht.
- **Kein neues CSS in `MissionStyles`.** Die Zeilen in `AssignModal` nutzen
  `.mc-ride-card` und differenzieren nur ueber `borderColor` inline, damit der
  `:hover` der Klasse lebt. **Ein inline `background` haette den Hover
  totgelegt (inline schlaegt Klasse).** Gilt fuer 27b/c/d genauso.

## Belege (alle reproduzierbar, Skripte liegen im Repo)

- `pruefe.mjs` (Pruefsummen + var-Check): genau **6 geaendert** (`Modal`,
  `Field`, `LocSelect`, `RideForm`, `AssignModal`, `WhatsAppModal`),
  **1 neu** (`mcInp`), 0 entfernt. `DriverApp`, `StageApp`, `GuestApp`,
  `IssueModal`, `StageIssueModal`, `GuestIssueModal`, `MissionStyles`, `inp`,
  `SettingsTab` unveraendert.
- `rendertest.mjs` vorher/nachher, alle **zeichenidentisch**: `IssueModal` 2452,
  `StageIssueModal` 2413, `GuestIssueModal` 2895, `Field` ohne mc 101,
  **App-Root 25053** (die ueber alle Sessions konstante Zahl).
- `smoke.mjs`: alle vier Leitstellen-Renderpfade laufen, **Classic-Farbreste 0**.
- var-Check **mit Gegenprobe**: kaputte Variable eingebaut -> esbuild gruen,
  Check schlaegt an. esbuild ist weiterhin kein Beweis.
- `rg.mjs`: transitiver Rendergraph, inkl. Konstanten.

## `RideHistory`: NACHGEZOGEN (Jordan hat es freigegeben, 16.07.)

War die letzte Classic-Insel im neuen Formular und bei **jeder** bestehenden
Fahrt sichtbar (`logRide(nr, "created", ...)` -> `log.length > 0` ist immer
wahr). Fest auf MC, kein Schalter: nur von `RideForm` erreichbar, eine einzige
Aufrufstelle. Issue-Zustaende nutzen jetzt `mc-badge--problem/assigned/done`.

**Merke fuer 27b/c/d:** der Render-Test deckte hier nur den ZUGEKLAPPTEN
Zustand ab, weil `open` auf `false` startet. Der aufgeklappte Zweig war per
Render-Test unsichtbar und ist per Quelltext-Check belegt (0 Classic-Farbklassen
im Block). **Bei allem, was hinter einem Toggle/Tab sitzt, ist der Render-Test
allein kein Beweis.**

## OFFEN (Inhalt, nicht Design, ausserhalb jedes Design-Pakets)

`RideHistory` zeigt in der Log-Zeile **`e.by` roh** (`"dispo:1"`) statt ueber
`byLabel(setup, e.by)` wie sonst ueberall in der App. Braucht `setup` als Prop,
also eine Signatur-Aenderung -> eigenes Thema, nach dem Festival.

## Restliche neun Komponenten (27b/c/d) unveraendert

`SettingsTab`, `FlightTab`, `MapTab`, `LiveGoogleMap`, `ChatPanel`,
`TimelineView`, `BoardMiniMap`, `NoGpsSharingPanel`, `DriverRow`.
**Achtung fuer 27b:** `SettingsTab` haengt ebenfalls an `Field`/`inp`. Der
Schalter ist da, `mc` muss nur gesetzt und `inp` durch `mcInp` ersetzt werden.

## Testfaelle (Leitstelle, Desktop, MC-Oberflaeche)

1. [ ] Neue Fahrt anlegen: alle Felder lesbar, Speichern legt sie an.
2. [ ] Bestehende Fahrt bearbeiten: Aenderung kommt an.
2b. [ ] **"Verlauf & Meldungen" AUFKLAPPEN.** Der Render-Test hat den
       aufgeklappten Zustand nie gesehen, das muss ein Mensch anschauen.
       Eine Fahrt mit gemeldetem Problem nehmen: offen = rot, in Arbeit =
       orange, erledigt = gruen.
3. [ ] Fahrt mit Flugnummer: der Flug-Block ist blau statt sky, "Flugstatus
       aktualisieren" laeuft, Abklingzeit-Text erscheint.
4. [ ] "Von"/"Nach" auf "Anderer Ort" -> zweites Feld sieht aus wie die anderen.
5. [ ] Fahrer zuteilen: "beste Wahl" blau, "knapp" orange, "zu klein" rot,
       Hover hebt die Zeile leicht an. Zuteilen speichert.
6. [ ] Zuteilung entfernen -> Rueckfrage bei laufender Fahrt kommt noch.
7. [ ] WhatsApp-Texte: kopieren quittiert gruen.
8. [ ] Stornieren -> Rueckfrage kommt noch.
9. [ ] **Fahrer-App: Problem melden.** Der Dialog muss aussehen wie immer.
       Genauso Stage-Login und Gast-Link. Das ist der Beweis fuer den Schalter.
10. [ ] Login-Screen unveraendert.

---

## Ready-to-paste Opener: Session 27d (Stand 16.07., nach 27a)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

STAND: 27a ist fertig und gemergt, main = <HIER main NACH dem FF-Merge>,
8924 Zeilen. Falls ich doch NICHT gemergt habe, sag es mir, dann arbeiten wir
auf fix/session-27a-modals (= d4eace1) weiter und du nimmst DEN als Basis.
Classic ist seit Session 19 bis 24 komplett raus, Mission Control ist die
einzige Leitstellen-Oberflaeche.

In 27a auf MC-Design gebracht: RideForm, AssignModal, WhatsAppModal,
RideHistory. Dazu Modal und Field mit optionaler mc-Prop, neue Konstante mcInp.
Danach noch: Markenorange zurueck (--mc-brand, .mc-btn-primary und Fokus sind
jetzt orange), --mc-text-muted auf AA gehoben, Flug-Block entblaut.

RUECKWEG: Tag stabil-vor-mc-design-2026-07-16 = Branch backup/vor-mc-design
= 676b02b (das ist der Stand VOR allem Design). Sonst: Vercel -> altes
Deployment -> Promote to Production. Aeltere Tags:
stabil-classic-vorhanden-2026-07-15 = f7bb75d,
stabil-vor-design-2026-07-13 = 4d13e59.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem die drei Abschnitte
ganz unten: "SESSION 27a: DIE FALLE, DIE DEN UMBAU SPRENGT", "SESSION 27a:
ERLEDIGT" und dieser Opener. Die Datei waechst nach UNTEN an, alles weiter
oben ist aelter. Anker sind auf d4eace1, per grep gegenpruefen.

AUFTRAG 27d: TimelineView (6440), BoardMiniMap (6888), NoGpsSharingPanel
(7106), DriverRow (3702) auf MC-Design. Zusammen ca. 176 Zeilen. Sitzen direkt
IN den MC-Seiten, also die auffaelligsten Classic-Inseln, und winzig.
Erreichbarkeit vor dem Bauen NEU messen, nicht meiner Tabelle glauben.

ACHTUNG bei TimelineView, das ist die erste Komponente im ganzen Design-Umbau,
bei der ein Fehler mehr macht als haesslich aussehen: sie hat Drag-and-Drop mit
Bestaetigungs-Popover, Ruecknahme-Hinweis und Jetzt-Linie. Inline-style haengt
dort an left/width/opacity und traegt BERECHNETE POSITIONSLOGIK, kein Design.
Vor jedem style-Eingriff pruefen, ob der Wert berechnet ist. .mc-tl-block hat
ausserdem eine Animation, die auf die Drag-Opacity (0.25) Ruecksicht nimmt,
siehe Kommentar bei mc-entry-in. Wenn du dir bei einer Stelle nicht sicher
bist: liegen lassen und mir sagen, nicht raten.

REGELN, aus 27a teuer gelernt:
- Erreichbarkeit IMMER transitiv messen (rg.mjs liegt im Repo), und
  KONSTANTEN mitsammeln. In 27a ist inp durchgerutscht, weil das Skript nur
  Funktionen gesammelt hat und inp ein String-const ist. Es haengt in
  Wahrheit im Fahrer-, Stage-, Gast- UND Login-Pfad.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
  Wenn du es trotzdem brauchst: optionale mc-Prop wie bei Modal/Field, plus
  Render-Test vorher/nachher, ZEICHENIDENTISCH. Ohne den Beleg nicht auf main.
  KEIN zweiter Fork daneben, wir haben sechs Sessions lang Forks rausgeworfen.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser
  einem reinen Design-Schalter.
- MEINE HAUPTSACHE: es soll am Ende richtig gut aussehen UND richtig gut
  lesbar sein. Wenn dir unterwegs auffaellt, dass etwas schlecht lesbar oder
  unruhig ist, sag es mir, auch wenn es nicht im Auftrag steht. Nicht heimlich
  aendern, aber auch nicht verschweigen.
- Farbbedeutungen, seit 27a festgelegt, bitte einhalten:
    Orange (--mc-brand)      = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned)= Status "zugeteilt" UND Warnungen ("knapp")
    Blau   (--mc-st-new)     = Status "neu"
    Rot    (--mc-st-problem) = Problem
  Nicht mischen. In Classic hiess Orange in einer Liste vier Dinge, das war
  das Problem.
- Weiche Fuellungen (-soft) sind mit 30 Prozent Deckkraft SEHR laut, wenn man
  sie flaechig einsetzt. Der Flug-Block hatte das und musste zurueckgebaut
  werden. Fuer Badges gedacht, nicht fuer Panels.
- MissionStyles darf angefasst werden, wenn es die RICHTIGE Stelle ist (eine
  Regel statt fuenf verstreuter Hex-Codes). Aber: die Klassen sind geteilt,
  .mc-btn-primary haengt auch an der Shell und der Timeline. Vorher messen,
  wen es sonst noch trifft, und es mir SAGEN.
- Sonst: vorhandene Klassen wiederverwenden statt neu bauen:
  .mc-panel, .mc-input, .mc-btn-primary, .mc-btn-assign, .mc-badge,
  .mc-eyebrow, .mc-iconbtn, .mc-modal-fade, .mc-ride-card, .mc-metric.
- Kein inline background auf etwas mit .mc-ride-card: inline schlaegt Klasse
  und legt den :hover tot. In 27a ueber borderColor geloest.
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Cyberpunk,
  kein Neon, keine uebertriebenen Animationen.
- Die restlichen Komponenten NICHT anfassen, das sind 27b/27c. Die kommen
  aber, ich ziehe das Design bis zum Ende durch (Entscheidung 16.07.).
  Also: Muster sauber halten, der naechste Chat kopiert es.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm,
  Stage bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema,
  eigenes Projekt nach dem Festival.

BELEGE, die ich sehen will. Die fuenf Skripte liegen im Repo, benutz die:
- pruefe.mjs (Pruefsummen ueber @babel/parser + var-Check): genau die
  umgebauten Bausteine geaendert, ALLES andere byte-identisch, insbesondere
  DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal, GuestIssueModal,
  MissionStyles, inp, Field, SettingsTab.
- rendertest.mjs (react-dom/server, --jsx=automatic), Sollwerte konstant:
  App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
  Field ohne mc 101.
- smoke.mjs: jeder umgebaute Pfad muss echt rendern und Classic-Farbreste 0
  zeigen. esbuild kompiliert durch undefinierte JSX-Referenzen DURCH.
- rg.mjs: transitiver Rendergraph inkl. Konstanten.
- kontrast.mjs: WCAG-Kontrast aller Tokens, liest live aus MissionStyles.
  Stand heute bestehen ALLE zehn Textfarben AA (4.5). Wenn du eine Farbe
  anfasst oder eine neue einfuehrst, muss das so bleiben. Skripte, die Werte
  hartcodieren, luegen nach der naechsten Aenderung - kontrast.mjs hat genau
  diesen Fehler gehabt und ist repariert.
- Jede var(--mc-*) einzeln gegen MissionStyles. Eine Variable, die es nicht
  gibt, macht die ganze CSS-Regel ungueltig und esbuild meldet das NIE.
  Achtung: --mc-st-new-soft steht auf einer GETEILTEN Zeile, ein zeilenweiser
  Grep findet sie nicht.
- ACHTUNG, Toggle-Falle aus 27a: ein Render-Test sieht nur den Zustand, in dem
  die Komponente STARTET. Alles hinter einem Toggle, Tab oder Akkordeon
  rendert im Test gar nicht und ist damit NICHT belegt. Dann zusaetzlich per
  Quelltext pruefen und mir sagen, was ein Mensch anschauen muss.
  TimelineView und die Karten haben genau solche Zustaende.
- esbuild ist kein Beweis, das ist in Session 23, 24 und 27a je mit einer
  Gegenprobe belegt (kaputte Referenz/Variable -> esbuild gruen).
- git diff --stat kann bei aehnlichen Bloecken scheinbare Einfuegungen zeigen,
  --patience nutzen.

Branch: fix/session-27d-inseln von main. Nach meinem OK FF-Merge auf main.
Commit ueber /tmp/msg.txt. Sprache Deutsch, informell, keine Gedankenstriche,
korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu lang wird.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
Uebergabe fortschreiben, Opener fuer die naechste Session.

ZEITFENSTER: bis Freitagabend 17.07. darf gebaut werden, auch am Fahrer-Pfad.
Ab Samstag 18.07. ist Ruhe, dann teste ich mit mehreren Fahrern. Was am
Festival laufen soll, muss VOR dem Test drin sein. Ab 21.07. wird nichts mehr
geloescht. Festival 23. bis 27.07.
```

### Noch offen nach 27a

- **27b: `SettingsTab` (7263), 301 Zeilen.** Groesster Brocken. **Haengt am
  selben `Field`/`inp` wie RideForm** - der Schalter ist seit 27a da, `mc`
  muss nur gesetzt und `inp` durch `mcInp` ersetzt werden. Wird einmal
  eingerichtet und nie wieder angefasst, lohnt vor dem Festival kaum.
- **27c: `FlightTab` (5375), `MapTab` (7134), `LiveGoogleMap` (6971).**
  `MapTab` bekommt von MC zusaetzlich `SchematicComponent={MissionSchematicMap}`
  und `glideMarkers`, die Karte darin ist also schon MC, nur der Rahmen ist
  Classic.
- `ChatPanel` (3579) nach Bedarf.
- **Inhalt, nicht Design:** `RideHistory` zeigt `e.by` roh (`"dispo:1"`) statt
  ueber `byLabel(setup, e.by)`. Braucht `setup` als Prop. Nach dem Festival.

---

# SESSION 27d: ERLEDIGT (16.07.), Branch `fix/session-27d-inseln` = `ef15db5`

**Basis war `ae82417` (= `fix/session-27a-modals`), NICHT `main`.** 27a war beim
Start dieser Session nicht gemergt: `main` stand auf `28f005b` (8883 Zeilen, nur
Doku), `merge-base` war genau `main`, also ist 27a weiter ein sauberer
Fast-Forward. Der Opener hatte diesen Fall vorgesehen. **Offen: FF-Merge von
27a UND 27d auf main.** Reihenfolge: 27a zuerst, 27d sitzt darauf.

`TimelineView`, `BoardMiniMap`, `NoGpsSharingPanel`, `DriverRow` sind auf
MC-Design. 8924 -> 8934 Zeilen, Diff 54/44 in einer Datei.

## Erreichbarkeit frisch gemessen (nicht der alten Tabelle geglaubt)

| Ziel | von MissionControl | von Fahrer/Stage/Gast |
|---|---|---|
| `TimelineView` (6440) | ja | **nein** |
| `BoardMiniMap` (6888) | ja | **nein** |
| `NoGpsSharingPanel` (7106) | ja | **nein** |
| `DriverRow` (3702) | ja | **nein** |

Die TABU-markierten Kinder (`toMin`, `sortMin`, `pad`, `effDur`, `fmtDur`,
`driverDay`, `dayNowMin`, Lucide-Icons) sind reine Logik bzw. Icons, also
nichts, was ein Design-Umbau anfasst. Kein Schalter noetig, keine Signatur
geaendert.

## ⚠ ZWEI GRAPH-FALLEN, die nur der Quelltext aufloest

1. **`Row` in `TimelineView` (6471) ist eine LOKALE Komponente**, die die
   Top-Level-`Row` shadowt. `rg.mjs` kennt nur Top-Level-Namen und meldet
   deshalb faelschlich eine Kante `TimelineView -> Row` auf die geteilte Row
   (die an `MissionOverviewTab`/`MissionTimelinePage` haengt). **Der Umbau der
   lokalen Row ist folgenlos.** Wer den Graph liest: bei jedem Treffer
   nachsehen, ob der Name lokal neu gebunden wird.
2. **`Gauge` ist ein Icon, keine Komponente.** Taucht als "Kind" auf, weil der
   Graph Identifier sammelt.

## Bewusst NICHT angefasst (Grenze zu 27c)

- `SchematicMap`/`MissionSchematicMap` samt `MapNode`, `MapTooltip`,
  `DriverMarker`, `OpenRideMarker`, `RoutePath`: die Karte IN der BoardMiniMap.
  Nur die Huelle drumherum ist jetzt MC.
- **`MapIcon` ist TABU** (haengt an `GuestRideCard`). Nur die `className` an der
  Aufrufstelle in BoardMiniMap wurde geaendert, `MapIcon` selbst nicht.
- `STATUS_STYLE` (an sieben Stellen geteilt, u. a. Kartenmarker): die Legende
  liest weiter `v.fill`.
- `Gauge`/`Row` (Top-Level): geteilt mit `AssignModal`, `MissionDriversTab`,
  `MissionOverviewTab`, `MissionTimelinePage`. Stehen nicht im 27d-Auftrag.

## Umsetzung, Muster identisch zu 27a

- **Layout/Groesse bleibt Tailwind, nur Farbe/Flaeche wird MC-Token.** Damit
  verschiebt sich nichts im Layout.
- Van/Car-Chip in `DriverRow` und `NoGpsSharingPanel` nutzt jetzt exakt das
  Muster aus `AssignModal` (`--mc-st-assigned-soft` / `--mc-st-new-soft`).
- **`TimelineView` faerbt Balken jetzt ueber `mcRideStatusKey(status, hasDriver)`
  + `var(--mc-st-${k}-fill)`/`var(--mc-st-${k})`, also identisch zur grossen
  `MissionTimelinePage`.** Die alte eigene Tailwind-Farbtabelle (`barColor`) ist
  weg. Reine Farbzuordnung, keine Statuslogik angefasst.
- **Sichtbare Semantik-Verschiebung, bewusst:** Balken ohne Fahrer waren orange
  (Warnung), sind jetzt blau = `new`, wie ueberall sonst in MC. Ein
  `warn`-Sonderzweig waere falsch gewesen: eine erledigte Fahrt ohne Fahrer
  waere damit blau statt gruen. **Die Warnung sitzt weiter am Label links**
  (`--mc-st-assigned`, orange) und an der Position ganz oben.
- Kein inline `background` auf `.mc-ride-card` (haette den `:hover` totgelegt).
- **Kein neues CSS in `MissionStyles`** (per Pruefsumme belegt).

## Belege (reproduzierbar)

- `node pruefe.mjs /tmp/vorher.jsx src/ShuttleLeitstelle.jsx`: **GEAENDERT 4**
  (genau die vier Ziele), NEU 0, ENTFERNT 0, **283 von 287 byte-identisch**.
  `DriverApp`, `StageApp`, `GuestApp`, `IssueModal`, `StageIssueModal`,
  `GuestIssueModal`, `MissionStyles`, `inp`, `Field`, `SettingsTab`, `LocSelect`
  unveraendert. var-Check: **keine undefinierte `var(--mc-*)`**, alle dynamischen
  `--mc-st-${key}-fill` definiert.
- `node rendertest.mjs src/ShuttleLeitstelle.jsx`: **App-Root 25053**,
  IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
  Alle fuenf identisch zu vorher.
- `node smoke27d.mjs src/ShuttleLeitstelle.jsx` (**neu, liegt im Repo**): sieben
  Renderpfade laufen echt, **Classic-Farbreste 0**. Abgedeckt: TimelineView voll
  (inkl. Konflikt-Ueberschneidung und Zeile ohne Fahrer) und leer, BoardMiniMap
  live und sim/Regler, NoGpsSharingPanel, DriverRow unterwegs/frei sowie ueber
  und unter `softHoursMin`.
- **Hinweis:** `rendertest.mjs`/`smoke.mjs` schreiben nach `/home/claude/repo`.
  Liegt das Repo woanders: `ln -sfn <repo> /home/claude/repo`.

## ⚠ TOGGLE-FALLE: was der Render-Test NICHT gesehen hat

- **`BoardMiniMap`: der Auswahl-Block.** `selected` startet auf `null`, der
  `sel`-Button (jetzt `.mc-ride-card`) rendert im Test nie. Per Quelltext
  belegt (0 Classic-Farbklassen im Block), **aber ein Mensch muss ihn ansehen**:
  auf der Live-Karte einen Fahrer antippen.
- `hovered` -> `MapTooltip` gehoert zu `SchematicMap`, nicht angefasst.

## Regressionsrisiken

1. **Nur Optik.** Keine Handler, keine Props, keine Signatur, keine Feldlogik,
   keine Datenschicht. Schlimmster Fall ist "sieht komisch aus".
2. **`.mc-*`-Klassen greifen nur unter `.mc-scope`.** Alle vier haengen unter
   `MissionControl` (Wurzel 7841 traegt `.mc-scope`), belegt ueber den
   Rendergraph. Wuerde einer der vier je ausserhalb gerendert, waere er ungestylt.
3. **`.mc-panel` bringt eine Mount-Animation mit** (`mc-panel-in`). BoardMiniMap,
   NoGpsSharingPanel und TimelineView faden beim Tab-Wechsel kurz ein. Bei
   `prefers-reduced-motion` ist es aus.
4. `DriverRow` hat jetzt den Hover-Lift von `.mc-ride-card` (1px). In einer
   Liste mit 20 Fahrern ist das sichtbar. Falls es Jordan stoert: `mc-ride-card`
   -> `mc-panel` an einer Stelle, sonst nichts.
5. Balken ohne Fahrer sind blau statt orange, siehe oben. Absicht.

## Testfaelle 27d (Leitstelle, Desktop, MC)

1. [ ] Fahrerliste rechts: Punkt blau = unterwegs, gruen = frei. Van-Chip
       orange, Car-Chip blau. Ueber der Soll-Fahrzeit wird die Zeit orange.
       Telefon-Icon reagiert auf Hover und waehlt.
2. [ ] Timeline unter der Karte: Balkenfarben wie auf der grossen Timeline-Seite
       (unterwegs violett, erledigt gruen, zugewiesen orange, neu blau).
3. [ ] **Zwei Fahrten desselben Fahrers ueberlappen lassen -> roter Ring.**
4. [ ] Zeile "ohne Fahrer" ganz oben: Label orange, Balken blau. Antippen
       oeffnet die Fahrt.
5. [ ] **Live-Karte: einen Fahrer antippen** -> die Zeile darunter erscheint als
       Karte mit Hover. **Das hat kein Test je gesehen.**
6. [ ] Karte an einem Tag, der nicht heute ist: Zeitregler ist orange, die Zeit
       links steht im Monospace-Font. Heute stattdessen: pulsender Punkt + "live".
7. [ ] Panel "Kein Live-Standort" (Fahrer mit Fahrt, aber ohne frisches GPS):
       oranger Rahmen, Chips wie in der Fahrerliste.
8. [ ] **Fahrer-App, Stage, Gast-Link: unveraendert.** Sollte der Render-Test
       schon beweisen, einmal draufschauen kostet nichts.

## Rueckweg

`git reset --hard ae82417` (Stand nach 27a) oder Tag
`stabil-vor-mc-design-2026-07-16` = `676b02b` (vor allem Design). Sonst:
Vercel -> altes Deployment -> Promote to Production.

## Noch offen nach 27d

- **FF-Merge 27a -> main, dann 27d -> main.**
- **27b: `SettingsTab` (7263), 301 Zeilen.** `Field`/`inp`-Schalter liegt seit
  27a bereit: `mc` setzen, `inp` -> `mcInp`. Lohnt vor dem Festival kaum.
- **27c: `FlightTab`, `MapTab`, `LiveGoogleMap`.** Achtung: `MapTab` rendert
  `TimelineView` und `NoGpsSharingPanel`, die sind seit 27d MC. Der Rahmen von
  `MapTab` ist noch Classic, dadurch sitzen jetzt MC-Panels in einem
  Classic-Rahmen. **Wer 27c macht, faengt beim Rahmen an.** Weiter tabu bleiben
  `MapIcon` (Gast!) und `STATUS_STYLE`.
- `ChatPanel` (3579) nach Bedarf.
- **Inhalt, nicht Design:** `RideHistory` zeigt `e.by` roh (`"dispo:1"`) statt
  ueber `byLabel(setup, e.by)`. Braucht `setup` als Prop. Nach dem Festival.

---

## Ready-to-paste Opener: Session 27c (Stand 16.07., nach 27d)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
Dann: ln -sfn <repo-pfad> /home/claude/repo (rendertest.mjs/smoke.mjs
schreiben dorthin, sonst laufen sie nicht).

STAND: 27a und 27d sind gebaut. main = <HIER main NACH den FF-Merges>,
8934 Zeilen. Falls ich NICHT gemergt habe, sag es mir: dann ist
fix/session-27d-inseln (= 757fd92) die Basis, der haengt auf
fix/session-27a-modals (= ae82417), der haengt auf main. Classic ist seit
Session 19 bis 24 komplett raus, Mission Control ist die einzige
Leitstellen-Oberflaeche.

Auf MC-Design sind: RideForm, AssignModal, WhatsAppModal, RideHistory (27a),
TimelineView, BoardMiniMap, NoGpsSharingPanel, DriverRow (27d).
Dazu Modal und Field mit optionaler mc-Prop, Konstante mcInp.

RUECKWEG: Tag stabil-vor-mc-design-2026-07-16 = Branch backup/vor-mc-design
= 676b02b (Stand VOR allem Design). Sonst: Vercel -> altes Deployment ->
Promote to Production.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem "SESSION 27a: DIE
FALLE", "SESSION 27a: ERLEDIGT", "SESSION 27d: ERLEDIGT" und diesen Opener.
Die Datei waechst nach UNTEN an. Anker sind auf 757fd92, per grep gegenpruefen.

AUFTRAG 27c: FlightTab (5375), MapTab (7134), LiveGoogleMap (6971) auf
MC-Design. Ca. 416 Zeilen. FANG BEIM MAPTAB-RAHMEN AN: MapTab rendert seit 27d
MC-Panels (TimelineView, NoGpsSharingPanel) in einem Classic-Rahmen, das ist
gerade der haesslichste Bruch in der App. Erreichbarkeit vor dem Bauen NEU
messen, nicht der Tabelle glauben.

REGELN, aus 27a und 27d teuer gelernt:
- Erreichbarkeit IMMER transitiv messen (rg.mjs), KONSTANTEN mitsammeln.
- rg.mjs kennt nur Top-Level-Namen: bei jedem Treffer im Quelltext nachsehen,
  ob der Name LOKAL neu gebunden wird (Row in TimelineView shadowt die
  Top-Level-Row) und ob es ueberhaupt eine Komponente ist (Gauge ist ein Icon).
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
  Fuer 27c konkret: MapIcon haengt an GuestRideCard -> TABU, nur die className
  an der Aufrufstelle aendern, nie MapIcon selbst. STATUS_STYLE ist an sieben
  Stellen geteilt (Kartenmarker) -> nicht anfassen.
- Brauchst du trotzdem etwas Geteiltes: optionale mc-Prop wie bei Modal/Field,
  plus Render-Test vorher/nachher, ZEICHENIDENTISCH. KEIN zweiter Fork.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter. Layout/Groesse bleibt Tailwind, nur Farbe/Flaeche
  wird MC-Token. Dann verschiebt sich nichts.
- KEIN neues CSS in MissionStyles. Vorhandene Klassen: .mc-panel, .mc-input,
  .mc-btn-primary, .mc-btn-assign, .mc-badge, .mc-eyebrow, .mc-iconbtn,
  .mc-modal-fade, .mc-ride-card, .mc-metric, .mc-live-dot, .mc-tl-block.
- Kein inline background auf etwas mit .mc-ride-card: inline schlaegt Klasse
  und legt den :hover tot. Ueber borderColor loesen.
- Gibt es fuer eine Sache schon ein MC-Muster, kopier das statt neu zu erfinden
  (Van/Car-Chip aus AssignModal, Balkenfarbe aus MissionTimelinePage ueber
  mcRideStatusKey + var(--mc-st-${k}-fill)).
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Cyberpunk,
  kein Neon, keine uebertriebenen Animationen.
- SettingsTab NICHT anfassen, das ist 27b.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm,
  Stage bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema,
  eigenes Projekt nach dem Festival.

BELEGE, die ich sehen will. Die Skripte liegen im Repo, benutz die:
- pruefe.mjs: genau die umgebauten Bausteine geaendert, ALLES andere
  byte-identisch, insbesondere DriverApp, StageApp, GuestApp, IssueModal,
  StageIssueModal, GuestIssueModal, MissionStyles, inp, Field, SettingsTab,
  MapIcon, STATUS_STYLE.
- rendertest.mjs, Sollwerte konstant: App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
- smoke27d.mjs als Vorlage fuer einen eigenen 27c-Smoke: jeder umgebaute Pfad
  muss echt rendern und Classic-Farbreste 0 zeigen. Deck dabei BEIDE Zustaende
  ab, wo es welche gibt.
- rg.mjs: transitiver Rendergraph inkl. Konstanten.
- Jede var(--mc-*) einzeln gegen MissionStyles (macht pruefe.mjs mit).
  --mc-st-new-soft steht auf einer GETEILTEN Zeile, zeilenweiser Grep findet
  sie nicht.
- TOGGLE-FALLE: ein Render-Test sieht nur den STARTZUSTAND. Alles hinter
  Toggle/Tab/Akkordeon rendert im Test nicht und ist NICHT belegt. Dann per
  Quelltext pruefen und mir sagen, was ein Mensch anschauen muss. LiveGoogleMap
  und MapTab haben genau solche Zustaende (Kartenmodus, Auswahl, Tooltip).
- esbuild ist kein Beweis (Session 23, 24, 27a je mit Gegenprobe belegt).
- git diff --stat luegt bei aehnlichen Bloecken, --patience nutzen.

Branch: fix/session-27c-karte von der genannten Basis. Nach meinem OK
FF-Merge. Commit ueber /tmp/msg.txt. Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu
lang wird.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
Uebergabe fortschreiben, Opener fuer die naechste Session.

ZEITFENSTER: bis Freitagabend 17.07. darf gebaut werden. Ab Samstag 18.07. ist
Ruhe, dann teste ich mit mehreren Fahrern. Was am Festival laufen soll, muss
VOR dem Test drin sein. Ab 21.07. wird nichts mehr geloescht.
Festival 23. bis 27.07.
```

---

# SESSION 27c: TEILWEISE ERLEDIGT (16.07.), Branch `fix/session-27c-karte` = `b009329`

Basis: `fix/session-27d-inseln` (= `db64c9a`). **Kette: main -> 27a (`ae82417`)
-> 27d (`db64c9a`) -> 27c (`b009329`). Nichts davon ist auf main.**
8934 -> 8938 Zeilen.

## Erledigt: die Karten-Seite ist komplett MC

| Scheibe | Commit | Inhalt |
|---|---|---|
| 1 | `0931dee` | `MapTab`-Rahmen |
| 2 | `b009329` | `MapFilters`, `MapLegend`, `DriverDetailsPanel` |

Scheibe 2 war **nicht** im urspruenglichen 27c-Auftrag. Jordan hat sie am 16.07.
freigegeben (Variante A), nachdem der Smoke-Test nach Scheibe 1 noch **27
Classic-Reste** im gerenderten MapTab zeigte, obwohl `MapTab` selbst 0 hatte.
Ohne sie waere ein MC-Rahmen mit drei Classic-Flecken drin entstanden, also
derselbe Bruch wie vorher, nur eine Ebene tiefer.

**Der Merke daraus:** Baustein-Ebene ("MapTab hat 0 Classic-Farbklassen") und
Renderpfad-Ebene ("MapTab rendert 27 Classic-Farbklassen") sind zwei
verschiedene Zahlen. **Nur die zweite zaehlt fuer das, was Jordan sieht.**
Immer den ganzen Renderpfad smoken, nicht nur die Komponente greppen.

## Umsetzung, Muster wie 27a/27d

- Layout/Groesse bleibt Tailwind, nur Farbe/Flaeche wird MC-Token.
- **1:1 uebersetzt, nichts neu erfunden:** Live bleibt gruen, Simulation
  orange, aktiver Filter orange, Anruf-Knopf gruen. Schema/Google bleibt
  neutral (`--mc-text`/`--mc-bg`, das MC-Segmentmuster aus MissionTimelinePage).
- Aktiver Eintrag in "Offene Fahrten": `borderColor` statt inline `background`,
  sonst waere der `:hover` der `.mc-ride-card` tot.
- **NEU GELERNT, Gegenstueck zur 27a-Falle:** Der Anruf-Knopf traegt
  `.mc-btn-primary` MIT inline `background`. Das ist erlaubt, weil der `:hover`
  dieser Klasse ueber `opacity` laeuft, nicht ueber `background`. **Die Regel
  lautet nicht "nie inline background", sondern "nie inline background auf einer
  Klasse, deren :hover den background aendert".** Bei `.mc-ride-card` ist es
  background (tabu), bei `.mc-btn-primary` opacity (geht).

## Unangetastet geblieben

- `STATUS_STYLE` (an sieben Stellen geteilt): Legende liest weiter `v.fill`.
- **`MapIcon` ist TABU** (`GuestRideCard`): nur die `className` an der
  Aufrufstelle geaendert, die Komponente nicht.
- `SchematicMap`, `MissionSchematicMap`, `MapNode`, `MapTooltip`,
  `DriverMarker`, `OpenRideMarker`, `RoutePath`: **haben alle 0
  Classic-Farbklassen**, die Karte selbst war nie das Problem. Nicht anfassen.

## Belege

- `pruefe.mjs` gegen den Stand vor 27c: **GEAENDERT 4** (`MapTab`, `MapFilters`,
  `MapLegend`, `DriverDetailsPanel`), 0 neu, 0 entfernt, **283 von 287
  byte-identisch**. `DriverApp`/`StageApp`/`GuestApp`/`MissionStyles`
  unveraendert. Keine undefinierte `var(--mc-*)`.
- `rendertest.mjs`: App-Root **25053**, IssueModal 2452, StageIssueModal 2413,
  GuestIssueModal 2895, Field ohne mc 101. Alle konstant.
- `smoke27c.mjs` (**neu, liegt im Repo**): sieben Pfade, **Classic-Reste 0**
  (vorher 27). `DriverDetailsPanel` sitzt hinter einer Auswahl und rendert im
  MapTab-Test nie -> dort direkt gerendert, mit und ohne Telefonnummer.

## ⚠ NOCH OFFEN IN 27c: `FlightTab` (5375) und `LiveGoogleMap` (6971)

**`FlightTab` ist der heikelste Teil von 27c, nicht der einfachste.** Transitiv
gemessen ist `FlightTab` selbst sauber (nur von MissionControl), **aber zwei
seiner Kinder sind TABU:**

| Kind | Art | Problem |
|---|---|---|
| `flightStyle` | Style-Funktion | auch im Fahrer-Pfad erreichbar |
| `FLIGHT_STATUS` | Konstante | auch im Fahrer-Pfad erreichbar |

Damit ist das **dieselbe Lage wie `Modal`/`Field`/`inp` in 27a**, und es gibt
genau die drei bekannten Wege: optionaler `mc`-Schalter (bei einer Funktion
moeglich, Beweislast: Render-Test des Fahrer-Pfads zeichenidentisch), eine
zweite Konstante daneben wie `mcInp` (bei `FLIGHT_STATUS`), oder gar nicht
anfassen. **Kein zweiter Fork.** Das braucht einen eigenen, frischen Chat.

`LiveGoogleMap` (127 Zeilen, 3 Classic-Farbklassen) ist dagegen klein und haengt
nur an MapTab. **Achtung Toggle-Falle:** rendert nur, wenn oben auf
"Google Maps" umgeschaltet wird, und braucht dann noch die geladene Google-API.
Ein Render-Test sieht davon fast nichts, das muss ein Mensch am Geraet ansehen.

## Regressionsrisiken 27c

1. **Nur Optik.** Keine Handler, keine Props, keine Signatur, keine Feldlogik.
2. `.mc-*` greift nur unter `.mc-scope`. Alle vier haengen unter
   `MissionControl` (Wurzel 7841), belegt ueber den Rendergraph.
3. `.mc-panel` bringt die Mount-Animation mit: die rechte Spalte fadet beim
   Tab-Wechsel kurz ein. Bei `prefers-reduced-motion` aus.
4. Die Zeilen in "Offene Fahrten"/"Unterwegs" haben jetzt den 1px-Hover-Lift
   der `.mc-ride-card`. Dichte Listen, das ist sichtbar. Falls es stoert:
   `mc-ride-card` raus, nichts sonst.

## Testfaelle 27c (Leitstelle, Desktop, MC, Karten-Seite)

1. [ ] Kopfzeile: "Live" aktiv = gruen, "Simulation" aktiv = orange.
       Zeitregler orange, im Live-Modus ausgegraut.
2. [ ] Schema-Karte/Google-Maps-Umschalter: aktiv = heller Block.
3. [ ] Filterknoepfe ueber der Karte: aktiver Filter orange, Zaehler stimmen.
4. [ ] Legende unter der Karte: Punkte in Statusfarben, "geschaetzt" gestrichelt,
       "offene Fahrt" als Raute.
5. [ ] **Fahrer auf der Karte anklicken** -> Detail-Panel rechts, oranger Rahmen,
       Van/Car-Chip wie in der Fahrerliste, "Anrufen" gruen, X schliesst.
       Bei Problem/Verspaetung: rote Chips.
6. [ ] "Offene Fahrten": Eintrag antippen -> heller Rahmen, nochmal antippen
       loest wieder. Hover hebt die Zeile leicht an.
7. [ ] "Unterwegs": Eintrag antippen waehlt den Fahrer auf der Karte aus.
8. [ ] **Flug-Seite: noch Classic, das ist Absicht** (siehe oben).
9. [ ] **Fahrer-App, Stage, Gast-Link: unveraendert.**

## Rueckweg

`git reset --hard db64c9a` (Stand nach 27d) oder `ae82417` (nach 27a) oder Tag
`stabil-vor-mc-design-2026-07-16` = `676b02b` (vor allem Design). Sonst:
Vercel -> altes Deployment -> Promote to Production.

---

## Ready-to-paste Opener: Session 27e (Flug + Google-Karte, Rest von 27c)

```
Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT setze ich hier ein: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
Dann: ln -sfn <repo-pfad> /home/claude/repo (rendertest.mjs/smoke*.mjs
schreiben dorthin, sonst laufen sie nicht).

STAND, WICHTIG: es haengt eine KETTE, nichts davon ist auf main.
main -> 27a (ae82417) -> 27d (db64c9a) -> 27c (6d5bac6, Branch
fix/session-27c-karte). Basis fuer dich ist 6d5bac6, ausser ich sage was
anderes. Falls ich inzwischen gemergt habe: main = <HIER main NACH den Merges>.
Classic ist seit Session 19 bis 24 komplett raus, Mission Control ist die
einzige Leitstellen-Oberflaeche.

Auf MC-Design sind: RideForm, AssignModal, WhatsAppModal, RideHistory (27a),
TimelineView, BoardMiniMap, NoGpsSharingPanel, DriverRow (27d),
MapTab, MapFilters, MapLegend, DriverDetailsPanel (27c).
Dazu Modal und Field mit optionaler mc-Prop, Konstante mcInp.

RUECKWEG: Tag stabil-vor-mc-design-2026-07-16 = Branch backup/vor-mc-design
= 676b02b (Stand VOR allem Design). Sonst: Vercel -> altes Deployment ->
Promote to Production.

Danach UEBERGABE-Session-18.md lesen, KOMPLETT, vor allem "SESSION 27a: DIE
FALLE", "SESSION 27a: ERLEDIGT", "SESSION 27d: ERLEDIGT", "SESSION 27c:
TEILWEISE ERLEDIGT" und diesen Opener. Die Datei waechst nach UNTEN an.
Anker auf 6d5bac6, per grep gegenpruefen.

AUFTRAG 27e: FlightTab (5375) und LiveGoogleMap (6971) auf MC-Design.

FANG MIT DER ANALYSE AN, NICHT MIT CODE. FlightTab ist der heikelste Rest,
nicht der einfachste: flightStyle und FLIGHT_STATUS sind TABU, die haengen
auch im Fahrer-Pfad. Das ist dieselbe Lage wie Modal/Field/inp in 27a. Leg mir
die Optionen mit Beweislast vor (optionaler mc-Schalter bei der Funktion /
zweite Konstante daneben wie mcInp / gar nicht anfassen), dann entscheide ich.
KEIN zweiter Fork, wir haben sechs Sessions lang Forks rausgeworfen.

LiveGoogleMap ist klein (127 Zeilen, 3 Classic-Farbklassen) und haengt nur an
MapTab. Achtung: rendert nur nach Umschalten auf "Google Maps" und braucht die
geladene Google-API. Ein Render-Test sieht davon fast nichts, sag mir was ich
am Geraet anschauen muss.

REGELN, aus 27a, 27d und 27c teuer gelernt:
- Erreichbarkeit IMMER transitiv messen (rg.mjs), KONSTANTEN mitsammeln.
- rg.mjs kennt nur Top-Level-Namen: bei jedem Treffer im Quelltext nachsehen,
  ob der Name LOKAL neu gebunden wird (Row in TimelineView shadowt die
  Top-Level-Row) und ob es ueberhaupt eine Komponente ist (Gauge ist ein Icon).
- BAUSTEIN-EBENE UND RENDERPFAD-EBENE SIND ZWEI ZAHLEN. In 27c hatte MapTab
  selbst 0 Classic-Farbklassen und rendert trotzdem 27, weil die Kinder
  Classic waren. Nur die zweite Zahl sehe ich. Immer den ganzen Pfad smoken.
  Wenn dabei Inseln auffallen, die nicht im Auftrag stehen: sag es mir, bevor
  du baust, ich entscheide dann.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
  Brauchst du es: optionale mc-Prop wie bei Modal/Field, plus Render-Test
  vorher/nachher, ZEICHENIDENTISCH. Ohne den Beleg nicht auf main.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter. Layout/Groesse bleibt Tailwind, nur Farbe/Flaeche
  wird MC-Token. Dann verschiebt sich nichts.
- UEBERSETZ 1:1, erfinde keine neue Optik. Farbige Zustaende bleiben farbig
  (Live gruen, Simulation orange, Anrufen gruen, aktiver Filter orange).
- KEIN neues CSS in MissionStyles. Vorhandene Klassen: .mc-panel, .mc-input,
  .mc-btn-primary, .mc-btn-assign, .mc-badge, .mc-eyebrow, .mc-iconbtn,
  .mc-modal-fade, .mc-ride-card, .mc-metric, .mc-live-dot, .mc-tl-block.
- Inline background: die Regel ist NICHT "nie", sondern "nie auf einer Klasse,
  deren :hover den background aendert". .mc-ride-card -> tabu (hover aendert
  background). .mc-btn-primary -> geht (hover ist opacity).
- Gibt es fuer eine Sache schon ein MC-Muster, kopier das statt neu zu erfinden
  (Van/Car-Chip aus AssignModal, Balkenfarbe aus MissionTimelinePage ueber
  mcRideStatusKey + var(--mc-st-${k}-fill), Segmentumschalter aus MapTab).
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Cyberpunk,
  kein Neon, keine uebertriebenen Animationen.
- SettingsTab NICHT anfassen, das ist 27b. STATUS_STYLE und MapIcon bleiben
  tabu. Die Karte selbst (SchematicMap und Marker) hat 0 Classic-Farben, war
  nie das Problem, nicht anfassen.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm,
  Stage bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema,
  eigenes Projekt nach dem Festival.

BELEGE, die ich sehen will. Die Skripte liegen im Repo, benutz die:
- pruefe.mjs: genau die umgebauten Bausteine geaendert, ALLES andere
  byte-identisch, insbesondere DriverApp, StageApp, GuestApp, IssueModal,
  StageIssueModal, GuestIssueModal, MissionStyles, inp, Field, SettingsTab,
  MapIcon, STATUS_STYLE, flightStyle, FLIGHT_STATUS.
- rendertest.mjs, Sollwerte konstant: App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
- smoke27c.mjs / smoke27d.mjs als Vorlage fuer einen eigenen 27e-Smoke: jeder
  umgebaute Pfad muss echt rendern und Classic-Farbreste 0 zeigen. Deck BEIDE
  Zustaende ab, wo es welche gibt, und rendere alles, was hinter einer Auswahl
  sitzt, direkt (so wie smoke27c es mit DriverDetailsPanel macht).
- rg.mjs: transitiver Rendergraph inkl. Konstanten.
- Jede var(--mc-*) einzeln gegen MissionStyles (macht pruefe.mjs mit).
  --mc-st-new-soft steht auf einer GETEILTEN Zeile, zeilenweiser Grep findet
  sie nicht.
- TOGGLE-FALLE: ein Render-Test sieht nur den STARTZUSTAND. Alles hinter
  Toggle/Tab/Akkordeon/Auswahl rendert im Test nicht und ist NICHT belegt.
  Dann per Quelltext pruefen und mir sagen, was ein Mensch anschauen muss.
- esbuild ist kein Beweis (Session 23, 24, 27a je mit Gegenprobe belegt).
- git diff --stat luegt bei aehnlichen Bloecken, --patience nutzen.

Branch: fix/session-27e-flug von der genannten Basis. Nach meinem OK FF-Merge.
Commit ueber /tmp/msg.txt, nach JEDER fertigen Scheibe committen und pushen,
damit ein Chat-Absturz nichts kostet. Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich rechtzeitig, wenn der Chat zu
lang wird.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
Uebergabe fortschreiben, Opener fuer die naechste Session.

ZEITFENSTER: bis Freitagabend 17.07. darf gebaut werden. Ab Samstag 18.07. ist
Ruhe, dann teste ich mit mehreren Fahrern. Was am Festival laufen soll, muss
VOR dem Test drin sein. Ab 21.07. wird nichts mehr geloescht.
Festival 23. bis 27.07.
```

### Noch offen nach 27c

- **FF-Merges, Reihenfolge zwingend: 27a -> 27d -> 27c.**
- **27e: `FlightTab` + `LiveGoogleMap`** (Opener oben).
- **27b: `SettingsTab` (7263), 301 Zeilen.** `Field`/`inp`-Schalter liegt seit
  27a bereit: `mc` setzen, `inp` -> `mcInp`. Wird einmal eingerichtet und nie
  wieder angefasst, lohnt vor dem Festival kaum.
- `ChatPanel` (3579) nach Bedarf.
- **Inhalt, nicht Design:** `RideHistory` zeigt `e.by` roh (`"dispo:1"`) statt
  ueber `byLabel(setup, e.by)`. Braucht `setup` als Prop. Nach dem Festival.

---

# SESSION 27a-2/3: Orange zurueck + Lesbarkeit (16.07., Jordans Korrektur)

**Jordans Hauptsache, gilt ab jetzt fuer alles:** es soll am Ende **richtig gut
aussehen und richtig gut lesbar** sein. Das schlaegt Paketgrenzen-Puristik.

## Was passiert ist

Nach 27a war die Leitstelle weiss/blau (Designsystem-Default). Jordan wollte
sein Orange zurueck, auch bei "beste Wahl". Umgesetzt:

- **Neue Tokens:** `--mc-brand` (#ea580c), `-soft`, `-hover`, `-on`.
  **Bewusst ein anderer Ton als `--mc-st-assigned` (#f5a524).**
- **Umgefaerbt wurde die REGEL, nicht die Aufrufstellen:** `.mc-btn-primary`,
  `.mc-input:focus`, `--mc-focus`. Neu: `.mc-badge--brand`.
- **Radius groesser als 27a, mit Absicht:** `.mc-btn-primary` haengt auch am
  "Neue Fahrt" der Shell (8154, 8171) und am "Verschieben" der Timeline (6336),
  `.mc-input` am Suchfeld des Boards. Die sind jetzt mit orange. **Ein eigenes
  `.mc-btn-brand` nur fuer die Dialoge waere falsch gewesen:** weisser
  "Neue Fahrt" vor orangem "Speichern" im Dialog dahinter sieht aus wie ein Bug.
  Der Code dieser Komponenten ist unveraendert, nur die CSS-Regel.

## Farbbedeutungen, ab jetzt verbindlich

| Farbe | Token | Bedeutung |
|---|---|---|
| Orange | `--mc-brand` | Marke, Hauptaktion, Fokus, beste Wahl |
| Amber | `--mc-st-assigned` | Status "zugeteilt" **und** Warnungen ("knapp") |
| Blau | `--mc-st-new` | Status "neu" |
| Rot | `--mc-st-problem` | Problem |

"Beste Wahl" ist Orange, "knapp" bleibt Amber. **Zwei Toene, nicht einer** -
sonst heisst Orange in einer Liste wieder vier Dinge (das war das
Classic-Problem und der Grund, warum ich zuerst Blau vorgeschlagen hatte).

## Lesbarkeit: der Befund, den keiner gesucht hat

`--mc-text-muted` war **#616d7c = 3.47 Kontrast** auf Panel. **AA braucht 4.5.**
Daran haengen **ueber 80 Textstellen**: Uhrzeiten, Log-Zeilen, Hinweise,
Fahrzeit-Angabe. Also genau das Kleingedruckte fuer nachts um drei.

Jetzt **#828d9c = 5.43**. Nicht #7c8797 nehmen, das ist exakt `--mc-st-idle`.
**Alle zehn Textfarben bestehen jetzt AA.**

`kontrast.mjs` rechnet das nach. **Es hatte die Werte erst hartcodiert und hat
nach dem Fix weiter 3.47 gemeldet** - ein Pruefskript mit eingefrorenen Werten
luegt nach der ersten Aenderung. Liest jetzt live aus `MissionStyles`,
Gegenprobe: alte Datei -> "ZU WENIG", neue -> "ok".

## Flug-Block entblaut

Die Flaeche war `--mc-st-new-soft` (**30 Prozent Deckkraft**) plus voller blauer
Rahmen. Hat lauter geschrien als der Speichern-Knopf. Jetzt `--mc-inset` /
`--mc-border`, nur die Ueberschrift blau. **Merke: die `-soft`-Toene sind fuer
Badges gedacht, flaechig auf einem Panel sind sie zu laut.**

## Stand nach 27a komplett

Geaendert: `Modal`, `Field`, `LocSelect`, `RideForm`, `RideHistory`,
`AssignModal`, `WhatsAppModal`, `MissionStyles`. Neu: `mcInp`.
Fahrer/Stage/Gast/Login zeichenidentisch ueber alle Commits.

## Was noch aussteht (frisch gemessen auf d4eace1)

| Paket | Komponenten | Zeilen | Classic-Treffer |
|---|---|---|---|
| **27d** | TimelineView 78, BoardMiniMap 46, NoGpsSharingPanel 27, DriverRow 25 | **176** | 27/13/10/15 |
| ChatPanel | 105 | **105** | 34 |
| 27c | FlightTab 162, MapTab 127, LiveGoogleMap 127 | **416** | 45/36/4 |
| 27b | SettingsTab 301 | **301** | 86 |

**998 Zeilen, 9 Komponenten, alle null MC-Tokens.**

## JORDANS ENTSCHEIDUNG 16.07.: ALLES, bis zum Ende

Ich hatte empfohlen, `SettingsTab` nach dem Festival zu schieben. **Jordan hat
das kassiert:** "nichts Halbes und nichts Ganzes" will er nicht, er will ein
sauberes Design und zieht es durch. **Damit ist 27b drin, nicht vertagt.**
Diese Empfehlung ist hinfaellig, nicht wieder aufwaermen.

**Reihenfolge (nach Sichtbarkeit und Risiko sortiert):**

1. **27d** (176) - die Inseln mitten in den MC-Seiten. Hoechste Sichtbarkeit.
2. **27c** (416) - FlightTab, MapTab, LiveGoogleMap.
3. **27b + ChatPanel** (406) - der Rest.

Je ein frischer Chat. Alles muss **vor Samstag 18.07.** rein, weil Jordan dann
mit mehreren Fahrern testet und der getestete Stand der Festival-Stand ist.

## WO DAS RISIKO WIRKLICH SITZT (nicht in den Zeilenzahlen)

Bis 27a war alles harmlos: Dialoge ohne Eigenleben. Ab jetzt nicht mehr.

- **`TimelineView` (27d) hat Drag-and-Drop** mit Bestaetigungs-Popover,
  Ruecknahme-Hinweis und Jetzt-Linie. Da haengt Inline-`style` an
  `left`/`width`/`opacity` und **traegt echte Positionslogik, kein Design.**
  Wer dort `style` anfasst, muss vorher wissen, ob der Wert berechnet ist.
  `.mc-tl-block` hat ausserdem eine Animation, die auf die Drag-Opacity (0.25)
  Ruecksicht nimmt (siehe Kommentar bei `mc-entry-in`).
- **`MapTab` / `LiveGoogleMap` (27c)** rendern eine echte Google-Karte.
  Ein `render`-Test sieht davon nichts. Nur der Rahmen ist Classic, die Karte
  drin ist schon MC (`SchematicComponent={MissionSchematicMap}`).
- **`SettingsTab` (27b) haengt an `Field`/`inp`.** Der Schalter ist seit 27a
  da: `mc` setzen, `inp` durch `mcInp` ersetzen. Handwerklich leicht, aber
  301 Zeilen und **jede Menge Schreibwege** (PINs, Orte, Matrix, Zonen,
  Gast-Tokens). NUR className, sonst nichts.
- **Alles drei hat Zustaende hinter Toggles/Tabs**, die ein Render-Test NICHT
  sieht (die 27a-Falle). Dort zusaetzlich per Quelltext pruefen und Jordan
  sagen, was ein Mensch anschauen muss.

**Halb umgebaut ist schlechter als beide Endzustaende.** Deshalb wird es
durchgezogen. Aber: wenn eine Scheibe nicht sauber belegbar ist, lieber DIESE
Scheibe zurueckhalten als sie ungeprueft mitnehmen.

---

# SESSION 27-MERGE + 27b-2 (16.07.), main = `a4560d3` -> Branch `fix/session-27b-chatpanel` = `2013746`

## ⚠ DIE FALLE DIESER SESSION: die Historie war gegabelt, main war leer

Beim Start stand `main` auf `28f005b` (8883 Zeilen, nur Doku). **Von 27a war
NICHTS gemergt.** Schlimmer: die Historie hatte sich bei `ae82417` gegabelt und
niemand hat es gemerkt, weil beide Aeste in derselben Stunde entstanden sind.

```
ae82417  05:59  "Opener fuer Session 27d"
  |\
  | \___ 480fe00 06:51  27a-2 Markenorange
  |      d4eace1 06:56  27a-3 AA + Flug-Block
  |      59dec44 07:03  Opener      -> fix/session-27a-modals
  |
  \____ ef15db5 06:15  27d, die vier Inseln
        757fd92 06:16  "27d erledigt"   -> fix/session-27d-inseln
        0931dee 06:24  MapTab-Rahmen
        b009329 06:37  MapFilters/MapLegend/DriverDetailsPanel (27c)
        4e7e8f7 06:39  Opener 27e       -> fix/session-27c-karte
```

**27d und 27c waren um 06:39 fertig. Der 27a-2/3-Ast wusste das nicht** und hat
um 07:03 einen Opener geschrieben, der 27d nochmal beauftragt. Wer diesem Opener
gefolgt waere, haette 27d ein zweites Mal gebaut.

**Lehre, ab jetzt Pflicht am Sessionstart:** `git log --graph --oneline --all`
UND `git rev-list --left-right --count main...origin/<branch>` fuer JEDEN
offenen Branch, bevor irgendwas gebaut wird. Dem Opener nicht glauben, was den
Stand von main angeht. Der Opener ist eine Absicht, kein Messwert.

## Der Merge

Beide Aeste fassen verschiedene Bausteine an (27a-2/3 sitzt in AssignModal 3788,
RideForm 4027, MissionStyles 8563+; 27d/27c in TimelineView, BoardMiniMap,
NoGpsSharingPanel, DriverRow, MapTab). `src/ShuttleLeitstelle.jsx` merged
**automatisch**, einziger Konflikt war `UEBERGABE-Session-18.md`, weil beide
unten angehaengt haben. Von Hand chronologisch sortiert: 27d, 27c, dann 27a-2/3.

`main` = `a4560d3`, 8954 Zeilen. Alle Belege gruen, Sollwerte unveraendert.

## 27b-2: ChatPanel ist auf MC

Erreichbarkeit frisch gemessen, **nicht der Tabelle geglaubt**:

| Ziel | von MissionControl | von Fahrer/Stage/Gast |
|---|---|---|
| `ChatPanel` (3579) | ja | **nein** |
| `LiveGoogleMap` | ja | **nein** |
| `SettingsTab` | ja | **nein**, aber Kind `inp` ist TABU |
| `FlightTab` | ja | nein, aber Kinder `flightStyle` + `FLIGHT_STATUS` sind TABU |

`ChatPanel`s einzige Kinder sind Lucide-Icons und zwei Logik-Funktionen. Kein
Schalter noetig.

**Zwei neue Klassen in MissionStyles**, beide neue Namen, Reichweite gemessen,
treffen sonst nichts:
- `.mc-fab` (8745), 1 Verwendung. Eigene Klasse, weil `.mc-btn-primary` den
  Radius auf `var(--mc-r)` setzt und `rounded-full` damit plattgemacht haette.
- `.mc-btn-quiet` (8756), 2 Verwendungen. Basis `--mc-hover`, damit er sich auf
  `--mc-panel-raised` noch absetzt (auf `--mc-panel-raised` waere er unsichtbar).

`.mc-btn-primary` selbst wurde NICHT angefasst, obwohl ChatPanel es benutzt.

**Farben nach der 27a-Festlegung:** Bestaetigen Emerald -> Orange (Hauptaktion),
Uebernommen bleibt gruen als `--mc-st-done` (Status erledigt), Speicherfehler
`--mc-st-problem`, "Assistent nicht erreichbar" `--mc-st-assigned` (Warnung,
kein Datenproblem).

## ⚠ OFFENER LESBARKEITS-BEFUND, Jordan weiss davon, NICHT heimlich fixen

**Die User-Blase im Chat hat 3.56 Kontrast** (weiss auf `--mc-brand`). Das ist
unter AA (4.5) fuer normalen Text bei `text-sm`. **Kein Regress:** Classic hatte
mit `bg-orange-600 text-white` exakt denselben Wert. Es ist derselbe Wert wie
`.mc-btn-primary` ("brand-on auf brand 3.56"), den `kontrast.mjs` als ok fuehrt,
weil Knopf-Beschriftungen kurz und fett sind. Eine Chat-Blase mit einem Satz
Fliesstext bei 14px ist etwas anderes.

Entschaerft dadurch, dass in der User-Blase steht, **was Jordan selbst getippt
hat**. Die Antwort des Assistenten steht auf `--mc-panel-raised` mit 14.42.

Drei Wege, falls Jordan es angeht: so lassen; User-Blase auf `--mc-brand-soft`
+ `--mc-text` (deutlicher Optik-Wechsel); oder ein eigener, dunklerer
Blasen-Ton. **Jordans Entscheidung, nicht meine.**

## Belege 27b-2 (alle reproduzierbar)

- `pruefe.mjs`: genau ZWEI Bausteine geaendert (`ChatPanel`, `MissionStyles`),
  0 neu, 0 entfernt, **285 von 287 byte-identisch**. `DriverApp`, `StageApp`,
  `GuestApp`, `IssueModal`, `StageIssueModal`, `GuestIssueModal`, `Field`,
  `inp`, `SettingsTab` unveraendert.
- `pruefe.mjs` var-Check: keine undefinierte `var(--mc-*)`.
- `rendertest.mjs`: alle fuenf Sollwerte unveraendert.
- `kontrast.mjs`: 19 Kombis, 0 Fehler.
- **`smoke27b.mjs` (neu)**: sieben Zustaende, alle rendern echt, Classic-Reste
  0. **Umgeht die Toggle-Falle**: baut eine Wegwerf-Kopie, in der fuer
  ChatPanel `open=false -> true` gesetzt und die Nachrichtenliste geseedet wird
  (alle vier `resolved`-Zustaende + busy + err). Das Original wird nicht
  angefasst. **Dieses Muster ist die Antwort auf die Toggle-Falle und sollte
  fuer FlightTab/LiveGoogleMap/SettingsTab kopiert werden.**
- Neue Kontrast-Kombis einzeln gerechnet: Verwerfen-Text 6.40, Verwerfen-Hover
  12.08, Assistenten-Blase 14.42, Aktions-Zusammenfassung 6.85, Uebernommen
  8.98, Fehler 5.91, Assistenten-Warnung 8.96, Kopf-Icon 5.14. **Alle AA ausser
  der User-Blase (3.56), siehe oben.**

## Was ein MENSCH ansehen muss (der Render-Test kann das nicht)

1. Runder Chat-Knopf unten rechts: Position auf dem iPhone ueber der Mobil-Leiste
   (`--mc-fab-lift`), Hover-Ton am Desktop.
2. Panel-Einblendung: `.mc-panel` bringt `mc-panel-in` mit, das Panel fadet jetzt
   beim Oeffnen ein. Vorher war es sofort da. **Falls das stoert: `mc-panel` raus,
   Rahmen per Style. Sonst nichts.**
3. Der Chat-FAB ueberlappt weiterhin die MC-Handy-Leiste (bekannter Punkt seit
   S24, NICHT in dieser Session angefasst).

## Regressionsrisiken 27b-2

1. **Nur Optik.** Keine Handler, keine Props, keine Signatur, keine Feldlogik.
   `send`, `confirmAction`, `dismissAction`, `askChatAssistant`,
   `applyChatAction` sind byte-identisch.
2. `.mc-*` greift nur unter `.mc-scope`. ChatPanel wird bei 8456 gerendert,
   innerhalb des `.mc-scope`-Div ab 7963. Belegt, `fixed` aendert daran nichts,
   CSS-Scope geht ueber die DOM-Verwandtschaft, nicht ueber die Optik.
3. Die zwei neuen Klassen haben neue Namen. Reichweite gemessen: `.mc-fab` 1
   Verwendung, `.mc-btn-quiet` 2, beide nur in ChatPanel.
4. Kein Schema-Re-Run.

## NOCH OFFEN im Design (Stand 16.07., nach 27b-2)

| Rest | Zeilen | Lage |
|---|---|---|
| `SettingsTab` | 301 | Kind `inp` ist TABU -> `mcInp` tauschen, `Field mc`. Dazu sieben eigene Unterabschnitte (`AccessPinsSection`, `AuditLogSection`, `DispatcherUsers`, `DriverPhones`, `GuestLinksSection`, `PushSettingsSection`, `ReportSection`), die vorher EINZELN gemessen werden muessen. **Ist groesser als 301 Zeilen.** Eigener Chat. |
| `FlightTab` | 162 | `flightStyle` + `FLIGHT_STATUS` sind TABU (Fahrer-Pfad). Gleiche Lage wie `Modal`/`inp` in 27a: optionaler `mc`-Schalter bzw. zweite Konstante, KEIN Fork. Eigener Chat. |
| `LiveGoogleMap` | 127 | nur an MapTab, Kinder alles Logik. Klein, aber rendert nur hinter dem "Google Maps"-Umschalter UND mit geladener Google-API. Braucht das `smoke27b`-Muster plus ein Menschenauge. |

---

# Session 27e (16.07.2026): FlightTab + LiveGoogleMap auf MC

Branch `fix/session-27e-flug`, Commit `cb2b33c`, Basis `main` = `95908d6`.
Datei 8978 -> 9031 Zeilen, Diff 92 Einfuegungen / 39 Loeschungen.

## Schritt 0, gemessen statt geglaubt

Kein Branch war "ahead" von `main`. Der FF-Merge von `fix/session-27b-chatpanel`
war gemacht, `main` = `95908d6` (ein Doku-Commit ueber `1f4b24d`), 8978 Zeilen,
Baseline-esbuild gruen, `rendertest.mjs` exakt auf allen fuenf Sollwerten.
Die Gabelung aus dem Vormittag ist zusammengefuehrt und geblieben.

## Was gebaut wurde

**FlightTab** (Kopf, Leerzustand, Fahrtzeilen) und **LiveGoogleMap** (alle vier
Zustaende, Marker-Farben) auf die MC-Tokens. Nur className/Style, keine Handler,
keine Feldlogik, keine Props.

Drei Bausteine geaendert: `ALERT_ROW`, `FlightTab`, `LiveGoogleMap`.
Drei neu: `MC_FLIGHT_TONE`, `mcFlightStyle`, `GMAP_COLORS`.
284 von 287 Bausteinen byte-identisch.

## Die zwei Tabu-Kinder: dritter Weg, sauberer als die anderen zwei

`flightStyle` und `FLIGHT_STATUS` sind vom Fahrer-Pfad erreichbar
(`DriverApp > flightStyle`, `StageApp > stageTrafficLight > flightAlert >
flightStyle`) und damit tabu. Gewaehlt wurde **die zweite Konstante daneben**,
fuer BEIDE:

    const MC_FLIGHT_TONE = { "": "idle", geplant: "new", verspätet: "assigned",
                             gelandet: "done", annulliert: "problem" };
    const mcFlightStyle = (k) => ({ color: `var(--mc-st-${...})`,
                                    background: `var(--mc-st-${...}-soft)` });

Muster wie `mcInp` neben `inp`. Ein `mc`-Schalter in `flightStyle` waere auch
gegangen, aber die zweite Konstante ist billiger zu beweisen: `flightStyle` und
`FLIGHT_STATUS` sind **byte-identisch**, damit ist der Fahrer-Pfad nicht per
Render-Vergleich, sondern per Pruefsumme unberuehrt. `FLIGHT_STATUS` liefert
weiter Labels und Reihenfolge (Text, kein Style), nur die Farben kommen aus der
neuen Tabelle. Kein Fork.

## Eine Farbbedeutung hat sich geaendert, bewusst

**"verspaetet" ist jetzt Amber (Warnung) statt Rot.** Grund: `flightAlert()`
fuehrt "verspaetet" seit jeher als level `warn`, und `ALERT_ROW` zieht dafuer
den amberfarbenen Rand. Classic zeigte im selben Zeilenblock links einen amber
Rand und daneben ein rotes Feld, also zwei Aussagen zum selben Zustand. Rot
bleibt jetzt dem echten Problem: annulliert und "gelandet, kein Fahrer".

`ALERT_ROW` (nur von FlightTab genutzt, gemessen) ist von className-Strings auf
Style-Objekte umgestellt, Rand 3px statt 2px, damit er zum Rand der Fall-Karten
in `MissionEmergencyTab` passt.

## GMAP_COLORS: warum Hex und nicht var()

Google zeichnet seine Marker auf ein Canvas und versteht keine CSS-Variablen.
`GMAP_COLORS` haelt deshalb vier echte Hex-Werte, die 1:1 die Tokens sind:
Van = `--mc-st-assigned`, Car = `--mc-st-new` (dieselbe Zuordnung wie in
`AssignModal` und `DriverDetailsPanel`), Ort = `--mc-st-idle`, Kontur =
`--mc-bg`. **Diese Kopplung ist per Hand gebaut und wuerde stumm auseinander-
laufen**, wenn jemand ein Token aendert. Deshalb prueft `smoke27e.mjs` die vier
Werte LIVE gegen `MissionStyles`, statt sie zu wiederholen.

## Belege

- esbuild gruen, keine doppelten Funktionsnamen.
- `pruefe.mjs`: GEAENDERT nur `ALERT_ROW`, `FlightTab`, `LiveGoogleMap`.
  `DriverApp`, `StageApp`, `GuestApp`, `IssueModal`, `StageIssueModal`,
  `GuestIssueModal`, `MissionStyles`, `Field`, `inp`, `SettingsTab`, `LocSelect`
  unveraendert. Zusaetzlich per AST gegengeprueft und byte-identisch:
  `flightStyle`, `FLIGHT_STATUS`, `flightAlert`, `flightDelayed`,
  `needsDispatcherFlightAlert`, `getFlightStatus`, `MapTab`, `SchematicMap`,
  `MapLegend`, `DriverDetailsPanel`, `driverInfoWindowHtml`, `MissionControl`,
  `RideForm`, `waDriverText`, `stageTrafficLight`.
- `pruefe.mjs` var-Check: keine undefinierte `var(--mc-*)`.
- `rendertest.mjs`: alle fuenf Sollwerte unveraendert (App-Root 25053,
  IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895, Field 101).
- `kontrast.mjs`: 19 Kombis, 0 Fehler (MissionStyles nicht angefasst).
- `smoke.mjs`, `smoke27b.mjs`, `smoke27c.mjs`, `smoke27d.mjs`: alle gruen.
- **`smoke27e.mjs` (neu)**: 13 FlightTab-Zustaende + 4 LiveGoogleMap-Zustaende,
  alle rendern echt, Classic-Reste 0. Kopiert das `smoke27b`-Muster
  (Wegwerf-Kopie, `busy`/`note`/`status`/`errorMsg` aus `globalThis` geseedet).
  Dazu die GMAP_COLORS-Kopplungspruefung.
- Neue Kontrast-Kombis einzeln gerechnet: option-Text auf panel-raised 14.42,
  Marker-Initialen auf Van 9.59, auf Car 6.17 (Classic: 8.73 / 9.22, beide
  weiterhin weit ueber der 3.0 fuer fetten Text). Orts-Marker gegen Kontur 5.38.
  Alle Status-auf-Panel- und Badge-auf-soft-Kombis kennt `kontrast.mjs` schon.

## Was ein MENSCH ansehen muss (der Render-Test kann das nicht)

1. **Die Google-Karte ueberhaupt.** Karte > oben rechts auf "Google Maps"
   umschalten. Der Render-Test sieht davon nur den leeren Container: alle
   Marker entstehen im `useEffect` auf Googles Canvas, im SSR-HTML steht davon
   kein Pixel. Anzusehen: Van-Punkte amber, Car-Punkte blau, Orte grau, die
   Initialen auf den Punkten lesbar, Rand der Karte passt zum Panel dahinter.
2. **Der Ladezustand der Karte.** Der Container hat jetzt eine eigene
   dunkle Flaeche + Rahmen. Vorher war da bis zum Google-Rendern ein leeres
   Rechteck im Browser-Weiss. Beim Umschalten kurz hinsehen, ob es dunkel
   bleibt.
3. **Der `type="time"`-Picker in FlightTab.** Siehe offener Punkt unten.
4. **Das Status-Feld in der Flugzeile.** Die aufgeklappte Liste rendert das
   Betriebssystem, nicht wir. Am Handy und am Desktop einmal aufklappen.
5. **"verspaetet" ist jetzt amber statt rot.** Bewusst, siehe oben. Wenn es
   nicht gefaellt: `MC_FLIGHT_TONE.verspätet` auf `"problem"`, eine Zeile.

## Regressionsrisiken 27e

1. **Nur Optik.** `applyResult`, `updateOne`, `updateAll`, `quickSet`,
   `animateMarkerTo` und die beiden `useEffect` sind unveraendert. Push-Ausloeser
   und Log-Eintraege unberuehrt.
2. **Fahrer/Stage beweisbar unberuehrt**: die einzigen zwei geteilten Bausteine
   (`flightStyle`, `FLIGHT_STATUS`) sind byte-identisch.
3. **Keine geteilte Klasse angefasst**, `MissionStyles` unveraendert.
   `.mc-btn-primary` und `.mc-iconbtn` werden nur BENUTZT, nicht geaendert.
4. `ALERT_ROW` liefert jetzt Objekte statt Strings. Wer es sonst noch nutzen
   wuerde, bekaeme `className={[object Object]}`. Gemessen: nur FlightTab.
5. Der `RefreshCw`-Knopf in der Zeile ist bewusst KEIN `IconButton`: die
   Komponente reicht keine Klasse ans Icon durch, das Rad soll beim Abfragen
   aber weiter drehen. Gleiche Klasse `.mc-iconbtn`, gleiche Optik.
6. Kein Schema-Re-Run.

## Manuelle Testfaelle 27e

**Leitstelle > Flug**
1. Tag ohne Flughafen-Fahrten waehlen -> Leerzustand mit Flugzeug-Symbol.
2. Fahrt mit Flugnummer, Status leer -> graues Feld "unbekannt".
3. Status auf "geplant" -> blau. Auf "verspaetet" -> amber + amber Rand links +
   Live-Zeit amber und fett. Auf "gelandet" (ohne Fahrer unterwegs) -> gruenes
   Feld, aber roter Rand links und rote Zeile "gelandet, aber kein Fahrer
   unterwegs". Auf "annulliert" -> rotes Feld + roter Rand.
4. Nach jeder Statusaenderung: Badge "manuell" erscheint, daneben der
   "auto"-Knopf. "auto" klicken -> Badge weg.
5. "Alle Flüge aktualisieren" -> Rad dreht, danach Meldung "Automatik nicht
   verfuegbar" (ohne Provider) oder "n aktualisiert". Zweiter Klick innerhalb
   der Abklingzeit -> "Alle Fluege noch frisch".
6. Einzelnes Rad in einer Zeile klicken -> dreht, danach Meldung rechts.
7. Terminal tippen und Uhrzeit setzen -> Wert bleibt stehen, Zeile wird
   "manuell".
8. Pfeil rechts -> Fahrt-Dialog oeffnet sich mit der richtigen Fahrt.

**Leitstelle > Karte**
9. Auf "Google Maps" umschalten (ohne Key) -> Hinweis mit Karten-Symbol,
   Text ueber `VITE_GOOGLE_MAPS_API_KEY`, Schema-Karte weiter erreichbar.
10. Mit Key: Karte laedt, Fahrer mit frischer GPS-Freigabe als amber (Van) /
    blaue (Car) Punkte mit Initialen, Orte als graue Punkte. Auf einen Punkt
    tippen -> weisses Info-Fenster mit Name, Fahrzeug, Alter der Position.
11. Zurueck auf "Schema-Karte" -> unveraendert.

**Fahrer / Stage (Gegenprobe, darf sich NICHTS geaendert haben)**
12. Fahrer-App: Fahrt mit Flug oeffnen -> Flug-Block sieht aus wie vorher
    (verspaetet dort weiterhin rot, das ist Classic-Farbe im Fahrer-Design und
    NICHT Thema dieser Session).
13. Stage-App: Ampel bei einer Fahrt mit verspaetetem Flug -> unveraendert.

## Weitere gefundene Punkte fuer spaetere Sessions

1. **`color-scheme: dark` fehlt komplett** (nirgends in `src/` oder
   `index.html`). Folge: der Kalender-/Uhr-Knopf in `type="time"`-Feldern und
   die vom Betriebssystem gezeichneten Auswahllisten kommen im Hellmodus-Look
   auf dunklem Grund. Betrifft FlightTab (zwei Felder pro Zeile) und RideForm.
   **Kein Regress**, Classic hatte exakt dasselbe. Die richtige Stelle waere
   EINE Zeile in `.mc-scope`, aber sie traefe alles darunter (Shell, Timeline,
   Settings, Scrollbars) und ist deshalb hier bewusst nicht angefasst.
   Kandidat fuer nach dem Festival oder eine eigene kleine Session.
2. **Der bekannte 3.56er-Kontrast ist jetzt auch in FlightTab**: der Knopf
   "Alle Flüge aktualisieren" traegt `.mc-btn-primary` (weiss auf
   `--mc-brand`). Kein Regress, dieselbe Kombination wie beim Speichern-Knopf
   und der User-Blase im Chat. Nicht eigenmaechtig geaendert, wie besprochen.
3. `MissionControl` referenziert `flightStyle` direkt (gemessen). Ausserhalb
   dieses Auftrags, nicht angefasst. Vor der naechsten Flug-Session kurz
   ansehen, ob dort noch eine Classic-Farbe am Flugstatus haengt.

---

# Session 27b (16.07.2026): SettingsTab auf MC-Design, Scheibe 1a + 1b

Branch `fix/session-27b-settings`, zwei Commits, gepusht. Nach Jordans OK
FF-Merge auf main. Datei 9031 -> 9074 Zeilen.

## Schritt 0: Stand gemessen, nicht geglaubt

Der Opener stimmte diesmal exakt. Kein Branch war ahead von main (alle 17
Remote-Branches 0 ahead), `cb2b33c` lag in der Historie, Datei bei 9031 Zeilen,
esbuild gruen, rendertest auf allen fuenf Sollwerten. main-Spitze war `d38d29e`
(Doku-Commit).

## Erreichbarkeit NEU gemessen (nicht der Tabelle im Opener geglaubt)

`rg.mjs` erweitert: Zielliste um die acht 27b-Bausteine, plus ein neuer Modus,
der pro Ziel die transitiv erreichbaren TABU-Kinder auswirft
(`node rg.mjs <datei> SettingsTab DriverPhones ...`).

Ergebnis: alle acht (SettingsTab, DriverPhones, DispatcherUsers,
AccessPinsSection, GuestLinksSection, PushSettingsSection, AuditLogSection,
ReportSection) sind **nur von MissionControl** erreichbar, keiner haengt am
Fahrer-, Stage- oder Gast-Pfad. Tabu-Kinder mit Design-Bezug: genau `inp` und
`Field`, beide wie vorgesehen ueber `mcInp` bzw. `<Field mc>` geloest. Der Rest
im Tabu-Baum ist reine Logik (fmtDate, setRideStatus, sortMin, logRide, travel)
und lucide-Icons.

## Was gebaut wurde

**Scheibe 1a (Commit `a4fc182`): SettingsTab-Rahmen.**
- 13 Panel-Huellen `bg-stone-900/border-stone-800/rounded-xl` -> `.mc-panel`
- alle h3+p-Koepfe auf die Basiskomponente `SectionHeader` (icon+title+subtitle).
  Bewusst NICHT `MissionPanel` mit Kopfzeile: dann haetten die sieben
  Unterbausteine ihren Titel als Prop nach aussen geben muessen, das waere eine
  Prop-Aenderung statt reinem Design. So haben alle 13 Panels denselben Kopf.
- `inp` -> `mcInp`, Matrix-Felder auf `.mc-input`, Buttons auf
  `.mc-btn-primary` / `.mc-btn-quiet` / `.mc-btn-danger`
- X-Knopf bei den Festival-Tagen auf `.mc-iconbtn`, dabei `title`/`aria-label`
  ergaenzt (fehlte komplett, reines Attribut, kein Handler)

**Scheibe 1b (Commit `9cecaa2`): die vier kleinen.** DriverPhones,
DispatcherUsers, AccessPinsSection, PushSettingsSection. Gleiches Muster,
plus: "gespeichert" emerald -> `--mc-st-done`, Fehlerzeile red ->
`--mc-st-problem`, Warnzeile amber -> `--mc-st-assigned`.

**MissionStyles, drei NEUE Klassen. Rein additiv, per `git diff` belegt: keine
einzige bestehende Zeile geaendert, also trifft es keinen anderen Baustein.**
- `.mc-note` / `.mc-note--warn` / `.mc-note--error`: Hinweisboxen der
  Import-Zusammenfassung. **BEWUSST NICHT `--mc-st-*-soft`** (30 Prozent, ist
  Badge-Fuellung und flaechig zu laut, genau der Rueckbau aus 27a-3 am
  Flug-Block). Hier 12 Prozent Flaeche, 28 Prozent Rahmen.
- `.mc-btn-danger`: "Alle Fahrten loeschen", gleiche Zurueckhaltung.

**`ExportIcon` (neu):** duenner Wrapper um `Upload` mit `rotate-180`.
`SectionHeader` rendert das Icon selbst und reicht KEINE Klasse durch, exakt
dieselbe Grenze wie `IconButton` in FlightTab 27e. Ohne den Wrapper waere
`<Upload className="rotate-180" />` dort nie angekommen.

**Van/Car-Badges auf die 27e-Farbregel gezogen** (DriverPhones Z. 4476 und
"Fahrer & Fahrzeuge" Z. 7564): vorher Van = orange-500/20, also die
MARKENfarbe fuer einen Fahrzeugtyp. Jetzt Van = Amber, Car = Blau, identisch
zu AssignModal Z. 3827. Das war ein echter Regelbruch im Bestand.

## Belege

- `pruefe.mjs`: GEAENDERT **genau** DriverPhones, DispatcherUsers,
  AccessPinsSection, PushSettingsSection, SettingsTab, MissionStyles. NEU:
  ExportIcon. ENTFERNT: keine. **284 von 290 Bausteinen byte-identisch**,
  darunter DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal,
  GuestIssueModal, `inp`, `Field`, `LocSelect`.
- `rendertest.mjs`: alle fuenf Sollwerte unveraendert (25053 / 2452 / 2413 /
  2895 / 101).
- **`smoke27b-settings.mjs` (neu)**, Muster von smoke27b/27e. Wegwerf-Kopie mit
  geseedeten `wb`/`sheet`/`imp`/`importing`. 11 Toggle-Zustaende x 2 Laeufe:
  Lauf A rendert SettingsTab echt inkl. der noch nicht umgebauten
  Unterbausteine (0 Crashes), Lauf B klammert die sieben Unterbausteine per
  Platzhalter aus und misst damit **genau den Rahmen: 0 Classic-Reste**.
  Abgedeckt: Startzustand, ein Blatt, mehrere Blaetter, Vorschau normal,
  Duplikate, Warnbox noName, Warnbox offDates, Fehlerbox, >8 Fahrten,
  "Importiere…", alles gleichzeitig.
- **`smoke27b-sections.mjs` (neu)**: 15 Zustaende ueber die vier kleinen mit
  geseedetem `saved`/`saveError` (Grundzustand, gespeichert, Speicherfehler,
  Warnhinweis kaputte Nummer, Warnung+Fehler gleichzeitig, leere Nutzerliste,
  Push-Key gesetzt/leer). 0 Fehler, 0 Classic-Reste.
- `var(--mc-*)`-Check: keine undefinierte Variable, alle dynamischen aufgeloest.
- `kontrast.mjs` unveraendert **19 Kombis, 0 Fehler**. Die drei neuen Kombis
  einzeln nachgerechnet (kontrast.mjs kennt sie nicht):
  `.mc-note--warn` **7.30**, `.mc-note--error` **5.36**, `.mc-btn-danger`
  **5.36** (Hover 4.53). Alle ueber AA.
- esbuild gruen, keine doppelten Funktionsnamen, `git diff --patience`.

## Regressionsrisiken

Gering, aber nicht null:
1. **`SectionHeader` rendert `<h2>`, vorher stand dort `<h3>`.** Rein
   semantisch, optisch identisch. Kein Skript prueft das.
2. **Der "Verwerfen"-Knopf im Import hat jetzt eine Flaeche** (`.mc-btn-quiet`
   statt nacktem `text-stone-400`). Bewusst: genau dafuer wurde die Klasse in
   27b-2 gebaut. Er ist damit sichtbarer als vorher.
3. **Der X-Knopf bei den Festival-Tagen hat keinen roten Hover mehr**
   (`.mc-iconbtn` faerbt neutral). Das Loesch-Signal steckt jetzt nur noch im
   Icon. Bewusst, weil `.mc-iconbtn` die Konvention ist. Wenn es dir zu leise
   ist: sag Bescheid, das ist eine Zeile.
4. Der Import-Pfad selbst (`parseSheet`/`doImport`/`rideSig`) ist byte-identisch,
   aber die Vorschau wurde nur simuliert gerendert, nicht mit echtem Excel.

## Manuelle Testfaelle (Leitstelle, Desktop, Mission Control)

1. Einstellungen oeffnen -> alle 13 Bloecke im dunklen MC-Look, jeder mit
   gleichem Kopf (Icon + Titel + grauer Untertitel). Keine braun/stone-Kachel.
2. Echte Excel-Pickup-Liste waehlen -> Vorschau erscheint. Zahlen (neue
   Fahrten / Tage / Fahrer zugeordnet) muessen exakt wie vorher stimmen.
3. Eine Datei mit einem Datum ausserhalb der Festivaltage -> **amber Hinweisbox**
   erscheint, ist gut lesbar und **nicht schreiend**. Genau hier bitte
   draufschauen, das ist die -soft-Falle aus 27a-3.
4. Eine Datei mit einer Zeile ohne Datum -> rote Fehlerbox, gleiche Ruhe.
5. Importieren doppelt klicken -> Knopf sperrt, Text "Importiere…", nur EIN
   Import landet.
6. "Verwerfen" -> Vorschau weg.
7. Festival-Tage: Datum aendern, Tag ueber X entfernen, unten neuen Tag
   hinzufuegen -> Feld leert sich wieder. **Kalender-Knopf sieht hell aus, das
   ist der bekannte `color-scheme`-Punkt, kein neuer Fehler.**
8. Fahrzeit-Matrix: Wert eintippen, wegklicken -> gespeichert, Feld monospace.
9. Fahrer & Fahrzeuge: **Van-Badges amber, Car-Badges blau**, nicht orange.
10. Fahrer-Telefonnummern: Nummer aendern -> "Speichern" wird aktiv -> gruenes
    "gespeichert". Bei einem Fahrer Buchstaben eintippen -> amber Warnzeile,
    Speichern geht trotzdem.
11. Leitstellen-Nutzer: "Person hinzufuegen" -> Prompt -> Person erscheint.
12. Zugangs-PINs + VAPID-Key: Feldbeschriftungen grau, Felder im MC-Look.
13. "Alle Fahrten loeschen" -> Rueckfrage kommt, Knopf ist rot aber ruhig.
14. **Gegenprobe, dass nichts geleakt ist:** Fahrer-App, Stage-App und
    Gast-Link einmal oeffnen -> unveraendert im alten Look. Problem melden in
    allen drei -> unveraendert.

## Offen fuer die naechsten Scheiben

- **Scheibe 2: GuestLinksSection** (Z. 4578, 125 Zeilen, der dickste Brocken).
  Bewusst NICHT mehr in Session 27b gebaut, der Chat war voll. Toggle-Zustaende,
  die ein Render-Test nicht sieht und die geseedet werden muessen: Link erzeugen,
  Link kopieren (`copyText`), Vorschau, `coordPhone`-Warnung
  (`phoneLooksInvalid`), `hasSupabase` an/aus, leere Tokenliste.
- **Scheibe 3: AuditLogSection + ReportSection** (Z. 4751 und 5983, zusammen
  108 Zeilen). Toggle: Tagesfilter, Log auf/zu, leerer Tag.
- Danach ist `smoke27b-settings.mjs` Lauf A automatisch bei 0 Classic-Resten.
  **Der Rest-Zaehler in Lauf A ist der Fortschrittsbalken: 17 -> 14 nach
  Scheibe 1b -> muss am Ende 0 sein.**

## Weitere gefundene Punkte fuer spaetere Sessions (NICHT heimlich fixen)

4. **Van/Car-Badges haben durch die 27e-Farbregel WENIGER Kontrast als vorher.**
   Gemessen: alt Van 8.96 / Car 9.09 (orange-300 bzw. sky-300 auf 20 Prozent
   ueber stone-950). Neu Van **5.08** / Car **3.84** (Statusfarbe auf
   `-soft` = 30 Prozent). Car liegt damit unter AA, bei `text-[10px]`.
   **Kein Fehler nach der Skript-Regel** (`kontrast.mjs` fuehrt
   `mc-badge--new` mit 3.61 als ok, Badges laufen auf der AA-large-Schwelle)
   und **kein Alleingang von mir**: die Kombination steckt seit 27e identisch
   in AssignModal Z. 3827. Aber der Zahlenwert sinkt an dieser Stelle klar, und
   10px ist klein. Nachgerechnet: eine Absenkung der Badge-Fuellung von 30 auf
   16 Prozent wuerde Van auf 7.15 und Car auf **4.93** heben, also beide ueber
   AA. Das traefe `.mc-badge` global (Board, Rueckfahrten, Timeline) und ist
   deshalb eine eigene Entscheidung, keine Nebensache.
5. **`PROJEKT-ANWEISUNGEN.md` ist hoffnungslos veraltet** und fuehrt jede neue
   Session in die Irre: sie behauptet Stand 15.07., Branch
   `feature/mission-control-beta`, 10638 Zeilen, "Classic bleibt byte-genau
   unveraendert" und "Mission Control NICHT auf main". Alles falsch seit
   Session 19 bis 24. Da jeder Opener mit "Erst PROJEKT-ANWEISUNGEN.md lesen"
   anfaengt, ist das eine echte Falle. In dieser Session nur ein Warnblock
   oben drauf gesetzt (Verweis auf diese Datei), der Rest bewusst nicht
   angefasst, weil ausserhalb des Pakets. Eine kleine eigene Doku-Session
   waere hier gut investiert.

---

# Session 27b Scheibe 2 (16.07.2026): GuestLinksSection auf MC-Design

Branch `fix/session-27b-scheibe2`, abgezweigt von `fix/session-27b-settings`,
ein Code-Commit, gepusht. Nach Jordans OK FF-Merge.
Datei 9074 -> 9076 Zeilen.

> ## ⚠ NACHTRAG 16.07., der Branch wurde REBASET, die alten Hashes sind tot
>
> Diese Session lief **parallel** zu einer zweiten, die denselben Auftrag
> gebaut hat (Jordan hatte im alten Chat versehentlich noch den Merge
> angestossen, waehrend der neue Chat schon losgelegt hatte). Aufgefallen ist
> es erst beim Push, den Git zu Recht abgelehnt hat. **Nichts wurde
> ueberschrieben**, die zweite Fassung lag nur lokal und ist verworfen.
>
> Beide Fassungen waren fast deckungsgleich (gleiches Muster, gleicher
> Farbregel-Befund beim Sicherheitshinweis). Diese hier ist die behaltene.
> Sie wurde von der zweiten Session unabhaengig gegengeprueft und besteht
> auch deren eigenen Smoke-Test (15 Zustaende, 0 Fehler).
>
> **Der urspruengliche FF-Merge ging nicht:** waehrenddessen war `main` auf
> `3e58bba` weitergelaufen (zwei Doku-Commits an `OPENER-Session-27b-2.md`),
> der Branch hing noch an `354000a`, Stand 2/2. Deshalb auf `origin/main`
> rebaset. Beide Seiten fassten verschiedene Dateien an, der Rebase war
> konfliktfrei und hat `src/ShuttleLeitstelle.jsx` **byte-identisch** gelassen
> (Blob `3a78b09` vor und nach dem Rebase). Danach `main...branch` = 0/2,
> FF-Merge wieder moeglich, esbuild/rendertest/pruefe/kontrast erneut gruen.
>
> **Alte Hashes `3dedb46` und `46c86f1` existieren nicht mehr.** Neuer Stand:
> Code `baeb29a`, Doku `600aab2`. Der Vor-Rebase-Stand liegt zur Sicherheit
> auf `backup/scheibe2-vor-rebase` (= `46c86f1`).
>
> **Lehre, unabhaengig vom Versehen:** Zeilenzahl und Blob-Hash sind die
> verlaesslichen Messwerte, Commit-Hashes ueberleben einen Rebase nicht. Und
> vor dem Push nochmal `git fetch` + messen, nicht nur zu Sessionbeginn.

## Schritt 0: Stand gemessen, nicht geglaubt

Der Opener stimmte exakt, aber die Messung war diesmal NICHT ueberfluessig:
`origin/fix/session-27b-settings` war **4 Commits ahead von main**, main lag
noch bei `d38d29e` mit 9031 Zeilen. Jordan hatte also nicht gemergt. Nach der
Regel im Opener deshalb von `fix/session-27b-settings` abgezweigt, nicht von
main. Alle 16 anderen Remote-Branches waren 0 ahead. Auf dem Branch: 9074
Zeilen, `9cecaa2` in der Historie, esbuild gruen, rendertest auf allen fuenf
Sollwerten, kontrast 19/0, smoke27b-settings Lauf A bei 14 Rest-Klassen.

## Erreichbarkeit NEU gemessen

`node rg.mjs src/ShuttleLeitstelle.jsx GuestLinksSection`: nur von
MissionControl erreichbar, kein Fahrer-/Stage-/Gast-Pfad. Tabu-Kinder:
`AlertTriangle, Check, Copy, Field, copyText, hasSupabase, inp`. Davon haben
nur `Field` und `inp` Design-Bezug, beide wie vorgesehen ueber `<Field mc>`
bzw. `mcInp` geloest. Der Rest ist Logik und lucide-Icons.

## Was gebaut wurde

Reines className/Style. Keine Handler, keine Feldlogik, keine Prop-Aenderung.
**`MissionStyles` ist unveraendert geblieben, es war keine neue Klasse noetig.**

- `h3`+`p` -> `SectionHeader` (icon `Link2`), Untertitel als JSX, weil der
  Sicherheitshinweis als `<b>` mittendrin steckt.
- **`orange-300`-Sicherheitshinweis -> `--mc-st-assigned`.** Orange ist laut
  Farbregel die MARKE (Hauptaktion, Fokus), ein Sicherheitshinweis ist eine
  WARNUNG. Derselbe Regelbruch im Bestand wie Van=orange in Scheibe 1b, dieselbe
  Korrektur. Amber ist jetzt identisch zum oddPhones-Hinweis in DriverPhones.
- `saveError`-Box `bg-red-500/10 border-red-500/30 text-red-300` ->
  `.mc-note mc-note--error`. Genau der Fall, fuer den die Klasse in Scheibe 1a
  gebaut wurde: 12 statt 30 Prozent Flaeche, die `-soft`-Falle aus 27a-3.
- `Field` -> `<Field mc>`, `inp` -> `mcInp`.
- Speichern -> `.mc-btn-primary`. Vorschlags-Chips und der "Link"-Knopf ->
  `.mc-btn-quiet` (Zweitknopf, wie "Person hinzufuegen" in DispatcherUsers).
  Die drei Zeilen-Icons -> `.mc-iconbtn w-7 h-7` (kompakte Variante, wie
  Z. 3757/7195).
- `amber-300` -> `--mc-st-assigned`, `emerald-400` "gespeichert" UND der
  Kopiert-Haken -> `--mc-st-done`.
- Tokenzeile `bg-stone-950/50` -> `--mc-inset`, `font-mono` -> `--mc-font-mono`,
  `text-stone-600` -> `--mc-text-muted`, `text-stone-200` -> `--mc-text`.
- `aria-label` an den drei Icon-Knoepfen ergaenzt (fehlte komplett, reines
  Attribut, kein Handler, gleiche Linie wie der X-Knopf in Scheibe 1a).

## Belege

- **`smoke27b-guest.mjs` (neu)**, Muster von smoke27b-sections. Wegwerf-Kopie,
  `coordPhone`/`savedPhone`/`copiedTok`/`saveError`/`tokens` aus `globalThis`
  geseedet, Original unangetastet. **16 Zustaende, 0 Fehler**: Grundzustand,
  `tokens=null` ("Laedt…", der hasSupabase-Zweig), Tokenliste gefuellt,
  Vorschlaege leer, Vorschlag schon vergeben, "gespeichert",
  Kopiert-Bestaetigung, Ladefehler, Speicherfehler bei gefuellter Liste,
  coordPhone kaputt -> Warnung, coordPhone leer -> keine Warnung, Warnung +
  Fehler, Warnung + gespeichert + kopiert, alles gleichzeitig, ohne
  `onPreviewGuest`, >12 Vorschlaege (Cap).
- **GEGENPROBE, und die ist der eigentliche Beweis:** derselbe Test gegen
  `/tmp/alt.jsx` (Vorher-Stand) ist **16 von 16 rot**, mit bis zu 18
  Classic-Klassen pro Zustand. Der Test misst also wirklich etwas und ist nicht
  nur gruen, weil er nichts anschaut.
- **Falle im eigenen Test, fuer die naechste Session:** mein erster
  CLASSIC-Regex hat `font-mono` gesucht und damit `var(--mc-font-mono)`
  getroffen, also 11 Fehlalarme auf dem RICHTIGEN Ergebnis. Jetzt mit
  `(?<![-a-z])font-mono`. Wer den Regex kopiert: aufpassen.
- `pruefe.mjs`: **290 von 291 Bausteinen byte-identisch**, GEAENDERT genau
  `GuestLinksSection`, NEU/ENTFERNT keine. `DriverApp`, `StageApp`, `GuestApp`,
  `IssueModal`, `StageIssueModal`, `GuestIssueModal`, `inp`, `Field`,
  `LocSelect`, `SettingsTab`, `MissionStyles` alle unveraendert.
- `rendertest.mjs`: 25053 / 2452 / 2413 / 2895 / 101, alle unveraendert.
- **`smoke27b-settings.mjs` Lauf A: Rest-Zaehler 14 -> 12** (weg sind
  `orange-3` und `orange-6`). Lauf B bleibt 0. Die verbleibenden 12 stammen
  jetzt nur noch aus AuditLogSection + ReportSection, also Scheibe 3.
- `smoke27b-sections.mjs`: 15 Zustaende, 0 Fehler.
- `kontrast.mjs`: 19 Kombis, 0 Fehler, unveraendert. Die sechs Kombis, die das
  Skript nicht kennt, einzeln nachgerechnet (gleiche Mathematik, Tokens live):
  `--mc-text` auf inset **16.01**, `--mc-text-muted` auf inset **5.70**,
  `--mc-st-done` auf inset **9.97**, `.mc-btn-quiet` **6.40** (Hover 12.08),
  `.mc-iconbtn` Hover **13.49**. Alle ueber AA.
- `var(--mc-*)`-Check: keine undefinierte Variable.
- esbuild gruen, keine doppelten Funktionsnamen, `git diff --patience`
  (26 Zeilen rein, 24 raus, eine einzige Datei).

## Regressionsrisiken

Gering, aber nicht null:

1. **Die drei Icon-Knoepfe haben keinen farbigen Hover mehr.** Vorher
   `hover:text-emerald-400` beim Kopieren und `hover:text-red-400` beim
   Loeschen, jetzt faerbt `.mc-iconbtn` neutral. Dasselbe Thema wie Risiko 3 aus
   Scheibe 1a (X-Knopf bei den Festival-Tagen). Das Loesch-Signal steckt jetzt
   nur noch im Muelltonnen-Icon. Bewusst, weil `.mc-iconbtn` die Konvention ist.
   **Der Kopiert-Haken bleibt gruen** (`--mc-st-done`), die Rueckmeldung nach dem
   Klick ist also unveraendert da. Wenn dir der Loeschen-Hover zu leise ist: eine
   Zeile.
2. **Die Vorschlags-Chips sehen jetzt aus wie der "Link"-Knopf daneben**, beide
   `.mc-btn-quiet`. Vorher waren die Chips `bg-stone-900` mit Rahmen, der Knopf
   `bg-stone-800` ohne. Optisch naeher beieinander als vorher. Beides sind
   Zweitknoepfe, insofern korrekt, aber es ist eine sichtbare Aenderung.
3. **`SectionHeader` rendert `<h2>`, vorher stand dort `<h3>`.** Rein
   semantisch, optisch identisch. Gleiches Risiko wie Scheibe 1a, kein Skript
   prueft es.
4. **Die Fehlerbox ist etwas kompakter**: `.mc-note` bringt `padding: 6px 10px`
   mit, vorher `px-3 py-2` (12/8). Bewusst, weil die Klasse die Konvention ist.
5. Der Token-Pfad selbst (`persist`/`genFor`/`revoke`/`copyLink`/`linkFor`) ist
   byte-identisch. Aber: `copyText` und `loadGuestTokens` laufen im Test NICHT
   (kein Browser, kein `useEffect` bei `renderToStaticMarkup`). Der
   Kopier-Vorgang und das Nachladen im Supabase-Betrieb sind nur simuliert
   gerendert, nicht echt ausgefuehrt. Muss manuell geprueft werden.

## Manuelle Testfaelle (Leitstelle, Desktop, Mission Control)

1. Einstellungen -> Block "Gast-/Artist-Links": Kopf wie alle anderen zwoelf
   (Icon + Titel + grauer Untertitel). **Der Sicherheitshinweis im Untertitel
   ist jetzt amber statt orange** -> soll warnen, nicht schreien. Draufschauen.
2. Coordination-Nummer aendern -> Speichern-Knopf wird aktiv, klicken ->
   gruenes "gespeichert" erscheint und verschwindet nach knapp 2 Sekunden.
3. Ins Nummernfeld `abc` tippen -> **amber Warnzeile** direkt unter dem Feld,
   Speichern bleibt trotzdem moeglich. Feld leeren -> Warnung weg.
4. Einen Vorschlags-Chip (Kuenstlername) klicken -> Link entsteht, der Chip
   verschwindet aus den Vorschlaegen (weil schon vergeben).
5. Kuenstlername von Hand eintippen + Enter -> gleicher Effekt wie "Link".
6. **Link kopieren** -> Icon springt kurz auf einen gruenen Haken. Danach in
   einem privaten Fenster einfuegen -> Gast-Seite oeffnet sich, zeigt nur die
   Fahrten dieses Namens. **Das ist der Test, den kein Skript machen kann.**
7. **Vorschau** (Auge) -> Gast-Ansicht oeffnet sich in der Leitstelle.
8. **Loeschen** (Muelltonne) -> Rueckfrage kommt, nach OK ist der Link weg.
   Danach den alten Link nochmal aufrufen -> darf nicht mehr funktionieren.
9. Tokenliste leer -> "Noch keine Gast-Links erzeugt." in Grau, kein Bruch.
10. Viele Links anlegen (>10) -> Liste scrollt bei `max-h-72`, Layout haelt.
11. **Gegenprobe, dass nichts geleakt ist:** Fahrer-App, Stage-App und
    Gast-Link einmal oeffnen -> unveraendert im alten Look. Problem melden in
    allen drei -> unveraendert.

## Offen fuer die naechste Scheibe

### Der Restplan bis 0 (gemessen am 16.07., nach Scheibe 2)

Vollstaendig gemessen mit Babel-Blockgrenzen + Erreichbarkeitsgraph. **Im
Scope (nur von MissionControl erreichbar) sind noch 4 Bausteine:**

| Baustein | Zeile | Zeilen | Classic | MC | Session |
|---|---|---|---|---|---|
| `MissionControl` (Shell) | 7909 | 620 | 31 | 122 | **28** |
| `PresenceManager` | 5055 | 63 | 30 | 0 | 29 |
| `MissionTimelinePage` | — | 426 | 6 | 75 | 29 |
| `AuditLogSection` | 4753 | 54 | 20 | 0 | 30 |
| `ReportSection` | 5985 | 54 | 32 | 0 | 30 |

`GuestLinksSection` ist bei **0** (der eine Grep-Treffer ist ein Kommentar,
der das Wort nennt, keine Klasse).

Alles andere mit Classic-Resten ist TABU bzw. laut Jordans Regel nicht Thema:
DriverApp 81, StageApp 37, GuestRideCard 31, StageTile 30, MessageComposer 22,
MyMessages 18, GuestApp 12, Login 21, MissionControlFallbackScreen 11.

**Reihenfolge ist bewusst nicht nach Wert sortiert: die Shell zuerst.** Sie ist
das einzige verbleibende Stueck mit echtem Regressionsrisiko, und was dort
schiefgeht, muss VOR dem Fahrertest am 18.07. auffallen. Session 30
(SettingsTab) ist der Streichkandidat, nicht die Shell.

- **Ready-to-paste Opener fuer Session 28 liegt in `OPENER-Session-28.md`.**
- **Ready-to-paste Opener fuer Scheibe 3 (= Session 30) liegt in
  `OPENER-Session-27b-3.md`.** Die Zahlen darin gelten weiter, die
  Zeilennummern nicht, falls Session 28/29 vorher etwas einfuegen.

### Zwei Befunde, die vorher niemand auf dem Zettel hatte

1. **`PresenceManager` stand nie in der Zwoelfer-Planungstabelle** (Z. 343 ff
   dieser Datei). Deshalb haben 27a bis 27e ihn nie angefasst. 63 Zeilen, 30
   Classic-Treffer, **null MC**, komplett unberuehrt. Er haengt in
   `MissionReturnsTab` (Z. 5326) unter "Anwesenheit verwalten" und ist damit
   ein Baustein, den Jordan im Betrieb sieht. Luecke im Plan, kein Restposten.
2. **Der Problem-Banner in der Shell ist der lauteste Rest im ganzen MC-Scope**
   (Z. 8171 bis 8201, 28 der 31 Treffer). Solides Tailwind-Rot
   (`bg-red-600`-Toast, `bg-red-500`-Badge, `red-500/10`-Banner) gegen die
   MC-Konvention der Zurueckhaltung (`.mc-note--error`, 12 Prozent).
   **Lesbarkeit ist NICHT das Problem**, gemessen: Banner-Text 11.54,
   Zeilentext 8.33, Toast 4.83, Kritisch-Badge 3.76 (Badge, AA-large, nach der
   Skript-Regel ok), MC-Konvention 5.34. Es geht um Lautstaerke, und das ist
   Jordans Entscheidung, nicht die der Session. Im Opener 28 als solche
   markiert, mit Wartepunkt vor dem Bauen.

### Fallschirm: geklaert, bleibt tabu

`MissionControlBoundary` (Z. 1253), `handleMcFallback` / `mcBlocked` /
`mcFailReason` (Z. 767 ff) und `MissionControlFallbackScreen` sitzen im
**App-Root**, nicht in `MissionControl` (ab 7909). Die 31 Treffer der Shell
fassen ihn nicht an, Session 28 ist davon frei.

Der urspruengliche Tabu-Grund ("landet noch auf Classic") ist seit Session 22
weg. Der aktuelle Grund ist besser: der Fallschirm laeuft ausschliesslich dann,
wenn schon alles andere abgestuerzt ist. Er ist damit das einzige Stueck Code,
das man **nicht durch Hinschauen testen kann** — ein Fehler darin faellt im
schlechtestmoeglichen Moment auf. Prioritaet 1 ist Stabilitaet, also bleibt er
liegen. Folge: die Fehlerseite bleibt im Classic-Look, waehrend alles andere MC
ist. Bewusst in Kauf genommen, sie erscheint nur nach einem Absturz.

- **Scheibe 3: AuditLogSection (Z. 4753) + ReportSection (Z. 5985)**, zusammen
  108 Zeilen. Toggle: Tagesfilter, Log auf/zu, leerer Tag, leerer Suchtreffer.
  Danach ist `smoke27b-settings.mjs` Lauf A bei 0 Rest-Klassen und SettingsTab
  fertig. **Fortschrittsbalken: 17 -> 14 (Scheibe 1b) -> 12 (Scheibe 2) -> 0.**
- **Ready-to-paste Opener liegt fertig in `OPENER-Session-27b-3.md`.** Zahlen
  darin sind am 16.07. nach dem Rebase frisch gemessen: beide Bausteine je 54
  Zeilen, beide nur von MissionControl erreichbar, und **keiner von beiden hat
  ein Tabu-Kind mit Design-Bezug** (kein `inp`, kein `Field`, nur Logik). Damit
  ist Scheibe 3 einfacher als Scheibe 2.
- **Eine echte Entscheidung steckt in Scheibe 3, nicht nur Uebersetzung:**
  `ReportSection` benutzt Orange fuer STATUS (KPI "Offen" / "Ohne Fahrer" /
  "Offene Rueckf." als `text-orange-400`, Fahrer-Balken `bg-orange-500`).
  Orange ist laut Regel die Marke. Derselbe Regelbruch wie bei den Van-Badges
  und dem Sicherheitshinweis, aber diesmal ohne offensichtliche Zielfarbe.
  Jordans Entscheidung, im Opener als solche markiert.

## Weitere gefundene Punkte fuer spaetere Sessions (NICHT heimlich fixen)

6. **`.mc-btn-primary` ist jetzt auch im Gast-Link-Block drin** (Speichern der
   Coordination-Nummer). Damit haengt der bekannte offene Punkt 1 (weiss auf
   `--mc-brand` = **3.56**, unter AA) an einer Stelle mehr. Kein Regress, der
   Knopf war vorher `bg-orange-600` mit `text-white`, also praktisch derselbe
   Wert. Nur zur Kenntnis, wie von Jordan verlangt.
7. **Der Untertitel des Gast-Link-Blocks ist der mit Abstand laengste auf der
   ganzen Seite** (rund vier Zeilen `text-xs` in `--mc-text-secondary`). Er war
   vorher genauso lang, ist also kein Regress, faellt aber im MC-Look staerker
   auf, weil alle anderen zwoelf Koepfe knapp sind. Lesbarkeit waere besser,
   wenn der Sicherheitshinweis aus dem Untertitel raus und in eine eigene
   `.mc-note mc-note--warn` unter den Kopf wandert. **Das waere aber Struktur,
   nicht Farbe, und damit ausserhalb dieses Pakets.** Jordans Entscheidung.

---

# Session vom 19.07.2026: Doku eingeholt, Phase-0-Analyse Vorschlag-Knopf, MC-Migration pausiert

## Stand (gemessen, nicht geschaetzt)

- `src/ShuttleLeitstelle.jsx`: **9076 Zeilen**, in dieser Session **nicht angefasst**.
- Letzter Code-Commit (JSX/App): **57fbf32** (Safe-Area-Abstand Leitstellen-Kopfleiste).
- Danach nur Doku-Commits: abccfd3 (CLAUDE.md ins Repo), fa2fb95 (Opener 29 ins Repo),
  plus der Abschluss-Commit dieser Session (Analyse + diese Uebergabe).
- main war bei Sessionstart bereits einen Commit ueber dem Opener-29-Stand (026935a):
  der Safe-Area-Fix 57fbf32 kam dazwischen dazu. Opener-Zahl war also veraltet, wie erwartet.

## Was in dieser Session fertig wurde

1. **CLAUDE.md und OPENER-Session-29.md ins Repo geholt** (lagen nur lokal in ~/Downloads),
   je ein eigener Commit, gepusht.
2. **Phase-0-Analyse zur Vorschlag-Knopf-Spezifikation** (`SHUTTLE-VORSCHLAG-SPEC_1.md`)
   vollstaendig durchgefuehrt, rein lesend, kein Code geaendert. Ergebnis in
   **`PHASE-0-ANALYSE-Vorschlag-Knopf.md`** (Kapitel A bis H plus Risikomatrix).
   Kernbefunde:
   - Der Vorschlag-Motor existiert bereits und laeuft live: `suggestDrivers` (Z. 1573),
     `evaluateInsertion` (Z. 1517), `reasonText` (Z. 1590), `computeDriverStats` (Z. 1480),
     verdrahtet in AssignModal (Z. 3764) und Rueckfahr-Ansicht (Z. 5732). Rein lesend.
   - Es gibt eine echte Fahrzeit-Matrix (`setup.matrix` plus `travelMin`, Z. 670).
     Die Spec nimmt faelschlich an, beides existiere nicht. Neubau waere Duplizierung.
   - `drivers_openbeatz.json` fehlt komplett auf dem Rechner. Nur die Timetable (229 Sets) ist da.
   - Sitzcheck nutzt schon `driver.seats`, ABER beim Anlegen wird `seats: Van?7:4` (Z. 464)
     als Default gesetzt. Reale Werte laut Spec: 5 Vans mit 6, 2 Vans mit 7. Ueberbuchungsrisiko.
   - Drei Schreibwege setzen `assignedDriverId` (AssignModal onAssign Z. 8447,
     quickAssign Z. 6162, Chat-Assistent Z. 3567), nicht ein einziger.
   - Kein ISO/Europe-Berlin, App rechnet ueber lokale "HH:MM"/"YYYY-MM-DD" plus `dateForNightTime`.
   - **Empfehlung im Bericht: NO-GO fuer Neubau. GO MIT BEDINGUNGEN fuer eine spaetere,
     kleine Erweiterung des vorhandenen Motors, nach dem Festival, wenn die Fahrerdatei da ist.**

## Verifikations-Pipeline (alles gruen)

- esbuild: gruen.
- Dupli-Funktions-Grep: leer.
- rg.mjs Referenz-Cross-Check: ok, Tabu-Kinder korrekt erkannt.
- kontrast.mjs: alle Werte ok.
- rendertest.mjs und smoke.mjs: gruen. **Hinweis:** beide Skripte haben den Ausgabepfad
  `/home/claude/repo/` fest verdrahtet (Z. 14 bzw. Z. 8) und laufen auf diesem Mac nur mit
  gepatchtem Pfad. Der Patch lief ausserhalb des Repos (Scratchpad), die Repo-Dateien wurden
  NICHT geaendert. **Offener Punkt fuer spaeter: den Pfad in beiden Skripten portabel machen
  (os.tmpdir bzw. Repo-relativ), damit die Tests hier ohne Handstand laufen.**
- smoke.mjs Ergebnis: RideForm/AssignModal/WhatsAppModal alle OK, 0 Classic-Reste.

## MC-Migration: bewusst pausiert bis nach dem Festival

**Entscheidung diese Session (Jordan): die MC-Migration wird ab jetzt bewusst pausiert bis
nach dem Festival (23. bis 27.07.2026). Sessions 28, 29 und 30 bleiben offen liegen.
Insbesondere wird KEIN Session 28 (Problem-Banner-Praesentation / MissionControl-Shell)
mehr gestartet.** Grund: das Refactoring bringt null Funktion, und zwei Tage vor dem
Fahrertest den Rahmen umzubauen wuerde den Test entwerten. Der einzige Punkt, der am 23.07.
wirklich zaehlt, ist die Leitstellen-PIN "1234", die Jordan selbst vor dem Festival ersetzt.

## Was noch offen ist (nach dem Festival)

- **Session 29** (urspruenglich geplant): PresenceManager auf MC (30 Treffer, Z. 5055) plus
  `barColor`-Totholz raus (6 Treffer). NICHT gebaut. Vier Design-Entscheidungen liegen im
  Opener-29 vor und warten auf Jordans OK.
- **Session 30**: AuditLogSection (Z. 4753, 20 Treffer) plus ReportSection (Z. 5985, 32 Treffer).
  Enthaelt eine echte Entscheidung: ReportSection nutzt Orange fuer STATUS (Regelbruch).
- **Session 28**: MissionControl-Shell (37 Treffer, 3 Bloecke). Hoechstes Risiko. Nach dem Festival.
- **Vorschlag-Knopf-Feature**: siehe PHASE-0-ANALYSE-Vorschlag-Knopf.md, Kapitel G und H.
  Vor einer Umsetzung noetig: Fahrerdatei beschaffen, Zeitzonen-Haltung entscheiden,
  kanonischen Assign-Pfad festlegen, auf dem vorhandenen Motor aufbauen statt neu bauen.
- **Test-Skripte portabel machen** (siehe oben, /home/claude fest verdrahtet).

## Regressionsrisiken dieser Session

**Null am App-Code.** `src/ShuttleLeitstelle.jsx` wurde nicht angefasst (Zeilenzahl
unveraendert 9076, Datei nicht im Diff). Aenderungen dieser Session sind ausschliesslich
neue bzw. hereingeholte Doku-Dateien. Kein funktionaler Regressionspfad.

## Konkrete manuelle Testfaelle

Da kein App-Code geaendert wurde, gibt es keine neuen funktionalen Testfaelle. Zur
Absicherung, dass die App weiter laeuft (unabhaengig von dieser Session):

1. App starten, Leitstelle oeffnen, eine offene Fahrt anklicken, "Fahrer zuteilen":
   die Vorschlagsliste erscheint mit Begruendung (Sitze, Anfahrt, passt gut). Bestaetigen
   teilt zu. Das ist der schon vorhandene Motor, unveraendert.
2. Kopfleiste auf iOS-Geraet: Logo wird nicht mehr von der Statusleiste ueberlagert
   (Safe-Area-Fix 57fbf32, kam vor dieser Session).

---

# Session vom 19.07.2026 (Chat-Interface): Teilpaket A fertiggestellt, verifiziert, committed, gepusht

## Herkunft dieser Session, wichtig für Vertrauenswürdigkeit

Diese Session begann mit einer **kompaktierten Zusammenfassung** eines vorherigen Chats,
in dem Teilpaket A (Springerlogik/Verfügbarkeit/Team) bereits größtenteils implementiert
worden war, aber unkommittiert im Working Tree lag. Nach der Regel "dem Opener nicht
trauen, erst messen" wurde der komplette Stand in dieser Session **frisch nachgemessen**,
nicht aus der Zusammenfassung übernommen. Ergebnis: die Zusammenfassung war korrekt,
sogar mehr Bausteine waren schon fertig als die dortige PENDING-Liste vermutete
(`supabase-schema.sql`, `fromDbDriver`/`toDbDriver`-Passthrough, MissionReturnsTab- und
MissionDriversTab-Badges waren alle schon im Code, nur noch nicht verifiziert/committed).

## Stand (gemessen)

    Ruecksetzpunkt vor Teilpaket A: Tag pre-teilpaket-A = ea74666 (9124 Zeilen)
    Neuer Commit:                   72f1b5b (9261 Zeilen, +137 netto)
    Gepusht nach origin/main:       ea74666..72f1b5b, sauberer Fast-Forward, 0 Divergenz

> KORREKTUR (Nachtrag 19.07.2026, siehe ganz unten "Nachtrag"): Der hier genannte Tag
> `pre-teilpaket-A` war zum Zeitpunkt dieses Abschnitts nur lokal erzeugt, aber NIE nach
> origin gepusht worden. Er wurde in einer spaeteren Chat-Session desselben Tages
> nachgezogen und liegt jetzt korrekt auf origin (zeigt auf ea74666).

`matchLoc` (der bekannte, bewusst nicht angefasste Bug) sitzt jetzt bei **Z. 7833**, nicht
mehr Z. 7676 wie in älterer Doku. Verschiebung durch die 137 neuen/geänderten Zeilen vor
`evaluateInsertion`. **Immer per grep nachmessen, nie auf die alte Zahl verlassen.**

## Was in dieser Session fertig wurde

1. Vollständige Neuverifikation des kompletten Standes (nicht der Zusammenfassung vertraut):
   esbuild grün, Dupli-Funktions-Grep leer, JSX-Referenz-Cross-Check aufgelöst (einziger
   Treffer `MissionControlBoundary` ist eine bestehende `class`, kein Fehlen einer
   Definition, nicht von Teilpaket A berührt).
2. `pruefe.mjs`-Diff gegen den Rücksetzpunkt (`ea74666`) gefahren: **0 entfernte
   Top-Level-Konstrukte**, 7 gezielt geänderte Funktionen (`fromDbDriver`, `toDbDriver`,
   `evaluateInsertion`, `suggestDrivers`, `AssignModal`, `MissionDriversTab`,
   `MissionEmergencyTab`), 10 neue Helfer. `computeDriverStats` und `reasonText`
   unangetastet, wie im Auftrag verlangt.
3. Volle Regressionspipeline gefahren, alles grün:
   - `rendertest.mjs`: alle 5 Referenzwerte exakt konstant (App-Root 25053, IssueModal
     2452, StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101).
   - `test_passengercount_safety.mjs`: 24/24.
   - `test_onetap_assign.mjs`: 14/14.
   - `test_ridelist_empty.mjs`: 10/10.
   - `test_springer_availability.mjs` (neu, aus der Vorsession übernommen): 34/34.
   - Alle `smoke*.mjs` (smoke, 27b, 27b-guest, 27b-sections, 27b-settings, 27c, 27d, 27e):
     grün, Classic-Reste überall 0. AssignModal 5852 Zeichen (Baseline 5812, +40 durch die
     additiven Springer-/Team-Badges, rein additiv).
   - `kontrast.mjs`: keine FAILs.
   - `pruefe-fahrerabgleich.mjs`: **bewusst nicht gefahren**, braucht echte Live-DB-Zeilen
     aus Supabase, die von dieser Umgebung aus nicht abrufbar sind (kein DB-Zugriff aus dem
     Sandkasten). Bleibt offen für eine Session mit echtem Supabase-Zugriff.
4. Mapping-Tabelle aller 23 Fahrer neu erzeugt und im Bericht dokumentiert
   (`/tmp/verify_mapping.mjs`, gleiches Skript wie in der Vorsession). Alle 23 eindeutig
   über normalisierten Vollnamen gemappt, JSON-IDs (d01-d23) matchen die App-Slugs nicht.
5. `TEILPAKET-A-Ergebnisbericht.md` neu geschrieben (vollständiger Bericht nach Auftrag
   Abschnitt 12: Rücksetzpunkt, geänderte Dateien/Funktionen, neue Felder, Mapping-Tabelle,
   Springerlogik, availableFrom-Behandlung, UI-Änderungen, Testergebnisse, Restrisiken,
   manuelle Abnahme-Checkliste, GO/NO-GO).
6. Commit `72f1b5b` erstellt (nur die vier inhaltlichen Dateien gestaged, `package.json`/
   `package-lock.json` bewusst draußen gelassen, das war nur ein `npm install`-Artefakt
   vom frischen Klon, keine Teilpaket-A-Änderung).
7. `git fetch origin main` vor dem Push (Pflicht laut Standing Rule): origin stand noch
   auf `ea74666`, 0 Commits Divergenz, sauberer Fast-Forward möglich.
8. Gepusht mit frischem PAT (im Chat-Verlauf erhalten, direkt in der Push-URL verwendet,
   nicht in `git remote set-url` gespeichert, Config danach nachweislich sauber). Push
   bestätigt: `ea74666..72f1b5b main -> origin/main`.

## GO/NO-GO-Ergebnis

**GO mit einem Vorbehalt**, siehe `TEILPAKET-A-Ergebnisbericht.md`: vor dem Live-Betrieb
einmal den DB-Weg gegenprüfen (Schema-Nachtrag einspielen oder bewusst weglassen, dann
`pruefe-fahrerabgleich.mjs` mit echten DB-Zeilen laufen lassen). Der Code selbst ist
rückwärtskompatibel und funktioniert auch ohne den Schema-Nachtrag, da er primär aus der
`DRIVER_PROFILES`-Konstante liest.

## Regressionsrisiken dieser Session

Aus Sicht dieser Session: keine neuen, da nur verifiziert, dokumentiert, committed und
gepusht wurde, kein zusätzlicher Code geschrieben. Der Code selbst (aus der Vorsession)
ist ein echter Eingriff in `evaluateInsertion`/`suggestDrivers`, siehe Restrisiken im
Ergebnisbericht.

## Offen für die nächste Session

- `pruefe-fahrerabgleich.mjs` mit echten Supabase-Live-Zeilen laufen lassen (braucht
  entweder Zugriff auf die echte DB oder Jordan liefert das SQL-Abfrageergebnis).
- `matchLoc`-Bug (jetzt Z. 7833) ist weiterhin nicht angefasst, wie vereinbart. Steht laut
  älterer Doku als "mandatory code fix before festival" auf dem Zettel, aber Jordan sagt
  nach und nach, was gebaut wird. Nicht von selbst starten.
- Sessions 28 bis 30 (MC-Migration Shell/PresenceManager-Rest/AuditLog/Report) bleiben wie
  in der Vorsession entschieden bis nach dem Festival pausiert.
- Weitere Teilpakete (B, C, ...) für den Vorschlagsmotor: Jordan bestimmt Umfang und
  Reihenfolge selbst ("ich sage nach und nach was wir bauen"). Nicht vorgreifen.
- Fahrertest war für Samstag 18.07. angesetzt (liegt zum Zeitpunkt dieser Session bereits
  einen Tag zurück). Ergebnis/Feedback daraus in dieser Session nicht besprochen, ggf. bei
  Jordan nachfragen, falls relevant für die nächste Session.

## Zeitfenster, unverändert wichtig

Ab 21.07. keine Löschungen mehr. Festival 23. bis 27.07.2026.

# Nachtrag 19.07.2026 (spaeterer Chat, nach Teilpaket A): Ruecksetz-Tag nachgezogen

Beim Schritt-0-Nachmessen in einer neuen Chat-Session fiel auf: der weiter oben und im
Opener (`OPENER-Naechster-Chat-nach-Teilpaket-A.md`) genannte Sicherungs-Tag
`pre-teilpaket-A` existierte auf origin gar nicht. Auf origin lagen nur die drei aelteren
Tags (`stabil-classic-vorhanden-2026-07-15`, `stabil-vor-design-2026-07-13`,
`stabil-vor-mc-design-2026-07-16`). Der Commit `ea74666` selbst war im Verlauf vorhanden
und hatte die dokumentierten 9124 Zeilen, aber als benannter Ruecksetzpunkt fehlte er.
Klassischer Fall "Doku beschreibt Absicht, nicht Messwert".

Behoben (reine Sicherungs-/Doku-Massnahme, kein Code angefasst):
- Annotierten Tag `pre-teilpaket-A` auf `ea74666` angelegt und nach origin gepusht.
- Von origin gegengeprueft: `git ls-remote --tags origin` zeigt
  `pre-teilpaket-A^{}` -> `ea74666`, also der Stand mit 9124 Zeilen vor Teilpaket A.
- `origin/main` unveraendert bei `42a9d1d`, kein Code-Commit in dieser Massnahme.

Lehre fuers naechste Mal: Sicherungs-Tags direkt nach dem Anlegen mit
`git push origin <tag>` hochladen und mit `git ls-remote --tags origin` bestaetigen, sonst
steht der Ruecksetzpunkt nur lokal und ist nach dem Sandbox-Reset weg.

# Session vom 19.07.2026 (Chat-Interface): Teilpaket B umgesetzt, verifiziert, committed

## Ruecksetzpunkt
Tag `pre-teilpaket-B` = 030bc15 (Codestand = Teilpaket A). Auf origin, gegengeprueft.

## Was gebaut wurde (rein additiv)
Neuer Block nach checkDriverAvailability (vor evaluateInsertion): Ortsaufloesungs-Schicht
ueber den bestehenden festen IDs. Reine Funktionen ohne Nebenwirkung, keine Ride-Mutation.
- Config: LOC_ZONE, ZONE_LABEL, LOC_MATRIX_NODE, LOC_ALIASES, KNOWN_FIXED_IDS, PICKUP_RULES
- normLoc(s): deterministische Normalisierung (lower, oe/ae/ue, ss, Satzzeichen->Space)
- resolveLocation(text, fixedId): strukturierte Antwort (requested/normalized/zone/
  operational/matchedAlias/status matched|unknown|ambiguous). Feste ID gewinnt (Rueckwaerts-
  kompat). Spezifische Aliase vor allgemeinen (NUE-GAT vor NUE). Keine stille Auswahl.
- resolveRideEndpoint(id, custom): feste ID vor Custom-Freitext (Spec 10).
- resolveOperationalRideLocations(ride, setup): EINZIGE Quelle der operativen Orte. Pickup-
  Regel NUR bei Leonardo/HBF -> Festival (=> Sheraton). Ziel wird NIE umgeschrieben.
- resolveTravelMinutes({from,to,setup}): sichere Fahrzeit ueber Matrix, unknown/null bei
  fehlender Kante, nie 0/geschaetzt.
- rideEndpointMatrixNode(id, custom, opRule): uebersetzt Endpunkt -> Matrix-Knoten.
  Bekannte feste ID -> Identitaet (Bestandsverhalten byte-identisch). Unbekannt -> id
  (i.d.R. __custom -> null-Fahrzeit wie Bestand).

## Kernpfad-Eingriff (minimal, in evaluateInsertion)
Drei Ortsbezuege durch operative Matrix-Knoten ersetzt:
- pickup = rideEndpointMatrixNode(fromId, fromCustom, <Sheraton-Regel>), drop analog
- prevLoc = echtes Ziel der Vorfahrt via rideEndpointMatrixNode(prev.toId, prev.toCustom)
- Folgehop: next-Pickup operativ aufgeloest
opLoc zusaetzlich im Return (nur fuer UI). Sonst nichts geaendert.

## Datenentscheidungen (von Jordan bestaetigt, in seedLocations/seedMatrix)
- Festival-Koordinate 49.52728/10.83139, Anfahrt Puschendorf (nicht Hoefen). Adresse ergaenzt.
- sheraton|festival 33 -> 38 min (weiter suedliche Koordinate).
- muc|festival = muc|sheraton = 105 min (neuer Matrix-Knoten "muc").
- Nachbar-Zeitzuordnung (LOC_MATRIX_NODE): leonardo/hbf_nue/karl_august -> sheraton,
  gat_nue -> airport, airport_muc -> muc. Fahrer sieht immer den echten Ort.

## WICHTIG fuer den Live-Betrieb (Supabase)
Die drei Matrix-Werte stehen nur im SEED (Artifact/Demo). Das Live-Festival laedt die Matrix
aus Supabase. Jordan muss dort in den Einstellungen nachtragen, sonst greifen sie live nicht:
  sheraton|festival = 38, muc|festival = 105, muc|sheraton = 105
Die Nachbar-Zuordnung braucht KEINE Live-Eintraege fuer leonardo/hbf/karl_august/gat, weil
sie ueber sheraton/airport rechnen (die schon existieren). Nur "muc" ist neu.

## UI (AssignModal, rein presentational)
Kopfzeile ergaenzt: "Abholung: <op>" nur wenn abweichend (Leonardo/HBF), Fahrgast-Ort bleibt
sichtbar. Warnzeile bei unbekanntem Abhol-/Zielort. Nutzt bestehende Design-Token.

## Verifikation (alles gruen)
- esbuild gruen, keine doppelten Funktionen, alle Icons/Bezeichner definiert.
- smoke-teilpaket-b.mjs: 69/69 Pruefungen (alle Spec-Faelle 1..64 + Zusatz + Gegenprobe),
  gegen die AUS DER QUELLE extrahierten echten Funktionen (kein Nachbau).
- regression-teilpaket-b.mjs: suggestDrivers/evaluateInsertion alt (pre-teilpaket-B) vs neu,
  5 Bestandsfahrten ueber die 4 alten Orte, BYTE-IDENTISCH (0 Abweichungen). Gegenprobe ok.
  Byte-Identitaet zusaetzlich direkt belegt: rideEndpointMatrixNode(<Bestands-ID>) == ID.
- rendertest.mjs: alle 5 Referenzwerte konstant (25053/2452/2413/2895/101).
- pruefe.mjs: Field/inp/SettingsTab/LocSelect unveraendert, alle CSS-Variablen definiert.
- kontrast.mjs: 0 WCAG-Fehler.

## Regressionsrisiken
- evaluateInsertion ist Kernpfad. Byte-Identitaet fuer Bestandsfahrten bewiesen (s.o.), Risiko
  daher niedrig. Neuverhalten betrifft nur bisher als __custom/unbekannt gefuehrte Orte.
- Fahrerposition nach Rueckfahrt zu NEUEM Ort ueber stats.locNow (prev===null-Fall): dort
  geht der Custom-Text verloren (computeDriverStats speichert nur toId). Bewusst NICHT
  angefasst (Teilpaket-A/shared, ausserhalb minimalem Scope). Fuer den Folge-Insertion-Fall
  (prev vorhanden) ist es korrekt geloest. Siehe "Weitere Punkte".

## Weitere gefundene Punkte fuer spaetere Sessions (NICHT jetzt fixen)
- computeDriverStats.locNow traegt bei Custom-Zielen keinen Freitext -> Fahrerposition eines
  idle-Fahrers an einem neuen Ort bleibt fuer die allererste Insertion unbekannt. Nur relevant,
  wenn ein Fahrer OHNE Folgefahrt zuletzt an einem neuen Custom-Ort stand.
- matchLoc (Import) trennt GAT weiterhin nicht ("private jet gat" -> airport). Bewusst
  unangetastet (Auftrag). resolveLocation trennt GAT im Vorschlagsmotor korrekt.
- resolveTravelMinutes wird im Hauptcode nicht direkt aufgerufen (evaluateInsertion nutzt
  travelMin+rideEndpointMatrixNode). Bereitgestellt als Spec-geforderte reine API + fuer Tests.

## GO/NO-GO
GO. Additiv, Bestandsverhalten bewiesen unveraendert, volle Pipeline gruen. Vor Live-Betrieb
die drei Matrix-Werte in Supabase-Settings eintragen (s.o.).

# Nachtrag 19.07.2026 (spaeter am selben Tag): Teilpaket-B-Bedingung erfuellt, GO final

Jordan hat `teilpaket-b-matrix-update.sql` im Supabase SQL-Editor ausgefuehrt und die
Kontroll-Abfrage bestaetigt (sheraton|festival=38, muc|festival=105, muc|sheraton=105 in
der Live-DB angekommen). Damit ist die einzige GO-Bedingung aus dem Abschlussbericht
erfuellt. **Teilpaket B ist vollstaendig abgeschlossen, keine offenen Punkte mehr aus
diesem Paket** (bis auf die separat dokumentierten, bewusst nicht behobenen Randfaelle
unter "Weitere gefundene Punkte fuer spaetere Sessions").


# ============================================================================
# TEILPAKET C1 - Rein lesender Timetable-Tab (19.07.2026, abgeschlossen)
# ============================================================================

## Was umgesetzt wurde
Neuer, rein lesender Tab "Timetable" in der Leitstelle. Zeigt die Open-Beatz-
Timetable (229 Sets, 4 Tage, 10 Stages), gruppiert nach Betriebstag, mit Suche,
Tag-/Stage-Filter, B2B- und "nach Mitternacht"-Kennzeichen. Keinerlei Schreib-
vorgang, kein Kernpfad beruehrt.

## Ruecksetzpunkt
Git-Tag `pre-teilpaket-C1` = `6d0054c` (Stand nach Teilpaket B).

## Aenderung an src/ShuttleLeitstelle.jsx
Rein additiv: **550 Einfuegungen, 0 Loeschungen** (9522 -> 10072 Zeilen).
Drei Einhaengepunkte:
1. Block vor `MissionDriversTab`: `TIMETABLE_META` + `TIMETABLE_RAW` (229 Sets,
   gebackene Konstante wie DRIVER_PROFILES) + Helfer `ttHash`/`ttAbsMin`/
   `ttIsB2B`/`ttNorm`/`ttCompare`/`normalizeTimetableEntries` + Komponente
   `TimetableTab`.
2. Eine `MC_NAV`-Zeile (Tab "timetable", Gruppe "Planung & Kommunikation").
3. Eine Render-Zeile `{tab === "timetable" && <TimetableTab />}`.

## Wichtigste Design-Entscheidungen (von Jordan bestaetigt)
- Timetable als gebackene JS-Konstante (Single-File-Artifact kann kein JSON
  importieren).
- Betriebstag ausschliesslich ueber bestehenden `festDayKey`. Verifiziert:
  reproduziert `festival_day` fuer alle 229 Sets, 0 Abweichungen. Keine zweite
  Datumslogik; `festival_day` nur zur Gegenpruefe.
- Sichtbarkeit allein ueber `MC_ROLE_TABS` (dispo=alle; stage/driver Allowlist
  ohne timetable; guest keine MC-Nav) -> andere Rollen strukturell unangetastet.

## Verifikation (alles gruen)
- esbuild gruen, keine Duplikat-Funktionen, JSX-Referenz-Check sauber.
- `smoke-teilpaket-c1.mjs` 40/40 (inkl. Gegenprobe), `smoke-teilpaket-c1-ui.mjs`
  16/16. Beide testen die ECHTEN, aus der Quelle gebundelten Funktionen/
  Komponenten (kein Nachbau).
- rendertest 5 Referenzwerte EXAKT konstant (25053/2452/2413/2895/101).
- kontrast 0 Fehler, pruefe: DriverApp/StageApp/GuestApp/... unveraendert,
  0 undefinierte CSS-Vars.
- Byte-Diff aller Kernpfad-/Tabu-Funktionen (pre-C1 vs. aktuell): identisch.
- Bestehende Logiktests: Springer 34/34, Personenzahl 24/24, One-Tap 14/14,
  leere Ridelist 10/10.

## Restrisiken / bewusst verschoben
- "Jetzt / Als Naechstes"-Filter NICHT eingebaut (nur mit Echtzeit sinnvoll,
  erst waehrend Festival testbar). Bewusst verschoben.
- Waehrend Entwicklung gefunden+behoben: `\uXXXX`-Escapes rendern in JSX-Text/
  Attributen literal -> durch echte Zeichen ersetzt. Diakritika-Regex in ttNorm
  (`\u0300-\u036f`) bleibt korrekt als Escape.
- `regression-teilpaket-b.mjs` braucht `/tmp`-Extrakte der Vorsession (fragil);
  der Motor-Vergleich ist durch den Byte-Diff oben staerker abgedeckt.

## Noch NICHT gepusht
Zum Zeitpunkt dieses Eintrags sind Commit + Push offen (frischer PAT noetig).
Der geklonte PAT wurde nach dem Clone gescrubbt.

# ============================================================================
# Session vom 19.07.2026 (Chat-Interface): Teilpaket C2 umgesetzt, verifiziert,
# committed UND gepusht
# ============================================================================

## Ruecksetzpunkt
Tag `pre-teilpaket-C2` = `2fb4ca2` (C1-Stand, VOR C2). Lag bereits lokal und auf
origin. main steht jetzt auf dem C2-Commit `be22172`
(`2fb4ca2..be22172 main -> main`, sauberer Fast-Forward).

## Was umgesetzt wurde (rein additiv, rein lesend)
Sichere, nachvollziehbare Zuordnung Fahrt -> Timetable-Set. Nur berechnet und
neutral angezeigt, KEIN Schreibvorgang, keine Zeit-/Status-/Fahreraenderung,
kein Fuzzy-Matching. Datei 10072 -> 10536 Zeilen.

Neue reine Funktionen (nach TimetableTab gespliced):
- `normalizeArtistName` (Vergleichs-Normalisierung: Gross/Klein, deutsche Umlaute
  ausgeschrieben oe/ae/ue UND als Umlaut identisch, ss/ß, typografische
  Apostrophe, dekorative Sonderzeichen/Bindestriche -> Space, "&" -> "and";
  Original NIE veraendert; kein Fuzzy).
- `ARTIST_ALIASES` (LEER, datengetrieben - siehe Alias-Befund unten) +
  `buildArtistAliasIndex` (verwirft mehrdeutige Aliase).
- `TT_COLLAB_RE`, `extractTimetableArtists` (B2B/back to back/vs./vs-Split;
  "&" bleibt Namensteil; Original-Set-Name erhalten; status parsed/unparsed).
- `rideFestivalDirection` (toFestival/fromFestival/other aus fromId/toId).
- `rideCanonicalArtist` (nur ride.djName).
- `buildTimetableMatchIndex` (byArtist inkl. B2B-Mitglieder + byDay ueber die
  GUELTIGEN C1-normalisierten Eintraege; nutzt C1-Normalisierung, kein Neuparsen).
- `pickByTime` (richtungsabhaengige Zeitauswahl unter Kandidaten; erzeugt NIE
  einen Match).
- `matchRideToTimetable` (Reihenfolge exact -> alias -> b2b_member; Zeit NUR nach
  Artist-Match zur Auswahl; Status: exact/alias/b2b_member/multiple_candidates/
  no_match/missing_artist/invalid_artist; liefert Diagnose).
- Helfer `candOut`, `reasonFor`, `ttSetLine`.
UI (nur Leitstelle, neutral, KEINE Ampel-/Warnfarben - das ist C3-Scope):
- `TimetableMatchInfo` + `renderDiagnostics` (aufklappbare Diagnose).
- Eingebunden in `RideForm` (live unter dem Feld "DJ / Artist", useMemo aus
  Formular-State) und `AssignModal` (feste Fahrt, useMemo).

## Wichtigste Entscheidungen
- Kanonisches Ride-Artist-Feld = `ride.djName` (einzige Quelle laut Analyse:
  makeExampleRides, parseRow Header-Aliase artist/dj/djname/kuenstler, RideForm
  DJ-Feld). KEIN Fallback aus passengers (=Begleitnamen)/notes (=Freitext)/type
  (=Fahrttyp).
- Alias-Befund: Abgleich aller Beispiel-Ride-Artists gegen die 229 Timetable-
  Sets zeigt, die grossen Headliner stehen gar nicht im Timetable. KEINE
  belegbare Alias-Regel -> ARTIST_ALIASES bleibt leer (Vorgabe "keine erfundenen
  Aliase"), zentral erweiterbar.
- "&" ist mehrdeutig (echte Einzel-Acts: Harris & Ford, 2 Engel & Charlie,
  Vero & Sleepwell, Kopf & Hoerer) -> NIE B2B-Trenner. Nur b2b/back to back/
  vs/vs. trennen.
- Betriebstag ausschliesslich ueber bestehenden `festDayKey` (keine zweite
  Datumslogik).

## Verifikation (alles gruen)
- esbuild gruen, keine Duplikat-Funktionen, JSX-Referenz-Cross-Check: alle 13
  C2-Bezeichner definiert, TimetableMatchInfo 2x genutzt.
- rendertest 5 Referenzwerte EXAKT konstant (25053/2452/2413/2895/101) - C2 nicht
  im gemessenen Render-Pfad.
- kontrast 19 ok-Zeilen 0 Fehler; pruefe: keine undefinierten vars, Diff gegen
  pre-teilpaket-C2 = 2 GEAENDERT (RideForm, AssignModal), 15 NEU, 0 ENTFERNT.
- `smoke-teilpaket-c2.mjs` 65/65 (echte Quellfunktionen, inkl. Gegenproben),
  `smoke-teilpaket-c2-ui.mjs` 14/14 (alle Statusfaelle rendern, statische
  Read-only-Analyse, Gegenprobe).
- Bestand gruen: C1 40/40 + 16/16, Springer/A 34/34, One-Tap 14/14,
  Personenzahl 24/24, Ridelist 10/10.

## Angepasster Bestandstest (dokumentiert, keine Aufweichung)
`smoke-teilpaket-c1-ui.mjs`: Test-Anker grenzt den TimetableTab-Koerper jetzt
KLAMMER-GENAU ab (Depth-Zaehler) statt bis "function MissionDriversTab" - sonst
wuerde der direkt danach eingefuegte C2-Block faelschlich als TimetableTab-
Koerper mitgemessen (fand updateDyn/.delete). TimetableTab selbst BYTE-IDENTISCH
bewiesen (8595 Bytes vorher=nachher). Gegenprobe (injiziertes updateDyn) belegt
echte Messung. Zusaetzlich im C2-UI-Smoke: lokale `map.delete(alias)` in
buildArtistAliasIndex ist KEIN Persistenz-Schreibweg -> Token praezisiert auf
DB-/Storage-Deletes; separater Supabase-DB-Delete-Regex-Check ergaenzt.

## Regressionsrisiken
Sehr gering, rein additiv. Einzige Bestandseingriffe: zwei rein anzeigende
Einbindungen (je ein TimetableMatchInfo) + zwei useMemo fuer normalisierte
Timetable-Daten in RideForm/AssignModal. Keine Handler, Felder, Props (ausser
den bestehenden) oder Speicherpfade beruehrt.

## Geaenderte / neue Dateien (Commit be22172)
- src/ShuttleLeitstelle.jsx (C2-Schicht + 2 Einbindungen, 10072 -> 10536)
- smoke-teilpaket-c2.mjs (NEU, 65 Logiktests)
- smoke-teilpaket-c2-ui.mjs (NEU, 14 UI/Read-only-Tests)
- smoke-teilpaket-c1-ui.mjs (GEAENDERT, Anker robuster, keine Logikaenderung)
- TEILPAKET-C2-ABNAHME.md (NEU, manuelle Checkliste)
- TEILPAKET-C2-BERICHT.md (NEU, technischer Bericht)

## GO/NO-GO
GO. C2 vollstaendig, verifiziert, committed und gepusht. Anhalten laut Spec:
noch KEINE Timetable-Warnungen (C3), keine Zeitbewertung, keine Ride-Aenderungen.

## Weitere gefundene Punkte fuer spaetere Sessions (NICHT jetzt fixen)
- matchLoc (Z. ~7676) liest nur 4 Hardcode-Orte, nicht setup.locations.
- "Jetzt/Als Naechstes"-Filter im Timetable-Tab (verschoben).
- ARTIST_ALIASES leer - sobald ein echter, belegter Alias-Fall bekannt ist,
  zentral nachtragen.


# ----------------------------------------------------------------------------
# READY-TO-PASTE OPENER FUER DEN NAECHSTEN CHAT
# ----------------------------------------------------------------------------
# Repo: Maybach62S57S/openbeatz-shuttle, main. Hauptdatei src/ShuttleLeitstelle.jsx.
# Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Code-Freeze 21.07.,
# ab 21.07. KEINE Loeschungen mehr (Festival 23.-27.07.).
#
# Stand: Teilpaket A, B, C1 und C2 abgeschlossen und gepusht. main steht auf dem
# C2-Commit be22172. Ruecksetzpunkte als Tags: pre-teilpaket-A/-B/-C1/-C2.
# Erwartete Zeilenzahl src/ShuttleLeitstelle.jsx: 10536.
#
# Schritt 0 (Pflicht): Repo klonen (frischen fine-grained PAT bereitstellen, nach
# Clone aus der Remote-URL scrubben mit `git remote set-url`), `git log --graph
# --oneline --all` pruefen (HEAD = be22172), exakte Zeilenzahl messen (10536),
# npm install (esbuild+react+react-dom), Baseline-Skripte laufen lassen:
# rendertest (5 Werte 25053/2452/2413/2895/101), kontrast (0 Fehler), pruefe
# (0 undefinierte vars), smoke-teilpaket-c1/-c1-ui/-c2/-c2-ui, Springer/One-Tap/
# Personenzahl/Ridelist. Erst dann Auftrag entgegennehmen.
# Hinweis: rendertest/smoke-Skripte schreiben nach /home/claude/repo/ -> ggf.
# `ln -s <clone>/node_modules /home/claude/repo/node_modules`. Skripte brauchen
# `src/ShuttleLeitstelle.jsx` als argv[2]; pruefe.mjs braucht ZWEI Pfade.
#
# Was als Naechstes ansteht (C3, NUR auf ausdruecklichen Auftrag): Timetable-
# basierte Zeitbewertung/Warnungen. C2 hat bewusst NICHTS davon vorweggenommen
# (neutrale Anzeige, keine Ampelfarben). Kanon: matchRideToTimetable liefert
# status/selected/candidates/Diagnose - darauf laesst sich C3 aufsetzen.
#
# Offene, bewusst NICHT gefixte Punkte (nur auf ausdruecklichen Auftrag):
#   - matchLoc (Z. ~7676) liest nur 4 Hardcode-Orte, nicht setup.locations.
#   - "Jetzt/Als Naechstes"-Filter im Timetable-Tab (verschoben).
#   - ARTIST_ALIASES leer - erst bei belegtem Alias-Fall nachtragen.
#   - PIN-Sicherheit: NICHT proaktiv ansprechen.

# =========================================================================
# Session C3 (19.07.2026) - Timetable-Zeitbewertung ABGESCHLOSSEN
# =========================================================================
# Rein lesende Planungsbewertung auf Basis des C2-Match. Zeigt in der Leitstelle
# (RideForm + AssignModal), ob eine geplante Fahrt rechtzeitig/knapp/kritisch/zu
# spaet zum Set-Beginn ankommt bzw. ob eine Rueckfahrt vor/nach dem Set-Ende liegt.
# Keine Schreibvorgaenge, keine Auto-Aenderung, keine Live-ETA.
#
# Ruecksetzpunkt-Tag: pre-teilpaket-C3 = fc8ff23. Neue Zeilenzahl: 10834.
# Bausteine: GEAENDERT (3) AssignModal, RideForm, TimetableMatchInfo (nur additiv:
#   optionaler match-Prop bzw. geteiltes Match + <TimetableTimingInfo>).
#   NEU (14): TIMETABLE_WARNING_CONFIG, c3RideStartAbsMin, c3AbsToParts, c3HM,
#   c3OperationalNodes, gradeArrivalMargin, c3ArrivalMessage, c3NeutralForMatch,
#   evaluateTimetableTiming, C3_LABEL, c3SeverityColor, C3_GRADED, c3Diag,
#   TimetableTimingInfo. ENTFERNT: keine.
#
# Schwellwerte (einzige Quelle) TIMETABLE_WARNING_CONFIG: onTime 40, tight 20,
#   returnGrace 0. Grader lueckenlos/ueberschneidungsfrei (Grid -120..+180 getestet).
# Fahrzeit-Quelle = Teilpaket-B-Pfad (resolveOperationalRideLocations +
#   rideEndpointMatrixNode + travelMin), Sheraton-Override fuer Leonardo/HBF ->
#   Festival. estDurationMin wird NICHT genutzt. Fehlende Kante -> timing_unknown.
# Mitternacht: Absolutminuten (wie ttAbsMin), Betriebstag ueber festDayKey.
#
# Neue Proof-Skripte: smoke-teilpaket-c3.mjs (147 Logiktests),
#   smoke-teilpaket-c3-ui.mjs (35 UI/Read-only-Tests). Beide nehmen die
#   Quelle als argv[2]. Gegenproben eingebaut UND extern belegt (kaputter
#   Schwellwert/Label laesst Smokes fehlschlagen).
#
# Verifikation komplett gruen: esbuild, keine Doppelfunktionen, keine undefinierten
#   Referenzen, rendertest 5 Werte konstant (25053/2452/2413/2895/101), kontrast 0,
#   pruefe (nur 3 gewollte Aenderungen, 337/340 byte-identisch), C1 40, C1-UI 16,
#   C2 65, C2-UI 14 (C3 liegt im C2-UI-Scanbereich, weiterhin gruen), C3 147,
#   C3-UI 35, B-Smoke 69 (B-Schicht byte-identisch), Springer 34, One-Tap 14,
#   Personenzahl 24, Ridelist 10, smoke.mjs (RideForm/AssignModal Classic-Reste 0).
# Berichte: TEILPAKET-C3-BERICHT.md, TEILPAKET-C3-ABNAHME.md (20 Punkte).
#
# -------------------------------------------------------------------------
# OPENER fuer die naechste Session (fertig zum Kopieren)
# -------------------------------------------------------------------------
# Stand: Teilpaket A, B, C1, C2 und C3 abgeschlossen und gepusht. Ruecksetzpunkte
# als Tags: pre-teilpaket-A/-B/-C1/-C2/-C3. Erwartete Zeilenzahl
# src/ShuttleLeitstelle.jsx: 10834 (nach C3-Push per git-Hash bestaetigen, der
# Doc-Commit-Hash verschiebt sich).
#
# Schritt 0 (Pflicht): Repo klonen (frischen fine-grained PAT bereitstellen, nach
# Clone aus der Remote-URL scrubben mit `git remote set-url`), `git log --graph
# --oneline --all` pruefen, exakte Zeilenzahl + letzten CODE-Commit-Hash messen,
# npm install (esbuild+react+react-dom), Baseline-Skripte laufen lassen:
# rendertest (5 Werte 25053/2452/2413/2895/101), kontrast (0 Fehler), pruefe
# (self, 0 undefinierte vars), smoke-teilpaket-c1/-c1-ui/-c2/-c2-ui/-c3/-c3-ui,
# Springer/One-Tap/Personenzahl/Ridelist. Erst dann Auftrag entgegennehmen.
# Hinweis: Skripte brauchen `src/ShuttleLeitstelle.jsx` als argv[2]; pruefe.mjs
# braucht ZWEI Pfade; smoke-teilpaket-b.mjs braucht vorab gebaute tmp-tb-funcs.mjs.
#
# Offene, bewusst NICHT gefixte Punkte (nur auf ausdruecklichen Auftrag):
#   - matchLoc (aktuell Z. 9404, verschiebt sich mit jeder Aenderung - vor Gebrauch
#     neu grep-en) liest nur 4 Hardcode-Orte statt setup.locations. Betrifft C3
#     nicht (C3 nutzt die B-Ortsaufloesung).
#   - "Jetzt/Als Naechstes"-Filter im Timetable-Tab (verschoben).
#   - ARTIST_ALIASES leer - erst bei belegtem Alias-Fall nachtragen.
#   - PIN-Sicherheit: NICHT proaktiv ansprechen.
#   - Ab 21.07.: keine Loeschungen mehr (Festival 23.-27.07.).
#   - Leonardo hat KEIN eigenes Ortsobjekt (nur Alias+Matrix-Knoten->sheraton,
#     kein address/lat/lng). Rueckfahrt Festival->Leonardo navigiert deshalb per
#     Freitext-Google-Suche zum echten Leonardo (funktioniert). Jordan wollte am
#     19.07. testweise die Sheraton-Adresse fuers Leonardo-Ortsobjekt uebernehmen
#     (Variante 1, Rueckfahrt wuerde dann zum Sheraton navigieren) - auf Eis
#     gelegt ("das stellen wir erstmal zurueck"). NICHT von selbst umsetzen,
#     nur auf erneuten ausdruecklichen Auftrag. Bei Auftrag: eigene Session mit
#     Ruecksetzpunkt, da Eingriff in seedLocations/KNOWN_FIXED_IDS/Kartenkoordinaten
#     (Ripple-Analyse liegt im Chat vom 19.07. vor: Dropdown-Sichtbarkeit,
#     Pickup-Banner, GPS-Kartenmarker-Ueberlappung mit Sheraton).
#
# -------------------------------------------------------------------------
# NAECHSTER SCHRITT: "Teilpaket D" - NOCH UNSPEZIFIZIERT
# -------------------------------------------------------------------------
# Jordan hat am 19.07. einen neuen Chat fuer "Paket D" angekuendigt, aber noch
# KEINE Spec gegeben. Vor jeder Umsetzung: Spec von Jordan einholen (wie bei
# A/B/C1/C2/C3). Falls er unsicher ist, was sinnvoll waere, obige offene Punkte
# als Vorschlaege nennen (matchLoc-Fix, Timetable-Filter, Leonardo-Ortsobjekt).
# Terminlich beachten: Fahrertest 18.07. ist vorbei: naechster harter Termin ist
# der Code-Freeze 21.07. (danach keine Loeschungen mehr, Festival 23.-27.07.).

# =========================================================================
# Session Teilpaket D (19.07.2026) - Operativer Rueckfahrten-Leitstand FERTIG
# =========================================================================
# Rein lesende Professionalisierung von MissionReturnsTab. Fuehrt Fahrt,
# Fahrerzuweisung, Fahrtstatus, C2-Match und C3-Zeitbewertung zu genau EINER
# operativen Gruppe pro Rueckfahrt zusammen. Keine neue Datenstruktur, keine
# Migration, kein Schreibweg, keine gespeicherten Zustaende.
#
# Ruecksetzpunkt-Tag: pre-teilpaket-D = 6fee451. Neue Zeilenzahl: 11064.
# (Spec nannte c40cae5 = C3-Code-Commit; echter HEAD war der Doku-Commit 6fee451.)
#
# Bausteine: GEAENDERT (1) MissionReturnsTab. NEU (9): RETURN_CONTROL_CONFIG,
#   RETURN_OPERATIONAL_GROUP_ORDER, RETURN_GROUP_META, RETURN_GROUPS_IN_ORDER,
#   RETURN_STATUS_COMPLETED, RETURN_STATUS_ACTIVE, returnDepartureTs,
#   deriveReturnRideOperationalState, returnGroupSort. ENTFERNT: keine.
#
# Gruppen/Labels: needs_review=Pruefen, overdue=Ueberfaellig,
#   driver_missing=Fahrer fehlt, due_soon=Bald faellig,
#   driver_assigned=Fahrer zugeteilt, in_progress=Laeuft, not_due=Spaeter,
#   completed=Erledigt. Reihenfolge 10..80 (Spec 6). Nur bestehende
#   --mc-st-*-Farben (problem/assigned/new/enroute/idle/done).
#
# Schwellwerte (RETURN_CONTROL_CONFIG): dueSoonWindowMin 60,
#   urgentDriverMissingWindowMin 90, overdueGraceMin 10. Overdue STRENG bei
#   m < -10 (exakt 10 min vorbei = noch NICHT overdue). Grace-Zone (0..10 min
#   vorbei) faellt in due_soon (mit Fahrer) bzw. driver_missing (ohne Fahrer),
#   NICHT in not_due.
#
# Entscheidungskette (genau eine Primaergruppe): completed -> in_progress ->
#   needs_review -> overdue -> driver_missing -> due_soon -> driver_assigned ->
#   not_due. C2/C3 werden 1:1 wiederverwendet (kein zweiter Set-Ende-Rechenweg).
#
# Timer: bestehende 30s -> 60s (Spec 19). Rein Re-Render, kein Schreibweg/DB,
#   clearInterval beim Unmount. View-Model memoisiert, einmal pro Render.
#
# UI: gruppierte Abschnitte (Ueberschrift + Anzahl), Erledigt als Akkordeon,
#   5 operative Zaehler-Kacheln (ersetzen die alten 4 KPIs), Gruppenfilter-Chips
#   + "nur ohne Fahrer". Suche/Sort/Tagesfilter/Presence/MiniMap/Timeline und
#   alle Aktionen (zuweisen/umteilen/Text/oeffnen/anrufen) unveraendert erhalten.
#
# Neue Proof-Skripte: smoke-teilpaket-d.mjs (83 Logiktests),
#   smoke-teilpaket-d-ui.mjs (35 UI/Read-only). Beide nehmen die Quelle als
#   argv[2]. Gegenproben extern belegt (Schwelle 60->61 / Grace 10->9 /
#   Titel / Timer 60000->30000 lassen die passenden Tests fehlschlagen).
#   Hinweis: d-ui rendert MissionReturnsTab -> dyn braucht driverState:{} je
#   Fahrer, sonst wirft computeDriverStats. C2 matcht ueber ride.dayKey.
#
# Verifikation komplett gruen: esbuild, keine Doppelfunktionen, keine
#   undefinierten CSS-Variablen, rendertest 5 Werte konstant (25053/2452/2413/
#   2895/101), kontrast 0, pruefe (nur MissionReturnsTab geaendert, 353/354
#   byte-identisch, alle geschuetzten Kernfunktionen unveraendert), C1 40,
#   C1-UI 16, C2 65, C2-UI 14, C3 147, C3-UI 35, B 69, D 83, D-UI 35,
#   Springer 34, One-Tap 14, Personenzahl 24, Ridelist 10, smoke.mjs
#   (Classic-Reste 0).
# Berichte: TEILPAKET-D-BERICHT.md, TEILPAKET-D-ABNAHME.md (24 Punkte).
#
# -------------------------------------------------------------------------
# OPENER fuer die naechste Session (fertig zum Kopieren)
# -------------------------------------------------------------------------
# Repo: Maybach62S57S/openbeatz-shuttle, main. Hauptdatei src/ShuttleLeitstelle.jsx.
# Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Code-Freeze 21.07.,
# ab 21.07. KEINE Loeschungen mehr (Festival 23.-27.07.).
#
# Stand: Teilpaket A, B, C1, C2, C3 und D abgeschlossen und gepusht.
# Ruecksetzpunkte als Tags: pre-teilpaket-A/-B/-C1/-C2/-C3/-D. Erwartete
# Zeilenzahl src/ShuttleLeitstelle.jsx: 11064 (nach D-Push per git-Hash
# bestaetigen, der Doc-Commit-Hash verschiebt sich).
#
# Schritt 0 (Pflicht): Repo klonen (frischen fine-grained PAT bereitstellen, nach
# Clone aus der Remote-URL scrubben mit `git remote set-url`), `git log --graph
# --oneline --all` pruefen, exakte Zeilenzahl + letzten CODE-Commit-Hash messen,
# npm install (esbuild+react+react-dom), Baseline-Skripte laufen lassen:
# rendertest (5 Werte 25053/2452/2413/2895/101), kontrast (0 Fehler), pruefe
# (self, 0 undefinierte vars), smoke-teilpaket-c1/-c1-ui/-c2/-c2-ui/-c3/-c3-ui/
# -d/-d-ui, Springer/One-Tap/Personenzahl/Ridelist. Erst dann Auftrag entgegennehmen.
# Hinweis: Skripte schreiben nach /home/claude/repo/ -> ggf. node_modules dorthin
# symlinken. Skripte brauchen src/ShuttleLeitstelle.jsx als argv[2]; pruefe.mjs
# braucht ZWEI Pfade; smoke-teilpaket-b.mjs braucht vorab gebaute tmp-tb-funcs.mjs;
# smoke-teilpaket-d-ui.mjs braucht dyn.driverState je Fahrer.
#
# Offene, bewusst NICHT gefixte Punkte (nur auf ausdruecklichen Auftrag):
#   - matchLoc (aktuell Z. ~9634, verschiebt sich - vor Gebrauch neu grep-en)
#     liest nur 4 Hardcode-Orte statt setup.locations. Betrifft D nicht (D nutzt
#     die zentrale Rueckfahrt-Erkennung r.type/r.fromId und die C3-Ortsaufloesung).
#   - "Jetzt/Als Naechstes"-Filter im Timetable-Tab (verschoben).
#   - ARTIST_ALIASES leer - erst bei belegtem Alias-Fall nachtragen.
#   - PIN-Sicherheit: NICHT proaktiv ansprechen.
#   - Leonardo-Ortsobjekt (Sheraton-Adresse uebernehmen) auf Eis, nur auf
#     erneuten ausdruecklichen Auftrag, eigene Session mit Ruecksetzpunkt.
#   - Ab 21.07.: keine Loeschungen mehr (Festival 23.-27.07.).
#
# Naechster Schritt: kein Teilpaket vordefiniert. Vor jeder Umsetzung Spec von
# Jordan einholen (wie bei A/B/C/D). Falls unsicher: obige offene Punkte als
# Vorschlaege nennen. Terminlich: naechster harter Termin ist der Code-Freeze
# 21.07.


<!-- ===================================================================== -->
# Session E (19.07.2026): Teilpaket E – Sichere Wartefahrt-Vorschläge (ABGESCHLOSSEN)

Rein additiv, rein lesend. Rücksetzpunkt Tag `pre-teilpaket-E` = `2dbd3e5`
(= `8a4c107` + Testharness-Fix, kein App-Code). Zeilen 11064 → 11469.
Details im `TEILPAKET-E-BERICHT.md`, Abnahme in `TEILPAKET-E-ABNAHME.md`.

## Was E gebaut hat

Vorschlag „Fahrer wartet am Festival und übernimmt eine unbesetzte Rückfahrt“.
Kein neuer Ride/Status/DB-Feld, keine Zuteilung, kein Schreibweg, keine
Benachrichtigung, kein GPS. Nur Anzeige in der Leitstelle; Aktion über die
vorhandenen Knöpfe „Fahrer zuweisen“ / „Fahrt öffnen“.

Neue reine Funktionen (14 Bausteine): `WAIT_RIDE_CONFIG`, `WAIT_RIDE_STATUS_LABEL`,
`WAIT_RIDE_STATUS_ORDER`, `WAIT_RIDE_ACTIONABLE`, `waitSeverityColor`,
`waitSeverityStKey`, `waitInboundArrival`, `resolveWaitComparisonHub`,
`computeWaitDrivingSaved`, `finalizeWaitCandidate`, `evaluateWaitRideCandidate`,
`waitCandidateCompare`, `rankWaitCandidates`, `buildWaitRideCandidates`.
Geändert wurde nur `MissionReturnsTab` (UI-Block + Filter „nur mit Wartevorschlag“).

Status: `wait_recommended` / `wait_possible` / `direct_connection` /
`return_recommended` / `already_planned` / `not_evaluable`.
Schwellen: Wendezeit 10 min, sinnvoll ab 15 min, Empfehlungsfenster bis 60 min,
mögliches Fenster bis 120 min, Mindest-Einsparung 25 min.

Wiederverwendung (kein zweiter Detektor/Motor): Richtung `rideFestivalDirection`;
Ankunft via `c3OperationalNodes` + `travelMin` (Matrixzeit, nie 0) +
`c3RideStartAbsMin`/`c3AbsToParts` (absolut, mitternachtssicher); Konflikt/
Verfügbarkeit via `evaluateInsertion` (unverändert); Rückfahrt-Status via
`RETURN_STATUS_*`; 60s-Tick der Rückfahrten-Ansicht wiederverwendet.

## Wichtige Design-Entscheidung (wartet auf Jordans GO/NO-GO)

Vergleichs-Hub wird NIE pauschal erfunden. Eine Fahrzeit-Einsparung und damit die
starke Empfehlung `wait_recommended` entsteht nur, wenn `setup.config.driverHubLocationId`
explizit auf einen bekannten Matrix-Knoten != festival gesetzt ist. Ohne diese
Angabe: `comparisonRouteReliable = false`, keine Einsparungsbehauptung, bevorzugt
`wait_possible`. Produktiv (Feld nicht gesetzt) erscheint `wait_recommended` daher
praktisch nicht. Umschalten = ein Konfigfeld. Empfehlung: konservativ so lassen,
bis Jordan entscheidet.

## Verifikation (alle grün)

esbuild grün, keine Duplikate. rendertest 25053/2452/2413/2895/101 konstant.
kontrast 0 Fehler. pruefe (pre-teilpaket-E vs. Arbeitsstand): 362/363 byte-identisch,
GEÄNDERT nur `MissionReturnsTab`, 14 NEU, 0 ENTFERNT, DriverApp/StageApp/GuestApp/
Field/inp/SettingsTab/LocSelect unverändert. smoke-teilpaket-e 152/152.
gegenprobe-teilpaket-e 8/8 kippen. Regression unverändert: smoke Classic-Reste 0,
b69/c1-40/c1ui16/c2-65/c2ui14/c3-147/c3ui35/d83/dui35, Springer34/One-Tap14/
Personenzahl24/Ridelist10.

## Proof-Skripte (committet)

`extract-funcs-teilpaket-e.py` (Verbatim-Extraktor), `smoke-teilpaket-e.mjs`
(152 Prüfungen), `gegenprobe-teilpaket-e.mjs` (8 Mutationen). Generierte
`tmp-te-funcs.mjs`/`tmp-tb-funcs.mjs` NICHT committen (Konvention).

<!-- ===================================================================== -->
# READY-TO-PASTE OPENER für die nächste Session (Stand nach Teilpaket E)

# Rolle: Du übernimmst eine bestehende, sehr disziplinierte Wartungs-Session am
# OpenBeatz Shuttle-Leitstelle (React-Single-File, src/ShuttleLeitstelle.jsx).
# Arbeitsweise: informell, deutsch, keine Gedankenstriche, korrekte Umlaute.
# Prioritäten: 1. Stabilität 2. Datenintegrität 3. Sicherheit 4. Wartbarkeit
# 5. Performance. Nur minimale, begründete Änderungen, keine Breaking Changes.
# Bugs außerhalb des Auftrags -> unter "Weitere gefundene Punkte" sammeln, nicht
# fixen. Nach jeder Änderung: Vollcheck + Build + Regressionsrisiken benennen +
# konkrete manuelle Testfälle. Commit-Messages mit Umlauten via /tmp/msg.txt +
# `git commit -F`. git fetch VOR jedem Push.
#
# Stand: Teilpaket A/B/C/D/E fertig und gepusht. Zeilenzahl src/ShuttleLeitstelle.jsx
# = 11469 (nach E-Push per git-Hash bestätigen; Doc-Commit-Hash verschiebt sich).
#
# Schritt 0 (Pflicht): Repo klonen (frischen fine-grained PAT bereitstellen, PAT
# nur in der Push-URL inline, danach scrubben; NICHT `git remote set-url` auf eine
# PAT-URL), `git log --graph --oneline --all` prüfen, exakte Zeilenzahl + letzten
# CODE-Commit-Hash messen, npm install, Baseline-Skripte laufen lassen:
# rendertest (25053/2452/2413/2895/101), kontrast (0 Fehler), pruefe (ZWEI Pfade:
# Vorher-Stand vs. Arbeitsstand), smoke.mjs (Classic-Reste 0),
# smoke-teilpaket-b/-c1/-c1-ui/-c2/-c2-ui/-c3/-c3-ui/-d/-d-ui/-e,
# gegenprobe-teilpaket-e, Springer/One-Tap/Personenzahl/Ridelist. Erst dann Auftrag.
# Skripte brauchen src/ShuttleLeitstelle.jsx als argv[2]; pruefe.mjs braucht ZWEI
# Pfade; smoke-teilpaket-b.mjs und smoke-teilpaket-e.mjs brauchen vorab gebaute
# tmp-tb-funcs.mjs bzw. tmp-te-funcs.mjs (via extract-funcs-*.py).
#
# Offene Entscheidung aus Teilpaket E:
#   - `driverHubLocationId` in der Konfiguration setzen (aktiviert wait_recommended
#     mit Einsparung) ODER konservativ leer lassen. Jordans GO/NO-GO abwarten.
#
# Offene, bewusst NICHT gefixte Punkte (nur auf ausdrücklichen Auftrag):
#   - matchLoc (verschiebt sich, vor Gebrauch neu grep-en) liest nur 4 Hardcode-
#     Orte statt setup.locations. Betrifft D/E nicht (zentrale Richtungs-/B-Logik).
#   - "Jetzt/Als Nächstes"-Filter im Timetable-Tab (verschoben).
#   - ARTIST_ALIASES leer - erst bei belegtem Alias-Fall nachtragen.
#   - PIN-Sicherheit: NICHT proaktiv ansprechen.
#   - Leonardo-Ortsobjekt (Sheraton-Adresse) auf Eis, nur auf erneuten Auftrag,
#     eigene Session mit Rücksetzpunkt.
#   - Ab 21.07.: KEINE Löschungen mehr (Festival 23.-27.07.).
#
# Nächster Schritt: kein Teilpaket vordefiniert. Vor jeder Umsetzung Spec von
# Jordan einholen (wie bei A/B/C/D/E). Terminlich: harter Code-Freeze 21.07.,
# Fahrertest 18.07. Nach dem Festival ggf. Paket 2 (Datei-Modularisierung,
# Base64-Asset-Extraktion) und zurückgestellte Punkte.
