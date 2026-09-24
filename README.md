# TST EOS Forms

Four browser-based forms for The Speckled Trout Outfitters' EOS process, hosted on
GitHub Pages at **https://amcraig828.github.io/5x5-forms/**. There is no server. Each
form runs in the browser; the person filling it in signs in with Microsoft (a Speckled
Trout account, or a guest invitation for people without one), and the form sends the
result as an email **from the shared forms mailbox** to their supervisor (and, for
completed documents, to the automation mailbox that files them into SharePoint).

| Page | Who uses it | What happens on submit |
|---|---|---|
| `index.html` | Everyone | Landing page linking to the forms below |
| `5x5-employee.html` | Employee, before the quarterly meeting | Emails the supervisor a link to the review page. The link carries the employee's answers. |
| `5x5-supervisor.html` | Supervisor, opened from that email link | Emails the completed review (readable HTML + machine-readable block) to the supervisor, the employee, and the automation mailbox |
| `rock-planner.html` | Employee, start of quarter | Emails the plan (readable HTML + machine-readable block) to the supervisor and the automation mailbox |
| `rock-completion.html` | Employee, end of quarter | Emails the report (readable HTML + machine-readable block) to the supervisor and the automation mailbox |

## Making everyday changes

**People, entities, email subjects, sign-in IDs** → edit `assets/js/config.js`. That is
the only file that needs to change when a supervisor joins or leaves, an entity is renamed,
or the Microsoft app registration changes. Each form reads from it, so the change applies
everywhere.

**Wording of the 5×5×5 questions** (core values, health-check statements, discussion
questions) → edit `assets/js/5x5-content.js`. Keep the `key` values as they are; the
SharePoint automation uses them.

**Anything else on a page** (headings, helper text, the success message) → edit that
page's `.html` file directly. The text is plain HTML.

To publish, commit to the `main` branch. GitHub Pages redeploys within a minute or two.
Hard-refresh the page (Shift + reload) if you don't see the change.

## Microsoft sign-in setup (one time, by a Microsoft 365 admin)

The forms will show "Sign-in has not been set up" until this is done.

1. Go to **entra.microsoft.com** and open **App registrations** (search for it in the top search box if it isn't in the left menu, or expand **Applications**). Click **New registration**.
   - Name: `TST EOS Forms`
   - Supported account types: **Accounts in this organizational directory only** (single tenant)
   - Redirect URI: platform **Single-page application (SPA)**, URI `https://amcraig828.github.io/5x5-forms/5x5-employee.html`
   - Register.
2. **Authentication** → under Single-page application, **Add URI** for each of the other pages:
   - `https://amcraig828.github.io/5x5-forms/5x5-supervisor.html`
   - `https://amcraig828.github.io/5x5-forms/rock-planner.html`
   - `https://amcraig828.github.io/5x5-forms/rock-completion.html`
   - For local testing also add `http://localhost:8000/5x5-employee.html` (and the other three at `http://localhost:8000/…`).
   - Save.
3. **API permissions** → Add a permission → Microsoft Graph → **Delegated** → tick `Mail.Send`, `Mail.Send.Shared`, `User.Read` and `email` → Add.
   Then click **Grant admin consent for <tenant>** so staff never see a consent prompt.
4. **Overview** → copy the **Application (client) ID** and **Directory (tenant) ID** into
   `assets/js/config.js` under `AUTH`, commit, push.
5. Optional but recommended: **Enterprise applications** → TST EOS Forms → **Properties** →
   *Assignment required?* = **Yes**, then under **Users and groups** assign the staff group.
   From then on, who can open the forms is managed in Microsoft 365, not in code.

What staff see: the first time they open a form they click **Sign in with Microsoft**
(usually just a click, since they're already signed in to Microsoft 365 in the browser).
After that it's silent. Their name and email fill in automatically.

## Shared mailbox and guests (one time, by a Microsoft 365 admin)

Every form sends from one shared mailbox, `forms@thespeckledtrout.com` (`FORMS_MAILBOX`
in `config.js`). That gives the automation a single sender to trust, and it lets people
who don't have a Speckled Trout mailbox submit too. Its **Sent Items** folder is the
record of everything submitted.

1. **Create the shared mailbox.** Exchange admin center (admin.exchange.microsoft.com) →
   Recipients → **Mailboxes** → **Add a shared mailbox** → name `TST Forms`, email
   `forms@thespeckledtrout.com`. Shared mailboxes are free; no license is needed.
2. **Create a group that is allowed to send as it.** Exchange admin center → Recipients →
   **Groups** → **Add a group** → type **Mail-enabled security** → name `TST Forms Senders`.
3. **Grant the group Send As.** Open the `TST Forms` mailbox → **Delegation** → *Send as*
   → **Edit** → add `TST Forms Senders` → Save. (PowerShell equivalent:
   `Add-RecipientPermission forms@thespeckledtrout.com -AccessRights SendAs -Trustee "TST Forms Senders"`.)
4. **Add everyone who fills in forms to that group** (staff and guests). Exchange permission
   changes can take up to an hour to apply.
5. **People without a Speckled Trout account:** invite them as guests. Entra admin center →
   Users → **New user** → **Invite external user** → their personal email → Invite. They
   accept the invitation once by email, then sign in to the forms with that address. Then
   add them to `TST Forms Senders` too.

If someone gets "Your account is not allowed to send as forms@…" on submit, they are not
in the group yet (or the change hasn't propagated).

### Adding a person (day-to-day checklist)

Whoever manages the forms needs two Entra roles: **Guest Inviter** (to invite people
without a company account) and **Exchange Recipient Administrator** (to manage the
`TST Forms Senders` group). Then, for each new person:

1. **Has a thespeckledtrout.com account?** Skip to step 3.
2. **No company account:** Entra admin center (entra.microsoft.com) → Users → **New user**
   → **Invite external user** → their personal email → Invite. Ask them to accept the
   invitation email; they then sign in to the forms with that same address.
3. Exchange admin center (admin.exchange.microsoft.com) → Recipients → **Groups** →
   `TST Forms Senders` → **Members** → Add. Guests appear in the picker only after they
   have accepted their invitation.
4. Tell them the link: https://amcraig828.github.io/5x5-forms/. Allow up to an hour before
   their first submit for the permission to apply.

When someone leaves, remove them from the group (and delete the guest account if they had one).

`SEND_FROM` in `config.js` can be switched to `'user'` to send from each person's own
mailbox instead, falling back to the shared mailbox for people who don't have one. The
default `'shared'` is simpler for the automation.

## Temporary guest access (people who can't sign in yet)

While guest invitations are being sorted out, the three employee-facing forms offer a
second door: a small "Don't have a Speckled Trout account?" link under the sign-in button.
The person enters the **team passphrase**, fills in the form (typing their own name and
email), ticks **"I'm not a robot"** next to the submit button, and the email is sent through
**EmailJS** instead of the shared mailbox. The supervisor review never offers this.

This is deliberately the weaker path: the passphrase can be shared, and the only check a
computer can't fake is the reCAPTCHA, which EmailJS verifies on its servers. Turn it off
(`GUEST_ACCESS.ENABLED: false` in `config.js`) as soon as everyone can sign in.

Setup (one time):

1. Create reCAPTCHA keys at https://www.google.com/recaptcha/admin/create — type
   **Challenge (v2) → "I'm not a robot" checkbox**, domains `amcraig828.github.io` and
   `localhost`. You get a **site key** and a **secret key**.
2. Put the site key in `config.js` → `GUEST_ACCESS.RECAPTCHA_SITE_KEY`. The guest link
   stays hidden until this is filled in.
3. In EmailJS (dashboard.emailjs.com) → Email Templates → open `template_vi2f9lt` →
   Settings → **reCAPTCHA** → enable and paste the **secret** key → Save. Repeat for
   `template_pz1sj12`. From then on EmailJS refuses sends without a solved captcha.
4. Optional but recommended, so guest emails look the same as everyone else's: in each
   template set **To** = `{{supervisor_email}}`, **Cc** = `{{cc_email}}`,
   **Subject** = `{{subject}}`, and body = `{{{completed_data}}}` (triple braces).
5. Still in EmailJS → Account → Security: keep the domain allow-list on for
   `amcraig828.github.io`.

Changing the passphrase: open any form, press F12 for the browser console, run
`TST.guest.hash('new phrase')` and paste the result into `PASSPHRASE_SHA256`.

Mailbox agent note: guest submissions arrive from the EmailJS sending address without the
`x-tst-*` headers, so the agent must also accept mail from that address whose subject
matches the patterns above, for as long as guest access is on.

## How the pieces fit

```
index.html, *.html        page structure and static text only
assets/css/forms.css      one stylesheet shared by every page
assets/js/config.js       people, entities, subjects, sign-in IDs   ← edit this
assets/js/5x5-content.js  5×5×5 question wording                    ← and this
assets/js/shared.js       helpers every page uses (rating buttons, validation,
                          draft autosave, sending mail via Graph, link encoding)
assets/js/auth.js         Microsoft sign-in (MSAL.js), the sign-in screen, guest passphrase
assets/js/<page>.js       the logic for one page
assets/vendor/            lz-string (compresses the supervisor link)
tests/e2e.js              browser tests (see Testing)
.nojekyll                 tells GitHub Pages to serve files as-is
```

### Emails

Each form sends one email through Microsoft Graph from the shared forms mailbox
(`POST /users/forms@thespeckledtrout.com/sendMail`, authorised by the signed-in person's
Send As permission). `CONFIG.MAIL` in `config.js` sets the subject line and extra
recipients per form; the supervisor(s) chosen in the form are always the "To".

| Form | `x-tst-form` header | Default subject | To | CC |
|---|---|---|---|---|
| 5×5 employee | `5x5-employee` | `5x5x5 submitted — {employee} — {quarter}` | supervisor | — |
| 5×5 supervisor | `5x5-completed` | `5x5x5 completed review — {employee} — {quarter}` | supervisor | automation mailbox, employee |
| Rock planner | `rock-planner` | `Rock planner — {employee} — {quarter}` | supervisor | automation mailbox |
| Rock completion | `rock-completion` | `Rock completion — {employee} — {quarter}` | supervisor | automation mailbox |

Every message carries two custom mail headers: `x-tst-form` naming the form, and
`x-tst-submitted-by` with the email address of the person who was signed in. Those headers
plus the `forms@` sender address are how the mailbox automation should recognise a genuine
submission (see the next two sections).

### The SharePoint automation contract

Completed-document emails end with a hidden block that the automation parses:

```
FIELD:<name>|<value>|||
```

Field names and separators must not change without also updating the automation. They are
built in `assets/js/supervisor.js`, `rock-planner.js` and `rock-completion.js`, each
marked with a "MACHINE-READABLE BLOCK" comment. Multi-line values use `<<BR>>` for line
breaks, and `|` inside a value is replaced with `/`.

### Hardening the mailbox agent (for whoever runs it)

The point of requiring sign-in is that only people in the company tenant can produce these
emails. To get the full benefit, the agent that reads the automation mailbox should:

1. **Only treat a message as a form submission when both are true:** the sender is
   `forms@thespeckledtrout.com` **and** the `x-tst-form` header is present (or, if headers
   are not available to the agent, the subject matches one of the patterns above exactly).
   Everything else is ordinary mail, never a form. The `x-tst-submitted-by` header says who
   was signed in when it was sent.
2. **Extract the `FIELD:` block with a fixed parser before anything reaches the model.**
   Give the model structured fields, not the raw email body. If the block is missing or
   malformed, stop and flag it for a human rather than asking the model to "figure it out".
3. **Treat free-text fields as data, not instructions.** Answers to discussion questions,
   supervisor notes, rock descriptions and similar are typed by people. Wrap them in clear
   delimiters when they are shown to the model and tell it explicitly that nothing inside
   those delimiters is an instruction. Best of all is filing the document without any model
   reasoning over the free text.
4. **Do not follow links** in these emails, except that the 5×5 employee notification
   contains one review link which always starts with `https://amcraig828.github.io/5x5-forms/`.

Sign-in removes outsiders. Rules 2 and 3 are what protect against a careless or malicious
insider, and against ordinary emails that happen to look like forms.

### The supervisor link

The employee form does not store anything on a server. It packs the answers into the
URL of the supervisor page, compressed with lz-string so the link stays short enough for
email clients (roughly 2,000 characters for a typical submission). The supervisor page
also still accepts the older, longer `?data=` base64 links. Opening the link requires
sign-in like every other page; if the signed-in person isn't the supervisor it was
addressed to, the page says so but still lets them complete it.

## Behaviour worth knowing

- **Drafts** are saved automatically in the browser (localStorage) as people type, and
  restored if they come back to the page. They are cleared on a successful submit. A
  "Start over" link appears when a draft is restored.
- **If an email fails to send**, the form says so and keeps the answers on screen. The
  employee form also shows the supervisor link so it can be copied and sent by hand. If
  the Microsoft session has expired, the page sends the person through sign-in and back;
  their draft is waiting when they return.
- **Validation** highlights the first missing field and explains what is needed.
- **Supervisor page without data** shows an explanation instead of an empty form.
  Append `?sample=1` to preview it with made-up answers.
- **"Not you?"** next to the signed-in name signs out, for shared computers.
- **Guests** (people invited with a personal email) see their personal address as their
  email on the form; that is where a supervisor's reply goes.
- **Passphrase guests** (temporary guest access) stay unlocked for the browser tab's
  session; "Sign in instead" in the header clears it.

## Testing

Browser tests live in `tests/e2e.js`. They serve the repo locally, sign in with a fake
account, intercept the Graph `sendMail` call, and check every page including the exact
`FIELD:` blocks.

```
npm install          # once; installs Playwright
npx playwright install chromium   # once; or set PW_CHANNEL=chrome to use installed Chrome
npm test
```

To try a page by hand, run `npm run serve` (or `python3 -m http.server 8000`) in the repo
folder and open `http://localhost:8000/`. Sign-in works locally only if the localhost
redirect URIs from the setup steps are registered. Submitting sends real email from your
account, so pick yourself as supervisor when experimenting.
