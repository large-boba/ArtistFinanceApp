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
    if (args[i] === "-c" && /^core\.hookspath=/i.test(args[i + 1] ?? "")) return REASONS.noVerify;
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
  if (args.some((a) => /^--(linked|project-ref|db-url)(=|$)/.test(a))) return REASONS.supabase;
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

// `npx supabase`, `npm exec supabase`, `pnpm dlx supabase`, `yarn dlx supabase`...
function packageRunnerTarget(name, args) {
  const runners = new Set(["npx", "pnpx", "bunx"]);
  const managers = new Set(["npm", "pnpm", "yarn", "bun"]);
  let rest = null;
  if (runners.has(name)) rest = args;
  else if (managers.has(name) && ["exec", "dlx", "x"].includes(args[0])) rest = args.slice(1);
  if (!rest) return null;
  const idx = rest.findIndex((a) => !a.startsWith("-") && a !== "--");
  if (idx === -1 || !/^supabase(@.*)?$/.test(rest[idx])) return null;
  return rest.slice(idx + 1);
}

// Drop wrappers such as `sudo -u root`, `env X=1`, `time`, `nohup`.
function unwrap(words) {
  let w = words;
  for (;;) {
    while (w.length && /^\w+=/.test(w[0])) w = w.slice(1); // leading VAR=value
    if (!w.length || !["sudo", "env", "time", "nohup", "exec", "command", "doas"].includes(w[0])) return w;
    w = w.slice(1);
    while (w.length && w[0].startsWith("-")) {
      w = ["-u", "-g", "-C", "-p", "-U"].includes(w[0]) ? w.slice(2) : w.slice(1);
    }
  }
}

function checkWords(words, currentBranch, depth) {
  const w = unwrap(words.map((x) => x.replace(/^\d*[<>]+/, "")).filter(Boolean));
  if (!w.length) return null;
  const [cmd, ...args] = w;
  const name = path.basename(cmd);

  // `$(<.env.local)` reads a file without naming a command.
  if (words.some((x) => /\$\(\s*<\s*\S*\.env(\.[\w-]+)?\.local/.test(x))) return REASONS.secret;

  if ((SHELLS.has(name) || name === "eval") && depth < 3) {
    if (name === "eval") return evaluateCommand(args.join(" "), currentBranch, depth + 1);
    const flag = args.findIndex((a) => /^-[a-zA-Z]*c[a-zA-Z]*$/.test(a));
    if (flag !== -1 && args[flag + 1]) return evaluateCommand(args[flag + 1], currentBranch, depth + 1);
  }
  if (name === "git") return checkGit(args, currentBranch);
  if (name === "supabase") return checkSupabase(args);
  const viaRunner = packageRunnerTarget(name, args);
  if (viaRunner) return checkSupabase(viaRunner);
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

function evaluateCommand(command, currentBranch, depth = 0) {
  let branch = currentBranch;
  for (const words of segments(command)) {
    const reason = checkWords(words, branch, depth);
    if (reason) return reason;
    const next = switchedBranch(words);
    if (next !== undefined) branch = () => (next === null ? "main" : next); // unknown: assume the worst
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
