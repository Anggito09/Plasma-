import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const REGISTRY = 'clients.local.json';
const slug = process.argv[2];
if (!slug || !/^[a-z0-9][a-z0-9-]{2,30}$/.test(slug)) throw new Error('Usage: node scripts/provision-client.mjs <client-slug>\nContoh: node scripts/provision-client.mjs kopi-sudirman');

const load = () => existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : { clients: [] };
const save = (r) => writeFileSync(REGISTRY, JSON.stringify(r, null, 2) + '\n');
const run = (args, opts = {}) => {
  const r = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', ...args], { stdio: 'pipe', encoding: 'utf8', ...opts });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error('wrangler ' + args.join(' ') + ' gagal.'); }
  return r.stdout;
};

const registry = load();
if (registry.clients.some(c => c.slug === slug)) throw new Error(`Client "${slug}" sudah ada di ${REGISTRY}.`);
const dbName = `trefiko-${slug}`;
console.log(`[1/5] Membuat D1 ${dbName}...`);
const created = run(['d1', 'create', dbName]);
const dbId = (created.match(/[a-f0-9-]{36}/i) || [])[0];
if (!dbId) throw new Error('Tidak dapat membaca database_id dari output wrangler.');
console.log(`      ID: ${dbId}`);

const base = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const workerName = `trefiko-${slug}`;
const configFile = `wrangler.${slug}.json`;
const config = {
  ...base,
  name: workerName,
  main: './dist/server/index.js',
  assets: { directory: './dist/client' },
  vars: { ...base.vars, TREFIKO_STANDALONE: 'true' },
  d1_databases: [{ binding: 'DB', database_name: dbName, database_id: dbId, migrations_dir: './drizzle' }],
};
writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
console.log(`[2/5] Config ${configFile} (worker ${workerName}).`);

console.log('[3/5] Migrasi remote...');
run(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configFile], { stdio: 'inherit' });

const setupKey = randomBytes(24).toString('hex');
console.log('[4/5] Menyimpan TREFIKO_SETUP_KEY...');
const put = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', 'secret', 'put', 'TREFIKO_SETUP_KEY', '--config', configFile], { input: setupKey + '\n', stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf8' });
if (put.status !== 0) throw new Error('Gagal menyimpan secret.');

console.log('[5/5] Deploy...');
run(['deploy', '--config', configFile], { stdio: 'inherit' });

registry.clients.push({ slug, dbName, dbId, worker: workerName, config: configFile, createdAt: new Date().toISOString() });
save(registry);
console.log(`\nSelesai. URL: https://${workerName}.<subdomain-kamu>.workers.dev`);
console.log(`Kunci setup (simpan baik-baik, hanya tampil sekali): ${setupKey}`);
console.log(`Registry: ${REGISTRY} — JANGAN commit file ini (berisi ID internal).`);
