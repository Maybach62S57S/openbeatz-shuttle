// ============================================================================
// /api/chat  —  Serverless Chat-Endpoint für den Chat-Assistenten (Vercel)
// Läuft SERVERSEITIG, damit der Anthropic-API-Key nicht ins Frontend gelangt
// (Browser dürfen api.anthropic.com ohnehin nicht direkt aufrufen).
// Aufruf aus der App: POST /api/chat  { system, messages }
// Antwort: { reply, action } — identisch zum bisherigen Rückgabeformat.
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Nur POST erlaubt" });

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
