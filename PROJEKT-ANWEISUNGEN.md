# Open Beatz Shuttle-Leitstelle – Projekt-Kontext

VIP-Shuttle-Dispositions-App für das Open Beatz Festival (Juli 2026, Herzogenaurach bei Nürnberg). Läuft produktiv auf Vercel + Supabase (nicht mehr nur Chat-Artifact-Stand). Jordan (Betreiber) organisiert die Fahrten für Artists/Manager mit 20 Fahrern.

## Übergabe-Stand für einen neuen Chat (13.07.2026, Ende dieser Sitzung)
Diese Sitzung ist lang geworden, ab hier bitte in einem neuen Chat weiter (selbes Projekt, Doku ist aktuell).

- **GitHub-Zugriff:** Der Fine-grained Personal Access Token für Push-Zugriff auf `Maybach62S57S/openbeatz-shuttle` muss im neuen Chat erneut eingefügt werden (nicht persistent über Chats hinweg, aus gutem Grund nirgends gespeichert). Im neuen Chat einfach neu klonen mit `https://<TOKEN>@github.com/Maybach62S57S/openbeatz-shuttle.git`, danach `git config user.email`/`user.name` setzen.
- **Supabase-Schema-Stand:** `write_dyn_if_unchanged` läuft mit 6 Parametern (inkl. `artistPresence`/`messages`) — am 13.07. in der DB bestätigt, `artistPresence`/`messages` speichern in Produktion. Zusätzlich wurde in Paket 1 eine neue RPC `write_setup_and_drivers_if_unchanged` ergänzt (siehe unten). **Jordan sollte nach jeder Schema-Ergänzung `supabase-schema.sql` einmal komplett neu im Supabase SQL Editor ausführen** (idempotent, `create or replace`).

### Paket 1 (Stabilität & Datenintegrität) — ERLEDIGT, committed & gepusht (Commit `afa72d9`)
Fünf gezielte, chirurgische Fixes, keine UI/Workflow-Änderung außer neuen Fehlerzeilen im Fehlerfall:
  1. **Setup+Drivers atomar:** neue RPC `write_setup_and_drivers_if_unchanged` (settings-CAS + drivers-Upsert in EINER Postgres-Transaktion). `sbSetSetup` ruft jetzt diese eine RPC statt vorher zwei nacheinander. Alte RPCs (`write_setup_if_unchanged`, `dispatcher_save_drivers`) bleiben als Fallback im Schema. **Braucht Schema-Re-Run in Supabase.**
  2. **Push-Registrierung:** `usePushNotifications.enable()` prüft jetzt das `updateDyn`-Ergebnis, zeigt „aktiv" nur bei echtem Erfolg, nimmt bei Fehler das Browser-Abo per `sub.unsubscribe()` zurück.
  3. **Push-Abmeldung:** `unsubscribePush` wertet das Ergebnis aus, gibt `{ok, error}` zurück, loggt Fehler statt sie zu schlucken.
  4. **Undo robuster:** Stack-Eintrag wird erst nach erfolgreichem Speichern entfernt (per Referenz `e !== entry` statt `slice(0,-1)`, was zusätzlich einen zweiten Bug fixte). Bei Fehler bleibt der Eintrag erhalten.
  5. **Fahrer-Reload:** `sbSetSetup` prüft den drivers-Reload auf error (keine leere Liste mehr bei Ladefehler). `DriverPhones`/`DispatcherUsers`/`AccessPinsSection` zeigen „gespeichert" nur bei `res.ok`, sonst rote Fehlerzeile.

### Paket 2 (Architektur, Wartbarkeit, Performance) — IN ARBEIT
Bewusste Scope-Entscheidung mit Jordan getroffen (Festival 23.-27.07., nur noch ~10 Tage):
- **Teil 1 (Datei in ~30 Module aufteilen) und Teil 2 (Base64-Assets auslagern): VERTAGT auf nach dem Festival.** Reine Aufräumarbeit, null Nutzen für den Live-Betrieb, aber hohes Regressionsrisiko so kurz vor knapp. Nicht von selbst wieder vorschlagen vor dem Festival.
- **Teil 3 (GPS in eigene `driver_locations`-Tabelle): ALS NÄCHSTES im neuen Chat.** Analyse ist gemacht (siehe unten). Größter praktischer Nutzen: jeder GPS-Ping schreibt aktuell das komplette `dyn_data` neu und erhöht `dyn_rev` → Revisionskonflikte mit Fahrten-Zuteilungen bei aktivem Betrieb. Eigene Tabelle löst das.
- **Teil 4 (Polling effizienter, Rev-Vergleich statt JSON.stringify) und Teil 5 (Zugriffsschicht für dyn_data vorbereiten): danach, je ein Teil pro Chat.**

**Analyse GPS (für Teil 3, verifiziert im Code 13.07.):**
- Schreiben: `useDriverLocationSharing` (ca. Z. 1586) ruft bei jedem gedrosselten Ping (>15m Bewegung ODER >45s) `updateDyn`, schreibt nach `driverState[driverId].gps = { lat, lng, accuracy, at }`.
- Lesen (3 Stellen, alle aus `dyn.driverState[id].gps`): Schemakarte via `gpsOverrideF` (projiziert auf Strecke, Z. 1370), Google-Maps-Ansicht `GoogleLiveMap` (ab Z. 6495), „Kein Live-Standort"-Panel `NoGpsSharingPanel` (ab Z. 6619).
- Verfallslogik: `GPS_MAX_AGE_MS` (3 Min, Z. 1368), `GPS_MAX_OFFROUTE_M` (5 km, Z. 1369).
- Für Teil 3 nötig: neue Tabelle `driver_locations` (driver_id, latitude, longitude, accuracy, heading, speed, updated_at) + Index + RPC zum Schreiben (eigener Pfad, fasst `dyn_rev` NICHT an) + RPC/Select zum Lesen + eigene RLS-Policy (bestehende nicht ersetzen). Frontend: Schreibstelle auf neue RPC, drei Lesestellen bevorzugt aus neuer Tabelle, Übergangsphase liest altes `dyn_data.driverState[].gps` weiter mit. Drosselung (>15m/>45s) beibehalten. Rückwärtskompatibel, keine Fahrer-/Fahrtdaten löschen.

- **Bewusst zurückgestellte Entscheidung (nicht von selbst wieder vorschlagen):** Jordan will die PIN-Geheimhaltung (Tier 2 — `drivers.pin`/Leitstellen-PINs/Stage-PIN weiterhin über anon-Key lesbar, Login vergleicht clientseitig) NICHT vor dem Festival angehen. Nur wieder ansprechen, wenn Jordan explizit danach fragt.
- **Noch offen, vor dem Event:** Schema neu ausführen nach Paket-1-RPC (kritisch für atomares Setup-Speichern), Google-Maps-Key in Vercel, echter Fahrer-/Mehrfach-Dispatcher-Testdurchlauf, Stammdaten final einspielen.
- **Chat-Längen-Warnung:** Jordan möchte rechtzeitig gewarnt werden, bevor ein Chat zu lang wird (stürzt ihm sonst ab). Pro Paket-Teil ein eigener Chat.
- **Life360-Sync (erledigt, negativ):** gegen echten Account getestet (12.07.2026), Login wird von Cloudflare geblockt (403, Bot-Sperre vor Life360s eigentlicher Login-Prüfung), nicht an Zugangsdaten/Token gelegen. Bewusst nicht weiterverfolgt (kein Umgehen von Bot-Sperren), Code wieder vollständig entfernt (`api/life360-sync.js`, 45s-Trigger, `life360_name`-Feld). Details in BACKEND-README.md. Stattdessen: für ein zuverlässiges GPS-Tracking, das unabhängig vom Fahrer-Handy läuft (z.B. während Google-Maps-Navigation), wurden Jordan dedizierte OBD-II-GPS-Tracker mit offizieller API empfohlen (z.B. Mietpakete von ortungssystem-vom-fachmann.de) — noch nicht umgesetzt, Jordan entscheidet selbst ob/wann.
- **Wichtigste Datei:** `src/ShuttleLeitstelle.jsx` (~7.200 Zeilen, wächst weiter) — immer zuerst laden/durchsuchen, bevor etwas Neues gebaut wird, um Konventionen und bestehende Features nicht zu duplizieren. `supabaseStore.js` ist weiterhin unbenutzt/veraltet, nicht referenzieren.
- **Arbeitsweise, die sich bewährt hat:** vor jeder Änderung kurz die betroffene Stelle im Code suchen und lesen (nicht aus dem Gedächtnis annehmen), nach jeder Änderung esbuild + Duplikat-Check + eigenständiger Node-Test für neue reine Logik, ausführliche Commit-Nachrichten (dienen als Langzeit-Doku). Bei neuen Top-Level-Feldern in `dyn` (wie `artistPresence`/`messages`) immer daran denken, dass `write_dyn_if_unchanged` das Feld explizit in der Signatur braucht, sonst geht es beim Speichern still verloren.

## Wichtigste Dateien
`src/ShuttleLeitstelle.jsx` — die komplette App in einer Datei (alle vier Rollen: Fahrer, Leitstelle Desktop, Leitstelle mobil, Stage Manager, plus Gast-Link).

Begleitdateien:
- `supabase-schema.sql`, `BACKEND-README.md` — Supabase-Backend (Realtime-Vorbereitung, atomare RPCs, RLS)
- `api/flight.js`, `FLIGHT-README.md` — Flug-Live-Tracking (AeroDataBox)
- `public/sw.js`, `api/send-push.js` — echte Push-Benachrichtigungen (Web Push/VAPID), bestätigt funktionsfähig
- `public/manifest.webmanifest` + Icons — Web-App-Installation (u. a. Voraussetzung für iOS-Push)
- `.env.example` — alle benötigten Umgebungsvariablen fürs Deployment
- `Leitstelle-Anleitung.docx`, `Fahrer-Anleitung.docx`, `Stage-Manager-Anleitung.docx` — Team-Bedienungsanleitungen (neu, 10.07.2026)

## Architektur-Kurzüberblick
- **Speicher im Artifact:** `window.storage` (shared), Keys `obf:setup:v5`/`obf:dyn:v5`, Polling alle 3s. `updateDyn`/`updateSetup` nutzen Read-Check-Write mit Retry (optimistische Nebenläufigkeit über einen `rev`-Zähler) — Mutatoren beschreiben IMMER eine Operation auf frischen Daten, nie einen kompletten Objekt-Überschrieb. Im Artifact bleibt das Best-Effort (window.storage kennt kein echtes Compare-and-Swap, "last write wins" laut Storage-API).
- **Nach echtem Deploy:** dieselbe App, `sget`/`sset` (direkt in ShuttleLeitstelle.jsx) erkennen Supabase automatisch und schreiben dann über `write_dyn_if_unchanged`/`write_setup_if_unchanged`-RPCs — ein echtes atomares Compare-and-Swap in der DB statt Read-Check-Write aus der App heraus (siehe Sicherheits-Nachtrag 3 in `supabase-schema.sql`, mit echten Postgres-Tests verifiziert). Realtime ist in der DB vorbereitet, aber vom Frontend noch nicht abonniert, es bleibt bei 3s-Polling. `supabaseStore.js` im Repo ist unbenutzte Altlast, nicht die tatsächliche Integration.
- **Vier Rollen, ein gemeinsamer Login-Screen:** Fahrer (Name+PIN), Leitstelle (Name aus Liste+PIN), Stage Manager (nur PIN), Gast/Artist-Manager (eigener Link mit Token, kein Login). Rollen-spezifische Komponenten: `DriverApp`, `Dashboard`, `StageApp`, `GuestApp`. Login/PIN-Prüfung ist rein clientseitig, es gibt kein serverseitiges Rollen-Login (Supabase Auth/JWT) — bewusst noch nicht Teil der App, siehe „Bekannte Grenzen" unten.
- **Gast-Link nach Supabase-Deploy echt abgesichert:** `GuestApp` läuft dort über token-beschränkte RPCs (`guest_session` u. a.), bekommt serverseitig nur die eigenen Fahrten. Im Artifact weiterhin nur UI-Filterung (unveränderbare Grenze von window.storage).
- **Login bleibt persistent** über `localStorage` (pro Gerät), übersteht Tab-Kills/Neustarts.
- **Ride-Datenmodell:** ein Objekt pro Fahrt mit u. a. `status` (planned→accepted→enroute_pickup→onboard→done, plus cancelled), `statusHistory[]`, `issues[]` (tri-state open/progress/done), `log[]` (Änderungsprotokoll via `logRide()`), `assignedDriverId`, Flugdaten, `guestNote`, `guestConfirmedAt`/`guestAtPickupAt`.
- **`by`-Kennung überall:** jede Änderung wird mit `driver:<id>` / `dispo:<id>` / `stage:<label>` / `guest:<djName>` / `auto` protokolliert; `byLabel()` löst das in lesbare Namen auf.

## Feste Konventionen — bitte immer einhalten
- **Sprache:** Deutsch, informell/direkt mit Jordan, keine Gedankenstriche (—), korrekte Umlaute.
- **Ehrliche Einschätzungen zuerst:** bei Architektur-Entscheidungen (z. B. neues Feature, Sicherheitsfragen) erst eigene Meinung/Risikoabwägung geben, dann erst nach Bestätigung bauen.
- **Nach jeder Code-Änderung:** mit esbuild kompilieren (`./node_modules/.bin/esbuild datei.jsx --bundle=false --format=esm --outfile=/tmp/x.js`), auf doppelte Funktionsnamen prüfen (`grep -oE '^function [a-zA-Z]+' datei.jsx | sort | uniq -d`), Kernlogik mit eigenständigen Node-Testskripten verifizieren (nicht nur "sieht plausibel aus").
- **Sicherheitsnetze bei riskanten Aktionen** (z. B. Chat-Assistent, Gast-Aktionen): nie direkt schreiben, immer über dieselben geprüften Funktionen wie die normalen Buttons (`applyChatAction` etc.), nie halluzinierte IDs/Werte blind übernehmen.
- **Datenschutz-Trennung:** interne Notizen (`notes`) vs. Gast-sichtbare Hinweise (`guestNote`) sind bewusst getrennte Felder. Fahrer-Telefonnummern werden nie an Gäste weitergegeben, nur eine zentrale Koordinations-Nummer.
- **Pages-kompatible Nebenprojekte** (Merg & More Dokumente, falls das Thema wechselt): keine verschachtelten Tabellen, keine Zero-Margin-Sections.

## Bereits gebaute Features (Stand dieser Übergabe)
13-Punkte-PDF komplett, Live-GPS-Projektion auf Schemakarte (inkl. optionaler echter Google-Maps-Ansicht mit Fahrer-Markern), Leitstellen-Nutzer mit Namen, Artist-/Manager-Gast-Link-Modus, echte Web-Push-Infrastruktur (Fahrer + Leitstelle, bestätigt funktionsfähig), große interaktive Timeline-Seite mit Drag-and-Drop/Lücken-Hervorhebung/Jetzt-Linie, globale Rückgängig-Funktion (bis zu 15 Schritte, Button im Dashboard-Header), Chat-Assistent mit Bestätigen-Button (Anthropic API, `claude-sonnet-4-6`, `max_tokens: 1000` — KI-Assistent, nicht zu verwechseln mit der Mensch-zu-Mensch-Nachrichtenfunktion), Security-Nachtrag 3+5 (Compare-and-Swap statt Lost-Update, Gast-Link RPC-isoliert, direkte Schreibzugriffe per REST komplett gesperrt), „Kein Live-Standort"-Übersicht, Navi-Button für Fahrer, Live-Verfügbarkeit im Fahrer-Tab, Notfall-Warn-Badge, „Keine Rückfahrt nötig" + manuelle Anwesenheits-Verwaltung pro Artist, einfache Nachrichten-Funktion Fahrer/Stage ↔ Leitstelle (eine Antwort, kein Chat-Verlauf), vollständige PWA (Home-Bildschirm-Installation auf iOS/Android).

Timeline-Drag-and-Drop hat seit der letzten Überarbeitung eine Bestätigung: Loslassen wendet nichts sofort an, sondern zeigt einen kleinen, nicht blockierenden Hinweis direkt an der Zielposition mit "Abbrechen"/"Verschieben" (Klick daneben oder Escape = Abbrechen). Nach dem Bestätigen erscheint zusätzlich kurz (8 Sekunden) ein "Rückgängig"-Hinweis direkt an der Fahrt, der die globale Rückgängig-Funktion auslöst — das ist die gleiche Funktion wie der Header-Button, kein separater Verlauf.

## Bekannte Grenzen (im Chat-Artifact, nicht nach Deploy)
GPS-Hintergrund-Tracking, echte Push-Benachrichtigungen und der Chat-Assistent brauchen ein echtes Deployment (HTTPS, eigener Server) — im Artifact selbst nur bedingt/gar nicht testbar, aber vollständig code-fertig und dokumentiert in den jeweiligen README-Dateien.

## Offener Punkt aus dem Security-Review (bewusst zurückgestellt auf Jordans Wunsch, nicht von selbst wieder ansprechen)
Fahrer-PINs, Leitstellen-PINs und der Stage-PIN sind über den anon-Key weiterhin per Lesezugriff auslesbar (Login vergleicht PINs komplett clientseitig, es gibt keine serverseitige Rollen-Unterscheidung). Der direkte **Schreib**-Zugriff auf `drivers`/`settings`/`driver_state`/`rides`/`guest_tokens` per REST wurde dagegen bereits gesperrt (Nachtrag 5, 11.07.2026) — das war risikofrei und ändert nichts an der App-Funktion. Die PIN-Geheimhaltung selbst (Tier 2: server-seitige `verify_*_pin`-RPCs + Login-Umbau für alle drei Rollen) hat Jordan explizit vertagt, weil ihm Risiko/Aufwand so kurz vor dem Festival nicht passt — nur wieder vorschlagen, wenn er selbst danach fragt.

## Push-Benachrichtigungen: bestätigt funktionsfähig (10.07.2026)
Kompletter Weg getestet und bestätigt: Fahrer-Push (Zuteilung bei gesperrtem Handy) UND Leitstellen-Push (Problem gemeldet) kommen beide an. Zwei echte Bugs dabei gefunden und behoben (siehe Git-Historie): `api/send-push.js` suchte Abos am falschen Ort (tote `driver_state`-Tabelle statt `dyn_data`), und `sset()` hat echte Speicherfehler wie normale Konflikte behandelt (stilles Wiederholen statt Fehler zu zeigen).

**Stolperfalle beim Einrichten, falls das Projekt je neu aufgesetzt wird:** `SUPABASE_URL` (für `api/send-push.js`, Service-Role-Zugriff) ist NICHT dieselbe Seite wie die REST-API-URL unter „Integrations → Data API" (die hat `/rest/v1/` am Ende dran, führt zu `PGRST125: Invalid path specified`). Die richtige, reine Projekt-URL (`https://xxx.supabase.co` ohne Zusatz) findet sich zuverlässig über den **„Connect"-Button** oben in Supabase → Framework/Server-Tab → Feld `NEXT_PUBLIC_SUPABASE_URL` bzw. `SUPABASE_URL` in den Codebeispielen. Außerdem: Supabase hat neue Key-Typen (`sb_publishable_...`/`sb_secret_...`), unser Code erwartet aber weiterhin den klassischen `service_role`-Key (JWT, beginnt mit `eyJ...`) aus dem Reiter „Legacy anon, service_role API keys" unter Settings → API Keys, nicht den neuen „Secret key".

## Mobile Leitstellen-Ansicht: umgesetzt (10.07.2026)
Automatisch aktiv bei schmalem Bildschirm (<768px), jederzeit manuell umschaltbar (Symbol im Header, Präferenz pro Gerät gemerkt). Vier Reiter: Fahrten (Suche/Filter/Zuteilen), Timeline (eigene vertikale Ansicht statt Desktop-Drag-and-Drop), Karte (nutzt die bestehende, ohnehin responsive SchematicMap direkt weiter), Rückfahrten. Chat-Assistent per FAB, dieselbe ChatPanel-Komponente wie am Desktop. Kein eigener Datenpfad — alles läuft über dieselben Funktionen (AssignModal, buildMapNodes/computeMapPositions, logRide/setRideStatus/triggerPush) wie das Desktop-Dashboard. Bekannter, dokumentierter Randfall: eine Fahrt exakt um 06:00:00 landet in der Mobil-Timeline am oberen statt unteren Rand (sortMin-Grenze), bei Festival-Fahrzeiten praktisch irrelevant.
