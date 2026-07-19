# Phase 0b: Ergänzung und Präzisierung (drivers_openbeatz.json liegt jetzt vor)

Rein lesende Analyse, kein produktiver Code geändert. Aufbauend auf `PHASE-0-ANALYSE-Vorschlag-Knopf.md`.
Stand: 19.07.2026, main = 2b1d4ac. Datenquelle jetzt zusätzlich: `drivers_openbeatz.json` (23 Fahrer).

**Wichtige Einschränkung vorab:** Kein Zugriff auf die echte Supabase-Live-Datenbank. Alle Aussagen
zu "aktuellen Fahrer-Stammdaten" beziehen sich auf `seedDrivers()`/`ROSTER` im Code (Z. 445-467),
die einzige im Repo verfügbare Näherung. Das ist der Startzustand bei Erstinstallation, nicht
zwangsläufig der heutige Live-Stand, falls seitdem manuell in der DB korrigiert wurde. Abschnitt 2
und 3 sind entsprechend als "wahrscheinlich, nicht bestätigt" zu lesen.

---

## 1. Fahrerdatei-Validierung

23 Fahrer total: 21 regulär, 2 Springer (Leon Merg, Philipp Stich). 7 Van, 16 Car.
Sitzverteilung: 16× 4 Sitze (Car), 5× 6 Sitze (Van), 2× 7 Sitze (Van).
1 Fahrer mit `available_from` (Philipp Baumeister, 2026-07-25 14:00).
3 Fahrer mit `timmy_team: true` (Patrick Ibrahimi, Mustafa Ünver, Lukas Bieber).
Keine doppelten IDs, keine doppelten Namen, keine fehlenden Pflichtfelder, keine ungültigen
Datumswerte, keine Inkonsistenzen (Car≠4 Sitze, Van mit Sitzzahl≠6/7, Springer+Timmy gleichzeitig
— keiner dieser Fälle kommt vor).

## 2. Fahrer-Mapping zur App (ROSTER-Näherung, siehe Einschränkung oben)

| Extern-ID | Name | App-ID (ROSTER) | Match | Fzg ext/App | Sitze ext/App | Abweichung |
|---|---|---|---|---|---|---|
| d01 | Leon Merg | — | **kein Match** | car/— | 4/— | **FAHRER FEHLT** |
| d02 | Philipp Stich | — | **kein Match** | car/— | 4/— | **FAHRER FEHLT** |
| d03 | Finn Steinmetz | finn-steinmetz | eindeutig | van/Van | 6/**7** | Sitze weichen ab |
| d05 | Björn Korn | bj-rn-korn | eindeutig | van/Van | 6/**7** | Sitze weichen ab |
| d08 | Amar Piljevic | amar-piljevic | eindeutig | van/Van | 6/**7** | Sitze weichen ab |
| d12 | Patrick Ibrahimi | patrick-ibrahimi | eindeutig | van/Van | 7/7 | keine |
| d13 | Mustafa Ünver | mustafa-nver | eindeutig | van/Van | 7/7 | keine |
| d14 | Lukas Bieber | lukas-bieber | eindeutig | van/Van | 6/**7** | Sitze weichen ab |
| d04, d06, d07, d09-11, d15-22 | (14 Car-Fahrer) | jeweils eindeutig | — | car/Car | 4/4 | keine |
| d23 | Maximilian Schneider | — | **kein Match** | van/— | 6/— | **FAHRER FEHLT** |

Bestätigt exakt, was Jordan berichtet hat: 3 Fahrer fehlen (Leon Merg, Philipp Stich, Maximilian
Schneider), 4 Vans hätten laut Seed-Default 7 statt real 6 Sitze (Finn Steinmetz, Björn Korn, Amar
Piljevic, Lukas Bieber). Nur Patrick Ibrahimi und Mustafa Ünver stimmen zufällig (ihre echten 7 Sitze
treffen auf den Pauschal-Default).

Nebenbefund: `slug()` (Z. 460) entfernt Umlaute komplett statt sie zu transliterieren (Björn Korn →
`bj-rn-korn`, Mustafa Ünver → `mustafa-nver`, Bennet Füger → `bennet-f-ger`). Aktuell keine
ID-Kollision dadurch, aber unschön/fehleranfällig bei zukünftigen ähnlichen Namen.

## 3. Sitzplatzwerte, Codepfad `seats: type === "Van" ? 7 : 4`

Genau eine Fundstelle: **`seedDrivers()`, Z. 464.** Läuft ausschließlich beim allerersten App-Start
(Kommentar Z. 442: "Fahrer/Fahrzeuge werden beim ersten Start als Datensatz angelegt und danach aus
dem Store geladen"). Kein Formular-Default, der bei jedem Speichern erneut greift. Bestätigt über
alle `seats`-Fundstellen im Code (Z. 103, 108, 464, 1528, 1562, 1593, 2537, 3492):

- Z. 103/108: `supabaseStore`-Mapping liest/schreibt `driver.seats` 1:1 aus/in die DB-Spalte — der
  gespeicherte Wert bleibt erhalten, wird nicht neu berechnet.
- Z. 1528 (`evaluateInsertion`), Z. 1562, Z. 1593 (`reasonText`): nutzen ausschließlich das
  **gespeicherte** `driver.seats`, leiten es NICHT erneut aus `vehicleType` ab.

**Folge:** Der Vorschlagsmotor selbst rechnet korrekt mit dem gespeicherten Wert. Das
Überbuchungsrisiko entsteht einmalig, wenn der Seed-Default nie korrigiert wurde — dann stehen die
4 betroffenen Vans (s. Abschnitt 2) in der Live-DB mit 7 statt 6 Sitzen, und ein Fahrer würde für
eine 7-Personen-Gruppe als geeignet vorgeschlagen, obwohl real nur 6 passen. Kleinstmögliche sichere
Korrektur (noch NICHT ausgeführt): die vier betroffenen `driver.seats`-Werte in der DB direkt auf 6
setzen, reine Datenkorrektur, kein Code-Change.

**Zusatzbefund, nicht in der Anweisung erfragt, aber blockierend:** Es gibt **keine Funktion, um
einen neuen Fahrer anzulegen.** Weder in `SettingsTab` (Z. 7342 ff., bearbeitet nur Telefon/
Kennzeichen/PIN bestehender Fahrer via `s.drivers.forEach`, Z. 4465) noch sonst irgendwo im Code
existiert ein `.push()` auf `setup.drivers`. Die drei fehlenden Fahrer (Leon Merg, Philipp Stich,
Maximilian Schneider) können aktuell nur per direktem Datenbank-Insert angelegt werden (wie in
`BACKEND-README.md` beschrieben: `insert into drivers (...) values (...)`), nicht über die App-UI.

## 4. `passengerCount || 1`

Funktionale (nicht nur Anzeige-) Fundstellen:

| Zeile | Funktion | Zweck | Betrifft Fahrereignung? | Zuweisung möglich? |
|---|---|---|---|---|
| 1519 | `evaluateInsertion` | `need = ride.passengerCount \|\| 1`, direkt in `eligible = driver.seats >= need` | **JA** | **JA** |
| 3897 | `RideForm`-Init | Formular-Vorbelegung beim Öffnen | nein | nein (nur Anzeige im Formular) |
| 3952/3996 | `RideForm`-Save | `pax = Number(f.passengerCount) \|\| 1`, wird gespeichert | indirekt (erzeugt den Wert, der später in 1519 gelesen wird) | nein direkt |
| 7746 | Import-Parser | `Number(get(...)) \|\| 1` beim CSV/Excel-Import | indirekt (wie oben) | nein direkt |

**Test 3 im Harness (unten) bestätigt reproduzierbar:** eine Fahrt ohne Personenzahl wird von
`evaluateInsertion` mit `need=1` bewertet, ein 4-Sitzer-Car gilt dann als `eligible: true`, ohne dass
irgendwo ein Hinweis erscheint, dass die Zahl fehlte und angenommen wurde. Das bestätigt exakt das
Risiko, das die Spec in Regel 8 vermeiden wollte.

Unterscheidung null/""/0/"0"/Zahl: `||` behandelt `null`, `undefined`, `""`, `0` (Zahl) gleich (alle
lösen den Default aus). Der String `"0"` ist in JS truthy und würde NICHT den Default auslösen, bleibt
aber `"0"`; im nachfolgenden Zahlenvergleich (`driver.seats >= "0"`) wird er von JS zu `0` konvertiert
— im Ergebnis funktional gleich permissiv, nur über einen anderen Mechanismus. Keine Stelle im Code
unterscheidet diese Fälle bewusst oder warnt.

Ob in der Live-DB tatsächlich Fahrten mit fehlender Personenzahl vorkommen, kann ich am Code allein
nicht feststellen (keine DB-Einsicht). Empfehlung: das ist ein Punkt für die manuelle Kontrolle
(Kategorie 2 unten), bevor daraus eine Codeänderung abgeleitet wird.

## 5. Die drei Zuweisungswege

Alle vier tatsächlichen Schreibstellen (nicht drei, siehe unten) im Detail:

**a) AssignModal → `onAssign`, Z. 8447-8460.**
UI: Klick auf Fahrer im Zuteilungs-Dialog → `onAssign(driverId)` → `updateDyn(mutator)` →
Mutator findet die Fahrt, `logRide(...)`, `r.assignedDriverId = driverId`, ggf. `setRideStatus(...,
"planned", ...)`, `triggerPush(...)` nach erfolgreichem Schreiben. Kein Re-Check von
`eligible`/`overlap` beim Schreiben selbst.

**b) Timeline-Schnellzuteilung → `quickAssign`, Z. 6162-6175.**
UI: Fahrer in der Timeline-Zeile anklicken → direkt `updateDyn(mutator)`, gleiches Muster wie (a),
eigener, separat geschriebener Mutator-Code (keine gemeinsame Hilfsfunktion mit (a)).

**c) Timeline Drag&Drop → `applyDrop`, Z. 6198-6217.**
UI: Fahrt auf andere Fahrer-Zeile ziehen → `updateDyn(mutator)`, drittes eigenständiges,
inline geschriebenes Mutator-Muster, zusätzlich Zeitänderung möglich.

**d) Chat-Assistent → `applyChatAction`, Z. 3558-3576.**
Async, awaitet `updateDyn` wirklich (Kommentar Z. 3550-3557 bestätigt das bewusst). Einzige der vier
Stellen, die den `driverId` vorab validiert (Z. 3563: `setup.drivers.some(...)`, "Unbekannter
Fahrer"-Fehler sonst). Sonst gleiches Grundmuster.

**Antwort auf die A/B-Frage: weder rein A noch rein B, ein Hybrid.**
Alle vier Wege laufen durch **dieselbe, sichere Low-Level-Schreibfunktion** `updateDyn` (Z. 989),
die Konfliktschutz/Retry zentral regelt (siehe Abschnitt 6). Es gibt aber **keine gemeinsame
"Assign-Business-Logik"-Funktion** — jede der vier Stellen schreibt ihren eigenen, fast identischen
Mutator (Ride finden, loggen, `assignedDriverId` setzen, Status ggf. zurücksetzen, Push auslösen)
separat aus. Nur (d) validiert den `driverId` vorab, (a)-(c) nicht. Keine der vier prüft beim
Schreiben nochmal `eligible`/`overlap` gegen den frisch gelesenen Stand.

**Empfehlung für den kanonischen Pfad:** technisch ist `updateDyn` der kanonische, sichere
Schreibkern, an den sich ein neuer Knopf andocken sollte. Für die Business-Logik (Ride finden, loggen,
Status, Push) gibt es aktuell keinen kanonischen Weg, das ist echte Duplizierung an vier Stellen —
niedrig-mittleres Risiko (funktioniert an allen vier Stellen korrekt, aber jede künftige Änderung an
der Zuteilungslogik muss viermal gepflegt werden). Empfehlung für später (nicht jetzt): eine gemeinsame
`assignRideDriver(dyn, rideId, driverId, by)`-Hilfsfunktion extrahieren, die alle vier aufrufen.

## 6. Race-Condition-Prüfung

`updateDyn` (Z. 989-1023): liest vor jedem Versuch frisch (`sget`), nutzt einen `rev`-Zähler als
Compare-and-Swap (`sset(DYN_KEY, next, baseRev)`), bis zu 6 Retry-Versuche mit erneutem Frisch-Lesen,
überschreibt bei wiederholter Kollision NICHT blind (Kommentar Z. 1008-1012 bestätigt das bewusst).
Kein Hinweis auf DB-seitige Constraints/Transaktionen im Code selbst (das läuft vermutlich über
`sset` in `supabaseStore.js`, dort nicht mit geprüft, da außerhalb des Analyseauftrags-Fokus).

**Szenario 1: zwei Leitstellenbenutzer teilen fast gleichzeitig denselben Fahrer zwei
verschiedenen Fahrten zu.**
Erwartetes Verhalten: BEIDE Schreibvorgänge können nacheinander erfolgreich sein (der CAS schützt nur
den Gesamt-`dyn`-Zustand vor Verlust, nicht die fachliche Regel "ein Fahrer nicht doppelt"). Da keiner
der vier Mutatoren beim Schreiben nochmal `overlap` gegen den frischen Stand prüft, kann derselbe
Fahrer real doppelt gebucht werden. **Risiko: real, mittel** (unwahrscheinlich bei nur 2-3
gleichzeitigen Leitstellen-Nutzern, aber möglich, keine Sperre dagegen vorhanden). Sichtbar würde es
erst nachträglich, wenn `evaluateInsertion` für den Fahrer erneut aufgerufen wird (`overlap: true`)
oder manuell in der Timeline.

**Szenario 2: zwei Leitstellenbenutzer teilen derselben Fahrt fast gleichzeitig unterschiedliche
Fahrer zu.**
Erwartetes Verhalten: Erster Schreibvorgang gewinnt (rev N→N+1). Zweiter kollidiert (CAS schlägt fehl,
sein `baseRev` ist jetzt veraltet), `updateDyn` liest automatisch neu und wendet seinen Mutator
erneut an — der Mutator prüft aber nicht, ob sich `assignedDriverId` in der Zwischenzeit geändert hat,
er setzt einfach seinen eigenen Wert. Effekt: **letzter Schreibvorgang gewinnt still**, keine Warnung
an den zweiten Nutzer, dass gerade wer anders zugewiesen hat. Bemerkenswert: **`RideForm.onSave`
(Z. 8472-8480) hat genau diesen Schutz bereits eingebaut** (`window.confirm`-Rückfrage bei
`updatedAt`-Abweichung), nur nicht die Zuteilungswege selbst. Asymmetrie, kein Blocker, aber ein
konkreter, benennbarer Verbesserungspunkt für später.

## 7. Fahrzeit-Matrix

`travel(matrix, a, b)` (Z. 664-668): symmetrischer Lookup (probiert `a|b` dann `b|a`), `a===b` → 0,
fehlende Verbindung → `null` (NICHT 0, NICHT geraten). `seedMatrix()` (Z. ~495 ff.) enthält genau 6
Verbindungen, alle Paare der 4 bekannten Orte (airport, moevenpick, sheraton, festival), vollständig
verbunden. **Karl August, Leonardo, HBF, München kommen in der Matrix nicht vor**, jede Route dorthin
liefert `null`/unbekannt.

**Auflösung des in der Anweisung genannten Widerspruchs:** beide Aussagen aus dem ersten Bericht waren
richtig, nur unvollständig nebeneinander gestellt. Die Matrix existiert UND ist sicher gebaut (kein
Rateergebnis bei Lücken, sauber als "unbekannt" behandelt, `evaluateInsertion` reagiert korrekt
konservativ darauf: `unknownTiming`, aus `feasible` ausgeschlossen, "Fahrzeit unbekannt" sichtbar).
Aber sie deckt eben nur 4 von den 7 Zonen aus unserer Spec ab. Für Airport/Mövenpick/Sheraton/Festival
ist jede darauf aufbauende Warnung zuverlässig. Für Karl August/Leonardo/HBF/MUC liefert sie ehrlich
"unbekannt", nicht falsch — das ist wo `zoneOf()` (rein für die Positionslogik, nicht als
Zeit-Ersatz) tatsächlich noch Mehrwert hätte, aber es ist kein Sicherheitsproblem, nur ein
Funktionslücke.

Rückfahrten nutzen wegen des symmetrischen Lookups automatisch dieselbe Zeit wie die Hinfahrt.

## 8. Testharness (siehe `/tmp/test_suggest_engine.mjs`, nicht im Repo, nur lokal)

15 angeforderte Testfälle, alle mit den echten, verbatim aus dem Code kopierten Funktionen (nicht
nachgebaut). **16 von 16 Prüfungen bestanden** (Fall 12 in a/b aufgeteilt), 0 fehlgeschlagen, keine
unerwarteten Verhaltensweisen außer dem bereits bekannten und jetzt bestätigten `passengerCount`-Fall
(Test 3). Alle Fälle konnten dynamisch geprüft werden, keiner nur statisch, da alle relevanten
Funktionen reine Funktionen ohne React/JSX-Abhängigkeit sind und sich sauber isolieren ließen.

## 9. Aktualisierte Priorisierung

**Sofort vor dem Festival korrigieren** (klein, hoher Sicherheitsgewinn, geringes Risiko):
1. `passengerCount`-Fix in `evaluateInsertion` (Z. 1519): bei fehlender Zahl sichtbaren
   Ausschlussgrund statt stillem `need=1`. Eine Codestelle, klar abgegrenzt.
2. `drivers_openbeatz.json` ins Repo legen (reine Daten, kein Code).

**Vor dem Festival nur manuell kontrollieren** (keine Codeänderung, Daten/Abläufe prüfen):
3. Echte Sitzzahlen der vier betroffenen Vans in der Live-DB prüfen, ggf. direkt auf 6 korrigieren.
4. Ob die drei fehlenden Fahrer wirklich in der Live-DB fehlen (nur Supabase-Zugriff kann das
   bestätigen, nicht der Code).
5. Ob in der Live-DB real Fahrten mit fehlender Personenzahl existieren.

**Nach dem Festival umsetzen:**
6. Springer-Rolle/`available_from`/Timmy-Team als neue additive Felder — mit einem anderen
   Feldnamen als `role` wegen der Kollision mit `session.role` (Z. 8600 warnt darüber explizit im
   Code), z. B. `driverTier`.
7. `zoneOf()` additiv neben `matchLoc` für Karl August/Leonardo/HBF/MUC.
8. Timetable-Rubrik, Warnungen, "Set beendet"-Badge, Wartefahrten (Spec-Phasen 3-5).
9. Eine echte "Fahrer hinzufügen"-Funktion in der App bauen (existiert aktuell nicht).
10. Die vier Assign-Mutatoren zu einer gemeinsamen Funktion zusammenführen; Pre-Write-Konfliktcheck
    ergänzen (analog zu `RideForm.onSave`).

**Nicht umsetzen:**
11. Neubau des Vorschlagsmotors (existiert, funktioniert, 16/16 Tests grün).
12. Eigenes Fahrzeit-Modell parallel zur bestehenden, funktionierenden Matrix.
13. ISO-Zeitstempel/`Europe/Berlin` über die bestehende, funktionierende Zeitlogik stülpen.
14. Automatisches Zusammenführen von Ride-Datensätzen (Sammelfahrten) — bleibt wie in der Spec
    bereits entschieden auf Analyse/Vorschlag beschränkt.

## 10. Abschlussbericht

**Go-/No-Go:** unverändert **NO-GO für eine größere Erweiterung vor dem Festival.** **GO** für die
zwei kleinen Punkte in Kategorie "sofort" (Zeile 1 und 2 oben), beide risikoarm und klar begrenzt.
Kategorie 2 braucht Jordans/Supabase-Zugriff, kein Code. Kategorie 3 wartet bis nach dem Festival.

**Blockierende Probleme:** kein Zugriff auf die Live-Datenbank, daher sind Abschnitt 2 (Fahrer-
Mapping) und Teile von Abschnitt 3/4 nur Näherungen über die Seed-Daten, keine bestätigten
Live-Fakten. Fehlende "Fahrer hinzufügen"-Funktion blockiert das Anlegen der drei fehlenden Fahrer
über die App-UI (Workaround: direkter DB-Insert, wie in `BACKEND-README.md` beschrieben).

**Nicht blockierende Probleme:** `role`-Namenskollision (lösbar mit anderem Feldnamen), vier
duplizierte statt einer zentralen Assign-Funktion (funktioniert korrekt, nur Wartungsrisiko), fehlender
Pre-Write-Konfliktcheck bei Zuteilung (Szenario 2, real aber unwahrscheinlich bei wenigen
Nutzern), `zoneOf` fehlt für 4 von 7 Zonen (ehrlich als "unbekannt" behandelt, nicht gefährlich).

**Max. 3 Sofortmaßnahmen:**
1. `drivers_openbeatz.json` ins Repo legen.
2. Live-Sitzzahlen der vier Vans prüfen/korrigieren (Datenkorrektur).
3. `passengerCount`-Fix in `evaluateInsertion` Z. 1519 (kleinste sichere Codeänderung mit echtem
   Sicherheitsgewinn).

**Kleinste sinnvolle Implementierungsphase danach:** `zoneOf()` additiv neben `matchLoc`, gefolgt von
der Timetable-Rubrik. Beide reine Anzeige/Positionslogik, kein neues Datenmodell, geringstes Risiko
der verbliebenen Kategorie-3-Punkte.

Halt hier. Keine produktive Änderung vorgenommen.
