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
    CLIENT_ID: '7c4cb067-9b87-4c5e-b805-fe32ca4c95af',   /* Application (client) ID */
    TENANT_ID: 'd20284df-da44-4c03-9d62-8b531b9bdf6d'    /* Directory (tenant) ID */
  },

  /* The mailbox the SharePoint automation watches. Completed documents are
     copied here. Also the fallback recipient if a supervisor has no email. */
  AUTOMATION_MAILBOX: 'ashley@thespeckledtrout.com',

  /* The shared mailbox every form sends FROM. Everyone who fills in a form
     (staff and invited guests) must have "Send As" permission on it — see
     README.md → Shared mailbox and guests. */
  FORMS_MAILBOX: 'forms@thespeckledtrout.com',

  /* 'shared' = always send from FORMS_MAILBOX (recommended: one sender for the
     automation to trust, and it works for guests without a mailbox).
     'user'   = send from the signed-in person's own mailbox, falling back to
     FORMS_MAILBOX when they don't have one. */
  SEND_FROM: 'shared',

  /* Subject line and extra recipients for each kind of email. The
     supervisor(s) chosen in the form are always in "To".
     {employee} and {quarter} are filled in automatically.
     cc entries: 'automation' = AUTOMATION_MAILBOX, 'employee' = the employee
     the document is about, or any literal email address. */
  MAIL: {
    employeeSubmitted: { subject: '5x5x5 submitted — {employee} — {quarter}',        cc: [] },
    completedReview:   { subject: '5x5x5 completed review — {employee} — {quarter}', cc: ['automation', 'employee'] },
    rockPlanner:       { subject: 'Rock planner — {employee} — {quarter}',           cc: ['automation', 'employee'] },
    rockCompletion:    { subject: 'Rock completion — {employee} — {quarter}',        cc: ['automation', 'employee'] }
  },

  /* TEMPORARY guest access for people who can't sign in with Microsoft yet.
     They enter the team passphrase, fill in the form, and the email goes out
     through EmailJS instead of the shared mailbox.
     Set ENABLED to false to switch it off everywhere.
     - PASSPHRASE_SHA256: the passphrase, hashed. To change it, open any form,
       open the browser console (F12) and run  TST.guest.hash('new phrase')
       then paste the result here.
     - RECAPTCHA_SITE_KEY: optional. Leave blank for no captcha. To add one:
       google.com/recaptcha/admin (v2 checkbox), site key here, and the matching
       SECRET key in each EmailJS template's reCAPTCHA setting. */
  GUEST_ACCESS: {
    ENABLED: true,
    PASSPHRASE_SHA256: '59d7fb5763f95e6bb8556ea91d13a763e89a59730db89994e9da4d1d77753340',
    RECAPTCHA_SITE_KEY: '',
    EMAILJS: {
      PUBLIC_KEY: 'qbm0FluRDbLK432li',
      SERVICE_ID: 'service_x2e8pjc',
      TEMPLATES: {
        EMPLOYEE_SUBMITTED: 'template_vi2f9lt',
        COMPLETED_DOCUMENT: 'template_pz1sj12'
      }
    }
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
