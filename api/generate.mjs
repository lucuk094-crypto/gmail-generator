// Vercel serverless: POST /api/generate
import { apiGenerate, Fail } from "../lib/scraper.mjs";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ status: false, code: 405, message: "gunakan POST" });
    let body = {};
    if (req.body && typeof req.body === "object") body = req.body;
    else if (typeof req.body === "string") { try { body = JSON.parse(req.body || "{}"); } catch {} }
    const r = await apiGenerate(body.user || "", body.domain || "");
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: true, ...r });
  } catch (e) {
    const code = e instanceof Fail ? e.code || 500 : 500;
    return res.status(code >= 400 && code < 600 ? code : 500).json({ status: false, code, message: e.message || String(e) });
  }
}
