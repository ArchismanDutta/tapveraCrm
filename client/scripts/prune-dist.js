#!/usr/bin/env node
// client/scripts/prune-dist.js
//
// Delete build assets that nothing references any more.
//
//     node scripts/prune-dist.js --dry-run     # always do this first
//     node scripts/prune-dist.js
//     node scripts/prune-dist.js --days 3
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
// vite.config.js sets `emptyOutDir: false` so a deploy no longer deletes the
// previous build's chunks out from under browsers that already have the app
// open — see the long note there. The cost of that is dist/ grows on every
// deploy, so something has to clear out the genuinely dead files. This is it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IT WILL AND WON'T DELETE
// ─────────────────────────────────────────────────────────────────────────────
// Reachability is computed properly rather than guessed from filenames:
// starting at index.html, follow every `assets/<name>` reference, then follow
// the references inside those files, and so on. Lazy-loaded chunks are named
// only from inside other JS — never from index.html — so a naive scan of
// index.html alone would delete exactly the chunks this whole exercise is
// about.
//
// A file is deleted only if BOTH are true:
//   1. nothing reachable from index.html references it, and
//   2. it has not been modified in the last `--days` days (default 2).
//
// The second condition is the safety net for the deploy window: a build that
// is mid-upload, or a tab loaded from the build before last, still has its
// chunks on disk. Two days is far longer than any tab realistically survives,
// and disk is cheaper than a broken session.
// ESM, because client/package.json sets "type": "module".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const DIST = path.resolve(here, '..', 'dist');
const ASSETS = path.join(DIST, 'assets');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const daysArg = argv.indexOf('--days');
const GRACE_DAYS = daysArg !== -1 ? Number(argv[daysArg + 1]) || 2 : 2;
const GRACE_MS = GRACE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Which of `candidates` does this file mention?
 *
 * ─── WHY THIS SEARCHES FOR BASENAMES, NOT AN `assets/` PREFIX ───
 * index.html links its entry chunks as `assets/index-<hash>.js`, so an
 * `/assets\/(...)/ ` regex finds those. But Vite emits a LAZY import from
 * inside a chunk as a path relative to that chunk — `import("./AttendancePage
 * -<hash>.js")` — with no `assets/` anywhere. Matching on the prefix therefore
 * found the entry points and nothing they load on demand, marking every
 * lazily-loaded page unreachable: precisely the chunks this whole exercise
 * exists to preserve. Deleting them would have caused the exact bug it is
 * meant to prevent, on the next deploy.
 *
 * Searching for the known filenames themselves is prefix-agnostic and cannot
 * miss a reference however the bundler chose to write the path.
 */
function referencesIn(filePath, candidates) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    // A binary asset (font, image). It cannot name other assets, so it
    // contributes nothing to reachability.
    return [];
  }
  return candidates.filter((name) => text.includes(name));
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`No dist/ at ${DIST} — nothing to prune.`);
    process.exit(1);
  }
  const indexHtml = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.error('dist/index.html is missing. Refusing to prune — without an');
    console.error('entry point every asset looks unreachable and this would');
    console.error('delete the entire build.');
    process.exit(1);
  }
  if (!fs.existsSync(ASSETS)) {
    console.log('No dist/assets/ — nothing to prune.');
    return;
  }

  const all = fs.readdirSync(ASSETS).filter((f) => {
    try {
      return fs.statSync(path.join(ASSETS, f)).isFile();
    } catch {
      return false;
    }
  });

  // ── Transitive reachability from index.html ──
  const reachable = new Set();
  const queue = referencesIn(indexHtml, all);

  while (queue.length) {
    const name = queue.pop();
    if (reachable.has(name)) continue;
    const full = path.join(ASSETS, name);
    if (!fs.existsSync(full)) continue; // referenced but already gone
    reachable.add(name);
    for (const next of referencesIn(full, all)) {
      if (!reachable.has(next)) queue.push(next);
    }
  }

  const now = Date.now();
  const keptReachable = [];
  const keptYoung = [];
  const doomed = [];
  let freed = 0;

  for (const name of all) {
    const full = path.join(ASSETS, name);
    const stat = fs.statSync(full);

    if (reachable.has(name)) {
      keptReachable.push(name);
      continue;
    }
    if (now - stat.mtimeMs < GRACE_MS) {
      keptYoung.push(name);
      continue;
    }
    doomed.push({ name, bytes: stat.size });
    freed += stat.size;
  }

  const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB';

  console.log(`dist/assets: ${all.length} file(s)`);
  console.log(`  reachable from index.html        ${keptReachable.length}  (never deleted)`);
  console.log(`  unreachable but < ${GRACE_DAYS}d old        ${keptYoung.length}  (grace period)`);
  console.log(`  unreachable and older            ${doomed.length}  (${mb(freed)})`);

  if (doomed.length === 0) {
    console.log('\nNothing to remove.');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — would remove:');
    doomed.slice(0, 40).forEach((d) => console.log(`  ${d.name}`));
    if (doomed.length > 40) console.log(`  … and ${doomed.length - 40} more`);
    return;
  }

  let removed = 0;
  for (const d of doomed) {
    try {
      fs.unlinkSync(path.join(ASSETS, d.name));
      removed += 1;
    } catch (err) {
      console.error(`  could not remove ${d.name}: ${err.message}`);
    }
  }
  console.log(`\nRemoved ${removed} file(s), freed ${mb(freed)}.`);
}

main();
