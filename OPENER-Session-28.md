# Ready-to-paste Opener: Session 28 (MissionControl-Shell auf MC-Design)

Erst PROJEKT-ANWEISUNGEN.md lesen (Achtung: da steht oben eine Warnbox, das
Dokument ist veraltet, der echte Stand steht in UEBERGABE-Session-18.md, ganz
unten). Dann Repo holen. Repo: Maybach62S57S/openbeatz-shuttle.
PAT: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

## ⚠ SCHRITT 0, PFLICHT, BEVOR DU IRGENDWAS BAUST

Glaub diesem Opener NICHT, was den Stand angeht. Der Opener ist eine Absicht,
kein Messwert. Am 16.07. hat das zweimal eine Session gekostet. Also miss:

    git log --graph --oneline --all --decorate | head -20
    for b in $(git branch -r | grep -v HEAD); do
      echo -n "$b: "; git rev-list --left-right --count main...$b; done
    wc -l src/ShuttleLeitstelle.jsx

Wenn irgendein Branch "ahead" von main ist, sag es mir BEVOR du weitermachst.

**Zeilennummern in diesem Opener sind vom 16.07. Sie verschieben sich, sobald
irgendwas davor eingefuegt wird. IMMER per grep gegenpruefen, nie blind
anspringen.**

## STAND, wie er sein SOLLTE (nachmessen!)

    src/ShuttleLeitstelle.jsx = 9076 Zeilen

Scheibe 2 (GuestLinksSection) liegt auf `fix/session-27b-scheibe2`.
**Commit-Hashes sind KEIN verlaesslicher Messwert** (der Branch wurde am 16.07.
rebaset, die aelteren Doku-Hashes 3dedb46/46c86f1 sind tot). Zeilenzahl und
Blob-Hash sind es.

Gegenprobe in einer Zeile:

    node smoke27b-settings.mjs src/ShuttleLeitstelle.jsx | grep "Lauf A ("

Muss bei **12 Rest-Klassen** stehen. 14 = Scheibe 2 fehlt.

### ⚠ WOVON DU ABZWEIGST. MISS ES.

    git rev-list --left-right --count main...origin/fix/session-27b-scheibe2

- Rechts = 0 -> gemergt, von `main` abzweigen.
- Rechts > 0 -> NICHT gemergt, von `origin/fix/session-27b-scheibe2` abzweigen.

Sag mir, was du gemessen hast, bevor du den Branch anlegst.

### ⚠ Und miss NOCHMAL, kurz bevor du pushst

    git fetch origin && git rev-list --left-right --count origin/main...HEAD

Am 16.07. ist main WAEHREND der Session weitergelaufen und der FF-Merge ging
nicht mehr. Einmal messen am Anfang reicht nicht.

Classic ist seit Session 19 bis 24 komplett raus. Mission Control ist die
einzige Leitstellen-Oberflaeche.

## ⚠ DIESE SESSION IST ANDERS ALS 27a BIS 27e: DU FASST DIE SHELL AN

`MissionControl` ist nicht ein Tab, sondern der Rahmen, der alles rendert. Das
ist das einzige verbleibende Stueck mit echtem Regressionsrisiko. Deshalb
laeuft sie ZUERST und nicht zuletzt: was hier schiefgeht, will ich vor dem
Fahrertest am Samstag merken, nicht danach.

**Sei hier langsamer als sonst.** Lieber in zwei Scheiben committen als in
einer. Bei jedem Zweifel: fragen, nicht raten.

## AUFTRAG: die 31 Classic-Treffer in MissionControl

Gemessen am 16.07.: `MissionControl` = Z. 7909 bis 8528, **620 Zeilen**, 31
Treffer, verteilt auf **genau drei Bloecke**. Der Rest der Shell ist schon MC
(122 MC-Treffer). Erreichbarkeit vor dem Bauen NEU messen:

    node rg.mjs src/ShuttleLeitstelle.jsx MissionControl

### Block A: Fehler-Toasts (Z. 8040, 1 Treffer)

    className="bg-red-600 text-white text-sm px-3.5 py-2.5 rounded-xl shadow-lg ..."

Solides Rot als Vollflaeche. Haengt an `errToasts` (useState, Startwert `[]`).

### Block B: Statusleiste (Z. 8051 und 8063, 2 Treffer)

- 8051: `bg-orange-500` Puls-Punkt (`ob-pulse`)
- 8063: Push-Status-Punkt, `bg-emerald-400` / `bg-red-400` / `bg-stone-600`
  je nach `push.status` (active / denied / error / sonst)

**Achtung bei 8051:** das ist Markenorange fuer einen Live-Zustand. Es gibt
`.mc-live-dot` in MissionStyles, gebaut genau dafuer (ruhiger Puls, `--mc-st-done`),
plus `.mc-live-dot--off`. Pruef, ob das hier die richtige Klasse ist, statt eine
neue zu bauen. Wenn ja, faellt auch `ob-pulse` weg, dann sag es mir vorher.

### Block C: Problem-Banner (Z. 8171 bis 8201, 28 Treffer, der Brocken)

Der taguebergreifende Banner ueber offenen Problem-Meldungen. Aufbau:

- 8171 Huelle: `border-red-500/40 bg-red-500/10`
- 8172 Kopf: `text-red-200`
- 8174 Kritisch-Badge: `bg-red-500 text-white`
- 8183 Zeile: `bg-red-500/15 border-red-500/30` (kritisch) vs `bg-stone-950/40`
- 8184/8185 Zeit + Fahrer: `text-stone-300`
- 8186 Artist: `text-orange-300`
- 8187 Problemtext: `text-red-300`
- 8188 "!"-Badge: `bg-red-500 text-white`
- 8191 Uhrzeit: `text-stone-500`
- 8192 Status-Chip: `bg-amber-500/20 text-amber-300` (in Arbeit) vs
  `bg-red-500/20 text-red-300` (offen)
- 8198 "Notfall": `text-orange-300`
- 8199 "oeffnen": `text-stone-400`
- 8200 "in Arbeit": `bg-amber-600/80 text-white`
- 8201 "erledigt": `bg-stone-800 text-stone-200`

## ⚠ ENTSCHEIDUNG, die ich treffe, NICHT du

Der Banner und die Toasts sind heute **solides Tailwind-Rot**. Die MC-Konvention
ist Zurueckhaltung: `.mc-note--error` mit 12 Prozent Flaeche, die Farbe warnt,
die Flaeche schreit nicht (genau der Rueckbau aus 27a-3 am Flug-Block).

Konsequent uebersetzt wird der Banner damit **deutlich ruhiger als heute**. Das
ist eine sichtbare Verhaltensaenderung an der Stelle, die mich nachts um drei
anspringen soll. **Bau das nicht einfach durch.**

Gemessen, damit es keine Geschmacksfrage ist: lesbar ist beides schon jetzt.
Banner-Text 11.54, Zeilentext 8.33, Toast 4.83, Kritisch-Badge 3.76 (Badge,
laeuft auf AA-large, nach der Skript-Regel ok). MC-Konvention `.mc-note--error`
5.34. **Es geht nicht um Lesbarkeit, es geht um Lautstaerke.**

Leg mir 2 bis 3 Varianten vor, mit Kontrastzahlen, und begruende sie:
- Wie laut bleibt der Banner? Volle Flaeche wie heute, oder `.mc-note--error`?
- Bleibt "kritisch" lauter als "offen"? Die Abstufung kritisch > offen >
  in Arbeit muss auf einen Blick erkennbar bleiben, das ist der Zweck des Dings.
- Toasts: eigene Klasse (`.mc-toast-error`?) oder `.mc-note--error`? Ein Toast
  schwebt ueber dem Inhalt, eine Note sitzt drin. Kann sein, dass die 12 Prozent
  fuer einen schwebenden Toast zu wenig Deckung sind. Miss das, rate nicht.

Dann warte auf mein OK. Erst danach bauen.

## Farbregel, hier besonders relevant

    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen ("knapp")
    Blau   (--mc-st-new)      = Status "neu"
    Rot    (--mc-st-problem)  = Problem
    Van = Amber, Car = Blau

Im Banner steckt derselbe Regelbruch wie bei den Van-Badges (1b) und dem
Sicherheitshinweis (Scheibe 2): **Orange fuer Nicht-Marke.** Z. 8186 faerbt den
Artistnamen orange, Z. 8198 den "Notfall"-Knopf orange, Z. 8051 den Live-Punkt.
Der "Notfall"-Knopf ist evtl. wirklich eine Hauptaktion, dann ist Orange dort
korrekt. Der Artistname ist es nicht. **Sag mir pro Stelle, was du vorschlaegst.**

## ⚠ TOGGLE-FALLE: der Banner ist fast unsichtbar im Render-Test

`if (withIssues.length === 0) return null;` — im Startzustand ist der Banner
**gar nicht da**. Ein naiver Render-Test rendert null und meldet triumphierend
0 Classic-Reste. Das waere ein wertloser Beweis.

Zustaende, die geseedet werden muessen (ueber `dyn.rides`, nicht ueber useState):
- kein Problem -> Banner weg (Grundzustand)
- ein offenes Problem, unkritisch
- mehrere Probleme
- `critical.length > 0` -> "X× kritisch"-Badge im Kopf
- `isCrit` pro Zeile -> rote Zeilenflaeche + "!"-Badge
- `inProgress` -> "in Bearbeitung" statt "offen", "in Arbeit"-Knopf verschwindet
- Fahrt ohne Fahrer -> "kein Fahrer"
- Toasts: `errToasts` ist useState mit `[]` -> aus globalThis seeden
- Push-Punkt: `push.status` active / denied / error / sonst -> vier Zustaende

smoke27b-settings.mjs, smoke27b-sections.mjs und smoke27b-guest.mjs sind das
fertige Muster: WEGWERF-KOPIE der Datei, useState-Startwerte aus globalThis
geseedet, Kopie kompilieren, echt rendern, Original unangetastet. KOPIER DAS.

**Und mach die GEGENPROBE:** denselben Smoke-Test gegen die ALTE Datei laufen
lassen (`cp src/ShuttleLeitstelle.jsx /tmp/alt.jsx` VOR der ersten Aenderung).
Wenn dort nicht jeder Zustand FEHLER meldet und jede geseedete Klasse in genau
ihrem Zustand auftaucht, ist dein Test wertlos. Das hat sich in Scheibe 2
bewaehrt: dort hat die Gegenprobe 11 bis 17 Reste pro Zustand gefunden und
damit bewiesen, dass jeder Zustand den Zielcode wirklich erreicht.

## TABU, hier besonders wichtig

- **Der Fallschirm.** `MissionControlBoundary` (Z. 1253), `handleMcFallback`,
  `mcBlocked`, `mcFailReason` (Z. 767 ff), `MissionControlFallbackScreen`.
  Er sitzt im App-Root, NICHT in MissionControl, die 31 Treffer fassen ihn
  nicht an. **Lass ihn so.** Er laeuft nur, wenn schon alles andere kaputt ist,
  und ist damit das einzige Stueck, das man nicht durch Hinschauen testen kann.
  Die Fehlerseite bleibt bewusst im alten Look, das ist mir egal, sie erscheint
  nur nach einem Absturz.
- **`setDay` in Z. 8198/8199 NICHT anfassen.** Da steht ein Kommentar, warum:
  der Banner ist taguebergreifend, der Probleme-Tab ist tagesgefiltert. Ohne
  `setDay` landet man auf einem leeren Tab. Das ist Logik, kein Design.
- **`setIssueState`, `updateDyn`, `logRide`, `notifyErr` NICHT anfassen.** Der
  Banner schreibt echte Daten. NUR className/Style.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
  Fuer MissionControl sind das u. a. `Field`, `Modal`, `ZoneChip`, `ZONE_STYLE`,
  `STATUS_FLOW`, `FLIGHT_STATUS`, `inp`. Fuer `Field` und `Modal` gibt es die
  fertige Antwort (`<Field mc>`, `<Modal mc>`), erfinde nichts Neues.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, Stage bleibt read-only.
  Fahrer/Stage/Gast auf MC-Design ist NICHT Thema.

## BELEGE, die ich sehen will. Die Skripte liegen im Repo, benutz die.

- `cp src/ShuttleLeitstelle.jsx /tmp/alt.jsx` VOR der ersten Aenderung.
- `pruefe.mjs /tmp/alt.jsx src/ShuttleLeitstelle.jsx`: GEAENDERT genau
  MissionControl (+ MissionStyles, falls eine neue Klasse noetig ist). ALLES
  andere byte-identisch, insbesondere DriverApp, StageApp, GuestApp,
  IssueModal, StageIssueModal, GuestIssueModal, inp, Field, Modal, und die
  Fallschirm-Teile.
- `rendertest.mjs`: Sollwerte KONSTANT: App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
  **Der App-Root-Wert 25053 ist hier dein wichtigster Waechter**, weil du die
  Shell anfasst.
- `smoke27b-settings.mjs` (12/0), `smoke27b-sections.mjs` (15/0),
  `smoke27b-guest.mjs` (16/0) muessen unveraendert durchlaufen.
- Neuer Smoke-Test fuer die Shell, mit Gegenprobe. Siehe Toggle-Falle oben.
- `kontrast.mjs`: Stand 19 Kombis, 0 Fehler. Muss so bleiben. Neue Kombis
  einzeln nachrechnen und mir die Zahlen zeigen.
- Jede var(--mc-*) einzeln gegen MissionStyles (pruefe.mjs macht das mit).
  Eine Variable, die es nicht gibt, macht die ganze CSS-Regel ungueltig und
  esbuild meldet das NIE.
- esbuild ist KEIN Beweis (in Session 23, 24, 27a je mit Gegenprobe belegt).
- git diff --patience.

## REGELN, teuer gelernt

- Erreichbarkeit IMMER transitiv messen, KONSTANTEN mitsammeln.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter.
- SectionHeader und IconButton reichen KEINE Klasse ans Icon durch. Wo ein Icon
  gedreht/gefaerbt werden soll: eigener Wrapper (siehe ExportIcon) oder eigener
  Button mit className="mc-iconbtn" (Groesse per w-7 h-7 ueberschreibbar).
- Weiche Fuellungen (-soft) sind bei 30 Prozent flaechig SEHR laut. Fuer Badges
  gedacht, nicht fuer Panels. Fuer Hinweisboxen gibt es `.mc-note--warn` /
  `.mc-note--error` (12 Prozent). Benutz die, bau keine neue Flaeche ohne
  Ruecksprache.
- Kein inline background auf etwas mit .mc-ride-card (schlaegt die Klasse und
  legt den :hover tot). borderLeft inline ist ok.
- MissionStyles darf angefasst werden, wenn es die RICHTIGE Stelle ist. Aber
  die Klassen sind geteilt. Vorher messen, wen es sonst trifft, und es mir
  SAGEN. Neue Klassen mit neuem Namen sind unkritisch. In Scheibe 2 war gar
  keine Aenderung noetig, alles war schon da.
- MEINE HAUPTSACHE: es soll richtig gut aussehen UND richtig gut lesbar sein.
  Faellt dir unterwegs etwas Unruhiges oder schlecht Lesbares auf, sag es mir,
  auch wenn es nicht im Auftrag steht. Nicht heimlich aendern, aber auch nicht
  verschweigen.
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Neon.
- Nur EINE Session gleichzeitig offen. Am 16.07. liefen versehentlich zwei am
  selben Baustein, das ging nur gut, weil Git den zweiten Push abgelehnt hat.

## OFFENE PUNKTE, die ich kenne, NICHT heimlich fixen

1. Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf --mc-brand),
   unter AA. Kein Regress, Classic hatte denselben Wert. Haengt an
   `.mc-btn-primary` und damit an den Speichern-Knoepfen in SettingsTab und
   am Gast-Link-Block. Wenn du sie einbaust, sag es mir.
2. `color-scheme: dark` fehlt komplett. Folge: Uhr-/Kalender-Knoepfe in
   type="time"/type="date"-Feldern und die vom Betriebssystem gezeichneten
   Auswahllisten kommen im Hellmodus-Look auf dunklem Grund. Kein Regress.
   Die richtige Stelle waere EINE Zeile in `.mc-scope`, sie traefe aber alles
   darunter. Sag es mir, aendere es nicht nebenbei.
3. Van/Car-Badges haben durch die 27e-Farbregel weniger Kontrast als der alte
   Classic-Ton (Van 8.96 -> 5.08, Car 9.09 -> 3.84, bei 10px). Car liegt unter
   AA. Eine Absenkung der Badge-Fuellung von 30 auf 16 Prozent wuerde Van auf
   7.15 und Car auf 4.93 heben, traefe aber `.mc-badge` global. Eigene
   Entscheidung, nicht nebenbei.
4. PROJEKT-ANWEISUNGEN.md ist veraltet und hat nur eine Warnbox oben. Richtig
   aufraeumen waere eine eigene kleine Doku-Session wert.
5. Der Untertitel des Gast-Link-Blocks ist der laengste auf der Seite (rund
   vier Zeilen text-xs). Kein Regress. Der Sicherheitshinweis koennte in eine
   eigene `.mc-note mc-note--warn`. Das waere Struktur, nicht Farbe.

## ABLAUF

Branch: `fix/session-28-shell`, abgezweigt von dem Stand, den du oben gemessen
hast. Nach meinem OK FF-Merge. Commit ueber /tmp/msg.txt (Umlaute). Sprache
Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Warn mich
RECHTZEITIG, wenn der Chat zu lang wird, nicht erst wenn es knapp ist.

Reihenfolge in dieser Session:
1. Schritt 0 messen und melden.
2. Erreichbarkeit + die drei Bloecke neu messen, mir die Zahlen zeigen.
3. **Varianten fuer die Banner-Lautstaerke vorlegen und auf mein OK warten.**
4. Erst dann bauen, moeglichst in zwei Scheiben (B+A klein, C gross).
5. Belege, Regressionsrisiken, manuelle Testfaelle.
6. UEBERGABE-Session-18.md fortschreiben, Opener fuer Session 29.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle.

## DER PLAN, wo diese Session drinsitzt

Danach ist der MC-Scope bei 0 Classic:

| # | Session | Umfang | Risiko |
|---|---|---|---|
| **28** | **MissionControl-Shell** | **31 Treffer, 3 Bloecke** | **hoch (die Shell)** |
| 29 | PresenceManager (Z. 5055, 63 Zeilen, 30 Treffer, 0 MC) + MissionTimelinePage-Rest (6) | 36 Treffer | niedrig |
| 30 | AuditLogSection (Z. 4753) + ReportSection (Z. 5985), zusammen 108 Zeilen | 52 Treffer | niedrig |

**`PresenceManager` stand nie in der Zwoelfer-Planungstabelle** und wurde
deshalb von 27a bis 27e nie angefasst. Er haengt in `MissionReturnsTab` unter
"Anwesenheit verwalten". Das ist eine Luecke im Plan, kein Restposten.

In Session 30 wartet eine Entscheidung: `ReportSection` benutzt Orange fuer
STATUS (KPI "Offen" / "Ohne Fahrer" / "Offene Rueckf.", Fahrer-Balken).

## ZEITFENSTER

Festival 23. bis 27.07. Fahrertest mit mehreren Fahrern ab Samstag 18.07.
Ab 21.07. wird nichts mehr geloescht.

Die Shell laeuft bewusst zuerst: was hier schiefgeht, will ich VOR dem
Fahrertest merken. Wenn etwas dazwischenkommt, ist Session 30 (SettingsTab)
der Streichkandidat, nicht diese hier. SettingsTab sehe ich waehrend des
Festivals praktisch nie, den Problem-Banner dagegen jede Nacht.
