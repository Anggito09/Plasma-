import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// 50 pelanggan dummy: 5 selesai (tersebar 7 hari) + 45 antre SEMUA hari ini
// sehingga nomor antrean aktif berurutan tanpa dobel.
// Usage: node scripts/seed-50.mjs <baseUrl> <adminUser> <adminPass>
// Contoh: node scripts/seed-50.mjs https://app.temancipta.workers.dev ito <sandi-admin>
// Lalu: npx wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-50-orders.sql
const [base, adminUser, adminPass] = process.argv.slice(2);
if (!base || !adminUser || !adminPass) throw new Error('Usage: node scripts/seed-50.mjs <baseUrl> <adminUser> <adminPass>');
if (/[<>]|sandi|password/i.test(adminPass)) throw new Error('Ganti argumen sandi dengan SANDI ASLI akun admin (tanpa tanda < >).');
const origin = new URL(base).origin;
let cookie = '';
async function api(path, body) {
  const r = await fetch(origin + '/api/' + path, {
    method: body ? 'POST' : 'GET',
    headers: { origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(path + ': ' + (d.error || r.status));
  return d;
}
const jakartaDay = (t) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(t)); return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-'); };
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
const sql = (s) => String(s).replace(/'/g, "''");
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

await api('login', { username: adminUser.toLowerCase(), password: adminPass });
const me = await api('me');
console.log('Login sebagai ' + me.user.name + ' (' + me.user.role + ')');

const products = (await api('products')).products.filter(p => p.active);
if (!products.length) throw new Error('Tidak ada menu aktif.');

// Batalkan dulu dummy aktif dari batch sebelumnya supaya nomor tidak dobel.
const DUMMY = ['Budi', 'Sari', 'Dewi', 'Agus', 'Rina', 'Doni', 'Maya', 'Fajar', 'Lina', 'Eko', 'Putri', 'Andi', 'Wulan', 'Yoga', 'Fitri', 'Hendra', 'Ratna', 'Dimas', 'Sinta', 'Bagus', 'Rudi', 'Nina', 'Tono', 'Lestari', 'Joko', 'Ayu', 'Rian', 'Nadia', 'Fikri', 'Intan', 'Galih', 'Salsa', 'Rizky', 'Bella', 'Danu', 'Kirana', 'Bagas', 'Tania', 'Ilham', 'Winda', 'Farhan', 'Nabila', 'Yudha', 'Vina', 'Panji', 'Larissa', 'Daffa', 'Sekar', 'Raka', 'Maharani'];
let cleaned = 0;
for (const o of (await api('board')).orders) {
  if (!DUMMY.includes(o.customer)) continue;
  try { await api('orders/action', { id: o.id, version: o.version, action: 'cancel', requestId: randomUUID(), reason: 'Diganti batch dummy baru.' }); cleaned++; }
  catch { }
}
if (cleaned) console.log(`Bersihkan ${cleaned} dummy aktif lama.`);

// Menu yang sengaja TIDAK dibeli supaya "menu mati" muncul di analisa.
const DEAD = ['Salad Sayur', 'Donat Glaze', 'Kukis Cokelat', 'Teh Hijau Melati'];
const sellable = products.filter(p => !DEAD.includes(p.name));
const foods = sellable.filter(p => /makan|roti & kue/i.test(p.category || ''));
const drinks = sellable.filter(p => !/makan|roti & kue/i.test(p.category || ''));
if (!drinks.length || !foods.length) throw new Error('Butuh minimal 1 makanan dan 1 minuman aktif.');

const names = [...DUMMY].sort(() => Math.random() - 0.5);
const payOpts = ['Tunai', 'Tunai', 'Tunai', 'QRIS', 'QRIS', 'QRIS', 'Kartu', 'Kartu'];
const now = Date.now();
const today = jakartaDay(now);
const rows = names.map((customer) => {
  // Acak: 1-2 minuman + 0-2 makanan, qty 1-8 per item.
  const dp = [...drinks].sort(() => Math.random() - 0.5).slice(0, ri(1, 2));
  const fp = [...foods].sort(() => Math.random() - 0.5).slice(0, ri(0, 2));
  const items = [...dp, ...fp].map(p => ({ id: p.id, name: p.name, price: p.price, quantity: ri(1, 8) }));
  if (!items.length) items.push({ id: drinks[0].id, name: drinks[0].name, price: drinks[0].price, quantity: ri(1, 8) });
  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  return { id: randomUUID(), day: today, customer, mode: Math.random() < 0.6 ? 'dine-in' : 'takeaway', items, note: '', total, payment: pick(payOpts), status: 'waiting', created: now, prepared: null, ready: null, done: null };
});

// Tepat 5 selesai tersebar 7 hari terakhir; 45 antre SEMUA hari ini, selisih 3 menit.
const order = rows.map((_, i) => i).sort(() => Math.random() - 0.5);
const doneSet = new Set(order.slice(0, 5));
const actives = [];
rows.forEach((r, i) => {
  if (doneSet.has(i)) {
    r.created = now - Math.floor(Math.random() * 7 * 24 * 60) * 60000;
    r.day = jakartaDay(Math.min(r.created, now));
    const hasFood = r.items.some(x => foods.some(f => f.id === x.id));
    const delay = hasFood ? ri(8, 20) * 60000 : ri(3, 10) * 60000;
    r.status = 'completed';
    r.prepared = r.created + 2 * 60000;
    r.ready = Math.min(r.created + delay, now);
    r.done = Math.min(r.ready + ri(2, 10) * 60000, now);
    return;
  }
  actives.push(r);
});
actives.sort(() => Math.random() - 0.5).forEach((r, k) => {
  r.created = now - (actives.length - 1 - k) * 3 * 60000;
  r.day = today;
  const roll = Math.random();
  r.status = roll < 0.5 ? 'waiting' : roll < 0.8 ? 'preparing' : 'ready';
  r.prepared = r.status === 'waiting' ? null : Math.min(r.created + 2 * 60000, now);
  r.ready = r.status === 'ready' ? Math.min(r.created + ri(3, 12) * 60000, now) : null;
  r.done = null;
});
rows.sort((a, b) => a.created - b.created);
const maxByDay = {};
for (const day of [...new Set(rows.map(r => r.day))]) {
  const h = await api(`history?day=${day}`);
  maxByDay[day] = Math.max(0, ...h.orders.map(o => o.number));
}
const values = rows.map(r => {
  maxByDay[r.day] += 1;
  return `('${r.id}','${r.day}',${maxByDay[r.day]},'${sql(r.customer)}','${r.mode}','${sql(JSON.stringify(r.items))}','','${r.total}','${sql(r.payment)}','${r.status}',${r.created},${r.created},'${me.user.id}','${hex(32)}',1,NULL,${r.prepared ?? 'NULL'},${r.ready ?? 'NULL'},${r.done ?? 'NULL'})`;
});
writeFileSync('scripts/seed-50-orders.sql', 'INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint,version,cancel_reason,prepared_at,ready_at,completed_at) VALUES\n' + values.join(',\n') + ';\n');
const omzet = rows.reduce((s, r) => s + r.total, 0);
console.log(`50 pesanan (5 selesai, 45 antre hari ini) ditulis ke scripts/seed-50-orders.sql, omzet dummy Rp${omzet.toLocaleString('id-ID')}.`);
console.log('Lanjut: npx wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-50-orders.sql');
