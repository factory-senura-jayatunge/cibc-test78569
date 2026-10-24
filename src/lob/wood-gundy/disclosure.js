// @ts-check
// Renders Wood Gundy advisory fee disclosure letters (WG-977) from catalogued templates
// or from a caller-supplied draft. Rendering goes through lodash `_.template`; a draft may
// name the data-object `variable`, but only from an allowlist, so request input never
// reaches `_.template` settings unvalidated (SEC-CVE-2021-23337). Audit output masks the
// account number and never carries the client name.

import lodash from 'lodash';
import { record } from '../../platform/audit.js';
import { maskAccountIds } from '../../observability/logger.js';
import { getLetterTemplate } from './letter-templates.js';

/**
 * The figures a letter can interpolate.
 * @typedef {object} LetterData
 * @property {string} holder
 * @property {string} accountId
 * @property {string} advisor
 * @property {number} householdAssets
 * @property {number} annualFee
 */

/**
 * @typedef {object} DraftLetter
 * @property {string} [title]
 * @property {string} source
 * @property {string} [variable] data-object identifier; only allowlisted values are accepted (SEC-CVE-2021-23337)
 */

/**
 * @typedef {object} DisclosureRequest
 * @property {string} [templateId]
 * @property {DraftLetter} [draft]
 */

/**
 * @typedef {object} RenderedLetter
 * @property {string} title
 * @property {string} body
 */

/**
 * Data-object identifiers a draft may name for `_.template`. The catalogued templates use
 * `letter`, so that is the one identifier a request may select (SEC-CVE-2021-23337).
 * @type {ReadonlyArray<string>}
 */
const ALLOWED_DRAFT_VARIABLES = ['letter'];

/**
 * Settings for a draft body: `variable` is honored only when it names an allowlisted
 * identifier, so a request cannot smuggle `_.template` settings into the compile
 * (SEC-CVE-2021-23337).
 * @param {DraftLetter} draft
 * @returns {{ variable?: string }}
 */
function draftSettings(draft) {
  if (draft.variable === undefined) return {};
  if (typeof draft.variable !== 'string' || !ALLOWED_DRAFT_VARIABLES.includes(draft.variable)) {
    throw new RangeError(`draft.variable must be one of: ${ALLOWED_DRAFT_VARIABLES.join(', ')}`);
  }
  return { variable: draft.variable };
}

/**
 * Compiles a template body with lodash and renders it against the letter data.
 * @param {string} source
 * @param {{ variable?: string }} settings lodash template settings; `variable` names the data object
 * @param {LetterData} letterData
 * @returns {string}
 */
function renderLetter(source, settings, letterData) {
  const compiled = lodash.template(source, settings);
  return compiled(letterData);
}

/**
 * Renders a disclosure letter and records the render in the audit log with the account
 * number masked.
 * @param {string} accountId raw account number; masked before it reaches the audit log
 * @param {DisclosureRequest} request
 * @param {LetterData} letterData
 * @returns {RenderedLetter}
 */
export function renderDisclosureLetter(accountId, request, letterData) {
  let title;
  let source;
  let settings;
  let origin;
  if (request.draft) {
    if (typeof request.draft.source !== 'string' || !request.draft.source) {
      throw new RangeError('draft.source must be a non-empty string');
    }
    title = request.draft.title ?? 'Draft advisory fee disclosure';
    source = request.draft.source;
    settings = draftSettings(request.draft);
    origin = 'draft';
  } else {
    const template = getLetterTemplate(request.templateId ?? '');
    title = template.title;
    source = template.source;
    settings = template.settings;
    origin = template.id;
  }
  const body = renderLetter(source, settings, letterData);
  record('advisory.fee-disclosure.rendered', maskAccountIds(accountId), { template: origin });
  return { title, body };
}
