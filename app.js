let CONTROLS = [];
const state = {}; // id -> 'yes' | 'no' | 'partial' | 'na'
const LS_KEY = 'sprs-calc-v1';

const $ = (id) => document.getElementById(id);

/* ---------------- Lead capture (no backend) ----------------
 * Set REPORT_INBOX to the inbox that receives review requests. When set, a
 * "Get your score reviewed" form appears: the visitor enters their work
 * email, their full MAPS-prioritized summary downloads immediately, and
 * their mail app opens with a pre-addressed review request carrying a
 * results summary. They hit Send; the lead arrives from their own address.
 * Leave "" to hide the form.
 */
const REPORT_INBOX = 'n.harvard@aitechpros.ai';
const LEAD_STORE_KEY = 'sprs-lead-v1';

function buildLeadSubject(company) {
  return 'SPRS score review request' + (company ? ' - ' + company : '');
}

/* Compact summary for the review-request email body. Pure: safe to unit test. */
function buildLeadBody(visitorEmail, company, score, open) {
  const neverOpen = open.filter(c => c.never_deferrable);
  const lines = [
    'SPRS score review request',
    '',
    'Visitor email: ' + visitorEmail,
    'Company: ' + (company || '(not given)'),
    'Estimated SPRS score: ' + score,
    'Open gaps: ' + open.length + ' (never-deferrable open: ' + neverOpen.length + ')',
    ''
  ];
  const top = open.slice(0, 8);
  if (top.length) {
    lines.push('Top MAPS-prioritized gaps:');
    top.forEach(c => lines.push('- ' + c.id + (c.never_deferrable ? ' (never-deferrable)' : '')));
    lines.push('');
  }
  lines.push('The visitor downloaded their full MAPS-prioritized summary from the SPRS Score Calculator.');
  return lines.join('\n');
}

function leadMailto(inbox, subject, body) {
  return 'mailto:' + inbox + '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function loadLead() {
  try {
    const raw = window.localStorage.getItem(LEAD_STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveLead(lead) {
  try { window.localStorage.setItem(LEAD_STORE_KEY, JSON.stringify(lead)); }
  catch (e) { /* storage unavailable; lead capture still works */ }
}

function deduction(c, s) {
  if (s === 'yes' || s === 'na' || !s) return 0;
  if (c.weight === 'NA') return 0; // 3.12.4: no point value, but no SSP means no assessment
  if (c.weight === '5/3') return s === 'partial' ? 3 : 5;
  return parseInt(c.weight, 10);
}

function weightBadge(c, s) {
  if (c.weight === 'NA') return '<span class="badge nd">REQUIRED</span>';
  if (c.weight === '5/3') {
    const v = s === 'partial' ? 3 : 5;
    return `<span class="badge w${v}">${v} pt</span>`;
  }
  return `<span class="badge w${c.weight}">${c.weight} pt</span>`;
}

const NO_DEDUCT_HINT = {
  '3.1.12': 'No points deducted if remote access is prohibited by policy.',
  '3.1.13': 'No points deducted if remote access is prohibited by policy.',
  '3.1.16': 'No points deducted if wireless access is prohibited by policy.',
  '3.1.17': 'No points deducted if wireless access is prohibited by policy.',
  '3.1.18': 'No points deducted if mobile device connection is prohibited by policy.'
};

function mapsRank(c) {
  // lower = fix first
  if (c.never_deferrable) return 0;
  const w = c.weight === '5/3' ? 5 : parseInt(c.weight, 10);
  return 10 - w; // 5pt -> 5, 3pt -> 7, 1pt -> 9
}

function band(score) {
  if (score === 110) return ['Perfect score', 'var(--green)'];
  if (score >= 88) return ['Conditional range (88+)', 'var(--green)'];
  if (score >= 0) return ['Below conditional', 'var(--amber)'];
  return ['Negative score', 'var(--red)'];
}

function gateCheck(score) {
  const open = CONTROLS.filter(c => state[c.id] === 'no' || state[c.id] === 'partial');
  const ndOpen = open.filter(c => c.never_deferrable);
  const badWeight = open.filter(c => {
    if (c.id === '3.13.11' && state[c.id] === 'partial') return false; // deferrable at -3
    const w = c.weight === '5/3' ? (state[c.id] === 'partial' ? 3 : 5) : parseInt(c.weight, 10);
    return w !== 1;
  });
  if (ndOpen.length) return { pass: false, text: ndOpen.length + ' never-deferrable requirement(s) still open. Nothing else matters until those close.' };
  if (score < 88) return { pass: false, text: 'Score is below 88. Conditional status needs 88 or higher.' };
  if (badWeight.length) return { pass: false, text: badWeight.length + ' open gap(s) above 1 point. Conditional status allows only 1-point items on the POA&M.' };
  if (!open.length) return { pass: true, text: 'All requirements implemented. This clears the 32 CFR 170.21 conditional gate.' };
  return { pass: true, text: 'Meets the conditional gate: 88+, never-deferrable six closed, only 1-point items open.' };
}

function render() {
  let score = 110, done = 0, openN = 0, naN = 0, l5 = 0, l3 = 0, l1 = 0;
  for (const c of CONTROLS) {
    const s = state[c.id];
    const d = deduction(c, s);
    score -= d;
    if (s === 'yes') done++;
    else if (s === 'na') naN++;
    else if (s === 'no' || s === 'partial') {
      openN++;
      if (d === 5) l5 += 5; else if (d === 3) l3 += 3; else l1 += 1;
    }
  }
  score = Math.max(score, -203);
  const [label, color] = band(score);
  $('scoreNum').textContent = score;
  $('scoreNum').style.color = color;
  $('scoreBand').textContent = label;
  $('scoreBand').style.color = color;
  const g = gateCheck(score);
  $('gateStatus').textContent = g.text;
  $('gateStatus').className = 'gate ' + (g.pass ? 'pass' : 'fail');
  if (state['3.12.4'] === 'no') {
    $('gateStatus').textContent = 'No System Security Plan: an assessment cannot be completed, and this is noncompliance with DFARS 252.204-7012. The score below is illustrative only.';
    $('gateStatus').className = 'gate fail';
  }
  $('statDone').textContent = done;
  $('statOpen').textContent = openN;
  $('statNA').textContent = naN;
  $('statLost5').textContent = l5;
  $('statLost3').textContent = l3;
  $('statLost1').textContent = l1;
  renderGaps();
  save();
}

function renderGaps() {
  const open = CONTROLS.filter(c => state[c.id] === 'no' || state[c.id] === 'partial')
    .sort((a, b) => mapsRank(a) - mapsRank(b) || deduction(b, state[b.id]) - deduction(a, state[a.id]));
  const sec = $('gapSection');
  if (!open.length) { sec.hidden = true; return; }
  sec.hidden = false;
  $('gapList').innerHTML = open.map(c => {
    const d = deduction(c, state[c.id]);
    const tag = c.never_deferrable ? ' <span class="badge nd">NEVER DEFERRABLE</span>' : '';
    const pts = c.weight === 'NA' ? '' : `<span class="badge w${c.weight === '5/3' ? (state[c.id] === 'partial' ? 3 : 5) : c.weight}">-${d}</span>`;
    return `<li><span class="gid">${c.id}</span>${pts}${tag}<br><span style="color:var(--muted);font-size:13px">${esc(c.requirement)}</span></li>`;
  }).join('');
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusButtons(c) {
  const s = state[c.id];
  // 3.12.4 (the SSP) is mandatory: no N/A option
  const opts = c.weight === '5/3'
    ? [['yes', 'Yes'], ['partial', 'Partial'], ['no', 'No'], ['na', 'N/A']]
    : c.weight === 'NA'
    ? [['yes', 'Yes'], ['no', 'No']]
    : [['yes', 'Yes'], ['no', 'No'], ['na', 'N/A']];
  return `<div class="seg" data-id="${c.id}">` + opts.map(([v, lbl]) =>
    `<button data-v="${v}" class="${s === v ? 'on-' + v : ''}">${lbl}</button>`).join('') + '</div>';
}

function buildUI() {
  const fams = {};
  for (const c of CONTROLS) { (fams[c.family] = fams[c.family] || []).push(c); }
  const famSel = $('familyFilter');
  for (const f of Object.keys(fams).sort((a, b) => parseFloat(a) - parseFloat(b))) {
    const o = document.createElement('option');
    o.value = f; o.textContent = f + ' ' + fams[f][0].family_name;
    famSel.appendChild(o);
  }
  const main = $('families');
  main.innerHTML = Object.keys(fams).sort((a, b) => parseFloat(a) - parseFloat(b)).map(f => {
    const list = fams[f];
    return `<div class="family" data-fam="${f}">
      <h2>${f} ${esc(list[0].family_name)} <span class="fam-progress" data-fprog="${f}"></span></h2>
      <div class="fam-bar"><i data-fbar="${f}"></i></div>
      ${list.map(c => `
      <div class="ctrl ${state[c.id] === 'yes' ? 'done' : state[c.id] === 'na' ? 'na' : state[c.id] ? 'open' : ''}" data-ctrl="${c.id}" data-req="${esc(c.requirement.toLowerCase())}">
        <div class="ctrl-head">
          <span class="ctrl-id">${c.id}</span>
          ${weightBadge(c, state[c.id])}
          ${c.never_deferrable ? '<span class="badge nd">NEVER DEFERRABLE</span>' : ''}
          ${c.special_scoring ? `<span style="font-size:12px;color:var(--muted)">${esc(c.special_scoring)}</span>` : ''}
          ${NO_DEDUCT_HINT[c.id] ? `<span style="font-size:12px;color:var(--muted)">${NO_DEDUCT_HINT[c.id]}</span>` : ''}
        </div>
        ${statusButtons(c)}
        <p class="ctrl-req">${esc(c.requirement)}</p>
      </div>`).join('')}
    </div>`;
  }).join('');
  main.querySelectorAll('.seg button').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.parentElement.dataset.id;
      state[id] = b.dataset.v;
      const card = document.querySelector(`[data-ctrl="${id}"]`);
      card.className = 'ctrl ' + (state[id] === 'yes' ? 'done' : state[id] === 'na' ? 'na' : 'open');
      card.querySelectorAll('.seg button').forEach(x => x.className = x.dataset.v === state[id] ? 'on-' + x.dataset.v : '');
      updateFamBars();
      render();
    });
  });
  updateFamBars();
}

function updateFamBars() {
  const fams = {};
  for (const c of CONTROLS) { (fams[c.family] = fams[c.family] || []).push(c); }
  for (const f of Object.keys(fams)) {
    const list = fams[f];
    const answered = list.filter(c => state[c.id]).length;
    const bar = document.querySelector(`[data-fbar="${f}"]`);
    const prog = document.querySelector(`[data-fprog="${f}"]`);
    if (bar) bar.style.width = (answered / list.length * 100) + '%';
    if (prog) prog.textContent = answered + ' of ' + list.length + ' answered';
  }
}

function applyFilters() {
  const q = $('search').value.toLowerCase().trim();
  const fam = $('familyFilter').value;
  const st = $('statusFilter').value;
  document.querySelectorAll('.family').forEach(f => {
    let visible = 0;
    f.querySelectorAll('.ctrl').forEach(card => {
      const id = card.dataset.ctrl;
      const s = state[id] || '';
      const okQ = !q || card.dataset.req.includes(q) || id.includes(q);
      const okF = !fam || f.dataset.fam === fam;
      const okS = !st || (st === 'unanswered' ? !s : s === st);
      const show = okQ && okF && okS;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    f.style.display = visible ? '' : 'none';
  });
}

function exportCsv() {
  const open = CONTROLS.filter(c => state[c.id] === 'no' || state[c.id] === 'partial')
    .sort((a, b) => mapsRank(a) - mapsRank(b));
  const rows = [['maps_priority', 'control', 'family', 'points_lost', 'never_deferrable', 'status', 'requirement']];
  open.forEach((c, i) => rows.push([i + 1, c.id, c.family_name, deduction(c, state[c.id]), c.never_deferrable ? 'yes' : 'no', state[c.id], '"' + c.requirement.replace(/"/g, '""') + '"']));
  download('sprs-gaps.csv', rows.map(r => r.join(',')).join('\n'), 'text/csv');
}

function buildSummaryMd(score, open, stateMap, dateStr) {
  let md = '# SPRS self-assessment summary\n\nEstimated SPRS score: **' + score + '**\n\n';
  md += 'Scored ' + dateStr + ' with the free SPRS Score Calculator (Neo Harvard, AI Tech Pros).\n\n';
  md += '## Open gaps in MAPS priority order\n\n';
  open.forEach((c, i) => {
    md += (i + 1) + '. **' + c.id + '** (-' + deduction(c, stateMap[c.id]) + ')' + (c.never_deferrable ? ' NEVER DEFERRABLE' : '') + ': ' + c.requirement + '\n';
  });
  return md;
}

function exportMd() {
  const score = $('scoreNum').textContent;
  const open = CONTROLS.filter(c => state[c.id] === 'no' || state[c.id] === 'partial')
    .sort((a, b) => mapsRank(a) - mapsRank(b));
  download('sprs-summary.md', buildSummaryMd(score, open, state, new Date().toISOString().slice(0, 10)), 'text/markdown');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

function load() {
  try { Object.assign(state, JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch (e) {}
}

async function init() {
  const res = await fetch('data/nist-800-171-controls.json');
  const ds = await res.json();
  CONTROLS = ds.controls;
  load();
  buildUI();
  render();
  $('search').addEventListener('input', applyFilters);
  $('familyFilter').addEventListener('change', applyFilters);
  $('statusFilter').addEventListener('change', applyFilters);
  $('exportCsv').addEventListener('click', exportCsv);
  $('exportMd').addEventListener('click', exportMd);
  $('resetAll').addEventListener('click', () => {
    if (confirm('Clear all answers?')) {
      Object.keys(state).forEach(k => delete state[k]);
      buildUI(); render(); applyFilters();
    }
  });

  const leadCapture = $('leadCapture');
  if (!REPORT_INBOX) {
    leadCapture.hidden = true;
  } else {
    const savedLead = loadLead();
    if (savedLead) {
      if (savedLead.email) $('leadEmail').value = savedLead.email;
      if (savedLead.company) $('leadCompany').value = savedLead.company;
    }
    $('leadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const emailEl = $('leadEmail');
      const companyEl = $('leadCompany');
      const statusEl = $('leadStatus');
      const visitorEmail = emailEl.value.trim();
      const company = companyEl.value.trim();
      if (!isValidEmail(visitorEmail)) {
        statusEl.textContent = 'Enter a valid work email address.';
        emailEl.focus();
        return;
      }
      const score = $('scoreNum').textContent;
      const open = CONTROLS.filter(c => state[c.id] === 'no' || state[c.id] === 'partial')
        .sort((a, b) => mapsRank(a) - mapsRank(b));
      download('sprs-summary.md', buildSummaryMd(score, open, state, new Date().toISOString().slice(0, 10)), 'text/markdown');
      saveLead({ email: visitorEmail, company: company });
      window.location.href = leadMailto(REPORT_INBOX, buildLeadSubject(company),
        buildLeadBody(visitorEmail, company, score, open));
      statusEl.textContent = 'Summary downloaded. An email draft just opened: hit Send and we will reply with a read on your biggest gaps. If no draft opened, email your downloaded summary to ' + REPORT_INBOX + '.';
    });
  }
}
init();
