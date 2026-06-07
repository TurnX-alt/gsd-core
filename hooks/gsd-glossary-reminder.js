#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// SessionStart hook: inject glossary awareness into session context.
//
// Walks up from cwd to find the git root, then checks for
// docs/glossary/GLOSSARY.md. If found, injects a reminder with term count
// and last-modified date so the session knows a glossary exists.
//
// This is an opt-out hook — it always fires when GLOSSARY.md is present.
// The output is informational only; it does not block the session.

const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const cwd = process.cwd();
const repoRoot = findRepoRoot(cwd);

if (!repoRoot) process.exit(0);

const glossaryPath = path.join(repoRoot, 'docs', 'glossary', 'GLOSSARY.md');

if (!fs.existsSync(glossaryPath)) process.exit(0);

let termCount = 0;
let lastModified = '';
try {
  const content = fs.readFileSync(glossaryPath, 'utf8');
  const termMatches = content.match(/^\*\*[^*]+\*\*:$/gm);
  termCount = termMatches ? termMatches.length : 0;
  const stat = fs.statSync(glossaryPath);
  lastModified = stat.mtime.toISOString().split('T')[0];
} catch (_) {
  process.exit(0);
}

const adrDir = path.join(repoRoot, 'docs', 'glossary', 'adr');
let adrCount = 0;
try {
  if (fs.existsSync(adrDir)) {
    adrCount = fs.readdirSync(adrDir).filter(f => /^\d{4}-.+\.md$/.test(f)).length;
  }
} catch (_) {}

const lines = [
  '## Glossary Reminder',
  '',
  'GLOSSARY.md found at `docs/glossary/GLOSSARY.md` (' + termCount + ' terms, last updated ' + lastModified + ').',
];
if (adrCount > 0) {
  lines.push(adrCount + ' ADRs in `docs/glossary/adr/`.');
}
lines.push('');
lines.push('If starting a new phase, run the **grill-with-docs** skill before `/gsd-discuss-phase`');
lines.push('to resolve terminology against the existing glossary.');

const output = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: lines.join('\n'),
    glossary_present: true,
    glossary_path: 'docs/glossary/GLOSSARY.md',
    term_count: termCount,
    adr_count: adrCount,
    last_modified: lastModified,
  },
});
process.stdout.write(output);
process.exit(0);
