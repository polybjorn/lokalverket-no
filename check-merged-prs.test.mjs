#!/usr/bin/env node
// Pins the refusal paths of check-merged-prs.mjs.
//
// That script has six ways to refuse and two ways to pass, and until this file
// existed every one of them had been exercised exactly once, by hand, on the day
// it was written. A later edit could flatten any of them silently - and the two
// that matter most fail open: acknowledge-everything and orphan-detection-off
// both turn the job green. A watchdog that has quietly stopped watching is worse
// than no watchdog, because the green tick is now evidence of nothing while
// still reading as evidence.
//
// Offline: a stub HTTP server stands in for the forge API, and real git repos
// are built in a temp directory. No network, no live repo state, so a failure
// here is the script changing rather than the world changing.
//
// Usage: ./check-merged-prs.test.mjs

import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = path.resolve("check-merged-prs.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "merge-audit-test-"));
const run = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

// --- fixtures -------------------------------------------------------------
// origin: main with two commits, plus a `side` branch whose commit is NOT an
// ancestor of main. That side commit is what an orphaned merge looks like from
// here: fetchable, real, unreachable.
const origin = path.join(tmp, "origin");
fs.mkdirSync(origin);
run(origin, "init", "-q", "--bare", "-b", "main");

const seed = path.join(tmp, "seed");
fs.mkdirSync(seed);
run(seed, "init", "-q", "-b", "main");
run(seed, "config", "user.email", "test@example.invalid");
run(seed, "config", "user.name", "test");
fs.writeFileSync(path.join(seed, "a"), "a\n");
run(seed, "add", "a");
run(seed, "commit", "-qm", "first");
fs.writeFileSync(path.join(seed, "b"), "b\n");
run(seed, "add", "b");
run(seed, "commit", "-qm", "second");
const onMain = run(seed, "rev-parse", "HEAD");
run(seed, "checkout", "-q", "-b", "side", "HEAD~1");
fs.writeFileSync(path.join(seed, "c"), "c\n");
run(seed, "add", "c");
run(seed, "commit", "-qm", "orphan-shaped");
const notOnMain = run(seed, "rev-parse", "HEAD");
run(seed, "remote", "add", "origin", origin);
run(seed, "push", "-q", "origin", "main", "side");

const clone = (dest, extra = []) => {
  run(tmp, "clone", "-q", ...extra, origin, dest);
  return path.join(tmp, dest);
};
const full = clone("full");
// file:// rather than a path: git ignores --depth on local clones and prints a
// warning, which would have made the shallow test a full clone quietly.
const shallow = (() => {
  run(tmp, "clone", "-q", "--depth", "1", `file://${origin}`, "shallow");
  return path.join(tmp, "shallow");
})();

// --- stub API -------------------------------------------------------------
let respond = () => [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const page = Number(url.searchParams.get("page") || "1");
  const out = respond(page);
  if (typeof out === "number") { res.writeHead(out); return res.end("{}"); }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(out));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const API = `http://127.0.0.1:${server.address().port}/repos/x/y`;

const pr = (number, sha, opts = {}) => ({
  number, title: `pr ${number}`, merged: opts.merged !== false,
  merge_commit_sha: sha,
  merged_at: new Date(Date.now() - 3600_000).toISOString(),
  updated_at: new Date(Date.now() - 3600_000).toISOString(),
});

// --- harness --------------------------------------------------------------
let failures = 0;
// spawn, not execFileSync. The stub server runs in THIS process, so a
// synchronous child blocks the event loop that is meant to answer it and the
// whole thing deadlocks on the first request - which is exactly what the first
// version of this file did, passing two tests that never made one.
const check = async (name, { cwd = full, env = {}, args = [], wantExit, wantOut }) => {
  const { code, out } = await new Promise((resolve) => {
    const child = spawn(script, args, {
      cwd, env: { ...process.env, API, TOKEN: "t", ...env },
    });
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.stderr.on("data", (d) => (buf += d));
    child.on("close", (c) => resolve({ code: c ?? 1, out: buf }));
  });
  const okExit = code === wantExit;
  const okOut = !wantOut || wantOut.test(out);
  if (okExit && okOut) { console.log(`  ok    ${name}`); return; }
  failures++;
  console.log(`  FAIL  ${name}`);
  if (!okExit) console.log(`          exit ${code}, wanted ${wantExit}`);
  if (!okOut) console.log(`          output did not match ${wantOut}`);
  console.log(out.split("\n").map((l) => `          | ${l}`).join("\n"));
};

console.log("check-merged-prs.mjs");

// Refusals. Each of these must stay a refusal: answering anyway is the failure.
respond = () => [];
await check("no API set", { env: { API: "" }, wantExit: 2, wantOut: /API is not set/ });
await check("no TOKEN set", { env: { TOKEN: "" }, wantExit: 2, wantOut: /TOKEN is not set/ });

respond = () => 401;
await check("API rejects the token", { wantExit: 2, wantOut: /could not list pulls/ });

respond = () => [];
await check("shallow clone", { cwd: shallow, wantExit: 2, wantOut: /shallow clone/ });

// A remote-tracking ref whose remote cannot be reached must refuse, not answer
// from whatever the clone last fetched.
const broken = clone("broken");
run(broken, "remote", "set-url", "origin", path.join(tmp, "does-not-exist"));
await check("ref cannot be refreshed", { cwd: broken, wantExit: 2, wantOut: /may be stale/ });

// Always a full page of recent items, so the window boundary is never reached.
respond = (page) => Array.from({ length: 50 }, (_, i) => pr(page * 100 + i, onMain));
await check("paging never reaches the boundary", { wantExit: 2, wantOut: /without reaching/ });

fs.writeFileSync(path.join(full, "bad-ack.json"), "{not json");
respond = () => [];
await check("unreadable acknowledged file", {
  args: ["--acknowledged", "bad-ack.json"], wantExit: 2, wantOut: /not readable JSON/,
});

// Findings and passes.
respond = () => [pr(1, onMain)];
await check("all merges reachable", { wantExit: 0, wantOut: /all reachable/ });

respond = () => [pr(1, onMain), pr(2, notOnMain)];
await check("an unreachable merge is reported", { wantExit: 1, wantOut: /ORPHANED\s+#2/ });

respond = () => [pr(1, "0".repeat(40))];
await check("a merge sha the forge will not serve", { wantExit: 1, wantOut: /UNFETCHABLE/ });

respond = () => [pr(1, onMain), pr(2, notOnMain, { merged: false })];
await check("closed without merging is ignored", { wantExit: 0, wantOut: /all reachable/ });

// The path that turns a failure into a pass. It must acknowledge the listed sha
// and nothing else, or the watchdog is off.
fs.writeFileSync(path.join(full, "ack.json"), JSON.stringify({ [notOnMain]: "re-landed elsewhere" }));
respond = () => [pr(2, notOnMain)];
await check("acknowledged orphan passes and is still printed", {
  args: ["--acknowledged", "ack.json"], wantExit: 0, wantOut: /known\s+#2[\s\S]*re-landed elsewhere[\s\S]*nothing new/,
});

const other = path.join(tmp, "seed2");
fs.mkdirSync(other);
run(other, "init", "-q", "-b", "main");
run(other, "config", "user.email", "t@e.invalid");
run(other, "config", "user.name", "t");
fs.writeFileSync(path.join(other, "z"), "z\n");
run(other, "add", "z");
run(other, "commit", "-qm", "unrelated");
const unrelated = run(other, "rev-parse", "HEAD");
fs.writeFileSync(path.join(full, "ack2.json"), JSON.stringify({ [unrelated]: "different sha" }));
respond = () => [pr(2, notOnMain)];
await check("acknowledging one sha does not excuse another", {
  args: ["--acknowledged", "ack2.json"], wantExit: 1, wantOut: /ORPHANED\s+#2/,
});

// A local branch containing a slash must not be read as remote/branch.
run(full, "branch", "herd/topic", "main");
respond = () => [pr(1, onMain)];
await check("a local herd/ ref is read, not refused", {
  args: ["--ref", "herd/topic"], wantExit: 0, wantOut: /not a remote-tracking ref/,
});

server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : "\nall pinned behaviours hold");
process.exit(failures ? 1 : 0);
