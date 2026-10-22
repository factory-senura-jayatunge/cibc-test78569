#!/usr/bin/env node
// @ts-check
// Builds a self-contained release-readiness page from the evidence the pipeline already wrote to out/.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './lib/graph.js';

/** @typedef {import('./lib/graph.js').ImpactResult} ImpactResult */
/** @typedef {import('./lib/graph.js').RegressionResult} RegressionResult */
/** @typedef {import('./lib/graph.js').Catalog} Catalog */
/** @typedef {{ id: string, lineOfBusiness?: string, acceptance?: string, review?: string, decision?: string }} CheckedChange */

/** @param {string} file */
const outPath = (file) => join(ROOT, 'out', file);
/**
 * @template T
 * @param {string} file
 * @returns {T | null}
 */
const load = (file) => (existsSync(outPath(file)) ? JSON.parse(readFileSync(outPath(file), 'utf8')) : null);

const impact = /** @type {ImpactResult | null} */ (load('impact.json'));
if (!impact) {
  console.error('No out/impact.json. Run `npm run impact` first.');
  process.exit(2);
}
const regression = /** @type {RegressionResult | null} */ (load('regression.json'));
const checks = /** @type {{ changes?: CheckedChange[] } | null} */ (load('checks.json'));
const approval = /** @type {{ decision?: string } | null} */ (load('approval.json'));
const catalog = /** @type {Catalog} */ (readJson('regression/catalog.json'));
const notes = readdirSync(join(ROOT, 'out'))
  .filter((file) => /^release-note-.+\.md$/.test(file))
  .sort();

/** @type {Record<string, string>} */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** @param {unknown} value */
const esc = (value) => String(value).replace(/[&<>"]/g, (c) => HTML_ESCAPES[c] ?? c);
/** @param {unknown} value */
const inline = (value) =>
  esc(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
/** @param {string} line */
const isBlock = (line) => /^(#{1,6} |\||\s*[-*] |\d+\. |```)/.test(line);

/** @param {string} text */
function markdown(text) {
  const lines = text.split('\n');
  /** @type {string[]} */
  const html = [];
  let i = 0;
  /** @param {(line: string) => boolean} test */
  const take = (test) => {
    /** @type {string[]} */
    const block = [];
    while (i < lines.length && test(lines[i])) block.push(lines[i++]);
    return block;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
    } else if (/^#{1,6} /.test(line)) {
      const level = Math.min((line.match(/^#+/)?.[0].length ?? 1) + 2, 6);
      html.push(`<h${level}>${inline(line.replace(/^#+ /, ''))}</h${level}>`);
      i += 1;
    } else if (line.startsWith('```')) {
      i += 1;
      const block = take((l) => !l.startsWith('```'));
      i += 1;
      html.push(`<pre>${esc(block.join('\n'))}</pre>`);
    } else if (line.startsWith('|')) {
      const rows = take((l) => l.startsWith('|'));
      /** @param {string} row */
      const cells = (row) =>
        row
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim());
      const [head, , ...body] = rows;
      html.push(
        `<table><thead><tr>${cells(head ?? '')
          .map((c) => `<th>${inline(c)}</th>`)
          .join('')}</tr></thead><tbody>${body
          .map(
            (row) =>
              `<tr>${cells(row)
                .map((c) => `<td>${inline(c)}</td>`)
                .join('')}</tr>`,
          )
          .join('')}</tbody></table>`,
      );
    } else if (/^\s*[-*] /.test(line)) {
      const items = take((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, ''));
      html.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    } else if (/^\d+\. /.test(line)) {
      const items = take((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ''));
      html.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</ol>`);
    } else {
      const para = [line];
      i += 1;
      while (i < lines.length && lines[i].trim() && !isBlock(lines[i])) para.push(lines[i++]);
      html.push(`<p>${inline(para.join(' '))}</p>`);
    }
  }
  return html.join('\n');
}

/** @type {Record<string, string>} */
const LOB_NAMES = {
  'investors-edge': "Investor's Edge",
  'wood-gundy': 'Wood Gundy',
  pic: 'PIC',
  'private-banking': 'Private Banking',
  platform: 'Platform',
};
/** @param {string | undefined} value */
const lobName = (value) => LOB_NAMES[String(value ?? '').toLowerCase()] ?? value ?? '';
/** @param {number} minutes */
const hours = (minutes) => (minutes / 60).toFixed(1);
const results = regression?.results ?? [];
const passed = results.filter((r) => r.passed).length;
const allPassed = results.length > 0 && passed === results.length;
const scopedPct = impact.fullMinutes ? (impact.scopedMinutes / impact.fullMinutes) * 100 : 0;
const changeCount = checks?.changes?.length ?? notes.length;
const status =
  approval?.decision === 'approved'
    ? { label: 'Approved by a person · ready to merge', cls: 'ok' }
    : { label: 'Awaiting human approval', cls: 'wait' };

const kpis = [
  ['Change requests', changeCount],
  ['Lines of business', impact.impactedLinesOfBusiness.length],
  ['Suites run', `${impact.selected.length} / ${catalog.suites.length}`],
  ['Regression', `${hours(impact.scopedMinutes)} h`],
  ['Less than full', `${impact.percentSaved}%`],
  ['Suites passing', results.length ? `${passed} / ${results.length}` : 'not run'],
];

const checksTable = checks?.changes?.length
  ? `<section><h2>Changes and independent checks</h2><table><thead><tr><th>Change</th><th>Line of business</th><th>Acceptance</th><th>Review</th><th>Agent decision</th></tr></thead><tbody>${checks.changes
      .map(
        (c) =>
          `<tr><td><code>${esc(c.id)}</code></td><td>${esc(lobName(c.lineOfBusiness))}</td><td>${esc(c.acceptance ?? '')}</td><td>${esc(c.review ?? '')}</td><td>${esc(c.decision ?? '')}</td></tr>`,
      )
      .join('')}</tbody></table></section>`
  : '';

const suites = impact.selected
  .map((s) => {
    const r = results.find((x) => x.id === s.id);
    const verdict = r ? (r.flaky ? 'FLAKY' : r.passed ? 'PASS' : 'FAIL') : '–';
    return `<tr><td><code>${esc(s.id)}</code></td><td>${esc(lobName(s.owner))}</td><td>${s.productionMinutes} min</td><td class="${verdict === 'FAIL' ? 'bad' : ''}">${verdict}</td><td>${inline(s.reason.replaceAll(' -> ', ' → '))}</td></tr>`;
  })
  .join('');

const couplings = impact.couplings.length
  ? `<p class="warn">Coupling that widened scope: ${impact.couplings.map((c) => `<code>${esc(c.from)}</code> imports <code>${esc(c.to)}</code>`).join('; ')}</p>`
  : '';

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Release readiness</title>
<link rel="stylesheet" href="../pov/brand-fonts.css">
<style>
:root{--bg:#000;--surface:#151311;--border:#38322F;--text:#FFF;--muted:#998F89;--accent:#FF5A00;--ok:#4F8F41;--bad:#D72D17}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"Geist",system-ui,sans-serif;letter-spacing:-.01em;line-height:1.5}
main{max-width:1200px;margin:0 auto;padding:40px 48px 80px}
.label{font-family:"Geist Mono",monospace;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
h1{font-weight:400;font-size:44px;line-height:1.1;margin:8px 0 12px}
h2{font-weight:500;font-size:20px;line-height:1.3;margin:0 0 14px}
h3,h4,h5,h6{font-weight:500;line-height:1.3;margin:18px 0 8px}
.status{display:inline-block;font-family:"Geist Mono",monospace;font-size:13px;padding:6px 10px;border:1px solid var(--accent);color:var(--accent);border-radius:2px}
.status.ok{border-color:var(--ok);color:var(--ok)}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:28px 0}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:16px}
.kpi b{display:block;font-weight:400;font-size:30px;line-height:1.2}
.kpi span{font-family:"Geist Mono",monospace;font-size:12px;color:var(--muted)}
section{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:24px;margin:16px 0}
.bars{display:grid;gap:10px}.bar{display:grid;grid-template-columns:160px 1fr 80px;align-items:center;gap:12px;font-size:14px}
.track{height:14px;background:#000;border:1px solid var(--border);border-radius:2px}.fill{height:100%;background:var(--text)}.fill.scoped{background:var(--accent)}
table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--border)}
th{font-family:"Geist Mono",monospace;font-weight:500;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
code{font-family:"Geist Mono",monospace;font-size:12.5px}td:first-child code{white-space:nowrap}pre{background:#000;border:1px solid var(--border);padding:12px;overflow-x:auto;font-size:12.5px}
.muted,p.skipped{color:var(--muted);font-size:14px}.warn{color:var(--muted);font-size:14px}.bad{color:var(--bad)}
details{border-top:1px solid var(--border);padding:12px 0}summary{cursor:pointer;font-weight:500}
.note{color:#E8E3E0;font-size:15px}.note p,.note li{color:#E8E3E0}
footer{font-family:"Geist Mono",monospace;font-size:12px;color:var(--muted);margin-top:24px}
@media(max-width:1000px){.kpis{grid-template-columns:repeat(3,1fr)}}
</style></head><body><main>
<div class="label">Release train · synthetic OBR model</div>
<h1>Release readiness</h1>
<span class="status ${status.cls}">${status.label}</span>
<div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>
<section><h2>Regression, production-equivalent hours</h2><div class="bars">
<div class="bar"><span>Full regression</span><div class="track"><div class="fill" style="width:100%"></div></div><span>${hours(impact.fullMinutes)} h</span></div>
<div class="bar"><span>This release</span><div class="track"><div class="fill scoped" style="width:${scopedPct.toFixed(1)}%"></div></div><span>${hours(impact.scopedMinutes)} h</span></div>
</div><p class="muted">Hours are illustrative, sized so the full catalogue equals an 18-hour regression. Full regression is still recommended before the release cut.${allPassed ? ' Every selected suite passed.' : ''}</p></section>
${checksTable}
<section><h2>Suites selected and why</h2><table><thead><tr><th>Suite</th><th>Owner</th><th>Est. time</th><th>Result</th><th>Why it runs</th></tr></thead><tbody>${suites}</tbody></table>
<p class="skipped">Skipped: ${impact.skipped.map((s) => `<code>${esc(s.id)}</code>`).join(', ') || 'none'}</p>${couplings}</section>
<section><h2>Changed files</h2><ul>${impact.changed.map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul></section>
${notes.length ? `<section><h2>Release notes</h2>${notes.map((file, index) => `<details${index === 0 ? ' open' : ''}><summary>${esc(file)}</summary><div class="note">${markdown(readFileSync(outPath(file), 'utf8'))}</div></details>`).join('')}</section>` : ''}
<footer>Generated ${new Date().toISOString()} from out/impact.json, out/regression.json${checks ? ', out/checks.json' : ''}${approval ? ', out/approval.json' : ''}. Nothing here is merged or deployed by an agent.</footer>
</main></body></html>
`;
writeFileSync(outPath('release-pack.html'), html);
console.log('Wrote out/release-pack.html');
