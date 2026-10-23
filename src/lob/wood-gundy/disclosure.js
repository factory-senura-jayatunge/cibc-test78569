// @ts-check
// Renders Wood Gundy advisory fee disclosure letters (WG-977) from catalogued templates
// or from a caller-supplied draft. Rendering goes through lodash `_.template`, and a draft
// may name its own `variable` setting for the data object. Audit output masks the account
// number and never carries the client name.

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
 * @property {string} [variable]
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
    settings = request.draft.variable ? { variable: request.draft.variable } : {};
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
