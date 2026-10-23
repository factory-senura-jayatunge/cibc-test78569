// @ts-check
// Catalogued bodies and lodash template settings for Wood Gundy advisory fee disclosure
// letters (WG-977). Each body references the letter data through the template's `variable`
// setting, which lodash substitutes for the default `with (obj)` scope.

/** @typedef {{ variable?: string }} TemplateSettings */

/**
 * @typedef {object} LetterTemplate
 * @property {string} id
 * @property {string} title
 * @property {string} source
 * @property {TemplateSettings} settings
 */

/** @type {Readonly<Record<string, LetterTemplate>>} */
export const LETTER_TEMPLATES = {
  'annual-fee-disclosure': {
    id: 'annual-fee-disclosure',
    title: 'Annual advisory fee disclosure',
    settings: { variable: 'letter' },
    source: [
      'Dear <%- letter.holder %>,',
      '',
      'This letter discloses the advisory fees for account <%- letter.accountId %>, advised by <%- letter.advisor %>.',
      'Household assets: <%- letter.householdAssets %> CAD.',
      'Projected annual advisory fee: <%- letter.annualFee %> CAD.',
      '',
      'Wood Gundy Client Reporting',
    ].join('\n'),
  },
  'fee-change-notice': {
    id: 'fee-change-notice',
    title: 'Advisory fee schedule change notice',
    settings: { variable: 'letter' },
    source: [
      'Dear <%- letter.holder %>,',
      '',
      'The advisory fee schedule for account <%- letter.accountId %> changes next quarter.',
      'At your current household assets of <%- letter.householdAssets %> CAD, the projected annual fee is <%- letter.annualFee %> CAD.',
      'Your advisor <%- letter.advisor %> can walk you through the new schedule.',
      '',
      'Wood Gundy Client Reporting',
    ].join('\n'),
  },
};

/**
 * @param {string} id
 * @returns {LetterTemplate}
 */
export function getLetterTemplate(id) {
  const template = LETTER_TEMPLATES[id];
  if (!template) {
    const error = /** @type {Error & { code: string }} */ (new Error(`Unknown letter template ${id}`));
    error.code = 'NOT_FOUND';
    throw error;
  }
  return template;
}
