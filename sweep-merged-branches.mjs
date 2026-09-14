#!/usr/bin/env node
// Deletes every herd/ branch already merged into main, and checks afterwards
// that they actually went.
//
// The per-merge job in delete-merged-branch.yml is not enough, and the numbers
// say so rather than a theory: of eight branches that job reported deleting on
// 2026-09-14, three were still on the remote afterwards - two of them from
// consecutive merges. That job verifies its own work and still misses these,
// because the ref comes back AFTER the job has finished looking. No check made
// during the job can catch something that happens after it.
//
// So this is a different shape rather than a better check: a sweep that runs on
// a schedule and converges. It does not care why a ref is there, only that it is
// there now and merged. If the forge restores one tomorrow, tomorrow's run takes
// it again.
//
// Everything that decides anything goes through git, never the forge API. The
// API is the surface under suspicion - its /branches listing has been seen
// omitting refs that git ls-remote reports - and polybjorn-en's sweep, which
// this borrows its enumeration from, still deletes through the API. That is the
// half not worth copying.
//
// Usage: sweep-merged-branches.mjs [--remote origin] [--ref origin/main] [--dry-run]

import { execFileSync } from "node:child_process";
import fs from "node:fs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const dryRun = process.argv.includes("--dry-run");
const remote = arg("remote", "origin");
const ref = arg("ref", "origin/main");
const preservedPath = arg("preserved", "sweep-preserved-branches.txt");

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const gitOk = (...a) => {
  try { execFileSync("git", a, { stdio: "ignore" }); return true; } catch { return false; }
};

// Branches deliberately left alone. A file rather than a constant: preserving a
// branch is a decision about one moment, and un-preserving it should not need a
// code review. Right now it holds evidence for nixfleet #172 - merged branches
// whose delete job reported success while the ref survived, kept because the
// three earlier instances were swept before anyone could examine them.
const preserved = new Set();
if (fs.existsSync(preservedPath)) {
  for (const line of fs.readFileSync(preservedPath, "utf8").split("\n")) {
    const name = line.replace(/#.*$/, "").trim();
    if (name) preserved.add(name);
  }
}

if (!gitOk("fetch", "--quiet", remote, "main")) {
  console.error(`could not fetch main from ${remote}; refusing to judge merged-ness`);
  console.error("against a ref that may be stale, which would delete nothing or the wrong thing.");
  process.exit(2);
}
if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("shallow clone: --merged would be answered from truncated history.");
  console.error("Use a full clone, or fetch-depth: 0 on actions/checkout.");
  process.exit(2);
}

const url = git("remote", "get-url", remote);
const list = () =>
  git("ls-remote", "--heads", url, "refs/heads/herd/*")
    .split("\n").filter(Boolean)
    .map((l) => {
      const [sha, r] = l.split(/\s+/);
      return { sha, name: r.replace("refs/heads/", "") };
    });

const before = list();
if (!before.length) {
  console.log("no herd/ branches on the remote");
  process.exit(0);
}

const targets = [];
for (const b of before) {
  if (preserved.has(b.name)) { console.log(`  preserved  ${b.name}`); continue; }
  // The object will be missing locally for a branch this clone never fetched.
  if (!gitOk("cat-file", "-e", `${b.sha}^{commit}`) && !gitOk("fetch", "--quiet", remote, b.sha)) {
    console.log(`  unknown    ${b.name} (${b.sha.slice(0, 7)}) - cannot fetch it, leaving alone`);
    continue;
  }
  if (!gitOk("merge-base", "--is-ancestor", b.sha, ref)) {
    console.log(`  unmerged   ${b.name}`);
    continue;
  }
  targets.push(b);
}

if (!targets.length) {
  console.log("nothing to sweep");
  process.exit(0);
}

for (const b of targets) {
  if (dryRun) { console.log(`  would delete ${b.name}`); continue; }
  // git push --delete, not the API. Deleting through the surface that has been
  // reporting successful deletions of branches that survived would be choosing
  // the one tool known to be unreliable for this exact operation.
  if (gitOk("push", "--quiet", remote, "--delete", b.name)) console.log(`  deleted    ${b.name}`);
  else console.log(`  FAILED     ${b.name} - push --delete returned non-zero`);
}
if (dryRun) process.exit(0);

// The point of the whole exercise: ask again, from scratch.
const after = new Set(list().map((b) => b.name));
const survivors = targets.filter((b) => after.has(b.name));
if (!survivors.length) {
  console.log(`swept ${targets.length}, all confirmed gone`);
  process.exit(0);
}
console.log("");
for (const b of survivors) console.log(`  SURVIVED   ${b.name} (${b.sha.slice(0, 7)})`);
console.log("");
console.log("These were merged, deleted, and are still on the remote. That is the");
console.log("condition nixfleet #172 is about. The next scheduled sweep will try again,");
console.log("so this is loud rather than urgent - but a branch that survives repeatedly");
console.log("is worth saying so on that issue.");
process.exit(1);
