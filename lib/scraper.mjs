// lib/scraper.mjs — logika scraper generator.email (adaptasi genmail.mjs)
// Dipakai bersama oleh server.mjs (lokal) dan api/*.mjs (Vercel serverless)
import crypto from "node:crypto";

const ORIGIN = "https://generator.email";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TIMEOUT_REQ = Number(process.env.REQ_TIMEOUT || 20000);

export class Fail extends Error {
  constructor(code, msg) {
    super(msg);
    this.code = code;
  }
}

const jar = new Map();
let apiToken = "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cookieStr = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

function storeCookies(res) {
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const c of list) {
    const pair = c.split(";")[0];
    const i = pair.indexOf("=");
    if (i < 0) continue;
    const name = pair.slice(0, i).trim();
    const val = pair.slice(i + 1).trim();
    if (val) jar.set(name, val);
    else jar.delete(name);
  }
}

async function req(path, { method = "GET", form, headers = {}, redirect = "manual" } = {}) {
  // retry + backoff kalau kena tantangan anti-bot "Checking your browser" (503)
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_REQ);
    const h = {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      origin: ORIGIN,
      referer: ORIGIN + "/",
      ...headers,
    };
    if (jar.size) h.cookie = cookieStr();
    let body;
    if (form) {
      h["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(form).toString();
    }
    try {
      const res = await fetch(path.startsWith("http") ? path : ORIGIN + path, {
        method,
        headers: h,
        body,
        redirect,
        signal: ctrl.signal,
      });
      storeCookies(res);
      const out = { status: res.status, location: res.headers.get("location"), text: await res.text() };
      if (out.status === 503 && out.text.includes("Checking your browser")) {
        if (attempt < 2) {
          // tantangan anti-bot = PoW SHA-256 yang bisa dipecahkan tanpa browser
          try {
            await passChallenge(out.text);
          } catch {
            await sleep(1500);
          }
          continue;
        }
      }
      return out;
    } catch (e) {
      if (e.name === "AbortError" || e.name === "TimeoutError")
        throw new Fail(408, `timeout ${TIMEOUT_REQ / 1000}s: ${path}`);
      throw new Fail(0, `${e.message} (${path})`);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function goto(path) {
  let cur = path;
  for (let i = 0; i < 5; i++) {
    const r = await req(cur);
    if (r.status >= 300 && r.status < 400 && r.location) {
      const u = new URL(r.location, ORIGIN);
      cur = u.pathname + u.search;
      continue;
    }
    return r;
  }
  throw new Fail(508, "terlalu banyak redirect: " + path);
}

/* ---------- pemecah tantangan anti-bot "Checking your browser" ----------
   Halaman itu memberi Proof-of-Work: cari n sehingga sha256(C+":"+n)
   memiliki N bit nol di depan, lalu navigasi ke /__verify?c..&n..&t..&b..&z..
   (plus parameter gate manusia g/gm/gp). Semua bisa dilakukan via HTTP biasa. */
function leadZeroOk(hex, N) {
  let n = N,
    i = 0;
  while (n >= 4) {
    if (hex[i] !== "0") return false;
    i++;
    n -= 4;
  }
  if (n === 0) return true;
  return (parseInt(hex[i], 16) >> (4 - n)) === 0;
}

async function passChallenge(html) {
  const C = (html.match(/var C="([^"]+)"/) || [])[1];
  const N = Number((html.match(/,N=(\d+)/) || [])[1] || 15);
  const B = (html.match(/,B="([^"]*)"/) || [])[1] ?? "/";
  const M = (html.match(/,M="([^"]+)"/) || [])[1] || "v";
  if (!C) throw new Fail(503, "tantangan anti-bot tidak dikenal");

  let n = -1;
  for (let i = 0; i < 500000; i++) {
    const h = crypto.createHash("sha256").update(C + ":" + i).digest("hex");
    if (leadZeroOk(h, N)) {
      n = i;
      break;
    }
  }
  if (n < 0) throw new Fail(503, "anti-bot: PoW tidak terpecahkan");

  // sidik jari "browser wajar": bukan webdriver, timezone valid
  const b = 0;
  let z = -new Date().getTimezoneOffset();
  if (!isFinite(z) || z < -900 || z > 900) z = 0;

  // tirukan sendBeacon("/__ab_sig/b/z") yang dikirim halaman tantangan
  try {
    await req(`/__ab_sig/${b}/${z}`, { method: "POST" });
  } catch {}

  const base = M === "u" ? "/unblock" : "/__verify";
  const q =
    `${base}?c=${encodeURIComponent(C)}&n=${n}&t=${encodeURIComponent(B)}` +
    `&b=${b}&z=${z}&g=1&gm=${900 + Math.floor(Math.random() * 600)}&gp=${2 + Math.floor(Math.random() * 6)}`;
  const r = await goto(q);
  if (r.status !== 200) throw new Fail(503, `anti-bot: verify HTTP ${r.status}`);
}

async function warmup() {
  const r = await req("/");
  if (r.text.includes("No restrictions"))
    throw new Fail(403, "kena halaman anti-bot generator.email (UA/cookie ditolak server)");
  if (r.status !== 200) throw new Fail(r.status, `halaman utama HTTP ${r.status}`);
  const m = r.text.match(/api-token" content="([^"]+)"/);
  if (!m) throw new Fail(502, "meta api-token tidak ada di halaman utama");
  apiToken = m[1];
}

let warmupPromise = null;
export async function ensureWarm() {
  if (!warmupPromise) {
    warmupPromise = warmup().catch((e) => {
      warmupPromise = null;
      throw e;
    });
  }
  return warmupPromise;
}

const ENT = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', " ": " " };
export function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&(amp|lt|gt|quot|nbsp);/g, (m) => ENT[m] ?? m);
}

export function stripTags(html) {
  return decode(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|td)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractDiv(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return "";
  const gt = html.indexOf(">", at);
  if (gt < 0) return "";
  const re = /<\/?div\b/gi;
  re.lastIndex = gt + 1;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (html[m.index + 1] === "/") {
      if (--depth === 0) return html.slice(gt + 1, m.index);
    } else depth++;
  }
  return html.slice(gt + 1);
}

function parseRows(html) {
  const out = [];
  const re =
    /loadInboxClientSide\('([^']+)'\)"[^>]*class="[^"]*list-group-item[\s\S]*?from_div_45g45gg">([\s\S]*?)<\/div>[\s\S]*?subj_div_45g45gg">([\s\S]*?)<\/div>[\s\S]*?time_div_45g45gg">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[1].split("/");
    out.push({
      id: seg[2] || "",
      from: decode(m[2]).trim(),
      subject: decode(m[3]).trim(),
      time: decode(m[4]).trim(),
    });
  }
  return out;
}

const curMsg = (html) => (html.match(/cur_msg_id:"([^"]*)"/) || [])[1] || "";
const numMess = (html) => {
  const m = html.match(/num_mess:(\d+)/);
  return m ? +m[1] : 0;
};

export function parseInbox(html) {
  const items = parseRows(html);
  const id = curMsg(html);
  if (id && !items.some((r) => r.id === id)) {
    const head = extractDiv(html, 'id="mail-summary-head"');
    const g = (re) => {
      const m = head.match(re);
      return m ? decode(m[1]).trim() : "";
    };
    items.unshift({
      id,
      from: g(/from_div_45g45gg">([\s\S]*?)<\/div>/),
      subject: g(/subj_div_45g45gg">([\s\S]*?)<\/div>/),
      time: g(/time_div_45g45gg">([\s\S]*?)<\/div>/),
    });
  }
  return { total: numMess(html), items };
}

export function extractLinks(html) {
  const out = [];
  const push = (u) => {
    u = decode(u).trim().replace(/[.,;:]+$/, "");
    if (/^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
  };
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) if (!/^(#|mailto:)/i.test(m[1])) push(m[1]);
  for (const u of stripTags(html).match(/https?:\/\/[^\s"'<>()]+/g) || []) push(u);
  return out;
}

export function splitEmail(email) {
  const m = String(email || "").trim().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) throw new Fail(400, `format email salah: ${email}`);
  return { user: m[1], domain: m[2], email: `${m[1]}@${m[2]}` };
}

async function inboxHtml(acct) {
  const r = await goto(`/${acct.domain}/${acct.user}`);
  if (r.status !== 200) throw new Fail(r.status, `inbox HTTP ${r.status}`);
  if (!r.text.includes("email-table")) throw new Fail(403, "halaman inbox tidak ter-render (anti-bot?)");
  return r.text;
}

async function messageHtml(acct, id) {
  const r = await goto(`/${acct.domain}/${acct.user}/${id}`);
  if (r.status !== 200) throw new Fail(r.status, `pesan HTTP ${r.status}`);
  return r.text;
}

let domainsCache = { at: 0, list: [] };
export async function listDomains() {
  if (domainsCache.list.length && Date.now() - domainsCache.at < 10 * 60 * 1000) return domainsCache.list;
  const r = await req("/api/domains.php", {
    headers: { "x-api-token": apiToken, "x-requested-with": "XMLHttpRequest" },
  });
  if (r.status !== 200) throw new Fail(r.status, `domains.php HTTP ${r.status}: ${r.text.slice(0, 150)}`);
  try {
    const list = JSON.parse(r.text)
      .map((d) => d.ascii || d.display)
      .filter(Boolean);
    domainsCache = { at: Date.now(), list };
    return list;
  } catch {
    throw new Fail(502, `domains.php bukan JSON: ${r.text.slice(0, 150)}`);
  }
}

async function checkDomain(domain, user) {
  const r = await req("/uptime.php", { method: "POST", form: { dmn: domain, usr: user } });
  if (r.status !== 200) throw new Fail(r.status, `uptime.php HTTP ${r.status}: ${r.text.slice(0, 150)}`);
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Fail(502, `uptime.php bukan JSON: ${r.text.slice(0, 150)}`);
  }
}

/* ---------- aksi yang dipakai API ---------- */

export async function apiGenerate(userIn, domainIn) {
  await ensureWarm();
  let user = "";
  let domain = "";
  if (userIn && userIn.includes("@")) {
    const p = splitEmail(userIn);
    user = p.user;
    domain = p.domain;
  } else {
    user = userIn || "";
    domain = domainIn || "";
  }
  if (!user) user = "u" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  user = user.replace(/[^a-zA-Z0-9._-]/g, "").replace(/\.{2,}/g, ".").replace(/-{2,}/g, "-");
  if (!user) throw new Fail(400, "username jadi kosong setelah disaring");

  if (!domain) {
    const ds = await listDomains();
    if (!ds.length) throw new Fail(502, "daftar domain kosong");
    domain = ds[Math.floor(Math.random() * ds.length)];
  }

  const st = await checkDomain(domain, user);
  if (st.status !== "good") throw new Fail(400, `domain ${domain} tidak aktif: ${JSON.stringify(st)}`);

  const acct = { user, domain, email: `${user}@${domain}` };
  await inboxHtml(acct); // pastikan inbox siap
  return { email: acct.email, user, domain, uptime: st.uptime };
}

export async function apiInbox(email) {
  const acct = splitEmail(email);
  await ensureWarm();
  return parseInbox(await inboxHtml(acct));
}

export async function apiMessage(email, id) {
  const acct = splitEmail(email);
  await ensureWarm();
  const html = await messageHtml(acct, id);
  const body = extractDiv(html, 'class="g8r mess_bodiyy"');
  if (!body) throw new Fail(404, `body pesan ${id} tidak ditemukan`);
  const head = extractDiv(html, 'id="mail-summary-head"');
  const g = (re) => {
    const m = head.match(re);
    return m ? decode(m[1]).trim() : "";
  };
  return {
    from: g(/from_div_45g45gg">([\s\S]*?)<\/div>/),
    subject: g(/subj_div_45g45gg">([\s\S]*?)<\/div>/),
    time: g(/time_div_45g45gg">([\s\S]*?)<\/div>/),
    links: extractLinks(body),
    text: stripTags(body),
  };
}
