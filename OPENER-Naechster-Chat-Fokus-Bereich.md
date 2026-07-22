# Uebergabe an den naechsten Chat (Fokus-Bereich)

Stand: 22.07.2026, `origin/main` = `14473e4`. Alles im Repo, nichts nur im Chat.

---

## 1. Was in dieser Session (22.07.2026) passiert ist

Schritt 0 sauber: der vorherige Opener stimmte diesmal exakt (`42b5870`, letzter
Code-Commit `50467ee`, 13282 Zeilen). Volle Bestands-Regression vor jeder Aenderung
gruen gefahren.

**Zwei Code-Aenderungen, beide gepusht:**

- `85fd5d5` **Team-Badge (Timmy-Team) nur noch am Freitag (24.07.)**
  `teamLabelOf(d, dayKey)` hat einen optionalen zweiten Parameter bekommen. Neue
  Konstante `TEAM_ACTIVE_DAY = { "timmy-team": "2026-07-24" }`. Ohne `dayKey` bleibt
  das alte Verhalten (immer sichtbar), damit kein Aufrufer ungewollt betroffen ist.
  Zwei Aufrufstellen angepasst: `evaluateInsertion()` (gibt `ride.dayKey` mit, deckt
  Vorschlagsliste + manuelle Liste + Faelle-Uebersicht ab) und `MissionDriversTab`
  (gibt den angezeigten `day` mit).
  Tests: `test_springer_availability.mjs` um 13c-13h erweitert (jetzt 40 Checks).
  Gegenprobe mit deaktiviertem Guard: genau 13d + 13g fallen durch, nicht vacuous.

- `14473e4` **Fahrten-Tab: Live-Karte entfernt, Liste + Fahrer-Spalte breiter**
  Die rechte Live-Karte im Board-Tab war ab 960px eine dritte Grid-Spalte. Komplett
  entfernt, die bestehende Zwei-Spalten-Aufteilung (`minmax(300px,2fr) minmax(160px,1fr)`)
  gilt jetzt durchgehend ab 640px. `wide` und die alte Drei-Spalten-Formel sind weg.
  `BoardMiniMap` selbst UNVERAENDERT und weiterhin aktiv im Rueckfahrten-Tab (Z. ~9462)
  und im Uebersicht-Tab (Z. ~10024) -- bewusst nicht angefasst.

**Wichtige Korrektur gegenueber dem alten Opener:** Die App ist noch NICHT live.
Der "Festival laeuft, Code ist live im Einsatz"-Passus war vorsorglich formuliert.
Festival 23.-27.07., Go-Live steht noch bevor.

---

## 2. Aktueller Stand (Ausgangspunkt)

- `origin/main` = HEAD = **`14473e4`**
- Letzter Code-Commit = **`14473e4`** (diesmal ist HEAD selbst der Code-Commit)
- `src/ShuttleLeitstelle.jsx` = **13283 Zeilen**
- Working Tree sauber, keine offenen Branches, kein ungepushter Stand
- FREEZE AUFGEHOBEN seit 20.07., Loeschungen/Aenderungen wieder erlaubt

---

## 3. Regressions-Setup (unveraendert, bitte genau lesen)

**Standard-Regression = 44 Dateien.** Alle `smoke*.mjs` + `gegenprobe*.mjs`, MINUS
`gegenprobe-teilpaket-h-rpc-postgres.mjs` (braucht echte Postgres) und MINUS
`smoke-final-live-readiness.mjs` (eigener Deliverable, laeuft zusaetzlich).

**FALLE:** Neun aeltere Tests lesen die Quelle ueber `process.argv[2]` OHNE Default und
brechen ohne Argument mit `ERR_INVALID_ARG_TYPE` ab (sieht wie eine Regression aus, ist
keine). Betroffen: `smoke.mjs`, `smoke27b.mjs`, `smoke27b-guest.mjs`,
`smoke27b-sections.mjs`, `smoke27b-settings.mjs`, `smoke27c.mjs`, `smoke27d.mjs`,
`smoke27e.mjs`, `rendertest.mjs`. Robuster Aufruf:

```bash
while read f; do
  if grep -q 'process.argv\[2\]' "$f"; then node "$f" src/ShuttleLeitstelle.jsx; else node "$f"; fi
done < liste.txt
```

**Vor B/E/G zuerst die Extrakte bauen, danach loeschen:**
```bash
python3 extract-funcs-teilpaket-b.py src/ShuttleLeitstelle.jsx tmp-tb-funcs.mjs
python3 extract-funcs-teilpaket-e.py src/ShuttleLeitstelle.jsx tmp-te-funcs.mjs
python3 extract-funcs-teilpaket-g.py src/ShuttleLeitstelle.jsx tmp-tg-funcs.mjs
```

**Dokumentierte Flakiness, KEINE Regression:** `smoke-teilpaket-g2-ui.mjs` Tests
14/20/25/26/27 fallen ausserhalb des Systemzeit-Fensters 06:00-08:00. Achtung: der
Container laeuft auf UTC, Nuernberg ist CEST (UTC+2). Am 22.07. um 06:38 UTC (= 08:38
lokal) fiel g2-ui aus, um 07:0x UTC lief es wieder gruen durch. Beides normal.

**Duplikat-Grep MUSS `[a-zA-Z0-9_]` verwenden.** Die Buchstaben-only-Variante meldet
faelschlich "function c" als Duplikat -- das ist ein Regex-Artefakt (`ctrlPoint`,
`computeOpenRides`, `computeDriverStats` usw. kuerzen sich alle auf "c"), kein echtes
Duplikat. Verifiziert am 22.07.

**Referenzwerte `rendertest.mjs` (muessen konstant bleiben):**
App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
Field ohne mc 101.

**`kontrast.mjs`:** 0 Failures. **`smoke-final-live-readiness.mjs`:** 45/45.
**`test_springer_availability.mjs`:** 40/40 (braucht Quellpfad als argv[2]).

---

## 4. Thema der naechsten Session: Fokus-Bereich als NEUER Nav-Punkt

### 4a. Warum ueberhaupt

Der Fahrten-Tab wird mit vielen Fahrten unuebersichtlich: man scrollt durch lange
chronologische Kartenlisten, um die zwei offenen/kritischen Faelle zu finden. Jordan
wurden zwei Varianten als Mockup gezeigt:

- **Idee A "Zeitlich gruppiert":** Fahrten in Bloecke Vormittag / Nachmittag / Abend,
  kompakte einzeilige Darstellung statt grosser Karten, Statusfarbe als Streifen links.
- **Idee B "Fokus-Modus":** priorisiert statt chronologisch. Was Aufmerksamkeit braucht
  (offen, Problem, Flug verspaetet) steht oben als grosse Karte, alles bereits Zugeteilte
  und Erledigte rutscht darunter in eine dichte, aufklappbare Liste.

Jordan will beides, umschaltbar.

### 4b. ENTSCHEIDUNG (von Jordan bestaetigt, bitte nicht neu aufrollen)

Der Umschalter kommt **NICHT** in den bestehenden Fahrten-Tab. Stattdessen ein
**komplett neuer, separater Nav-Punkt**. Begruendung (Prioritaet 1 = Stabilitaet):
der produktive Fahrten-Tab wird dadurch zeilenweise gar nicht angefasst, es ist
strukturell unmoeglich ihn zu brechen, und der Rueckbau ist trivial (Nav-Eintrag raus).
Bewusst in Kauf genommen: etwas Duplikation zwischen altem und neuem Bereich.

Vorgeschlagener Name: **"Fokus"** (Ein-Wort-Aenderung, falls Jordan was anderes will).

### 4c. Verdrahtungsplan (am 22.07. am Code verifiziert, Zeilen = Stand `14473e4`)

| # | Stelle | Aenderung |
|---|---|---|
| 1 | `MC_NAV`, Z. 12791-12793 (Gruppe FAHRTEN) | EINE neue Zeile nach `board`: `{ tab: "fokus", label: "Fokus", icon: ..., group: "FAHRTEN" }` |
| 2 | Render-Bereich, nach dem `tab === "board"`-Block (endet Z. ~12522) | neuer Block `{tab === "fokus" && (...)}` mit eigener Render-Funktion |
| 3 | sonst nichts | Rollen-Gating, Mobile-Leiste und Tab-Guard greifen automatisch |

Zu Punkt 3, das ist der entscheidende Teil:
- `MC_ROLE_TABS.dispo === null` heisst "alles" -> Leitstelle sieht den Punkt automatisch.
- `MC_ROLE_TABS.stage = ["overview","emergency"]` und `driver = ["overview"]` sind feste
  Allowlists, der neue Tab ist dort NICHT drin -> Stage-Read-only-Garantie und
  Fahreransicht bleiben unberuehrt, OHNE dort eine Zeile zu aendern.
- `MC_MOBILE_PRIMARY = ["overview","board","returns","drivers"]` listet ihn nicht ->
  landet mobil automatisch unter "Mehr".
- Der Guard in Z. ~12171 (`if (navItems.length && !navItems.some(...)) setTab(...)`)
  bleibt korrekt, ein zusaetzlicher erlaubter Tab bricht ihn nicht.

**Regressionsrisiko: niedrig.** Vier Tests haengen an der Nav (`smoke-teilpaket-c1-ui.mjs`,
`smoke-teilpaket-d-ui.mjs`, `smoke-teilpaket-f-ui.mjs`, `smoke-teilpaket-g2-ui.mjs`), sie
pruefen aber alle per `.includes()` auf einzelne Tabs, NICHT auf exakte Laenge oder
Reihenfolge. Ein zusaetzlicher Eintrag bricht sie nicht. Am 22.07. per Grep verifiziert,
nicht geraten -- bitte trotzdem selbst nachpruefen.

### 4d. Bauweise, zwei Schritte (nicht beides auf einmal)

1. **Erst Fokus-Modus (Idee B)** komplett bauen und verifizieren.
2. **Danach Zeit-Gruppierung (Idee A)** als zweiter Schritt dazu, mit dem Umschalter
   zwischen beiden Ansichten innerhalb des neuen Bereichs.

Wichtig fuer beide Schritte: die neuen Zeilen-/Kartendarstellungen muessen die
BESTEHENDEN Handler wiederverwenden, nicht neu bauen -- `setAssignRide`, `setEditRide`,
`setWaRide`, `GroupSuggestionNote`, `boardGroupPrimary`, das Flash-Highlight nach
Rueckgaengig, `computeDriverStats`. Keine zweite Quelle fuer Zuteilungs-, Status- oder
Filterlogik. Rein praesentational.

---

## 5. Weitere gefundene Punkte fuer spaetere Sessions

Aus frueheren Sessions offen (Details in `ABSCHLUSSBERICHT-Go-Live.md` Abschnitt 4):
1. Live-Realtime-Fanout auf ~25 Geraete (nur im echten Betrieb verifizierbar)
2. Supabase-Ausfall = kein weicher Multi-Geraete-Fallback
3. Gast-Idempotenz-SQL nicht umgesetzt (nachruestbar als SQL-Nachtrag)
4. Block-C Owner-Guard + guest-notes
5. Block-F Env-Fallback
6. Block-E-Labeling (kosmetisch)
7. Block-J flashIds-Cleanup (Wartbarkeit)
8. `argv[2]`-Uneinheitlichkeit der neun Testskripte (siehe Abschnitt 3)
9. g2-ui-Zeitfensterabhaengigkeit selbst

Nicht von hier durchfuehrbar: manueller Mehrrollen-Abnahmetest gegen die echte
Supabase-Instanz mit mindestens zwei Geraeten (`ABSCHLUSSBERICHT-Go-Live.md` Abschnitt 3,
`GO_LIVE_OPENBEATZ_2026.md`).

---

## 6. Ready-to-paste Opener

> Hier ein neuer Chat fuer das OpenBeatz-Shuttle-Leitstelle-Projekt. Bitte alles aus den
> Projekt-Anweisungen und meinen Erinnerungen beachten. Arbeitsverzeichnis MUSS
> `/home/claude/repo` sein. Erst Schritt 0 komplett, dann Thema.
>
> **Schritt 0:** Repo klonen (frischer PAT), nach `/home/claude/repo`, PAT sofort aus der
> Remote-URL scrubben. `npm ci`, git config (j.merg@merg-and-more.de / Jordan Merg).
> `git fetch` und **verifizieren, was wirklich auf dem Server steht** statt dem Opener zu
> glauben, Abweichung sofort melden.
> Erwartung: HEAD == origin/main == `14473e4`, `src/ShuttleLeitstelle.jsx` **13283 Zeilen**.
>
> **Volle Bestands-Regression gruen, bevor Neues gebaut wird.** esbuild, Duplikat-Grep
> mit `[a-zA-Z0-9_]` (die Buchstaben-only-Variante meldet faelschlich "function c").
> Fuer B/E/G ZUERST `python3 extract-funcs-teilpaket-{b,e,g}.py src/ShuttleLeitstelle.jsx
> tmp-t{b,e,g}-funcs.mjs`, dann die 44 Standard-Dateien (alle `smoke*.mjs` +
> `gegenprobe*.mjs` MINUS `gegenprobe-teilpaket-h-rpc-postgres.mjs` und MINUS
> `smoke-final-live-readiness.mjs`).
> **WICHTIG:** neun aeltere Tests (`smoke.mjs`, `smoke27b*.mjs`, `smoke27c/d/e.mjs`,
> `rendertest.mjs`) brauchen den Quellpfad als `process.argv[2]`, sonst brechen sie mit
> `ERR_INVALID_ARG_TYPE` ab und sehen faelschlich wie eine Regression aus.
> Danach `rendertest.mjs src/ShuttleLeitstelle.jsx` (5 Werte: 25053/2452/2413/2895/101),
> `kontrast.mjs` (0), `smoke-final-live-readiness.mjs` (45/45),
> `test_springer_availability.mjs src/ShuttleLeitstelle.jsx` (40/40). Extrakte danach loeschen.
> Flaky bleibt: `smoke-teilpaket-g2-ui.mjs` Tests 14/20/25/26/27 nur im Systemzeit-Fenster
> 06:00-08:00 (Container laeuft UTC, Nuernberg CEST), dokumentiert und keine Regression.
>
> **Thema dieser Session: Fokus-Bereich, Schritt 1 (Idee B).**
> Siehe `OPENER-Naechster-Chat-Fokus-Bereich.md` Abschnitt 4 im Repo -- Entscheidung,
> Verdrahtungsplan und Bauweise stehen dort komplett drin, bitte zuerst lesen und dann
> mit MIR abgleichen, bevor Code angefasst wird. Kurzfassung: NEUER separater Nav-Punkt
> "Fokus" in der Gruppe FAHRTEN, der bestehende Fahrten-Tab wird NICHT angefasst.
> Erst Fokus-Modus bauen, Zeit-Gruppierung kommt als eigener zweiter Schritt danach.
>
> Regeln unveraendert: rein additiv wo moeglich, kleinstmoeglich, keine Breaking Changes,
> keine Workflow-/Rollen-/Stage-Aenderungen, keine DB-Struktur-Aenderungen (ausser
> zwingend), keine kosmetischen Refactorings/Performance-Optimierungen ausserhalb des
> Themas. Vor jeder Code-Aenderung: Verdrahtungsplan + Einfuegestelle + Regressionsrisiko
> zeigen, meine Freigabe abwarten. Nach jeder Aenderung: volle Kette + Diff-Beweis +
> konkrete manuelle Testfaelle. Bugs ausserhalb des Themas -> "Weitere gefundene Punkte
> fuer spaetere Sessions", NICHT fixen. FREEZE AUFGEHOBEN seit 20.07.
> **Die App ist noch NICHT live, Festival laeuft 23.-27.07. Entsprechend vorsichtig.**
> Proaktiv vor zu langem Chat warnen. Nur eine Session gleichzeitig. `git fetch`
> unmittelbar vor jedem Push. Commit-Messages mit Umlauten ueber `/tmp/msg.txt` +
> `git commit -F`. Jede Live-Daten-Aenderung mit passendem Supabase-SQL-Nachtrag.
> Neue Tests: standalone `.mjs`, Quelle zeilengetreu replizieren, IMMER Pflicht-Gegenprobe
> + Drift-Check gegen die Quelle.
