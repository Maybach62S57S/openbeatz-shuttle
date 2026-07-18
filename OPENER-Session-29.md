# Ready-to-paste Opener: Session 29 (PresenceManager auf MC + barColor raus)

Du läufst in Claude Code, lokal auf dem Mac, im Repo `~/Downloads/openbeatz-shuttle`.
**Kein PAT.** Git ist auf diesem Rechner angemeldet, `git push` funktioniert direkt.
Wenn dich irgendwas nach einem Token fragt: falscher Weg, sag es mir.

Erst `UEBERGABE-Session-18.md` lesen, ganz unten steht der echte Stand.
`PROJEKT-ANWEISUNGEN.md` ist veraltet, da steht nur eine Warnbox oben drüber.

Baseline muss grün sein, bevor du irgendwas anfasst:

    npm ci
    ./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js

## SCHRITT 0, PFLICHT, BEVOR DU IRGENDWAS BAUST

Glaub diesem Opener nicht, was den Stand angeht. Der Opener ist eine Absicht,
kein Messwert. Am 16.07. hat das zweimal eine Session gekostet. Also miss:

    git fetch origin
    git log --graph --oneline --all --decorate | head -20
    for b in $(git branch -r | grep -v HEAD); do
      echo -n "$b: "; git rev-list --left-right --count main...$b; done
    wc -l src/ShuttleLeitstelle.jsx

Wenn irgendein Branch ahead von main ist, sag es mir, bevor du weitermachst.

**Zeilennummern hier sind vom 16.07. und verschieben sich, sobald davor etwas
eingefügt wird. Immer per grep gegenprüfen, nie blind anspringen.**

## STAND, gemessen am 16.07.

    main = 026935a
    src/ShuttleLeitstelle.jsx = 9076 Zeilen

Session 27b Scheibe 2 (GuestLinksSection) ist gemergt, alle `fix/session-27*`
sind in main enthalten. Einziger Sonderfall: `backup/scheibe2-vor-rebase` zeigt
2 Commits voraus, das ist der Stand vor dem Rebase. **Kein offener Code.** Die
JSX ist dort blob-identisch mit main (`3a78b09`), nur die Doku ist älter. Nicht
mergen, irgendwann löschen.

Classic-Reste im MC-Scope, mit dem Regex aus `smoke27b-settings.mjs`
(`stone-\d|orange-\d|emerald-\d|red-\d|sky-\d|amber-\d|bg-white/|border-white/`):

| Komponente | Zeilen | Classic | MC | Session |
|---|---|---|---|---|
| MissionControl | 7909-8528 (620) | 37 | 123 | 28, offen |
| **PresenceManager** | **5055-5117 (63)** | **30** | **0** | **29, diese hier** |
| **MissionTimelinePage** | **6058-6483 (426)** | **6** | **81** | **29, aber siehe unten** |
| AuditLogSection | 4753-4806 (54) | 20 | 0 | 30 |
| ReportSection | 5985-6038 (54) | 32 | 0 | 30 |

**Abweichung zum Opener 28:** der sagt für MissionControl 31 Treffer, gemessen
sind 37. Grund ist vermutlich Methodik (Roh-Quelltext gegen gerenderten HTML),
nicht Regress. Vor Session 28 einmal sauber nachmessen, nicht drauf verlassen.

## BEFUND: die 6 Timeline-Treffer sind Totholz, kein Design

Alle 6 stecken in `barColor` (Z. 6093 bis 6097), einer Funktion, die **nirgends
aufgerufen wird**:

    grep -cw "barColor" src/ShuttleLeitstelle.jsx   # -> 1, nur die Definition

`barColor` steht bereits auf der Totholz-Liste für Session 25
(`UEBERGABE-Session-18.md`, Z. 173, zusammen mit `freeCount` in `OverviewTab`).

Die Doku warnt an Z. 1384: **Totholz nur über AST-Referenzen messen, nicht per
Grep.** Also gegenprüfen, bevor du löschst. Wenn es hält:

**Frage an Jordan, bevor du es anfasst:** `barColor` in dieser Session löschen
(dann ist der Timeline-Rest mit weg und Session 25 wird kleiner), oder liegen
lassen für den Totholz-Sweep? Beides vertretbar. Nicht heimlich entscheiden.

Falls löschen: eigener Commit, getrennt von der PresenceManager-Arbeit.

## AUFTRAG: PresenceManager, 30 Treffer auf 63 Zeilen

Z. 5055, hängt in `MissionReturnsTab` (Z. 5326) unter "Anwesenheit verwalten".

Der Baustein stand nie in der Zwölfer-Planungstabelle und wurde deshalb von 27a
bis 27e nie angefasst. Das ist eine Lücke im Plan, kein Restposten. 0 MC-Treffer,
also unberührtes Classic.

### Erreichbarkeit: unkritisch, gemessen

    node rg.mjs src/ShuttleLeitstelle.jsx PresenceManager

Ergebnis: `PresenceManager -> RefreshCw, Users`. Nur Icons, **keine Tabu-Kinder**.
Fahrer-, Stage- und Gast-App erreichen ihn nicht. Du kannst ihn anfassen, ohne
dass es woanders rausschlägt. Trotzdem selbst nachmessen.

### TOGGLE-FALLE, dieselbe wie beim Banner in 28

    const [open, setOpen] = useState(false);   // Z. 5056
    {open && ( ... )}                          // Z. 5071

**Im Startzustand ist der ganze Body nicht da.** Ein naiver Render-Test rendert
nur den Kopfknopf und meldet triumphierend fast 0 Classic-Reste. Das wäre ein
wertloser Beweis.

Zustände, die geseedet werden müssen:
- `open = false` -> nur Kopfzeile (Grundzustand)
- `open = true`, `all.length === 0` -> "Aktuell ist niemand als vor Ort erfasst."
- `open = true`, mehrere Personen
- `p.manual === "here"` -> "manuell da"
- `p.manualOnly` -> "nur manuell"
- `p.noReturn` -> "keine Rückfahrt"
- `p.manual` gesetzt -> der RefreshCw-Knopf erscheint zusätzlich
- `newName` leer gegen gefüllt -> hinzufügen-Knopf disabled gegen aktiv

`smoke27b-settings.mjs`, `smoke27b-sections.mjs` und `smoke27b-guest.mjs` sind
das fertige Muster: Wegwerf-Kopie der Datei, useState-Startwerte aus `globalThis`
geseedet, Kopie kompilieren, echt rendern, Original unangetastet. **Kopier das.**

**Und mach die Gegenprobe:** denselben Smoke-Test gegen die alte Datei laufen
lassen. Wenn er dort auch 0 meldet, misst der Test nichts.

## ENTSCHEIDUNGEN, die Jordan trifft, NICHT du

Farbregel, hier relevant:

    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen
    Blau   (--mc-st-new)      = Status "neu"
    Rot    (--mc-st-problem)  = Problem
    Grün   (--mc-st-done)     = erledigt

Vier Stellen, leg mir pro Stelle einen Vorschlag mit Kontrastzahl vor und warte
auf mein OK:

**1. Z. 5060, `text-orange-400` am Users-Icon der Kopfzeile.**
Orange für Nicht-Marke, derselbe Regelbruch wie bei den Van-Badges (1b) und dem
Sicherheitshinweis (Scheibe 2). Ein Abschnittsicon ist keine Hauptaktion.
Kandidat: `--mc-text-muted` oder `--mc-text-secondary`.

**2. Z. 5079, `bg-emerald-400` als Vor-Ort-Punkt.**
`--mc-st-done` ist der richtige Ton. Aber: es gibt `.mc-live-dot`, die pulsiert
(`mc-pulse-ring`, 2.4s, infinite). Bei 20 Fahrern sind das 20 pulsierende Punkte
gleichzeitig. Meine Empfehlung: statischer Punkt mit `--mc-st-done`, **nicht**
`.mc-live-dot`. Sag mir, wenn du das anders siehst.

**3. Z. 5086, `hover:text-red-300 hover:bg-red-500/10` am "ist weg"-Knopf.**
Rot für Nicht-Problem. "Ist weg" ist eine normale Korrektur, kein Problem, und
reversibel (der RefreshCw-Knopf holt es zurück). Es gibt `.mc-btn-danger`, das
ist für echte Löschaktionen und hier vermutlich zu laut. Kandidat: `.mc-btn-quiet`
mit `--mc-st-problem` nur im Hover, oder ganz ohne Rot. **Das ist eine echte
Entscheidung, rate nicht.**

**4. Z. 5062, die Hülle `bg-stone-900 border border-stone-800 rounded-xl`.**
`.mc-panel` passt farblich, bringt aber `mc-panel-in` mit (Einblend-Animation
beim Mount). Der Baustein sitzt **in** einem Tab, nicht als Top-Level-Panel.
Scheibe 2 hat solche Fälle mit explizitem `style={{ borderColor: "var(--mc-border)" }}`
gelöst statt mit `.mc-panel`. Prüf, was hier richtig ist.

## ÜBERSETZUNGSMUSTER (aus Scheibe 2, `baeb29a`, das ist der Präzedenzfall)

    text-stone-500 / text-stone-600   -> style={{ color: "var(--mc-text-muted)" }}
    text-stone-400                    -> style={{ color: "var(--mc-text-secondary)" }}
    text-stone-100 / -200 / -300      -> style={{ color: "var(--mc-text)" }}
    bg-stone-950/50 (Zeilenfläche)    -> style={{ background: "var(--mc-inset)" }}
    border-stone-800                  -> style={{ borderColor: "var(--mc-border)" }}
    text-emerald-400                  -> style={{ color: "var(--mc-st-done)" }}
    text-amber-300                    -> style={{ color: "var(--mc-st-assigned)" }}
    className={inp}                   -> className={mcInp}   (Z. 1463)
    bg-stone-800 hover:bg-stone-700   -> className="mc-btn-quiet"
    bg-orange-600 (Hauptaktion)       -> className="mc-btn-primary"

Die Layout-Utilities (`flex`, `gap-2`, `px-2.5`, `rounded-lg`, `text-xs`) bleiben
in `className`. Nur Farbe wandert in `style` oder in eine `.mc-*`-Klasse.

`.mc-input` macht den Fokus-Rahmen selbst (`border-color: var(--mc-brand)` plus
Ring). Das `focus:border-orange-500` an Z. 5106 fällt damit ersatzlos weg, und
Orange ist dort **korrekt**, weil Fokus. Nicht wegoptimieren.

## ABLAUF

Branch: `fix/session-29-presence`, abgezweigt von `main` (nach Schritt 0 prüfen,
ob main wirklich der richtige Abzweigpunkt ist).

1. Schritt 0 messen und melden.
2. Erreichbarkeit und Trefferzahlen neu messen, mir die Zahlen zeigen.
3. `barColor`: Totholz per AST bestätigen, mich fragen, ob rein oder raus.
4. Die vier Entscheidungen oben vorlegen, **auf mein OK warten**.
5. Erst dann bauen. Zwei Scheiben: erst `barColor` raus (falls OK), dann
   PresenceManager.
6. Nach jedem Baustein: esbuild grün, `grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d`
   muss leer sein (Doppel-Deklarationen waren der Dauerbrenner).
7. `node pruefe.mjs alt.jsx src/ShuttleLeitstelle.jsx` -> nur die angefassten
   Bausteine dürfen als geändert auftauchen.
8. Smoke-Test mit den Zuständen oben, plus Gegenprobe gegen die alte Datei.
9. Belege, Regressionsrisiken, konkrete manuelle Testfälle.
10. `UEBERGABE-Session-18.md` fortschreiben, Opener für Session 30.

**Vor dem Push nochmal messen:**

    git fetch origin && git rev-list --left-right --count origin/main...HEAD

Am 16.07. ist main während der Session weitergelaufen und der FF-Merge ging nicht
mehr. Einmal messen am Anfang reicht nicht.

Commit-Message über `/tmp/msg.txt` (Umlaute). Sprache Deutsch, informell, keine
Gedankenstriche, korrekte Umlaute.

Warn mich rechtzeitig, wenn der Kontext zu voll wird, nicht erst, wenn es knapp ist.

## OFFENE PUNKTE, die ich kenne, NICHT heimlich fixen

1. Die orange User-Blase im Chat hat 3.56 Kontrast (weiss auf `--mc-brand`),
   unter AA. Kein Regress, Classic hatte denselben Wert. Hängt an
   `.mc-btn-primary`.
2. `color-scheme: dark` fehlt komplett. Folge: Uhr- und Kalenderknöpfe in
   `type="time"`/`type="date"` und die vom Betriebssystem gezeichneten
   Auswahllisten kommen im Hellmodus-Look auf dunklem Grund. Kein Regress.
   Die richtige Stelle wäre eine Zeile in `.mc-scope`, sie träfe aber alles
   darunter. Sag es mir, ändere es nicht nebenbei.
3. Van/Car-Badges haben durch die 27e-Farbregel weniger Kontrast als der alte
   Classic-Ton (Van 8.96 -> 5.08, Car 9.09 -> 3.84, bei 10px). Car liegt unter AA.
4. `PROJEKT-ANWEISUNGEN.md` ist veraltet, nur eine Warnbox oben. Eigene kleine
   Doku-Session wert.
5. `OPENER-Session-28.md` enthält in Z. 6 die Zeile `PAT: <HIER DEIN PAT>`.
   **Die gehört raus.** Sie hat am 16.07. dazu geführt, dass ein Token im
   Klartext in einem Chatverlauf gelandet ist (inzwischen widerrufen). In Claude
   Code wird kein PAT gebraucht. Bitte auch im Opener-Template streichen.
6. Der Plan widerspricht sich: die Tabelle in `OPENER-Session-28.md` sagt
   Session 30 = AuditLogSection + ReportSection. Zwanzig Zeilen weiter unten
   steht "Session 30 (SettingsTab) ist der Streichkandidat". SettingsTab war 27b
   und ist erledigt. Vor Session 30 geradeziehen.

## RESTPLAN

| # | Session | Umfang | Risiko |
|---|---|---|---|
| **29** | **PresenceManager (30) + barColor raus (6)** | **36 Treffer** | **niedrig** |
| 30 | AuditLogSection (20) + ReportSection (32) | 52 Treffer | niedrig |
| 28 | MissionControl-Shell | 37 Treffer, 3 Blöcke | **hoch, die Shell** |

In Session 30 wartet eine Entscheidung: `ReportSection` benutzt Orange für
STATUS (KPI "Offen" / "Ohne Fahrer" / "Offene Rückf.", Fahrer-Balken). Das ist
derselbe Regelbruch wie oben.

## ZEITFENSTER, WICHTIG

Fahrertest mit mehreren Fahrern **ab Samstag 18.07.** Festival **23. bis 27.07.**
Ab 21.07. wird nichts mehr gelöscht.

**Der Plan hat sich am 16.07. geändert.** Session 28 (die Shell) sollte
ursprünglich zuerst laufen, damit Fehler vor dem Fahrertest auffallen. Das dreht
die Sache um: der Fahrertest ist wertvoll, weil er Funktion prüft. Wenn zwei Tage
vorher der Rahmen umgebaut wird, testet der Samstag den Umbau statt der Logistik.

Deshalb: **29 und 30 (beide niedriges Risiko) jetzt, 28 nach dem Festival.**
Keines der drei bringt Funktion, alle drei sind Design. Der einzige Punkt, der
am 23.07. wirklich zählt, ist die PIN "1234", die Jordan vor dem Festival selbst
ersetzt.
