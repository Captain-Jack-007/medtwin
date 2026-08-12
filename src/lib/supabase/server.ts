import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { requireSupabasePublicConfig } from "./env";

export async function getSupabaseServerClient() {
  const config = requireSupabasePublicConfig();
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        try {
          entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot mutate cookies. Route handlers and proxy can.
        }
      },
    },
  });
}

export function getSupabaseAdminClient(): SupabaseClient {
  const config = requireSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("Supabase service role key is not configured");
  return createClient(config.url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
