# Teilpaket E – Abnahme-Checkliste (manuell, in der App)

Alle Punkte in der **Leitstelle → Reiter „Rückfahrten“**. Rein lesend; keiner der
Punkte verändert Daten. Voraussetzung: ein Betriebstag mit mindestens einer
Hinfahrt zum Festival (mit zugeteiltem Fahrer) und einer unbesetzten Rückfahrt.

## A. Sichtbarkeit und Rollen

1. [ ] Der Wartefahrt-Block erscheint nur bei **unbesetzten** Rückfahrten.
2. [ ] Bei einer Rückfahrt **mit** Fahrer erscheint **kein** handlungsleitender
       Wartevorschlag (höchstens „bereits geplant“, nicht als Alarm).
3. [ ] In der Fahrer-App, Stage-App und Gast-App taucht **nichts** davon auf.
4. [ ] Der Filter „nur mit Wartevorschlag N“ erscheint nur, wenn es mindestens
       einen handlungsleitenden Vorschlag gibt; N stimmt mit der Anzahl überein.
5. [ ] „Filter zurücksetzen“ setzt auch den Wartevorschlag-Filter zurück.

## B. Inhalt des Vorschlags

6. [ ] Angezeigt werden: Bewertung (z. B. „Warten möglicherweise sinnvoll“),
       Fahrername, geplante Ankunft am Festival, Wartezeit in Minuten.
7. [ ] Die Hinfahrt-Herkunft steht dabei („Hinfahrt: … → Festival“).
8. [ ] Bei Leonardo/HBF als Hinfahrt-Start ist die operative Rechnung plausibel
       (Pickup wie Sheraton), die Ankunftszeit wirkt korrekt.
9. [ ] „Keine Fahrtkonflikte“ erscheint mit grünem Haken, wenn kein Konflikt;
       sonst „Fahrtkonflikt prüfen“ in Amber.
10. [ ] Bei mehreren möglichen Fahrern erscheint „N weitere Fahrer möglich“.
11. [ ] Ist ein Fahrer für mehrere Rückfahrten der beste, erscheint der Hinweis
        „nur eine möglich“.

## C. Zeitliche Plausibilität

12. [ ] Sehr kurze Wartezeit (unter ~15 min) wird als „Direkter Anschluss“ oder
        gar nicht als Wartefahrt angezeigt (unter ~10 min kein Vorschlag).
13. [ ] Mittlere Wartezeit (ca. 15–60 min) → „Warten (möglicherweise) sinnvoll“.
14. [ ] Lange Wartezeit (über 2 Std.) → kein Wartevorschlag / „Zurückfahren“.
15. [ ] Rückfahrt kurz nach Mitternacht (Hinfahrt spätabends): Wartezeit und
        Ankunft werden über den Tageswechsel korrekt gerechnet.

## D. Einsparung / Vergleichsroute

16. [ ] Ohne konfigurierten Hub erscheint **keine** Kilometer-/Minuten-Einsparung,
        sondern der Hinweis „keine sichere Vergleichsroute“. Kein „Warten sinnvoll“
        (stark) ohne Grundlage.
17. [ ] (Optional, falls `driverHubLocationId` gesetzt wird) Dann erscheint eine
        Minuten-Einsparung und bei kurzer Wartezeit die starke Empfehlung.

## E. Farben / Ruhe (Nachtschicht)

18. [ ] „Warten möglicherweise sinnvoll“ ist informativ/Amber, **kein** Alarmrot.
19. [ ] Der Block fügt sich ruhig in die dunkle Ansicht ein, keine grelle Farbe.

## F. Aktionen bleiben Bestand

20. [ ] Der Block selbst hat **keine** eigenen Speichern-/Zuweisen-Knöpfe.
21. [ ] „Fahrer zuweisen“ öffnet wie gewohnt den Zuteilungsdialog.
22. [ ] „Fahrt öffnen“ öffnet wie gewohnt die Fahrt.
23. [ ] Nach dem Zuweisen verschwindet der Wartevorschlag (Rückfahrt jetzt besetzt).

## G. Keine Nebenwirkungen

24. [ ] Zähler und Gruppen der Rückfahrten-Ansicht (Teilpaket D) sind unverändert.
25. [ ] Suche und Gruppenfilter funktionieren wie vorher.
26. [ ] Kein neuer Eintrag im Audit-Log durch das bloße Anzeigen der Vorschläge.
27. [ ] Kein Flackern/Neuladen; Aktualisierung höchstens einmal pro Minute (Tick).
28. [ ] In der Übersicht/Timeline und allen anderen Reitern hat sich nichts geändert.

Freigabe: ____________________  Datum: __________
