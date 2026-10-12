// Vercel serverless: GET /api/message?email=...&id=...
import { apiMessage, Fail } from "../lib/scraper.mjs";

export default async function handler(req, res) {
  try {
    const id = req.query.id || "";
    if (!id) throw new Fail(400, "parameter id wajib");
    const msg = await apiMessage(req.query.email || "", id);
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: true, ...msg });
  } catch (e) {
    const code = e instanceof Fail ? e.code || 500 : 500;
    return res.status(code >= 400 && code < 600 ? code : 500).json({ status: false, code, message: e.message || String(e) });
  }
}
