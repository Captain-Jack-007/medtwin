"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabasePublicConfig } from "./env";

let client: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = readSupabasePublicConfig();
  client = config ? createBrowserClient(config.url, config.anonKey) : null;
  return client;
}
