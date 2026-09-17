/* ==========================================================================
   5x5-content.js — the questions on the 5×5×5 Quarterly Conversation.

   Shared by the employee form and the supervisor review so both always show
   the same wording. Edit text freely; keep the `key` values unchanged because
   the SharePoint automation reads them.
   ========================================================================== */

window.TST_5X5 = {

  CORE_VALUES: ['Community', 'Integrity', 'Authenticity', 'Fun', 'Stewardship', 'Excellence'],

  HEALTH_CATEGORIES: [
    { key: 'belonging', label: 'Belonging', items: [
      'I feel a genuine sense of belonging with my team and coworkers.',
      'I can be myself at work without fear of judgment.',
      'I have at least one coworker I trust and can talk to openly.'
    ]},
    { key: 'inspired', label: 'Inspired', items: [
      "I am inspired by our company's purpose, vision, and values.",
      'I believe the organization is heading in the right direction.',
      'I am proud of the work we do and the impact it creates.'
    ]},
    { key: 'trusted', label: 'Trusted', items: [
      'My leader communicates expectations clearly and follows through.',
      'I feel comfortable giving upward feedback and voicing concerns.',
      'I believe our leadership team is authentic and transparent.'
    ]},
    { key: 'empowered', label: 'Empowered', items: [
      'I have the tools, training, and authority to do my job well.',
      'I can make decisions that impact my work and outcomes.',
      "I'm encouraged to think independently and take initiative."
    ]},
    { key: 'accountable', label: 'Accountable', items: [
      'I understand my role and how success is measured.',
      'My team holds each other accountable with respect and fairness.',
      'I consistently receive feedback that helps me improve.'
    ]},
    { key: 'measured', label: 'Measured', items: [
      'I know the key metrics that define success for my role.',
      'Our team reviews measurable progress regularly.',
      'I see how my work connects to company goals and results.'
    ]},
    { key: 'balanced', label: 'Balanced', items: [
      'I can maintain a healthy work-life balance.',
      'I feel supported in managing personal commitments.',
      'I can recharge and return to work refreshed.'
    ]}
  ],

  DISCUSSION_QUESTIONS: [
    'What is your most important topic for us to discuss today?',
    'What do you think you are doing well / succeeding in?',
    'What is your biggest struggle?',
    'Where / how do you think you can improve?',
    'What is one thing leadership is doing well?',
    'What is something leadership can improve on?',
    'Is there anything you need from leadership to do your job better?',
    'Do you see any inconsistencies at the company between the stated VVM and the way the company operates?',
    'Define or describe what success looks like to you.'
  ],

  /* How many discussion questions an employee must answer. */
  MIN_QUESTIONS: 2,

  /* How many seat rows the employee form shows. */
  SEAT_ROWS: 4,

  /* How many rock rows the employee form starts with (more can be added). */
  INITIAL_ROCK_ROWS: 3
};
