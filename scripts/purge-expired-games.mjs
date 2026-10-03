/** Storage API removes physical files before their database record. Run hourly. */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { purgeExpiredGames } from '../supabase/functions/_shared/purgeExpiredGames.js';
export { purgeExpiredGames };

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const envFile=new URL('../.env',import.meta.url);
  if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').split('\n')) {
    const match=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if(match&&!process.env[match[1]])process.env[match[1]]=match[2].trim().replace(/^(['"])(.*)\1$/,'$2');
  }
  const url=process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key){console.error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');process.exitCode=1;}
  else try {
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const count=await purgeExpiredGames(client,{dryRun:process.argv.includes('--dry-run')});
    console.log(`Processed ${count} expired workshop games.`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
