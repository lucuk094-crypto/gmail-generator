// Vercel serverless: GET /api/domains
import { listDomains, ensureWarm, Fail } from "../lib/scraper.mjs";

export default async function handler(req, res) {
  try {
    await ensureWarm();
    res.setHeader("cache-control", "no-store");
    return res.status(200).json({ status: true, domains: await listDomains() });
  } catch (e) {
    const code = e instanceof Fail ? e.code || 500 : 500;
    return res.status(code >= 400 && code < 600 ? code : 500).json({ status: false, code, message: e.message || String(e) });
  }
}
