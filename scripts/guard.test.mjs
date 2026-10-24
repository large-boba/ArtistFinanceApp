// Proves the PreToolUse guard blocks what it should and nothing else.
// Run: node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import nodeFs from "node:fs";
import os from "node:os";
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
  assert.ok(write(`${dir}/.dev.vars`));
  assert.ok(bash("cat .dev.vars"));
  assert.equal(write(`${dir}/.dev.vars.example`), null);
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
  assert.ok(bash("git push", "main"));
  assert.ok(bash("git push origin HEAD", "main"));
});

test("a branch switch earlier in the same command is taken into account", () => {
  // The hook runs before the command, while still on the feature branch.
  assert.ok(bash("git checkout main && git push"));
  assert.ok(bash("git switch main && git merge claude/x && git push"));
  assert.ok(bash("git checkout main && git push origin HEAD"));
  assert.ok(bash("git checkout - && git push"));
  assert.equal(bash("git checkout -b claude/new && git push -u origin claude/new"), null);
  assert.equal(bash("git switch claude/other && git push", "main"), null);
});

test("wrappers and shell flag groups don't hide a push", () => {
  assert.ok(bash(`bash -lc "git push origin main"`));
  assert.ok(bash(`sh -ec 'git push --force origin x'`));
  assert.ok(bash("sudo -u root git push origin main"));
  assert.ok(bash("env FOO=1 git push origin main"));
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
  assert.ok(bash("git -c core.hooksPath=/dev/null commit -m x"));
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
    "supabase config push",
    "supabase migration repair 2026 --status reverted",
    "supabase storage rm ss:///receipts/x",
    "supabase inspect db locks",
    "supabase migration list",
    "supabase gen types typescript",
    "npm exec supabase db push",
    "pnpm dlx supabase db push",
    "yarn dlx supabase link",
    "npx supabase@2 db push",
  ]) assert.ok(bash(cmd), cmd);
});

test("allows local Supabase work", () => {
  for (const cmd of [
    "supabase start", "supabase stop", "supabase status", "supabase --version",
    "supabase db reset", "supabase db diff -f add_events", "supabase db lint",
    "supabase test db", "supabase migration new add_events", "supabase migration up",
    "supabase migration list --local", "supabase gen types typescript --local --schema public",
    "supabase --workdir . start", "npx supabase status", "npm exec supabase test db",
  ]) assert.equal(bash(cmd), null, cmd);
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
    `printf %s "$(<.env.local)"`,
    "cat < .env.local",
  ]) assert.ok(bash(cmd), cmd);
});

// Cases found by the security reviewer.
test("only the owner merges pull requests", () => {
  assert.ok(bash("gh pr merge 12 --squash"));
  assert.ok(bash("gh pr merge --auto 12"));
  assert.ok(bash("gh api -X PUT repos/o/r/pulls/12/merge"));
  assert.equal(bash("gh pr view 12"), null);
  assert.equal(bash("gh pr create --fill"), null);
});

test("package scripts and wrappers are followed to the real command", () => {
  const projectDir = nodeFs.mkdtempSync(`${os.tmpdir()}/guard-`);
  nodeFs.writeFileSync(`${projectDir}/package.json`, JSON.stringify({ scripts: { "db:push": "supabase db push", check: "npm run lint", lint: "next lint" } }));
  const run = (command) => evaluate({ tool_name: "Bash", tool_input: { command } }, { currentBranch: () => "claude/x", projectDir });
  assert.ok(run("npm run db:push"));
  assert.ok(run("pnpm db:push"));
  assert.ok(run("pnpm supabase db push"));
  assert.ok(run("npm exec supabase -- db push"));
  assert.ok(run("timeout 300 npx supabase db push"));
  assert.ok(run("supabase gen types typescript --local --project-id abc"));
  assert.equal(run("npm run check"), null);
  assert.equal(run("npm run lint"), null);
  assert.equal(run("npx next build"), null);
  nodeFs.rmSync(projectDir, { recursive: true, force: true });
});

test("Vercel is limited to local dev and build", () => {
  assert.ok(bash("vercel --prod"));
  assert.ok(bash("vercel env pull .env.local"));
  assert.ok(bash("npx vercel deploy"));
  assert.equal(bash("vercel dev"), null);
  assert.equal(bash("npx vercel build"), null);
});

test("Cloudflare is limited to local build and preview", () => {
  for (const cmd of [
    "wrangler deploy", "npx wrangler deploy", "wrangler versions upload", "wrangler secret put KEY",
    "wrangler login", "wrangler tail", "wrangler r2 bucket create receipts", "wrangler dev --remote",
    "npx opennextjs-cloudflare deploy", "opennextjs-cloudflare upload", "opennextjs-cloudflare preview --remote",
    "pnpm wrangler deploy",
    "wrangler dev -r", "wrangler dev --remote=true",
    "node node_modules/wrangler/bin/wrangler.js deploy",
    "node ./node_modules/@opennextjs/cloudflare/dist/cli/index.js deploy",
  ]) assert.ok(bash(cmd), cmd);
  // Review round 2: aliases, .bin shims, node flags before the script.
  for (const cmd of [
    "npx wrangler2 deploy", "wrangler2 deploy",
    "node node_modules/.bin/wrangler deploy",
    "node --no-warnings node_modules/wrangler/bin/wrangler.js deploy",
    "node node_modules/wrangler deploy",
    "node node_modules/.bin/opennextjs-cloudflare deploy",
    "wrangler dev -r=true", "wrangler dev --x-remote-bindings",
  ]) assert.ok(bash(cmd), cmd);
  assert.equal(bash("node node_modules/.bin/wrangler dev"), null);
  assert.equal(bash("node --no-warnings node_modules/.bin/opennextjs-cloudflare build"), null);
  assert.equal(bash("wrangler dev --remote=false"), null);
  assert.equal(bash("node node_modules/wrangler/bin/wrangler.js dev"), null);
  for (const cmd of [
    "npx opennextjs-cloudflare build", "npx opennextjs-cloudflare preview", "wrangler dev",
    "npx wrangler types", "wrangler --version", "opennextjs-cloudflare populateCache local",
  ]) assert.equal(bash(cmd), null, cmd);
});

test("npm scripts that deploy to Cloudflare are blocked", () => {
  const projectDir = nodeFs.mkdtempSync(`${os.tmpdir()}/guard-cf-`);
  nodeFs.writeFileSync(`${projectDir}/package.json`, JSON.stringify({ scripts: {
    preview: "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    deploy: "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
  } }));
  const run = (command) => evaluate({ tool_name: "Bash", tool_input: { command } }, { currentBranch: () => "claude/x", projectDir });
  assert.ok(run("npm run deploy"));
  assert.equal(run("npm run preview"), null);
  assert.equal(run("npm run cf-typegen"), null);
  nodeFs.rmSync(projectDir, { recursive: true, force: true });
});

test("extra words after a script name and scoped package names are checked (T0.5 review round 3)", () => {
  const projectDir = nodeFs.mkdtempSync(`${os.tmpdir()}/guard-cf3-`);
  nodeFs.writeFileSync(`${projectDir}/package.json`, JSON.stringify({ scripts: {
    preview: "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    deploy: "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts",
  } }));
  const run = (command) => evaluate({ tool_name: "Bash", tool_input: { command } }, { currentBranch: () => "claude/x", projectDir });
  for (const cmd of [
    "npm run preview -- --remote", "npm run preview -- -r", "pnpm preview --remote",
    "yarn run preview --remote", "bun run preview --remote", "npm run cf-typegen -- --remote",
    "npx @opennextjs/cloudflare deploy", "npx -y @opennextjs/cloudflare@latest preview --remote",
    "bunx @opennextjs/cloudflare deploy", "pnpm dlx @opennextjs/cloudflare deploy",
    "npm exec @opennextjs/cloudflare deploy", "npx -c 'wrangler deploy'", "npm exec -c 'wrangler deploy'",
    // Options with values before the subcommand, and --call= (final security check).
    `npm --prefix ${projectDir} run deploy`, "npm -C . run deploy", "pnpm --dir . deploy",
    "pnpm --filter web deploy", `npx --call="wrangler deploy"`, `npm exec --call="wrangler deploy"`,
  ]) assert.ok(run(cmd), cmd);
  assert.equal(run(`npm --prefix ${projectDir} run preview`), null);
  for (const cmd of [
    "npm run preview", "pnpm preview", "npx @opennextjs/cloudflare build",
    "npx -p wrangler wrangler dev", "npx --yes wrangler@4 types", "npm exec -- wrangler dev",
  ]) assert.equal(run(cmd), null, cmd);
  nodeFs.rmSync(projectDir, { recursive: true, force: true });
});

test("recursive grep must exclude secret files", () => {
  assert.ok(bash("grep -rn SERVICE_ROLE ."));
  assert.ok(bash("grep --recursive KEY ."));
  assert.ok(bash("rg --hidden --no-ignore KEY"));
  assert.equal(bash("grep -rn --exclude='.env*' SERVICE_ROLE ."), null);
  assert.equal(bash("rg SERVICE_ROLE"), null);
  assert.equal(bash("grep -n foo src/app/page.tsx"), null);
  assert.equal(bash("grep -rn getSession src/"), null);
  assert.equal(bash("grep -rn foo src supabase --include=*.ts"), null);
  assert.ok(bash("grep -rn foo src ."));
  assert.ok(bash("grep -rn foo"));
});

test("line continuations, shell keywords and runners don't hide commands", () => {
  assert.ok(bash("git push \\\n  origin main"));
  assert.ok(bash("for b in x; do git push --force origin $b; done"));
  assert.ok(bash("if true; then git push origin main; fi"));
  assert.ok(bash(`npx tsx -e "require('fs').readFileSync('.env.local')"`));
  assert.ok(bash("echo X > .env.local"));
  assert.ok(bash("echo X >.env.local"));
  assert.ok(bash("HUSKY=0 git commit -m x"));
  assert.ok(bash("git config core.hooksPath /dev/null"));
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
