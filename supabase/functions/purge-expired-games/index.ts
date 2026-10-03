import { createClient } from 'npm:@supabase/supabase-js@2.99.1';
import { purgeExpiredGames } from '../_shared/purgeExpiredGames.js';

Deno.serve(async (request) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || request.headers.get('authorization') !== `Bearer ${key}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const body = await request.json();
    const client = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const count = await purgeExpiredGames(client, { dryRun: body.dryRun === true });
    return Response.json({ processed: count, dryRun: body.dryRun === true });
  } catch (error) {
    console.error('Expired game cleanup failed', error);
    return Response.json({ error: 'Cleanup failed. Remaining records will be retried.' }, { status: 500 });
  }
});
