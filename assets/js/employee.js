/* 5x5-employee.html — the employee fills this in before the quarterly meeting.
   On submit it emails the supervisor a link to 5x5-supervisor.html that
   carries every answer, so nothing is stored on a server. */
(function () {
  'use strict';

  const { $, val, checked, esc, ratingRow, ratingValue, wireEntitySupervisor, fillYears, supervisorFor,
          encodePayload, pageUrl, onSubmit, sendEmail, showError, showSuccess, fail, draft, CONFIG } = TST;
  const { CORE_VALUES, HEALTH_CATEGORIES, DISCUSSION_QUESTIONS, MIN_QUESTIONS, SEAT_ROWS, INITIAL_ROCK_ROWS } = TST_5X5;

  let rockCount = 0;

  /* ---------- build the page ---------- */
  function buildCoreValues() {
    $('cv-body').innerHTML = CORE_VALUES.map((v, i) => `
      <tr>
        <td>${esc(v)}</td>
        <td><input class="inline" id="cv-word-${i}" placeholder="one word" aria-label="One word for ${esc(v)}"></td>
        <td>${ratingRow({ id: `cv-rate-${i}`, max: 3, tone: 'emp', label: `${v} rating` })}</td>
      </tr>`).join('');
  }

  function buildSeats() {
    $('seat-rows').innerHTML = Array.from({ length: SEAT_ROWS }, (_, i) => `
      <div class="seat-row">
        <input class="boxed" id="seat-name-${i}" placeholder="Seat name" aria-label="Seat ${i + 1} name">
        <input class="boxed" id="seat-meas-${i}" placeholder="Measurable" aria-label="Seat ${i + 1} measurable">
        <div class="gwc-checks">
          <label><input type="checkbox" id="seat-g-${i}"> Get it?</label>
          <label><input type="checkbox" id="seat-w-${i}"> Want it?</label>
          <label><input type="checkbox" id="seat-c-${i}"> Capacity?</label>
        </div>
      </div>`).join('');
  }

  function addRock() {
    const i = rockCount++;
    $('rock-rows').insertAdjacentHTML('beforeend', `
      <div class="rock-row">
        <input class="boxed" id="rock-name-${i}" placeholder="Rock name" aria-label="Rock ${i + 1} name">
        ${ratingRow({ id: `rock-rate-${i}`, max: 10, tone: 'emp', label: `Rock ${i + 1} completion rating` })}
      </div>`);
  }

  function buildHealth() {
    $('health-blocks').innerHTML = HEALTH_CATEGORIES.map((cat) => `
      <div class="health-block">
        <div class="health-label">${esc(cat.label)}</div>
        ${cat.items.map((item, i) => `
          <div class="health-item">
            <p id="health-${cat.key}-${i}-text">${esc(item)}</p>
            ${ratingRow({ id: `health-${cat.key}-${i}`, max: 10, tone: 'emp', label: item })}
          </div>`).join('')}
        <div class="health-feedback">
          <label for="health-fb-${cat.key}">Feedback on your ${esc(cat.label)} ratings (optional)</label>
          <input class="boxed" type="text" id="health-fb-${cat.key}" placeholder="Any additional context…">
        </div>
        <div class="divider"></div>
      </div>`).join('');
  }

  function buildQuestions() {
    $('q-list').innerHTML = DISCUSSION_QUESTIONS.map((q, i) => `
      <div class="q-item">
        <div class="q-top">
          <input type="checkbox" class="q-check" id="q-check-${i}" data-index="${i}">
          <label for="q-check-${i}">${esc(q)}</label>
        </div>
        <div class="q-answer" id="q-ans-${i}">
          <textarea class="boxed" id="q-text-${i}" placeholder="Your response…" aria-label="Answer: ${esc(q)}"></textarea>
        </div>
      </div>`).join('');

    $('q-list').addEventListener('change', (e) => {
      if (!e.target.classList.contains('q-check')) return;
      $(`q-ans-${e.target.dataset.index}`).classList.toggle('open', e.target.checked);
    });
  }

  /* ---------- read the page ---------- */
  function collect() {
    const quarter = val('emp-quarter'), year = val('emp-year');
    return {
      name: val('emp-name'),
      entity: val('emp-entity'),
      quarter: quarter && year ? `${quarter} ${year}` : '',
      supervisorName: val('emp-supervisor'),
      empEmail: val('emp-email'),
      cv: CORE_VALUES.map((value, i) => ({ value, word: val(`cv-word-${i}`), rating: ratingValue(`cv-rate-${i}`) })),
      seats: Array.from({ length: SEAT_ROWS }, (_, i) => ({
        name: val(`seat-name-${i}`), measurable: val(`seat-meas-${i}`),
        getIt: checked(`seat-g-${i}`), wantIt: checked(`seat-w-${i}`), capacity: checked(`seat-c-${i}`)
      })).filter((s) => s.name),
      rocks: Array.from({ length: rockCount }, (_, i) => ({ name: val(`rock-name-${i}`), rating: ratingValue(`rock-rate-${i}`) }))
        .filter((r) => r.name),
      health: HEALTH_CATEGORIES.map((cat) => ({
        key: cat.key, label: cat.label, max: cat.items.length * 10,
        ratings: cat.items.map((_, i) => ratingValue(`health-${cat.key}-${i}`)),
        feedback: val(`health-fb-${cat.key}`)
      })),
      questions: DISCUSSION_QUESTIONS.map((question, i) => checked(`q-check-${i}`) ? { index: i, question, answer: val(`q-text-${i}`) } : null)
        .filter(Boolean)
    };
  }

  function validate(d) {
    if (!d.name) throw fail('Please enter your name.', 'emp-name');
    if (!d.entity) throw fail('Please select your entity.', 'emp-entity');
    if (!val('emp-quarter')) throw fail('Please select a quarter.', 'emp-quarter');
    if (!d.supervisorName) throw fail('Please select your supervisor.', 'emp-supervisor');
    if (!d.empEmail || !$('emp-email').checkValidity()) throw fail('Please enter a valid email address.', 'emp-email');
    if (d.questions.length < MIN_QUESTIONS) throw fail(`Please answer at least ${MIN_QUESTIONS} discussion questions.`);
    const blank = d.questions.find((q) => !q.answer);
    if (blank) throw fail('One of the discussion questions you ticked has no answer yet.', `q-text-${blank.index}`);
  }

  /* ---------- what gets sent ---------- */

  /* Compact shape carried in the supervisor link. Field names are short on
     purpose; 5x5-supervisor.html expands them back. Do not rename. */
  function slim(d) {
    return {
      n: d.name, e: d.entity, q: d.quarter, s: d.supervisorName, em: d.empEmail,
      cv: d.cv.map((v) => ({ w: v.word, r: v.rating })),
      se: d.seats.map((s) => ({ n: s.name, m: s.measurable, g: s.getIt ? 1 : 0, w: s.wantIt ? 1 : 0, c: s.capacity ? 1 : 0 })),
      ro: d.rocks.map((r) => ({ n: r.name, r: r.rating })),
      h: d.health.map((h) => h.ratings),
      hf: d.health.map((h) => h.feedback),
      qs: d.questions.map((q) => ({ i: q.index, a: q.answer }))
    };
  }

  const sum = (arr) => arr.reduce((t, n) => t + (n || 0), 0);

  function summaryText(d) {
    const cvTotal = sum(d.cv.map((v) => v.rating)), cvMax = d.cv.length * 3;
    const rockTotal = sum(d.rocks.map((r) => r.rating)), rockMax = d.rocks.length * 10;
    const healthTotal = sum(d.health.map((h) => sum(h.ratings))), healthMax = sum(d.health.map((h) => h.max));
    return [
      `Core Values total: ${cvTotal}/${cvMax}`,
      rockMax > 0 ? `Rock Review total: ${rockTotal}/${rockMax}` : null,
      'Health Check by category:',
      ...d.health.map((h) => `  ${h.label}: ${sum(h.ratings)}/${h.max}`),
      `Health Check overall total: ${healthTotal}/${healthMax}`
    ].filter(Boolean).join('\n');
  }

  function linkFallbackHtml(link, sup) {
    return `
      <div style="margin-top:6px">Copy this link and send it to ${esc(sup.name)}${sup.email ? ` (${esc(sup.email)})` : ''} so they can complete their review:</div>
      <div class="link-box">
        <input type="text" id="fallback-link" readonly value="${esc(link)}" aria-label="Supervisor link">
        <button type="button" class="btn secondary small" id="copy-link">Copy</button>
      </div>`;
  }

  async function submit() {
    const d = collect();
    validate(d);

    const sup = supervisorFor(d.supervisorName);
    const link = `${pageUrl('5x5-supervisor.html')}?d=${encodePayload(slim(d))}`;

    const params = {
      supervisor_name: sup.name,
      supervisor_email: sup.email || CONFIG.ADMIN_EMAIL,
      employee_name: d.name,
      employee_email: d.empEmail,
      quarter: d.quarter,
      supervisor_link: link,
      employee_summary: summaryText(d)
    };

    try {
      await sendEmail(CONFIG.EMAILJS.TEMPLATES.EMPLOYEE_SUBMITTED, params);
    } catch (e) {
      console.error(e);
      showError("We couldn't send the notification email. Your answers are still here — please try again in a moment.", { html: linkFallbackHtml(link, sup) });
      $('copy-link').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(link); $('copy-link').textContent = 'Copied'; }
        catch (err) { $('fallback-link').select(); }
      });
      return;
    }

    draft.clear();
    showSuccess();
  }

  /* ---------- start ---------- */
  wireEntitySupervisor('emp-entity', 'emp-supervisor');
  fillYears($('emp-year'));
  buildCoreValues();
  buildSeats();
  for (let i = 0; i < INITIAL_ROCK_ROWS; i++) addRock();
  buildHealth();
  buildQuestions();
  $('add-rock').addEventListener('click', addRock);
  draft.init('tst-5x5-employee', {
    extra: () => ({ rockCount }),
    beforeRestore: (extra) => { while (rockCount < (extra.rockCount || 0)) addRock(); }
  });
  onSubmit(submit);
})();
