#!/usr/bin/env node
// PreToolUse hook: blocks actions no agent on the team may take.
// Claude Code passes the tool call as JSON on stdin; exit code 2 blocks it and
// the stderr message is shown to the agent.

import path from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_FILE = /(^|\/)\.env(\.[\w-]+)?\.local$|(^|\/)\.env$/;
const READS_SECRET = /\b(cat|less|more|head|tail|grep|rg|sed|awk|cp|mv|source|base64|xxd|strings|od)\b[^|;&]*\.env(\.[\w-]+)?\.local\b/;

// Commit messages and other quoted text may mention these commands without
// running them, so command rules look at the command with quotes and heredoc
// bodies removed. The secret-file rule still checks the raw command.
function withoutQuotedText(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, "")
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, '""');
}

const COMMAND_RULES = [
  [/\bgit\s+push\b[^;&|]*(\s--force\b|\s--force-with-lease\b|\s-f\b|\s\+\S)/,
    "force-pushing rewrites history. Ask the owner to do it if it is really needed."],
  [/\bgit\s+push\b[^;&|]*[\s:/](main|master)\b/,
    "nobody pushes to main. Work goes to the feature branch and reaches main through a reviewed PR."],
  [/--no-verify\b/,
    "skipping git hooks hides failures. Fix the failing check instead."],
  [/\bsupabase\s+(link|db\s+push|projects\s+(create|delete))\b|\bsupabase\s+db\s+reset\b[^;&|]*--linked/,
    "changing a hosted Supabase project is an owner-only action. Report the command to the lead for the owner to run."],
];
const SECRET_REASON = "reading or copying a .env*.local file exposes secrets. Use .env.example for variable names.";

export function evaluate(input) {
  const tool = input?.tool_name ?? "";
  const ti = input?.tool_input ?? {};
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input?.cwd ?? process.cwd();

  if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(tool)) {
    const target = ti.file_path ?? ti.notebook_path ?? ti.path ?? "";
    const rel = path.relative(projectDir, path.resolve(projectDir, target)).split(path.sep).join("/");
    if (rel === "docs/build-guide.html") {
      return "docs/build-guide.html is the owner's source of truth. Propose changes to the lead instead of editing it.";
    }
    if (SECRET_FILE.test(rel)) {
      return `${rel} holds secrets and is owner-managed. Add variable names to .env.example instead.`;
    }
  }

  if (tool === "Bash") {
    const command = String(ti.command ?? "");
    const bare = withoutQuotedText(command);
    for (const [pattern, reason] of COMMAND_RULES) {
      if (pattern.test(bare)) return reason;
    }
    if (READS_SECRET.test(command)) return SECRET_REASON;
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
