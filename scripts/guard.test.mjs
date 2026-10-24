// Proves the PreToolUse guard blocks what it should and nothing else.
// Run: node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../.claude/hooks/guard.mjs";

const dir = "/repo";
process.env.CLAUDE_PROJECT_DIR = dir;
const bash = (command) => evaluate({ tool_name: "Bash", tool_input: { command } });
const write = (file_path) => evaluate({ tool_name: "Write", tool_input: { file_path } });

test("blocks edits to the build guide and secret files", () => {
  assert.ok(write(`${dir}/docs/build-guide.html`));
  assert.ok(write("docs/build-guide.html"));
  assert.ok(write(`${dir}/.env.local`));
  assert.ok(write(`${dir}/.env.production.local`));
  assert.ok(write(`${dir}/.env`));
});

test("allows ordinary edits and .env.example", () => {
  assert.equal(write(`${dir}/.env.example`), null);
  assert.equal(write(`${dir}/src/app/page.tsx`), null);
  assert.equal(write(`${dir}/docs/stages/stage-00.md`), null);
});

test("blocks force pushes and pushes to main", () => {
  assert.ok(bash("git push --force origin feature"));
  assert.ok(bash("git push -f origin feature"));
  assert.ok(bash("git push --force-with-lease origin feature"));
  assert.ok(bash("git push origin +feature"));
  assert.ok(bash("git push origin main"));
  assert.ok(bash("git push origin HEAD:main"));
});

test("allows normal feature-branch pushes", () => {
  assert.equal(bash("git push -u origin claude/zealous-einstein-q8koju"), null);
  assert.equal(bash("git push origin feature/maintenance-page"), null);
});

test("blocks --no-verify and hosted Supabase changes", () => {
  assert.ok(bash("git commit --no-verify -m x"));
  assert.ok(bash("npx supabase link --project-ref abc"));
  assert.ok(bash("supabase db push"));
  assert.ok(bash("supabase db reset --linked"));
  assert.equal(bash("supabase db reset"), null);
  assert.equal(bash("supabase test db"), null);
});

test("text inside commit messages and heredocs is not treated as a command", () => {
  assert.equal(bash(`git commit -m "guard blocks --no-verify and git push origin main"`), null);
  assert.equal(bash(`git commit -q -m 'mentions git push --force'`), null);
  assert.equal(bash("git commit -F - <<'EOF'\nblocks --no-verify\nEOF"), null);
  assert.equal(bash("cat <<EOF > notes.md\nsupabase db push is owner-only\nEOF"), null);
  assert.ok(bash(`git commit --no-verify -m "msg"`));
  assert.ok(bash(`git commit -m "msg" && git push origin main`));
});

test("blocks reading secret files but not mentioning them", () => {
  assert.ok(bash("cat .env.local"));
  assert.ok(bash("grep KEY .env.development.local"));
  assert.equal(bash("git check-ignore .env.local"), null);
});
