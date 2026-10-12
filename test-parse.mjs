// test-parse.mjs — menguji fungsi parse asli dari server.mjs dengan contoh markup generator.email
import assert from "node:assert";
import { parseInbox, extractDiv, stripTags, extractLinks } from "./lib/scraper.mjs";

const INBOX_HTML = `
<html><body>
<script>var num_mess:2</script>
<script>var conf = {cur_msg_id:"msg001"}</script>
<div class="email-table">
<div onclick="loadInboxClientSide('bhap.me/user1/msg002')" class="btn list-group-item">
  <div class="from_div_45g45gg">no-reply@x.com</div>
  <div class="subj_div_45g45gg">Kode verifikasi</div>
  <div class="time_div_45g45gg">23:42</div>
</div>
<div id="mail-summary-head">
  <div class="from_div_45g45gg">noreply@service.com</div>
  <div class="subj_div_45g45gg">Verifikasi akun Anda &amp; selamat datang</div>
  <div class="time_div_45g45gg">23:45</div>
</div>
<div class="g8r mess_bodiyy"><p>Halo! Klik <a href="https://service.com/verify?token=XYZ123">link verifikasi</a> untuk mengaktifkan akun.</p><p>Kode: 482913</p></div>
</div>
</body></html>`;

const box = parseInbox(INBOX_HTML);
assert.strictEqual(box.total, 2, "total harus 2");
assert.strictEqual(box.items.length, 2, "harusnya 2 item (1 cur_msg + 1 baris)");
assert.strictEqual(box.items[0].id, "msg001");
assert.strictEqual(box.items[0].from, "noreply@service.com");
assert.strictEqual(box.items[0].subject, "Verifikasi akun Anda & selamat datang");
assert.strictEqual(box.items[1].id, "msg002");
assert.strictEqual(box.items[1].from, "no-reply@x.com");

const body = extractDiv(INBOX_HTML, 'class="g8r mess_bodiyy"');
assert.ok(body.includes("link verifikasi"), "body berisi link");
const links = extractLinks(body);
assert.deepStrictEqual(links, ["https://service.com/verify?token=XYZ123"]);
const text = stripTags(body);
assert.ok(text.includes("Kode: 482913"), "text berisi kode");

console.log("parseInbox  :", JSON.stringify(box.items.map((i) => [i.id, i.from, i.subject, i.time])));
console.log("extractLinks:", links);
console.log("stripTags   :", JSON.stringify(text));
console.log("SEMUA TEST PARSE LOLOS ✔");
process.exit(0);
