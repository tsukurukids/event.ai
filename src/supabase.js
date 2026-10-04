import { createClient } from '@supabase/supabase-js';

/** Dashboard の Project URL だけを使う（末尾の /rest/v1 などが付いていたら除去） */
export function normalizeSupabaseUrl(raw) {
  let url = String(raw || '').trim().replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1$/i, '');
  return url;
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
