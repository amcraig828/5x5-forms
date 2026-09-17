# TST EOS Forms

Four browser-based forms for The Speckled Trout Outfitters' EOS process, hosted on
GitHub Pages at **https://amcraig828.github.io/5x5-forms/**. There is no server: each
form runs entirely in the browser and sends its results by email through EmailJS. A
Power Automate flow watches that mailbox and files each submission into SharePoint.

| Page | Who uses it | What happens on submit |
|---|---|---|
| `index.html` | Everyone | Landing page linking to the forms below |
| `5x5-employee.html` | Employee, before the quarterly meeting | Emails the supervisor a link to the review page. The link carries the employee's answers. |
| `5x5-supervisor.html` | Supervisor, opened from that email link | Emails the completed review (readable HTML + machine-readable block) for filing in SharePoint |
| `rock-planner.html` | Employee, start of quarter | Emails the plan (readable HTML + machine-readable block) |
| `rock-completion.html` | Employee, end of quarter | Emails the report (readable HTML + machine-readable block) |

## Making everyday changes

**People, entities, email addresses** → edit `assets/js/config.js`. That is the only
file that needs to change when a supervisor joins or leaves, an entity is renamed, or
the EmailJS account changes. Each form reads from it, so the change applies everywhere.

**Wording of the 5×5×5 questions** (core values, health-check statements, discussion
questions) → edit `assets/js/5x5-content.js`. Keep the `key` values as they are; the
SharePoint automation uses them.

**Anything else on a page** (headings, helper text, the success message) → edit that
page's `.html` file directly. The text is plain HTML.

To publish, commit to the `main` branch. GitHub Pages redeploys within a minute or two.
Hard-refresh the page (Shift + reload) if you don't see the change.

## How the pieces fit

```
index.html, *.html        page structure and static text only
assets/css/forms.css      one stylesheet shared by every page
assets/js/config.js       people, entities, EmailJS IDs   ← edit this
assets/js/5x5-content.js  5×5×5 question wording          ← and this
assets/js/shared.js       helpers every page uses (rating buttons, validation,
                          draft autosave, email sending, link encoding)
assets/js/<page>.js       the logic for one page
assets/vendor/            lz-string (compresses the supervisor link)
.nojekyll                 tells GitHub Pages to serve files as-is
```

### Email templates (EmailJS)

Two templates, both in the `service_x2e8pjc` service:

| Template | Sent by | Variables it receives |
|---|---|---|
| `template_vi2f9lt` "employee submitted" | 5×5 employee form | `supervisor_name`, `supervisor_email`, `employee_name`, `employee_email`, `quarter`, `supervisor_link`, `employee_summary` |
| `template_pz1sj12` "completed document" | Supervisor review, rock planner, rock completion | `supervisor_name`, `supervisor_email`, `employee_name`, `employee_email`, `quarter`, `entity`, `completed_data` (HTML) |

The EmailJS public key is safe to have in the page — that is how EmailJS works — but
turn on the domain allowlist in the EmailJS dashboard (Account → Security) so only
`amcraig828.github.io` can use it.

### The SharePoint automation contract

`completed_data` ends with a hidden block that the Power Automate flow parses:

```
FIELD:<name>|<value>|||
```

Field names and separators must not change without also updating the flow. They are
built in `assets/js/supervisor.js`, `rock-planner.js` and `rock-completion.js`, each
marked with a "MACHINE-READABLE BLOCK" comment. Multi-line values use `<<BR>>` for line
breaks, and `|` inside a value is replaced with `/`.

### The supervisor link

The employee form does not store anything on a server. It packs the answers into the
URL of the supervisor page, compressed with lz-string so the link stays short enough for
email clients (roughly 2,000 characters for a typical submission). The supervisor page
also still accepts the older, longer `?data=` base64 links.

## Behaviour worth knowing

- **Drafts** are saved automatically in the browser (localStorage) as people type, and
  restored if they come back to the page. They are cleared on a successful submit. A
  "Start over" link appears when a draft is restored.
- **If an email fails to send**, the form says so and keeps the answers on screen. The
  employee form also shows the supervisor link so it can be copied and sent by hand.
- **Validation** highlights the first missing field and explains what is needed.
- **Supervisor page without data** shows an explanation instead of an empty form.
  Append `?sample=1` to preview it with made-up answers.

## Testing a change locally

Open any `.html` file straight from disk in a browser, or run a tiny web server from
the repo folder so relative links behave exactly as they do on GitHub Pages:

```
python3 -m http.server 8000
# then visit http://localhost:8000/
```

Submitting from a local copy sends real email through EmailJS, so use your own address
as the employee email and pick yourself as supervisor when trying it out.
