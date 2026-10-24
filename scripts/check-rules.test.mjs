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
