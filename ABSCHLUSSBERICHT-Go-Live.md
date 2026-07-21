# Abschlussbericht Go-Live-Freigabe: Open Beatz Shuttle-Leitstelle

Festival: 23.-27. Juli 2026, Herzogenaurach. Stand: Abschluss der Go-Live-Freigabesession.
Bezieht sich auf `src/ShuttleLeitstelle.jsx` (13282 Zeilen, unveraendert seit Block L / Commit 50467ee).

---

## 1. Entscheidung: GO MIT RESTRISIKEN

Der Code ist aus meiner Sicht freigabefaehig fuer den Festivalbetrieb, unter den in Abschnitt 4
gelisteten, bekannten Restrisiken. Diese sind entweder rein betrieblich/deploymentseitig (nur im echten
Betrieb verifizierbar) oder kleine, dokumentierte Detailpunkte ohne Funktionsbruch. Kein Punkt ist ein
Show-Stopper, aber der Live-Betrieb muss mit dem manuellen Nach-Deploy-Abnahmetest (Abschnitt 3) starten
und die Rueckfallebene aus dem Betriebshandbuch bereithalten.

Kein reines "GO", weil zwei Dinge grundsaetzlich nicht von hier aus beweisbar sind: das echte
Realtime-Fanout auf ~25 Geraete am Gelaende und das Verhalten bei einem echten Supabase-Ausfall.
Kein "NO-GO", weil die stabilitaets-, integritaets- und sicherheitskritischen Kernwege (kein verlorenes
Update, atomare Appends, Rollen-Schreibgrenzen, Transaktions-Rollback) hart bewiesen sind, teils gegen
eine echte Postgres-Instanz.

Prioritaetenreihenfolge wie vereinbart eingehalten: 1. Stabilitaet 2. Datenintegritaet 3. Sicherheit
4. Wartbarkeit 5. Performance.

---

## 2. Was in dieser Freigabesession verifiziert wurde (mit echten Zahlen)

**Bestands-Regression (Schritt 0 und final):**
- esbuild gruen, keine doppelten Funktionsnamen (`[a-zA-Z0-9_]+`-Grep).
- Standard-Regression: **45/45 Dateien gruen** (43 bestehende + neu `smoke-teilpaket-g-last.mjs` + `smoke-final-live-readiness.mjs`).
- `rendertest.mjs`: 5 Referenzwerte konstant (App-Root 25053, IssueModal 2452, StageIssueModal 2413, GuestIssueModal 2895, Field ohne mc 101).
- `kontrast.mjs`: 0 WCAG-Failures.
- `gegenprobe-teilpaket-h-rpc-postgres.mjs` ist bewusst NICHT Teil der Standard-Regression (braucht echte Postgres).

**Block G - Mehrbenutzer-/Lastsimulation (`smoke-teilpaket-g-last.mjs`, additiv):**
- 400 gemischte Ops gleichzeitig (20 Fahrer + 2 Leitstellen + 3 Stage + 6 Gaeste), deterministische
  Contention (Batch-Barriere, nicht timing-/wanduhr-abhaengig -> nicht flaky). 27/27 gruen.
- Bewiesene Invarianten unter Last: kein verlorenes Update, atomare Appends vollzaehlig
  (issues/log/statusHistory), rev monoton == erfolgreiche Schreiber, Rollen-Schreibgrenzen (Stage/Gast
  fassen nie Status/Zuteilung an), Push genau einmal, Statuswege nur vorwaerts.
- CAS-Kern + Helfer zeilengetreu aus der Quelle, Drift-Check verankert. Zwei Pflicht-Gegenproben greifen.

**Block G, Teil 2 - echte Postgres-RPC-Haertung (real gefahren):**
- Lokale PostgreSQL 16 hochgezogen, `supabase-schema.sql` unveraendert und fehlerfrei/idempotent
  eingespielt, `gegenprobe-teilpaket-h-rpc-postgres.mjs` ueber echte TCP-Verbindung: **20/20 gruen**.
- Beweist die Deploy-Seite: 20 Parallelschreiber -> genau einer gewinnt/kein Mischzustand; 20 mit Retry
  -> alle drin/keine Doppelten; Constraint-Verletzung -> Transaktions-Rollback (kein Teilzustand).
  Pflicht-Gegenprobe: naiver read-check-write ohne CAS verliert Updates (2 von 20).

**Finale Live-Readiness-Suite (`smoke-final-live-readiness.mjs`, additiv):**
- 45 Pruefpunkte gruen (>= 20 gefordert): Readiness-Anker am echten Quelltext UND ausgefuehrte Logik,
  plus 5 Pflicht-Gegenproben. Deckt CAS/Appends/Serialisierung (G/H), Rev-Monotonie/ConnIssueBanner/
  justReconnected (E), friendlyError/Fallback (D), Error-Boundary ohne Datenschreiben (I), Artist-Text
  ohne private Nummer (L), Gast-Flags/RPC, Doppelklick-Guard, Undo-UNDO_STALE, hasSupabase-Weiche,
  Maps-Fallback, Orte-Fix, Schema-Grants ab.

**Deployment/Betrieb dokumentiert:**
- `DEPLOYMENT-ROLLBACK.md`: Env-Checkliste, Supabase-Deploy-Reihenfolge, Vercel-Deploy, Rollback-Wege.
- `GO_LIVE_OPENBEATZ_2026.md`: Betriebshandbuch inkl. Stoerungs-Playbook und Nach-Deploy-Smoke.

---

## 3. Manueller Mehrrollen-Abnahmetest

**Ehrliche Kennzeichnung: NICHT von hier durchgefuehrt.** Ein echter Test mit mehreren Geraeten gegen die
Live-Supabase-Instanz ist aus der Build-Umgebung nicht moeglich (kein echtes Deployment, keine echten
Handys). Die vollstaendige Anleitung dafuer steht als **Nach-Deploy-Smoke** in `GO_LIVE_OPENBEATZ_2026.md`
(Abschnitt 5 dort) bzw. `DEPLOYMENT-ROLLBACK.md`. Sie ist VOR dem Festival mit mindestens zwei Geraeten
zwingend durchzufuehren. Kurzfassung der Pflichtpunkte:

1. Produktivmodus aktiv (`window.__obfSupabase` gesetzt).
2. Leitstelle legt Fahrt an, teilt zu -> erscheint beim Fahrer OHNE Reload (Realtime).
3. Statuswechsel Fahrer -> erscheint bei Leitstelle ohne Reload.
4. Fast gleichzeitige Aenderung an derselben Fahrt auf zwei Geraeten -> beide bleiben, kein Fehler.
5. Stage: nur Problem melden, kein Status/Fahrer.
6. Gast-Link: nur eigene Fahrten, keine privaten Fahrer-Nummern.
7. Flug (falls Key): echte Daten statt Fallback.

Erst wenn 1-6 sauber sind, ist der Live-Betrieb operativ freigegeben. Die programmatisch beweisbaren
Anteile dieser Punkte (Nebenlaeufigkeit, Rollen-Schreibgrenzen, Fallbacks) sind in den Suiten oben bereits
gruen; offen bleibt allein das reale Geraete-/Netzverhalten.

---

## 4. Offene Restrisiken (vollstaendig gesammelt)

Reihenfolge = grobe Absteigung nach operativer Relevanz. Detailkontext zu den Block-Punkten steht in den
Uebergaben Teil 1-3 (`UEBERGABE-Session-18.md`).

1. **Live-Realtime-Fanout auf ~25 Geraete** (betrieblich): nur im echten Betrieb verifizierbar.
   Mitigation: Nach-Deploy-Smoke (Abschnitt 3), zwei Leitstellen-Geraete als Redundanz.
2. **Supabase-Ausfall = kein weicher Multi-Geraete-Fallback** (betrieblich): der `window.storage`-Modus
   synchronisiert nicht zwischen Geraeten. Mitigation: Telefon-/Zettel-Rueckfallebene im Betriebshandbuch,
   vor dem Festival einmal durchsprechen.
3. **Gast-Idempotenz-SQL nicht umgesetzt** (Datenintegritaet, klein): die zusaetzliche
   Idempotenz-Absicherung fuer Gast-Aktionen auf DB-Ebene wurde identifiziert, aber bewusst nicht mehr
   umgesetzt. Client-seitig sind die Gast-Aktionen bereits gegen Doppelklick/Ueberlappung gehaertet
   (`smoke-guest-rpc-hardening.mjs` gruen). Nachruestbar als SQL-Nachtrag.
4. **Block-C Owner-Guard + guest-notes** (dokumentiert): offener Detailpunkt aus Block C rund um den
   Owner-Guard und die Gast-Notizen. Kein Funktionsbruch im aktuellen Stand, als spaeterer Punkt notiert.
5. **Block-F Env-Fallback** (dokumentiert): Detail im Umgang mit fehlenden Umgebungsvariablen (Block F).
   Die optionalen Features fallen sauber zurueck; der Punkt ist eine Verfeinerung, kein Blocker.
6. **Block-E-Labeling** (kosmetisch/dokumentiert): ein Labeling-/Textdetail im Offline-/Reconnect-Block.
   Die Funktionslogik (Banner-Prioritaet, justReconnected, Rev-Monotonie) ist getestet und gruen.
7. **Block-J flashIds-Cleanup** (Wartbarkeit): ein Aufraeumpunkt an den flashIds aus Block J. Ohne
   Funktionswirkung, als spaeterer Wartungspunkt notiert.

Keiner dieser Punkte wurde in dieser Session gefixt (ausserhalb des jeweiligen Themas, gemaess Regel).
Sie sind hier bewusst zentral gesammelt, damit die GO-Entscheidung sie voll im Blick hat.

---

## 5. Weitere gefundene Punkte fuer spaetere Sessions

- Keine neuen, in dieser Session ausserhalb des Themas gefundenen Bugs. Die additiven Arbeiten (G/M/N +
  finale Suite) haben `src/ShuttleLeitstelle.jsx` nicht veraendert; die Zeilenzahl blieb bei 13282.

---

## 6. Empfehlung fuer den Festivalstart

1. Deploy nach `DEPLOYMENT-ROLLBACK.md`, danach den manuellen Nach-Deploy-Smoke (Abschnitt 3) mit zwei
   Geraeten fahren.
2. Betriebshandbuch beim Team, Eskalationsliste ausgefuellt, Rueckfallebene bei Supabase-Ausfall
   besprochen.
3. Restrisiken 3-7 als kurze Post-Festival-Liste fuehren; keiner blockiert den Start.
