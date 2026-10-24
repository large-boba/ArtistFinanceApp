#!/usr/bin/env node
// PreToolUse hook: blocks actions no agent on the team may take.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and
// the stderr message is shown to the agent.
//
// This is a seatbelt, not a lock: it catches the usual ways of doing these
// things. GitHub branch protection on `main` and the reviewers are the real
// protection.

import { execSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROTECTED_BRANCHES = new Set(["main", "master"]);
const SECRET_PATH = /(^|\/)\.env(\.[\w-]+)?\.local$|(^|\/)\.env$/;
const SECRET_CANDIDATES = [".env", ".env.local", ".env.development.local", ".env.production.local", ".env.test.local"];
const INTERPRETERS = new Set(["node", "python", "python3", "ruby", "perl", "deno", "bun", "php"]);
const SHELLS = new Set(["sh", "bash", "zsh", "dash"]);

const REASONS = {
  force: "force-pushing rewrites history. Ask the owner to do it if it is really needed.",
  main: "nobody pushes to main. Work goes to the feature branch and reaches main through a reviewed PR.",
  noVerify: "skipping git hooks hides failures. Fix the failing check instead.",
  supabase: "changing a hosted Supabase project is an owner-only action. Report the command to the lead for the owner to run.",
  secret: "reading, copying or staging a .env*.local file exposes secrets. Use .env.example for variable names.",
  guide: "docs/build-guide.html is the owner's source of truth. Propose changes to the lead instead of editing it.",
};

// Split a shell command into segments of words, honouring quotes. Heredoc
// bodies are dropped first: they are data being written, not commands.
export function segments(command) {
  const text = command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, "");
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

function checkGit(args, currentBranch) {
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    i += ["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"].includes(args[i]) ? 2 : 1;
  }
  const sub = args[i];
  const rest = args.slice(i + 1);

  if (rest.includes("--no-verify")) return REASONS.noVerify;
  if (sub === "commit" && rest.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a) && !a.startsWith("--"))) return REASONS.noVerify;

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
    if (refspecs.length === 0) {
      const branch = currentBranch();
      if (branch && PROTECTED_BRANCHES.has(branch)) return REASONS.main;
    }
    for (const spec of refspecs) {
      if (spec.startsWith("+")) return REASONS.force;
      const dest = (spec.includes(":") ? spec.split(":").pop() : spec).replace(/^refs\/heads\//, "");
      const src = spec.split(":")[0];
      if (PROTECTED_BRANCHES.has(dest)) return REASONS.main;
      if (src === "HEAD" && !spec.includes(":")) {
        const branch = currentBranch();
        if (branch && PROTECTED_BRANCHES.has(branch)) return REASONS.main;
      }
    }
  }

  const readOnly = ["check-ignore", "ls-files", "status"].includes(sub);
  if (!readOnly && rest.some(isSecretWord)) return REASONS.secret;
  return null;
}

function checkSupabase(args) {
  const joined = ` ${args.join(" ")} `;
  if (/\s--(linked|project-ref|db-url)(\s|=)/.test(joined)) return REASONS.supabase;
  // Global flags such as --workdir take values, so look for the subcommand
  // words anywhere rather than only in first position.
  const words = args.filter((a) => !a.startsWith("-"));
  const has = (a, b) => words.some((w, i) => w === a && (b === undefined || words[i + 1] === b));
  if (["link", "projects", "secrets", "branches", "orgs"].some((w) => has(w))) return REASONS.supabase;
  if (has("db", "push") || has("functions", "deploy") || has("functions", "delete")) return REASONS.supabase;
  return null;
}

function checkWords(words, currentBranch, depth) {
  let w = words;
  while (w.length && /^\w+=/.test(w[0])) w = w.slice(1); // leading VAR=value
  while (w.length && ["sudo", "env", "time", "nohup", "exec", "command"].includes(w[0])) w = w.slice(1);
  if (!w.length) return null;
  const [cmd, ...args] = w;
  const name = path.basename(cmd);

  if ((SHELLS.has(name) || name === "eval") && depth < 3) {
    const script = name === "eval" ? args.join(" ") : args[args.indexOf("-c") + 1];
    if (script && (name === "eval" || args.includes("-c"))) return evaluateCommand(script, currentBranch, depth + 1);
  }
  if (name === "git") return checkGit(args, currentBranch);
  if (name === "supabase") return checkSupabase(args);
  if (["npx", "pnpx", "bunx"].includes(name) && args.find((a) => !a.startsWith("-"))?.startsWith("supabase")) {
    return checkSupabase(args.slice(args.findIndex((a) => a.startsWith("supabase")) + 1));
  }
  if (INTERPRETERS.has(name) && args.some((a) => /\.env(\.[\w-]+)?\.local\b/.test(a))) return REASONS.secret;

  const secretArgs = args.filter(isSecretWord);
  if (secretArgs.length) {
    if (["ls", "test", "[", "echo", "printf", "touch"].includes(name)) return null;
    if (["grep", "rg", "egrep", "fgrep"].includes(name)) {
      const positional = args.filter((a) => !a.startsWith("-"));
      const files = positional.slice(1);
      if (!files.some(isSecretWord)) return null; // the secret name is only the search pattern
    }
    return REASONS.secret;
  }
  return null;
}

function evaluateCommand(command, currentBranch, depth = 0) {
  for (const words of segments(command)) {
    const reason = checkWords(words, currentBranch, depth);
    if (reason) return reason;
  }
  return null;
}

export function evaluate(input, options = {}) {
  const tool = input?.tool_name ?? "";
  const ti = input?.tool_input ?? {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();

  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const target = ti.file_path ?? ti.notebook_path ?? ti.path ?? "";
    const rel = path.relative(projectDir, path.resolve(projectDir, target)).split(path.sep).join("/");
    if (rel === "docs/build-guide.html") return REASONS.guide;
    if (SECRET_PATH.test(rel)) return `${rel} holds secrets and is owner-managed. Add variable names to .env.example instead.`;
  }

  if (tool === "Bash") {
    let cached;
    const currentBranch = options.currentBranch ?? (() => {
      if (cached === undefined) {
        try {
          cached = execSync("git rev-parse --abbrev-ref HEAD", { cwd: input?.cwd ?? projectDir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
        } catch {
          cached = null;
        }
      }
      return cached;
    });
    return evaluateCommand(String(ti.command ?? ""), currentBranch);
  }
  return null;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  let raw = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let input;
    try {
      input = JSON.parse(raw || "{}");
    } catch {
      process.exit(0);
    }
    const reason = evaluate(input);
    if (reason) {
      process.stderr.write(`Blocked by project guard: ${reason}\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}
