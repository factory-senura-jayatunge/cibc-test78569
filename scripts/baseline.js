#!/usr/bin/env node
// @ts-check
// Records the current tree as the "last release" so impact analysis and demo resets work without git history.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, listFiles, sha256 } from './lib/graph.js';

const DIRS = ['src', 'tests', 'public', 'regression'];
const files = Object.fromEntries(DIRS.flatMap((dir) => listFiles(dir)).map((file) => [file, sha256(file)]));
const baselineDir = join(ROOT, '.baseline');
rmSync(baselineDir, { recursive: true, force: true });
mkdirSync(join(baselineDir, 'snapshot'), { recursive: true });
for (const dir of DIRS) cpSync(join(ROOT, dir), join(baselineDir, 'snapshot', dir), { recursive: true });
writeFileSync(join(baselineDir, 'manifest.json'), `${JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2)}\n`);
console.log(`Release baseline recorded: ${Object.keys(files).length} files.`);
