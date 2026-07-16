# Ready-to-paste Opener: Session 27e (FlightTab + LiveGoogleMap)

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

main = a4560d3, 8954 Zeilen (Merge der gegabelten 27er-Historie: 27a, 27a-2,
27a-3, 27d, 27c Scheibe 1+2).
Branch fix/session-27b-chatpanel = 1f4b24d, 8978 Zeilen (ChatPanel auf MC).

Wenn ich den FF-Merge gemacht habe, ist main = 1f4b24d, 8978 Zeilen. Wenn
nicht, sag es mir, dann nimmst du fix/session-27b-chatpanel als Basis.

Classic ist seit Session 19 bis 24 komplett raus. Mission Control ist die
einzige Leitstellen-Oberflaeche.

## AUFTRAG 27e: FlightTab (5375) und LiveGoogleMap (6971) auf MC-Design

Erreichbarkeit vor dem Bauen NEU messen, nicht meiner Tabelle glauben
(rg.mjs liegt im Repo, sammelt auch Konstanten mit).

### FlightTab ist der heikelste Rest vom ganzen Umbau

FlightTab selbst ist sauber (nur von MissionControl). ABER zwei seiner Kinder
sind TABU, weil auch der Fahrer-Pfad sie erreicht:

    flightStyle     Style-Funktion
    FLIGHT_STATUS   Konstante

Das ist EXAKT die Lage von Modal/Field/inp in 27a. Es gibt genau drei Wege:
- optionaler mc-Schalter (bei einer Funktion moeglich; Beweislast: Render-Test
  des Fahrer-Pfads vorher/nachher ZEICHENIDENTISCH)
- eine zweite Konstante daneben, wie mcInp bei inp (bei FLIGHT_STATUS)
- gar nicht anfassen
KEIN zweiter Fork. Wir haben sechs Sessions lang Forks rausgeworfen.

### LiveGoogleMap ist klein, aber nicht belegbar

127 Zeilen, haengt nur an MapTab, Kinder sind alles Logik. ABER: rendert nur,
wenn oben auf "Google Maps" umgeschaltet wird UND die Google-API geladen ist.
Ein normaler Render-Test sieht davon fast nichts. Sag mir am Ende genau, was
ich mit dem Auge anschauen muss.

## ⚠ TOGGLE-FALLE, und die Loesung liegt schon im Repo

Ein Render-Test sieht nur den Zustand, in dem eine Komponente STARTET. Alles
hinter Toggle/Tab/Akkordeon rendert im Test gar nicht und ist NICHT belegt.

smoke27b.mjs loest das: es baut eine WEGWERF-KOPIE der Datei, in der fuer die
Zielkomponente useState(false) -> useState(true) gesetzt und der State geseedet
wird, kompiliert die Kopie und rendert echt. Das Original bleibt unangetastet.
KOPIER DIESES MUSTER fuer FlightTab und LiveGoogleMap. Sieben Zustaende in
smoke27b sind der Massstab, nicht einer.

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
- Weiche Fuellungen (-soft) sind bei 30 Prozent Deckkraft flaechig SEHR laut.
  Fuer Badges gedacht, nicht fuer Panels. Der Flug-Block hatte genau das und
  musste in 27a-3 zurueckgebaut werden. Nicht wiederholen.
- MissionStyles darf angefasst werden, wenn es die RICHTIGE Stelle ist (eine
  Regel statt fuenf verstreuter Hex-Codes). Aber die Klassen sind geteilt:
  .mc-btn-primary haengt an Shell, Timeline und jetzt auch ChatPanel. Vorher
  messen, wen es sonst trifft, und es mir SAGEN. Neue Klassen mit neuem Namen
  sind unkritisch, siehe .mc-fab und .mc-btn-quiet aus 27b-2.
- Kein inline background auf etwas mit .mc-ride-card: inline schlaegt Klasse und
  legt den :hover tot.
- Vorhandene Klassen wiederverwenden: .mc-panel, .mc-input, .mc-btn-primary,
  .mc-btn-assign, .mc-btn-quiet, .mc-fab, .mc-badge, .mc-eyebrow, .mc-iconbtn,
  .mc-modal-fade, .mc-ride-card, .mc-metric. Konstante mcInp fuer Eingaben.
- Enterprise dark, ruhig, nachtschichttauglich. Kein Gaming, kein Cyberpunk,
  kein Neon, keine uebertriebenen Animationen.
- SettingsTab NICHT anfassen, das ist die naechste Session (27b). Kein
  Mitnehmen nebenbei.
- Weiter tabu: die Datenschicht, das dyn_data/RPC-Thema, der Fallschirm, Stage
  bleibt read-only. Fahrer/Stage/Gast auf MC-Design ist NICHT Thema, eigenes
  Projekt nach dem Festival.

## BELEGE, die ich sehen will. Sechs Skripte liegen im Repo, benutz die.

- pruefe.mjs <alt.jsx> <neu.jsx>: Pruefsummen ueber @babel/parser + var-Check.
  Genau die umgebauten Bausteine geaendert, ALLES andere byte-identisch,
  insbesondere DriverApp, StageApp, GuestApp, IssueModal, StageIssueModal,
  GuestIssueModal, MissionStyles (falls nicht angefasst), inp, Field,
  SettingsTab.
- rendertest.mjs <datei.jsx>: react-dom/server. Sollwerte KONSTANT:
  App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
  Field ohne mc 101.
- smoke.mjs / smoke27b.mjs / smoke27c.mjs / smoke27d.mjs <datei.jsx>: jeder
  umgebaute Pfad muss echt rendern, Classic-Reste 0. smoke27b ist das Muster
  fuer Toggle-Zustaende.
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

## OFFENER PUNKT, den ich kenne, NICHT heimlich fixen

Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf --mc-brand), unter
AA. Kein Regress, Classic hatte denselben Wert, und .mc-btn-primary hat ihn
auch. Wenn du dieselbe Kombination in FlightTab einbaust, sag es mir, aendere
sie aber nicht eigenmaechtig.

## ABLAUF

Branch: fix/session-27e-flug von main. Nach meinem OK FF-Merge auf main.
Commit ueber /tmp/msg.txt (Umlaute). Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute. Warn mich RECHTZEITIG, wenn der Chat zu lang
wird, nicht erst wenn es knapp ist.

Zum Schluss: Diff-Beleg, Regressionsrisiken, konkrete manuelle Testfaelle,
UEBERGABE-Session-18.md fortschreiben, Opener fuer die naechste Session (27b,
SettingsTab).

## ZEITFENSTER

Bauen bis Freitagabend 17.07., auch am Fahrer-Pfad. Ab Samstag 18.07. ist Ruhe,
dann teste ich mit mehreren Fahrern. Was am Festival laufen soll, muss VOR dem
Test drin sein. Ab 21.07. wird nichts mehr geloescht. Festival 23. bis 27.07.

Wenn die Zeit knapp wird: SettingsTab (27b) ist der Streichkandidat, den sehe
ich waehrend des Festivals praktisch nie. FlightTab und ChatPanel sehe ich
staendig. Nicht umgekehrt streichen.
