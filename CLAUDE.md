# openbeatz-shuttle

VIP-Shuttle-Leitstelle für das Open Beatz Festival (23. bis 27.07.2026,
Herzogenaurach). 20 Fahrer, 4 feste Orte, 3 Festivalzonen, 4 Leitstellen-Nutzer.
**Das ist Produktivsoftware für ein laufendes Festival, kein Hobbyprojekt.**

Betreiber: Jordan, Merg & More Consultants.

## Aufbau

- `src/ShuttleLeitstelle.jsx` ist die App. **Eine Datei, rund 9000 Zeilen.**
  Das ist Absicht, nicht Versehen. Nicht aufteilen, nicht vorschlagen.
- `src/main.jsx`, `index.html`, Vite, Tailwind.
- Backend: Supabase (`supabase-schema.sql`, `supabaseStore.js`, `api/`).
- Doku: `UEBERGABE-Session-*.md`, `OPENER-Session-*.md`.

## Wo der echte Stand steht

**`PROJEKT-ANWEISUNGEN.md` ist veraltet.** Es hat oben eine Warnbox. Der aktuelle
Stand steht am Ende von `UEBERGABE-Session-18.md`.

Der Opener der jeweiligen Session sagt, was zu tun ist. Aber: **ein Opener ist
eine Absicht, kein Messwert.** Zahlen darin sind vom Tag des Schreibens und
verschieben sich. Immer selbst messen, nie blind anspringen.

## Kein PAT

Git ist auf diesem Rechner angemeldet, `git push` läuft direkt. Repo ist public:
`github.com/Maybach62S57S/openbeatz-shuttle`.

**Frag NIE nach einem Personal Access Token.** Ältere Opener enthalten eine
Zeile `PAT: <HIER DEIN PAT>`. Die ist ein Altlast aus der Zeit, als die Arbeit im
Browser-Chat lief, und hat am 16.07. dazu geführt, dass ein Token im Klartext in
einem Chatverlauf landete. Wenn du so eine Zeile siehst: ignorieren und Jordan
sagen, dass sie raus gehört.

## Befehle

    npm ci
    ./node_modules/.bin/esbuild src/ShuttleLeitstelle.jsx --bundle=false --format=esm --outfile=/tmp/x.js
    node rg.mjs src/ShuttleLeitstelle.jsx <Komponente>   # Erreichbarkeit + Tabu-Kinder
    node pruefe.mjs alt.jsx neu.jsx                      # welche Bausteine haben sich geaendert
    node kontrast.mjs src/ShuttleLeitstelle.jsx          # WCAG-Kontrast der MC-Tokens
    node smoke27b-settings.mjs src/ShuttleLeitstelle.jsx # Muster fuer Render-Tests

## YOU MUST: nach jeder Änderung an der JSX

1. esbuild muss grün sein.
2. `grep -oE '^function [a-zA-Z]+' src/ShuttleLeitstelle.jsx | sort | uniq -d`
   muss **leer** sein. Doppelte Funktionsdeklarationen beim Einfügen neben
   bestehenden Bausteinen sind der Dauerbrenner in diesem Projekt.

## YOU MUST: Tabu-Kinder

`Modal`, `Field`, `inp`, `IssueModal`, `StageIssueModal`, `GuestIssueModal`
werden **auch von der Fahrer-, Stage- und Gast-App** benutzt, nicht nur von der
Leitstelle. Eine Änderung daran schlägt in Oberflächen durch, die niemand testet.

Vor jedem Eingriff `node rg.mjs` laufen lassen und die Erreichbarkeit prüfen.
Wenn ein Ziel ein Tabu-Kind erreicht: **fragen, nicht bauen.**

## Design: Mission Control

Classic ist seit Session 19 bis 24 raus. Mission Control ist die einzige
Leitstellen-Oberfläche. Laufendes Refactoring: alte Tailwind-Farbklassen auf
MC-Tokens umstellen.

Farbregel:

    Orange (--mc-brand)       = Marke, Hauptaktion, Fokus, beste Wahl
    Amber  (--mc-st-assigned) = Status "zugeteilt" UND Warnungen
    Blau   (--mc-st-new)      = Status "neu"
    Rot    (--mc-st-problem)  = Problem
    Gruen  (--mc-st-done)     = erledigt
    Van = Amber, Car = Blau

Häufigster Regelbruch im Altbestand: **Orange für Nicht-Marke.** Wenn du so eine
Stelle findest, melden, nicht nebenbei fixen.

Farbe wandert in `style={{ color: "var(--mc-...)" }}` oder in eine `.mc-*`-Klasse.
Layout-Utilities (`flex`, `gap-2`, `px-3`, `rounded-lg`, `text-xs`) bleiben in
`className`. Präzedenzfall ist Commit `baeb29a` (Scheibe 2, GuestLinksSection).

`.mc-note` steht bewusst auf 12 Prozent Fläche, nicht auf `--mc-st-*-soft` (30
Prozent). Die Farbe warnt, die Fläche schreit nicht.

## IMPORTANT: Design-Entscheidungen trifft Jordan

Wenn eine Übersetzung die Lautstärke, die Sichtbarkeit oder das Verhalten eines
Elements ändert, ist das keine Übersetzung mehr. Dann: 2 bis 3 Varianten mit
Kontrastzahlen vorlegen und auf OK warten. Nicht durchbauen.

Das gilt besonders für alles, was Probleme meldet. Jordan sieht das nachts um
drei, nicht im Designreview.

## Render-Tests: die Toggle-Falle

Viele Bausteine sind im Startzustand gar nicht gerendert (`useState(false)`,
`if (x.length === 0) return null`). Ein naiver Render-Test rendert nichts und
meldet triumphierend 0 Treffer. Das ist ein wertloser Beweis.

Muster: Wegwerf-Kopie der Datei, useState-Startwerte aus `globalThis` seeden,
Kopie kompilieren, echt rendern, Original unangetastet. Siehe `smoke27b-*.mjs`.

**Immer Gegenprobe** gegen die alte Datei. Wenn der Test dort auch 0 meldet,
misst er nichts.

## Ablauf einer Session

1. Messen und melden, bevor du irgendwas baust.
2. Branch anlegen: `fix/session-NN-<kurz>`. **Nie direkt auf main.**
3. Entscheidungen vorlegen, OK abwarten.
4. Bauen, möglichst in zwei kleinen Scheiben statt einer grossen.
5. Belege, Regressionsrisiken, konkrete manuelle Testfälle.
6. Vor dem Push nochmal messen:
   `git fetch origin && git rev-list --left-right --count origin/main...HEAD`
   Am 16.07. ist main während einer Session weitergelaufen und der FF-Merge ging
   nicht mehr. Einmal messen am Anfang reicht nicht.
7. `UEBERGABE-Session-18.md` fortschreiben, Opener für die nächste Session.

Commit-Message über `/tmp/msg.txt` schreiben (sonst zerlegt die Shell die Umlaute).

## Sprache und Ton

Deutsch, informell, knapp. **Keine Gedankenstriche.** Korrekte Umlaute.
Im Produkt selbst: Sie-Form gegenüber Gästen und Artists.

Jordan will ehrliche Einschätzungen und Risikohinweise, bevor gebaut wird, und
eigenständige Vorschläge statt Rückfragenketten. Widerspruch ist erwünscht, wenn
er begründet ist.

## IMPORTANT: Zeitfenster

Fahrertest **ab Samstag 18.07.** Festival **23. bis 27.07.**
Ab 21.07. wird nichts mehr gelöscht.

Das offene Design-Refactoring (Sessions 28, 29, 30) bringt **null Funktion**.
Es ist nach dem Festival dran, nicht vorher. Wenn Jordan es trotzdem jetzt
will: Risiko nennen, dann mitmachen.

Der einzige offene Punkt, der am 23.07. wirklich zählt, ist die Leitstellen-PIN,
die noch auf "1234" steht. Jordan ersetzt sie vor dem Festival selbst.
