#!/usr/bin/env node
// Automatic checks for the build guide's most expensive-to-get-wrong rules.
// Runs with plain Node (no dependencies) from CI, from a Claude Code hook after
// every edit, and by hand: `node scripts/check-rules.mjs [repo-root]`.
//
// To silence one finding on purpose, put `check-rules-ignore: <reason>` in a
// comment on the same line or the line above. Reviewers check every use.
//
// It is a seatbelt: it catches the common ways to break a rule, and the
// reviewers and tests catch the rest.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "out", "build", "dist", "coverage",
  ".open-next", ".wrangler", // Cloudflare build output (generated, ignored by Git)
  "scripts", ".claude", "docs", "public", "playwright-report", "test-results",
]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const TIMESTAMP_TYPE = /^timestamp/;
const NON_INTEGER_TYPE = /^(float|float4|float8|real|double precision|numeric|decimal|money)$/;
const EXACT_DECIMAL_TYPE = /^(numeric|decimal)$/;
const MONEY_NAME = /(amount|_minor$|^gross|^fees?$|_fees?$|^fees?_|total|tax_paid|tax_collected|price)/;
const NOT_MONEY_NAME = /(^|_)(percent|pct|bps|ratio|count|qty|quantity)(_|$)|(^|_)rate$/;
const RATE_NAME = /(^|_)rate$/;
const DATE_NAME = /(^date$|_date$|_on$|_from$|_until$)/;
const SECRET_NAME = /(SECRET|SERVICE_ROLE|PRIVATE|API_KEY|TOKEN|PASSWORD)/;
const PUBLIC_KEY_NAME = /(PUBLISHABLE|ANON|PUBLIC)_KEY$/;
const COLUMN_ITEM_SKIP = /^(constraint|primary|unique|foreign|check|exclude|like)\b/;

const looksSecret = (rawName) => {
  const name = rawName.toUpperCase();
  return SECRET_NAME.test(name) || (/KEY$/.test(name) && !PUBLIC_KEY_NAME.test(name));
};
// Keys designed to be public (e.g. web-push VAPID public keys) are fine.

export function findingsForFile(filePath, text) {
  const ext = path.extname(filePath).toLowerCase();
  let findings = [];
  if (ext === ".sql") findings = checkSql(text);
  else if (CODE_EXT.has(ext)) findings = checkCode(text);
  else if (isEnvLike(filePath)) findings = checkEnvFile(text, filePath);
  else if (isWranglerConfig(filePath)) findings = checkWranglerConfig(text, filePath);
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

// Blank out comments and the contents of 'string literals' (keeping lengths
// and quotes) so that indexes and line numbers still match the original text,
// SQL quoted inside strings is ignored, and an empty '' stays visible.
function blankSqlNoise(sql) {
  let out = "";
  let i = 0;
  const blank = (s) => s.replace(/[^\n]/g, " ");
  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      out += blank(sql.slice(i, stop));
      i = stop;
    } else if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += blank(sql.slice(i, stop));
      i = stop;
    } else if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      out += "'" + blank(sql.slice(i + 1, j)) + (j < sql.length ? "'" : "");
      i = j + 1;
    } else {
      out += sql[i++];
    }
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function normaliseName(name) {
  const clean = name.replace(/"/g, "").toLowerCase();
  return clean.includes(".") ? clean : `public.${clean}`;
}

// Index just after the parenthesis that closes the one at `open`.
function closeParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return text.length;
}

// Split on commas that are not inside parentheses, keeping each item's offset.
function splitTopLevel(text, offset) {
  const items = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if ((c === "," && depth === 0) || i === text.length) {
      const raw = text.slice(start, i);
      const lead = raw.length - raw.trimStart().length;
      if (raw.trim()) items.push({ text: raw.trim(), index: offset + start + lead });
      start = i + 1;
    }
  }
  return items;
}

function columnType(rest) {
  const m = rest.match(/^(double\s+precision|timestamp(?:tz)?(?:\s*\(\d+\))?(?:\s+with(?:out)?\s+time\s+zone)?|[a-z_][a-z0-9_.]*)/);
  return m ? m[1].replace(/\s+/g, " ").replace(/\s*\(\d+\)/, "") : "";
}

function checkColumn(column, type, line, findings) {
  const at = { line, severity: "error" };
  if (DATE_NAME.test(column) && TIMESTAMP_TYPE.test(type)) {
    findings.push({ ...at, rule: "date-not-timestamp",
      message: `column ${column} is ${type}; calendar dates must be \`date\` columns (guide §6)` });
  }
  if (RATE_NAME.test(column)) {
    if (!EXACT_DECIMAL_TYPE.test(type)) {
      findings.push({ ...at, rule: "rate-numeric",
        message: `rate column ${column} is ${type}; exchange and tax rates must be \`numeric\` (guide §9)` });
    }
  } else if (MONEY_NAME.test(column) && !NOT_MONEY_NAME.test(column) && NON_INTEGER_TYPE.test(type)) {
    findings.push({ ...at, rule: "money-integer-minor-units",
      message: `money column ${column} is ${type}; store integer minor units (bigint) (guide §7)` });
  }
}

function checkSql(raw) {
  const sql = blankSqlNoise(raw).toLowerCase();
  const findings = [];
  const err = (index, rule, message) => findings.push({ line: lineOf(sql, index), severity: "error", rule, message });

  // Function bodies ($$ ... $$) are code, not table definitions: blank them for
  // the table checks, but keep them for the function checks.
  const outside = sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, (m) => m.replace(/[^\n]/g, " "));

  // 1. RLS must be enabled in the same migration that creates the table.
  const rlsEnabled = new Set();
  for (const m of outside.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+enable\s+row\s+level\s+security/g)) {
    rlsEnabled.add(normaliseName(m[1]));
  }

  // 2. Column types in create table (...) and alter table ... add/alter.
  for (const m of outside.matchAll(/create\s+(?:(?:global|local)\s+)?(temp\s+|temporary\s+|unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*(\(|as\b)/g)) {
    const temp = m[1] && m[1].trim().startsWith("temp");
    const table = normaliseName(m[2]);
    if (!temp && !rlsEnabled.has(table)) {
      err(m.index, "rls-in-same-migration",
        `table ${table} is created without "alter table ${table} enable row level security" in the same migration (guide §5, Stage 3)`);
    }
    if (m[3] !== "(") continue;
    const open = m.index + m[0].length - 1;
    const body = outside.slice(open + 1, closeParen(outside, open));
    for (const item of splitTopLevel(body, open + 1)) {
      if (COLUMN_ITEM_SKIP.test(item.text)) continue;
      const c = item.text.match(/^"?([a-z_][a-z0-9_]*)"?\s+([\s\S]+)$/);
      if (c) checkColumn(c[1], columnType(c[2]), lineOf(sql, item.index), findings);
    }
  }
  for (const m of outside.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?[\w."]+\s+([^;]*)/g)) {
    const offset = m.index + m[0].length - m[1].length;
    for (const item of splitTopLevel(m[1], offset)) {
      const add = item.text.match(/^add\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\s+([\s\S]+)$/);
      const alter = item.text.match(/^alter\s+(?:column\s+)?"?([a-z_][a-z0-9_]*)"?\s+(?:set\s+data\s+)?type\s+([\s\S]+)$/);
      const c = add ?? alter;
      if (c && !COLUMN_ITEM_SKIP.test(c[1])) checkColumn(c[1], columnType(c[2]), lineOf(sql, item.index), findings);
    }
  }

  // 3. security definer functions must set search_path to empty, outside the body.
  const boundary = /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure|table|policy|trigger|view|materialized\s+view|index|schema|type)\b/g;
  const starts = [...sql.matchAll(boundary)].map((x) => x.index);
  for (let i = 0; i < starts.length; i++) {
    const segment = outside.slice(starts[i], starts[i + 1] ?? outside.length);
    if (!/^create\s+(or\s+replace\s+)?(function|procedure)/.test(segment)) continue;
    if (!/security\s+definer/.test(segment)) continue;
    if (!/set\s+search_path\s*(=|to)\s*''/.test(segment)) {
      err(starts[i], "definer-search-path",
        "security definer function must have `set search_path = ''` in its definition (guide §5)");
    }
  }

  // 3b. security definer functions run with their owner's rights. Anything in
  // an exposed schema (public) can be called by anyone through /rest/v1/rpc,
  // so definer functions belong in `private` only.
  for (const m of outside.matchAll(/create\s+(?:or\s+replace\s+)?(?:function|procedure)\s+([\w."]+)\s*\(/g)) {
    const end = starts.find((s) => s > m.index) ?? outside.length;
    if (/security\s+definer/.test(outside.slice(m.index, end)) && !normaliseName(m[1]).startsWith("private.")) {
      err(m.index, "definer-only-in-private",
        `security definer function ${normaliseName(m[1])} is outside the private schema, so anyone can call it via the API (guide §5)`);
    }
  }
  for (const m of outside.matchAll(/alter\s+(?:function|procedure)\s+([\w."]+)[^;]*\bsecurity\s+definer/g)) {
    if (!normaliseName(m[1]).startsWith("private.")) {
      err(m.index, "definer-only-in-private",
        `function ${normaliseName(m[1])} is made security definer outside the private schema (guide §5)`);
    }
  }

  // 3c. Switching protections off.
  for (const m of outside.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+(disable|no\s+force)\s+row\s+level\s+security/g)) {
    err(m.index, "rls-never-disabled", `row level security is turned off on ${normaliseName(m[1])} (guide §5)`);
  }
  for (const m of outside.matchAll(/alter\s+view\s+(?:if\s+exists\s+)?([\w."]+)[^;]*security_invoker\s*=\s*'?(false|off|0)'?/g)) {
    err(m.index, "view-security-invoker", `view ${normaliseName(m[1])} has security_invoker switched off, so it bypasses RLS (guide §5)`);
  }
  for (const m of outside.matchAll(/\b(using|with\s+check)\s*\(\s*true\s*\)/g)) {
    findings.push({ line: lineOf(sql, m.index), severity: "warning", rule: "policy-allows-everything",
      message: "policy condition is `true`, which allows every row. Only right for shared read-only data like fx_rates (guide §5, §9)" });
  }

  // 4. Views bypass RLS unless they run as the caller.
  for (const m of outside.matchAll(/create\s+(?:or\s+replace\s+)?(?:(?:temp|temporary)\s+)?(?:recursive\s+)?(materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?([\w."]+)([\s\S]*?)\bas\b/g)) {
    const name = normaliseName(m[2]);
    if (m[1]) {
      if (!name.startsWith("private.")) {
        err(m.index, "view-security-invoker",
          `materialized view ${name} ignores RLS; keep it out of exposed schemas (e.g. in private) (guide §5, §12)`);
      }
    } else if (!/security_invoker\s*(=\s*'?(true|on|1)'?\s*)?[,)]/.test(m[3])) {
      err(m.index, "view-security-invoker",
        `view ${name} needs \`with (security_invoker = true)\` or it bypasses RLS and leaks other accounts' data (guide §5, §12)`);
    }
  }

  return findings;
}

// Attribute text of the JSX/HTML tag starting at `start`, with {...}
// expressions blanked so `=>` or values inside them don't confuse the scan.
function tagAttributes(text, start) {
  let depth = 0;
  let quote = null;
  let out = "";
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = null; out += depth ? " " : c; continue; }
    if (c === "{") { depth++; out += " "; continue; }
    if (c === "}") { depth--; out += " "; continue; }
    if (depth) { out += " "; continue; }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === ">") break;
    out += c;
  }
  return out;
}

function checkCode(text) {
  const findings = [];
  const add = (index, severity, rule, message) =>
    findings.push({ line: lineOf(text, index), severity, rule, message });

  for (const m of text.matchAll(/<input\b/gi)) {
    const attrs = tagAttributes(text, m.index + m[0].length);
    if (/(^|\s)capture(\s*=|\s|\/|$)/.test(attrs)) {
      add(m.index, "error", "no-capture-attribute",
        "file input has a `capture` attribute; leave it out so phones offer camera, library and files (guide §11)");
    }
  }

  for (const m of text.matchAll(/new\s+Date\(\s*["'`]\d{4}-\d{2}-\d{2}["'`]\s*\)|Date\.parse\(\s*["'`]\d{4}-\d{2}-\d{2}["'`]\s*\)/g)) {
    add(m.index, "error", "no-date-from-iso-string",
      "a YYYY-MM-DD string turned into a Date means midnight UTC and shifts the day; keep dates as strings (guide §6)");
  }

  for (const m of text.matchAll(/NEXT_PUBLIC_\w+/g)) {
    if (looksSecret(m[0])) {
      add(m.index, "error", "no-public-secret",
        `${m[0]} looks like a secret but NEXT_PUBLIC_ ships it to every browser (guide §5)`);
    }
  }

  if (/^\s*["']use client["']/m.test(text)) {
    for (const m of text.matchAll(/process\.env\.(\w+)|process\.env\[\s*["'`](\w+)["'`]\s*\]/g)) {
      const name = m[1] ?? m[2];
      if (!name.startsWith("NEXT_PUBLIC_")) {
        add(m.index, "error", "no-server-env-in-client",
          `client component reads process.env.${name}; secrets and server settings stay on the server (guide §5)`);
      }
    }
    for (const m of text.matchAll(/\{([^}]*)\}\s*=\s*process\.env\b/g)) {
      const names = m[1].split(",").map((s) => s.split(":")[0].trim()).filter(Boolean);
      for (const name of names) {
        if (!name.startsWith("NEXT_PUBLIC_")) {
          add(m.index, "error", "no-server-env-in-client",
            `client component reads process.env.${name}; secrets and server settings stay on the server (guide §5)`);
        }
      }
    }
  }

  for (const m of text.matchAll(/^\s*["']use server["']/gm)) {
    add(m.index, "warning", "prefer-route-handlers",
      "server action found; put important logic in route handlers so other clients can call it (guide §4)");
  }

  return findings;
}

const isEnvLike = (p) => /^\.env/.test(path.basename(p)) || /^\.dev\.vars/.test(path.basename(p));
const isWranglerConfig = (p) => /^wrangler\.(json|jsonc|toml)$/.test(path.basename(p));

function checkEnvFile(text, filePath = "") {
  const findings = [];
  const isExample = /\.(example|sample|template)$/.test(filePath);
  text.split("\n").forEach((line, idx) => {
    if (/^\s*#/.test(line)) return;
    const [rawName, ...rest] = line.replace(/^\s*export\s+/, "").split("=");
    const name = rawName.trim();
    const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
    if (name.startsWith("NEXT_PUBLIC_") && looksSecret(name)) {
      findings.push({ line: idx + 1, severity: "error", rule: "no-public-secret",
        message: `${name} looks like a secret but NEXT_PUBLIC_ ships it to every browser (guide §5)` });
    }
    // Placeholders are words only (e.g. <your key>, xxxx, changeme), never key-like text.
    if (isExample && looksSecret(name) && value && !/^(<[a-z ]+>|x+|changeme|\.\.\.)$/i.test(value)) {
      findings.push({ line: idx + 1, severity: "error", rule: "no-secret-in-example",
        message: `${name} has a value in a committed example file; example files list names only (guide §5)` });
    }
  });
  return findings;
}

// wrangler.json(c)/toml is committed, so its plain-text "vars" must never hold
// secrets; those go in .dev.vars (local) or Cloudflare's encrypted secrets.
function checkWranglerConfig(text, filePath = "wrangler.jsonc") {
  const findings = [];
  const flag = (key, index) => {
    if (looksSecret(key)) {
      findings.push({ line: lineOf(text, index), severity: "error", rule: "no-secret-in-wrangler-vars",
        message: `${key} looks like a secret but wrangler vars are committed in plain text; use .dev.vars locally and Cloudflare secrets when hosted` });
    }
  };

  if (filePath.endsWith(".toml")) {
    let inVarsTable = false;
    let offset = 0;
    for (const line of text.split("\n")) {
      const code = line.replace(/\s+#.*$/, "").trim();
      if (code.startsWith("[")) inVarsTable = /^\[\s*(env\.[\w.-]+\.)?vars\s*\]$/.test(code.replace(/\s*\.\s*/g, "."));
      else if (inVarsTable) {
        const m = code.match(/^["']?([A-Za-z0-9_]+)["']?\s*=/);
        if (m) flag(m[1], offset);
      }
      const inline = code.match(/^vars\s*=\s*\{(.*)\}/);
      if (inline) for (const k of inline[1].matchAll(/["']?([A-Za-z0-9_]+)["']?\s*=/g)) flag(k[1], offset);
      offset += line.length + 1;
    }
    return findings;
  }

  // JSON/JSONC: blank out comments (keeping length), then for each
  // "vars": { ... } block, check every key inside it, however it's laid out.
  let clean = "";
  for (let i = 0, inString = false; i < text.length; i++) {
    const c = text[i];
    if (inString) { clean += c; if (c === "\\") clean += text[++i] ?? ""; else if (c === '"') inString = false; continue; }
    if (c === '"') { inString = true; clean += c; continue; }
    if (text.startsWith("//", i)) { const end = text.indexOf("\n", i); const stop = end === -1 ? text.length : end; clean += " ".repeat(stop - i); i = stop - 1; continue; }
    if (text.startsWith("/*", i)) { const end = text.indexOf("*/", i + 2); const stop = end === -1 ? text.length : end + 2; clean += text.slice(i, stop).replace(/[^\n]/g, " "); i = stop - 1; continue; }
    clean += c;
  }
  for (const m of clean.matchAll(/"vars"\s*:\s*\{/g)) {
    let depth = 1;
    let j = m.index + m[0].length;
    for (let inString = false; j < clean.length && depth > 0; j++) {
      const c = clean[j];
      if (inString) { if (c === "\\") j++; else if (c === '"') inString = false; continue; }
      if (c === '"') inString = true;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
    }
    const start = m.index + m[0].length;
    for (const k of clean.slice(start, j).matchAll(/"([A-Za-z0-9_]+)"\s*:/g)) flag(k[1], start + k.index);
  }
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
    if (ext !== ".sql" && !CODE_EXT.has(ext) && !isEnvLike(file) && !isWranglerConfig(file)) continue;
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
