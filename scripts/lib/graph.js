import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g;

export function listFiles(dir, predicate = () => true) {
  const out = [];
  const walk = (current) => {
    let names;
    try {
      names = readdirSync(current);
    } catch {
      return;
    }
    for (const name of names) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (predicate(full)) out.push(relative(ROOT, full).split('\\').join('/'));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex');
}

export function domainOf(file) {
  const lob = file.match(/^src\/lob\/([^/]+)\//);
  if (lob) return `lob:${lob[1]}`;
  if (file.startsWith('src/platform/')) return 'platform';
  if (file.startsWith('src/')) return 'entry';
  if (file.startsWith('tests/')) return 'test';
  return 'other';
}

export function buildImportGraph() {
  const files = listFiles('src', (file) => file.endsWith('.js'));
  const imports = new Map(files.map((file) => [file, new Set()]));
  const dependents = new Map(files.map((file) => [file, new Set()]));
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const target = posix.normalize(posix.join(posix.dirname(file), match[1]));
      if (!imports.has(target)) continue;
      imports.get(file).add(target);
      dependents.get(target).add(file);
    }
  }
  return { files, imports, dependents };
}

export function couplingKind(fromFile, toFile) {
  const from = domainOf(fromFile);
  const to = domainOf(toFile);
  if (from === to || !['platform'].includes(from) && !from.startsWith('lob:')) return null;
  if (from === 'platform' && to.startsWith('lob:')) return 'platform-depends-on-lob';
  if (from.startsWith('lob:') && to.startsWith('lob:')) return 'lob-depends-on-lob';
  return 'lob-uses-platform';
}

export function readJson(file) {
  return JSON.parse(readFileSync(join(ROOT, file), 'utf8'));
}

export { dirname };
