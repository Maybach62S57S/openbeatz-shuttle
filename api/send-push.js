// ============================================================================
// /api/send-push — verschickt eine Web-Push-Benachrichtigung an einen Fahrer
// ODER an alle Leitstellen-Nutzer mit aktiviertem Push (Nachtrag 4).
// Läuft SERVERSEITIG (VAPID-Private-Key darf niemals ins Frontend).
//
// Aufruf aus der App:
//   POST /api/send-push  { driverId, title, body, tag? }              -> ein Fahrer
//   POST /api/send-push  { broadcastToDispatchers: true, title, ... } -> alle Dispo-Nutzer mit Abo
//
// WICHTIG (Nachtrag 4, Bugfix): Push-Abos liegen NICHT in der separaten
// driver_state-Tabelle (die beschreibt die App nirgends), sondern wie die
// Fahrten selbst in settings.dyn_data — driverState[id].pushSubscription
// bzw. dispatcherState[id].pushSubscription. Vorher suchte diese Funktion
// am falschen Ort, echte Push-Benachrichtigungen hätten dadurch nie
// funktioniert, unabhängig von allen anderen Einstellungen.
//
// Setup: `npm install web-push` im Projekt, VAPID-Schlüsselpaar einmalig
// erzeugen (siehe FLIGHT-README/BACKEND-README), als Env-Variablen setzen.
//
// Sicherheitshinweis (Nachtrag 3, Security-Review): diese Funktion nutzt den
// Supabase-Service-Role-Key (umgeht RLS komplett) und akzeptiert Titel/Text
// frei vom Aufrufer. War vorher völlig offen — jeder mit der URL konnte
// einem (erratbaren) Fahrer eine frei erfundene Push-Nachricht schicken,
// ein Social-Engineering-Risiko auf echten Fahrer-Handys. Dieselben drei
// Checks wie bei /api/chat (Origin, optionales Shared-Secret, Rate-Limit)
// — kein vollwertiges Auth, aber verhindert automatisiertes/wildes
// Fremdnutzen. Details: BACKEND-README.md.
// ============================================================================
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@merg-and-more.ch";

const ALLOWED_ORIGINS = (process.env.ALLOWED_APP_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
function checkOrigin(req) {
  if (!ALLOWED_ORIGINS.length) return true; // nicht konfiguriert -> Check übersprungen, siehe .env.example
  const origin = req.headers.origin || req.headers.referer || "";
  return ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
}
function checkSecret(req) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) return true; // nicht konfiguriert -> Check übersprungen, siehe .env.example
  return req.headers["x-app-secret"] === expected;
}
// Best-Effort, siehe ausführlicher Hinweis in api/chat.js.
const rateMap = new Map();
function allowRate(req, limit = 30, windowMs = 60000) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length <= limit;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST erwartet" });
  if (!checkOrigin(req)) return res.status(403).json({ error: "Ungültiger Origin" });
  if (!checkSecret(req)) return res.status(401).json({ error: "Nicht autorisiert" });
  if (!allowRate(req)) return res.status(429).json({ error: "Zu viele Anfragen, bitte kurz warten" });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return res.status(500).json({ error: "VAPID-Keys nicht gesetzt" });

  const { driverId, broadcastToDispatchers, title, body, tag, url } = req.body || {};
  if (!title) return res.status(400).json({ error: "title erforderlich" });
  if (!driverId && !broadcastToDispatchers) return res.status(400).json({ error: "driverId oder broadcastToDispatchers erforderlich" });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const payload = JSON.stringify({ title, body: body || "", tag: tag || "shuttle-update", url: url || "/" });

  const { data: row, error: readError } = await supabase.from("settings").select("dyn_data").eq("id", 1).single();
  if (readError || !row) return res.status(502).json({ error: "Konnte Push-Abos nicht laden", detail: readError ? { message: readError.message, code: readError.code, hint: readError.hint } : "keine Zeile gefunden" });
  const dynData = row.dyn_data || {};

  const send = async (role, id, sub) => {
    if (!sub) return { id, ok: false, reason: "kein Push-Abo" };
    try {
      await webpush.sendNotification(sub, payload);
      return { id, ok: true };
    } catch (e) {
      // Abo abgelaufen/widerrufen (410 Gone bzw. 404) -> aufräumen, damit nicht ständig fehlschlägt
      if (e.statusCode === 410 || e.statusCode === 404) {
        try { await supabase.rpc("clear_push_subscription", { p_role: role, p_id: id }); } catch {}
        return { id, ok: false, reason: "Abo abgelaufen, entfernt" };
      }
      return { id, ok: false, reason: String(e.message || e) };
    }
  };

  try {
    if (driverId) {
      const sub = dynData.driverState?.[driverId]?.pushSubscription;
      const result = await send("driver", driverId, sub);
      return res.status(200).json(result);
    }

    // broadcastToDispatchers: an ALLE Leitstellen-Nutzer mit aktivem Abo
    const dispatcherState = dynData.dispatcherState || {};
    const targets = Object.keys(dispatcherState).filter((id) => dispatcherState[id]?.pushSubscription);
    if (targets.length === 0) return res.status(200).json({ ok: false, reason: "keine Leitstellen-Nutzer mit Push-Abo", sent: 0, total: 0 });
    const results = await Promise.all(targets.map((id) => send("dispatcher", id, dispatcherState[id].pushSubscription)));
    const sent = results.filter((r) => r.ok).length;
    return res.status(200).json({ ok: sent > 0, sent, total: targets.length, results });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
