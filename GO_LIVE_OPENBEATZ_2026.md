# Betriebshandbuch Go-Live: Open Beatz Shuttle-Leitstelle 2026

Festival: Open Beatz, 23.-27. Juli 2026, Herzogenaurach (bei Nuernberg).
Diese Datei ist das operative Handbuch fuer den Live-Betrieb: was das System kann, wie man es am
Festivaltag bedient, und was zu tun ist, wenn etwas klemmt. Das rein technische Deploy steht in
`DEPLOYMENT-ROLLBACK.md`, das Architektur-WARUM in `BACKEND-README.md`.

---

## 1. Systemueberblick: vier Rollen, ein Login-Screen

- **Leitstelle (Dispatcher):** Name aus Liste + PIN. Voller Zugriff: Fahrten anlegen/importieren,
  Fahrern zuteilen, Status/Zeiten/Route aendern, Timeline, Chat-Assistent, globale Rueckgaengig-Funktion.
- **Fahrer:** Name + PIN. Sieht die eigenen Fahrten, setzt Status (akzeptiert -> unterwegs -> Gast an Bord
  -> erledigt), meldet Probleme, teilt optional Standort/Push frei.
- **Stage Manager:** nur PIN. Read-only auf den relevanten Ablauf, kann ausschliesslich Probleme melden.
  Kann NIE Status oder Zuteilung aendern.
- **Gast/Artist-Manager:** eigener Link mit Token, kein Login. Sieht nur die Fahrten des eigenen
  Kuenstlernamens, kann bestaetigen ("Confirm pickup"/"I am at pickup") und Probleme melden. Keine
  Dispo-Funktionen, keine privaten Fahrer-Nummern, nur die zentrale Koordinationsnummer.

Datenmodell pro Fahrt: Status planned -> accepted -> enroute_pickup -> onboard -> done (plus cancelled),
dazu Verlauf (statusHistory), Probleme (issues, offen/in Arbeit/erledigt), Aenderungsprotokoll (log),
Flugdaten, Gast-Notiz, Gast-Bestaetigungen. Jede Aenderung wird mit Urheber protokolliert
(Fahrer/Leitstelle/Stage/Gast/automatisch).

---

## 2. Vor dem Festival (T-1 Tag)

- [ ] Deploy komplett und Nach-Deploy-Smoke bestanden (siehe `DEPLOYMENT-ROLLBACK.md`, Abschnitt 5).
- [ ] Alle Fahrer als Datensatz in der DB, PINs vergeben.
- [ ] Fahrplan/Fahrten importiert (Leitstelle -> Import). Nach Import Stichprobe: Orte richtig erkannt
      (besonders Leonardo City-Center, Airport Munich, Karl-August-Hotel), Zeiten plausibel.
- [ ] Festival-Koordinate in der DB korrekt (49.52728 / 10.83139) -> Navigieren-Button fuehrt richtig.
- [ ] Standort-Freigabe/DSGVO mit den Fahrern kurz klaeren (siehe Abschnitt 6): nur waehrend der Schicht,
      keine Langzeit-Historie, jederzeit abschaltbar.
- [ ] Zugangsdaten verteilt (siehe Abschnitt 3), zentrale Koordinationsnummer bekannt gegeben.
- [ ] Zwei Leitstellen-Geraete/Personen eingeteilt (Redundanz), Ladegeraete/Powerbanks organisiert.

---

## 3. Zugangsdaten ausgeben

- Jeder **Fahrer** bekommt: seinen Namen (wie in der Liste) + persoenliche PIN + die App-URL.
  Einmal auf dem Handy oeffnen, einloggen, "Zum Homescreen hinzufuegen" (PWA-Icon). Der Login bleibt
  auf dem Geraet erhalten (uebersteht Neustart/Tab-Schliessen).
- **Leitstelle:** Name aus der Liste + PIN. Auf beiden Leitstellen-Geraeten einloggen.
- **Stage Manager:** PIN. Read-only, meldet nur Probleme.
- **Gast-/Artist-Links:** in Einstellungen -> "Gast-/Artist-Links" pro Kuenstler erzeugen, Link kopieren,
  vor dem Verschicken einmal in der Vorschau testen. Der Link geht an den jeweiligen Artist/Manager.

---

## 4. Betrieb waehrend des Festivals

### Leitstelle
- Neue Fahrten anlegen oder importieren, Fahrern zuteilen. Zuteilung -> Fahrer bekommt sie sofort
  (Realtime), bei aktiver Push auch bei gesperrtem Handy.
- Timeline-Seite fuer den Ueberblick: Drag-and-Drop verschiebt eine Fahrt (mit Bestaetigung "Verschieben/
  Abbrechen", danach 8 Sekunden "Rueckgaengig"-Hinweis). Luecken und die Jetzt-Linie sind hervorgehoben.
- Globale Rueckgaengig-Funktion (Button im Header, bis zu 15 Schritte) fuer versehentliche Aenderungen.
- Chat-Assistent hilft bei Fragen/Aktionen; Aktionen laufen ueber denselben Bestaetigen-Knopf wie die
  normalen Buttons (nie blind).
- Zwei Leitstellen gleichzeitig sind unproblematisch: gleichzeitige Aenderungen an derselben Fahrt gehen
  nicht verloren (CAS-Schutz, in Block G/H hart geprueft). Im seltenen Konfliktfall kommt eine sachliche
  Meldung "Stand hat sich geaendert" statt eines stillen Ueberschreibens.

### Fahrer
- Fahrt annehmen -> Status weiterschalten (unterwegs / Gast an Bord / erledigt). Jede Statusaenderung
  landet sofort bei der Leitstelle.
- Problem melden bei Verspaetung/Panne/kein Gast am Treffpunkt.
- Optional Standort-Freigabe (Live-Karte) und Push aktivieren (je ein Knopf im Kopfbereich).
- Doppelklick-Schutz ist eingebaut: schnelles Doppeltippen loest nur EINE Aktion aus.

### Stage Manager
- Read-only. Meldet Probleme (z. B. Bühnenzeit verschoben). Keine Status-/Zuteilungsrechte.

### Gast/Artist-Manager
- Sieht nur die eigenen Fahrten. Kann "Confirm pickup" / "I am at pickup" druecken und Probleme melden.
  Diese Aktionen setzen nur Flags/Log-Eintraege, nie Status oder Fahrerzuteilung.

---

## 5. Monitoring waehrend des Betriebs

- **Schreibdiagnose:** In der Browserkonsole eines Leitstellen-Geraets `window.__obfWriteStats` zeigt
  laufende Zaehler: `dynSuccess` (erfolgreiche Schreibvorgaenge), `dynConflicts` (aufgeloeste
  Nebenlaeufigkeit, ein paar sind normal), `dynFailures` (sollte 0 bleiben), `dynMaxAttempts`
  (Retry-Tiefe). Steigen `dynFailures` merklich, ist etwas mit der Verbindung/DB los -> Abschnitt 7.
- **Realtime-Gefuehl:** Aenderungen sollten auf dem zweiten Geraet ohne Reload erscheinen. Wenn nicht,
  Netz/Realtime pruefen.
- **Flug:** verspaetet = gelb, gelandet ohne Fahrer unterwegs = rot/kritisch, annulliert = pruefen/halten.
  Manuell geaenderte Fluege werden vom Auto-Update uebersprungen (per "auto" wieder freigeben).

---

## 6. Datenschutz (DSGVO) im Betrieb

- **Standort:** nur waehrend der Schicht tracken, keine Langzeit-Historie. Freigabe ist im Fahrer-Header
  sichtbar und einzeln abschaltbar. Vor dem Event kurz die Einwilligung klaeren.
- **Telefonnummern:** private Fahrer-Nummern werden nie an Gaeste weitergegeben. Gaeste sehen nur die
  zentrale "Shuttle-Coordination"-Nummer (Einstellungen -> Gast-/Artist-Links).
- **Interne vs. Gast-sichtbare Notizen:** `notes` (intern) und `guestNote` (fuer Gaeste sichtbar) sind
  bewusst getrennt. Sensibles gehoert in `notes`, nie in `guestNote`.

---

## 7. Stoerungs-Playbook (was tun, wenn ...)

**Fahrer-Handy leer/gesperrt / App zu:**
Reines Web-Tracking laeuft nur im Vordergrund. Sperrt ein Fahrer das Handy laenger, pausiert
Standort/Push (iOS besonders restriktiv) - das ist eine Plattform-Grenze, kein Fehler. Die Live-Karte
faellt sauber auf die Zeitplan-Schaetzung zurueck. Massnahme: Fahrer bitten, die App im Vordergrund/aktiv
zu lassen; im Zweifel per Koordinationsnummer anrufen.

**Standort veraltet/springt:**
Aelter als 3 Minuten -> automatischer Rueckfall auf Zeitplan-Schaetzung. Zu weit weg von der erwarteten
Route (>5 km) -> Position wird verworfen statt falsch angezeigt. Kein Eingriff noetig, System regelt das.

**Push kommt nicht an:**
Ohne vollstaendige VAPID-Einrichtung bleibt alles bei Stufe 1 (Vordergrund-Toast+Vibration+Ton), solange
die App offen ist. Nichts bricht. Fuer echte Hintergrund-Push muss jeder Fahrer einmal "Push aktivieren"
getippt und die Browser-Abfrage erlaubt haben.

**Flugstatus aktualisiert nicht / API-Limit:**
Der Endpoint cached 60 s. Ohne AeroDataBox-Key oder bei Limit faellt der Button auf manuelle Pflege
zurueck. Massnahme: Fluege bei Bedarf manuell setzen (die manuelle Angabe gewinnt ohnehin und wird vom
Auto-Update in Ruhe gelassen).

**Chat-Assistent meldet "nicht verfuegbar":**
`ANTHROPIC_API_KEY` fehlt/aufgebraucht. Kein Beinbruch - die Leitstelle arbeitet ohne Assistent normal
weiter.

**Gleichzeitige Aenderung "Stand hat sich geaendert":**
Kein Fehler, sondern der Schutz gegen verlorene Updates. Kurz neu laden/erneut ausloesen. Beide
Aenderungen bleiben erhalten.

**Supabase langsam / Fehler haeufen sich (`dynFailures` steigt):**
1. Netz des Geraets pruefen (WLAN/Mobilfunk am Festival kann schwanken).
2. Supabase-Statusseite/Projekt-Health pruefen.
3. Notfalls Frontend-Rollback auf das letzte gute Deployment (Vercel "Promote to Production"), falls die
   Ursache ein frisches Deploy war (siehe `DEPLOYMENT-ROLLBACK.md`, 6a).

**Supabase komplett aus (schwerster Fall):**
Es gibt KEINEN automatischen geteilten Ersatz (der `window.storage`-Modus synchronisiert nicht zwischen
Geraeten). Ausfallplan: Leitstelle koordiniert die laufenden Fahrten uebergangsweise per Telefon
(Koordinationsnummer) und Zettel/Whiteboard, bis Supabase wieder erreichbar ist; danach den aktuellen
Stand in der App nachziehen. Diese Rueckfallebene VOR dem Festival einmal durchsprechen.

---

## 8. Bekannte Grenzen (ehrlich)

- **GPS-Hintergrund, echte Push, Chat-Assistent** brauchen das echte Deployment (HTTPS/Server). Im reinen
  Vorschau-/Artifact-Modus nur bedingt/nicht nutzbar.
- **Web-Tracking nur im Vordergrund** (Plattform-Grenze, s. o.).
- **Live-Realtime-Fanout auf ~25 Geraete gleichzeitig** wurde bis zur Datenschicht (CAS-Logik + echte
  Postgres-RPC-Atomaritaet) hart geprueft; das reale Fanout auf viele echte Handys inkl. Netzverhalten am
  Festivalgelaende ist erst im Live-Betrieb voll verifizierbar. Deshalb der Zwei-Geraete-Smoke vor dem
  Event und die Rueckfallebene in Abschnitt 7.

---

## 9. Eskalation / Kontakte (vor dem Festival ausfuellen)

- Zentrale Shuttle-Koordinationsnummer: __________________________
- Leitstelle 1 (Person/Handy): __________________________
- Leitstelle 2 (Person/Handy): __________________________
- Technischer Ansprechpartner (Deploy/DB): __________________________
- Supabase-Projekt-URL / Vercel-Projekt: __________________________
- Letztes bekannt-gutes Vercel-Deployment (Rollback-Ziel): __________________________
