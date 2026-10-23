#!/usr/bin/env node
// @ts-check
// Converts `npm audit --json` (auditReportVersion 2) to SARIF 2.1.0 so dependency
// advisories can be uploaded to GitHub code scanning (READINESS-2).
// Usage: node scripts/audit-to-sarif.js <audit.json> <out.sarif> [--now <iso-timestamp>]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { flagValue } from './lib/cli.js';

/**
 * @typedef {object} AuditAdvisory
 * @property {number} [source]
 * @property {string} [title]
 * @property {string} [url]
 * @property {string} [severity]
 * @property {string} [range]
 * @property {{ score?: number }} [cvss]
 */
/**
 * @typedef {object} AuditVulnerability
 * @property {string} name
 * @property {string} severity
 * @property {(string | AuditAdvisory)[]} [via]
 * @property {string} [range]
 * @property {boolean | { name?: string, version?: string }} [fixAvailable]
 */
/** @typedef {{ auditReportVersion?: number, vulnerabilities?: Record<string, AuditVulnerability> }} AuditReport */
/**
 * @typedef {object} SarifResult
 * @property {string} ruleId
 * @property {string} level
 * @property {{ text: string }} message
 * @property {{ physicalLocation: { artifactLocation: { uri: string }, region: { startLine: number } } }[]} locations
 * @property {Record<string, string>} partialFingerprints
 */
/**
 * @typedef {object} SarifRule
 * @property {string} id
 * @property {string} name
 * @property {{ text: string }} shortDescription
 * @property {{ text: string }} fullDescription
 * @property {string | undefined} helpUri
 * @property {Record<string, unknown>} properties
 */
/**
 * @typedef {object} SarifReport
 * @property {string} $schema
 * @property {string} version
 * @property {{ tool: { driver: { name: string, version: string, informationUri: string, rules: SarifRule[] } }, results: SarifResult[], invocations: { executionSuccessful: boolean, startTimeUtc: string, endTimeUtc: string }[] }[]} runs
 */

/** @type {Record<string, string>} */
const SARIF_LEVELS = { critical: 'error', high: 'error', moderate: 'warning', low: 'note', info: 'note' };

/**
 * The GitHub advisory id (GHSA-...) identifies a rule; fall back to the audit source id.
 * @param {AuditAdvisory} advisory
 */
function advisoryId(advisory) {
  return advisory.url?.split('/').pop() ?? String(advisory.source ?? 'unknown');
}

/**
 * @param {AuditVulnerability} vulnerability
 * @param {AuditAdvisory} advisory
 */
function resultMessage(vulnerability, advisory) {
  const fix = vulnerability.fixAvailable;
  const fixText =
    fix === true ? 'A fix is available.' : fix && typeof fix === 'object' ? `Fixed by ${fix.name}@${fix.version}.` : 'No fix is available yet.';
  return `${vulnerability.name} ${advisory.range ?? vulnerability.range ?? ''}: ${advisory.title} (${advisory.severity}). ${fixText}`;
}

/**
 * Registers one SARIF rule per advisory, on first sight.
 * @param {Map<string, SarifRule>} rules
 * @param {AuditVulnerability} vulnerability
 * @param {AuditAdvisory} advisory
 */
function addRule(rules, vulnerability, advisory) {
  const id = advisoryId(advisory);
  if (rules.has(id)) return;
  rules.set(id, {
    id,
    name: id,
    shortDescription: { text: advisory.title ?? id },
    fullDescription: { text: `${advisory.title ?? id} in ${vulnerability.name} (${advisory.range ?? vulnerability.range ?? 'unknown range'})` },
    helpUri: advisory.url,
    properties: { 'security-severity': String(advisory.cvss?.score ?? ''), severity: advisory.severity },
  });
}

/**
 * @param {AuditVulnerability} vulnerability
 * @param {AuditAdvisory} advisory
 * @returns {SarifResult}
 */
function toResult(vulnerability, advisory) {
  const id = advisoryId(advisory);
  return {
    ruleId: id,
    level: SARIF_LEVELS[advisory.severity ?? ''] ?? 'warning',
    message: { text: resultMessage(vulnerability, advisory) },
    locations: [{ physicalLocation: { artifactLocation: { uri: 'package-lock.json' }, region: { startLine: 1 } } }],
    partialFingerprints: { 'npm-audit/package-advisory': `${vulnerability.name}/${id}` },
  };
}

/**
 * @param {AuditReport} report
 * @param {string} [now] timestamp for the SARIF invocation (defaults to the current time)
 * @returns {SarifReport}
 */
export function toSarif(report, now = new Date().toISOString()) {
  /** @type {Map<string, SarifRule>} */
  const rules = new Map();
  /** @type {SarifResult[]} */
  const results = [];
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via === 'string') continue; // transitive hop marker, not an advisory
      addRule(rules, vulnerability, via);
      results.push(toResult(vulnerability, via));
    }
  }
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'npm audit',
            version: String(report.auditReportVersion ?? 2),
            informationUri: 'https://docs.npmjs.com/cli/commands/npm-audit',
            rules: [...rules.values()],
          },
        },
        results,
        invocations: [{ executionSuccessful: true, startTimeUtc: now, endTimeUtc: now }],
      },
    ],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const positional = process.argv.slice(2).filter((arg, index, args) => !arg.startsWith('--') && args[index - 1] !== '--now');
  const [input, output] = positional;
  if (!input || !output) {
    console.error('Usage: node scripts/audit-to-sarif.js <audit.json> <out.sarif> [--now <iso-timestamp>]');
    process.exit(2);
  }
  const report = /** @type {AuditReport} */ (JSON.parse(readFileSync(input, 'utf8')));
  const sarif = toSarif(report, flagValue('--now'));
  writeFileSync(output, `${JSON.stringify(sarif, null, 2)}\n`);
  console.log(`Wrote ${sarif.runs[0].results.length} results (${sarif.runs[0].tool.driver.rules.length} rules) to ${output}`);
}
