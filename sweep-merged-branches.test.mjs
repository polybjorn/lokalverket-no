#!/usr/bin/env node
// Pins the behaviour of sweep-merged-branches.mjs against real git fixtures.
//
// A sweep that deletes branches is the one script here where being wrong is
// destructive rather than noisy, and its two dangerous mistakes are silent:
// deleting an unmerged branch loses work, and skipping a preserved one destroys
// evidence. Both look like a clean run.
//
// One path is NOT covered and should not be faked: SURVIVED, where the delete
// succeeds and the ref is still there afterwards. Nothing git can be made to do
// locally reproduces it - it needs the forge behaviour under investigation in
// nixfleet #172. It is exercised in production instead, which is where it was
// found.
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

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall pinned behaviours hold");
process.exit(failures ? 1 : 0);
