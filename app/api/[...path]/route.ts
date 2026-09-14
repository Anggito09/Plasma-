import { env } from 'cloudflare:workers';
import { createService } from '@/core/service.mjs';
export const dynamic = 'force-dynamic';
async function handle(request: Request) {
  if(!env.DB) return Response.json({error:'Database belum terhubung.'},{status:503});
  // The private Sites gateway supplies verified identity headers. Never trust these on a public reverse proxy.
  const standalone=(env as unknown as Record<string,string>).TREFIKO_STANDALONE==='true';
  const trustedSetup=!standalone&&!!request.headers.get('oai-authenticated-user-id');
  return createService(env.DB,{setupKey:(env as unknown as Record<string,string>).TREFIKO_SETUP_KEY||'',trustedSetup,ai:(env as unknown as Record<string,unknown>).AI||null})(request);
}
export const GET=handle;
export const POST=handle;
