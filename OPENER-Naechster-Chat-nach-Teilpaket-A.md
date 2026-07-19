# Ready-to-paste Opener: nächster Chat, nach Teilpaket A

Du läufst im Chat-Interface (Sandbox mit bash_tool, nicht Claude Code auf dem Mac).
Jordan liefert dir am Sessionanfang einen frischen fine-grained GitHub-PAT. Klone das
Repo damit, dann sofort scrubben:

    git clone https://<PAT>@github.com/Maybach62S57S/openbeatz-shuttle.git
    cd openbeatz-shuttle
    git remote set-url origin https://github.com/Maybach62S57S/openbeatz-shuttle.git

Für spätere Pushes denselben PAT direkt in der Push-URL verwenden (nicht in
`git remote set-url` speichern), Ausgabe danach auf Token-Reste prüfen:

    git push "https://x-access-token:<PAT>@github.com/Maybach62S57S/openbeatz-shuttle.git" main

`npm install` nötig (frischer Klon, `node_modules` ist nicht im Repo). Danach für
`rendertest.mjs` den Symlink-Trick setzen (das Skript schreibt hart nach
`/home/claude/repo/`):

    mkdir -p /home/claude/repo
    ln -s $(pwd)/node_modules /home/claude/repo/node_modules
    # rendertest dann so aufrufen:
    cd /home/claude/repo && node <repo-pfad>/rendertest.mjs <repo-pfad>/src/ShuttleLeitstelle.jsx

## SCHRITT 0, PFLICHT, BEVOR DU IRGENDWAS BAUST

Diesem Opener nicht blind trauen, das ist eine Absicht, kein Messwert. Erst messen:

    git fetch origin
    git log --graph --oneline --all --decorate | head -20
    wc -l src/ShuttleLeitstelle.jsx
    git tag | grep -i teilpaket

## STAND, gemessen am 19.07.2026

    main = 72f1b5b  (Teilpaket A, gepusht, verifiziert)
    src/ShuttleLeitstelle.jsx = 9261 Zeilen
    Ruecksetzpunkt davor: Tag pre-teilpaket-A = ea74666 (9124 Zeilen)

Zuerst lesen, ganz unten steht der echte Stand: **`UEBERGABE-Session-18.md`**
(Abschnitt "Session vom 19.07.2026 (Chat-Interface): Teilpaket A fertiggestellt").
Vollständiger Fachbericht zu Teilpaket A: **`TEILPAKET-A-Ergebnisbericht.md`**.

**Zeilennummern verschieben sich mit jeder Änderung. Ein Beispiel aus dieser Session:**
`matchLoc` stand in älterer Doku bei Z. 7676, ist jetzt bei **Z. 7833** (Verschiebung durch
die 137 Zeilen von Teilpaket A vor `evaluateInsertion`). Immer per grep nachmessen, nie auf
eine alte Zahl aus der Doku verlassen.

## Was Teilpaket A gebracht hat (Kurzfassung, Details im Ergebnisbericht)

Additive Erweiterung des bestehenden Vorschlagsmotors (`evaluateInsertion`/`suggestDrivers`),
kein neuer Motor. Drei neue optionale Fahrerfelder: `driverCategory` ("regular"|"springer"),
`availableFrom` (lokales Format "YYYY-MM-DD HH:MM"), `teamGroup`. Werte aus
`drivers_openbeatz.json`, gemappt über eindeutigen normalisierten Vollnamen, liegen als
`DRIVER_PROFILES`-Konstante im Code, DB-Override-Pfad vorbereitet (`fromDbDriver` reicht
drei optionale Spalten durch). Springerlogik als harter zweistufiger Filter, kein Score.
Verfügbarkeit als harter Ausschluss gegen den frühesten benötigten Einsatzbeginn. Team nur
sichtbare Info, kein Ranking-Einfluss. Alle vier bestehenden Schreibwege unangetastet.
34/34 neue Tests grün, alle bestehenden Regressionstests grün (0 entfernte Funktionen laut
`pruefe.mjs`-Diff), voll dokumentiert und gepusht.

## Offen, NICHT von selbst anfangen

1. **`pruefe-fahrerabgleich.mjs` mit echten Supabase-Live-Zeilen.** Aus dieser Sandbox kein
   direkter DB-Zugriff möglich. Braucht entweder eine Session mit echtem Supabase-Zugriff
   oder Jordan liefert das SQL-Abfrageergebnis als JSON.
2. **`matchLoc`-Bug** (jetzt Z. 7833), Hardcoded auf 4 Locations statt `setup.locations`.
   Betrifft laut älterer Analyse ca. 108 Fahrten (rund ein Drittel). War früher als
   "mandatory code fix vor dem Festival" markiert, aber die Standing Rule gilt weiter:
   Jordan sagt nach und nach, was gebaut wird. Nicht von selbst starten.
3. **Weitere Teilpakete** für den Vorschlagsmotor (B, C, ...): Umfang und Reihenfolge
   bestimmt Jordan. Kein Vorgriff, keine Annahme, was als Nächstes kommt.
4. **Sessions 28 bis 30** (MC-Migration: Shell, PresenceManager-Rest, AuditLog, Report)
   bleiben bis nach dem Festival pausiert (Entscheidung aus einer früheren Session).
5. Fahrertest war für Samstag 18.07. angesetzt, liegt zum Zeitpunkt dieses Openers bereits
   zurück. Ergebnis in den bisherigen Sessions nicht dokumentiert, ggf. bei Jordan nachfragen.

## Standing Rules, gelten unverändert

- Keine neue Entwicklung, keine Workflow-/Rollen-/Stage-Änderungen, keine DB-Struktur-
  Änderungen (außer zwingend nötig), keine kosmetischen Refactorings, keine Performance-
  Optimierungen außerhalb des aktuellen Themas, nichts außerhalb des Session-Pakets.
- Erst vollständig bestehenden Code analysieren, bevor irgendwas angefasst wird. Jede
  Änderung so klein wie möglich und begründet.
- Nach jeder Änderung: Code komplett neu durchsehen, Build fahren, Regressionsrisiken
  benennen, konkrete manuelle Testfälle auflisten.
- Priorität: 1. Stabilität 2. Datenintegrität 3. Sicherheit 4. Wartbarkeit 5. Performance.
- Bugs außerhalb des Session-Umfangs -> unter "Weitere gefundene Punkte für spätere
  Sessions" notieren, nicht fixen.
- **Ab 21.07. keine Löschungen mehr** (Festival 23. bis 27.07.2026).
- PIN-Sicherheitsthema (Klartext-PINs, Client-seitiger Vergleich): nicht proaktiv
  ansprechen, nur wenn Jordan explizit danach fragt.
- Sprache: Deutsch, informell/direkt, keine Gedankenstriche, korrekte Umlaute.
- esbuild allein ist kein Beweis. Volle Pipeline: esbuild + Dupli-Grep + JSX-Referenz-
  Cross-Check + `pruefe.mjs`-Diff gegen den Rücksetzpunkt + `rendertest.mjs` (5
  Referenzwerte) + `smoke*.mjs` (Classic-Reste = 0) + `kontrast.mjs` + konkrete
  Testskripte gegen die echten Funktionen.
- Commit-Messages mit Umlauten nur über `/tmp/msg.txt` + `git commit -F`, nie inline `-m`.
- **`git fetch` direkt vor jedem Push**, nicht nur am Sessionanfang.
- Proaktiv warnen, wenn der Chat zu lang wird, bevor es knapp wird, nicht erst danach.

## Ablauf für diese Session

1. Schritt 0 messen und Jordan den Stand kurz bestätigen.
2. Auf Jordans Ansage warten, was als Nächstes dran ist. Nicht von der Liste oben selbst
   etwas auswählen und anfangen.
3. Bei Unklarheiten zuerst ehrliche Risikoeinschätzung geben, dann erst nach Bestätigung
   bauen.
