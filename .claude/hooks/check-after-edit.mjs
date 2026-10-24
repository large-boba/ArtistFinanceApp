#!/usr/bin/env node
// PostToolUse hook: after any file edit, run check-rules on that file and send
// violations straight back to the agent (exit code 2 shows stderr to Claude).

import fs from "node:fs";
import path from "node:path";
import { findingsForFile, format } from "../../scripts/check-rules.mjs";

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
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const target = input?.tool_input?.file_path ?? input?.tool_input?.path;
  if (!target) process.exit(0);
  const abs = path.resolve(projectDir, target);
  const rel = path.relative(projectDir, abs);
  if (rel.startsWith("..") || rel.startsWith("scripts") || rel.startsWith(".claude") || !fs.existsSync(abs)) {
    process.exit(0);
  }
  const errors = findingsForFile(rel, fs.readFileSync(abs, "utf8")).filter((f) => f.severity === "error");
  if (errors.length) {
    process.stderr.write(`check-rules found problems in ${rel}. Fix them before continuing:\n${format(errors)}\n`);
    process.exit(2);
  }
  process.exit(0);
});
