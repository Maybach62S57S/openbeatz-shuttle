# Teilpaket C3 - Manuelle Abnahme (Leitstelle)

Alle Punkte in der Leitstellen-Ansicht, in "Fahrt anlegen/bearbeiten" (RideForm)
und im "Fahrer zuteilen"-Dialog (AssignModal). Die Bewertung erscheint direkt unter
der Timetable-Zuordnung als Feld "Planungsbewertung". Nichts davon speichert etwas.

1. Hinfahrt Hotel -> Festival, Artist matcht ein Set, Ankunft > 40 min vor Set-Beginn:
   zeigt gruen "Rechtzeitig geplant" mit Puffer in Minuten.
2. Gleiche Fahrt, Ankunft 20-39 min vorher: amber "Knapp geplant".
3. Ankunft 0-19 min vorher: rot "Kritische Planung".
4. Ankunft exakt zum Set-Beginn: rot "Kritische Planung", Text "exakt zum Set-Beginn".
5. Ankunft nach Set-Beginn: rot "Zu spaet geplant" mit Minuten nach Beginn (anderes
   Label als kritisch).
6. Puffergrenzen pruefen: bei 40 min noch gruen, bei 39 amber, bei 20 amber, bei 19 rot.
7. Rueckfahrt Festival -> Hotel, Abfahrt nach Set-Ende: gruen "Rueckfahrt nach Set-Ende".
8. Rueckfahrt exakt zum Set-Ende: gruen, Text "Rueckfahrt zum Set-Ende geplant".
9. Rueckfahrt vor Set-Ende: rot "Rueckfahrt vor Set-Ende" mit Minuten vor Ende.
10. Leonardo -> Festival (Ort als Freitext): Bewertung rechnet ab Sheraton (38 min),
    Detail "Operativ: sheraton -> festival".
11. Nuernberg HBF -> Festival: ebenso ab Sheraton.
12. Festival -> Leonardo: bleibt Rueckfahrt, Bewertung gegen Set-Ende (nicht Sheraton).
13. Set ueber Mitternacht (z. B. 23:30-00:30) mit Hinfahrt vor Mitternacht: korrekter
    Puffer, keine falsche Tagesverschiebung.
14. Rueckfahrt nach Mitternacht (z. B. 00:45) zu Set-Ende 00:30: gruen, +15 min.
15. Set, das nach Mitternacht beginnt (Betriebstag = Vortag): Fahrt am selben
    Betriebstag wird bewertet, nicht als "kein Match" abgetan.
16. Artist mehrdeutig (mehrere plausible Sets): neutraler Hinweis
    "Timetable-Zuordnung pruefen", keine Ampelfarbe, keine Minutenzahl.
17. Kein Timetable-Treffer: neutral "Keine Timetable-Zeitbewertung moeglich".
18. Kein Artist eingetragen / unverarbeitbare Artist-Angabe: neutral, kein Alarm.
19. Fahrt ohne Uhrzeit oder mit unbekanntem Abholort -> Festival: neutral
    "Zeitbewertung nicht moeglich", keine geschaetzte Ankunft.
20. Fahrt ohne Festivalbezug (Hotel -> Flughafen, Flughafen -> Hotel): Feld sagt
    "keine Festival-Zeitbewertung erforderlich", keine Warnung.

Zusatzpruefungen:
- "Details" aufklappen: zeigt Richtung, Match-Status, Ride-Start, operative Orte,
  operative Fahrzeit, Set-Zeiten, Puffer/Relativwert, Status/Severity, Gruende.
- Die C2-Timetable-Zuordnung darueber bleibt unveraendert sichtbar.
- Bewertung erscheint NUR in der Leitstelle, nicht in Fahrer-/Stage-/Gast-Ansicht.
- Keine Aktion in diesem Feld aendert Fahrt, Status oder Zuteilung.
