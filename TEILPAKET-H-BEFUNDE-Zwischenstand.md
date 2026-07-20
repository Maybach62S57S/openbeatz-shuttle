# Teilpaket H - Zwischenstand (Chat 1: Inventur + Client-Nebenlaeufigkeits-Tests)

**Datum:** 20.07.2026. Basis: `b1c6bf3` (HEAD==origin/main), Code-Commit `65a50ca`.
Ruecksetzpunkt: Tag `pre-teilpaket-H` = `b1c6bf3` (gesetzt und gepusht).
Bestands-Regression vor Beginn komplett gruen. Hauptdatei 12703 Zeilen.

**Wichtige Vorab-Einordnung (Prämissen-Abgleich):** Teilpaket H nimmt als
Ausgangspunkt an, die zentrale Absicherung ("rev ist nicht atomar", atomare
RPCs, Setup-Transaktion, Patch-Whitelist, security definer) muesse erst gebaut
werden. Das trifft auf dieses Repo NICHT zu: der Supabase-Backend-Teil hat das
Meiste davon bereits. H wird deshalb als **Haertetest + Nachweis** gefahren,
nicht als Neubau. Keine Architekturmigration, kein DB-Umbau, rein additiv
(Testdateien + Doku). Fixes nur pro konkret gefundener kleiner Luecke, einzeln,
mit Freigabe. Kein blindes Durchbauen von H.

## Architektur-Realitaet (belegt)

- Die JSX-App importiert **kein** Supabase; sie laeuft im Artifact auf
  `window.storage` (`hasSupabase()` = `!!window.__obfSupabase`, im Artifact
  undefined). Der atomare CAS-Apparat greift nur nach echtem Deploy. Supabase
  ist laut Projektdoku "noch nicht live".
- Dual-Backend-Abstraktion: `sget`/`sset` (JSX Z. 391/423) routen bei
  `hasSupabase()` auf `sbGet*`/`sbSet*`, sonst window.storage (best-effort,
  bewusst "last write wins", da ohne Server kein CAS moeglich).
- Rides liegen als JSON-Array in **einem** `settings.dyn_data`-Blob, geschuetzt
  durch **eine** `dyn_rev` (schema Z. 242, 297). Kein Per-Ride-rev.

## Bereits vorhanden (H-Kern schon erfuellt, mit Beleg)

| H-Anforderung | Beleg |
|---|---|
| Serverseitiger atomarer rev-CAS | RPC `write_dyn_if_unchanged` / `write_setup_if_unchanged`: `UPDATE ... SET dyn_rev=p_expected_rev+1 WHERE id=1 AND dyn_rev=p_expected_rev`, bei 0 Zeilen `ok=false` + Serverstand zurueck (schema Z. 476-497, 503-523) |
| rev nur serverseitig erhoeht | RPCs Z. 375/447/487/516/589; Client sendet nur `p_expected_rev` |
| Atomare Setup-Transaktion (save_setup_bundle) | `write_setup_and_drivers_if_unchanged`: Setup+Fahrer in einer Transaktion, bei Fehler plpgsql-Rollback (schema Z. 572-613); ist der Client-Pfad beim Setup-Speichern |
| Patch-Whitelist, kein freies JSON-Overwrite | `assertKnownDynKeys(val)` + explizite RPC-Parameter (JSX Z. 315) |
| security definer + fester search_path | alle RPCs `security definer set search_path = public` |
| Strukturierte Fehler, kein console-Verschlucken | `{ ok, value, error }` durchgaengig, `friendlyError` (JSX Z. 1031-1065) |
| Kein blindes Ueberschreiben bei Konflikt | nach 6 Kollisionen kein Overwrite (JSX Z. 1050-1057, kommentiert) |
| Presence/GPS bumpt Ride-rev nicht | GPS ueber separate RPC `upsert_driver_location` (JSX Z. 336-347) |
| Doppelklick/Pending mit finally-Freigabe | `mitSperre` (JSX Z. 2821-2834); `doAssign` `assigning`-Guard (Z. 4199-4220) |
| Konflikthinweis vor Ride-Bearbeitung | `onSave` `updatedAt`-Vergleich + "wer hat was geaendert" (Z. 12099-12105) |
| Editieren clobbert Status/Fahrer/Issues nicht | Feld-Whitelist im onSave (`const { status, assignedDriverId, issues, ... } = data; Object.assign(r, safeData)`, Z. 12122-12123) |
| Stabile Client-Ride-ID (Idempotenz Neuanlage) | `"r"+Date.now()+random` (Z. 12109) |

## Schreibweg-Inventur (34 updateDyn-Schreibwege, Ergebnis-Check)

Sicher (await + res.ok geprueft, Fehler sichtbar, Guard vorhanden):
AssignModal `doAssign`/`onAssign`, RideForm `onSave`/`onDelete`, Fahrer-App
`advance`/`goBack` (via mitSperre), Flug `applyResult` (Ergebnis in updateOne/
updateAll geprueft), Nachrichten/Push-Abo (2553/2600/2685), Undo,
Chat-Assistent-Aktionen (3974/3989/4004/4010), Issue-Toggle (11767, res.ok).

Best-effort BEWUSST korrekt (Presence, kein kritisches Ride-Feld):
GPS-Ping (2487) - im Supabase-Pfad ohne dyn_rev-Beruehrung.

## GEFUNDENE SCHWACHSTELLEN (nicht gefixt - Freeze/Freigabe-Regel)

### Klasse: stiller Fehlschlag bei kritischer Nutzeraktion (fire-and-forget)
Diese Wege gehen durch den sicheren CAS-Kern (kein Datenverlust, kein
Blind-Overwrite), pruefen aber das Ergebnis NICHT und zeigen bei Fehlschlag
KEINE Meldung - stattdessen wird eine Push-Benachrichtigung gesendet und die UI
weitergeschaltet, als waere gespeichert. Widerspricht H 11/18/31.

1. **KRITISCH - One-Tap-Zuweisung** `quickAssign` (Z. 9725-9738): kein `await`,
   kein `res.ok`, `triggerPush` + `setSelectedId(null)` unabhaengig vom Erfolg.
   Kein logischer Doppelklick-Guard. Vergleich: AssignModal macht es korrekt.
2. **KRITISCH - Drag-and-Drop** `applyDrop` (Z. 9761-9781): Zeit-/Fahrerwechsel,
   selbes fire-and-forget, Push unabhaengig vom Erfolg, kein sichtbarer Fehler.
3. **MITTEL - Stage-Manager-Problemmeldung** `reportIssue` (Z. 3280-3293):
   fire-and-forget; H 29 verlangt "Fehler anzeigen". Append-only (kein Clobber),
   aber stiller Fehlschlag moeglich.
4. **MITTEL/NIEDRIG - Gast-Aktionen** reportIssue/confirmPickup/atPickup
   (3613/3635/3652): selbe Klasse; niederfrequent, Einzelnutzer; nach Deploy
   ueber dedizierte guest_*-RPCs.
5. **NIEDRIG - Dev "alle Fahrten loeschen"** (11203): Entwickler-/Settings-Werkzeug
   mit confirm, aber fire-and-forget.

**Empfohlener minimaler Fix (nur nach Freigabe, pro Weg einzeln):** `quickAssign`
und `applyDrop` `async` machen, Ergebnis `await`en, bei `!res.ok` eine sichtbare
Meldung ueber den bereits vorhandenen Fehlerkanal der Komponente zeigen und den
`triggerPush` erst nach Erfolg ausloesen. Rein additiv, keine Logikaenderung an
der Zuweisung selbst. Fuer 3 (Stage) analog. Das schliesst die "stille
Falschmeldung"-Luecke, ohne den Zuweisungs-/Statuspfad anzufassen.

## Architektur-Notizen (NICHT unter Freeze aenderbar)

- Grobkoerniges einzelnes `dyn_rev` fuer den ganzen Rides-Blob (kein Per-Ride-rev).
  Zwei Dispatcher an VERSCHIEDENEN Fahrten kollidieren trotzdem auf `dyn_rev`,
  werden aber sauber per Retry auf frischem Stand aufgeloest -> KEIN Datenverlust,
  nur Wiederholung. Per-Ride-rev waere eine Architekturmigration (Rides-Blob ->
  Rides-Zeilen), von H selbst untersagt -> Post-Festival.
- Edit-Konflikthinweis nutzt Client-`updatedAt` (H 21 bevorzugt rev). Ist aber nur
  ein UX-Hinweis, abgesichert durch CAS + Feld-Whitelist -> keine Datensicherheits-
  Abhaengigkeit. Minor.

## In diesem Chat geliefert

- Tag `pre-teilpaket-H` gesetzt + gepusht.
- Vollstaendige Schreibweg-Inventur + Risikoklassifizierung (oben).
- `smoke-teilpaket-h-concurrency.mjs`: 21 OK, 0 FAIL. Beweist am zeilengetreu
  aus der Quelle replizierten updateDyn-CAS-Kern: kein verlorenes Update (T2),
  kein blindes Ueberschreiben (T3), Rueckgabeform-Kontrakt (T1/T4),
  mitSperre-Doppelklick-Guard (T5). 3 Gegenproben (Schutz raus -> Test bricht)
  bestaetigen, dass die Tests wirklich messen.

## Naechster Chat (geplant)

- SQL-RPC-Verifikation: statische Invarianten (`write_dyn_if_unchanged` /
  `write_setup_and_drivers_if_unchanged`: CAS-Bedingung, serverseitige
  rev-Erhoehung, security definer + search_path, Whitelist, Rollback) + Gegenproben.
- Versuch: lokales Postgres hochziehen, RPCs echt parallel fahren (Goldstandard).
  Wenn zu schwer/zu lang -> statisch + Vermerk.
- Realtime-/Poll-Apply-Pfad pruefen (H 19): wird beim 3s-Poll eine aeltere rev
  ueber eine neuere lokale gelegt? `shouldApplyServerRide`-Logik vorhanden?
- Voll-Doku: TEILPAKET-H-BERICHT / -ABNAHME / -MIGRATION (aus diesem Zwischenstand).
- Entscheidung Jordan: die 3 fire-and-forget-Fixes (One-Tap, Drag-and-Drop,
  Stage) umsetzen? Jeweils mit Verdrahtungsplan + Freigabe.
