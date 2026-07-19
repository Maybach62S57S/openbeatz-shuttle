Hier ein neuer Chat für das OpenBeatz-Shuttle-Leitstelle-Projekt. Bitte alles aus den
Projekt-Anweisungen und meinen Erinnerungen beachten.

`origin/main` steht auf `1fe51a5`. Alles liegt im Repo, nichts nur im Chat.

## Was in der letzten Session (19.07.2026, Chat-Interface) fertig wurde

Teilpaket B: zusaetzliche Ortszonen (Karl August, Leonardo, Flughafen Muenchen, GAT
Nuernberg, Hauptbahnhof Nuernberg), operative Pick-up-Points (Leonardo/HBF -> Festival
faehrt der Fahrer tatsaechlich zum Sheraton-Pickup, Rueckfahrten bleiben beim echten Ziel),
sichere Fahrzeitaufloesung (nie erfundene Zeiten). Rein additiv, Kernpfad-Eingriff in
evaluateInsertion minimal (3 Stellen), Rueckwaertskompatibilitaet zu den 4 alten Orten
per Regressionsvergleich alt/neu byte-identisch bewiesen (0 Abweichungen).

Verifikation: esbuild gruen, 69/69 Funktionstests (alle Spec-Faelle + Gegenprobe),
Regressionsvergleich byte-identisch, rendertest 5 Referenzwerte konstant, pruefe.mjs/
kontrast.mjs ohne Befund. GO empfohlen.

## Was dafuer angelegt wurde (alles im Repo-Root, Commits d3b8d10 + 1fe51a5)

- `src/ShuttleLeitstelle.jsx` ist der geaenderte Code (9522 Zeilen).
- `TEILPAKET-B-ANALYSE.md`: Ist-Stand-Analyse VOR der Implementierung (matchLoc/travelMin/
  Matrix-Struktur, Eingriffsstellen, bestaetigte Datenentscheidungen).
- `TEILPAKET-B-ABNAHME.md`: manuelle Abnahme-Checkliste ohne Programmierkenntnisse,
  inklusive dem wichtigen Hinweis, dass 3 Matrix-Werte vor dem Live-Betrieb manuell in
  Supabase nachgetragen werden muessen (sheraton|festival=38, muc|festival=105,
  muc|sheraton=105).
- `TEILPAKET-B-BERICHT-EXTERN.md`: ausfuehrlicher Abschlussbericht in externer, selbst-
  erklaerender Sprache (wurde Jordan zum Kopieren an ChatGPT bereitgestellt).
- `UEBERGABE-Session-18.md`: fortgeschrieben, neuer Abschnitt ganz unten ("Session vom
  19.07.2026 (Chat-Interface): Teilpaket B umgesetzt, verifiziert, committed") mit allen
  Details, Regressionsrisiken und der Live-Betrieb-Warnung.
- `smoke-teilpaket-b.mjs`, `regression-teilpaket-b.mjs`, `extract-funcs-teilpaket-b.py`:
  Proof-Skripte als Nachweis/Ausgangspunkt. WICHTIG: diese Skripte referenzieren teils
  `/tmp`-Pfade aus der Vorsession und muessen bei Bedarf neu generiert werden (der
  Extraktions-Mechanismus steht in UEBERGABE-Session-18.md beschrieben, ist aber nicht
  1:1 lauffaehig ohne Anpassung). Kein Blocker, nur beim Nacharbeiten beachten.
- Ruecksetzpunkt: Tag `pre-teilpaket-B` = `030bc15` (Codestand von Teilpaket A, VOR
  Teilpaket B). Liegt auf origin, mit `git ls-remote --tags origin` bestaetigt.

## Was du (neue Session) JETZT tun sollst

1. Repo klonen (frischer PAT kommt gleich), PAT sofort aus der Remote-URL entfernen.
2. **Erst selbst nachmessen, nicht diesem Opener vertrauen:**
   - `git fetch origin`, `git rev-parse origin/main` (soll `1fe51a5` sein)
   - `git log --graph --oneline --all` fuer den Gesamtueberblick
   - `wc -l src/ShuttleLeitstelle.jsx` (soll 9522 sein)
   - `git tag` und `git ls-remote --tags origin` (soll u.a. `pre-teilpaket-A` und
     `pre-teilpaket-B` zeigen, PRUEFEN dass sie wirklich auf origin liegen, nicht nur
     lokal existieren -- das war in einer frueheren Session schon einmal ein Problem)
   - `TEILPAKET-B-ANALYSE.md`, `TEILPAKET-B-ABNAHME.md` und den neuesten Abschnitt in
     `UEBERGABE-Session-18.md` lesen
3. Kurz den gemessenen Stand zusammenfassen und melden.
4. **Dann auf Jordans Ansage warten, was als Naechstes dran ist.** NICHT selbststaendig
   etwas aus einer Offene-Punkte-Liste anfangen (z.B. Timetable-Tab, Artist-Matching,
   Sammelfahrten, MC-Design-Migration Sessions 28-30 -- alles bewusst pausiert/offen,
   aber nicht von dir zu waehlen).

## Bekannte offene Punkte (nur zur Kenntnis, NICHT selbst anfangen)

- ~~Vor dem Live-Betrieb: 3 Matrix-Werte manuell in Supabase nachtragen~~ ERLEDIGT von
  Jordan am 19.07.2026 (`teilpaket-b-matrix-update.sql` ausgefuehrt, Kontroll-Abfrage
  bestaetigt). Kein offener Punkt mehr.
- Randfall computeDriverStats.locNow bei Custom-Zielen ohne Folgefahrt (dokumentiert in
  UEBERGABE-Session-18.md unter "Weitere gefundene Punkte").
- matchLoc trennt "private jet gat" weiterhin nicht separat (bewusst unangetastet).
- Naechster inhaltlicher Schritt vermutlich: Timetable-Tab / Artist-Matching (laut
  aelterer Uebergabe als Anschlussthema genannt) ODER MC-Design-Migration Sessions 28-30
  -- das entscheidet Jordan, nicht diese Session von sich aus.
- **18. Juli war der Multi-Fahrer-Testtermin, 21. Juli ist der Code-Freeze (keine
  Loeschungen mehr), Festival 23.-27. Juli 2026.** Bitte Zeitdruck ernst nehmen, aber wie
  von Jordan vorgegeben: sauber und vollstaendig arbeiten, keine abgekuerzte Verifikation.
- **Proaktiv vor zu langem Chat warnen**, bevor die Session crasht.
