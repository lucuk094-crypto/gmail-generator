// Vercel serverless: GET /api/inbox?email=...
import { apiInbox, Fail } from "../lib/scraper.mjs";

export default async function handler(req, res) {
  try {
    const box = await apiInbox(req.query.email || "");
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: true, ...box });
  } catch (e) {
    const code = e instanceof Fail ? e.code || 500 : 500;
    return res.status(code >= 400 && code < 600 ? code : 500).json({ status: false, code, message: e.message || String(e) });
  }
}
