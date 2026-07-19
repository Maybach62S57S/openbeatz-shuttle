# Teilpaket B - Manuelle Abnahme (ohne Programmierkenntnisse)

So testest du in der App (Leitstelle, Fahrer zuteilen). Jede Zeile: was eingeben,
was du sehen sollst.

## Vorbereitung
- Neue Testfahrt anlegen oder eine bestehende oeffnen, dann "Fahrer zuteilen" oeffnen.
- Bei den Orten den Freitext genau so eingeben wie unten.

## Faelle

1. Leonardo -> Festival
   Eingabe: Von "Leonardo Hotel", Nach "Festival"
   Erwartung: Oben steht als Fahrgast-Ort "Leonardo", darunter "Abholung: Sheraton".
   Der urspruengliche Ort Leonardo bleibt sichtbar. Fahrzeiten werden angezeigt (nicht
   "unbekannt").

2. Nuernberg HBF -> Festival
   Eingabe: Von "Nürnberg HBF", Nach "Festival"
   Erwartung: Fahrgast-Ort "HBF", darunter "Abholung: Sheraton". HBF bleibt sichtbar.

3. Festival -> Leonardo (Rueckfahrt)
   Eingabe: Von "Festival", Nach "Leonardo Hotel"
   Erwartung: Ziel Leonardo. KEIN Sheraton-Hinweis. Fahrzeit vorhanden.

4. Festival -> HBF (Rueckfahrt)
   Eingabe: Von "Festival", Nach "Nürnberg Hauptbahnhof"
   Erwartung: Ziel HBF. KEIN Sheraton-Hinweis.

5. Karl August -> Festival
   Eingabe: Von "Hotel Karl August", Nach "Festival"
   Erwartung: Abholung Karl August (kein Sheraton-Hinweis, Karl August wird NICHT umgeleitet).
   Fahrzeit vorhanden (rechnet wie Innenstadt).

6. Moevenpick -> Festival
   Eingabe: Von "Mövenpick", Nach "Festival"
   Erwartung: unveraendert wie bisher, kein Abhol-Hinweis.

7. NUE-GAT -> Festival
   Eingabe: Von "NUE-GAT", Nach "Festival"
   Erwartung: Abholung GAT (kein Sheraton-Hinweis). Fahrzeit vorhanden (rechnet wie Flughafen).

8. Unbekannter Ort
   Eingabe: Von "Irgendein Parkplatz XY", Nach "Festival"
   Erwartung: rote Warnung "Abholort nicht erkannt - Fahrzeit unbekannt". Keine geratene Zeit.

9. Flughafen Muenchen -> Festival
   Eingabe: Von "Flughafen München", Nach "Festival"
   Erwartung: Fahrzeit ca. 105 min wird verwendet (Fahrer erscheinen mit "ca. 105 min zum
   Pickup"). NUR wenn die Live-Matrix den muc-Wert hat (siehe unten).

10. Bestehende Sheraton-Fahrt
    Eingabe: Von "Sheraton", Nach "Festival"
    Erwartung: Verhalten wie immer, kein Abhol-Hinweis. (Fahrzeit jetzt 38 statt 33 min,
    wenn der Live-Matrix-Wert angepasst wurde.)

## WICHTIG vor dem Live-Einsatz (einmalig in Einstellungen -> Fahrzeiten)
Diese drei Werte in der Live-Matrix eintragen, sonst greifen sie nur in der Demo:
- Sheraton <-> Festival: 38 min
- Muenchen (muc) <-> Festival: 105 min
- Muenchen (muc) <-> Sheraton: 105 min
Fuer Leonardo/HBF/Karl August/GAT ist NICHTS extra einzutragen - die rechnen automatisch
ueber Sheraton bzw. Flughafen.

## Was NICHT passieren darf
- Nach einer Rueckfahrt Festival -> Leonardo/HBF darf die App NICHT denken, der Fahrer sei
  am Sheraton. Er ist am echten Ziel (Leonardo bzw. HBF).
- Der urspruengliche Ortsname darf nie verschwinden.
- Ein unbekannter Ort darf nie eine erfundene Fahrzeit bekommen.
