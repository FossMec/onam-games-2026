import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let anon: SupabaseClient | undefined;
let admin: SupabaseClient | undefined;

export function getSupabaseAnon(): SupabaseClient {
  if (!anon) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set");
    }
    anon = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return anon;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    }
    admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return admin;
}
