# Abschlussbericht: Teilpaket B – Ortszonen, operative Pick-up-Points, Fahrzeitauflösung (OpenBeatz Shuttle-Leitstelle)

Hinweis: Dies ist die im Chat ausgegebene, fuer externe Weitergabe (z.B. ChatGPT) formulierte
Fassung des Abschlussberichts. Der interne, code-nahe Bericht mit exakten Zeilennummern und
Funktionsnamen steht in UEBERGABE-Session-18.md (Abschnitt "Session vom 19.07.2026 ...
Teilpaket B") und TEILPAKET-B-ANALYSE.md.

## Projektkontext

Die "OpenBeatz Shuttle-Leitstelle" ist eine selbstgebaute Dispositions-App für den Fahrer-Shuttle-Betrieb beim Open Beatz Festival (23.–27. Juli 2026, Herzogenaurach bei Nürnberg). Sie koordiniert ca. 20–22 Fahrer, die Künstler/Manager zwischen Flughafen, Hotels und Festivalgelände fahren. Technisch: eine große React-Single-File-App (`src/ShuttleLeitstelle.jsx`, aktuell 9522 Zeilen), Supabase-Backend, Vercel-Deployment, GitHub-Repo. Entwickelt wird sie in einzelnen, klar abgegrenzten "Teilpaketen" pro Chat-Session, mit strikter Vorgabe: additiv bauen, bestehenden Code nicht umbauen, jede Änderung verifizieren, Rücksetzpunkte setzen.

Kurz vorher wurde "Teilpaket A" umgesetzt (Springer-Fahrer-Logik, Verfügbarkeit-ab-Zeitpunkt, Team-Kennzeichnung). Dieser Bericht behandelt das direkt anschließende "Teilpaket B".

## Auftrag (Teilpaket B)

Ziel war, die bestehende Orts-, Zonen- und Fahrzeitlogik **additiv** um zusätzliche Orte zu erweitern, ohne den bestehenden Vorschlagsmotor (die Funktion, die dem Disponenten den passendsten Fahrer für eine Fahrt vorschlägt) zu ersetzen. Explizit ausgeschlossen aus diesem Paket: Timetable-Tab, Artist-Matching, Sammelfahrten, Wartefahrten, neue Ride-Statuswerte, Änderungen an den Zuweisungs-Schreibwegen, Umbau der Datenschicht.

Kernanforderungen der Spezifikation:
1. Neue Orte erkennen (Karl August, Leonardo, Flughafen München, GAT Nürnberg, Hauptbahnhof Nürnberg), zusätzlich zu den vier bestehenden (Flughafen Nürnberg, Sheraton, Mövenpick, Festival).
2. Eine klare Trennung zwischen "angefragtem Ort" (was der Fahrgast/die Buchung sagt), "normalisiertem Ort" (welcher konkrete Ort erkannt wurde), "Zone" (grobe Disposition) und "operativem Ort" (wohin der Fahrer tatsächlich fahren muss).
3. Eine besondere betriebliche Regel: Bei Abholung am Hotel Leonardo oder am Hauptbahnhof Nürnberg **in Richtung Festival** soll der Fahrer tatsächlich zum Sheraton-Hotel fahren (dort ist der reale Treffpunkt), obwohl der Fahrgast "Leonardo" bzw. "HBF" gebucht hat. Bei Rückfahrten vom Festival zu diesen Orten gilt das NICHT – da bringt der Fahrer die Person tatsächlich zum echten Ziel.
4. Keine erfundenen Fahrzeiten: fehlt eine Strecke in der Fahrzeit-Tabelle, muss die App "unbekannt" anzeigen, niemals eine geschätzte oder 0-Minuten-Zeit.
5. Deterministische, nicht "unscharfe" Ortserkennung mit einer definierten Alias-Liste (Schreibvarianten wie "NUE-GAT", "Nürnberg HBF", "Movenpick" ohne Umlaut usw.), spezifische Aliase müssen Vorrang vor allgemeinen haben.
6. Vollständige Rückwärtskompatibilität: bestehende Fahrten über die vier alten Orte dürfen sich im Verhalten nicht um ein Jota ändern.

## Vorgehen: Analyse vor Implementierung

Bevor Code geändert wurde, wurde der bestehende Ortscode vollständig analysiert und dokumentiert:

- `matchLoc()` (Import-Funktion): erkennt heute nur 4 feste Orte per Regex, alles andere landet als Freitext (`__custom`). Läuft nur beim Excel-Import, nicht zur Laufzeit des Vorschlagsmotors.
- `travel()`/`travelMin()`: schlägt in einer Matrix-Tabelle (`Ort-A|Ort-B → Minuten`) nach, behandelt die Verbindung symmetrisch (Hin- und Rückweg teilen sich einen Wert), gibt bei fehlender Verbindung `null` zurück (nie 0). Diese Eigenschaft deckte die "keine erfundene Zeit"-Anforderung strukturell bereits ab.
- Der eigentliche Vorschlagsmotor (`evaluateInsertion`) berechnet für jeden Fahrer: Anfahrtszeit zur Abholung (`prevLoc → pickup`), Übergangszeit zur nächsten Fahrt (`drop → next.fromId`), und reicht die Anfahrtszeit bereits an die Verfügbarkeitsprüfung durch. Das bedeutete: wenn die neue Ortslogik korrekt in genau diese Übergabepunkte eingehängt wird, funktioniert die Konsistenz zwischen "Verfügbarkeit" und "Zuteilungs-Score" automatisch mit, ohne zusätzlichen Aufwand.

## Datenentscheidungen (mit dem Auftraggeber abgestimmt)

Weil eine Live-Routenberechnung über einen Kartendienst (OSRM) im Sandbox-Netzwerk nicht erreichbar war (503/TLS-Fehler), wurden die Fahrzeiten anders abgesichert:

- **Nachbar-Wiederverwendung statt neuer Messwerte:** Die neuen Orte liegen real direkt neben bekannten Orten. Leonardo, Hauptbahnhof und Karl August liegen alle in der Innenstadt direkt beim Sheraton, GAT Nürnberg liegt direkt am Flughafen Nürnberg. Für die Fahrzeitberechnung wird daher jeweils der bekannte Nachbar-Wert verwendet, ohne dass eine neue Messung nötig ist. Der Fahrer sieht dabei immer den echten, angefragten Ort – nur die interne Zeitberechnung nutzt den Nachbarwert.
- **Festival-Koordinate korrigiert:** Die bisherige Koordinate im Code war ein grober Platzhalter. Sie wurde auf die vom Auftraggeber vorgegebene, genaue Koordinate (49,52728° N, 10,83139° O) korrigiert, inklusive der Anmerkung, dass die VIP-Shuttle-Anfahrt bewusst über den Ort Puschendorf erfolgt (nicht über die für normale Besucher ausgeschilderte Zufahrt über Höfen).
- **Bestehende Innenstadt-Fahrzeit angehoben:** Weil die korrigierte Festival-Koordinate weiter von der Stadt entfernt liegt als der alte Platzhalter, wurde die Fahrzeit Sheraton↔Festival von 33 auf 38 Minuten angehoben (vom Auftraggeber bestätigt).
- **Flughafen München:** Für diese neue, weit entfernte Strecke wurden mehrere unabhängige Quellen recherchiert (Web-Suche zu Transferzeiten München Flughafen–Herzogenaurach): Angaben schwankten zwischen ca. 1 Std. 32 Min. und 1 Std. 53 Min. Mit dem Auftraggeber wurde ein Zwischenwert von 105 Minuten festgelegt, gültig sowohl für München→Festival als auch München→Sheraton (die als praktisch gleich lang eingeschätzt wurden).

Eine anfänglich versuchte automatische Schätzung über Luftlinie-Entfernung und einen an bestehenden Werten geeichten Umwegfaktor erwies sich für die kurze Strecke brauchbar, aber für die lange Autobahnstrecke München fatal falsch (sie hätte 325 Minuten statt der realistischen ~110 Minuten ergeben, weil Stadtverkehrs-Geschwindigkeit fälschlich auf Autobahnfahrt angewendet wurde). Diese Methode wurde daher verworfen zugunsten recherchierter Realwerte.

## Implementierung

Rein additiv, keine bestehende Funktion ersetzt:

**Neue Konfiguration:** Alias-Listen pro Ort (inkl. Groß-/Kleinschreibungs-, Umlaut- und Schreibvarianten-Normalisierung), eine Zonen-Zuordnung, eine Tabelle die jeden neuen Ort auf seinen "Rechen-Nachbarn" abbildet, und die zwei betrieblichen Pick-up-Regeln (Leonardo/HBF → Festival = Sheraton-Pickup).

**Neue reine Funktionen** (ohne Nebenwirkungen, ändern nie die Fahrtdaten selbst):
- `resolveLocation()` – erkennt aus einem Freitext den kanonischen Ort, gibt strukturiert zurück ob "matched", "unknown" oder "ambiguous" (mehrdeutig), mit dem ursprünglichen Text immer erhalten.
- `resolveOperationalRideLocations()` – die einzige Stelle, die entscheidet, wohin der Fahrer operativ fahren muss, inklusive angewandter Sonderregeln.
- `resolveTravelMinutes()` – sichere Fahrzeitabfrage, gibt bei fehlender Verbindung explizit "unbekannt" zurück.
- `rideEndpointMatrixNode()` – übersetzt einen Fahrt-Endpunkt in den für die Fahrzeitberechnung zu nutzenden Matrix-Knoten. Für die vier alten, bereits bekannten Orte liefert diese Funktion exakt denselben Wert wie vorher (Identitätsabbildung) – das ist der entscheidende Kompatibilitäts-Mechanismus.

**Eingriff in den Kernpfad:** In der zentralen Vorschlagsfunktion wurden genau drei Stellen minimal angepasst (Abholort, Zielort, Fahrerposition-aus-Vorfahrt), sodass sie über die neue Übersetzungsschicht laufen, statt direkt die rohen Ortsfelder zu verwenden. Alles andere in dieser zentralen Funktion blieb unangetastet.

**UI:** Im Zuteilungs-Dialog wurde eine zusätzliche, rein informative Zeile ergänzt, die bei abweichendem operativem Abholort ("Abholung: Sheraton") anzeigt, während der ursprünglich gebuchte Ort weiterhin sichtbar bleibt. Bei nicht erkannten Orten erscheint eine Warnung statt einer stillschweigend geschätzten Zeit.

## Verifikation

Es wurde eine mehrstufige Prüfung durchgeführt, jede Stufe gegen den echten, ausgelieferten Code (nicht gegen eine Kopie oder einen Nachbau):

1. **Kompilierbarkeit:** Der Code wurde nach jeder Änderung mit esbuild kompiliert, zusätzlich wurde auf doppelt definierte Funktionsnamen geprüft.
2. **Funktionstest gegen die Spezifikation:** Es wurden 69 automatisierte Prüfungen geschrieben, die alle in der Spezifikation geforderten Testfälle abdecken (bestehende Orte, neue Orte, Normalisierung, Mehrdeutigkeit, die Leonardo-/HBF-Sonderregel in beide Richtungen, Matrix-Verhalten bei fehlenden Verbindungen, Regressionsfestigkeit). Dafür wurden die zu testenden Funktionen automatisiert direkt aus der echten Quelldatei extrahiert (kein manuell nachgebauter Test-Code), um sicherzustellen, dass wirklich der ausgelieferte Code geprüft wird. Ergebnis: 69 von 69 bestanden, inklusive einer bewussten "Gegenprobe" (ein absichtlich falscher Erwartungswert musste als Fehler erkannt werden – Beleg, dass der Test wirklich etwas misst und nicht immer grün anzeigt).
3. **Regressionsvergleich alt vs. neu:** Die komplette Vorschlagskette wurde sowohl aus dem Codestand VOR Teilpaket B als auch aus dem neuen Stand extrahiert und mit identischen Testfahrten (über die vier alten Orte) durchlaufen. Ergebnis: **byte-identische Ausgabe** in allen geprüften Kennzahlen (Sortierreihenfolge, Score, Anfahrtszeiten, Warnungen). Es gab null Abweichungen. Auch hier wurde die Prüfmethode selbst per Gegenprobe abgesichert.
4. **Render-Test:** Fünf zuvor festgelegte Referenz-Kennzahlen (exakte Zeichenlänge bestimmter gerenderter React-Komponenten) wurden vor und nach der Änderung verglichen und blieben exakt gleich – Beleg, dass die betroffenen UI-Komponenten sich nicht unbeabsichtigt verändert haben.
5. **Weitere Strukturprüfungen:** ein Skript, das alle verwendeten CSS-Variablen gegen ihre Definitionen abgleicht (keine undefinierten Variablen), und ein Kontrast-Check nach WCAG-Kriterien (0 Fehler).

## Bekannte Restpunkte (bewusst nicht in diesem Paket behoben)

- In einem Randfall (ein Fahrer ohne Folgefahrt, der zuletzt an einem neu unterstützten, aber als Freitext erfassten Ort stand) geht die genaue Fahrerposition für die allererste Zuteilungsprüfung verloren, weil eine andere, bestehende Funktion (`computeDriverStats`) an dieser einen Stelle nur die interne Orts-ID statt des Freitexts speichert. Für den weitaus häufigeren Fall (Fahrer hat eine Vorfahrt in der Kette) ist es korrekt gelöst. Als offener Punkt für eine spätere Session vermerkt, nicht Teil des aktuellen Auftrags.
- Die alte Import-Funktion (`matchLoc`) trennt eine sehr alte, spezielle Textformulierung ("private jet gat") weiterhin nicht von "normalem Flughafen" – das ist Bestandsverhalten und wurde absichtlich nicht angefasst, weil der Auftrag ausdrücklich verlangte, diese Funktion nicht zu verändern. Der neue Vorschlagsmotor selbst trennt GAT korrekt.
- Die neuen Fahrzeit-Werte stehen aktuell nur im Code-Seed (Entwicklungs-/Demo-Daten). Für den echten Produktivbetrieb, der seine Daten aus einer Datenbank lädt, müssen drei konkrete Zahlenwerte einmalig manuell in der Datenbank-Konfiguration nachgetragen werden, sonst wirken sie dort nicht.

## Ergebnis

**Empfehlung: GO.** Die Erweiterung ist vollständig additiv, alle Spezifikations-Anforderungen sind mit automatisierten Tests belegt, und die Rückwärtskompatibilität zum bestehenden Verhalten wurde nicht nur behauptet, sondern durch einen direkten Vergleich der Programmlogik vor und nach der Änderung bewiesen (keine einzige Abweichung bei bestehenden Fahrten). Vor dem produktiven Festivaleinsatz ist lediglich noch das manuelle Nachtragen von drei Zahlenwerten in der Live-Datenbank nötig, plus eine kurze manuelle Stichprobenprüfung anhand einer beigelegten Checkliste ohne Programmierkenntnisse.
