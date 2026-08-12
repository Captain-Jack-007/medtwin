// Verifies MedTwin is ready for MEDTWIN_PRODUCTION_MODE before it is enabled.
// Checks required environment variables and confirms the production schema is
// present in the remote Supabase project (the `profiles` table). Never prints
// secret values — only whether each check passed.
//
// Usage:
//   node scripts/production-preflight.mjs           # report readiness
//   node scripts/production-preflight.mjs --enable   # also flip flags in .env.local when all checks pass
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(appDirectory, ".env.local");

loadEnvLocal();

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
];

const results = [];
for (const key of required) results.push({ label: `env ${key}`, ok: Boolean(process.env[key]?.trim()) });

const schemaOk = await checkSchema();
results.push({ label: "schema public.profiles exists", ok: schemaOk });

let allOk = true;
for (const { label, ok } of results) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error("\nPreflight failed. Resolve the FAIL items before enabling production mode.");
  if (!schemaOk) console.error("Schema missing? Run: npm run db:push (requires SUPABASE_DB_URL).");
  process.exit(1);
}

console.log("\nAll preflight checks passed.");

if (process.argv.includes("--enable")) {
  enableProductionFlags();
  console.log("Enabled MEDTWIN_PRODUCTION_MODE and NEXT_PUBLIC_MEDTWIN_PRODUCTION_MODE in .env.local.");
  console.log("Restart the server for the change to take effect.");
} else {
  console.log("Re-run with --enable to flip the production flags in .env.local.");
}

async function checkSchema() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return false;
  try {
    const response = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: anon },
    });
    // 200 (readable) or 401/403 (exists but RLS-protected) all mean the table
    // exists. 404 means the migration has not been applied.
    return response.status !== 404;
  } catch (error) {
    console.error(`  schema check request failed: ${error.message}`);
    return false;
  }
}

function enableProductionFlags() {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
  const flags = new Set(["MEDTWIN_PRODUCTION_MODE", "NEXT_PUBLIC_MEDTWIN_PRODUCTION_MODE"]);
  const seen = new Set();
  const next = lines.map((line) => {
    const index = line.indexOf("=");
    if (index === -1) return line;
    const key = line.slice(0, index).trim();
    if (flags.has(key)) {
      seen.add(key);
      return `${key}=true`;
    }
    return line;
  });
  for (const key of flags) if (!seen.has(key)) next.push(`${key}=true`);
  writeFileSync(envPath, next.join("\n"));
}

function loadEnvLocal() {
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
