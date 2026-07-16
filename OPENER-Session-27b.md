# Ready-to-paste Opener: Session 27b (SettingsTab)

Alles ab hier kopieren, PAT einsetzen, in einen FRISCHEN Chat.

---

Erst PROJEKT-ANWEISUNGEN.md lesen, dann Repo holen. Repo:
Maybach62S57S/openbeatz-shuttle. PAT: <HIER DEIN PAT>
Nach dem Klonen: git config (user.name/email), npm ci, Baseline-esbuild gruen:
./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

## ⚠ SCHRITT 0, PFLICHT, BEVOR DU IRGENDWAS BAUST

Glaub diesem Opener NICHT, was den Stand von main angeht. Der Opener ist eine
Absicht, kein Messwert. Am 16.07. hat genau das eine Session gekostet: die
Historie war gegabelt, zwei Aeste kannten sich nicht, main war leer, und der
letzte Opener hat eine Session beauftragt, die schon fertig war. Also miss:

    git log --graph --oneline --all --decorate | head -30
    git branch -a
    for b in $(git branch -r | grep -v HEAD); do
      echo -n "$b: "; git rev-list --left-right --count main...$b; done
    wc -l src/ShuttleLeitstelle.jsx

Wenn irgendein Branch "ahead" von main ist, sag es mir BEVOR du weitermachst.

## STAND, wie er sein SOLLTE (nachmessen!)

main = ea64966, 9031 Zeilen. 27e (FlightTab + LiveGoogleMap) ist per FF-Merge
drin, gemessen am 16.07. direkt nach dem Merge: kein Branch war ahead von main,
esbuild gruen, rendertest.mjs auf allen fuenf Sollwerten.

Wenn du etwas anderes misst, sag es mir BEVOR du baust.

Classic ist seit Session 19 bis 24 komplett raus. Mission Control ist die
einzige Leitstellen-Oberflaeche.

## AUFTRAG 27b: SettingsTab auf MC-Design

Erreichbarkeit vor dem Bauen NEU messen, nicht meiner Tabelle glauben
(rg.mjs liegt im Repo, sammelt auch Konstanten mit, Zielliste ist hartcodiert
und muss fuer neue Ziele erweitert werden).

### Das ist NICHT ein Baustein mit 301 Zeilen, sondern acht mit ~680

Frisch gemessen am 16.07. auf 951b80a, Zeile (Laenge):

    SettingsTab          7333 (301 Z)   nur von MissionControl
    DriverPhones         4450  (48 Z)   frei
    DispatcherUsers      4500  (42 Z)   frei
    AccessPinsSection    4544  (32 Z)   frei
    GuestLinksSection    4578 (125 Z)   frei, der dickste Brocken
    PushSettingsSection  4705  (24 Z)   frei
    AuditLogSection      4751  (54 Z)   frei
    ReportSection        5983  (54 Z)   frei

Alle acht sind NUR von MissionControl erreichbar, keiner haengt am Fahrer-,
Stage- oder Gast-Pfad. Das ist die gute Nachricht.

### Die zwei Tabu-Kinder sind schon geloest, Werkzeug liegt bereit

Transitiv erreichbar und TABU sind nur `inp` und `Field`. Fuer beide gibt es
seit 27a die fertige Antwort, NICHT neu erfinden:

    inp    -> Konstante mcInp ("mc-input w-full px-3 py-2.5 text-base sm:text-sm")
    Field  -> <Field mc ...> (der optionale mc-Schalter, existiert schon)

Der Rest im Tabu-Baum (fmtDate, setRideStatus, sortMin, logRide, travel ...)
ist reine Logik ohne eine einzige Farbe. Nicht anfassen, kein Thema.

### Schneide es in Scheiben, alles auf einmal sprengt den Chat

Vorschlag: 1) SettingsTab-Rahmen + die vier kleinen (DriverPhones,
DispatcherUsers, AccessPinsSection, PushSettingsSection). 2) GuestLinksSection
allein. 3) AuditLogSection + ReportSection. Nach jeder Scheibe committen und
pushen.

## ⚠ TOGGLE-FALLE, und die Loesung liegt schon im Repo

Ein Render-Test sieht nur den Zustand, in dem eine Komponente STARTET. Alles
hinter Toggle/Tab/Akkordeon rendert im Test gar nicht und ist NICHT belegt.
SettingsTab ist voll davon: Gast-Links erzeugen/kopieren, Audit-Log auf/zu,
Import-Vorschau, Push-Key gesetzt/nicht gesetzt.

smoke27b.mjs und smoke27e.mjs loesen das: sie bauen eine WEGWERF-KOPIE der
Datei, in der die useState-Startwerte der Zielkomponente aus globalThis geseedet
werden, kompilieren die Kopie und rendern echt. Das Original bleibt unangetastet.
KOPIER DIESES MUSTER. 17 Zustaende in smoke27e sind der Massstab, nicht einer.

## REGELN, teuer gelernt

- Erreichbarkeit IMMER transitiv messen, KONSTANTEN mitsammeln. In 27a ist inp
  durchgerutscht, weil das Skript nur Funktionen gesammelt hat.
- Alles, was auch von DriverApp/StageApp/GuestApp erreichbar ist, ist TABU.
- NUR className/Style. KEINE Handler, KEINE Feldlogik, KEINE Props ausser einem
  reinen Design-Schalter.
- MEINE HAUPTSACHE: es soll richtig gut aussehen UND richtig gut lesbar sein.
  Faellt dir unterwegs etwas Unruhiges oder schlecht Lesbares auf, sag es mir,
  auch wenn es nicht im Auftrag steht. Nicht heimlich aendern, aber auch nicht
  verschweigen.
- Farbbedeutungen, seit 27a verbindlich, nicht mischen:
    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen ("knapp")
    Blau   (--mc-st-new)      = Status "neu"
    Rot    (--mc-st-problem)  = Problem
  Seit 27e zusaetzlich: Van = Amber, Car = Blau (gilt in AssignModal,
  DriverDetailsPanel und auf der Google-Karte).
- Weiche Fuellungen (-soft) sind bei 30 Prozent Deckkraft flaechig SEHR laut.
  Fuer Badges gedacht, nicht fuer Panels. In SettingsTab lauert genau die Falle:
  PIN-Bloecke und Warnhinweise sind gross und flaechig. Nicht wiederholen, was
  in 27a-3 am Flug-Block zurueckgebaut werden musste.
- MissionStyles darf angefasst werden, wenn es die RICHTIGE Stelle ist (eine
  Regel statt fuenf verstreuter Hex-Codes). Aber die Klassen sind geteilt:
  .mc-btn-primary haengt an Shell, Timeline, ChatPanel und jetzt auch FlightTab.
  Vorher messen, wen es sonst trifft, und es mir SAGEN. Neue Klassen mit neuem
  Namen sind unkritisch, siehe .mc-fab und .mc-btn-quiet aus 27b-2.
- Kein inline background auf etwas mit .mc-ride-card: inline schlaegt Klasse und
  legt den :hover tot. (borderLeft inline ist ok, siehe FlightTab in 27e.)
- Vorhandene Klassen wiederverwenden: .mc-panel, .mc-input, .mc-btn-primary,
  .mc-btn-assign, .mc-btn-quiet, .mc-fab, .mc-badge, .mc-eyebrow, .mc-iconbtn,
  .mc-modal-fade, .mc-ride-card, .mc-metric. Konstante mcInp fuer Eingaben.
  Basiskomponenten: MissionPanel, SectionHeader, StatusBadge, MetricCard,
  IconButton, EmptyState, LoadingState, ErrorState, LiveIndicator.
  ACHTUNG bei IconButton: der reicht KEINE Klasse ans Icon durch. Wo ein Icon
  drehen oder die Farbe wechseln soll, eigener Button mit className="mc-iconbtn"
  (so geloest in FlightTab 27e).
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Cyberpunk,
  kein Neon, keine uebertriebenen Animationen.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm, Stage
  bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema, eigenes
  Projekt nach dem Festival.

## BELEGE, die ich sehen will. Sieben Skripte liegen im Repo, benutz die.

- pruefe.mjs <alt.jsx> <neu.jsx>: Pruefsummen ueber @babel/parser + var-Check.
  Genau die umgebauten Bausteine geaendert, ALLES andere byte-identisch,
  insbesondere DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal,
  GuestIssueModal, MissionStyles (falls nicht angefasst), inp, Field.
- rendertest.mjs <datei.jsx>: react-dom/server. Sollwerte KONSTANT:
  App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
  Field ohne mc 101.
- smoke.mjs / smoke27b.mjs / smoke27c.mjs / smoke27d.mjs / smoke27e.mjs
  <datei.jsx>: jeder umgebaute Pfad muss echt rendern, Classic-Reste 0.
  smoke27b und smoke27e sind das Muster fuer Toggle-Zustaende.
- rg.mjs <datei.jsx>: transitiver Rendergraph inkl. Konstanten. Achtung, die
  Zielliste ist im Skript hartcodiert, fuer neue Ziele erweitern.
- kontrast.mjs: WCAG-Kontrast aller Tokens, liest LIVE aus MissionStyles.
  Stand jetzt: 19 Kombis, 0 Fehler. Wenn du eine Farbe anfasst oder eine neue
  einfuehrst, muss das so bleiben. Neue Kombis, die kontrast.mjs nicht kennt,
  einzeln nachrechnen. Skripte, die Werte hartcodieren, luegen nach der
  naechsten Aenderung.
- Jede var(--mc-*) einzeln gegen MissionStyles. Eine Variable, die es nicht
  gibt, macht die ganze CSS-Regel ungueltig und esbuild meldet das NIE.
  Achtung: --mc-st-new-soft steht auf einer GETEILTEN Zeile, ein zeilenweiser
  Grep findet sie nicht.
- esbuild ist KEIN Beweis. Das ist in Session 23, 24 und 27a je mit einer
  Gegenprobe belegt: kaputte Referenz -> esbuild gruen.
- git diff --stat kann bei aehnlichen Bloecken scheinbare Einfuegungen zeigen,
  --patience nutzen.

## OFFENE PUNKTE, die ich kenne, NICHT heimlich fixen

1. Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf --mc-brand), unter
   AA. Kein Regress, Classic hatte denselben Wert. Dieselbe Kombination haengt
   an .mc-btn-primary und damit seit 27e auch am "Alle Flüge aktualisieren".
   Wenn du sie in SettingsTab einbaust, sag es mir, aendere sie aber nicht
   eigenmaechtig.
2. color-scheme: dark fehlt komplett (nirgends in src/ oder index.html).
   Folge: Uhr-/Kalender-Knoepfe in type="time"/"date"-Feldern und die vom
   Betriebssystem gezeichneten Auswahllisten kommen im Hellmodus-Look auf
   dunklem Grund. Kein Regress, Classic hatte dasselbe. Die richtige Stelle
   waere EINE Zeile in .mc-scope, sie traefe aber alles darunter. Wenn dir in
   SettingsTab Datums-/Zeitfelder unterkommen: sag es mir, aendere es nicht
   nebenbei.

## ABLAUF

Branch: fix/session-27b-settings von main. Nach meinem OK FF-Merge auf main.
Commit ueber /tmp/msg.txt (Umlaute). Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich RECHTZEITIG, wenn der Chat zu lang
wird, nicht erst wenn es knapp ist.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
UEBERGABE-Session-18.md fortschreiben, Opener fuer die naechste Session.

## ZEITFENSTER

Bauen bis Freitagabend 17.07., auch am Fahrer-Pfad. Ab Samstag 18.07. ist Ruhe,
dann teste ich mit mehreren Fahrern. Was am Festival laufen soll, muss VOR dem
Test drin sein. Ab 21.07. wird nichts mehr geloescht. Festival 23. bis 27.07.

SettingsTab ist der Streichkandidat, den sehe ich waehrend des Festivals
praktisch nie. Wenn die Zeit knapp wird oder etwas Wichtigeres dazwischenkommt:
diese Session ersatzlos streichen, nicht halb bauen.
