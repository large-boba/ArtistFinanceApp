#!/usr/bin/env node
// PreToolUse hook: blocks actions no agent on the team may take.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and
// the stderr message is shown to the agent.
//
// This is a seatbelt, not a lock: it catches the usual ways of doing these
// things. GitHub branch protection on `main`, the permission deny list in
// .claude/settings.json and the reviewers are the real protection.

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTECTED_BRANCHES = new Set(["main", "master"]);
const SECRET_PATH = /(^|\/)\.env(\.[\w-]+)?\.local$|(^|\/)\.env$/;
const SECRET_IN_TEXT = /\.env(\.[\w-]+)?\.local\b/;
const SECRET_CANDIDATES = [".env", ".env.local", ".env.development.local", ".env.production.local", ".env.test.local"];
const INTERPRETERS = new Set(["node", "python", "python3", "ruby", "perl", "deno", "bun", "php", "tsx", "ts-node", "jq"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);
const PACKAGE_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUNNERS = new Set(["npx", "pnpx", "bunx"]);

const REASONS = {
  force: "force-pushing rewrites history. Ask the owner to do it if it is really needed.",
  main: "nobody pushes to main. Work goes to the feature branch and reaches main through a reviewed PR.",
  merge: "only the owner merges pull requests. Report that the PR is ready instead.",
  noVerify: "skipping git hooks hides failures. Fix the failing check instead.",
  supabase: "this Supabase command can act on the hosted project. Only local commands (start, stop, status, db reset/diff/lint, test db, migration new/up, functions serve, gen types --local) are allowed; report anything else to the lead for the owner to run.",
  vercel: "deploying or changing Vercel settings is an owner-only action. Only `vercel dev` and `vercel build` are allowed.",
  secret: "reading, copying, writing or staging a .env*.local file exposes or destroys secrets. Use .env.example for variable names.",
  recursiveGrep: "a recursive grep can print secret values from .env*.local. Add --exclude='.env*' (or use the Grep tool, which skips ignored files).",
  guide: "docs/build-guide.html is the owner's source of truth. Propose changes to the lead instead of editing it.",
};

// Split a shell command into segments of words, honouring quotes. Heredoc
// bodies are dropped first: they are data being written, not commands.
export function segments(command) {
  const text = command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, "")
    .replace(/\\\r?\n/g, " "); // backslash-newline continues the line
  const out = [];
  let words = [];
  let word = null;
  let quote = null;
  const endWord = () => { if (word !== null) words.push(word); word = null; };
  const endSegment = () => { endWord(); if (words.length) out.push(words); words = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < text.length) word += text[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; word ??= ""; continue; }
    if (c === "\\" && i + 1 < text.length) { word = (word ?? "") + text[++i]; continue; }
    if (c === ";" || c === "&" || c === "|" || c === "\n" || c === "(" || c === ")" || c === "`") { endSegment(); continue; }
    if (/\s/.test(c)) { endWord(); continue; }
    word = (word ?? "") + c;
  }
  endSegment();
  return out;
}

function globMatchesSecret(word) {
  if (!/[*?[]/.test(word)) return false;
  const re = new RegExp("^" + word.replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return SECRET_CANDIDATES.some((name) => re.test(name) || re.test(`./${name}`));
}

const isSecretWord = (w) => SECRET_PATH.test(w) || globMatchesSecret(w);

// Drop wrappers and shell keywords that run the command after them.
function unwrap(words) {
  let w = words;
  for (;;) {
    while (w.length && /^\w+=/.test(w[0])) w = w.slice(1); // leading VAR=value
    const head = w[0];
    if (["then", "do", "else", "elif", "{", "!", "time", "nohup", "exec", "command", "builtin"].includes(head)) { w = w.slice(1); continue; }
    if (["sudo", "doas", "env", "nice", "stdbuf", "xargs", "timeout", "ionice", "caffeinate"].includes(head)) {
      w = w.slice(1);
      while (w.length && (w[0].startsWith("-") || /^\w+=/.test(w[0]))) {
        w = ["-u", "-g", "-C", "-p", "-U", "-n", "-s", "-k", "-I", "-L", "-P"].includes(w[0]) ? w.slice(2) : w.slice(1);
      }
      if (head === "timeout" && w.length && /^\d+(\.\d+)?[smhd]?$/.test(w[0])) w = w.slice(1);
      continue;
    }
    return w;
  }
}

function checkGit(args, currentBranch) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    if (args[i] === "-c" && /^core\.hookspath=/i.test(args[i + 1] ?? "")) return REASONS.noVerify;
    i += ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"].includes(args[i]) ? 2 : 1;
  }
  const sub = args[i];
  const rest = args.slice(i + 1);

  if (rest.includes("--no-verify")) return REASONS.noVerify;
  if (sub === "commit" && rest.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a))) return REASONS.noVerify;
  if (sub === "config" && rest.some((a) => /^core\.hookspath$/i.test(a))) return REASONS.noVerify;

  if (sub === "push") {
    const positional = [];
    for (let j = 0; j < rest.length; j++) {
      const a = rest[j];
      if (["--force", "--force-with-lease", "--force-if-includes", "--mirror"].includes(a) || a.startsWith("--force-with-lease=")) return REASONS.force;
      if (/^-[a-zA-Z]+$/.test(a) && a.includes("f")) return REASONS.force;
      if (a === "--all" || a === "--branches") return REASONS.main;
      if (["-o", "--push-option", "--repo", "--receive-pack", "--exec"].includes(a)) { j++; continue; }
      if (a.startsWith("-")) continue;
      positional.push(a);
    }
    const refspecs = positional.slice(1);
    const onProtected = () => { const b = currentBranch(); return b && PROTECTED_BRANCHES.has(b); };
    if (refspecs.length === 0 && onProtected()) return REASONS.main;
    for (const spec of refspecs) {
      if (spec.startsWith("+")) return REASONS.force;
      const dest = (spec.includes(":") ? spec.split(":").pop() : spec).replace(/^refs\/heads\//, "");
      if (PROTECTED_BRANCHES.has(dest)) return REASONS.main;
      if (spec === "HEAD" && onProtected()) return REASONS.main;
    }
  }

  const readOnly = ["check-ignore", "ls-files", "status"].includes(sub);
  if (!readOnly && rest.some(isSecretWord)) return REASONS.secret;
  return null;
}

function checkGh(args) {
  const words = args.filter((a) => !a.startsWith("-"));
  if (words[0] === "pr" && words[1] === "merge") return REASONS.merge;
  if (words[0] === "api" && args.some((a) => /\/merges?\b|\/pulls\/\d+\/merge|automerge|auto-merge/i.test(a))) return REASONS.merge;
  if (words[0] === "api" && args.some((a) => /\/git\/refs\/heads\/(main|master)\b|\/contents\//.test(a)) &&
      args.some((a) => /^(-X|--method)$/.test(a) || /^--method=/.test(a))) return REASONS.main;
  return null;
}

// Supabase commands are checked against a list of LOCAL-only commands. Many
// other commands act on the linked hosted project by default, so anything not
// listed here is blocked.
const SUPABASE_LOCAL = new Set([
  "start", "stop", "status", "init", "help", "completion",
  "db reset", "db diff", "db lint", "db start",
  "test db", "test new",
  "migration new", "migration up", "migration squash",
  "functions new", "functions serve",
  "seed buckets",
]);
const SUPABASE_NEEDS_LOCAL_FLAG = new Set(["migration list", "gen types"]);
const SUPABASE_VALUE_FLAGS = new Set(["--workdir", "--profile", "-o", "--output", "--network-id", "--dns-resolver"]);

function checkSupabase(args) {
  if (args.some((a) => /^--(linked|project-ref|project-id|db-url)(=|$)/.test(a))) return REASONS.supabase;
  const words = [];
  for (let i = 0; i < args.length; i++) {
    if (SUPABASE_VALUE_FLAGS.has(args[i])) { i++; continue; }
    if (!args[i].startsWith("-")) words.push(args[i]);
  }
  if (words.length === 0) return null; // e.g. supabase --version
  const one = words[0];
  const two = words.slice(0, 2).join(" ");
  if (SUPABASE_LOCAL.has(one) || SUPABASE_LOCAL.has(two)) return null;
  if (SUPABASE_NEEDS_LOCAL_FLAG.has(two) && args.includes("--local")) return null;
  return REASONS.supabase;
}

function checkVercel(args) {
  const words = args.filter((a) => !a.startsWith("-"));
  if (words.length === 0 && args.every((a) => ["--version", "-v", "--help", "-h"].includes(a)) && args.length) return null;
  if (["dev", "build", "help", "whoami"].includes(words[0])) return null;
  return REASONS.vercel;
}

function readPackageScripts(projectDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8")).scripts ?? {};
  } catch {
    return {};
  }
}

// npm/pnpm/yarn/bun: `run <script>` (and pnpm/yarn/bun `<script>`), or
// `exec`/`dlx`/`x <bin>`. Returns words to check, or null.
function resolvePackageManager(name, args, ctx) {
  const rest = args.filter((a) => a !== "--");
  const first = rest.find((a) => !a.startsWith("-"));
  if (!first) return null;
  const after = rest.slice(rest.indexOf(first) + 1);
  if (["exec", "dlx", "x"].includes(first)) return { words: after.filter((a) => !a.startsWith("-") || after.indexOf(a) > 0) };
  const scripts = readPackageScripts(ctx.projectDir);
  let scriptName = null;
  if (["run", "run-script"].includes(first)) scriptName = after.find((a) => !a.startsWith("-"));
  else if (name !== "npm" && scripts[first] !== undefined) scriptName = first;
  if (scriptName && scripts[scriptName] !== undefined) return { script: scripts[scriptName] };
  if (name !== "npm" && first === "supabase") return { words: after.length ? ["supabase", ...after] : ["supabase"] };
  if (name !== "npm" && ["vercel", "gh", "git"].includes(first)) return { words: [first, ...after] };
  return null;
}

function checkWords(rawWords, ctx, depth) {
  // Writing to a secret file through a redirect: `> .env.local`, `>.env.local`.
  for (let i = 0; i < rawWords.length; i++) {
    const w = rawWords[i];
    if ((/^\d*>>?$/.test(w) && isSecretWord(rawWords[i + 1] ?? "")) || (/^\d*>>?./.test(w) && isSecretWord(w.replace(/^\d*>>?/, "")))) return REASONS.secret;
  }
  // `$(<.env.local)` reads a file without naming a command.
  if (rawWords.some((x) => /\$\(\s*<\s*\S*\.env(\.[\w-]+)?\.local/.test(x))) return REASONS.secret;
  if (rawWords.some((x) => /^HUSKY=0$/.test(x))) return REASONS.noVerify;

  const w = unwrap(rawWords.map((x) => x.replace(/^\d*[<>]+/, "")).filter(Boolean));
  if (!w.length) return null;
  const [cmd, ...args] = w;
  const name = path.basename(cmd);

  if (depth < 4) {
    if (name === "eval") return evaluateCommand(args.join(" "), ctx, depth + 1);
    if (SHELLS.has(name)) {
      const flag = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
      if (flag !== -1 && args[flag + 1]) return evaluateCommand(args[flag + 1], ctx, depth + 1);
    }
    if (RUNNERS.has(name)) {
      const idx = args.findIndex((a) => !a.startsWith("-"));
      if (idx !== -1) return checkWords([args[idx].replace(/@.*$/, ""), ...args.slice(idx + 1).filter((a) => a !== "--")], ctx, depth + 1);
      return null;
    }
    if (PACKAGE_MANAGERS.has(name)) {
      const target = resolvePackageManager(name, args, ctx);
      if (target?.script !== undefined) return evaluateCommand(target.script, ctx, depth + 1);
      if (target?.words?.length) return checkWords([target.words[0].replace(/@.*$/, ""), ...target.words.slice(1)], ctx, depth + 1);
    }
  }
  if (name === "git") return checkGit(args, ctx.branch);
  if (name === "gh") return checkGh(args);
  if (name === "supabase") return checkSupabase(args);
  if (name === "vercel") return checkVercel(args);
  if (INTERPRETERS.has(name) && args.some((a) => SECRET_IN_TEXT.test(a))) return REASONS.secret;

  if (["grep", "egrep", "fgrep"].includes(name)) {
    const recursive = args.some((a) => a === "--recursive" || a === "--dereference-recursive" || /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(a));
    const VALUE_OPTS = new Set(["-e", "-f", "-m", "-A", "-B", "-C", "--include", "--exclude", "--exclude-dir"]);
    const positional = args.filter((a, i) => !a.startsWith("-") && !VALUE_OPTS.has(args[i - 1]));
    const paths = args.some((a) => a === "-e" || a.startsWith("--regexp")) ? positional : positional.slice(1);
    // Folders that never hold .env files are safe to search recursively.
    const safeOnly = paths.length > 0 && paths.every((p) => /^(\.\/)?(src|supabase|scripts|tests?|docs|app|components|lib|public)(\/|$)/.test(p));
    if (recursive && !safeOnly && !args.some((a) => /^--exclude=.*\.env/.test(a))) return REASONS.recursiveGrep;
  }
  if (name === "rg") {
    const noIgnore = args.some((a) => /^(--no-ignore|--hidden|-[a-zA-Z]*u[a-zA-Z]*|--unrestricted)$/.test(a));
    if (noIgnore && !args.some((a) => /^!?\.env/.test(a.replace(/^--glob=|^-g/, "")))) return REASONS.recursiveGrep;
  }

  const secretArgs = args.filter(isSecretWord);
  if (secretArgs.length) {
    if (["ls", "test", "[", "echo", "printf", "touch"].includes(name)) return null;
    if (["grep", "rg", "egrep", "fgrep"].includes(name)) {
      const positional = args.filter((a) => !a.startsWith("-"));
      if (!positional.slice(1).some(isSecretWord)) return null; // the secret name is only the search pattern
    }
    return REASONS.secret;
  }
  return null;
}

// If a segment switches branch (`git checkout main && git push`), later
// segments are judged on the branch they will actually run on.
function switchedBranch(words) {
  const w = unwrap(words);
  if (path.basename(w[0] ?? "") !== "git") return undefined;
  let i = 1;
  while (i < w.length && w[i].startsWith("-")) i += ["-C", "-c"].includes(w[i]) ? 2 : 1;
  if (!["checkout", "switch"].includes(w[i])) return undefined;
  const rest = w.slice(i + 1);
  const create = rest.findIndex((a) => ["-b", "-B", "-c", "-C", "--create", "--force-create"].includes(a));
  if (create !== -1) return rest[create + 1];
  if (rest.includes("-")) return null; // previous branch: unknown
  return rest.find((a) => !a.startsWith("-"));
}

function evaluateCommand(command, ctx, depth = 0) {
  let local = ctx;
  for (const words of segments(command)) {
    const reason = checkWords(words, local, depth);
    if (reason) return reason;
    const next = switchedBranch(words);
    if (next !== undefined) local = { ...local, branch: () => (next === null ? "main" : next) }; // unknown: assume the worst
  }
  return null;
}

export function evaluate(input, options = {}) {
  const tool = input?.tool_name ?? "";
  const ti = input?.tool_input ?? {};
  const projectDir = options.projectDir ?? process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();

  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const target = String(ti.file_path ?? ti.notebook_path ?? ti.path ?? "");
    const rel = path.relative(projectDir, path.resolve(projectDir, target)).split(path.sep).join("/");
    if (rel === "docs/build-guide.html") return REASONS.guide;
    if (SECRET_PATH.test(rel)) return `${rel} holds secrets and is owner-managed. Add variable names to .env.example instead.`;
  }

  if (tool === "Bash") {
    let cached;
    const branch = options.currentBranch ?? (() => {
      if (cached === undefined) {
        try {
          cached = execSync("git rev-parse --abbrev-ref HEAD", { cwd: input?.cwd ?? projectDir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
        } catch {
          cached = null;
        }
      }
      return cached;
    });
    return evaluateCommand(String(ti.command ?? ""), { branch, projectDir });
  }
  return null;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let reason = null;
    try {
      reason = evaluate(JSON.parse(raw || "{}"));
    } catch {
      process.exit(0); // malformed input: fail open, the deny list and reviewers still apply
    }
    if (reason) {
      process.stderr.write(`Blocked by project guard: ${reason}\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}
