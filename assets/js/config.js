/* ==========================================================================
   config.js — THE ONE FILE TO EDIT when people, entities, or sign-in change.

   Everything in here is shared by all four forms, so a change made once
   applies everywhere. Keep the punctuation exactly as shown (quotes, commas).
   ========================================================================== */

window.TST_CONFIG = {

  /* Company name shown in the header of every form and email. */
  COMPANY: 'The Speckled Trout Outfitters',

  /* Where the forms are published. Used to build the link a supervisor
     receives by email when the form is opened from a local file. No trailing slash. */
  SITE_URL: 'https://amcraig828.github.io/5x5-forms',

  /* Microsoft sign-in. Both values come from the "TST EOS Forms" app
     registration in Microsoft Entra — see README.md → Microsoft sign-in setup.
     Until they are filled in, every form shows a "sign-in not set up" message. */
  AUTH: {
    CLIENT_ID: '7a6f5061-edaa-419a-a801-c65026df568b',   /* Application (client) ID */
    TENANT_ID: 'd6932ffa-589a-479b-a3c3-ad004a2167a7'    /* Directory (tenant) ID */
  },

  /* The mailbox the SharePoint automation watches. Completed documents are
     copied here. Also the fallback recipient if a supervisor has no email. */
  AUTOMATION_MAILBOX: 'ashley@thespeckledtrout.com',

  /* Subject line and extra recipients for each kind of email. The employee
     who submits is always the sender; the supervisor(s) are always in "To".
     {employee} and {quarter} are filled in automatically.
     cc entries: 'automation' = AUTOMATION_MAILBOX, 'employee' = the employee
     the document is about, or any literal email address. */
  MAIL: {
    employeeSubmitted: { subject: '5x5x5 submitted — {employee} — {quarter}',        cc: [] },
    completedReview:   { subject: '5x5x5 completed review — {employee} — {quarter}', cc: ['automation', 'employee'] },
    rockPlanner:       { subject: 'Rock planner — {employee} — {quarter}',           cc: ['automation'] },
    rockCompletion:    { subject: 'Rock completion — {employee} — {quarter}',        cc: ['automation'] }
  },

  /* Supervisors. The key is the label people pick in the dropdown.
     `email` may list several addresses separated by commas. */
  SUPERVISORS: {
    'Will Brinker': {
      name: 'Will',
      email: 'william@thespeckledtrout.com'
    },
    'Joe Lynch / Phillip Jamison': {
      name: 'Joe / Phillip',
      email: 'joe@thespeckledtrout.com,phillip@thespeckledtrout.com'
    },
    'Emily / Erica Brinker': {
      name: 'Emily / Erica',
      email: 'erica@thespeckledtrout.com,emily@thespeckledtrout.com'
    }
  },

  /* Entities, in the order they appear in the dropdown, and which
     supervisors each one offers. Names must match the SUPERVISORS keys above. */
  ENTITIES: [
    { name: 'TST Outfitters',               supervisors: ['Will Brinker', 'Joe Lynch / Phillip Jamison'] },
    { name: 'TST Outpost',                  supervisors: ['Emily / Erica Brinker'] },
    { name: 'TST Restaurant & Bottle Shop', supervisors: ['Emily / Erica Brinker'] },
    { name: 'TST Umbrella (EPS)',           supervisors: ['Emily / Erica Brinker'] }
  ]
};
