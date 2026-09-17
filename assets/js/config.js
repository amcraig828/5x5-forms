/* ==========================================================================
   config.js — THE ONE FILE TO EDIT when people, entities, or EmailJS change.

   Everything in here is shared by all four forms, so a change made once
   applies everywhere. Keep the punctuation exactly as shown (quotes, commas).
   ========================================================================== */

window.TST_CONFIG = {

  /* Company name shown in the header of every form and email. */
  COMPANY: 'The Speckled Trout Outfitters',

  /* Where the forms are published. Used to build the link a supervisor
     receives by email. No trailing slash. */
  SITE_URL: 'https://amcraig828.github.io/5x5-forms',

  /* EmailJS account settings. The public key is meant to be public — restrict
     it to this site's domain in the EmailJS dashboard (Account → Security). */
  EMAILJS: {
    PUBLIC_KEY: 'qbm0FluRDbLK432li',
    SERVICE_ID: 'service_x2e8pjc',
    TEMPLATES: {
      /* "An employee finished their section" — sent to the supervisor with a link. */
      EMPLOYEE_SUBMITTED: 'template_vi2f9lt',
      /* "A completed document" — carries the full HTML plus the machine-readable
         FIELD block that the Power Automate flow files into SharePoint. Used by
         the supervisor review, rock planner, and rock completion forms. */
      COMPLETED_DOCUMENT: 'template_pz1sj12'
    }
  },

  /* Fallback recipient when a supervisor has no email listed. Also the
     mailbox the SharePoint automation watches. */
  ADMIN_EMAIL: 'ashley@thespeckledtrout.com',

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
