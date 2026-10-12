// Vercel serverless: GET /api/health
export default function handler(req, res) {
  res.status(200).json({ status: true, site: "generator.email", dev: "Van313 | Official" });
}
