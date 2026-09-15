#!/usr/bin/env node
// Pins the behaviour of sweep-merged-branches.mjs against real git fixtures.
//
// A sweep that deletes branches is the one script here where being wrong is
// destructive rather than noisy, and its two dangerous mistakes are silent:
// deleting an unmerged branch loses work, and skipping a preserved one destroys
// evidence. Both look like a clean run.
//
// The retry added for #33 gets the same treatment, including the SURVIVED path.
// An earlier version of this file said that path could not be reproduced locally
// and should not be faked; the second half still holds and the first turned out
// to be wrong. A post-receive hook on the bare origin puts the ref back after a
// delete that genuinely applied, which is the forge behaviour as measured, and
// the script runs against it unmodified. See the hook where it is installed.
//
// Usage: ./sweep-merged-branches.test.mjs

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.resolve("sweep-merged-branches.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sweep-test-"));
const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8" }).trim();

const origin = path.join(tmp, "origin");
fs.mkdirSync(origin);
git(origin, "init", "-q", "--bare", "-b", "main");

const seed = path.join(tmp, "seed");
fs.mkdirSync(seed);
git(seed, "init", "-q", "-b", "main");
git(seed, "config", "user.email", "t@e.invalid");
git(seed, "config", "user.name", "t");
fs.writeFileSync(path.join(seed, "a"), "a\n");
git(seed, "add", "a");
git(seed, "commit", "-qm", "first");
// merged: branched from main and already contained in it
git(seed, "branch", "herd/merged-one");
git(seed, "branch", "herd/merged-two");
git(seed, "branch", "herd/preserved-one");
git(seed, "branch", "other/not-ours");
// unmerged: a commit main does not contain
git(seed, "checkout", "-q", "-b", "herd/unmerged");
fs.writeFileSync(path.join(seed, "b"), "b\n");
git(seed, "add", "b");
git(seed, "commit", "-qm", "not on main");
git(seed, "checkout", "-q", "main");
git(seed, "remote", "add", "origin", origin);
git(seed, "push", "-q", "origin", "--all");

const clone = (name, extra = []) => {
  git(tmp, "clone", "-q", ...extra, origin, name);
  const p = path.join(tmp, name);
  git(p, "config", "user.email", "t@e.invalid");
  git(p, "config", "user.name", "t");
  return p;
};

const heads = () =>
  git(tmp, "ls-remote", "--heads", origin).split("\n").filter(Boolean)
    .map((l) => l.split(/\s+/)[1].replace("refs/heads/", "")).sort();

let failures = 0;
const run = (cwd, args = []) =>
  new Promise((resolve) => {
    const c = spawn(script, args, { cwd });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
const expect = (name, ok, detail) => {
  if (ok) return console.log(`  ok    ${name}`);
  failures++;
  console.log(`  FAIL  ${name}`);
  console.log(detail.split("\n").map((l) => `          | ${l}`).join("\n"));
};

console.log("sweep-merged-branches.mjs");

// Guards first: these must refuse rather than delete something.
const shallowDir = path.join(tmp, "shallow");
git(tmp, "clone", "-q", "--depth", "1", `file://${origin}`, "shallow");
git(shallowDir, "config", "user.email", "t@e.invalid");
git(shallowDir, "config", "user.name", "t");
let r = await run(shallowDir);
expect("shallow clone refuses", r.code === 2 && /shallow clone/.test(r.out), r.out);

const broken = clone("broken");
git(broken, "remote", "set-url", "origin", path.join(tmp, "nope"));
r = await run(broken);
expect("unreachable remote refuses", r.code === 2 && /could not fetch main/.test(r.out), r.out);

// Dry run must change nothing.
const work = clone("work");
fs.writeFileSync(path.join(work, "sweep-preserved-branches.txt"), "# keep this one\nherd/preserved-one\n");
const beforeDry = heads();
r = await run(work, ["--dry-run"]);
expect("dry run deletes nothing", heads().join() === beforeDry.join() && /would delete/.test(r.out), r.out);

// The real thing.
r = await run(work);
const after = heads();
expect("merged herd/ branches are deleted",
  !after.includes("herd/merged-one") && !after.includes("herd/merged-two"), r.out + "\n" + after.join(" "));
expect("an unmerged herd/ branch is left alone",
  after.includes("herd/unmerged") && /unmerged\s+herd\/unmerged/.test(r.out), r.out + "\n" + after.join(" "));
expect("a preserved branch is left alone",
  after.includes("herd/preserved-one") && /preserved\s+herd\/preserved-one/.test(r.out), r.out + "\n" + after.join(" "));
expect("a branch outside herd/ is never considered",
  after.includes("other/not-ours") && !/other\/not-ours/.test(r.out), r.out + "\n" + after.join(" "));
expect("exits 0 when everything it deleted is gone", r.code === 0 && /all confirmed gone/.test(r.out), r.out);

// Without the preserved file, the same branch becomes fair game - proving the
// exclusion comes from the file and is not accidental.
fs.rmSync(path.join(work, "sweep-preserved-branches.txt"));
r = await run(work);
expect("preservation comes from the file, not from luck",
  !heads().includes("herd/preserved-one"), r.out + "\n" + heads().join(" "));

r = await run(work);
expect("a second run with nothing to do is quiet and green",
  r.code === 0 && /nothing to sweep|no herd\//.test(r.out), r.out);

// The restore, reproduced. The comment at the top of this file used to say the
// SURVIVED path could not be exercised locally and should not be faked. That was
// right about faking and wrong about the first half: the forge's behaviour is a
// ref that reappears at its old sha after a delete that genuinely applied, and a
// post-receive hook on the bare origin does exactly that to a real git server.
// Nothing here asserts an outcome the script did not produce - the hook moves
// refs, the script is run unmodified, and the ref state is read back with
// ls-remote the same way the script reads it.
//
// What is still NOT reproduced is the cause: the forge's database record going
// out of step with the ref. That is nixfleet #194's, not this script's, and the
// script is deliberately built not to care which of the two is out of step.
const restorePlan = path.join(tmp, "restore-plan.json");
const hook = path.join(origin, "hooks", "post-receive");
fs.writeFileSync(hook, `#!/usr/bin/env node
const fs = require("fs");
const { execFileSync } = require("child_process");
const plan = JSON.parse(fs.readFileSync(${JSON.stringify(restorePlan)}, "utf8"));
let changed = false;
for (const line of fs.readFileSync(0, "utf8").split("\\n").filter(Boolean)) {
  const [old, nw, ref] = line.split(/\\s+/);
  if (!/^0+$/.test(nw)) continue;            // only deletions
  const p = plan[ref];
  if (!p || p.remaining <= 0) continue;
  execFileSync("git", ["update-ref", ref, p.sha === "OLD" ? old : p.sha],
    { env: { ...process.env, GIT_DIR: ${JSON.stringify(origin)} } });
  p.remaining--;
  changed = true;
}
if (changed) fs.writeFileSync(${JSON.stringify(restorePlan)}, JSON.stringify(plan));
`);
fs.chmodSync(hook, 0o755);

const unmergedSha = git(tmp, "ls-remote", origin, "refs/heads/herd/unmerged").split(/\s+/)[0];
const push = (name) => {
  git(work, "push", "-q", "origin", `main:refs/heads/${name}`);
  return git(work, "ls-remote", "origin", `refs/heads/${name}`).split(/\s+/)[0];
};

// Green path: one branch the forge gives back once, one that somebody genuinely
// re-pushes mid-sweep. The first must be taken on the retry; the second must not.
fs.writeFileSync(restorePlan, JSON.stringify({
  "refs/heads/herd/restored-once": { remaining: 1, sha: "OLD" },
  "refs/heads/herd/re-pushed": { remaining: 1, sha: unmergedSha },
}));
push("herd/restored-once");
push("herd/re-pushed");

r = await run(work, ["--attempts", "3", "--wait", "0"]);
expect("a ref the forge gives back is deleted again on the retry",
  !heads().includes("herd/restored-once") && /came back\s+herd\/restored-once/.test(r.out),
  r.out + "\n" + heads().join(" "));
expect("a retry that converges is green",
  r.code === 0 && /all confirmed gone/.test(r.out), r.out);
expect("a branch re-pushed at a new sha mid-sweep is left alone",
  heads().includes("herd/re-pushed") && /re-pushed\s+herd\/re-pushed/.test(r.out),
  r.out + "\n" + heads().join(" "));

// Red path: a ref that comes back every single time. This is the one case that
// must end in a non-zero exit, and it must do so only after the last attempt -
// going red on the first would be the muted-watchdog failure this retry exists
// to avoid.
fs.writeFileSync(restorePlan, JSON.stringify({
  "refs/heads/herd/restored-always": { remaining: 99, sha: "OLD" },
}));
push("herd/restored-always");

r = await run(work, ["--attempts", "2", "--wait", "0"]);
const tries = (r.out.match(/deleted\s+herd\/restored-always/g) || []).length;
expect("a ref that outlasts every attempt is red, not green",
  r.code === 1 && /SURVIVED\s+herd\/restored-always/.test(r.out), r.out);
expect("it goes red only after the last attempt, having used them all",
  tries === 2, `${tries} delete attempt(s) for --attempts 2\n${r.out}`);

// And the bound is a bound: --attempts 4 must try four times, not two.
fs.writeFileSync(restorePlan, JSON.stringify({
  "refs/heads/herd/restored-always": { remaining: 99, sha: "OLD" },
}));
r = await run(work, ["--attempts", "4", "--wait", "0"]);
expect("the attempt count is honoured rather than hard-coded",
  (r.out.match(/deleted\s+herd\/restored-always/g) || []).length === 4, r.out);

fs.rmSync(hook);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall pinned behaviours hold");
process.exit(failures ? 1 : 0);
