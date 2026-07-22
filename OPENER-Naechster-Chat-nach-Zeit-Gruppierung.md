# Uebergabe an den naechsten Chat (nach der Zeit-Gruppierung)

Stand: 22.07.2026. Letzter Code-Commit = `63ef104`. Alles im Repo, nichts nur im Chat.

---

## 1. Was in dieser Session (22.07.2026) passiert ist

Schritt 0 stimmte mit dem vorherigen Opener ueberein: Code-Commit `0e8a951`,
13467 Zeilen, HEAD = origin/main, Working Tree sauber, kein Branch-Drift.
Volle Bestands-Regression vor der ersten Aenderung gruen gefahren (45/45).

**Eine Abweichung zum Opener, unkritisch und dokumentiert:** nach `0e8a951` lagen
**zwei** reine Doku-Commits (`7928aa8`, `85c825a`), nicht einer. Beide fassten
ausschliesslich `OPENER-Naechster-Chat-Zeit-Gruppierung.md` an. Genau deshalb ist
der Anker die Zeilenzahl plus der Code-Commit und nicht der HEAD-Hash.

**Ein Code-Commit, gepusht:**

- `63ef104` **Fokus-Bereich: Zeit-Gruppierung (Idee A) mit Ansichts-Umschalter**

Jordan hat die vier Punkte aus Abschnitt 4c des vorherigen Openers nicht selbst
entschieden, sondern die Entscheidung ausdruecklich delegiert ("entscheide fuer
mich und entscheide schlau"). Getroffen wurden diese vier Entscheidungen:

| Punkt | Entscheidung | Begruendung |
|---|---|---|
| Zeitgrenzen | vier Bloecke: Vormittag (bis 12:00) / Nachmittag (bis 18:00) / Abend (bis 24:00) / Nacht (ab 00:00) | Grenzen in sortMin-Space (720/1080/1440/Infinity). `sortMin` schiebt 00:00-05:59 um +1440, die Nacht sortiert sich dadurch ohne Sonderfall ans Ende. Nacht ist beim Festival ein eigener Betriebszustand (Rueckfahrten nach dem Set). |
| Erledigte | zugeklappt unten gesammelt, gemeinsamer Aufklapper fuer beide Ansichten | Bedienung bleibt zwischen den Ansichten identisch, `focusDoneOpen` wird wiederverwendet, kein neuer State. Mitgruppiert haetten sie bis Sonntagabend jeden Zeitblock zugemuellt. |
| kritische Faelle | sichtbar, aber flach: roter Streifen + Warnicon, Grund als `title`-Tooltip | Additiv ueber einen optionalen zweiten Parameter an `slimRow`. Grosse Karten haetten die Kompaktheit von Idee A zerstoert. |
| Persistenz | reiner `useState`, kein `localStorage` | Einen Tag vor dem Festival keinen neuen Persistenzpfad. Default `"prio"` heisst: ohne Klick Verhalten wie `0e8a951`. Rueckbau ist ein Zweizeiler. |

**Zusatzentscheidung (nicht im Opener gelistet):** leere Zeitbloecke werden
ausgeblendet statt als vier "Keine Fahrten"-Kaesten gestapelt. Wenn alle vier
Bloecke leer sind (nur Erledigte vorhanden), greift ein Fallback-Hinweis, damit
nie eine leere Flaeche steht.

### Aenderungsstellen (Zeilen = Stand `63ef104`)

| # | Zeile | Aenderung |
|---|---|---|
| 1 | 12082-12084 | neuer State `focusView` (`"prio"` \| `"zeit"`) -- die **einzige** Aenderung ausserhalb des Fokus-Blocks |
| 2 | 12565-12578 | Zeit-Partition: `TIME_BUCKETS` + `tBuckets`, reine Partition ueber `dayRides` |
| 3 | 12653-12656 | `slimRow` bekommt optionalen zweiten Parameter `ca` (emCases-Eintrag oder null) |
| 4 | 12676-12691 | `doneBlock()` als lokale Funktion, ersetzt den vorher inline stehenden Erledigt-Aufklapper |
| 5 | 12695-12703 | Ansichts-Umschalter, Optik 1:1 von der Filterleiste im Fahrten-Tab |
| 6 | 12709 | prio-Zweig bekommt `&& focusView === "prio"` |
| 7 | 12729-12741 | neuer Zeit-Zweig |

**65 Einfuegungen, 14 Loeschungen.** Die 14 Loeschungen sind ausschliesslich der
verschobene Erledigt-Block, die `slimRow`-Signatur samt Kommentar und die
Streifen-Zeile. Kein Verhaltensverlust, siehe Identitaetsbeweis unten.

Wiederverwendet statt neu gebaut: `head`, `hint`, `slimRow`, `doneBlock`,
`attnCase`, `bDone`, `sortMin`, `CASE_ICON`, `AlertTriangle`. Es gibt **keinen
zweiten Kartentyp**. Kein Schreibweg, kein neues `dyn`-Feld, keine DB-Aenderung,
**kein SQL-Nachtrag noetig**. Nav, Rollen-Gating, Fahrten-Tab, Handler und
Fahrer-live-Spalte sind unberuehrt.

### Der zentrale Beweis dieser Session

Weil mit `slimRow` und dem Erledigt-Block **bestehender** Code angefasst wurde,
wurde die Prio-Ansicht zeichenweise gegen `0e8a951` verglichen (Wegwerf-Skript,
beide Fassungen als Sonde gerendert, neuer Umschalter gezielt herausgeschnitten):

```
IDENTISCH zugeklappt          alt=14263  neu=14263
IDENTISCH aufgeklappt         alt=16263  neu=16263
IDENTISCH schmal (1-spaltig)  alt=14231  neu=14231
IDENTISCH leerer Tag          alt= 3437  neu= 3437
GEGENPROBE GRIFF: Zeit-Ansicht unterscheidet sich von der alten Fassung
```

Byte-identisch in allen vier Zustaenden. Die Gegenprobe belegt, dass der
Vergleich ueberhaupt anschlagen kann. **Dieses Muster bitte immer verwenden,
wenn bestehender Rendercode umgebaut statt nur ergaenzt wird.**

Praktischer Stolperstein dabei: `execSync("git show ...")` sprengt bei dieser
Dateigroesse den 1-MB-Default-Buffer und stirbt mit `ENOBUFS`. Die alte Fassung
vorher per Shell in eine Datei schreiben und mit `fs.readFileSync` lesen.

### Test

`smoke-fokus-bereich.mjs` **erweitert, nicht ersetzt**: von 51 OK / 7 Gegenproben
auf **80 OK / 12 Gegenproben** (219 -> 324 Zeilen). Der Block wird weiterhin per
Klammerzaehlung zeilengenau aus der Quelle geschnitten, kein Nachbau, Drift
strukturell ausgeschlossen. Die Sonde `FokusProbe` nimmt jetzt zusaetzlich
`focusView` / `setFocusView` entgegen.

Die neuen Testdaten (`zRides`) sind ein **eigener** Datensatz, damit die
bestehenden Tests 13-51 unveraendert auf ihren alten Daten laufen. Abgedeckt:
beide Ansichten, alle vier Zeitbloecke, die Grenzen minutengenau (11:59 vs 12:00,
17:59 vs 18:00, 23:59 vs 00:00), der Nacht-Sonderfall, Vollstaendigkeit und
Disjunktheit der Partition, Erledigt-Aufklapper in beiden Ansichten
("toggle trap"), kritische Hervorhebung, ausgeblendete Leerbloecke,
Fallback-Hinweis, Read-only am Quelltext.

**Pflicht-Gegenprobe mit drei absichtlich kaputten Kopien:**

| Sabotage | Ergebnis |
|---|---|
| Zeitgrenze Vormittag 720 -> 1080 | 5 FAIL, 2 Gegenproben gerissen |
| Erledigt-Filter aus der Partition entfernt | 5 FAIL, 1 Gegenprobe gerissen |
| kritische Hervorhebung abgeklemmt (`slimRow(r, null)`) | 3 FAIL, 1 Gegenprobe gerissen |

**Bei allen drei blieb esbuild gruen** -- erneute Bestaetigung, dass esbuild
allein kein Beweis ist.

---

## 2. Aktueller Stand (Ausgangspunkt fuer die naechste Session)

- Letzter **Code**-Commit = **`63ef104`**
- `src/ShuttleLeitstelle.jsx` = **13518 Zeilen**
- `smoke-fokus-bereich.mjs` = 324 Zeilen
- HEAD = `origin/main` = der reine Doku-Commit darueber (Hash wandert, **kein Anker**)
- Working Tree sauber, keine offenen Branches, kein ungepushter Stand
- FREEZE AUFGEHOBEN seit 20.07., Loeschungen/Aenderungen wieder erlaubt
- App ist noch **nicht** live. Festival 23.-27.07.

---

## 3. Regressions-Setup

**Standard-Regression = 45 Dateien.** Alle `smoke*.mjs` + `gegenprobe*.mjs`,
MINUS `gegenprobe-teilpaket-h-rpc-postgres.mjs` (braucht echte Postgres) und
MINUS `smoke-final-live-readiness.mjs` (eigener Deliverable, laeuft zusaetzlich).

**FALLE:** Neun aeltere Tests lesen die Quelle ueber `process.argv[2]` OHNE
Default und brechen ohne Argument mit `ERR_INVALID_ARG_TYPE` ab (sieht wie eine
Regression aus, ist keine). Betroffen: `smoke.mjs`, `smoke27b.mjs`,
`smoke27b-guest.mjs`, `smoke27b-sections.mjs`, `smoke27b-settings.mjs`,
`smoke27c.mjs`, `smoke27d.mjs`, `smoke27e.mjs`, `rendertest.mjs`.
`smoke-fokus-bereich.mjs` gehoert NICHT dazu, es hat einen Default, nimmt den
Pfad aber entgegen. Robuster Aufruf:

```bash
if grep -q 'process.argv\[2\]' "$f"; then node "$f" src/ShuttleLeitstelle.jsx; else node "$f"; fi
```

**Vor B/E/G zuerst die Extrakte bauen, danach loeschen:**
```bash
python3 extract-funcs-teilpaket-b.py src/ShuttleLeitstelle.jsx tmp-tb-funcs.mjs
python3 extract-funcs-teilpaket-e.py src/ShuttleLeitstelle.jsx tmp-te-funcs.mjs
python3 extract-funcs-teilpaket-g.py src/ShuttleLeitstelle.jsx tmp-tg-funcs.mjs
```

**Dokumentierte Flakiness, KEINE Regression:** `smoke-teilpaket-g2-ui.mjs` Tests
14/20/25/26/27 fallen nur im Systemzeit-Fenster 06:00-08:00. Container laeuft
UTC, Nuernberg CEST (UTC+2). Am 22.07. um 10:52 UTC lief g2-ui gruen durch
(51 OK), also ausserhalb des Fensters kein Problem.

**Duplikat-Grep MUSS `[a-zA-Z0-9_]` verwenden.** Die Buchstaben-only-Variante
meldet faelschlich "function c" (Regex-Artefakt, kein echtes Duplikat).

**Sollwerte nach `63ef104`:**

| Pruefung | Sollwert |
|---|---|
| `rendertest.mjs` | 25053 / 2452 / 2413 / 2895 / 101 |
| `kontrast.mjs` | 19 Pruefungen, 0 Failures |
| `smoke-final-live-readiness.mjs` | 45/45 |
| `test_springer_availability.mjs` | 40/40 |
| `smoke-fokus-bereich.mjs` | **80 OK, 12 Gegenproben** (war 51/7) |
| 45 Standarddateien | 45 gruen, 0 rot |

**JSX-Referenz-Cross-Check:** immer **gegen die Basis** vergleichen, nie absolut.
Die Liste unaufloesbarer Grossbuchstaben-Identifier muss byte-identisch zu
`git show HEAD:src/ShuttleLeitstelle.jsx` sein. Die absolute Zahl haengt davon
ab, wie grob das Skript gebaut ist (die Doku nannte frueher 18, eine groebere
Variante zaehlt 44) -- **aussagekraeftig ist ausschliesslich der Vergleich.**
Kleiner offener Punkt: dieses Skript ist nirgends im Repo festgeschrieben,
jede Session baut es neu. Waere eine Kandidatin fuer eine spaetere Session.

---

## 4. Thema der naechsten Session

**Nicht festgelegt.** Jordan entscheidet. Der Fokus-Bereich ist mit Schritt 1
(Nav-Punkt, `0e8a951`) und Schritt 2 (Zeit-Gruppierung, `63ef104`) inhaltlich
abgeschlossen. Moegliche Kandidaten, ohne Rangfolge:

1. **Persistenz des Ansichts-Umschalters** (`localStorage`) -- bewusst
   zurueckgestellt, sinnvoll erst nach dem Festival.
2. **Punkt 10 aus Abschnitt 5** (`computeDriverStats` wirft bei
   `dyn.rides === null`) -- betrifft die Fahrer-live-Spalte in Fahrten-Tab und
   Fokus-Bereich gleichermassen. Vor jedem Anfassen `rg.mjs` fahren, es ist
   geteilter Code mit Reichweite in andere Rollenpfade.
3. **`argv[2]`-Uneinheitlichkeit** der neun Testskripte vereinheitlichen
   (reine Wartbarkeit, kein Produktivcode).
4. Post-Festival: Paket 2 (Datei-Modularisierung, Base64-Assets).

**Waehrend des Festivals (23.-27.07.) bitte nichts Neues bauen.** Falls im
Livebetrieb etwas auffaellt: kleinstmoeglicher Fix, volle Kette, sonst nichts.

---

## 5. Weitere gefundene Punkte fuer spaetere Sessions

In dieser Session wurde **nichts Neues** gefunden. Die Liste bleibt unveraendert:

1. Live-Realtime-Fanout auf ~25 Geraete (nur im echten Betrieb verifizierbar)
2. Supabase-Ausfall = kein weicher Multi-Geraete-Fallback
3. Gast-Idempotenz-SQL nicht umgesetzt (nachruestbar als SQL-Nachtrag)
4. Block-C Owner-Guard + guest-notes
5. Block-F Env-Fallback
6. Block-E-Labeling (kosmetisch)
7. Block-J flashIds-Cleanup (Wartbarkeit)
8. `argv[2]`-Uneinheitlichkeit der neun Testskripte (siehe Abschnitt 3)
9. g2-ui-Zeitfensterabhaengigkeit selbst
10. **`computeDriverStats` wirft bei `dyn.rides === null`.** `driverDay()` ruft
    `.filter` auf `null` auf. Betrifft die Fahrer-live-Spalte im Fahrten-Tab
    genauso wie im Fokus-Bereich (beide Ansichten) -- bestehendes Verhalten,
    nicht neu eingefuehrt. In der App ist `rides` nach dem Laden immer ein
    Array, der Fall trifft nur ein sehr kurzes Kaltstart-Fenster.
11. JSX-Referenz-Cross-Check-Skript ist nicht im Repo festgeschrieben
    (neu notiert am 22.07., siehe Abschnitt 3).

Nicht von hier durchfuehrbar: manueller Mehrrollen-Abnahmetest gegen die echte
Supabase-Instanz mit mindestens zwei Geraeten (`ABSCHLUSSBERICHT-Go-Live.md`
Abschnitt 3, `GO_LIVE_OPENBEATZ_2026.md`).

---

## 6. Offene manuelle Testfaelle

**Status der neun Faelle aus der Vorsession ist UNBEKANNT** -- Jordan wurde
zweimal gefragt und hat nicht geantwortet. Sie werden hier vollstaendig als
offen gefuehrt, damit nichts stillschweigend als abgenommen gilt. Bitte im
naechsten Chat erneut nachfragen.

### 6a. Aus Schritt 1 (`0e8a951`), Status unbekannt

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

### 6b. Neu aus Schritt 2 (`63ef104`), noch nicht abgenommen

10. Umschalter oben links zeigt "Priorität" und "Nach Zeit", "Priorität" aktiv.
11. Ohne Klick sieht der Fokus-Bereich exakt aus wie vor dieser Session.
12. Klick auf "Nach Zeit": Fahrten stehen in Zeitbloecken, Reihenfolge
    Vormittag -> Nachmittag -> Abend -> Nacht.
13. Fahrt mit Startzeit nach Mitternacht (z. B. 01:30) steht im Nacht-Block
    ganz unten, **nicht** oben im Vormittag.
14. Zeitblock ohne Fahrten wird gar nicht angezeigt (kein leerer Kasten).
15. Problem an einer Fahrt melden, dann "Nach Zeit": die Zeile hat einen roten
    Streifen und ein Warnicon, Maus draufhalten zeigt den Grund.
16. Erledigt-Aufklapper funktioniert in beiden Ansichten gleich, Zaehler passt
    in beiden.
17. Erledigte und abgesagte Fahrten tauchen in keinem Zeitblock auf, nur im
    Aufklapper.
18. Seite neu laden: Umschalter steht wieder auf "Priorität" (so gewollt).
19. Umschalten waehrend eine Fahrt gerade den Status wechselt: keine
    Doppelanzeige, keine verschwundene Fahrt.

**Punkt 8 ist der wichtigste vor dem Festival** (Rollen-Gating). Am Gating wurde
in beiden Schritten nichts geaendert, `MC_ROLE_TABS.stage` und `.driver` sind
Allowlists ohne `"fokus"`, und der Test prueft das -- aber ein echter Login mit
beiden Rollen ist trotzdem die einzige belastbare Abnahme.

---

## 7. Ready-to-paste Opener fuer den naechsten Chat

```
Hier ein neuer Chat fuer das OpenBeatz-Shuttle-Leitstelle-Projekt. Bitte alles aus den Projekt-Anweisungen und meinen Erinnerungen beachten. Arbeitsverzeichnis MUSS /home/claude/repo sein. Erst Schritt 0 komplett, dann Thema.

Schritt 0: Repo klonen (frischer PAT), nach /home/claude/repo, PAT sofort aus der Remote-URL scrubben. npm ci, git config (j.merg@merg-and-more.de / Jordan Merg). git fetch und verifizieren, was wirklich auf dem Server steht statt dem Opener zu glauben, Abweichung sofort melden.

Erwartung: letzter CODE-Commit == 63ef104, src/ShuttleLeitstelle.jsx == 13518 Zeilen, smoke-fokus-bereich.mjs == 324 Zeilen, HEAD == origin/main == ein reiner Doku-Commit darueber (es koennen auch mehrere sein). Anker ist die Zeilenzahl plus der Code-Commit, NICHT der HEAD-Hash - der wandert bei jedem Doku-Push. HEAD und origin/main muessen aber identisch sein, jede Divergenz sofort melden.

Volle Bestands-Regression gruen, bevor Neues gebaut wird. esbuild, Duplikat-Grep mit [a-zA-Z0-9_] (die Buchstaben-only-Variante meldet faelschlich "function c"). Fuer B/E/G ZUERST python3 extract-funcs-teilpaket-{b,e,g}.py src/ShuttleLeitstelle.jsx tmp-t{b,e,g}-funcs.mjs, dann die 45 Standard-Dateien (alle smoke*.mjs + gegenprobe*.mjs MINUS gegenprobe-teilpaket-h-rpc-postgres.mjs und MINUS smoke-final-live-readiness.mjs).

WICHTIG: neun aeltere Tests (smoke.mjs, smoke27b*.mjs, smoke27c/d/e.mjs, rendertest.mjs) brauchen den Quellpfad als process.argv[2], sonst brechen sie mit ERR_INVALID_ARG_TYPE ab und sehen faelschlich wie eine Regression aus.

Danach rendertest.mjs src/ShuttleLeitstelle.jsx (5 Werte: 25053/2452/2413/2895/101), kontrast.mjs (19 Pruefungen, 0 Failures), smoke-final-live-readiness.mjs (45/45), test_springer_availability.mjs src/ShuttleLeitstelle.jsx (40/40), smoke-fokus-bereich.mjs (80 OK, 12 Gegenproben). Extrakte danach loeschen.

Flaky bleibt: smoke-teilpaket-g2-ui.mjs Tests 14/20/25/26/27 nur im Systemzeit-Fenster 06:00-08:00 (Container UTC, Nuernberg CEST), dokumentiert und keine Regression.

Thema dieser Session: <HIER THEMA EINTRAGEN>. Siehe OPENER-Naechster-Chat-nach-Zeit-Gruppierung.md Abschnitt 4 im Repo fuer die Kandidatenliste.

Bitte ausserdem Abschnitt 6 durchgehen und mich fragen, welche der manuellen Testfaelle ich schon abgenommen habe - der Status ist seit zwei Sessions unbekannt, besonders Punkt 8 (Rollen-Gating Stage/Fahrer).

Regeln unveraendert: rein additiv wo moeglich, kleinstmoeglich, keine Breaking Changes, keine Workflow-/Rollen-/Stage-Aenderungen, keine DB-Struktur-Aenderungen (ausser zwingend), keine kosmetischen Refactorings/Performance-Optimierungen ausserhalb des Themas. Vor jeder Code-Aenderung: Verdrahtungsplan + Einfuegestelle + Regressionsrisiko zeigen, meine Freigabe abwarten. Nach jeder Aenderung: volle Kette + Diff-Beweis + konkrete manuelle Testfaelle. Wenn bestehender Rendercode umgebaut statt nur ergaenzt wird: zusaetzlich Zeichen-Identitaetsbeweis gegen den vorherigen Code-Commit (Muster siehe Abschnitt 1). Bugs ausserhalb des Themas -> "Weitere gefundene Punkte fuer spaetere Sessions", NICHT fixen. FREEZE AUFGEHOBEN seit 20.07.

Die App ist noch NICHT live, Festival laeuft 23.-27.07. Waehrend des Festivals bitte nichts Neues bauen, nur kleinstmoegliche Fixes bei echten Livebetrieb-Problemen.

Proaktiv vor zu langem Chat warnen. Nur eine Session gleichzeitig. git fetch unmittelbar vor jedem Push. Commit-Messages mit Umlauten ueber /tmp/msg.txt + git commit -F. Jede Live-Daten-Aenderung mit passendem Supabase-SQL-Nachtrag. Neue Tests: standalone .mjs, Quelle zeilengetreu replizieren oder direkt aus der Quelle schneiden, IMMER Pflicht-Gegenprobe + Drift-Check gegen die Quelle.

<HIER FRISCHEN PAT EINFUEGEN>
```
