// scripts/migrateUploadsToStorageRoot.js
//
// Move existing uploads out of the deploy directory and into UPLOAD_ROOT.
//
//     node scripts/migrateUploadsToStorageRoot.js --dry-run     # look first
//     node scripts/migrateUploadsToStorageRoot.js
//     node scripts/migrateUploadsToStorageRoot.js --copy        # keep originals
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES, AND WHAT IT DELIBERATELY DOESN'T
// ─────────────────────────────────────────────────────────────────────────────
// Files currently live at <repo>/server/uploads — inside the directory a deploy
// replaces. This copies the tree to UPLOAD_ROOT, preserving relative paths
// exactly.
//
// Preserving paths is the point. Every stored URL in Mongo ends in
// "/uploads/<relative path>", and fileRoutes resolves that same relative path
// against UPLOAD_ROOT — so moving the tree without renaming anything means
// every existing record keeps working, with no database migration and no
// rewrite of URLs that may also be embedded in message bodies or emails.
//
// It does NOT rename legacy files to the new random scheme. Doing so would
// require rewriting every URL in every collection in lockstep, and a partial
// failure would orphan real attachments. Legacy names stay; they're now behind
// signed URLs, so a guessable name no longer grants access.
'use strict';

const fs = require('fs');
const path = require('path');
const { UPLOAD_ROOT } = require('../config/storage');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const COPY = args.includes('--copy');

const LEGACY_ROOT = path.join(__dirname, '..', 'uploads');

let moved = 0;
let skipped = 0;
let bytes = 0;
const errors = [];

function walk(dir, relative = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    errors.push(`${dir}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const from = path.join(dir, entry.name);
    const rel = relative ? path.join(relative, entry.name) : entry.name;

    if (entry.isDirectory()) {
      walk(from, rel);
      continue;
    }
    if (!entry.isFile()) continue;

    const to = path.join(UPLOAD_ROOT, rel);

    // Never overwrite. A file already at the destination means this has been
    // run before (or the roots overlap) — re-copying risks replacing a good
    // file with a stale one.
    if (fs.existsSync(to)) {
      skipped += 1;
      continue;
    }

    const size = entry.isFile() ? fs.statSync(from).size : 0;

    if (DRY_RUN) {
      console.log(`  would ${COPY ? 'copy' : 'move'}  ${rel}  (${(size / 1024).toFixed(1)} KB)`);
      moved += 1;
      bytes += size;
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (COPY) {
        fs.copyFileSync(from, to);
      } else {
        // rename() fails across filesystems (EXDEV) — likely here, since the
        // whole point is putting uploads on a different mount. Fall back to
        // copy-then-unlink, and only unlink after the copy has succeeded so a
        // failure can never lose the file.
        try {
          fs.renameSync(from, to);
        } catch (err) {
          if (err.code !== 'EXDEV') throw err;
          fs.copyFileSync(from, to);
          fs.unlinkSync(from);
        }
      }
      moved += 1;
      bytes += size;
    } catch (err) {
      errors.push(`${rel}: ${err.message}`);
    }
  }
}

console.log(`Upload migration${DRY_RUN ? ' (dry run)' : ''}`);
console.log(`  from : ${LEGACY_ROOT}`);
console.log(`  to   : ${UPLOAD_ROOT}\n`);

if (path.resolve(LEGACY_ROOT) === path.resolve(UPLOAD_ROOT)) {
  console.log('UPLOAD_ROOT is still the in-repo directory — set it to a durable');
  console.log('path (e.g. /var/lib/tapvera/uploads) before running this.');
  process.exit(1);
}

if (!fs.existsSync(LEGACY_ROOT)) {
  console.log('Nothing to migrate — legacy uploads directory does not exist.');
  process.exit(0);
}

if (!DRY_RUN) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

walk(LEGACY_ROOT);

console.log(`\n  ${DRY_RUN ? 'would move' : 'moved'} : ${moved} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  skipped   : ${skipped} (already at destination)`);
if (errors.length) {
  console.log(`  errors    : ${errors.length}`);
  errors.slice(0, 20).forEach((e) => console.log(`    ${e}`));
}

if (!DRY_RUN && moved > 0) {
  console.log('\nRelative paths were preserved, so existing URLs in the database');
  console.log('resolve unchanged. Verify a few attachments load before deleting');
  console.log(`the old tree at ${LEGACY_ROOT}.`);
}
