Erst PROJEKT-ANWEISUNGEN.md lesen (Achtung: da steht oben eine Warnbox, das
Dokument ist veraltet, der echte Stand steht in UEBERGABE-Session-18.md, ganz
unten unter "Session 27b"). Dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

## ⚠ SCHRITT 0, PFLICHT, BEVOR DU IRGENDWAS BAUST

Glaub diesem Opener NICHT, was den Stand angeht. Der Opener ist eine Absicht,
kein Messwert. Am 16.07. hat genau das eine Session gekostet. Also miss:

    git log --graph --oneline --all --decorate | head -20
    for b in $(git branch -r | grep -v HEAD); do
      echo -n "$b: "; git rev-list --left-right --count main...$b; done
    wc -l src/ShuttleLeitstelle.jsx

Wenn irgendein Branch "ahead" von main ist, sag es mir BEVOR du weitermachst.

## STAND, wie er sein SOLLTE (nachmessen!)

Session 27b Scheibe 1a+1b liegt auf `fix/session-27b-settings` (Commits
`a4fc182` und `9cecaa2`). **Wenn ich schon FF-gemergt habe, ist es auf main.**
Zeilenzahl ist der verlaessliche Messwert, nicht der Hash:

    src/ShuttleLeitstelle.jsx = 9074 Zeilen
    letzter Code-Commit       = 9cecaa2 "Design: die vier kleinen Settings-Bausteine auf MC (27b, Scheibe 1b)"

Wenn du 9074 Zeilen misst und 9cecaa2 in der Historie steht, ist der Stand
richtig. Wenn nicht, sag es mir BEVOR du baust.

Classic ist seit Session 19 bis 24 komplett raus. Mission Control ist die
einzige Leitstellen-Oberflaeche.

## AUFTRAG 27b, Scheibe 2: GuestLinksSection auf MC-Design

**Erreichbarkeit vor dem Bauen NEU messen**, nicht meiner Zahl glauben:

    node rg.mjs src/ShuttleLeitstelle.jsx GuestLinksSection

Gemessen am 16.07.: `GuestLinksSection` Z. 4578, 125 Zeilen, **nur von
MissionControl erreichbar**, kein Fahrer-/Stage-/Gast-Pfad. Tabu-Kinder mit
Design-Bezug: genau `inp` und `Field`. Fuer beide gibt es die fertige Antwort,
NICHT neu erfinden:

    inp    -> Konstante mcInp
    Field  -> <Field mc ...>

Der Rest im Tabu-Baum (`copyText`, `hasSupabase`, `AlertTriangle`, `Check`,
`Copy`) ist Logik und Icons, keine Farbe. Nicht anfassen.

**Scheibe 2 ist NUR GuestLinksSection.** Danach committen und pushen. Scheibe 3
(AuditLogSection Z. 4751 + ReportSection Z. 5983, zusammen 108 Zeilen) ist eine
eigene Session.

### Das Muster liegt fertig im Repo, kopier es

Scheibe 1a/1b hat SettingsTab, DriverPhones, DispatcherUsers,
AccessPinsSection und PushSettingsSection schon umgebaut. **Mach es genauso**,
sonst sieht die Seite halb-halb aus:

- h3 + p -> `<SectionHeader icon={...} title="..." subtitle="..." className="mb-3" />`
  (subtitle nimmt auch JSX, falls im Text ein span steckt)
- Eingaben -> `mcInp` bzw. `className="mc-input ..."`
- Speichern -> `.mc-btn-primary`, Zweitknopf -> `.mc-btn-quiet`,
  destruktiv -> `.mc-btn-danger`, Icon-Knopf -> `.mc-iconbtn`
- "gespeichert" -> `--mc-st-done`, Fehler -> `--mc-st-problem`,
  Warnung -> `--mc-st-assigned`, Hinweisbox -> `.mc-note mc-note--warn`
- Van = Amber (`--mc-st-assigned`), Car = Blau (`--mc-st-new`)

### ⚠ TOGGLE-FALLE, und die Loesung liegt schon im Repo

Ein Render-Test sieht nur den Zustand, in dem eine Komponente STARTET.
GuestLinksSection ist voll davon und waere sonst NICHT belegt:

- Link erzeugen / Tokenliste leer vs. gefuellt
- Link kopieren (`copyText`), Kopiert-Bestaetigung
- Vorschau (`onPreviewGuest`)
- `coordPhone`-Warnung (`phoneLooksInvalid`), inline unterm Feld
- `hasSupabase` an/aus (der Sicherheitshinweis haengt daran)
- gespeichert / Speicherfehler

`smoke27b-settings.mjs` und `smoke27b-sections.mjs` (beide neu aus 27b) sind
das fertige Muster: WEGWERF-KOPIE der Datei, useState-Startwerte der
Zielkomponente aus `globalThis` geseedet, Kopie kompilieren, echt rendern,
Original unangetastet. **KOPIER DAS.** 15 bzw. 22 Zustaende sind der Massstab,
nicht einer.

## BELEGE, die ich sehen will. Die Skripte liegen im Repo, benutz die.

- `pruefe.mjs <alt.jsx> <neu.jsx>`: genau GuestLinksSection geaendert, ALLES
  andere byte-identisch, insbesondere DriverApp, StageApp, GuestApp,
  IssueModal, StageIssueModal, GuestIssueModal, `inp`, `Field`. Vorher
  `cp src/ShuttleLeitstelle.jsx /tmp/alt.jsx`.
- `rendertest.mjs <datei.jsx>`: Sollwerte KONSTANT: App-Root 25053,
  IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
- `smoke27b-settings.mjs <datei.jsx>`: **der Rest-Zaehler in Lauf A ist der
  Fortschrittsbalken.** Stand jetzt 14 Rest-Klassen, sie stammen aus
  GuestLinksSection + AuditLogSection + ReportSection. Nach Scheibe 2 muss er
  sinken, Lauf B muss auf 0 bleiben.
- `kontrast.mjs`: liest LIVE aus MissionStyles. Stand: 19 Kombis, 0 Fehler.
  Muss so bleiben. Neue Kombis einzeln nachrechnen.
- Jede `var(--mc-*)` einzeln gegen MissionStyles (`pruefe.mjs` macht das mit).
  Eine Variable, die es nicht gibt, macht die ganze CSS-Regel ungueltig und
  esbuild meldet das NIE.
- **esbuild ist KEIN Beweis** (in Session 23, 24, 27a je mit Gegenprobe belegt).
- `git diff --patience`.

## REGELN, teuer gelernt

- Erreichbarkeit IMMER transitiv messen, KONSTANTEN mitsammeln.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter.
- **SectionHeader und IconButton reichen KEINE Klasse ans Icon durch.** Wo ein
  Icon gedreht/gefaerbt werden soll: eigener Wrapper (siehe `ExportIcon` aus
  27b) oder eigener Button mit `className="mc-iconbtn"` (siehe FlightTab 27e).
- Farbbedeutungen, verbindlich, nicht mischen:
    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen ("knapp")
    Blau   (--mc-st-new)      = Status "neu"  |  Rot (--mc-st-problem) = Problem
    Van = Amber, Car = Blau
- **Weiche Fuellungen (-soft) sind bei 30 Prozent flaechig SEHR laut.** Fuer
  Badges gedacht, nicht fuer Panels. Fuer Hinweisboxen gibt es seit 27b
  `.mc-note--warn` / `.mc-note--error` (12 Prozent). **Benutz die**, bau keine
  neue Flaeche.
- Kein inline `background` auf etwas mit `.mc-ride-card` (schlaegt die Klasse
  und legt den `:hover` tot). `borderLeft` inline ist ok.
- MissionStyles darf angefasst werden, wenn es die RICHTIGE Stelle ist. Aber
  die Klassen sind geteilt. Vorher messen, wen es sonst trifft, und es mir
  SAGEN. Neue Klassen mit neuem Namen sind unkritisch.
- MEINE HAUPTSACHE: es soll richtig gut aussehen UND richtig gut lesbar sein.
  Faellt dir unterwegs etwas Unruhiges oder schlecht Lesbares auf, sag es mir,
  auch wenn es nicht im Auftrag steht. Nicht heimlich aendern, aber auch nicht
  verschweigen.
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Neon.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm, Stage
  bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema.

## OFFENE PUNKTE, die ich kenne, NICHT heimlich fixen

1. Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf `--mc-brand`),
   unter AA. Kein Regress, Classic hatte denselben Wert. Haengt an
   `.mc-btn-primary` und damit auch am Speichern-Knopf in SettingsTab. Wenn du
   sie einbaust, sag es mir, aendere sie nicht eigenmaechtig.
2. `color-scheme: dark` fehlt komplett. Folge: Uhr-/Kalender-Knoepfe in
   `type="time"`/`type="date"`-Feldern und die vom Betriebssystem gezeichneten
   Auswahllisten kommen im Hellmodus-Look auf dunklem Grund. Kein Regress.
   Die richtige Stelle waere EINE Zeile in `.mc-scope`, sie traefe aber alles
   darunter. Sag es mir, aendere es nicht nebenbei.
3. **Neu aus 27b:** Van/Car-Badges haben durch die 27e-Farbregel weniger
   Kontrast als der alte Classic-Ton (Van 8.96 -> 5.08, Car 9.09 -> **3.84**,
   bei 10px). Kein Alleingang, die Kombination steckt seit 27e in AssignModal,
   und `kontrast.mjs` fuehrt Badges auf der AA-large-Schwelle als ok. Aber Car
   liegt unter AA. Eine Absenkung der Badge-Fuellung von 30 auf 16 Prozent
   wuerde Van auf 7.15 und Car auf 4.93 heben, traefe aber `.mc-badge` global.
   Eigene Entscheidung, nicht nebenbei.
4. **`PROJEKT-ANWEISUNGEN.md` ist veraltet** und hat seit 27b nur eine Warnbox
   oben. Richtig aufraeumen waere eine eigene kleine Doku-Session wert.

## ABLAUF

Branch: `fix/session-27b-scheibe2` von main. Nach meinem OK FF-Merge auf main.
Commit ueber /tmp/msg.txt (Umlaute). Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. **Warn mich RECHTZEITIG, wenn der Chat zu
lang wird, nicht erst wenn es knapp ist.** In 27b war nach zwei Scheiben Schluss,
das war die richtige Groesse.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
UEBERGABE-Session-18.md fortschreiben, Opener fuer die naechste Session.

## ZEITFENSTER

Bauen bis Freitagabend 17.07. Ab Samstag 18.07. ist Ruhe, dann teste ich mit
mehreren Fahrern. Was am Festival laufen soll, muss VOR dem Test drin sein.
Ab 21.07. wird nichts mehr geloescht. Festival 23. bis 27.07.

**SettingsTab ist der Streichkandidat, den sehe ich waehrend des Festivals
praktisch nie.** Scheibe 1 (Rahmen + die vier kleinen) ist durch, die Seite ist
damit schon kein Bruch mehr. Wenn die Zeit knapp wird oder etwas Wichtigeres
dazwischenkommt: Scheibe 2 und 3 ersatzlos streichen, nicht halb bauen.
