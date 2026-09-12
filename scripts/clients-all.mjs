import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REGISTRY = 'clients.local.json';
const mode = process.argv[2] || 'migrate';
if (!['migrate', 'deploy', 'all'].includes(mode)) throw new Error('Usage: node scripts/clients-all.mjs [migrate|deploy|all]');
if (!existsSync(REGISTRY)) throw new Error(`Belum ada ${REGISTRY}. Buat client dulu via provision-client.mjs.`);
if (!existsSync('dist/server/wrangler.json')) throw new Error('Jalankan pnpm build dulu.');

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const base = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const failed = [];
for (const c of registry.clients) {
  console.log(`\n=== ${c.slug} (${c.dbName}) ===`);
  const config = { ...base, name: c.worker, main: './dist/server/index.js', assets: { directory: './dist/client' }, vars: { ...base.vars, TREFIKO_STANDALONE: 'true' }, d1_databases: [{ binding: 'DB', database_name: c.dbName, database_id: c.dbId, migrations_dir: './drizzle' }] };
  writeFileSync(c.config, JSON.stringify(config, null, 2) + '\n');
  const steps = mode === 'migrate' ? [['d1', 'migrations', 'apply', 'DB', '--remote', '--config', c.config]] : mode === 'deploy' ? [['deploy', '--config', c.config]] : [['d1', 'migrations', 'apply', 'DB', '--remote', '--config', c.config], ['deploy', '--config', c.config]];
  for (const args of steps) {
    const r = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', ...args], { stdio: 'inherit' });
    if (r.status !== 0) { failed.push(`${c.slug}: wrangler ${args[0]}`); break; }
  }
}
console.log(failed.length ? `\nGagal (${failed.length}):\n- ${failed.join('\n- ')}` : `\nSemua ${registry.clients.length} client sukses (${mode}).`);
if (failed.length) process.exit(1);
