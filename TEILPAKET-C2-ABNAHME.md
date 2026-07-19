# Teilpaket C2 - Abnahme-Checkliste (ohne Programmierkenntnisse)

Was C2 macht: Wenn du eine Fahrt oeffnest (Fahrt bearbeiten) oder den
Zuteilungsdialog aufmachst, zeigt die Leitstelle jetzt einen kleinen Kasten
"Timetable-Zuordnung". Er sagt dir, welchem Set aus dem Timetable die Fahrt
vermutlich gehoert - rein zur Information. Es wird NICHTS gespeichert oder
geaendert, keine Zeit, kein Status, kein Fahrer.

## So pruefst du es (in der Leitstellenansicht)

1. Fahrt mit bekanntem Artist oeffnen
   - Eine Fahrt bearbeiten, deren Artist genau so im Timetable steht.
   - Erwartung: Kasten zeigt den Artist, Stage und Uhrzeit des Sets, dazu
     "Match: Exakter Artist-Name".

2. Gross-/Kleinschreibung und Umlaute
   - Im Feld "DJ / Artist" den Namen mal in GROSSBUCHSTABEN oder mit "oe"
     statt "ö" schreiben (z. B. "Gestoert aber Geil").
   - Erwartung: Es wird trotzdem dasselbe Set gefunden.

3. B2B-Set
   - Fahrt mit einem Artist, der im Timetable Teil eines "X b2b Y"-Sets ist.
   - Erwartung: Der Kasten zeigt den vollstaendigen Set-Namen (X b2b Y) und den
     Hinweis, dass die Fahrt diesem gemeinsamen Set zugeordnet ist.

4. Name mit "&" (KEIN B2B)
   - Fahrt fuer einen Kuenstler, dessen Name selbst ein "&" enthaelt
     (z. B. "Harris & Ford").
   - Erwartung: Wird als EIN Kuenstler behandelt (nicht in zwei geteilt),
     "Match: Exakter Artist-Name".

5. Richtiger Festival-Tag
   - Ein Artist, der an mehreren Tagen spielt: an Tag A und an Tag B je eine
     Fahrt oeffnen.
   - Erwartung: Es wird jeweils das Set des RICHTIGEN Tages angezeigt.
   - Fahrten nach Mitternacht (00:00-05:59) gehoeren zur Nacht des Vortags -
     das beruecksichtigt C2 automatisch (gleiche Logik wie der Timetable-Tab).

6. Hinfahrt zum Festival
   - Fahrt vom Hotel/Flughafen zum Festival, Artist hat mehrere Sets am Tag.
   - Erwartung: Es wird das zeitlich passende Set gewaehlt (das erste Set nach
     der geplanten Ankunft, sonst das naechstgelegene).

7. Rueckfahrt vom Festival
   - Fahrt vom Festival zum Hotel.
   - Erwartung: Es wird das Set gewaehlt, dessen Ende am besten zur Rueckfahrt
     passt (das letzte Set vor der Rueckfahrt, sonst das naechstgelegene).

8. Mehrdeutig
   - Wenn mehrere Sets gleich plausibel sind (z. B. eine Sonderfahrt, die weder
     klar hin noch zurueck ist).
   - Erwartung: Der Kasten sagt "Timetable-Zuordnung pruefen - mehrere
     plausible Sets" und listet die Kandidaten auf. Es wird NICHTS automatisch
     ausgewaehlt.

9. Kein Artist / kein Treffer
   - Fahrt ohne Artist-Eintrag, oder mit einem Namen, der nicht im Timetable
     steht.
   - Erwartung: Freundlicher Hinweis ("Kein Artist hinterlegt" bzw. "Kein
     passendes Timetable-Set gefunden"). Kein Fehler, kein Absturz.

10. Details
    - Im Kasten unten auf "Details" klicken.
    - Erwartung: Nachvollziehbare Diagnose (verwendeter Name, Match-Stufe,
      Festival-Tag, Fahrtrichtung, Anzahl Kandidaten, ggf. ausgeschlossene
      Sets). Keine kryptischen Fehlermeldungen.

## Was C2 bewusst NICHT tut (kommt spaeter)

- Keine roten/gelben Zeitwarnungen ("zu spaet losgefahren" o. ae.) - das ist
  Thema eines spaeteren Teilpakets.
- Keine automatische Aenderung von Zeit, Status oder Fahrer.
- Kein Erraten aehnlicher Namen (kein Fuzzy/Tippfehler-Matching). Nur exakte
  Namen (nach Angleichung von Schreibweise), hinterlegte Aliase und
  B2B-Mitglieder werden gematcht.

## Hinweis zu Aliasen

Es gibt eine zentrale, aktuell LEERE Alias-Liste. Grund: In den vorhandenen
Fahrt- und Timetable-Daten liess sich kein einziger belegbarer Alias finden
(die grossen Headliner der Beispielfahrten stehen nicht im Timetable). Deshalb
wurden - wie vereinbart - keine Aliase erfunden. Sobald ein echter Fall bekannt
ist (z. B. "Kuenstler tritt unter zwei Schreibweisen auf"), kann er zentral
nachgetragen werden.
