const LOBS = [
  { id: 'investors-edge', label: "Investor's Edge" },
  { id: 'wood-gundy', label: 'Wood Gundy' },
  { id: 'pic', label: 'Private Investment Council' },
  { id: 'private-banking', label: 'Private Banking' },
];

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const NOT_MONEY = /trades|bps|target|loan-to-value/i;
const format = (value, label = '') =>
  typeof value === 'number' && Math.abs(value) >= 1 && !NOT_MONEY.test(label) ? money.format(value) : String(value);

const nav = document.querySelector('#lobs');
const accountsPanel = document.querySelector('#accounts');
const statementPanel = document.querySelector('#statement');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, attrs);
  node.append(...children);
  return node;
}

async function showLob(lob) {
  for (const button of nav.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.lob === lob));
  const { accounts } = await (await fetch(`/api/accounts?lob=${lob}`)).json();
  accountsPanel.replaceChildren(
    ...accounts.map((account) => {
      const button = el('button', { className: 'account', type: 'button' }, account.holder, el('small', {}, `${account.id} · ${account.type}`));
      button.addEventListener('click', () => showStatement(account.id));
      return button;
    }),
  );
}

async function showStatement(id) {
  const response = await fetch(`/api/statements/${id}?quarter=2026-Q3`);
  const body = await response.json();
  if (!response.ok) {
    statementPanel.replaceChildren(el('p', {}, body.error));
    return;
  }
  const { statement } = body;
  const rows = statement.lines.map((line) => el('tr', {}, el('td', {}, line.label), el('td', {}, format(line.amount))));
  rows.push(el('tr', { className: 'total' }, el('td', {}, 'Total'), el('td', {}, format(statement.total))));
  const sections = statement.sections.flatMap((section) => [
    el('h3', {}, section.title),
    el('table', {}, ...section.rows.map((row) => el('tr', {}, el('td', {}, row.label), el('td', {}, format(row.value, row.label))))),
  ]);
  statementPanel.replaceChildren(
    el('h2', {}, `${statement.holder} · ${statement.quarter}`),
    el('p', { className: 'muted' }, statement.accountId),
    el('table', {}, ...rows),
    ...sections,
  );
}

for (const lob of LOBS) {
  const button = el('button', { type: 'button' }, lob.label);
  button.dataset.lob = lob.id;
  button.addEventListener('click', () => showLob(lob.id));
  nav.append(button);
}
showLob(LOBS[0].id);
