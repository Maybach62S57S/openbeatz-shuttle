# Open Beatz Shuttle-Leitstelle – Projekt-Kontext

VIP-Shuttle-Dispositions-App für das Open Beatz Festival (23.–27. Juli 2026, Herzogenaurach bei Nürnberg). Single-File React-Artifact + Backend-Vorbereitung für den echten Deploy. Jordan (Betreiber) organisiert die Fahrten für Artists/Manager mit 20 Fahrern (6 Mercedes V-Klasse, 14 Luxus-SUV).

## Wichtigste Datei
`shuttle-leitstelle.jsx` — die komplette App, ein einziges React-Artifact (~5.300 Zeilen). Immer diese Datei laden/lesen, bevor du etwas Neues baust, um Konventionen und bereits gebaute Features nicht zu duplizieren.

Begleitdateien (Backend-Vorbereitung fürs echte Deployment, noch nicht live):
- `supabase-schema.sql`, `supabaseStore.js`, `BACKEND-README.md` — Supabase-Backend (Realtime, atomare RPCs, RLS)
- `api/flight.js`, `FLIGHT-README.md` — Flug-Live-Tracking (AeroDataBox)
- `sw.js`, `api/send-push.js` — echte Push-Benachrichtigungen (Web Push/VAPID)
- `.env.example` — alle benötigten Umgebungsvariablen fürs Deployment
- `Shuttle-Leitstelle-Kurzanleitung.docx` — Team-Bedienungsanleitung

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
