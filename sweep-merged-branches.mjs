#!/usr/bin/env node
// Deletes every herd/ branch already merged into main, and checks afterwards
// that they actually went.
//
// This is the only thing that deletes a branch in this repo. It used to be the
// backstop behind a per-merge job that deleted through the forge API and asked
// the same API whether the branch was gone; that job is gone, because the API
// is the surface under suspicion and was being used as both executor and judge.
// Of eight branches it reported deleting on 2026-09-14, three were still on the
// remote afterwards - two of them from consecutive merges. It verified its own
// work and still missed them, because the ref comes back AFTER the job has
// finished looking, and no check made during a job catches that.
//
// So: converge instead of check. This does not care why a ref is there, only
// that it is there now and merged. It retries within a run, and if the forge
// restores one tomorrow, tomorrow's run takes it again.
//
// Everything that decides anything goes through git, never the forge API. Its
// /branches listing has been seen omitting refs that git ls-remote reports -
// and polybjorn-en's sweep, which this borrows its enumeration from, still
// deletes through the API. That is the half not worth copying.
//
// Usage: sweep-merged-branches.mjs [--remote origin] [--ref origin/main] [--dry-run]
//        [--attempts 4] [--wait 5]

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
// How hard to push against a ref the forge keeps restoring. Four attempts five
// seconds apart, so a branch has to survive roughly twenty seconds of being
// deleted before this goes red; both measured restores landed within two
// seconds of their delete. Exposed as flags so the test can run the same code
// with the waiting taken out.
const attempts = Math.max(1, Number(arg("attempts", "4")) || 1);
const waitSeconds = Math.max(0, Number(arg("wait", "5")) || 0);

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

if (dryRun) {
  for (const b of targets) console.log(`  would delete ${b.name}`);
  process.exit(0);
}

// One pass is not enough, and the reason is not a flaky network. A deleted ref
// comes back, at its old sha, after a delete that genuinely applied - both
// specimens measured on bjorn/rovar-no on 2026-09-15 had 0000000 as the reflog's
// old sha, so the deletion was real each time.
//
// WHO puts it back is deliberately not stated here. An earlier version of this
// comment said the restoring write was the forge's own internal one, reading a
// `update by push` reflog entry as evidence of that. nixfleet #202 established
// the opposite: `update by push` is what a PUSHING client writes for its own
// remote-tracking ref, and receive-pack on the receiving side writes plain
// `push`. Reproduced locally on git 2.54.0 rather than taken on trust - push to
// a bare repo, then read both reflogs, and the two messages differ exactly that
// way. So the entry does not say what it was read as saying, and nixfleet #172's
// "the ref was never deleted" is superseded.
//
// The cause is nixfleet #194's to settle and is not measurable from this repo or
// this host. Nothing below depends on the answer, which is the point of the shape:
// it converges on a ref that is there and merged, whoever put it there.
//
// The restore does not land at a fixed offset - one specimen 1.775 s after the
// delete, the other 0.069 s BEFORE the push printed `- [deleted]` - so no
// arrangement of checks is a guarantee and no single wait is long enough to be
// one. What works is converging: ask again, delete again, and reserve red for a
// ref that outlasts every attempt. The alternative was measured too: rovar-no's
// correct-but-one-shot job went red on two of its first four merges over
// branches nobody had lost, which is how a watchdog gets muted.
//
// The restore fires once, on the delete that follows a merge; a later delete is
// not undone. Tested on 2026-09-15 - a ref left in the diverged state was
// deleted and stayed gone for 3 m 14 s on every git surface, with a second
// branch held as an untouched control. One trial, from an agent session rather
// than a runner, which is why the loop is bounded rather than trusting it.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pending = targets;
let attempt = 0;
while (true) {
  attempt++;
  for (const b of pending) {
    // git push --delete, not the API. Deleting through the surface that has been
    // reporting successful deletions of branches that survived would be choosing
    // the one tool known to be unreliable for this exact operation.
    if (gitOk("push", "--quiet", remote, "--delete", b.name)) console.log(`  deleted    ${b.name}`);
    else console.log(`  FAILED     ${b.name} - push --delete returned non-zero`);
  }

  // The point of the whole exercise: ask again, from scratch.
  await sleep(waitSeconds * 1000);
  const after = new Map(list().map((b) => [b.name, b.sha]));

  const survivors = [];
  for (const b of pending) {
    const sha = after.get(b.name);
    if (sha === undefined) continue;
    // Same name, different sha, is somebody pushing the branch again rather than
    // the forge restoring it - the restore comes back at the old sha. Deleting
    // that would throw away work that arrived while this was running, so it is
    // reported and left, and the next scheduled run judges it on its merits.
    if (sha !== b.sha) {
      console.log(`  re-pushed  ${b.name} (${b.sha.slice(0, 7)} -> ${sha.slice(0, 7)}) - leaving it`);
      continue;
    }
    survivors.push(b);
  }

  if (!survivors.length) {
    console.log(`swept ${targets.length}, all confirmed gone`);
    process.exit(0);
  }
  if (attempt >= attempts) {
    console.log("");
    for (const b of survivors) console.log(`  SURVIVED   ${b.name} (${b.sha.slice(0, 7)})`);
    console.log("");
    console.log(`These were merged and deleted ${attempts} times each, and are still on the`);
    console.log("remote. That is the condition nixfleet #172 is about, past the point where");
    console.log("retrying explains it. The next scheduled sweep will try again, so this is");
    console.log("loud rather than urgent - but a branch that reaches here is worth saying so");
    console.log("on that issue.");
    process.exit(1);
  }
  for (const b of survivors) console.log(`  came back  ${b.name} - attempt ${attempt} of ${attempts}`);
  pending = survivors;
}
