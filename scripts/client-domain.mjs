import { spawnSync } from 'node:child_process';

const [worker, hostname] = process.argv.slice(2);
if (!worker || !hostname) throw new Error('Usage: node scripts/client-domain.mjs <worker-name> <domain>\nContoh: node scripts/client-domain.mjs temancipta-kopi-sudirman kasir.kopisudirman.id');
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) throw new Error('Domain tidak valid.');

console.log(`Menautkan ${hostname} ke worker ${worker}...`);
console.log('Syarat: domain sudah ada di akun Cloudflare ini (Websites → Add domain).');
const r = spawnSync(process.execPath, ['./node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', `wrangler.${worker.replace(/^temancipta-/, '')}.json`, '--assets', './dist/client'], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('Deploy gagal.');
console.log(`\nTambahkan route di dashboard: Workers & Pages → ${worker} → Settings → Domains & Routes → Add → Custom domain → ${hostname}`);
console.log('Cloudflare otomatis buatkan sertifikat SSL gratis. Tunggu ±2 menit lalu buka https://' + hostname);
