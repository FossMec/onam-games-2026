import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    if (!url || !key) {
      throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
    }
    client = createClient(url, key, {
      auth: {
        flowType: "implicit",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
