import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Data 1 Agu – 15 Sep 2026: pelanggan acak, pembelian wajar, nomor global unik,
// hari lama semua completed (hanya hari ini yang antre), + pengeluaran realistis.
// Usage: node scripts/seed-range.mjs <baseUrl> <adminUser> <adminPass>
// Contoh: node scripts/seed-range.mjs https://app.temancipta.workers.dev ito <sandi-admin>
// Lalu: npx wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-range.sql
const [base, adminUser, adminPass] = process.argv.slice(2);
if (!base || !adminUser || !adminPass) throw new Error('Usage: node scripts/seed-range.mjs <baseUrl> <adminUser> <adminPass>');
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
const sql = (s) => String(s).replace(/'/g, "''");
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const ri = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');
const JKT = 'T00:00:00+07:00';
const dayStart = (day) => Date.parse(day + JKT);
const weekday = (day) => new Date(Date.parse(day + 'T12:00:00+07:00')).getUTCDay(); // 0=Min..6=Sab

await api('login', { username: adminUser.toLowerCase(), password: adminPass });
const me = await api('me');
console.log('Login sebagai ' + me.user.name);

const products = (await api('products')).products.filter(p => p.active);
if (products.length < 3) throw new Error('Butuh minimal 3 menu aktif.');
const DEAD = ['Salad Sayur', 'Donat Glaze', 'Kukis Cokelat', 'Teh Hijau Melati'];
const sellable = products.filter(p => !DEAD.includes(p.name));
const foods = sellable.filter(p => /makan|roti|kue|snack|food|bakery|cake|pastry|dessert/i.test(p.category || ''));
const drinks = sellable.filter(p => !/makan|roti|kue|snack|food|bakery|cake|pastry|dessert/i.test(p.category || ''));
const payNames = (await api('payments')).payments.filter(p => p.active).map(p => p.name);
const payOf = () => { const r = Math.random(); const has = (s) => payNames.find(n => new RegExp(s, 'i').test(n)); if (r < 0.4) return has('^tunai') || payNames[0]; if (r < 0.75) return has('qris') || payNames[0]; return has('kartu|bri|bca|mandiri|bank') || payNames[0]; };

const NAMES = ['Budi','Sari','Dewi','Agus','Rina','Doni','Maya','Fajar','Lina','Eko','Putri','Andi','Wulan','Yoga','Fitri','Hendra','Ratna','Dimas','Sinta','Bagus','Rudi','Nina','Tono','Lestari','Joko','Ayu','Rian','Nadia','Fikri','Intan','Galih','Salsa','Rizky','Bella','Danu','Kirana','Tania','Ilham','Winda','Farhan','Nabila','Yudha','Vina','Panji','Larissa','Daffa','Sekar','Raka','Maharani','Bayu','Citra','Dian','Eka','Fajarudin','Gita','Hadi','Irma','Jihan','Kurnia','Lukman','Mira','Nanda','Oscar','Pipit','Qori','Rendra','Sela','Taufik','Umi','Vebi','Wahyu','Yani','Zaki'];
const now = Date.now();
const days = [];
for (let t = dayStart('2026-08-01'); t <= now; t += 86400000) {
  const d = new Date(t + 12 * 3600000).toISOString().slice(0, 10);
  if (d > '2026-09-15') break;
  days.push(d);
}
// Nomor global unik: lanjut dari nomor terbesar yang sudah ada di rentang.
let seq = 0;
for (const d of days) {
  try { const h = await api(`history?day=${d}`); seq = Math.max(seq, ...h.orders.map(o => o.number)); }
  catch { }
}
console.log(`${days.length} hari, nomor lanjut dari ${seq}.`);

// Jam pembelian berbobot (08.00-22.00): sepi pagi, ramai makan siang & malam.
function randHour() {
  const r = Math.random();
  if (r < 0.08) return ri(8, 10);
  if (r < 0.30) return ri(11, 14);
  if (r < 0.42) return ri(15, 16);
  if (r < 0.80) return ri(17, 21);
  return 22;
}

const orderVals = [];
const expVals = [];
const EXPENSE = {
  bahan: [['Beras 10kg', 120000, 180000], ['Ayam 5kg', 150000, 250000], ['Kopi arabika 2kg', 180000, 320000], ['Susu UHT 12L', 180000, 260000], ['Gula aren 5kg', 90000, 150000], ['Telur 2 tray', 100000, 140000], ['Gas LPG 3kg', 22000, 25000], ['Es kristal 1 karung', 25000, 40000], ['Teh melati 1kg', 80000, 120000], ['Cokelat bubuk 2kg', 160000, 240000], ['Kentang frozen 5kg', 120000, 180000], ['Minyak 5L', 110000, 130000], ['Cup & tutup 2 pak', 90000, 140000]],
  operasional: [['Listrik', 80000, 250000], ['Air galon 5x', 100000, 125000], ['Tisu, sedotan, plastik', 50000, 120000], ['Gas antar', 25000, 50000], ['Servis mesin kopi', 150000, 400000]],
  gaji: [['Gaji harian kasir', 75000, 100000], ['Gaji harian dapur', 75000, 100000]],
  lainnya: [['Kebersihan', 30000, 80000], ['Parkir & keamanan', 20000, 50000], ['Cetak struk & banner', 40000, 150000]],
};
const round1k = (n) => Math.round(n / 1000) * 1000;

for (const day of days) {
  const isToday = day === days[days.length - 1];
  const wd = weekday(day);
  const weekend = wd === 0 || wd === 6;
  const volume = isToday ? 0 : (weekend ? ri(28, 44) : ri(16, 30));
  const mkOrder = (created) => {
    const dp = [...drinks].sort(() => Math.random() - 0.5).slice(0, ri(1, 2));
    const fp = Math.random() < 0.45 && foods.length ? [...foods].sort(() => Math.random() - 0.5).slice(0, ri(1, 2)) : [];
    const items = [...dp, ...fp].map(p => ({ id: p.id, name: p.name, price: p.price, quantity: Math.random() < 0.75 ? ri(1, 3) : ri(4, 5) }));
    const subtotal = items.reduce((s, x) => s + x.price * x.quantity, 0);
    const discount = Math.random() < 0.06 ? round1k(subtotal * (Math.random() < 0.5 ? 0.1 : 0.15)) : 0;
    const service = 0;
    const tax = Math.round((subtotal - discount + service) * 10 / 100); // PBJT 10%
    const total = subtotal - discount + service + tax;
    return { items, subtotal, discount, service, tax, total };
  };
  const pushRow = (o) => {
    seq += 1;
    orderVals.push(`('${o.id}','${o.day}',${seq},'${sql(o.customer)}','${o.mode}','${sql(JSON.stringify(o.items))}','','${o.total}','${sql(o.payment)}','${o.status}',${o.created},${o.created},'${me.user.id}','${hex(32)}',${o.version},${o.cancelReason ? `'${sql(o.cancelReason)}'` : 'NULL'},${o.prepared ?? 'NULL'},${o.ready ?? 'NULL'},${o.done ?? 'NULL'},${o.discount},${o.service},${o.tax})`);
  };
  // Pesanan hari lampau: completed (+2% batal).
  for (let i = 0; i < volume; i++) {
    const created = Math.min(dayStart(day) + randHour() * 3600000 + ri(0, 59) * 60000, now);
    const o = mkOrder(created);
    const hasFood = o.items.some(x => foods.some(f => f.id === x.id));
    const peak = [12, 13, 18, 19, 20].includes(new Date(created + 7 * 3600000).getUTCHours());
    const delay = (hasFood ? ri(8, 16) : ri(3, 7)) * 60000 + (peak ? ri(0, 5) * 60000 : 0);
    const ready = Math.min(created + delay, now);
    const done = Math.min(ready + ri(2, 12) * 60000, now);
    if (Math.random() < 0.02) {
      pushRow({ id: randomUUID(), day, customer: pick(NAMES), mode: Math.random() < 0.6 ? 'dine-in' : 'takeaway', ...o, payment: payOf(), status: 'cancelled', created, version: 2, cancelReason: pick(['Pelanggan batal', 'Salah pesan', 'Stok habis']), prepared: null, ready: null, done: null });
    } else {
      pushRow({ id: randomUUID(), day, customer: pick(NAMES), mode: Math.random() < 0.6 ? 'dine-in' : 'takeaway', ...o, payment: payOf(), status: 'completed', created, version: 4, cancelReason: null, prepared: created + 2 * 60000, ready, done });
    }
  }
  // Hari ini: 8-12 antre + completed pagi.
  if (isToday) {
    const nowH = new Date(now + 7 * 3600000).getUTCHours();
    const startH = Math.min(8, Math.max(0, nowH - 4));
    for (let k = 0; k < ri(8, 12); k++) {
      const created = Math.min(dayStart(day) + ri(startH, Math.max(startH, nowH)) * 3600000 + ri(0, 59) * 60000, now - 60000);
      const o = mkOrder(created);
      const roll = Math.random();
      const status = roll < 0.45 ? 'waiting' : roll < 0.75 ? 'preparing' : 'ready';
      pushRow({ id: randomUUID(), day, customer: pick(NAMES), mode: Math.random() < 0.6 ? 'dine-in' : 'takeaway', ...o, payment: payOf(), status, created, version: status === 'waiting' ? 1 : status === 'preparing' ? 2 : 3, cancelReason: null, prepared: status === 'waiting' ? null : Math.min(created + 2 * 60000, now), ready: status === 'ready' ? Math.min(created + ri(4, 12) * 60000, now) : null, done: null });
    }
  }
  // Pengeluaran realistis 1-3/hari.
  const nExp = ri(1, 3);
  for (let e = 0; e < nExp; e++) {
    const r = Math.random();
    const cat = r < 0.62 || e === 0 ? 'bahan' : r < 0.8 ? 'operasional' : r < 0.92 ? 'gaji' : 'lainnya';
    const [note, lo, hi] = pick(EXPENSE[cat]);
    const amount = round1k(lo + Math.random() * (hi - lo));
    const created = dayStart(day) + 12 * 3600000 + ri(0, 240) * 60000;
    expVals.push(`('${randomUUID()}','${day}','${cat}','${sql(note)}',${amount},${created},'${me.user.id}')`);
  }
}

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
let out = '';
for (const c of chunk(orderVals, 200)) out += 'INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint,version,cancel_reason,prepared_at,ready_at,completed_at,discount_rp,service_rp,tax_rp) VALUES\n' + c.join(',\n') + ';\n';
for (const c of chunk(expVals, 200)) out += 'INSERT INTO expenses(id,day,category,note,amount,created_at,created_by) VALUES\n' + c.join(',\n') + ';\n';
writeFileSync('scripts/seed-range.sql', out);
console.log(`${orderVals.length} pesanan + ${expVals.length} pengeluaran (${days[0]} s/d ${days[days.length - 1]}) ditulis ke scripts/seed-range.sql.`);
console.log('Lanjut: npx wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-range.sql');
