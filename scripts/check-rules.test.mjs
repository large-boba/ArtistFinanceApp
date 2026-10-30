// Proves check-rules catches each rule violation and passes correct code.
// Run: node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkRepo, findingsForFile } from "./check-rules.mjs";

const rules = (file, text) => findingsForFile(file, text).map((f) => f.rule);
const errorRules = (file, text) =>
  findingsForFile(file, text).filter((f) => f.severity === "error").map((f) => f.rule);

const GOOD_MIGRATION = `
create schema if not exists private;

create function private.has_permission(target_account uuid, needed text)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select true $$;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  created_by uuid not null,
  expense_date date not null,
  original_amount_minor bigint not null,
  home_amount_minor bigint not null,
  fee_amount bigint not null default 0,
  fx_rate numeric(20, 10) not null,
  rate_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.expenses enable row level security;
`;

test("a correct migration passes", () => {
  assert.deepEqual(rules("m.sql", GOOD_MIGRATION), []);
});

test("table without RLS in the same migration is an error", () => {
  const sql = "create table events (\n  id uuid primary key\n);\n";
  assert.deepEqual(errorRules("m.sql", sql), ["rls-in-same-migration"]);
});

test("RLS matching handles schema prefixes and if not exists", () => {
  const sql = "create table if not exists events (\n  id uuid\n);\nalter table public.events enable row level security;\n";
  assert.deepEqual(rules("m.sql", sql), []);
});

test("RLS in a comment does not count", () => {
  const sql = "create table events (\n  id uuid\n);\n-- alter table events enable row level security;\n";
  assert.deepEqual(errorRules("m.sql", sql), ["rls-in-same-migration"]);
});

test("temporary tables are exempt from the RLS rule", () => {
  assert.deepEqual(rules("m.sql", "create temp table scratch (\n  id uuid\n);\n"), []);
});

test("security definer without search_path is an error", () => {
  const sql = "create or replace function private.f()\nreturns boolean\nlanguage sql security definer\nas $$ select true $$;\n";
  assert.deepEqual(errorRules("m.sql", sql), ["definer-search-path"]);
});

test("transaction date stored as timestamp is an error", () => {
  const sql = GOOD_MIGRATION.replace("expense_date date not null", "expense_date timestamptz not null");
  assert.deepEqual(errorRules("m.sql", sql), ["date-not-timestamp"]);
});

test("created_at / updated_at timestamps are allowed", () => {
  assert.ok(!rules("m.sql", GOOD_MIGRATION).includes("date-not-timestamp"));
});

test("money stored as numeric or float is an error", () => {
  for (const type of ["numeric(12,2)", "double precision", "real", "float8", "money"]) {
    const sql = GOOD_MIGRATION.replace("home_amount_minor bigint", `home_amount_minor ${type}`);
    assert.deepEqual(errorRules("m.sql", sql), ["money-integer-minor-units"], type);
  }
});

test("exchange rate stored as float or integer is an error", () => {
  for (const type of ["double precision", "real", "bigint"]) {
    const sql = GOOD_MIGRATION.replace("fx_rate numeric(20, 10)", `fx_rate ${type}`);
    assert.deepEqual(errorRules("m.sql", sql), ["rate-numeric"], type);
  }
});

test("column types are checked in alter table ... add column", () => {
  const sql = "alter table public.income add column total_amount double precision;\n";
  assert.deepEqual(errorRules("m.sql", sql), ["money-integer-minor-units"]);
});

test("column names that start with a keyword are still checked", () => {
  const sql = "create table t (\n  total_amount real,\n  on_date timestamptz,\n  setup_fee float8\n);\nalter table t enable row level security;\n";
  assert.deepEqual(errorRules("m.sql", sql), [
    "money-integer-minor-units", "date-not-timestamp", "money-integer-minor-units",
  ]);
});

test("check-rules-ignore on the line above silences one finding", () => {
  const bad = "alter table public.income add column total_amount numeric;\n";
  assert.deepEqual(errorRules("m.sql", bad), ["money-integer-minor-units"]);
  assert.deepEqual(rules("m.sql", `-- check-rules-ignore: legacy import column\n${bad}`), []);
});

test("file input with capture is an error", () => {
  const tsx = `export function P() { return <input type="file" accept="image/*" capture="environment" />; }`;
  assert.deepEqual(errorRules("p.tsx", tsx), ["no-capture-attribute"]);
  const ok = `export function P() { return <input type="file" accept="image/*,application/pdf" multiple />; }`;
  assert.deepEqual(rules("p.tsx", ok), []);
});

test("new Date from a YYYY-MM-DD string is an error", () => {
  assert.deepEqual(errorRules("d.ts", `const d = new Date("2026-07-01");`), ["no-date-from-iso-string"]);
  assert.deepEqual(rules("d.ts", `const d = new Date();`), []);
});

test("secrets with NEXT_PUBLIC_ prefix are errors, publishable key is fine", () => {
  assert.deepEqual(errorRules("a.ts", "process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"), ["no-public-secret"]);
  assert.deepEqual(rules("a.ts", "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), []);
  assert.deepEqual(errorRules(".env.example", "NEXT_PUBLIC_ANTHROPIC_API_KEY="), ["no-public-secret"]);
});

test("client components may not read server env vars", () => {
  const tsx = `"use client";\nconst k = process.env.SUPABASE_SECRET_KEY;\n`;
  assert.deepEqual(errorRules("c.tsx", tsx), ["no-server-env-in-client"]);
  const server = `const k = process.env.SUPABASE_SECRET_KEY;\n`;
  assert.deepEqual(rules("route.ts", server), []);
});

test("server actions are a warning, not an error", () => {
  const ts = `"use server";\nexport async function save() {}\n`;
  assert.deepEqual(rules("a.ts", ts), ["prefer-route-handlers"]);
  assert.deepEqual(errorRules("a.ts", ts), []);
});

// Cases found by the code reviewer on 2026-10-24.
test("one-line tables and several columns per line are checked", () => {
  const sql = "create table public.t (id uuid, amount numeric, expense_date timestamptz);\nalter table public.t enable row level security;\n";
  assert.deepEqual(errorRules("m.sql", sql), ["money-integer-minor-units", "date-not-timestamp"]);
  const two = "create table t (\n  id uuid primary key, home_amount real\n);\nalter table t enable row level security;\n";
  assert.deepEqual(errorRules("m.sql", two), ["money-integer-minor-units"]);
});

test("add without the word column, and alter column type, are checked", () => {
  assert.deepEqual(errorRules("m.sql", "alter table public.expenses add home_amount numeric(12,2);\n"), ["money-integer-minor-units"]);
  assert.deepEqual(errorRules("m.sql", "alter table public.expenses alter column expense_date type timestamptz;\n"), ["date-not-timestamp"]);
  assert.deepEqual(errorRules("m.sql", "alter table public.t add constraint total_positive check (total_minor > 0);\n"), []);
});

test("search_path must be set to empty, and not only inside the body", () => {
  const head = "create function private.f()\nreturns boolean\nlanguage sql security definer\n";
  assert.deepEqual(errorRules("m.sql", `${head}set search_path = public\nas $$ select true $$;\n`), ["definer-search-path"]);
  assert.deepEqual(errorRules("m.sql", `${head}as $$ set search_path = ''; select true $$;\n`), ["definer-search-path"]);
  assert.deepEqual(errorRules("m.sql", `${head}set search_path to ''\nas $$ select true $$;\n`), []);
});

test("function bodies and return tables are not mistaken for columns", () => {
  const sql = "create function private.totals()\nreturns table (total_minor numeric)\nlanguage plpgsql security invoker\nas $$\ndeclare total numeric;\nbegin\n  return;\nend $$;\n";
  assert.deepEqual(rules("m.sql", sql), []);
});

test("percentages and ratios are not money", () => {
  const sql = "create table t (\n  fee_percent numeric(5,2),\n  tax_rate numeric\n);\nalter table t enable row level security;\n";
  assert.deepEqual(rules("m.sql", sql), []);
});

test("registered-from style dates must be date columns", () => {
  assert.deepEqual(errorRules("m.sql", "alter table accounts add column tax_registered_from timestamptz;\n"), ["date-not-timestamp"]);
});

test("views must use security_invoker; materialized views stay private", () => {
  assert.deepEqual(errorRules("m.sql", "create view public.profit as select 1;\n"), ["view-security-invoker"]);
  assert.deepEqual(rules("m.sql", "create or replace view public.profit with (security_invoker = true) as select 1;\n"), []);
  assert.deepEqual(errorRules("m.sql", "create materialized view public.totals as select 1;\n"), ["view-security-invoker"]);
  assert.deepEqual(rules("m.sql", "create materialized view private.totals as select 1;\n"), []);
});

test("capture is caught after arrow-function props, and data-capture-id is fine", () => {
  const tsx = `<input type="file" onChange={(e) => onFiles(e)} capture="environment" />`;
  assert.deepEqual(errorRules("p.tsx", tsx), ["no-capture-attribute"]);
  assert.deepEqual(rules("p.tsx", `<input type="file" data-capture-id="x" onChange={() => a.capture} />`), []);
});

test("more secret spellings are caught", () => {
  assert.deepEqual(errorRules("a.ts", "process.env.NEXT_PUBLIC_OPENAI_KEY"), ["no-public-secret"]);
  assert.deepEqual(errorRules(".env.example", "export NEXT_PUBLIC_SUPABASE_SECRET_KEY="), ["no-public-secret"]);
  assert.deepEqual(rules(".env.example", "NEXT_PUBLIC_SUPABASE_ANON_KEY="), []);
  assert.deepEqual(errorRules("c.tsx", `"use client";\nconst { SUPABASE_SECRET_KEY } = process.env;\n`), ["no-server-env-in-client"]);
});

// Cases found by the code reviewer in round 2.
test("words containing count (discount, account) are still money", () => {
  const sql = "create table t (\n  discount_amount numeric(12,2),\n  account_total real,\n  sale_count integer,\n  item_qty numeric\n);\nalter table t enable row level security;\n";
  assert.deepEqual(errorRules("m.sql", sql), ["money-integer-minor-units", "money-integer-minor-units"]);
});

test("SQL inside string literals is ignored, and a quoted body cannot fake search_path", () => {
  assert.deepEqual(rules("m.sql", "comment on table public.t is 'old: create table x (y float)';\n"), []);
  const quotedBody = "create function private.f() returns void language sql security definer as 'set search_path = '''' ; select 1';\n";
  assert.deepEqual(errorRules("m.sql", quotedBody), ["definer-search-path"]);
});

test("security_invoker without a value, and recursive views", () => {
  assert.deepEqual(rules("m.sql", "create view public.v with (security_invoker) as select 1;\n"), []);
  assert.deepEqual(errorRules("m.sql", "create recursive view public.v (n) as select 1;\n"), ["view-security-invoker"]);
});

test("public keys are allowed and capitalised Input components are checked", () => {
  assert.deepEqual(rules("a.ts", "process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY"), []);
  assert.deepEqual(errorRules("p.tsx", `<Input type="file" capture />`), ["no-capture-attribute"]);
  assert.deepEqual(rules("p.tsx", `<InputGroup capture="x" />`), []);
});

// Cases found by the security reviewer.
test("security definer functions are only allowed in the private schema", () => {
  const exposed = "create function public.account_totals(p_account uuid)\nreturns bigint\nlanguage sql security definer\nset search_path = ''\nas $$ select 1::bigint $$;\n";
  assert.deepEqual(errorRules("m.sql", exposed), ["definer-only-in-private"]);
  const unqualified = exposed.replace("public.account_totals", "account_totals");
  assert.deepEqual(errorRules("m.sql", unqualified), ["definer-only-in-private"]);
  assert.deepEqual(errorRules("m.sql", "alter function public.f() security definer;\n"), ["definer-only-in-private"]);
  const invoker = exposed.replace("security definer", "security invoker");
  assert.deepEqual(rules("m.sql", invoker), []);
});

test("turning protections off is an error; using (true) is a warning", () => {
  assert.deepEqual(errorRules("m.sql", "alter table public.expenses disable row level security;\n"), ["rls-never-disabled"]);
  assert.deepEqual(errorRules("m.sql", "alter view public.profit set (security_invoker = false);\n"), ["view-security-invoker"]);
  const open = "create policy \"all\" on public.fx_rates for select to authenticated using (true);\n";
  assert.deepEqual(rules("m.sql", open), ["policy-allows-everything"]);
  assert.deepEqual(errorRules("m.sql", open), []);
});

// Cases from the T0.5 security review (Cloudflare hosting).
test("wrangler vars must not hold secrets", () => {
  const jsonc = `{\n  "name": "bentobudget",\n  "vars": {\n    "APP_ENV": "preview",\n    "SUPABASE_SECRET_KEY": "sb_secret_x"\n  }\n}\n`;
  assert.deepEqual(errorRules("wrangler.jsonc", jsonc), ["no-secret-in-wrangler-vars"]);
  const toml = `name = "bentobudget"\n[vars]\nAPP_ENV = "preview"\nANTHROPIC_API_KEY = "x"\n[assets]\ndirectory = ".open-next/assets"\n`;
  assert.deepEqual(errorRules("wrangler.toml", toml), ["no-secret-in-wrangler-vars"]);
  assert.deepEqual(rules("wrangler.jsonc", `{\n  "name": "x",\n  "assets": { "binding": "ASSETS" }\n}\n`), []);
});

test("wrangler vars are checked however they're laid out (review round 2)", () => {
  // One-line block, key on the same line as "vars", and nothing after it misflagged.
  const oneLine = `{\n  "vars": {"STRIPE_SECRET_KEY": "sk_live_x"},\n  "kv_namespaces": [{"binding": "SESSION_TOKEN_STORE"}]\n}\n`;
  const found = findingsForFile("wrangler.jsonc", oneLine);
  assert.deepEqual(found.map((f) => [f.rule, f.line]), [["no-secret-in-wrangler-vars", 2]]);
  const sameLine = `{\n  "vars": { "APP_ENV": "x", "API_TOKEN": "y",\n    "OK": "z" }\n}\n`;
  assert.deepEqual(errorRules("wrangler.jsonc", sameLine), ["no-secret-in-wrangler-vars"]);
  // Braces inside comments and strings don't confuse it.
  const tricky = `{\n  // "vars": { "FAKE_SECRET": 1 }\n  "vars": {\n    "NOTE": "a } b {",\n    /* } */\n    "DB_PASSWORD": "x"\n  }\n}\n`;
  assert.deepEqual(findingsForFile("wrangler.jsonc", tricky).map((f) => f.line), [6]);
  // Nested per-environment vars.
  assert.deepEqual(errorRules("wrangler.jsonc", `{ "env": { "preview": { "vars": { "PRIVATE_KEY": "x" } } } }`), ["no-secret-in-wrangler-vars"]);
});

test("lowercase and quoted secret names in wrangler vars are checked", () => {
  assert.deepEqual(errorRules("wrangler.jsonc", `{ "vars": { "secret_token": "x" } }`), ["no-secret-in-wrangler-vars"]);
  assert.deepEqual(errorRules("wrangler.toml", `[ vars ]\n'API_TOKEN' = "x"\n`), ["no-secret-in-wrangler-vars"]);
});

test("TOML vars with comments and inline tables are checked", () => {
  assert.deepEqual(errorRules("wrangler.toml", `[vars] # settings\nAPI_TOKEN = "x"\n`), ["no-secret-in-wrangler-vars"]);
  assert.deepEqual(errorRules("wrangler.toml", `name = "x"\nvars = { API_TOKEN = "x", APP_ENV = "y" }\n`), ["no-secret-in-wrangler-vars"]);
  assert.deepEqual(errorRules("wrangler.toml", `[env.preview.vars]\nSECRET_SALT = "x"\n`), ["no-secret-in-wrangler-vars"]);
});

test("example env files list names only", () => {
  assert.deepEqual(errorRules(".env.example", "SUPABASE_SECRET_KEY=sb_secret_abc123\n"), ["no-secret-in-example"]);
  assert.deepEqual(errorRules(".dev.vars.example", "ANTHROPIC_API_KEY=sk-ant-123\n"), ["no-secret-in-example"]);
  assert.deepEqual(rules(".env.example", "SUPABASE_SECRET_KEY=\nANTHROPIC_API_KEY=<your key>\n# NEXTJS_ENV=development\nAPP_ENV=preview\n"), []);
  assert.deepEqual(errorRules(".env.example", "SUPABASE_SECRET_KEY=your_sb_secret_abc123\n"), ["no-secret-in-example"]);
  assert.deepEqual(errorRules(".env.example", "ANTHROPIC_API_KEY=<sk-ant-api03-abc>\n"), ["no-secret-in-example"]);
  assert.deepEqual(errorRules(".env.sample", "DB_PASSWORD=hunter2\n"), ["no-secret-in-example"]);
});

// T1.6 security review: the test seam's flag can't be set by a committed config file.
test("NEXT_PUBLIC_E2E in env files or wrangler config is an error", () => {
  for (const file of [".env", ".env.production", ".env.local", ".env.example", ".dev.vars"]) {
    assert.deepEqual(errorRules(file, "NEXT_PUBLIC_E2E=1\n"), ["no-e2e-flag-in-config"], file);
  }
  assert.deepEqual(errorRules(".env.production", "export NEXT_PUBLIC_E2E=\"1\"\n"), ["no-e2e-flag-in-config"]);
  assert.deepEqual(errorRules("wrangler.jsonc", `{ "vars": { "NEXT_PUBLIC_E2E": "1" } }`), ["no-e2e-flag-in-config"]);
  assert.deepEqual(errorRules("wrangler.toml", `[vars]\nNEXT_PUBLIC_E2E = "1"\n`), ["no-e2e-flag-in-config"]);
  assert.deepEqual(rules(".env.production", "NEXT_PUBLIC_SITE_NAME=BentoBudget\n"), []);
});

test("checkRepo scans supabase/ and src/ and skips node_modules", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-rules-"));
  fs.mkdirSync(path.join(root, "supabase/migrations"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/app"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules/pkg"), { recursive: true });
  fs.writeFileSync(path.join(root, "supabase/migrations/001.sql"), "create table t (\n  id uuid\n);\n");
  fs.writeFileSync(path.join(root, "src/app/page.tsx"), `const d = new Date("2026-01-01");`);
  fs.writeFileSync(path.join(root, "node_modules/pkg/x.js"), `const d = new Date("2026-01-01");`);
  const found = checkRepo(root).map((f) => `${f.file}:${f.rule}`).sort();
  assert.deepEqual(found, [
    `${path.join("src", "app", "page.tsx")}:no-date-from-iso-string`,
    `${path.join("supabase", "migrations", "001.sql")}:rls-in-same-migration`,
  ]);
  fs.rmSync(root, { recursive: true, force: true });
});
