/* rock-planner.html — an employee plans one quarterly rock.
   On submit it emails a formatted copy plus a machine-readable FIELD block
   that the Power Automate flow files into SharePoint. */
(function () {
  'use strict';

  const { $, val, esc, wireEntitySupervisor, fillYears, supervisorFor, onSubmit, sendEmail,
          showSuccess, fail, draft, email, fieldValue, todayISO, longDate, shortDate, CONFIG } = TST;

  const STEP_COUNT = 13;      // one row per week of the quarter
  const MIN_STEPS = 4;
  const RESOURCE_COUNT = 5;

  const SMART = [
    { key: 's', letter: 'S', label: 'Specific',    prompt: 'What specifically will I achieve?',              placeholder: 'Be specific about what you will accomplish…' },
    { key: 'm', letter: 'M', label: 'Measurable',  prompt: 'How will I measure completion?',                 placeholder: "How will you know when it's done?" },
    { key: 'a', letter: 'A', label: 'Achievable',  prompt: 'Is it achievable by me now?',                    placeholder: 'Do you have the skills, resources, and authority?' },
    { key: 'r', letter: 'R', label: 'Relevant',    prompt: 'How is it relevant to our vision, our goals?',   placeholder: 'How does this connect to company vision and goals?' },
    { key: 't', letter: 'T', label: 'Time-framed', prompt: 'What are key dates, what is final date?',        placeholder: 'Key milestones and deadlines…' }
  ];

  const RESOURCE_HINTS = ['e.g. Budget approval from Will', 'e.g. New POS hardware', 'e.g. IT support for setup', 'e.g. Staff training time', 'e.g. Vendor contract'];

  /* ---------- build the page ---------- */
  function buildSmart() {
    $('smart-rows').innerHTML = SMART.map((s) => `
      <div class="smart-row">
        <div class="smart-row-header">
          <span class="smart-letter" aria-hidden="true">${s.letter}</span>
          <label class="smart-label" for="smart-${s.key}">${esc(s.label)} <span class="req">*</span></label>
          <span class="smart-prompt">— ${esc(s.prompt)}</span>
        </div>
        <div class="field-group">
          <textarea id="smart-${s.key}" rows="3" placeholder="${esc(s.placeholder)}"></textarea>
        </div>
      </div>`).join('');
  }

  function buildSteps() {
    $('steps-body').innerHTML = Array.from({ length: STEP_COUNT }, (_, i) => `
      <tr>
        <td class="row-num">${i + 1}</td>
        <td><input type="date" id="step-date-${i}" aria-label="Step ${i + 1} target date"></td>
        <td><input type="text" id="step-activity-${i}" placeholder="Describe the activity…" aria-label="Step ${i + 1} activity"></td>
        <td><input type="date" id="step-completed-${i}" aria-label="Step ${i + 1} date completed"></td>
      </tr>`).join('');
  }

  function buildResources() {
    $('resources-body').innerHTML = Array.from({ length: RESOURCE_COUNT }, (_, i) => `
      <tr>
        <td class="row-num">${i + 1}</td>
        <td><input type="text" id="resource-${i + 1}" placeholder="${esc(RESOURCE_HINTS[i] || '')}" aria-label="Resource ${i + 1}"></td>
      </tr>`).join('');
  }

  /* ---------- read the page ---------- */
  function collect() {
    const quarter = val('emp-quarter'), year = val('emp-year');
    const d = {
      name: val('emp-name'),
      initials: val('emp-initials').toUpperCase(),
      entity: val('emp-entity'),
      year,
      quarter: quarter && year ? `${quarter} ${year}` : '',
      supervisorName: val('emp-supervisor'),
      empEmail: val('emp-email'),
      rockTitle: val('rock-title'),
      rockDesc: val('rock-desc'),
      steps: [],
      resources: []
    };
    SMART.forEach((s) => { d[s.key] = val(`smart-${s.key}`); });
    for (let i = 0; i < STEP_COUNT; i++) {
      const date = val(`step-date-${i}`), activity = val(`step-activity-${i}`), completed = val(`step-completed-${i}`);
      if (date || activity) d.steps.push({ num: i + 1, date, activity, completed });
    }
    for (let i = 1; i <= RESOURCE_COUNT; i++) {
      const r = val(`resource-${i}`);
      if (r) d.resources.push(r);
    }
    return d;
  }

  function validate(d) {
    if (!d.name) throw fail('Please enter your name.', 'emp-name');
    if (!d.initials) throw fail('Please enter your initials.', 'emp-initials');
    if (!d.entity) throw fail('Please select your entity.', 'emp-entity');
    if (!val('emp-quarter')) throw fail('Please select a quarter.', 'emp-quarter');
    if (!d.supervisorName) throw fail('Please select your supervisor.', 'emp-supervisor');
    if (!d.empEmail || !$('emp-email').checkValidity()) throw fail('Please enter a valid email address.', 'emp-email');
    if (!d.rockTitle) throw fail('Please enter a short title for your rock.', 'rock-title');
    if (!d.rockDesc) throw fail('Please describe your rock.', 'rock-desc');
    for (const s of SMART) {
      if (!d[s.key]) throw fail(`Please fill in the ${s.label} section.`, `smart-${s.key}`);
    }
    if (d.steps.length < MIN_STEPS) throw fail(`Please enter at least ${MIN_STEPS} next steps.`, 'step-activity-0');
  }

  /* ---------- the email ---------- */
  function buildHtmlEmail(d) {
    const stepsHtml = d.steps.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
        <tr style="background:#f0efe9;">${email.th('#')}${email.th('TARGET DATE')}${email.th('ACTIVITY')}${email.th('COMPLETED')}</tr>
        ${d.steps.map((s) => `<tr>${email.td(s.num)}${email.td(esc(shortDate(s.date)))}${email.td(esc(s.activity))}${email.td(esc(shortDate(s.completed)))}</tr>`).join('')}
       </table>`
      : '<p style="color:#9a9a93;font-size:13px;">No steps entered.</p>';

    const resourcesHtml = d.resources.length
      ? `<div style="margin-bottom:20px;">
        ${email.label('Resources Needed')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
          <tr style="background:#f0efe9;">${email.th('#', 'width:24px;')}${email.th('RESOURCE')}</tr>
          ${d.resources.map((r, i) => `<tr>${email.td(i + 1)}${email.td(esc(r))}</tr>`).join('')}
        </table>
      </div>`
      : '';

    const smartHtml = SMART.map((s) => `
    <div style="margin-bottom:12px;">
      <div style="font-family:Arial,sans-serif;font-size:13px;">
        <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background:#2a5c45;color:white;border-radius:4px;font-size:12px;font-weight:bold;margin-right:6px;">${s.letter}</span>
        <strong>${esc(s.label)}</strong>
      </div>
      <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a18;line-height:1.5;margin-top:4px;padding-left:28px;white-space:pre-wrap;">${d[s.key] ? esc(d[s.key]) : '<span style="color:#9a9a93;">—</span>'}</div>
    </div>`).join('');

    /* The FIELD block below is read by the SharePoint automation.
       Keep its field names and separators exactly as they are. */
    return `
<div style="max-width:680px;margin:0 auto;font-family:Georgia,serif;color:#1a1a18;">
  ${email.header('S.M.A.R.T Rock Planner')}
  ${email.metaTable([['Employee', d.name], ['Entity', d.entity], ['Quarter', d.quarter], ['Supervisor', d.supervisorName], ['Submitted', longDate()]])}

  <div style="background:#f7f6f2;border:1px solid #e2e0d8;border-radius:8px;padding:16px;margin-bottom:16px;">
    <div style="font-size:17px;margin-bottom:4px;"><strong>${esc(d.rockTitle)}</strong></div>
    ${d.rockDesc ? `<div style="font-family:Arial,sans-serif;font-size:13px;color:#5a5a55;line-height:1.5;white-space:pre-wrap;">${esc(d.rockDesc)}</div>` : ''}
  </div>

  <div style="margin-bottom:20px;">
    ${email.label('S.M.A.R.T Check')}
    ${smartHtml}
  </div>

  <div style="margin-bottom:20px;">
    ${email.label('Next Steps')}
    ${stepsHtml}
  </div>

  ${resourcesHtml}

  ${email.footer('This rock planner was submitted via the TSTO S.M.A.R.T Rock Planner digital form. A PDF copy will be saved to SharePoint.')}
</div>

<!-- MACHINE-READABLE BLOCK — DO NOT EDIT BELOW THIS LINE -->
<div style="display:none;">
===ROCK_PLANNER_DATA_START===
FIELD:EmployeeName|${d.name}|||
FIELD:Initials|${d.initials}|||
FIELD:Entity|${d.entity}|||
FIELD:Quarter|${d.quarter}|||
FIELD:Year|${d.year}|||
FIELD:SupervisorName|${d.supervisorName}|||
FIELD:EmployeeEmail|${d.empEmail}|||
FIELD:DateSubmitted|${todayISO()}|||
FIELD:RockTitle|${d.rockTitle}|||
FIELD:RockDescription|${fieldValue(d.rockDesc)}|||
FIELD:Specific|${fieldValue(d.s)}|||
FIELD:Measurable|${fieldValue(d.m)}|||
FIELD:Achievable|${fieldValue(d.a)}|||
FIELD:Relevant|${fieldValue(d.r)}|||
FIELD:TimeFramed|${fieldValue(d.t)}|||
FIELD:Resources|${d.resources.join('<<BR>>')}|||
${d.steps.map((s) => `FIELD:Step${s.num}|${s.date}~~${s.activity.replace(/\r?\n/g, ' ')}~~${s.completed}|||`).join('\n')}
===ROCK_PLANNER_DATA_END===
</div>`;
  }

  async function submit() {
    const d = collect();
    validate(d);
    const sup = supervisorFor(d.supervisorName);

    await sendEmail(CONFIG.EMAILJS.TEMPLATES.COMPLETED_DOCUMENT, {
      supervisor_name: sup.name,
      supervisor_email: sup.email || CONFIG.ADMIN_EMAIL,
      employee_name: d.name,
      employee_email: d.empEmail,
      quarter: d.quarter,
      entity: d.entity,
      completed_data: buildHtmlEmail(d)
    });

    draft.clear();
    showSuccess();
  }

  /* ---------- start ---------- */
  wireEntitySupervisor('emp-entity', 'emp-supervisor');
  fillYears($('emp-year'));
  buildSmart();
  buildSteps();
  buildResources();
  draft.init('tst-rock-planner');
  onSubmit(submit);
})();
