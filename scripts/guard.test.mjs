// Proves the PreToolUse guard blocks what it should and nothing else.
// Run: node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../.claude/hooks/guard.mjs";

const dir = "/repo";
process.env.CLAUDE_PROJECT_DIR = dir;
const bash = (command, branch = "claude/feature") =>
  evaluate({ tool_name: "Bash", tool_input: { command } }, { currentBranch: () => branch });
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

test("blocks every spelling of a force push", () => {
  for (const cmd of [
    "git push --force origin feature",
    "git push -f origin feature",
    "git push -uf origin feature",
    "git push --force-with-lease origin feature",
    "git push --force-with-lease=feature origin feature",
    "git push --mirror origin",
    "git push origin +feature",
    "git -C . push --force origin feature",
  ]) assert.ok(bash(cmd), cmd);
});

test("blocks every spelling of a push to main", () => {
  for (const cmd of [
    "git push origin main",
    `git push origin "main"`,
    "git push origin 'main'",
    "git push origin HEAD:main",
    "git push origin feature:refs/heads/main",
    "git -C . push origin main",
    "git push --all origin",
    `bash -c "git push origin main"`,
  ]) assert.ok(bash(cmd), cmd);
  assert.ok(bash("git checkout main && git push", "main"));
  assert.ok(bash("git push", "main"));
  assert.ok(bash("git push origin HEAD", "main"));
});

test("allows normal feature-branch pushes, including names containing main", () => {
  assert.equal(bash("git push -u origin claude/zealous-einstein-q8koju"), null);
  assert.equal(bash("git push origin feature/main-menu"), null);
  assert.equal(bash("git push origin claude/main-screen"), null);
  assert.equal(bash("git push origin main-fix"), null);
  assert.equal(bash("git push"), null);
});

test("blocks skipping git hooks", () => {
  assert.ok(bash(`git commit --no-verify -m "msg"`));
  assert.ok(bash(`git commit -n -m "msg"`));
  assert.ok(bash(`git commit -nm "msg"`));
  assert.ok(bash("git push --no-verify origin feature"));
});

test("text inside commit messages and heredocs is not treated as a command", () => {
  assert.equal(bash(`git commit -m "guard blocks --no-verify and git push origin main"`), null);
  assert.equal(bash(`git commit -q -m 'mentions git push --force'`), null);
  assert.equal(bash("git commit -F - <<'EOF'\nblocks --no-verify and cat .env.local\nEOF"), null);
  assert.equal(bash("cat <<EOF > notes.md\nsupabase db push is owner-only\nEOF"), null);
  assert.ok(bash(`git commit -m "msg" && git push origin main`));
});

test("blocks commands that change a hosted Supabase project", () => {
  for (const cmd of [
    "supabase link --project-ref abc",
    "npx supabase link --project-ref abc",
    "supabase db push",
    "supabase --workdir . db push",
    "supabase db reset --linked",
    "supabase migration up --linked",
    "supabase migration repair --linked 2026",
    "supabase functions deploy f",
    "supabase secrets set X=1",
    "supabase db dump --db-url postgres://x",
  ]) assert.ok(bash(cmd), cmd);
});

test("allows local Supabase work", () => {
  for (const cmd of ["supabase start", "supabase db reset", "supabase test db", "supabase migration new add_events", "npx supabase status"]) {
    assert.equal(bash(cmd), null, cmd);
  }
});

test("blocks reading, copying or staging secret files", () => {
  for (const cmd of [
    "cat .env.local",
    "grep KEY .env.development.local",
    "tac .env.local",
    "nl .env.local",
    "sort .env.local",
    "cat .env.loc*",
    "cp .env.local /tmp/x",
    "git add .env.local",
    `node -e "require('fs').readFileSync('.env.local')"`,
    `python3 -c "open('.env.local').read()"`,
  ]) assert.ok(bash(cmd), cmd);
});

test("allows harmless mentions of secret files", () => {
  for (const cmd of [
    "git check-ignore -v .env.local",
    `grep -n ".env.local" .gitignore`,
    "ls -la .env.local",
    "test -f .env.local",
    "echo .env.local >> .gitignore",
  ]) assert.equal(bash(cmd), null, cmd);
});
