// ============================================================================
// /api/chat  —  Serverless Chat-Endpoint für den Chat-Assistenten (Vercel)
// Läuft SERVERSEITIG, damit der Anthropic-API-Key nicht ins Frontend gelangt
// (Browser dürfen api.anthropic.com ohnehin nicht direkt aufrufen).
// Aufruf aus der App: POST /api/chat  { system, messages }
// Antwort: { reply, action } — identisch zum bisherigen Rückgabeformat.
//
// Sicherheitshinweis (Nachtrag 3, Security-Review): diese Funktion war
// vorher völlig offen — jeder, der die URL kennt, konnte den Anthropic-Key
// als kostenlosen Proxy nutzen. Die drei Checks unten (Origin, optionales
// Shared-Secret, einfaches Rate-Limit) sind KEIN vollwertiges Auth, dafür
// bräuchte es echte Nutzer-Logins, die es in dieser App bewusst noch nicht
// gibt. Sie verhindern aber automatisiertes/versehentliches Fremdnutzen,
// was der eigentlich relevante Fall ist (kein gezielter Angriff auf ein
// internes Dispo-Tool für ein Wochenend-Event). Details: BACKEND-README.md.
// ============================================================================
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
// Best-Effort, kein echter verteilter Rate-Limiter: der Zähler lebt nur so
// lange, wie diese Serverless-Instanz warm ist (Vercel kann jederzeit eine
// neue, leere Instanz starten). Reicht, um versehentliche Endlosschleifen
// oder simple Scripts abzufangen, nicht gegen einen gezielten Angriff.
const rateMap = new Map();
function allowRate(req, limit = 20, windowMs = 60000) {
  const ip = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").toString().split(",")[0].trim();
  const now = Date.now();
  const hits = (rateMap.get(ip) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  rateMap.set(ip, hits);
  return hits.length <= limit;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Nur POST erlaubt" });
  if (!checkOrigin(req)) return res.status(403).json({ error: "Ungültiger Origin" });
  if (!checkSecret(req)) return res.status(401).json({ error: "Nicht autorisiert" });
  if (!allowRate(req)) return res.status(429).json({ error: "Zu viele Anfragen, bitte kurz warten" });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY nicht gesetzt" });

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages fehlt" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: `Anthropic API ${r.status}`, detail });
    }
    const data = await r.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    const clean = text.replace(/^```json\s*|^```\s*|```\s*$/g, "").trim();
    try {
      const parsed = JSON.parse(clean);
      return res.status(200).json({ reply: String(parsed.reply || "").trim() || "(keine Antwort)", action: parsed.action || null });
    } catch {
      return res.status(200).json({ reply: text || "(keine Antwort)", action: null }); // Fallback: Rohtext statt Fehler
    }
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
