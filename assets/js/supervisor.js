/* 5x5-supervisor.html — the supervisor opens this from the link in the
   "employee submitted" email. The link carries the employee's answers; the
   supervisor adds ratings and notes, and submitting emails the completed
   review (plus the FIELD block the SharePoint automation reads). */
(function () {
  'use strict';

  const { $, val, esc, ratingRow, ratingValue, supervisorFor, decodePayload, onSubmit, sendEmail,
          showSuccess, draft, CONFIG } = TST;
  const { CORE_VALUES, HEALTH_CATEGORIES, DISCUSSION_QUESTIONS } = TST_5X5;

  let emp = null;       // the employee's answers, expanded to a readable shape
  let devRowCount = 0;

  /* ---------- reading the employee's answers ---------- */

  /* Links from the employee form carry a compact shape (see slim() in
     employee.js). Expand it. Very old links carried the full shape already. */
  function expand(slim) {
    if (!slim) return null;
    if (slim.name !== undefined) return slim;
    return {
      name: slim.n, entity: slim.e, quarter: slim.q, supervisorName: slim.s, empEmail: slim.em,
      cv: CORE_VALUES.map((value, i) => ({ value, word: (slim.cv && slim.cv[i] && slim.cv[i].w) || '', rating: (slim.cv && slim.cv[i] && slim.cv[i].r) || null })),
      seats: (slim.se || []).map((s) => ({ name: s.n, measurable: s.m, getIt: !!s.g, wantIt: !!s.w, capacity: !!s.c })),
      rocks: (slim.ro || []).map((r) => ({ name: r.n, rating: r.r })),
      health: Object.fromEntries(HEALTH_CATEGORIES.map((cat, i) => [cat.key, {
        ratings: (slim.h && slim.h[i]) || [],
        feedback: (slim.hf && slim.hf[i]) || ''
      }])),
      questions: (slim.qs || []).map((q) => ({ question: DISCUSSION_QUESTIONS[q.i] || `Question ${q.i + 1}`, answer: q.a }))
    };
  }

  /* ?sample=1 shows the page with made-up answers so it can be previewed. */
  function sampleData() {
    return expand({
      n: 'Sample Employee', e: CONFIG.ENTITIES[0].name, q: 'Q3 2026', s: CONFIG.ENTITIES[0].supervisors[0], em: 'sample@example.com',
      cv: [{ w: 'welcoming', r: 3 }, { w: 'honest', r: 2 }, { w: 'real', r: 3 }, { w: 'playful', r: 2 }, { w: 'careful', r: 3 }, { w: 'driven', r: 2 }],
      se: [{ n: 'Floor lead', m: 'Daily sales target', g: 1, w: 1, c: 1 }, { n: 'Trainer', m: '2 new hires onboarded', g: 1, w: 0, c: 1 }],
      ro: [{ n: 'Launch new inventory count process', r: 8 }, { n: 'Cross-train two associates', r: 6 }],
      h: [[8, 9, 7], [9, 8, 9], [7, 6, 8], [8, 8, 7], [9, 7, 8], [6, 7, 8], [7, 8, 6]],
      hf: ['', 'Love the direction we are heading.', '', '', '', '', 'Summer was a lot.'],
      qs: [{ i: 0, a: 'Scheduling during peak season.' }, { i: 2, a: 'Keeping up with inventory counts while covering the floor.' }]
    });
  }

  /* ---------- build the page ---------- */
  function buildMeta() {
    $('meta-name').textContent = emp.name || '—';
    $('meta-entity').textContent = emp.entity || '—';
    $('meta-quarter').textContent = emp.quarter || '—';
    $('meta-supervisor').textContent = emp.supervisorName || '—';
  }

  function buildCoreValues() {
    $('cv-sup-body').innerHTML = emp.cv.map((v, i) => `
      <tr>
        <td>${esc(v.value)}</td>
        <td style="font-family:var(--sans);color:var(--ink-secondary)">${esc(v.word) || '—'}</td>
        <td>${ratingRow({ max: 3, selected: v.rating, tone: 'emp', readOnly: true, label: `${v.value}: employee rating` })}</td>
        <td>${ratingRow({ id: `sup-cv-${i}`, max: 3, tone: 'sup', label: `${v.value}: your rating` })}</td>
      </tr>`).join('');
  }

  function buildSeats() {
    const wrap = $('seat-sup-rows');
    if (!emp.seats.length) { wrap.innerHTML = '<p class="no-data">No seats entered by employee.</p>'; return; }
    const badge = (on, label) => `<span class="gwc-badge ${on ? 'yes' : 'no'}">${label}: ${on ? 'Yes' : 'No'}</span>`;
    wrap.innerHTML = emp.seats.map((s) => `
      <div class="seat-card">
        <div class="seat-name">${esc(s.name)}</div>
        ${s.measurable ? `<div class="seat-measurable">${esc(s.measurable)}</div>` : ''}
        <div class="gwc-badges">${badge(s.getIt, 'Get it')}${badge(s.wantIt, 'Want it')}${badge(s.capacity, 'Capacity')}</div>
      </div>`).join('');
  }

  function buildRocks() {
    const wrap = $('rock-sup-rows');
    if (!emp.rocks.length) { wrap.innerHTML = '<p class="no-data">No rocks entered by employee.</p>'; return; }
    wrap.innerHTML = emp.rocks.map((r, i) => `
      <div class="rock-card">
        <div class="rock-title">${esc(r.name)}</div>
        <div class="dual-ratings">
          <div>
            <div class="rating-label emp">Employee</div>
            ${ratingRow({ max: 10, selected: r.rating, tone: 'emp', readOnly: true, label: `${r.name}: employee rating` })}
          </div>
          <div>
            <div class="rating-label sup">Supervisor</div>
            ${ratingRow({ id: `sup-rock-${i}`, max: 10, tone: 'sup', label: `${r.name}: your rating` })}
          </div>
        </div>
      </div>`).join('');
  }

  function buildHealth() {
    $('health-sup-blocks').innerHTML = HEALTH_CATEGORIES.map((cat) => {
      const h = emp.health[cat.key] || { ratings: [], feedback: '' };
      return `
      <div class="health-block">
        <div class="health-label">${esc(cat.label)}</div>
        ${cat.items.map((item, i) => `
          <div class="health-item stacked">
            <p>${esc(item)}</p>
            <div>
              <div class="rating-label emp">Employee</div>
              ${ratingRow({ max: 10, selected: h.ratings[i] || null, tone: 'emp', readOnly: true, label: `${item}: employee rating` })}
            </div>
          </div>`).join('')}
        ${h.feedback ? `<div class="health-emp-feedback"><span>Employee note</span>${esc(h.feedback)}</div>` : ''}
        <div class="divider"></div>
      </div>`;
    }).join('');
  }

  function buildQuestions() {
    const wrap = $('q-sup-list');
    if (!emp.questions.length) { wrap.innerHTML = '<p class="no-data">No questions answered by employee.</p>'; return; }
    wrap.innerHTML = emp.questions.map((q, i) => `
      <div class="q-item">
        <div class="q-text">${esc(q.question)}</div>
        <div class="emp-answer-label">Employee response</div>
        <div class="emp-answer">${esc(q.answer) || '(no response entered)'}</div>
        <textarea class="boxed" id="sup-q-note-${i}" placeholder="Supervisor notes (optional)…" aria-label="Your notes on: ${esc(q.question)}"></textarea>
      </div>`).join('');
  }

  function addDevRow() {
    const i = devRowCount++;
    $('dev-rows').insertAdjacentHTML('beforeend', `
      <input class="boxed" id="dev-area-${i}" placeholder="Development area" aria-label="Development area ${i + 1}">
      <input class="boxed" id="dev-plan-${i}" placeholder="Plan" aria-label="Plan ${i + 1}">`);
  }

  /* ---------- read what the supervisor entered ---------- */
  function collect() {
    return {
      cvRatings: emp.cv.map((_, i) => ratingValue(`sup-cv-${i}`)),
      rockRatings: emp.rocks.map((_, i) => ratingValue(`sup-rock-${i}`)),
      qNotes: emp.questions.map((q, i) => ({ question: q.question, empAnswer: q.answer, supNote: val(`sup-q-note-${i}`) })),
      devAreas: Array.from({ length: devRowCount }, (_, i) => ({ area: val(`dev-area-${i}`), plan: val(`dev-plan-${i}`) })).filter((d) => d.area),
      overallNotes: val('sup-overall-notes')
    };
  }

  /* ---------- the email ---------- */
  const sum = (arr) => arr.reduce((t, n) => t + (n || 0), 0);
  const oneLine = (s) => String(s || '').replace(/\|/g, '/').replace(/\r?\n/g, ' ');
  const ratingBar = (v, max) => v ? '●'.repeat(v) + '○'.repeat(max - v) + ` (${v}/${max})` : '—';
  const cell = (content, color = '#1a1a18', extra = '') => `<td style="padding:8px 12px;border-bottom:1px solid #e2e0d8;font-family:Arial,sans-serif;font-size:13px;color:${color};${extra}">${content}</td>`;
  const colHead = (text, color = '#9a9a93', extra = '') => `<td style="padding:6px 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:${color};${extra}">${text}</td>`;
  const sectionHeader = (title) => `<tr><td colspan="4" style="padding:14px 12px 6px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff;background:#2f6465;">${title}</td></tr>`;
  const totalCell = (text, color = '#1a1a18', extra = '') => `<td style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:${color};${extra}">${text}</td>`;
  const table = (rows) => `<table style="width:100%;border-collapse:collapse;background:#ffffff;margin-bottom:12px;">${rows}</table>`;

  function buildCompletedData(sup) {
    const cvEmpTotal = sum(emp.cv.map((v) => v.rating)), cvSupTotal = sum(sup.cvRatings), cvMax = emp.cv.length * 3;
    const rockEmpTotal = sum(emp.rocks.map((r) => r.rating)), rockSupTotal = sum(sup.rockRatings), rockMax = emp.rocks.length * 10;

    const healthTotals = {};
    let healthGrandTotal = 0, healthGrandMax = 0;
    HEALTH_CATEGORIES.forEach((cat) => {
      const h = emp.health[cat.key] || { ratings: [], feedback: '' };
      const total = sum(h.ratings), max = cat.items.length * 10;
      healthTotals[cat.key] = { total, max, feedback: h.feedback || '' };
      healthGrandTotal += total;
      healthGrandMax += max;
    });

    /* -- readable HTML -- */
    const cvRows = emp.cv.map((v, i) => `<tr>${cell(esc(v.value))}${cell(esc(v.word) || '—', '#5a5a55')}${cell(ratingBar(v.rating, 3), '#1a3a5c')}${cell(ratingBar(sup.cvRatings[i], 3), '#2f6465')}</tr>`).join('');
    const rockRows = emp.rocks.map((r, i) => `<tr>${cell(esc(r.name))}${cell(ratingBar(r.rating, 10), '#1a3a5c')}${cell(ratingBar(sup.rockRatings[i], 10), '#2f6465')}</tr>`).join('');
    const tag = (text) => `<span style="background:#e8f0ec;color:#2f6465;padding:2px 6px;border-radius:3px;font-size:11px;margin-right:4px;">${text}</span>`;
    const seatRows = emp.seats.map((s) => `<tr>${cell(`<strong>${esc(s.name)}</strong>${s.measurable ? ` — ${esc(s.measurable)}` : ''}`)}${cell(`${s.getIt ? tag('Gets it') : ''}${s.wantIt ? tag('Wants it') : ''}${s.capacity ? tag('Capacity') : ''}`)}</tr>`).join('');
    const healthRows = HEALTH_CATEGORIES.map((cat) => {
      const h = emp.health[cat.key] || { ratings: [], feedback: '' }, t = healthTotals[cat.key];
      const items = cat.items.map((item, i) => `<tr>${cell(esc(item), '#5a5a55', 'padding-left:24px;font-size:12px;border-bottom-color:#f0efe9;')}${cell(ratingBar(h.ratings[i], 10), '#1a3a5c', 'font-size:12px;border-bottom-color:#f0efe9;')}</tr>`).join('');
      return `<tr><td colspan="2" style="padding:10px 12px 4px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#2f6465;background:#f7f6f2;">${esc(cat.label)} — ${t.total}/${t.max}</td></tr>${items}` +
        (h.feedback ? `<tr><td colspan="2" style="padding:6px 12px;font-family:Arial,sans-serif;font-size:12px;color:#1a3a5c;background:#e8eef5;font-style:italic;">Note: ${esc(h.feedback)}</td></tr>` : '');
    }).join('');
    const questionRows = emp.questions.map((q, i) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e2e0d8;font-family:Arial,sans-serif;font-size:13px;">
        <div style="font-weight:bold;color:#1a1a18;margin-bottom:6px;">${esc(q.question)}</div>
        <div style="background:#e8eef5;border-left:3px solid #1a3a5c;padding:8px 12px;border-radius:0 4px 4px 0;color:#1a1a18;white-space:pre-wrap;">${esc(q.answer) || '—'}</div>
        ${sup.qNotes[i] && sup.qNotes[i].supNote ? `<div style="background:#e8f0ec;border-left:3px solid #2f6465;padding:8px 12px;border-radius:0 4px 4px 0;color:#1a1a18;margin-top:6px;white-space:pre-wrap;"><strong>Supervisor note:</strong> ${esc(sup.qNotes[i].supNote)}</div>` : ''}
      </td></tr>`).join('');
    const devRows = sup.devAreas.map((d) => `<tr>${cell(esc(d.area))}${cell(esc(d.plan) || '—', '#5a5a55')}</tr>`).join('');

    const metaBox = (label, value) => `<div style="flex:1;"><div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9a93;margin-bottom:2px;">${label}</div><div style="font-size:13px;font-weight:bold;color:#1a1a18;">${esc(value) || '—'}</div></div>`;

    /* -- machine-readable FIELD block (read by the SharePoint automation; keep names and separators unchanged) -- */
    const cvFields = emp.cv.map((v, i) => `|||FIELD:cv_${v.value.toLowerCase()}_word|${oneLine(v.word)}|||FIELD:cv_${v.value.toLowerCase()}_emp|${v.rating || 0}|||FIELD:cv_${v.value.toLowerCase()}_sup|${sup.cvRatings[i] || 0}`).join('');
    const rockFields = emp.rocks.map((r, i) => `|||FIELD:rock_${i + 1}_name|${oneLine(r.name)}|||FIELD:rock_${i + 1}_emp|${r.rating || 0}|||FIELD:rock_${i + 1}_sup|${sup.rockRatings[i] || 0}`).join('');
    const qFields = emp.questions.map((q, i) => `|||FIELD:q${i + 1}|${oneLine(q.answer)}`).join('');
    const devFields = sup.devAreas.map((d, i) => `|||FIELD:dev_${i + 1}_area|${oneLine(d.area)}|||FIELD:dev_${i + 1}_plan|${oneLine(d.plan)}`).join('');
    const healthFields = HEALTH_CATEGORIES.map((cat) => `|||FIELD:${cat.key}|${healthTotals[cat.key].total}`).join('');
    const today = new Date().toLocaleDateString();

    return `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;background:#f7f6f2;">

  <div style="background:#1a1a18;padding:20px 24px;">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9a9a93;margin-bottom:4px;">${esc(CONFIG.COMPANY)}</div>
    <div style="font-size:22px;color:#d24d29;font-family:Georgia,serif;">5×5×5 Quarterly Conversation</div>
    <div style="font-size:13px;color:#c8c6bc;margin-top:4px;">Completed review — ${esc(emp.name) || '—'} · ${esc(emp.quarter) || '—'}</div>
  </div>

  <div style="background:#ffffff;padding:16px 24px;display:flex;gap:24px;border-bottom:1px solid #e2e0d8;">
    ${metaBox('Employee', emp.name)}${metaBox('Supervisor', emp.supervisorName)}${metaBox('Quarter', emp.quarter)}${metaBox('Entity', emp.entity)}
  </div>

  ${table(`${sectionHeader('Core Values — Employee ● | Supervisor ●')}
    <tr style="background:#f7f6f2;">${colHead('Value', '#9a9a93', 'width:20%;')}${colHead('One word', '#9a9a93', 'width:20%;')}${colHead('Employee', '#1a3a5c', 'width:30%;')}${colHead('Supervisor', '#2f6465')}</tr>
    ${cvRows}
    <tr style="background:#f7f6f2;">${totalCell('Total', '#1a1a18', '')}<td></td>${totalCell(`${cvEmpTotal}/${cvMax}`, '#1a3a5c')}${totalCell(`${cvSupTotal}/${cvMax}`, '#2f6465')}</tr>`)}

  ${seatRows ? table(`${sectionHeader('Seat(s)')}${seatRows}`) : ''}

  ${rockRows ? table(`${sectionHeader('Rock Review')}
    <tr style="background:#f7f6f2;">${colHead('Rock', '#9a9a93', 'width:40%;')}${colHead('Employee', '#1a3a5c')}${colHead('Supervisor', '#2f6465')}</tr>
    ${rockRows}
    <tr style="background:#f7f6f2;">${totalCell('Total')}${totalCell(`${rockEmpTotal}/${rockMax}`, '#1a3a5c')}${totalCell(`${rockSupTotal}/${rockMax}`, '#2f6465')}</tr>`) : ''}

  ${table(`${sectionHeader('Health Check — Employee ratings (1–10)')}${healthRows}
    <tr style="background:#f7f6f2;"><td colspan="2" style="padding:8px 12px;font-family:Arial,sans-serif;font-size:12px;font-weight:bold;color:#1a1a18;">Overall total: ${healthGrandTotal}/${healthGrandMax}</td></tr>`)}

  ${questionRows ? table(`${sectionHeader('Discussion Questions')}${questionRows}`) : ''}

  ${devRows ? table(`${sectionHeader('Areas for Development')}
    <tr style="background:#f7f6f2;">${colHead('Area', '#9a9a93', 'width:50%;')}${colHead('Plan')}</tr>
    ${devRows}`) : ''}

  ${sup.overallNotes ? table(`${sectionHeader('Supervisor Overall Notes')}<tr><td style="padding:12px;font-family:Arial,sans-serif;font-size:13px;color:#1a1a18;line-height:1.6;white-space:pre-wrap;">${esc(sup.overallNotes)}</td></tr>`) : ''}

  <div style="padding:16px 24px;background:#f7f6f2;border-top:1px solid #e2e0d8;">
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#9a9a93;text-align:center;">${esc(CONFIG.COMPANY)} · 5×5×5 Quarterly Conversation · ${today}</div>
  </div>

  <div style="padding:16px 24px;background:#f7f6f2;margin-top:24px;border-top:2px solid #e2e0d8;">
===5x5_DATA_START=== --- MACHINE READABLE DATA (do not edit below this line) ---
FIELD:employee_name|${oneLine(emp.name)}|||FIELD:entity|${oneLine(emp.entity)}|||FIELD:quarter|${oneLine(emp.quarter)}|||FIELD:supervisor_name|${oneLine(emp.supervisorName)}|||FIELD:date_completed|${today}|||FIELD:cv_emp_total|${cvEmpTotal}|||FIELD:cv_sup_total|${cvSupTotal}|||FIELD:cv_max|${cvMax}${cvFields}|||FIELD:rocks_emp_total|${rockEmpTotal}|||FIELD:rocks_sup_total|${rockSupTotal}|||FIELD:rocks_max|${rockMax}${rockFields}|||FIELD:health_total|${healthGrandTotal}|||FIELD:health_max|${healthGrandMax}${healthFields}${qFields}${devFields}|||FIELD:supervisor_notes|${oneLine(sup.overallNotes)}
--- END MACHINE READABLE DATA --- ===5x5_DATA_END===</div>

</div>`;
  }

  async function submit() {
    const supData = collect();
    const sup = supervisorFor(emp.supervisorName);

    await sendEmail(CONFIG.EMAILJS.TEMPLATES.COMPLETED_DOCUMENT, {
      employee_name: emp.name || '—',
      supervisor_name: emp.supervisorName || '—',
      supervisor_email: sup.email || CONFIG.ADMIN_EMAIL,
      employee_email: emp.empEmail || '',
      quarter: emp.quarter || '—',
      entity: emp.entity || '—',
      completed_data: buildCompletedData(supData)
    });

    draft.clear();
    showSuccess();
  }

  /* ---------- start ---------- */
  const params = new URLSearchParams(window.location.search);
  emp = params.get('sample') ? sampleData() : expand(decodePayload());

  if (!emp) {
    $('no-data-notice').classList.add('show');
    $('main-form').style.display = 'none';
    return;
  }

  buildMeta();
  buildCoreValues();
  buildSeats();
  buildRocks();
  buildHealth();
  buildQuestions();
  for (let i = 0; i < 3; i++) addDevRow();
  $('add-dev').addEventListener('click', addDevRow);
  $('print-btn').addEventListener('click', () => window.print());
  $('print-btn-done').addEventListener('click', () => window.print());

  draft.init(`tst-5x5-supervisor:${emp.name}:${emp.quarter}`, {
    extra: () => ({ devRowCount }),
    beforeRestore: (extra) => { while (devRowCount < (extra.devRowCount || 0)) addDevRow(); }
  });
  onSubmit(submit);
})();
