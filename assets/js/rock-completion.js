/* rock-completion.html — end-of-quarter report on one rock.
   On submit it emails a formatted copy plus a machine-readable FIELD block
   that the Power Automate flow files into SharePoint. */
(function () {
  'use strict';

  const { $, val, esc, wireEntitySupervisor, fillYears, onSubmit, sendMail,
          showSuccess, fail, draft, email, fieldValue, todayISO, longDate } = TST;

  const completeValue = () => { const r = document.querySelector('input[name="complete"]:checked'); return r ? r.value : ''; };

  function toggleExplain() {
    $('explain-wrap').classList.toggle('open', completeValue() === 'No');
  }

  /* ---------- read the page ---------- */
  function collect() {
    const quarter = val('emp-quarter'), year = val('emp-year');
    return {
      name: val('emp-name'),
      initials: val('emp-initials').toUpperCase(),
      entity: val('emp-entity'),
      year,
      quarter: quarter && year ? `${quarter} ${year}` : '',
      supervisorName: val('emp-supervisor'),
      empEmail: val('emp-email'),
      rockTitle: val('rock-title'),
      isComplete: completeValue(),
      explain: val('explain'),
      accomplishments: [val('accomplish-1'), val('accomplish-2'), val('accomplish-3')],
      nextSteps: [val('nextstep-1'), val('nextstep-2'), val('nextstep-3')]
    };
  }

  function validate(d) {
    if (!d.name) throw fail('Please enter your name.', 'emp-name');
    if (!d.initials) throw fail('Please enter your initials.', 'emp-initials');
    if (!d.entity) throw fail('Please select your entity.', 'emp-entity');
    if (!val('emp-quarter')) throw fail('Please select a quarter.', 'emp-quarter');
    if (!d.supervisorName) throw fail('Please select your supervisor.', 'emp-supervisor');
    if (!d.empEmail || !$('emp-email').checkValidity()) throw fail('Please enter a valid email address.', 'emp-email');
    if (!d.rockTitle) throw fail('Please enter your rock title.', 'rock-title');
    if (!d.isComplete) throw fail('Please indicate whether your rock is complete or on track.');
    if (d.isComplete === 'No' && !d.explain) throw fail('Please explain what prevented completion.', 'explain');
    if (!d.accomplishments[0]) throw fail('Please enter at least one accomplishment.', 'accomplish-1');
  }

  /* ---------- the email ---------- */
  function buildHtmlEmail(d) {
    const accomplishments = d.accomplishments.filter(Boolean);
    const nextSteps = d.nextSteps.filter(Boolean);
    const done = d.isComplete === 'Yes';
    const list = (items) => `<ul style="font-family:Arial,sans-serif;font-size:13px;line-height:1.8;padding-left:20px;">${items.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;

    /* The FIELD block below is read by the SharePoint automation.
       Keep its field names and separators exactly as they are. */
    return `
<div style="max-width:680px;margin:0 auto;font-family:Georgia,serif;color:#1a1a18;">
  ${email.header('Quarterly Rock Completion')}
  ${email.metaTable([['Employee', d.name], ['Entity', d.entity], ['Quarter', d.quarter], ['Supervisor', d.supervisorName], ['Submitted', longDate()]])}

  <div style="background:#f7f6f2;border:1px solid #e2e0d8;border-radius:8px;padding:16px;margin-bottom:16px;">
    <div style="font-size:17px;margin-bottom:8px;"><strong>${esc(d.rockTitle)}</strong></div>
    <div style="display:inline-block;padding:4px 12px;border-radius:4px;background:${done ? '#e8f0ec' : '#f5ece8'};color:${done ? '#2a5c45' : '#8c4a1a'};font-family:Arial,sans-serif;font-size:12px;font-weight:bold;text-transform:uppercase;">
      ${done ? '✓ Complete / On Track' : '✗ Not Complete'}
    </div>
  </div>

  ${done ? '' : `
  <div style="margin-bottom:16px;">
    ${email.label('What Prevented Completion')}
    <div style="font-family:Arial,sans-serif;font-size:13px;line-height:1.5;white-space:pre-wrap;">${esc(d.explain)}</div>
  </div>`}

  <div style="margin-bottom:16px;">
    ${email.label('What Was Accomplished')}
    ${list(accomplishments)}
  </div>

  ${nextSteps.length ? `
  <div style="margin-bottom:16px;">
    ${email.label('Next Steps / Follow-Ups')}
    ${list(nextSteps)}
  </div>` : ''}

  ${email.footer('This report was submitted via the TSTO Quarterly Rock Completion digital form. A Word doc copy will be saved to SharePoint.')}
</div>

<!-- MACHINE-READABLE BLOCK — DO NOT EDIT BELOW THIS LINE -->
<div style="display:none;">
===ROCK_COMPLETION_DATA_START===
FIELD:FormType|RockCompletion|||
FIELD:EmployeeName|${d.name}|||
FIELD:Initials|${d.initials}|||
FIELD:Entity|${d.entity}|||
FIELD:Quarter|${d.quarter}|||
FIELD:Year|${d.year}|||
FIELD:SupervisorName|${d.supervisorName}|||
FIELD:EmployeeEmail|${d.empEmail}|||
FIELD:DateSubmitted|${todayISO()}|||
FIELD:RockTitle|${d.rockTitle}|||
FIELD:IsComplete|${d.isComplete}|||
FIELD:ExplainIncomplete|${fieldValue(d.explain)}|||
FIELD:Accomplish1|${d.accomplishments[0]}|||
FIELD:Accomplish2|${d.accomplishments[1]}|||
FIELD:Accomplish3|${d.accomplishments[2]}|||
FIELD:NextStep1|${d.nextSteps[0]}|||
FIELD:NextStep2|${d.nextSteps[1]}|||
FIELD:NextStep3|${d.nextSteps[2]}|||
===ROCK_COMPLETION_DATA_END===
</div>`;
  }

  async function submit() {
    const d = collect();
    validate(d);
    await sendMail({
      kind: 'rockCompletion', formType: 'rock-completion',
      employee: d.name, employeeEmail: d.empEmail, quarter: d.quarter, supervisorName: d.supervisorName,
      html: buildHtmlEmail(d),
      extra: { entity: d.entity }   /* used by the guest (EmailJS) path only */
    });

    draft.clear();
    showSuccess();
  }

  /* ---------- start (once signed in) ---------- */
  function init(me) {
    wireEntitySupervisor('emp-entity', 'emp-supervisor');
    fillYears($('emp-year'));
    document.querySelectorAll('input[name="complete"]').forEach((r) => r.addEventListener('change', toggleExplain));
    if (me.name) $('emp-name').value = me.name;
    draft.init('tst-rock-completion');
    if (!me.guest) {   /* guests type their own; staff send from their account */
      $('emp-email').value = me.email;
      $('emp-email').readOnly = true;
    }
    toggleExplain();
    onSubmit(submit);
  }
  TST.auth.ready.then(init);
})();
