import { existsSync, mkdirSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Backup semua D1 (demo + semua client) ke folder backups/.
// Jalankan harian via Task Scheduler. Hanya baca data, tidak mengubah apa pun.
const KEEP = 14; // simpan 14 file terbaru per database
const OUT = 'backups';
mkdirSync(OUT, { recursive: true });

const targets = [];
if (existsSync('wrangler.deploy.json')) targets.push({ label: 'app', config: 'wrangler.deploy.json' });
if (existsSync('clients.local.json')) {
  const reg = JSON.parse(readFileSync('clients.local.json', 'utf8'));
  for (const c of reg.clients || []) {
    if (c.config && existsSync(c.config)) targets.push({ label: c.dbName || c.slug, config: c.config });
  }
}
if (!targets.length) throw new Error('Tidak ada config deploy. Jalankan configure dulu.');

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
let ok = 0;
for (const t of targets) {
  const file = `${OUT}/${t.label}-${stamp}.sql`;
  console.log(`Backup ${t.label} -> ${file}`);
  let r = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', 'd1', 'export', 'DB', '--remote', '--config', t.config, '--output', file], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.log('Coba lagi sekali...');
    r = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', 'd1', 'export', 'DB', '--remote', '--config', t.config, '--output', file], { stdio: 'inherit' });
  }
  if (r.status !== 0) { console.error(`Gagal: ${t.label}`); continue; }
  ok++;
  const files = readdirSync(OUT).filter(f => f.startsWith(t.label + '-') && f.endsWith('.sql')).sort();
  while (files.length > KEEP) unlinkSync(`${OUT}/${files.shift()}`);
}
console.log(`Selesai ${ok}/${targets.length}. Folder ${OUT}/ JANGAN di-commit; sync ke Google Drive.`);
if (!ok) process.exit(1);
