import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// 5 pelanggan menunggu (nomor lanjut dari 26). Jalankan lalu:
//   wrangler d1 execute DB --remote --config wrangler.deploy.json --file ./scripts/seed-5waiting.sql
const P = {
  tubruk: ['0f51b077-c558-453d-9330-4de0f231b475', 'Kopi Tubruk', 20000],
  pisang: ['5e7ac5cc-b2cf-4f83-816d-c226f90a94f6', 'Pisang Goreng', 22000],
  matcha: ['a07c5ee1-e328-4533-83a5-1e41e70719f4', 'Matcha Latte', 34000],
  mie: ['c00e80d2-82d3-4707-a0cc-e1bec278042b', 'Mie Goreng', 32000],
  tehmanis: ['80ef4d49-3089-4fa7-aa16-e25242515bfd', 'Teh Manis', 15000],
  latte: ['602009d3-8390-49c9-9d02-30ee7c18845b', 'Caffe Latte', 32000],
  kukis: ['850fca5a-0651-412c-bb2a-1dc59ecbec34', 'Kukis Cokelat', 20000],
  soto: ['7ddcd89b-bd8c-4f04-b222-53ee525fcbbf', 'Soto Ayam', 30000],
  leci: ['94f532b4-7e00-4c34-8c08-d8e549ff7caa', 'Teh Leci', 26000],
};
const it = (k, q) => ({ id: P[k][0], name: P[k][1], price: P[k][2], quantity: q });
const now = Date.now();
const rows = [
  ['Wahyu', 'dine-in', [it('tubruk', 1), it('pisang', 1)], 'Tunai', 8],
  ['Intan', 'takeaway', [it('matcha', 1)], 'QRIS', 6],
  ['Galih', 'dine-in', [it('mie', 1), it('tehmanis', 2)], 'Tunai', 4],
  ['Nadia', 'takeaway', [it('latte', 1), it('kukis', 1)], 'QRIS', 2],
  ['Rizky', 'dine-in', [it('soto', 1), it('leci', 1)], 'Tunai', 0],
];
const fp = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');
let n = 26;
const vals = rows.map(([c, m, items, pay, ago], i) => {
  n += 1;
  const t = now - ago * 60000;
  const total = items.reduce((s, x) => s + x.price * x.quantity, 0);
  return `('${randomUUID()}','2026-09-13',${n},'${c}','${m}','${JSON.stringify(items)}','',${total},'${pay}','waiting',${t},${t},'cbb97202-aa1a-4a79-9cb5-0fab4da0c94f','${fp}${i}',1,NULL,NULL,NULL,NULL)`;
});
writeFileSync('scripts/seed-5waiting.sql', 'INSERT INTO orders(id,day,number,customer,mode,items,note,total,payment,status,created_at,updated_at,created_by,fingerprint,version,cancel_reason,prepared_at,ready_at,completed_at) VALUES\n' + vals.join(',\n') + ';\n');
console.log('5 pesanan menunggu ditulis.');
