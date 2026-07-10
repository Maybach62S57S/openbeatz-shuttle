# Open Beatz Shuttle-Leitstelle – Projekt-Kontext

VIP-Shuttle-Dispositions-App für das Open Beatz Festival (Juli 2026, Herzogenaurach bei Nürnberg). Läuft produktiv auf Vercel + Supabase (nicht mehr nur Chat-Artifact-Stand). Jordan (Betreiber) organisiert die Fahrten für Artists/Manager mit 20 Fahrern.

## Übergabe-Stand für einen neuen Chat (10.07.2026, Ende dieser Sitzung)
Diese Sitzung ist sehr lang geworden, ab hier bitte in einem neuen Chat weiter (selbes Projekt, Doku ist aktuell).
- **Läuft und ist bestätigt getestet:** Sicherheits-Härtung (Nachtrag 3), echte Push-Benachrichtigungen (Fahrer + Leitstelle), mobile Leitstellen-Ansicht, Timeline mit Zoom, Fahrer-Zurück-Button bei Statuskorrektur.
- **Drei Team-Anleitungen erstellt** (`.docx`, Stand 10.07.2026, an Jordan übergeben): Leitstelle, Fahrer, Stage Manager — bei größeren UI-Änderungen daran denken, dass diese ggf. veralten.
- **Noch offen, vor dem Event angehen:** `verify_driver_pin`-RPC (Fahrer-PINs/Telefonnummern derzeit noch über anon-Key auslesbar, siehe Abschnitt weiter unten), echter Fahrer-Testdurchlauf gegen die Produktivdatenbank, Stammdaten (Fahrer/Orte/Matrix) final einspielen, Test mit mehreren gleichzeitigen Dispo-Nutzern.
- **Wichtigste Datei:** `src/ShuttleLeitstelle.jsx` (~6.300 Zeilen, wächst weiter) — immer zuerst laden/durchsuchen, bevor etwas Neues gebaut wird, um Konventionen und bestehende Features nicht zu duplizieren. `supabaseStore.js` ist weiterhin unbenutzt/veraltet, nicht referenzieren.
- **Arbeitsweise, die sich bewährt hat:** vor jeder Änderung kurz die betroffene Stelle im Code suchen und lesen (nicht aus dem Gedächtnis annehmen), nach jeder Änderung esbuild + Duplikat-Check + eigenständiger Node-Test für neue reine Logik, ausführliche Commit-Nachrichten (dienen als Langzeit-Doku).

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
13-Punkte-PDF komplett, Live-GPS-Projektion auf Schemakarte, Leitstellen-Nutzer mit Namen, Artist-/Manager-Gast-Link-Modus, Web-Push-Infrastruktur (vorbereitet, nicht live testbar im Artifact), große interaktive Timeline-Seite mit Drag-and-Drop/Lücken-Hervorhebung/Jetzt-Linie, globale Rückgängig-Funktion (bis zu 15 Schritte, Button im Dashboard-Header), Chat-Assistent mit Bestätigen-Button (Anthropic API im Artifact, `claude-sonnet-4-6`, `max_tokens: 1000`), Security-Nachtrag 3 (10.07.2026): echtes Compare-and-Swap statt Lost-Update-Risiko, Gast-Link nach Supabase-Deploy RPC-isoliert statt nur UI-gefiltert, guest_tokens/settings/drivers-Schreibzugriff nur noch über geprüfte Funktionen, Origin-/Secret-/Rate-Limit-Schutz für api/chat.js + api/send-push.js.

Timeline-Drag-and-Drop hat seit der letzten Überarbeitung eine Bestätigung: Loslassen wendet nichts sofort an, sondern zeigt einen kleinen, nicht blockierenden Hinweis direkt an der Zielposition mit "Abbrechen"/"Verschieben" (Klick daneben oder Escape = Abbrechen). Nach dem Bestätigen erscheint zusätzlich kurz (8 Sekunden) ein "Rückgängig"-Hinweis direkt an der Fahrt, der die globale Rückgängig-Funktion auslöst — das ist die gleiche Funktion wie der Header-Button, kein separater Verlauf.

## Bekannte Grenzen (im Chat-Artifact, nicht nach Deploy)
GPS-Hintergrund-Tracking, echte Push-Benachrichtigungen und der Chat-Assistent brauchen ein echtes Deployment (HTTPS, eigener Server) — im Artifact selbst nur bedingt/gar nicht testbar, aber vollständig code-fertig und dokumentiert in den jeweiligen README-Dateien.

## Offener Punkt aus dem Security-Review (bewusst zurückgestellt, nicht vergessen)
Fahrer-PINs und -Telefonnummern sind nach dem Supabase-Deploy über den anon-Key technisch weiterhin auslesbar (`select * from drivers`), weil Login/PIN-Prüfung komplett clientseitig läuft und es keine serverseitige Rollen-Unterscheidung gibt (siehe BACKEND-README, Abschnitt „Ehrliche Einordnung"). Sauberer nächster Schritt: eine `verify_driver_pin(driver_id, pin)`-RPC, die nur ja/nein zurückgibt statt die PINs auszuliefern, plus Login-Formular darauf umstellen. Auf Jordans Wunsch bewusst nicht Teil des Nachtrag-3-Umbaus, sollte aber vor dem Event noch angegangen werden.

## Push-Benachrichtigungen: bestätigt funktionsfähig (10.07.2026)
Kompletter Weg getestet und bestätigt: Fahrer-Push (Zuteilung bei gesperrtem Handy) UND Leitstellen-Push (Problem gemeldet) kommen beide an. Zwei echte Bugs dabei gefunden und behoben (siehe Git-Historie): `api/send-push.js` suchte Abos am falschen Ort (tote `driver_state`-Tabelle statt `dyn_data`), und `sset()` hat echte Speicherfehler wie normale Konflikte behandelt (stilles Wiederholen statt Fehler zu zeigen).

**Stolperfalle beim Einrichten, falls das Projekt je neu aufgesetzt wird:** `SUPABASE_URL` (für `api/send-push.js`, Service-Role-Zugriff) ist NICHT dieselbe Seite wie die REST-API-URL unter „Integrations → Data API" (die hat `/rest/v1/` am Ende dran, führt zu `PGRST125: Invalid path specified`). Die richtige, reine Projekt-URL (`https://xxx.supabase.co` ohne Zusatz) findet sich zuverlässig über den **„Connect"-Button** oben in Supabase → Framework/Server-Tab → Feld `NEXT_PUBLIC_SUPABASE_URL` bzw. `SUPABASE_URL` in den Codebeispielen. Außerdem: Supabase hat neue Key-Typen (`sb_publishable_...`/`sb_secret_...`), unser Code erwartet aber weiterhin den klassischen `service_role`-Key (JWT, beginnt mit `eyJ...`) aus dem Reiter „Legacy anon, service_role API keys" unter Settings → API Keys, nicht den neuen „Secret key".

## Mobile Leitstellen-Ansicht: umgesetzt (10.07.2026)
Automatisch aktiv bei schmalem Bildschirm (<768px), jederzeit manuell umschaltbar (Symbol im Header, Präferenz pro Gerät gemerkt). Vier Reiter: Fahrten (Suche/Filter/Zuteilen), Timeline (eigene vertikale Ansicht statt Desktop-Drag-and-Drop), Karte (nutzt die bestehende, ohnehin responsive SchematicMap direkt weiter), Rückfahrten. Chat-Assistent per FAB, dieselbe ChatPanel-Komponente wie am Desktop. Kein eigener Datenpfad — alles läuft über dieselben Funktionen (AssignModal, buildMapNodes/computeMapPositions, logRide/setRideStatus/triggerPush) wie das Desktop-Dashboard. Bekannter, dokumentierter Randfall: eine Fahrt exakt um 06:00:00 landet in der Mobil-Timeline am oberen statt unteren Rand (sortMin-Grenze), bei Festival-Fahrzeiten praktisch irrelevant.
