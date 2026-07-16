# Ready-to-paste Opener: Session 27b, Scheibe 3 (Stand 16.07., nach Scheibe 2)

Erst PROJEKT-ANWEISUNGEN.md lesen (Achtung: da steht oben eine Warnbox, das
Dokument ist veraltet, der echte Stand steht in UEBERGABE-Session-18.md, ganz
unten unter "Session 27b Scheibe 2"). Dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT: <HIER DEIN PAT>
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

## STAND, wie er sein SOLLTE (nachmessen!)

Scheibe 2 (GuestLinksSection) liegt auf `fix/session-27b-scheibe2`.
**Zeilenzahl ist der verlaessliche Messwert, Commit-Hashes NICHT** (der Branch
wurde am 16.07. rebaset, die in der Doku genannten Hashes 3dedb46/46c86f1
existieren nicht mehr):

    src/ShuttleLeitstelle.jsx = 9076 Zeilen

Wenn du 9076 misst und GuestLinksSection keine stone-/orange-Klassen mehr hat,
ist der Stand richtig. Gegenprobe in einer Zeile:

    node smoke27b-settings.mjs src/ShuttleLeitstelle.jsx | grep "Lauf A ("

Lauf A muss bei **12 Rest-Klassen** stehen. 14 = Scheibe 2 fehlt. 0 = schon
fertig, dann melde dich, bevor du irgendwas baust.

### ⚠ WOVON DU ABZWEIGST, haengt davon ab, ob ich schon gemergt habe. MISS ES.

    git rev-list --left-right --count main...origin/fix/session-27b-scheibe2

- Rechts = 0  -> gemergt, Scheibe 2 ist auf main. Von `main` abzweigen.
- Rechts > 0  -> NICHT gemergt. Von `origin/fix/session-27b-scheibe2`
  abzweigen, NICHT von main. Sonst baust du Scheibe 3 auf einem Stand ohne
  Scheibe 2 und gabelst die Historie.

Sag mir in beiden Faellen, was du gemessen hast, bevor du den Branch anlegst.

### ⚠ Und miss NOCHMAL, kurz bevor du pushst

    git fetch origin && git rev-list --left-right --count origin/main...HEAD

Am 16.07. ist main WAEHREND der Session weitergelaufen und der FF-Merge ging
nicht mehr. Einmal messen am Anfang reicht nicht.

Classic ist seit Session 19 bis 24 komplett raus. Mission Control ist die
einzige Leitstellen-Oberflaeche.

## AUFTRAG: Scheibe 3, der Rest von SettingsTab

Danach ist SettingsTab fertig und der Rest-Zaehler bei 0.

Erreichbarkeit vor dem Bauen NEU messen, nicht meiner Zahl glauben:

    node rg.mjs src/ShuttleLeitstelle.jsx AuditLogSection ReportSection

Gemessen am 16.07. (nach Scheibe 2):

| Baustein | Zeile | Laenge | erreichbar von |
|---|---|---|---|
| `AuditLogSection` | 4753 | 54 Zeilen | nur MissionControl |
| `ReportSection`   | 5985 | 54 Zeilen | nur MissionControl |

**Gute Nachricht: keiner der beiden hat ein Tabu-Kind mit Design-Bezug.**
Weder `inp` noch `Field`. Die Tabu-Kinder sind reine Logik und muessen NICHT
angefasst werden:
- AuditLogSection -> WD, dayTabs, fmtDate, pad
- ReportSection -> WD, computeDriverStats, dayNowMin, driverDay, effDur,
  flightDelayed, fmtDate, localDateISO, pad, sortMin, toMin, todayISO

Scheibe 3 ist NUR diese beiden. Danach committen und pushen.

### Das Muster liegt fertig im Repo, kopier es

Scheibe 1a/1b/2 haben SettingsTab, DriverPhones, DispatcherUsers,
AccessPinsSection, PushSettingsSection und GuestLinksSection schon umgebaut.
Mach es genauso:

- h3 + p -> <SectionHeader icon={...} title="..." subtitle="..." className="mb-3" />
- Eingaben -> mcInp bzw. className="mc-input ..."
- Speichern -> .mc-btn-primary, Zweitknopf -> .mc-btn-quiet,
  destruktiv -> .mc-btn-danger, Icon-Knopf -> .mc-iconbtn (Groesse per w-7 h-7
  ueberschreiben, siehe Z. 3757 / 7195 / GuestLinksSection)
- Zeilenflaeche bg-stone-950/50 -> style={{ background: "var(--mc-inset)" }}
  (Muster Z. 5385 und GuestLinksSection)
- Trennlinie -> style={{ borderBottom: "1px solid var(--mc-border)" }}
- "gespeichert" -> --mc-st-done, Fehler -> --mc-st-problem,
  Warnung -> --mc-st-assigned, Hinweisbox -> .mc-note mc-note--warn
- Van = Amber (--mc-st-assigned), Car = Blau (--mc-st-new)

### ⚠ ENTSCHEIDUNG, die ich treffen muss, NICHT du

`ReportSection` benutzt **Orange fuer Status**, das ist derselbe Regelbruch wie
bei den Van-Badges (Scheibe 1b) und dem Sicherheitshinweis (Scheibe 2):

- KPI-Kacheln Z. 6000: "Offen", "Ohne Fahrer", "Offene Rueckf." sind
  `text-orange-400`. Orange ist laut Regel die MARKE, kein Status.
- Fortschrittsbalken pro Fahrer: `bg-orange-500`, also Marke fuer einen
  neutralen Mengenbalken.

Das ist keine Farbe-zu-Variable-Uebersetzung, sondern eine Bedeutungsfrage.
**Schlag mir Varianten vor und begruende sie, aber entscheide nicht allein.**
Die anderen KPI-Farben sind eindeutig: Erledigt -> --mc-st-done, Probleme ->
--mc-st-problem, Verspaetet -> --mc-st-assigned, Abgesagt/neutral ->
--mc-text-secondary.

### ⚠ TOGGLE-FALLE, und die Loesung liegt schon im Repo

Ein Render-Test sieht nur den Zustand, in dem eine Komponente STARTET.

- `AuditLogSection` startet mit `dayFilter="all"` und `q=""`. Nicht belegt
  waeren sonst: Tagesfilter aktiv, Suchtreffer, **leerer Suchtreffer**,
  leerer Tag, langes Log.
- `ReportSection` hat keinen eigenen useState, haengt aber komplett an `day`
  und `dyn.rides`. Zustaende ueber Props seeden: leerer Tag, nur abgesagte
  Fahrten, Fahrten mit Problemen, verspaetete Fluege, offene Rueckfahrten,
  perDriver leer, perRoute leer.

smoke27b-settings.mjs, smoke27b-sections.mjs und smoke27b-guest.mjs sind das
fertige Muster: WEGWERF-KOPIE der Datei, useState-Startwerte der
Zielkomponente aus globalThis geseedet, Kopie kompilieren, echt rendern,
Original unangetastet. KOPIER DAS.

**Und mach die GEGENPROBE:** denselben Smoke-Test gegen die ALTE Datei laufen
lassen (cp src/ShuttleLeitstelle.jsx /tmp/alt.jsx vor der Aenderung). Wenn dort
nicht jeder Zustand FEHLER meldet und jede geseedete Klasse in genau ihrem
Zustand auftaucht, ist dein Test wertlos und beweist nichts. Das hat sich in
Scheibe 2 bewaehrt.

## BELEGE, die ich sehen will. Die Skripte liegen im Repo, benutz die.

- `cp src/ShuttleLeitstelle.jsx /tmp/alt.jsx` VOR der ersten Aenderung.
- `pruefe.mjs /tmp/alt.jsx src/ShuttleLeitstelle.jsx`: GEAENDERT genau
  AuditLogSection und ReportSection, ALLES andere byte-identisch, insbesondere
  DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal, GuestIssueModal,
  inp, Field.
- `rendertest.mjs`: Sollwerte KONSTANT: App-Root 25053, IssueModal 2452,
  StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101.
- `smoke27b-settings.mjs` Lauf A: **12 -> 0**. Das ist der Zielwert dieser
  Session. Lauf B muss auf 0 bleiben.
- `smoke27b-sections.mjs` und `smoke27b-guest.mjs` muessen unveraendert
  durchlaufen (15/0 bzw. 16/0), sonst hast du Scheibe 1b oder 2 kaputtgemacht.
- `kontrast.mjs`: Stand 19 Kombis, 0 Fehler. Muss so bleiben. Neue Kombis
  einzeln nachrechnen.
- Jede var(--mc-*) einzeln gegen MissionStyles (pruefe.mjs macht das mit).
  Eine Variable, die es nicht gibt, macht die ganze CSS-Regel ungueltig und
  esbuild meldet das NIE.
- esbuild ist KEIN Beweis (in Session 23, 24, 27a je mit Gegenprobe belegt).
- git diff --patience.

## REGELN, teuer gelernt

- Erreichbarkeit IMMER transitiv messen, KONSTANTEN mitsammeln.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter.
- SectionHeader und IconButton reichen KEINE Klasse ans Icon durch. Wo ein Icon
  gedreht/gefaerbt werden soll: eigener Wrapper (siehe ExportIcon aus 27b) oder
  eigener Button mit className="mc-iconbtn".
- Farbbedeutungen, verbindlich, nicht mischen:
    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen ("knapp")
    Blau   (--mc-st-new)      = Status "neu"  |  Rot (--mc-st-problem) = Problem
    Van = Amber, Car = Blau
- Weiche Fuellungen (-soft) sind bei 30 Prozent flaechig SEHR laut. Fuer Badges
  gedacht, nicht fuer Panels. Fuer Hinweisboxen gibt es .mc-note--warn /
  .mc-note--error (12 Prozent). Benutz die, bau keine neue Flaeche.
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
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm, Stage
  bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema.

## OFFENE PUNKTE, die ich kenne, NICHT heimlich fixen

1. Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf --mc-brand),
   unter AA. Kein Regress, Classic hatte denselben Wert. Haengt an
   .mc-btn-primary und damit an den Speichern-Knoepfen in SettingsTab und seit
   Scheibe 2 auch am Gast-Link-Block. Wenn du sie einbaust, sag es mir.
2. color-scheme: dark fehlt komplett. Folge: Uhr-/Kalender-Knoepfe in
   type="time"/type="date"-Feldern und die vom Betriebssystem gezeichneten
   Auswahllisten kommen im Hellmodus-Look auf dunklem Grund. Kein Regress.
   Die richtige Stelle waere EINE Zeile in .mc-scope, sie traefe aber alles
   darunter. Sag es mir, aendere es nicht nebenbei.
3. Van/Car-Badges haben durch die 27e-Farbregel weniger Kontrast als der alte
   Classic-Ton (Van 8.96 -> 5.08, Car 9.09 -> 3.84, bei 10px). Car liegt unter
   AA. Eine Absenkung der Badge-Fuellung von 30 auf 16 Prozent wuerde Van auf
   7.15 und Car auf 4.93 heben, traefe aber .mc-badge global. Eigene
   Entscheidung, nicht nebenbei.
4. PROJEKT-ANWEISUNGEN.md ist veraltet und hat nur eine Warnbox oben. Richtig
   aufraeumen waere eine eigene kleine Doku-Session wert.
5. Neu aus Scheibe 2: der Untertitel des Gast-Link-Blocks ist der mit Abstand
   laengste auf der Seite (rund vier Zeilen text-xs). Kein Regress, faellt im
   MC-Look aber staerker auf. Der Sicherheitshinweis koennte aus dem Untertitel
   raus in eine eigene .mc-note mc-note--warn. Das waere Struktur, nicht Farbe,
   also eigene Entscheidung.

## ABLAUF

Branch: fix/session-27b-scheibe3, abgezweigt von dem Stand, den du oben
gemessen hast (main ODER fix/session-27b-scheibe2, siehe Schritt 0). Nach
meinem OK FF-Merge. Commit ueber /tmp/msg.txt (Umlaute). Sprache Deutsch,
informell, keine Gedankenstriche, korrekte Umlaute. Warn mich RECHTZEITIG,
wenn der Chat zu lang wird, nicht erst wenn es knapp ist.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
UEBERGABE-Session-18.md fortschreiben, Opener fuer die naechste Session.

## ZEITFENSTER

Bauen bis Freitagabend 17.07. Ab Samstag 18.07. ist Ruhe, dann teste ich mit
mehreren Fahrern. Was am Festival laufen soll, muss VOR dem Test drin sein.
Ab 21.07. wird nichts mehr geloescht. Festival 23. bis 27.07.

SettingsTab ist der Streichkandidat, den sehe ich waehrend des Festivals
praktisch nie. Scheibe 1 und 2 sind durch, die Seite ist damit schon kein
Bruch mehr. Wenn die Zeit knapp wird oder etwas Wichtigeres dazwischenkommt:
Scheibe 3 ersatzlos streichen, nicht halb bauen.

**Nur EINE Session gleichzeitig offen.** Am 16.07. liefen versehentlich zwei
am selben Baustein, das ging nur gut, weil Git den zweiten Push abgelehnt hat.
