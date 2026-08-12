export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function readSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = readSupabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured");
  return config;
}

export function isProductionDataMode() {
  return process.env.MEDTWIN_PRODUCTION_MODE === "true";
}

export function isBrowserProductionDataMode() {
  return process.env.NEXT_PUBLIC_MEDTWIN_PRODUCTION_MODE === "true";
}
