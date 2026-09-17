# TST EOS Forms

Four browser-based forms for The Speckled Trout Outfitters' EOS process, hosted on
GitHub Pages at **https://amcraig828.github.io/5x5-forms/**. There is no server. Each
form runs in the browser; the person filling it in signs in with their Speckled Trout
Microsoft account, and the form sends the result as an email **from their own mailbox**
to their supervisor (and, for completed documents, to the automation mailbox that files
them into SharePoint).

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

1. Go to **entra.microsoft.com** → Identity → Applications → **App registrations** → **New registration**.
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
3. **API permissions** → Add a permission → Microsoft Graph → **Delegated** → tick `Mail.Send` and `User.Read` → Add.
   Then click **Grant admin consent for <tenant>** so staff never see a consent prompt.
4. **Overview** → copy the **Application (client) ID** and **Directory (tenant) ID** into
   `assets/js/config.js` under `AUTH`, commit, push.
5. Optional but recommended: **Enterprise applications** → TST EOS Forms → **Properties** →
   *Assignment required?* = **Yes**, then under **Users and groups** assign the staff group.
   From then on, who can open the forms is managed in Microsoft 365, not in code.

What staff see: the first time they open a form they click **Sign in with Microsoft**
(usually just a click, since they're already signed in to Microsoft 365 in the browser).
After that it's silent. Their name and email fill in automatically. Every submission is
saved in their own **Sent Items**, which doubles as a record.

## How the pieces fit

```
index.html, *.html        page structure and static text only
assets/css/forms.css      one stylesheet shared by every page
assets/js/config.js       people, entities, subjects, sign-in IDs   ← edit this
assets/js/5x5-content.js  5×5×5 question wording                    ← and this
assets/js/shared.js       helpers every page uses (rating buttons, validation,
                          draft autosave, sending mail via Graph, link encoding)
assets/js/auth.js         Microsoft sign-in (MSAL.js) and the sign-in screen
assets/js/<page>.js       the logic for one page
assets/vendor/            lz-string (compresses the supervisor link)
tests/e2e.js              browser tests (see Testing)
.nojekyll                 tells GitHub Pages to serve files as-is
```

### Emails

Each form sends one email through Microsoft Graph (`POST /me/sendMail`) as the
signed-in user. `CONFIG.MAIL` in `config.js` sets the subject line and extra
recipients per form; the supervisor(s) chosen in the form are always the "To".

| Form | `x-tst-form` header | Default subject | To | CC |
|---|---|---|---|---|
| 5×5 employee | `5x5-employee` | `5x5x5 submitted — {employee} — {quarter}` | supervisor | — |
| 5×5 supervisor | `5x5-completed` | `5x5x5 completed review — {employee} — {quarter}` | supervisor | automation mailbox, employee |
| Rock planner | `rock-planner` | `Rock planner — {employee} — {quarter}` | supervisor | automation mailbox |
| Rock completion | `rock-completion` | `Rock completion — {employee} — {quarter}` | supervisor | automation mailbox |

Every message carries a custom `x-tst-form` mail header naming the form. That header plus
an internal sender address is how the mailbox automation should recognise a genuine
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

1. **Only treat a message as a form submission when both are true:** the sender address is
   `@thespeckledtrout.com` **and** the `x-tst-form` header is present (or, if headers are
   not available to the agent, the subject matches one of the patterns above exactly).
   Everything else is ordinary mail, never a form.
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
