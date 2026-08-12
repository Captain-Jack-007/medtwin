// Applies MedTwin SQL migrations to the remote Supabase Postgres database in
// filename order, tracking applied migrations in a dedicated table so re-runs
// are idempotent. Uses psql over a direct database connection.
//
// Required: SUPABASE_DB_URL (the project's Postgres connection string / URI).
// Get it from Supabase → Project Settings → Database → Connection string (URI).
// This is a secret; keep it in .env.local (git-ignored), never on the CLI.
//
// Usage:
//   node scripts/db-migrate.mjs          # apply pending migrations
//   node scripts/db-migrate.mjs --list   # list migrations and applied state
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = join(appDirectory, "supabase", "migrations");

loadEnvLocal();

const connectionString = process.env.SUPABASE_DB_URL?.trim();
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.");
  console.error("Add it to .env.local (Supabase → Project Settings → Database → Connection string → URI).");
  process.exit(1);
}

const psql = resolvePsql();
const migrations = listMigrations();
const listOnly = process.argv.includes("--list");

ensureTrackingTable();
const applied = new Set(queryAppliedNames());

if (listOnly) {
  for (const name of migrations) console.log(`${applied.has(name) ? "applied" : "pending"}\t${name}`);
  process.exit(0);
}

const pending = migrations.filter((name) => !applied.has(name));
if (pending.length === 0) {
  console.log("No pending migrations. Database schema is up to date.");
  process.exit(0);
}

for (const name of pending) {
  console.log(`Applying ${name}…`);
  applyMigration(name);
  console.log(`  ✓ ${name}`);
}
console.log(`Applied ${pending.length} migration(s).`);

function listMigrations() {
  if (!existsSync(migrationsDirectory)) {
    console.error(`No migrations directory at ${migrationsDirectory}`);
    process.exit(1);
  }
  return readdirSync(migrationsDirectory).filter((file) => file.endsWith(".sql")).sort();
}

function resolvePsql() {
  for (const candidate of ["psql", "/usr/local/bin/psql", "/opt/homebrew/bin/psql"]) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  console.error("psql was not found. Install the PostgreSQL client (e.g. `brew install libpq`).");
  process.exit(1);
}

function runPsql(sql, { captureOutput = false } = {}) {
  const args = [connectionString, "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-c", sql];
  return execFileSync(psql, args, {
    stdio: captureOutput ? ["ignore", "pipe", "inherit"] : ["ignore", "inherit", "inherit"],
    encoding: "utf8",
  });
}

function runPsqlFile(path) {
  const args = [connectionString, "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "--single-transaction", "-f", path];
  execFileSync(psql, args, { stdio: ["ignore", "inherit", "inherit"] });
}

function ensureTrackingTable() {
  runPsql(
    "create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz not null default now());",
  );
}

function queryAppliedNames() {
  const output = runPsql("select name from public.schema_migrations;", { captureOutput: true });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("name") && !line.startsWith("-") && !line.includes("row"));
}

function applyMigration(name) {
  runPsqlFile(join(migrationsDirectory, name));
  const escaped = name.replace(/'/g, "''");
  runPsql(`insert into public.schema_migrations (name) values ('${escaped}') on conflict (name) do nothing;`);
}

function loadEnvLocal() {
  const envPath = join(appDirectory, ".env.local");
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
