# Generator.Email — Temporary Email, Real Freedom

Website pembuat email sementara (temp mail) dengan data **live dari generator.email**.
Desain dark-neon modern, notifikasi realtime, dan siap deploy ke **Vercel**.

**Developed by Van313 | Official**

## Struktur proyek

```
index.html          -> frontend (single file, semua CSS/JS/SVG inline)
logo.jpeg           -> logo website (favicon + brand)
lib/scraper.mjs     -> logika scraper generator.email (dipakai lokal & Vercel)
server.mjs          -> server lokal untuk pratinjau (Node 18+, tanpa dependensi)
api/*.mjs           -> serverless functions Vercel (/api/generate, /api/inbox, /api/message, /api/domains, /api/health)
vercel.json         -> konfigurasi Vercel (header cache); runtime Node bawaan otomatis
package.json        -> engines Node 24.x untuk serverless functions (wajib Vercel)
test-parse.mjs      -> uji unit fungsi parser
```

## Jalankan lokal

```bash
node --version        # wajib v18+
node server.mjs       # buka http://localhost:3000
```

## Deploy ke Vercel

1. Push proyek ini ke repository GitHub (atau GitLab/Bitbucket).
2. Di [vercel.com](https://vercel.com) → **Add New… → Project** → import repo tersebut.
3. Vercel mendeteksi otomatis: static `index.html` + serverless `api/` (runtime Node bawaan,
   versi Node 24 dari `package.json` engines — wajib, karena Vercel sudah tidak menerima Node 20).
4. Deploy. Selesai — frontend memanggil `/api/...` relatif, jadi langsung cocok di domain Vercel Anda.

Alternatif lewat CLI:

```bash
npm i -g vercel
vercel          # ikuti prompt, default sudah benar
vercel --prod
```

> Catatan: plan Hobby Vercel membatasi durasi serverless ±10 detik per request.
> Request ke generator.email biasanya 1–3 detik, jadi aman. Jika butuh lebih longgar, naikkan plan.

## Fitur

- Buat email sementara acak **atau kustom** (pilih username + domain, multi-domain live).
- Kotak masuk realtime (polling 3/5/10 dtk) + panel notifikasi + toast + suara chime + push notification browser.
- Baca isi pesan lengkap, ekstrak link verifikasi, **deteksi kode OTP otomatis** dengan tombol salin.
- Countdown masa aktif 24 jam + progress bar, ganti email, salin email.
- Riwayat email (pakai ulang / hapus), pengaturan, statistik sesi, FAQ, tema gelap/terang.
- Animasi: partikel hero, tilt 3D kartu email, reveal on-scroll, ripple tombol, entrance bertahap.
- Tanpa registrasi, tanpa dependensi frontend, tanpa CDN wajib (font Google opsional, ada fallback).

## Uji

```bash
PORT=3999 node test-parse.mjs   # uji parser (parseInbox/extractDiv/extractLinks/stripTags)
```
