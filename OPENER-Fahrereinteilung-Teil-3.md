# Opener für die nächste Session: Fahrereinteilung Teil 3

Ab hier zum Kopieren in einen frischen Chat.

---

Neue Session: Fahrereinteilung Open Beatz 2026, Teil 3. Ziel dieser Session ist
der Einteilungsentwurf, sonst nichts.

Lies zuerst `PRUEFBERICHT-Pickupliste-23-07.md`, dann
`UEBERGABE-Fahrereinteilung-2026-STAND-23-07.md` (Abschnitt 2 Fahrerstand und
Abschnitt 3 Regelwerk). Bei Widerspruch gewinnt der Prüfbericht, er ist neuer.
Danach bei Bedarf `SHUTTLE-VORSCHLAG-SPEC.md`, Abschnitt 10 (Standby,
Leerfahrten) und 12 (Van-Knappheit). Achtung: die Van-Liste in Spec 11.2 ist
veraltet, es gilt Übergabe Abschnitt 2.

Schritt 0 vor allem anderen: Repo klonen, `git log --graph --oneline --all`,
Zeilenzahl von `src/ShuttleLeitstelle.jsx` prüfen (Sollwert 13556, letzter
Code-Commit `8a0a1d9`), Remote nach dem Klonen scrubben.

Ich lade dir hoch:
- `Pickups_-_OPEN_BEATZ_FESTIVAL_2026-5.xlsx` (die Fahrtenliste, nicht im Repo)

Erster Schritt nach dem Klonen: `pruefe-pickupliste.py` einmal normal und einmal
mit `--gegenprobe` laufen lassen und die Zahlen gegen den Prüfbericht abgleichen.
Erst wenn beides passt, weitermachen.

Was bereits entschieden ist und nicht neu diskutiert wird:
- Fahrerdaten sind fertig, Code und Datenbank. 23 Fahrer, 16 Cars mit 64 Sitzen,
  7 Vans mit 46 Sitzen, 110 gesamt. Nicht anfassen.
- Die Spalten `driver_category`, `available_from`, `team_group` existieren in
  der DB NICHT. Es gelten die Werte aus `DRIVER_PROFILES` im Code. Leon Merg und
  Philipp Stich sind damit Springer.
- Atopia: wie eingetragen einteilen, zwei Vans pro Richtung.
- Springer bleiben im Entwurf leer. Wenn eine Fahrt sonst unbesetzt bliebe,
  Zeile sichtbar als "Springer nötig" markieren statt still zuteilen, und am
  Ende zählen, wie oft das vorkommt.

Dann baust du den Einteilungsentwurf:
- 309 Fahrten auf 23 Fahrer unter dem Regelwerk aus Übergabe Abschnitt 3.
- Ausgabe als Excel, deutsch, mit sichtbaren Leerfahrten und Standzeiten,
  ohne Einzelblatt pro Fahrer.
- Fairness: Hauptmaß ist Fahrzeit in Stunden, Fahrtenzahl als zweite Spalte.
  Van-Fahrer maximal 25 Prozent über dem Durchschnitt der Auto-Fahrer. Ist der
  Deckel erreicht, wandert die nächste Bündelung auf Autos statt auf den Van.
  Vans aktiv mit normalen Fahrten auffüllen, sie sind sonst unterausgelastet.
- Bündelungen als eigene Spalte vorschlagen, nicht hart einbauen. Ich entscheide.
- Am Ende eine Übersicht mit Fahrzeit und Fahrtenzahl pro Fahrer, damit ich die
  Balance selbst sehe.

Keine Code-Änderung ohne Verdrahtungsplan und meine Freigabe. Der Entwurf ist
eine reine Excel-Ausgabe, dafür wird am Code nichts geändert.

Festival läuft bis 27.07., Produktiv-DB ist scharf, Preview ist keine Sandbox.
Deutsch, informell, keine Gedankenstriche, korrekte Umlaute. Warne mich
proaktiv, bevor der Chat zu voll wird. PAT stelle ich frisch.

---

## Nicht in den Chat kopieren, nur zur Erinnerung für Jordan

- **PAT aus Teil 2 widerrufen.**
- Der Import in die App ist NICHT Teil von Teil 3. Erst kommt der Entwurf,
  dann Trockenlauf, dann Mini-Import von 3 Fahrten, dann voller Import.
- Vor dem Import weiterhin offen: `select count(*) from rides` und Bestätigung,
  dass keine echten Fahrten dazwischenliegen.
- Ebenfalls offen: PIN für Raphael Swiety (`4915251471504`), zwei geschätzte
  Fahrzeiten (`sheraton|flugplatz_herzo` 40 min, `sheraton|bahnhof_puschendorf`
  35 min).
