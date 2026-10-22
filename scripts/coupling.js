#!/usr/bin/env node
// Maps cross-boundary imports in the monolith and ranks lines of business by how cleanly they can be extracted.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, buildImportGraph, couplingKind, domainOf } from './lib/graph.js';

const { imports } = buildImportGraph();
const edges = [];
for (const [from, targets] of imports) {
  for (const to of targets) {
    const kind = couplingKind(from, to);
    if (kind) edges.push({ from, to, kind });
  }
}

const lobs = [...new Set([...imports.keys()].map(domainOf).filter((d) => d.startsWith('lob:')))].map((d) => d.slice(4)).sort();
const ranking = lobs.map((lob) => {
  const domain = `lob:${lob}`;
  const inbound = edges.filter((e) => domainOf(e.to) === domain && e.kind !== 'lob-uses-platform');
  const outboundLob = edges.filter((e) => domainOf(e.from) === domain && e.kind === 'lob-depends-on-lob');
  const contracts = [...new Set(edges.filter((e) => domainOf(e.from) === domain && e.kind === 'lob-uses-platform').map((e) => e.to))];
  return { lob, blockers: inbound.length + outboundLob.length, inbound, outboundLob, contracts };
});
ranking.sort((a, b) => a.blockers - b.blockers || a.contracts.length - b.contracts.length);

const violations = edges.filter((e) => e.kind !== 'lob-uses-platform');
const lines = [];
lines.push('# Monolith coupling report', '');
lines.push('## Boundary violations', '');
if (!violations.length) lines.push('None.');
for (const v of violations) lines.push(`- \`${v.from}\` imports \`${v.to}\` (${v.kind})`);
lines.push('', '## Extraction candidates (cleanest first)', '');
lines.push('| Rank | Line of business | Blocking couplings | Platform contracts needed |');
lines.push('| --- | --- | --- | --- |');
ranking.forEach((r, i) => lines.push(`| ${i + 1} | ${r.lob} | ${r.blockers} | ${r.contracts.length} (${r.contracts.map((c) => c.replace('src/platform/', '')).join(', ')}) |`));
lines.push('', 'Blocking couplings are imports that cross a line-of-business boundary or make the shared platform depend on one line of business. Platform contracts are the shared modules an extracted service would call through an API instead of an import.', '');
mkdirSync(join(ROOT, 'out'), { recursive: true });
writeFileSync(join(ROOT, 'out/coupling-report.md'), `${lines.join('\n')}\n`);

console.log('\nMonolith coupling report\n');
console.log('Boundary violations:');
for (const v of violations) console.log(`  ! ${v.from}\n      imports ${v.to}  (${v.kind})`);
console.log('\nExtraction candidates (cleanest first):');
ranking.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.lob.padEnd(16)} blocking couplings: ${r.blockers}   platform contracts: ${r.contracts.length}`);
  for (const e of [...r.inbound, ...r.outboundLob]) console.log(`       - ${e.from} -> ${e.to}`);
});
console.log('\nWrote out/coupling-report.md\n');
