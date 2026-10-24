#!/usr/bin/env node
// Automatic checks for the build guide's most expensive-to-get-wrong rules.
// Runs with plain Node (no dependencies) from CI, from a Claude Code hook after
// every edit, and by hand: `node scripts/check-rules.mjs [repo-root]`.
//
// To silence one finding on purpose, put `check-rules-ignore: <reason>` in a
// comment on the same line or the line above. Reviewers check every use.
//
// SQL checks assume one column definition per line, which is how our
// migrations are written.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "out", "build", "dist", "coverage",
  "scripts", ".claude", "docs", "public", "playwright-report", "test-results",
]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const TIMESTAMP_TYPES = /^timestamp(tz)?\b|^timestamp\s+with(out)?\s+time\s+zone/;
const NON_INTEGER_MONEY_TYPES = /^(float|float4|float8|real|double\s+precision|numeric|decimal|money)\b/;
const EXACT_DECIMAL_TYPES = /^(numeric|decimal)\b/;
const MONEY_NAME = /(amount|_minor$|^gross|^fees?$|_fees?$|^fees?_|total|tax_paid|tax_collected|price)/;
const RATE_NAME = /(^|_)rate$/;
const DATE_NAME = /(^date$|_date$|_on$)/;
const SECRET_NAME = /(SECRET|SERVICE_ROLE|PRIVATE|API_KEY|TOKEN|PASSWORD)/;
const SKIP_LINE_START = /^(?:(?:create|alter|drop|constraint|primary|unique|foreign|check|exclude|using|with|select|insert|update|delete|grant|revoke|comment|returns|language|security|set|as|begin|end|declare|return|if|then|else|for|on|to|from|where|and|or|not|references|perform|raise|loop|values)\b|\$\$|\)|\()/;

export function findingsForFile(filePath, text) {
  const ext = path.extname(filePath).toLowerCase();
  let findings = [];
  if (ext === ".sql") findings = checkSql(text);
  else if (CODE_EXT.has(ext)) findings = checkCode(text);
  else if (path.basename(filePath).startsWith(".env")) findings = checkEnvFile(text);
  const lines = text.split("\n");
  return findings
    .filter((f) => !isIgnored(lines, f.line))
    .map((f) => ({ file: filePath, ...f }));
}

function isIgnored(lines, line) {
  const here = lines[line - 1] ?? "";
  const above = lines[line - 2] ?? "";
  return here.includes("check-rules-ignore") || above.includes("check-rules-ignore");
}

// Replace comments with spaces so line numbers stay correct.
function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/--[^\n]*/g, (m) => " ".repeat(m.length));
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function normaliseTable(name) {
  const clean = name.replace(/"/g, "").toLowerCase();
  return clean.includes(".") ? clean : `public.${clean}`;
}

function checkSql(raw) {
  const sql = stripSqlComments(raw).toLowerCase();
  const findings = [];

  // RLS must be enabled in the same migration that creates the table.
  const rlsEnabled = new Set();
  for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/g)) {
    rlsEnabled.add(normaliseTable(m[1]));
  }
  for (const m of sql.matchAll(/create\s+(?:(?:global|local)\s+)?(temp\s+|temporary\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/g)) {
    if (m[1] && m[1].trim().startsWith("temp")) continue;
    const table = normaliseTable(m[2]);
    if (!rlsEnabled.has(table)) {
      findings.push({
        line: lineOf(sql, m.index), severity: "error", rule: "rls-in-same-migration",
        message: `table ${table} is created without "alter table ${table} enable row level security" in the same migration (guide §5, Stage 3)`,
      });
    }
  }

  // security definer functions must pin search_path.
  const boundary = /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure|table|policy|trigger|view|index|schema|type)\b/g;
  const starts = [...sql.matchAll(boundary)].map((m) => m.index);
  for (let i = 0; i < starts.length; i++) {
    const segment = sql.slice(starts[i], starts[i + 1] ?? sql.length);
    if (!/^create\s+(or\s+replace\s+)?(function|procedure)/.test(segment)) continue;
    if (/security\s+definer/.test(segment) && !/set\s+search_path/.test(segment)) {
      findings.push({
        line: lineOf(sql, starts[i]), severity: "error", rule: "definer-search-path",
        message: "security definer function has no `set search_path = ''` (guide §5)",
      });
    }
  }

  // Column type rules, one column per line.
  const lines = sql.split("\n");
  lines.forEach((original, idx) => {
    let line = original.trim().replace(/^,\s*/, "");
    line = line.replace(/^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?[\w."]+\s+/, "");
    line = line.replace(/^add\s+column\s+(?:if\s+not\s+exists\s+)?/, "");
    line = line.replace(/^alter\s+column\s+([\w"]+)\s+(?:set\s+data\s+)?type\s+/, "$1 ");
    if (!line || SKIP_LINE_START.test(line)) return;
    const m = line.match(/^"?([a-z_][a-z0-9_]*)"?\s+([a-z][a-z0-9_]*(?:\s+(?:precision|with(?:out)?\s+time\s+zone))?)/);
    if (!m) return;
    const [, column, type] = m;
    const at = { line: idx + 1, severity: "error" };
    if (DATE_NAME.test(column) && TIMESTAMP_TYPES.test(type)) {
      findings.push({ ...at, rule: "date-not-timestamp",
        message: `column ${column} is ${type}; calendar dates must be \`date\` columns (guide §6)` });
    }
    if (RATE_NAME.test(column)) {
      if (!EXACT_DECIMAL_TYPES.test(type)) {
        findings.push({ ...at, rule: "rate-numeric",
          message: `rate column ${column} is ${type}; exchange and tax rates must be \`numeric\` (guide §9)` });
      }
    } else if (MONEY_NAME.test(column) && NON_INTEGER_MONEY_TYPES.test(type)) {
      findings.push({ ...at, rule: "money-integer-minor-units",
        message: `money column ${column} is ${type}; store integer minor units (bigint) (guide §7)` });
    }
  });

  return findings;
}

function checkCode(text) {
  const findings = [];
  const add = (index, severity, rule, message) =>
    findings.push({ line: lineOf(text, index), severity, rule, message });

  for (const m of text.matchAll(/<input\b[^>]*?\bcapture\b/g)) {
    add(m.index, "error", "no-capture-attribute",
      "file input has a `capture` attribute; leave it out so phones offer camera, library and files (guide §11)");
  }

  for (const m of text.matchAll(/new\s+Date\(\s*["'`]\d{4}-\d{2}-\d{2}["'`]\s*\)|Date\.parse\(\s*["'`]\d{4}-\d{2}-\d{2}["'`]\s*\)/g)) {
    add(m.index, "error", "no-date-from-iso-string",
      "a YYYY-MM-DD string turned into a Date means midnight UTC and shifts the day; keep dates as strings (guide §6)");
  }

  for (const m of text.matchAll(/NEXT_PUBLIC_\w+/g)) {
    if (SECRET_NAME.test(m[0])) {
      add(m.index, "error", "no-public-secret",
        `${m[0]} looks like a secret but NEXT_PUBLIC_ ships it to every browser (guide §5)`);
    }
  }

  if (/^\s*["']use client["']/m.test(text)) {
    for (const m of text.matchAll(/process\.env\.(\w+)/g)) {
      if (!m[1].startsWith("NEXT_PUBLIC_")) {
        add(m.index, "error", "no-server-env-in-client",
          `client component reads process.env.${m[1]}; secrets and server settings stay on the server (guide §5)`);
      }
    }
  }

  for (const m of text.matchAll(/^\s*["']use server["']/gm)) {
    add(m.index, "warning", "prefer-route-handlers",
      "server action found; put important logic in route handlers so other clients can call it (guide §4)");
  }

  return findings;
}

function checkEnvFile(text) {
  const findings = [];
  text.split("\n").forEach((line, idx) => {
    const name = line.split("=")[0].trim();
    if (name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name)) {
      findings.push({ line: idx + 1, severity: "error", rule: "no-public-secret",
        message: `${name} looks like a secret but NEXT_PUBLIC_ ships it to every browser (guide §5)` });
    }
  });
  return findings;
}

function* walk(dir, root) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (dir === root && SKIP_DIRS.has(entry.name)) continue;
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walk(path.join(dir, entry.name), root);
    } else {
      yield path.join(dir, entry.name);
    }
  }
}

export function checkRepo(root) {
  const findings = [];
  for (const file of walk(root, root)) {
    const ext = path.extname(file).toLowerCase();
    const isEnv = path.basename(file).startsWith(".env");
    if (ext !== ".sql" && !CODE_EXT.has(ext) && !isEnv) continue;
    const rel = path.relative(root, file);
    findings.push(...findingsForFile(rel, fs.readFileSync(file, "utf8")));
  }
  return findings;
}

export function format(findings) {
  return findings
    .map((f) => `${f.file}:${f.line}  ${f.severity.toUpperCase()} [${f.rule}] ${f.message}`)
    .join("\n");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const findings = checkRepo(root);
  const errors = findings.filter((f) => f.severity === "error");
  if (findings.length) console.log(format(findings));
  console.log(`check-rules: ${errors.length} error(s), ${findings.length - errors.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
