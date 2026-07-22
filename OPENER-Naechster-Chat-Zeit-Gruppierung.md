# Uebergabe an den naechsten Chat (Zeit-Gruppierung, Idee A)

Stand: 22.07.2026, `origin/main` = `0e8a951`. Alles im Repo, nichts nur im Chat.

---

## 1. Was in dieser Session (22.07.2026) passiert ist

Schritt 0 stimmte exakt mit dem vorherigen Opener ueberein (`14d3f27`, 13283 Zeilen,
kein Branch-Drift). Volle Bestands-Regression vor jeder Aenderung gruen gefahren.

**Ein Code-Commit, gepusht:**

- `0e8a951` **Fokus-Bereich: neuer Nav-Punkt (Idee B, Schritt 1)**

Vier Aenderungsstellen, alle additiv, keine davon im Fahrten-Tab:

| Stelle | Aenderung |
|---|---|
| Z. 8 | `Crosshair` im lucide-Import ergaenzt (einziges geloeschtes/ersetztes Zeilenpaar im Diff) |
| Z. 12077-12081 | eigene `useElementWidth`-Messung (`focusRef`/`focusWidth`) + `focusDoneOpen`-State |
| Z. 12529-12705 | neuer Render-Block hinter `tab === "fokus"` |
| Z. 12975 | eine Zeile in `MC_NAV` |

Der Block ist rein praesentational. Vier Eimer, jede Fahrt des Tages landet in genau
einem, die Reihenfolge der Pruefungen IST die Zuordnungsregel:

1. **Braucht Aufmerksamkeit** -- Quelle ist ausschliesslich das bereits im Shell
   berechnete `emCases` (`emergencyCases`). Pro Fahrt dedupliziert (eine Fahrt kann
   mehrere Faelle haben, z.B. Problem UND Flugalarm), Reihenfolge critical-vor-warn
   kommt unveraendert aus `emergencyCases`.
2. **Offen, noch Zeit** -- ohne Fahrer, nicht in Eimer 1.
3. **Laeuft gerade** -- Fahrer zugeteilt, nicht erledigt. Enthaelt bewusst auch
   `planned`-Fahrten mit Fahrer (zugeteilt, aber noch nicht gestartet).
4. **Erledigt** -- `done` + `cancelled`, zugeklappt.

Wiederverwendet statt neu gebaut: `setAssignRide` / `setEditRide` / `setWaRide`,
`GroupSuggestionNote`, `boardGroupPrimary`, `computeDriverStats` + `DriverRow`,
`StatusBadge`, `mcRideStatusKey`, `locName`, `flightDelayed`, `ZoneChip`,
`EmptyState`, `LoadingState`, `flashIds`. Kein Schreibweg, kein neues `dyn`-Feld,
keine DB-Aenderung, kein SQL-Nachtrag.

**Rollen-Gating greift automatisch, ohne eine Zeile dort zu aendern:**
`MC_ROLE_TABS.stage = ["overview","emergency"]` und `driver = ["overview"]` sind
Allowlists ohne `"fokus"`. Stage-Read-only-Garantie und Fahreransicht unberuehrt.
`MC_MOBILE_PRIMARY` listet `fokus` nicht -> landet mobil unter "Mehr".

**Neuer Test `smoke-fokus-bereich.mjs` (51 OK, 7 Gegenproben).** Bauweise wichtig
fuer die Fortsetzung: der Block wird per Klammerzaehlung **zeilengenau aus der
Quelle geschnitten** und in eine Wegwerf-Sonde `FokusProbe` gewrappt, statt
nachgebaut zu werden. Drift zwischen Test und Quelle ist damit strukturell
ausgeschlossen. Alle zeitabhaengigen Eingaben (`emCases`) werden als Prop
injiziert, der Test ist daher **nicht** systemzeitabhaengig (anders als g2-ui).

Drei absichtlich kaputte Kopien haben ihn korrekt zum Kippen gebracht:
`cancelled` nicht in Eimer 4 (3 FAILs), Dedup entfernt (2 FAILs), Icon-Name
verfaelscht (`ReferenceError` beim Rendern). **Bei allen drei blieb esbuild gruen** --
erneute Bestaetigung, dass esbuild allein kein Beweis ist.

**Korrektur gegenueber dem alten Opener:** Er nennt vier nav-abhaengige Tests.
Tatsaechlich haben nur zwei einen `mcNavForRole`-Bezug (`smoke-teilpaket-c1-ui.mjs`
Z. 43-50, `smoke-teilpaket-d-ui.mjs` Z. 138-144), und beide pruefen ausschliesslich
per `.includes()`. `smoke-teilpaket-f-ui.mjs` und `smoke-teilpaket-g2-ui.mjs` haben
null Treffer auf `MC_NAV`/`mcNavForRole`. Reine Doku-Ungenauigkeit, keine Wirkung.

---

## 2. Aktueller Stand (Ausgangspunkt)

- Letzter **Code**-Commit = **`0e8a951`**
- HEAD = `origin/main` = der reine Doku-Commit darueber (Hash wandert, kein Anker)
- `src/ShuttleLeitstelle.jsx` = **13467 Zeilen**
- Working Tree sauber, keine offenen Branches, kein ungepushter Stand
- FREEZE AUFGEHOBEN seit 20.07., Loeschungen/Aenderungen wieder erlaubt
- App ist noch **nicht** live. Festival 23.-27.07.

---

## 3. Regressions-Setup (aktualisiert, bitte genau lesen)

**Standard-Regression = 45 Dateien** (war 44, `smoke-fokus-bereich.mjs` ist neu
dazugekommen). Alle `smoke*.mjs` + `gegenprobe*.mjs`, MINUS
`gegenprobe-teilpaket-h-rpc-postgres.mjs` (braucht echte Postgres) und MINUS
`smoke-final-live-readiness.mjs` (eigener Deliverable, laeuft zusaetzlich).

**FALLE:** Neun aeltere Tests lesen die Quelle ueber `process.argv[2]` OHNE Default
und brechen ohne Argument mit `ERR_INVALID_ARG_TYPE` ab (sieht wie eine Regression
aus, ist keine). Betroffen: `smoke.mjs`, `smoke27b.mjs`, `smoke27b-guest.mjs`,
`smoke27b-sections.mjs`, `smoke27b-settings.mjs`, `smoke27c.mjs`, `smoke27d.mjs`,
`smoke27e.mjs`, `rendertest.mjs`. `smoke-fokus-bereich.mjs` gehoert NICHT dazu, es
hat einen Default, nimmt den Pfad aber entgegen. Robuster Aufruf:

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
14/20/25/26/27 fallen ausserhalb des Systemzeit-Fensters 06:00-08:00. Container
laeuft UTC, Nuernberg CEST (UTC+2). Am 22.07. um 09:04 UTC lief g2-ui gruen durch
(51 OK), also ausserhalb des Fensters kein Problem.

**Duplikat-Grep MUSS `[a-zA-Z0-9_]` verwenden.** Die Buchstaben-only-Variante meldet
faelschlich "function c" (Regex-Artefakt, kein echtes Duplikat).

**Referenzwerte `rendertest.mjs` (muessen konstant bleiben):**
App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895,
Field ohne mc 101. Am 22.07. nach dem Fokus-Bau unveraendert bestaetigt.

**`kontrast.mjs`:** 0 Failures. **`smoke-final-live-readiness.mjs`:** 45/45.
**`test_springer_availability.mjs`:** 40/40 (braucht Quellpfad als argv[2]).
**`smoke-fokus-bereich.mjs`:** 51 OK, 7 Gegenproben.

**Nuetzlicher Zusatzcheck (in dieser Session eingefuehrt):** JSX-Referenz-Cross-Check
gegen die Basis statt absolut. Die Liste unaufloesbarer Grossbuchstaben-Identifier
ist byte-identisch zu `git show HEAD:src/ShuttleLeitstelle.jsx`, wenn nichts kaputt
ist. Absolut betrachtet enthaelt sie immer 18 harmlose Eintraege (lokale consts und
destrukturierte Props wie `Icon`, `Ic`, `CIcon`, `SchematicComponent`). Nur der
**Vergleich** ist aussagekraeftig.

---

## 4. Thema der naechsten Session: Zeit-Gruppierung (Idee A) + Umschalter

### 4a. Was gebaut werden soll

Der Fokus-Bereich bekommt eine zweite Ansicht, umschaltbar innerhalb desselben
Nav-Punktes. Idee A aus dem urspruenglichen Mockup: Fahrten in Zeitbloecke
gruppiert (Vormittag / Nachmittag / Abend), kompakte einzeilige Darstellung,
Statusfarbe als Streifen links. Der Fahrten-Tab bleibt weiterhin unberuehrt.

### 4b. Verdrahtungsplan (am 22.07. am Code verifiziert, Zeilen = Stand `0e8a951`)

| # | Stelle | Aenderung |
|---|---|---|
| 1 | Z. 12080-12081 (neben `focusDoneOpen`) | neuer State `const [focusView, setFocusView] = useState("prio");` |
| 2 | im Fokus-Block, direkt nach `return (` Z. 12654 | Umschalter-Leiste, Optik 1:1 von der Filterleiste im Fahrten-Tab (Z. 12397, `mc-inset` + `mc-hover` Segmentbuttons) |
| 3 | im Fokus-Block, Z. 12663-12690 (der `space-y-5`-Wrapper mit den vier Bloecken: Ueberschriften bei 12665 / 12670 / 12675, Aufklapper bei 12680) | die vier Eimer-Bloecke nur noch bei `focusView === "prio"` rendern, zweiter Zweig fuer `"zeit"` daneben |
| 4 | sonst nichts | Nav, Rollen-Gating, Fahrerspalte, Handler bleiben unveraendert |

Die Zeit-Ansicht kann `slimRow` (Z. 12636) und `head` (Z. 12562) **unveraendert
wiederverwenden**, beide sind bereits generisch. Es braucht keine neue Kartenart.
Die Gruppierung selbst ist eine reine Partition ueber `dayRides` nach `sortMin(r.time)`,
analog zur bestehenden Eimer-Logik.

**Regressionsrisiko: sehr niedrig.** Alles passiert innerhalb eines Blocks, den es
vor `0e8a951` gar nicht gab. Der Default `"prio"` bedeutet: ohne Klick sieht der
Bereich exakt so aus wie jetzt. Rueckbau = Umschalter raus, `focusView` raus.

### 4c. Vor Baubeginn mit Jordan klaeren (NICHT selbst entscheiden)

1. **Zeitgrenzen.** Vormittag / Nachmittag / Abend -- wo genau schneiden? Bei einem
   Festival mit Fahrten bis nach Mitternacht reichen drei Bloecke moeglicherweise
   nicht (Nacht separat?). Vorschlag zur Diskussion: bis 12:00 / bis 18:00 /
   bis 24:00 / danach "Nacht".
2. **Was passiert mit Erledigten in der Zeit-Ansicht?** Mitgruppiert und ausgegraut,
   oder wie in der Prio-Ansicht unten zugeklappt gesammelt?
3. **Bleiben kritische Faelle in der Zeit-Ansicht hervorgehoben** (roter Streifen +
   Grundzeile), oder ist die Zeit-Ansicht bewusst "flach"?
4. **Merkt sich der Umschalter die Wahl** ueber einen Tagwechsel hinweg? (Reiner
   `useState` = nein, das waere das kleinste Verhalten. `localStorage` waere eine
   Persistenz-Entscheidung und braucht eine eigene Freigabe.)

### 4d. Testerweiterung

`smoke-fokus-bereich.mjs` erweitern, nicht ersetzen. Die Sonde `FokusProbe` nimmt
`focusView` bereits ueber `p` entgegen, sobald der State als Prop durchgereicht
wird -- die Destrukturierung im Test muss dann um `focusView` / `setFocusView`
ergaenzt werden. Beide Ansichten muessen abgedeckt sein (gleiche "toggle trap"-Regel
wie beim Erledigt-Aufklapper), plus Gegenprobe, dass die Zeitgrenzen wirklich
greifen.

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

Neu am 22.07. gefunden, bewusst NICHT gefixt (ausserhalb Thema):

10. **`computeDriverStats` wirft bei `dyn.rides === null`.** `driverDay()` ruft
    `.filter` auf `null` auf. Betrifft die Fahrer-live-Spalte im **Fahrten-Tab
    genauso** wie im neuen Fokus-Bereich -- bestehendes Verhalten, nicht in dieser
    Session eingefuehrt. In der App ist `rides` nach dem Laden immer ein Array, der
    Fall trifft nur ein sehr kurzes Kaltstart-Fenster. Der Fahrten-Teil beider Tabs
    hat einen sauberen Ladezustand (`ridesLoaded`), die Fahrerspalte nicht.
    Kleinstmoeglicher Fix waere ein Guard in `driverDay`, aber das ist geteilter
    Code mit Reichweite in andere Rollenpfade -- vorher `rg.mjs` fahren.
11. Doku-Ungenauigkeit im vorherigen Opener zur Zahl der nav-abhaengigen Tests
    (siehe Abschnitt 1), hier bereits korrigiert.

Nicht von hier durchfuehrbar: manueller Mehrrollen-Abnahmetest gegen die echte
Supabase-Instanz mit mindestens zwei Geraeten (`ABSCHLUSSBERICHT-Go-Live.md`
Abschnitt 3, `GO_LIVE_OPENBEATZ_2026.md`).

---

## 6. Offene manuelle Testfaelle aus dieser Session

Noch nicht von Jordan abgenommen, bitte im naechsten Chat kurz nachfragen:

1. Leitstelle: "Fokus" erscheint in der linken Nav direkt unter "Fahrten".
2. Board-Filter auf "Erledigt" stellen, dann auf Fokus wechseln -- Fokus zeigt
   trotzdem alle Bloecke (haengt bewusst nicht am Board-Filter).
3. Fahrt ohne Fahrer mit Start in unter 45 min -> oben mit Grundzeile.
4. Fahrer zuteilen -> Fahrt wandert nach "Laeuft gerade".
5. Problem melden -> Fahrt springt nach oben, Grund im Klartext.
6. "Erledigt" auf-/zuklappen, Zaehler passt.
7. Fenster unter 640px -> Fahrerspalte rutscht unter die Fahrten.
8. **Stage Manager und Fahrer einloggen: "Fokus" darf dort NICHT auftauchen.**
9. Mobil: "Fokus" unter "Mehr", nicht in der Hauptleiste.

---

## 7. Ready-to-paste Opener fuer den naechsten Chat

```
Hier ein neuer Chat fuer das OpenBeatz-Shuttle-Leitstelle-Projekt. Bitte alles aus den Projekt-Anweisungen und meinen Erinnerungen beachten. Arbeitsverzeichnis MUSS /home/claude/repo sein. Erst Schritt 0 komplett, dann Thema.

Schritt 0: Repo klonen (frischer PAT), nach /home/claude/repo, PAT sofort aus der Remote-URL scrubben. npm ci, git config (j.merg@merg-and-more.de / Jordan Merg). git fetch und verifizieren, was wirklich auf dem Server steht statt dem Opener zu glauben, Abweichung sofort melden.

Erwartung: letzter CODE-Commit == 0e8a951, src/ShuttleLeitstelle.jsx == 13467 Zeilen, HEAD == origin/main == der darauf folgende reine Doku-Commit. Anker ist die Zeilenzahl plus der Code-Commit, NICHT der HEAD-Hash - der wandert bei jedem Doku-Push. HEAD und origin/main muessen aber identisch sein, jede Divergenz sofort melden.

Volle Bestands-Regression gruen, bevor Neues gebaut wird. esbuild, Duplikat-Grep mit [a-zA-Z0-9_] (die Buchstaben-only-Variante meldet faelschlich "function c"). Fuer B/E/G ZUERST python3 extract-funcs-teilpaket-{b,e,g}.py src/ShuttleLeitstelle.jsx tmp-t{b,e,g}-funcs.mjs, dann die 45 Standard-Dateien (alle smoke*.mjs + gegenprobe*.mjs MINUS gegenprobe-teilpaket-h-rpc-postgres.mjs und MINUS smoke-final-live-readiness.mjs).

WICHTIG: neun aeltere Tests (smoke.mjs, smoke27b*.mjs, smoke27c/d/e.mjs, rendertest.mjs) brauchen den Quellpfad als process.argv[2], sonst brechen sie mit ERR_INVALID_ARG_TYPE ab und sehen faelschlich wie eine Regression aus.

Danach rendertest.mjs src/ShuttleLeitstelle.jsx (5 Werte: 25053/2452/2413/2895/101), kontrast.mjs (0), smoke-final-live-readiness.mjs (45/45), test_springer_availability.mjs src/ShuttleLeitstelle.jsx (40/40), smoke-fokus-bereich.mjs (51 OK, 7 Gegenproben). Extrakte danach loeschen.

Flaky bleibt: smoke-teilpaket-g2-ui.mjs Tests 14/20/25/26/27 nur im Systemzeit-Fenster 06:00-08:00 (Container UTC, Nuernberg CEST), dokumentiert und keine Regression.

Thema dieser Session: Fokus-Bereich, Schritt 2 (Zeit-Gruppierung, Idee A, mit Umschalter).

Siehe OPENER-Naechster-Chat-Zeit-Gruppierung.md Abschnitt 4 im Repo, Verdrahtungsplan steht dort komplett drin, bitte zuerst lesen. WICHTIG: Abschnitt 4c listet vier Punkte, die du NICHT selbst entscheiden darfst (Zeitgrenzen, Umgang mit Erledigten, Hervorhebung kritischer Faelle, Persistenz des Umschalters) - die bitte zuerst mit MIR abgleichen. Schritt 1 (Fokus-Modus) ist fertig und gepusht, der wird nicht neu aufgerollt.

Bitte ausserdem Abschnitt 6 durchgehen und mich fragen, welche der manuellen Testfaelle aus der letzten Session ich schon abgenommen habe.

Regeln unveraendert: rein additiv wo moeglich, kleinstmoeglich, keine Breaking Changes, keine Workflow-/Rollen-/Stage-Aenderungen, keine DB-Struktur-Aenderungen (ausser zwingend), keine kosmetischen Refactorings/Performance-Optimierungen ausserhalb des Themas. Vor jeder Code-Aenderung: Verdrahtungsplan + Einfuegestelle + Regressionsrisiko zeigen, meine Freigabe abwarten. Nach jeder Aenderung: volle Kette + Diff-Beweis + konkrete manuelle Testfaelle. Bugs ausserhalb des Themas -> "Weitere gefundene Punkte fuer spaetere Sessions", NICHT fixen. FREEZE AUFGEHOBEN seit 20.07.

Die App ist noch NICHT live, Festival laeuft 23.-27.07. Entsprechend vorsichtig.

Proaktiv vor zu langem Chat warnen. Nur eine Session gleichzeitig. git fetch unmittelbar vor jedem Push. Commit-Messages mit Umlauten ueber /tmp/msg.txt + git commit -F. Jede Live-Daten-Aenderung mit passendem Supabase-SQL-Nachtrag. Neue Tests: standalone .mjs, Quelle zeilengetreu replizieren oder direkt aus der Quelle schneiden, IMMER Pflicht-Gegenprobe + Drift-Check gegen die Quelle.

<HIER FRISCHEN PAT EINFUEGEN>
```
