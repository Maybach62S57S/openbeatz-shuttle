# Open Beatz Shuttle – Produktivbetrieb mit Supabase

Die App im Chat-Artifact nutzt `window.storage` (synchronisiert nur innerhalb der Claude‑Umgebung). Für **echten Einsatz auf Vercel mit Fahrer‑Handys** braucht es ein echtes Backend. Diese Dateien liefern den kompletten Baukasten dafür.

## Was hier drin ist
- **`supabase-schema.sql`** – Tabellen (drivers, settings, rides, driver_state, guest_tokens), Realtime, atomare RPCs (Status, Zuteilung, Problem melden, Gast-Fahrten) und RLS‑Startpolicies.
- **`supabaseStore.js`** – fertige Datenschicht: Laden, Realtime‑Abo, atomare Mutationen. Ersetzt `sget`/`sset`/`updateDyn` der Artifact‑Version.
- **`shuttle-leitstelle.jsx`** – die App (Frontend/Logik).
- **`api/flight.js`** – Flug-Live-Tracking (AeroDataBox), siehe FLIGHT-README.md.
- **`sw.js`** – Service Worker für echte Push-Benachrichtigungen (gehört ins `public/`-Verzeichnis des Frontend-Projekts).
- **`api/send-push.js`** – Serverless-Funktion, die den eigentlichen Push verschickt.

## Warum das die Review‑Punkte löst
- **Live‑Sync (0):** Supabase Realtime pusht jede Änderung an alle Geräte.
- **Keine verlorenen Updates (1):** Single‑Row‑Updates sind in Postgres atomar (Row‑Lock); JSON‑Felder (issues, status_history) werden per `||` atomar angehängt. Kein Überschreiben ganzer Objekte mehr.
- **Stammdaten/PII in der DB (2):** Fahrer/Fahrzeuge in `drivers`, keine E‑Mails im Frontend. Rollen über RLS (Startpolicies enthalten, für „Fahrer sieht nur eigene Fahrten" JWT‑Claim ergänzen).

## Einrichtung (ca. 30 Min)
1. Supabase‑Projekt anlegen → **SQL Editor** → `supabase-schema.sql` ausführen.
2. Fahrer einspielen: `insert into drivers (id, first_name, last_name, vehicle_type, vehicle_id, seats) values (...);`
   und `settings`‑Zeile mit euren `locations`, `matrix`, `zones`, `config` füllen (Struktur = wie in der App).
3. Frontend als Vite/React‑Projekt anlegen, `shuttle-leitstelle.jsx` einbauen, `@supabase/supabase-js` installieren.
4. In der App die Datenschicht tauschen:
   - `loadSetup()` / `loadRides()` / `loadDriverState()` beim Start,
   - `subscribeLive(reload)` fürs Live‑Update (ersetzt das Polling),
   - Statuswechsel → `advanceStatus(rideId, status, by)`,
   - Zuteilen → `assignRide(rideId, driverId, by)`,
   - Problem melden → `reportIssue(rideId, issue)`,
   - Import → `existingSignatures()` + `insertRides(neueFahrten)`.
5. Env‑Variablen bei Vercel setzen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), deployen.

## Live-GPS der Fahrer (neu)
Die App erfasst jetzt echte Fahrer-Standorte im Browser (`useDriverLocationSharing` in `shuttle-leitstelle.jsx`), solange die Fahrer-App offen ist – gedrosselt (Bewegung > 15 m oder alle 45 s), landet in `driverState[driverId].gps`. Die Live-Karte projiziert diese Koordinate auf die passende Strecke zwischen zwei bekannten realen Orten (Flughafen/Hotels/Festival, bereits mit lat/lng hinterlegt) und nutzt sie statt der Fahrplan-Schätzung – ohne eigene Kartenkacheln, bleibt also im Chat-Artifact UND nach dem Deploy ohne zusätzliche Kartenanbieter-Kosten lauffähig.
- **Veraltet nach 3 Minuten** (`GPS_MAX_AGE_MS`) → automatischer Rückfall auf Zeitplan-Schätzung.
- **Zu weit von der erwarteten Route** (>5 km, `GPS_MAX_OFFROUTE_M`) → wird verworfen statt einer falschen Position zu zeigen.
- Schema/Store bereits erweitert: `driver_state` hat jetzt `gps_lat/gps_lng/gps_accuracy/gps_at`, `supabaseStore.js` hat `setDriverGps()`/liest es in `loadDriverState()` mit ein.
- **Wichtiger Hinweis für den Live-Betrieb:** Reines Web-Tracking funktioniert nur im Vordergrund – sperrt ein Fahrer das Handy längere Zeit, pausiert die Übertragung (iOS ist hier besonders restriktiv). Das ist eine Plattform-Grenze, keine Baustelle in der App; sie fällt in dem Fall sauber auf „geschätzt" zurück.
- **Datenschutz:** Standort-Freigabe ist im Fahrer-Header sichtbar und einzeln abschaltbar; vor dem Event kurz die Einwilligung/DSGVO-Seite klären (nur während der Schicht tracken, keine Langzeit-Historie).

## Gast-/Artist-Manager-Links (neu)
Persönliche Info-Seite für Artist/Manager über einen Link mit Token (`?guest=TOKEN`), ohne Login. Zeigt nur die Fahrten desselben Künstlernamens, keine Dispo-Funktionen, standardmäßig Englisch. Token-Verwaltung: Einstellungen → „Gast-/Artist-Links" (erzeugen, Link kopieren, Vorschau direkt im Artifact testen, löschen).
- **Wichtiger Sicherheitshinweis:** Im Chat-Artifact (`window.storage`) ist der Token **keine echte Zugriffssperre** – er blendet nur die Oberfläche für andere Daten aus, während technisch alle Daten weiterhin im selben, ungeschützten Objekt liegen. Für einen Link, der an externe Personen rausgeht, braucht es die echte Abgrenzung aus der Datenbank (Row-Level-Security), nicht nur UI-Filterung.
- **Nach dem Supabase-Deploy:** `guest_tokens`-Tabelle anlegen (`token`, `dj_name`), RLS-Policy so einschränken, dass ein Request mit Gast-Token *ausschließlich* Zeilen mit passendem `dj_name` lesen darf (kein `select *`, kein Zugriff auf `drivers`-Telefonnummern/E-Mails, keine anderen Fahrten). Erst dann ist der Link auch bei absichtlichem Herumprobieren sicher, nicht nur bei normaler Nutzung.
- Aktionen des Gastes (Confirm pickup, I am at pickup, Problem melden) schreiben ausschließlich Flags/Log-Einträge (`guestConfirmedAt`, `guestAtPickupAt`, `issues[]`) – nie Status oder Fahrer-Zuteilung. Dieselbe Absicherung wie beim Stage-Manager-Modus.
- Zentrale „Shuttle-Coordination"-Nummer statt privater Fahrer-Nummer (Einstellungen → Gast-/Artist-Links), damit keine persönlichen Telefonnummern über den Gast-Link kursieren.

## Fahrer-Benachrichtigungen

**Stufe 1 – Vordergrund (funktioniert sofort, auch im Artifact):** Die Fahrer-App erkennt bei jedem Datenabgleich Änderungen an den eigenen Fahrten und zeigt eine Toast-Meldung + Vibration + Ton: neue Zuteilung, geänderte Zeit/Route/Treffpunkt, Flug jetzt verspätet/gelandet/annulliert, neues Problem gemeldet, Gast hat bestätigt / ist am Treffpunkt, Fahrt umverteilt. Kein Spam beim ersten Laden — nur echte Änderungen gegenüber dem zuletzt gesehenen Stand. Läuft nur, solange die App-Seite offen ist.

**Stufe 2 – echte Push-Benachrichtigung (jetzt vorbereitet, braucht Deploy):** Kommt auch bei gesperrtem Handy/geschlossener App an. Dafür sind jetzt vorbereitet:
- **`sw.js`** (Service Worker) — zeigt die System-Benachrichtigung, öffnet die App beim Antippen.
- **`usePushNotifications`** in `shuttle-leitstelle.jsx` — Fahrer aktiviert per Klick (Button neben der Standort-Freigabe im Kopfbereich), fragt Browser-Berechtigung ab, registriert den Service Worker, abonniert Push, speichert das Abo in `driverState[driverId].pushSubscription`.
- **`api/send-push.js`** — verschickt den eigentlichen Push über die `web-push`-Bibliothek (VAPID-Standard). Wird an sieben Stellen ausgelöst: neue Zuteilung, Zeit/Route/Treffpunkt geändert, Flugstatus jetzt kritisch (manuell oder automatisch), sowie die drei Gast-Aktionen (Confirm pickup, I am at pickup, Problem melden).
- `driver_state` hat jetzt `push_subscription jsonb`; `supabaseStore.js` hat `setDriverPushSubscription()`.

**Einrichtung (zusätzlich zu Schritt 1–5 oben):**
1. `npm install web-push` im Projekt (für `api/send-push.js`).
2. Einmalig Schlüsselpaar erzeugen: `npx web-push generate-vapid-keys`.
3. `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` als Env-Variablen bei Vercel setzen (siehe `.env.example`) — der private Key darf **nie** ins Frontend.
4. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` als Env-Variablen setzen (für `api/send-push.js` — braucht direkten DB-Zugriff, nicht den anon-Key).
5. `sw.js` in den `public/`-Ordner des Frontend-Projekts legen, damit es unter `/sw.js` erreichbar ist.
6. Den **öffentlichen** VAPID-Key zusätzlich in der App eintragen: Einstellungen → „Echte Push-Benachrichtigungen".
7. Jeder Fahrer tippt einmal auf „Push-Benachrichtigungen aktivieren" im Kopfbereich seiner App und erlaubt die Browser-Abfrage.

Ohne diese Einrichtung bleibt automatisch alles bei Stufe 1 (Vordergrund) — nichts bricht, es kommt nur keine echte Push-Benachrichtigung an. Das ist auch der Zustand im Chat-Artifact hier.

## Chat-Assistent (neu)
Im Chat-Artifact ruft der Chat-Assistent `api.anthropic.com` direkt aus dem Browser auf — Claude stellt den Schlüssel dort automatisch bereit. Nach dem Deploy funktioniert dieser direkte Aufruf **nicht** mehr (kein Schlüssel, Browser dürfen die Anthropic-API ohnehin nicht direkt aufrufen). Dafür gibt es jetzt `api/chat.js`, das denselben Zweck serverseitig übernimmt.

1. Einen eigenen API-Key auf console.anthropic.com anlegen
2. `ANTHROPIC_API_KEY` als Env-Variable bei Vercel setzen (siehe `.env.example`) — **nie** ins Frontend
3. Fertig — die App erkennt automatisch (an der vorhandenen Supabase-Verbindung), dass sie im echten Deployment läuft, und nutzt dann `api/chat.js` statt des direkten Aufrufs. Kein Unterschied in der Bedienung für die Leitstelle.

Ohne gesetzten Key liefert der Chat-Assistent einen Fehler ("nicht verfügbar") statt einer Antwort — bricht sonst aber nichts an der App.

## PWA / Home‑Screen (Punkt 17)
Braucht echtes Hosting (nicht im Artifact möglich): `manifest.webmanifest` + „Zum Homescreen hinzufügen"-Unterstützung (z. B. `vite-plugin-pwa`). Der Service Worker für Push (`sw.js`) ist oben schon beschrieben; für eine vollwertige installierbare PWA (Icon auf dem Homescreen, Standalone-Fenster) zusätzlich ein `manifest.webmanifest` mit Icons/Namen ergänzen.

## Ehrliche Einordnung
Die Artifact‑Version ist voll funktionsfähig zum Planen und Demonstrieren. Für den Festival‑Livebetrieb mit 20 Handys ist der Supabase‑Weg oben der richtige – der Umbau ist dank der gekapselten Datenschicht überschaubar, sollte aber vor dem Event einmal echt getestet werden.
