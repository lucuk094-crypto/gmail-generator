#!/usr/bin/env node
// server.mjs — server lokal (pratinjau) website Generator.Email
// Untuk deploy Vercel gunakan folder api/ + vercel.json (lihat README.md)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Fail, apiGenerate, apiInbox, apiMessage, listDomains, ensureWarm } from "./lib/scraper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

function json(res, code, obj) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}

async function serveStatic(res, file) {
  const full = path.join(__dirname, file);
  const data = await readFile(full);
  res.writeHead(200, {
    "content-type": MIME[path.extname(full)] || "application/octet-stream",
    "cache-control": file === "/index.html" ? "no-cache" : "public, max-age=3600",
  });
  res.end(data);
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = u.pathname;

  try {
    if (p.startsWith("/api/")) {
      if (p === "/api/health") return json(res, 200, { status: true, site: "generator.email" });

      if (p === "/api/generate" && req.method === "POST") {
        let body = {};
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {}
        const r = await apiGenerate(body.user || "", body.domain || "");
        return json(res, 200, { status: true, ...r });
      }

      if (p === "/api/domains") {
        await ensureWarm();
        return json(res, 200, { status: true, domains: await listDomains() });
      }

      if (p === "/api/inbox") {
        const box = await apiInbox(u.searchParams.get("email") || "");
        return json(res, 200, { status: true, ...box });
      }

      if (p === "/api/message") {
        const id = u.searchParams.get("id") || "";
        if (!id) throw new Fail(400, "parameter id wajib");
        const msg = await apiMessage(u.searchParams.get("email") || "", id);
        return json(res, 200, { status: true, ...msg });
      }

      return json(res, 404, { status: false, code: 404, message: "endpoint tidak ada" });
    }

    if (p === "/" || p === "/index.html") return await serveStatic(res, "index.html");
    if (p === "/logo.jpeg") return await serveStatic(res, "logo.jpeg");
    return json(res, 404, { status: false, code: 404, message: "tidak ditemukan" });
  } catch (e) {
    const code = e instanceof Fail ? e.code || 500 : 500;
    return json(res, code >= 400 && code < 600 ? code : 500, {
      status: false,
      code,
      message: e.message || String(e),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Generator.Email server jalan di port ${PORT}`);
});
