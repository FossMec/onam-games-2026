import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "~/server/env";

let anon: SupabaseClient | undefined;
let admin: SupabaseClient | undefined;

export function getSupabaseAnon(): SupabaseClient {
  if (!anon) {
    const url = getServerEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
    const key = getServerEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
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
    const url = getServerEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
    const key = getServerEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ADMIN_KEY");
    if (!url || !key) {
      throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    }
    admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return admin;
}
