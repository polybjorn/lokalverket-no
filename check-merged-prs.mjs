#!/usr/bin/env node
// Fails when a pull request the forge reports as merged is not actually on the
// target branch.
//
// This exists because that happened twice on 2026-09-14 and both times every
// signal said success: the PR reported merged=true with a correct
// merge_commit_sha, the linked issue auto-closed, the head branch was deleted by
// the cleanup job, and CI went green on a commit that was on no branch. The only
// thing that caught it was reading `git log` afterwards and knowing which merge
// commit to expect. That should not be a habit someone has to remember.
//
// Reachability is decided by git, never by the API. The forge's own record of
// refs is the thing under suspicion: its `/branches` listing has been observed
// omitting refs that `git ls-remote` reports (nixfleet #172), so asking it
// whether a merge landed would be asking the suspect for an alibi.
//
// Usage: check-merged-prs.mjs [--days N] [--ref origin/main]
//   API    repo API base, e.g. https://forge/api/v1/repos/owner/repo
//   TOKEN  a token that may read pulls (the automatic Actions token may not:
//          Forgejo answers 404 "Can not read pulls" for it on some paths)

import { execFileSync } from "node:child_process";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const days = Number(arg("days", "7"));
const ref = arg("ref", "origin/main");

const api = process.env.API;
const token = process.env.TOKEN;
if (!api) { console.error("API is not set"); process.exit(2); }
if (!token) {
  console.error("TOKEN is not set. It needs read access to pulls; the automatic");
  console.error("Actions token is not always enough on this forge.");
  process.exit(2);
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gitOk = (...args) => {
  try { execFileSync("git", args, { stdio: "ignore" }); return true; }
  catch { return false; }
};

// A shallow clone cannot answer this question and does not fail loudly when
// asked: the merge commits fetch fine, but main's history is truncated, so
// `--is-ancestor` says no for nearly all of them. Measured on a --depth 1 clone
// of a repo with zero real orphans: it reported six of twelve as ORPHANED and
// exited 1. A watchdog that cries wolf gets muted, and then the real one is
// invisible too - so refuse rather than guess.
if (git("rev-parse", "--is-shallow-repository") === "true") {
  console.error("this is a shallow clone, so reachability cannot be decided here.");
  console.error("Nearly every merge would be reported as orphaned.");
  console.error("Use a full clone, or in CI set fetch-depth: 0 on actions/checkout.");
  process.exit(2);
}

const since = Date.now() - days * 86400_000;

const res = await fetch(`${api}/pulls?state=closed&limit=50&sort=recentupdate`, {
  headers: { Authorization: `token ${token}` },
});
if (!res.ok) {
  console.error(`could not list pulls: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const merged = (await res.json()).filter(
  (p) => p.merged && p.merge_commit_sha && Date.parse(p.merged_at) >= since,
);

if (!merged.length) {
  console.log(`no pull requests merged in the last ${days} days`);
  process.exit(0);
}

const orphans = [];
const missing = [];
for (const p of merged) {
  const sha = p.merge_commit_sha;
  // An orphaned merge commit is unreachable, so a normal clone will not have
  // fetched it. Ask for it directly before concluding anything.
  if (!gitOk("cat-file", "-e", `${sha}^{commit}`)) {
    if (!gitOk("fetch", "--quiet", "origin", sha)) {
      missing.push(p);
      continue;
    }
  }
  if (!gitOk("merge-base", "--is-ancestor", sha, ref)) orphans.push(p);
}

console.log(`checked ${merged.length} merged pull request(s) from the last ${days} days against ${ref}`);

for (const p of missing) {
  console.log(`  UNFETCHABLE  #${p.number}  ${p.merge_commit_sha.slice(0, 7)}  ${p.title}`);
  console.log("      the forge reports this merge commit but will not serve the object");
}
for (const p of orphans) {
  const parents = gitOk("cat-file", "-e", `${p.merge_commit_sha}^{commit}`)
    ? git("log", "-1", "--format=%p", p.merge_commit_sha)
    : "(unknown)";
  console.log(`  ORPHANED     #${p.number}  ${p.merge_commit_sha.slice(0, 7)}  ${p.title}`);
  console.log(`      merged ${p.merged_at}, parents ${parents}, not reachable from ${ref}`);
}

if (!orphans.length && !missing.length) {
  console.log("  all reachable");
  process.exit(0);
}

console.log("");
console.log("A merge the forge recorded is not on the branch. The work is not lost -");
console.log("re-land it with `git cherry-pick -x` of the head commits onto current");
console.log(`${ref} - but nothing else will tell you, so do not close this quietly.`);
console.log("Context and the running investigation: nixfleet #172.");
process.exit(1);
