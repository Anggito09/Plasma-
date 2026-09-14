import {readFileSync,writeFileSync} from 'node:fs';
const id=process.argv[2];if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Usage: node scripts/configure-cloudflare.mjs <your-D1-database-ID>');
const config=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
config.name='app';config.main='./dist/server/index.js';config.assets.directory='./dist/client';config.vars={...config.vars,TREFIKO_STANDALONE:'true'};config.ai={binding:'AI'};
config.d1_databases=[{binding:'DB',database_name:'temancipta',database_id:id,migrations_dir:'./drizzle'}];
writeFileSync('wrangler.deploy.json',JSON.stringify(config,null,2)+'\n');
console.log('Created wrangler.deploy.json. Apply migrations, set TREFIKO_SETUP_KEY, and deploy using this config.');
