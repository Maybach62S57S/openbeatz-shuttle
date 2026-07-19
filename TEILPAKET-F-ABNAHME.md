# Teilpaket F1 - Abnahme

Stand 19.07.2026. F1 ist der **Logik-Kern ohne UI**. Die klassische manuelle
Abnahme (Fahrten anlegen, Vorschlag sehen) braucht die Anzeige aus F2. Fuer F1 ist
der Nachweis automatisiert: `node smoke-teilpaket-f.mjs src/ShuttleLeitstelle.jsx`
(120/120) und `node gegenprobe-teilpaket-f.mjs` (8/8). Diese Datei ordnet die
fachliche Erwartung dem jeweiligen Nachweis zu.

## Teil A - Was F1 jetzt schon beweist (automatisiert)

| Fachliche Erwartung | Nachweis |
| --- | --- |
| Zwei Rueckfahrten gleicher Richtung werden erkannt | Smoke T1 |
| Zwei Hinfahrten gleicher Richtung werden erkannt | Smoke T2 |
| Hin + Rueck NICHT kombinierbar | Smoke T3 |
| Storniert/erledigt/laufend ausgeschlossen | Smoke T5, T6, T7a/b |
| 21 min Abstand -> keine positive Empfehlung, 20 min zulaessig | Smoke T12/T13 |
| Mitternacht 23:55 + 00:05 = 10 min, gleicher Betriebstag | Smoke T14 |
| Unterschiedlicher Betriebstag -> not_recommended | Smoke T15 |
| Kapazitaet 2+2/2+3/4+3 passt, 4+4 in 7 Sitze nicht | Smoke T17-T20 |
| Exakt passende Sitzzahl (7 in 7) zulaessig | Smoke T19 |
| Fehlende/ungueltige Personenzahl -> nicht bewertbar | Smoke T21/T22 |
| Keine erfundene Standardkapazitaet | Smoke T23 |
| Beide unbesetzt / gleicher Fahrer -> kann empfohlen werden | Smoke T24/T25 |
| Ein Fahrer + einer ohne / zwei Fahrer -> nur possible | Smoke T26/T27 |
| Unbekannte Fahrer-ID -> nicht bewertbar | Smoke T28 |
| Einsparung exakt 15 stark, 14 nur possible | Smoke T29/T30 |
| Umweg 25 zulaessig, 26 ausgeschlossen | Smoke T31/T32 |
| Einsparung 0/negativ -> keine positive Empfehlung | Smoke T33 |
| Fehlende Matrixkante -> keine erfundene Einsparung (null, nicht 0) | Smoke T34 |
| Identische Route -> Einsparung = einfacher Leg, Umweg 0 | Smoke T35 |
| Asymmetrische Matrix -> beste Reihenfolge | Smoke T36 |
| sameOrigin/sameDestination/sameZone korrekt | Smoke T35/T41 |
| C3: to_festival late -> not_recommended | Smoke T43 |
| C3: from_festival vor Set-Ende -> hoechstens possible | Smoke T45 |
| Ohne Timetable kein C3-Veto | Smoke T42 |
| Zeitverschiebung je Fahrt getrennt, transparent | Smoke T46/T47 |
| Genau ein Hauptvorschlag je Fahrt, Alternativen markiert | Smoke T49/T50 |
| Ranking deterministisch, Ride-Id als Tie-Breaker | Smoke T51-T54 |
| Read-only: keine Eingabe wird mutiert | Smoke T55-T60 |
| Vorfilter Betriebstag/Richtung/Zeitfenster | Smoke T61/T62 |
| Schwellen wirklich wirksam (Kontroll-Gegenprobe) | Gegenprobe GP1-GP8 |

## Teil B - Manuelle Abnahme (ab F2, sobald die Anzeige da ist)

Ohne Programmierkenntnisse in der Leitstellen-Ansicht durchspielen:

1. Zwei Rueckfahrten gleiches Ziel, 5 min Abstand -> Sammelfahrt-Vorschlag.
2. Zwei Rueckfahrten 20 min Abstand -> noch bewertbar.
3. Zwei Rueckfahrten 21 min Abstand -> keine positive Empfehlung.
4. Zwei Fahrten mit exakt passender Sitzzahl -> Kapazitaet passt.
5. Personenzahl groesser als Kapazitaet -> keine positive Empfehlung.
6. Fehlende Personenzahl -> nicht sicher bewertbar.
7. Zwei Fahrten mit demselben Fahrer -> besonders klarer Vorschlag.
8. Zwei Fahrten mit unterschiedlichen Fahrern -> nur manuelle Pruefung.
9. Zwei unbesetzte Fahrten -> Vorschlag ohne automatische Zuweisung.
10. Gleicher Start und gleiches Ziel -> direkt kombinierbar bzw. sinnvoll.
11. Unterschiedliche Ziele gleiche Zone -> Route und Umweg werden bewertet.
12. Ziele in unterschiedlichen Zonen -> nur bei sinnvoller Route positiv.
13. Fehlende Matrixkante -> keine erfundene Einsparung.
14. Einsparung unter 15 min -> keine starke Empfehlung.
15. Einsparung exakt 15 min -> Schwelle erfuellt.
16. Umweg 25 min -> noch zulaessig.
17. Umweg 26 min -> keine positive Empfehlung.
18. Hinfahrten mit zwei Abholorten -> beste Reihenfolge wird berechnet.
19. Leonardo/HBF-Hinfahrt -> Sheraton-Operationalisierung bleibt korrekt.
20. Zwei Rueckfahrten mit unterschiedlichen Set-Enden -> spaetestes Set-Ende gilt.
21. Rueckfahrt vor Set-Ende -> keine positive Sammelfahrt.
22. Fahrt 23:55 und 00:05 -> 10 min Abstand, gleicher Betriebstag.
23. Mehrere moegliche Paare -> bester Vorschlag klar markiert.
24. Fahrten oeffnen -> bestehende Detaildialoge unveraendert.
25. Fahrerzuweisung oeffnen -> bestehender Schreibweg unveraendert.
26. Vorschlagsfilter -> nur passende Fahrten sichtbar.
27. Fahreransicht -> keine Sammelfahrt-Vorschlaege.
28. Stage-Manager-Ansicht -> unveraendert.
29. Gastansicht -> unveraendert.
30. Pruefen, dass keine Fahrt automatisch geaendert oder geloescht wurde.

Punkte 1-23 sind in Teil A bereits automatisiert belegt; die manuelle Runde in F2
prueft zusaetzlich Darstellung, Aktionen und Rollen-Gating in der echten Oberflaeche
(Punkte 24-30).
