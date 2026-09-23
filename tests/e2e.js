/* End-to-end checks for the forms. Serves the repo, signs in with a fake user,
   stubs the Microsoft Graph sendMail endpoint, walks through each page, and
   reports console/page errors.   Run: npm test   (PW_CHANNEL=chrome to use installed Chrome) */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); console.log((cond ? '  ok   ' : '  FAIL ') + msg); };
const EMPLOYEE = { name: 'Test Person', email: 'test@thespeckledtrout.com' };
const SUPERVISOR = { name: 'Erica Brinker', email: 'erica@thespeckledtrout.com' };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

  /* A context signed in as `who`. Graph sendMail is captured into `sent`. */
  const sent = [];
  let failNext = false;
  let noMailbox = false;   // when true, /me/sendMail answers 404 like an account without a mailbox
  async function signedInContext(who, viewport = { width: 1000, height: 900 }) {
    const ctx = await browser.newContext({ viewport });
    await ctx.addInitScript((u) => { window.__TST_FAKE_USER = u; }, who);
    await ctx.route('**/@azure/msal-browser/**', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.msal = {};' }));
    await ctx.route('**/graph.microsoft.com/v1.0/**/sendMail', (route) => {
      const req = route.request();
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const url = req.url();
      sent.push({ url, auth: req.headers().authorization, body: JSON.parse(req.postData()) });
      if (noMailbox && url.includes('/me/sendMail')) return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: { code: 'MailboxNotEnabledForRESTAPI', message: 'The mailbox is either inactive, soft-deleted, or is hosted on-premise.' } }) });
      if (failNext) { failNext = false; return route.fulfill({ status: 500, headers: cors, body: '{}' }); }
      route.fulfill({ status: 202, headers: cors, body: '' });
    });
    return ctx;
  }
  const errors = [];
  let expectingFailure = false;   // set around the deliberate failed-send test
  function watch(page) {
    page.on('console', (m) => { if (m.type() === 'error' && !expectingFailure) errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('sendMail')) errors.push(`http ${r.status()}: ${r.url()}`); });
  }
  const lastMail = () => sent[sent.length - 1].body.message;
  /* Click submit, then wait until the page shows `outcome` (a selector). */
  async function submit(p, outcome) { await p.click('#submit-btn'); await p.locator(outcome).first().waitFor({ state: 'visible', timeout: 15000 }); }
  const addrs = (list) => (list || []).map((r) => r.emailAddress.address);
  const header = (m) => (m.internetMessageHeaders || []).find((h) => h.name === 'x-tst-form');

  /* Serve config.js with some keys overridden, so tests don't depend on the shipped values. */
  const configWith = (overrides) => async (route) => {
    const body = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8') + `\nObject.assign(window.TST_CONFIG, ${JSON.stringify(overrides)});\n`;
    route.fulfill({ contentType: 'application/javascript', body });
  };
  const configWithAuth = (auth) => configWith({ AUTH: auth });

  // ---- sign-in gate: IDs not configured ----
  console.log('sign-in gate');
  {
    const ctx = await browser.newContext();
    await ctx.route('**/assets/js/config.js', configWithAuth({ CLIENT_ID: '', TENANT_ID: '' }));
    await ctx.route('**/@azure/msal-browser/**', (route) => route.fulfill({ contentType: 'application/javascript', body: 'window.msal = {};' }));
    const page = await ctx.newPage(); watch(page);
    await page.goto(`${base}/5x5-employee.html`);
    check(await page.locator('#auth-screen').isVisible(), 'auth screen shown when sign-in not configured');
    check((await page.locator('#auth-message').textContent()).includes('not been set up'), 'explains sign-in is not set up');
    check(await page.locator('#auth-signin').isHidden(), 'no sign-in button when not configured');
    check(await page.locator('#main-form').isHidden(), 'form hidden without sign-in');
    check(await page.locator('#cv-body tr').count() === 0, 'form not even built without sign-in');
    await page.screenshot({ path: `${OUT}/gate-unconfigured.png` });
    await ctx.close();
  }
  // ---- sign-in gate with real MSAL and no session: shows the button ----
  {
    const ctx = await browser.newContext();
    await ctx.route('**/assets/js/config.js', configWithAuth({ CLIENT_ID: '11111111-1111-1111-1111-111111111111', TENANT_ID: '22222222-2222-2222-2222-222222222222' }));
    await ctx.route('**/login.microsoftonline.com/**', (route) => route.abort());
    const page = await ctx.newPage(); watch(page);
    await page.goto(`${base}/rock-planner.html`);
    check(await page.locator('#auth-signin').isHidden(), 'sign-in button hidden while MSAL checks for a session');
    await page.locator('#auth-signin').waitFor({ state: 'visible', timeout: 30000 });
    check((await page.locator('#auth-message').textContent()).includes('Sign in with your'), 'real MSAL with no session shows the Sign in button');
    check(await page.locator('#main-form').isHidden(), 'form stays hidden until signed in');
    await page.screenshot({ path: `${OUT}/gate-signin.png` });
    await ctx.close();
  }

  // ---- index ----
  console.log('index.html');
  const ctx = await signedInContext(EMPLOYEE);
  const page = await ctx.newPage(); watch(page);
  await page.goto(`${base}/`);
  check(await page.locator('.card').count() === 3, 'three form cards');

  // ---- employee form ----
  console.log('5x5-employee.html');
  await page.goto(`${base}/5x5-employee.html`);
  check(await page.locator('#auth-screen').isHidden() && await page.locator('#main-form').isVisible(), 'form revealed for signed-in user');
  check((await page.locator('#auth-signout').count()) === 1 && (await page.locator('.header-links').textContent()).includes('Test Person'), 'signed-in line shown');
  check(await page.locator('#emp-name').inputValue() === EMPLOYEE.name, 'name prefilled from account');
  check(await page.locator('#emp-email').inputValue() === EMPLOYEE.email && await page.locator('#emp-email').evaluate((e) => e.readOnly), 'email prefilled and read-only');
  check(await page.locator('#cv-body tr').count() === 6, 'six core value rows');
  check(await page.locator('#health-blocks .rating-row').count() === 21, '21 health rating rows');
  check(await page.locator('#rock-rows .rock-row').count() === 3, 'three rock rows');
  check(await page.locator('#q-list .q-item').count() === 9, 'nine questions');
  check((await page.locator('#emp-entity option').count()) === 5, 'entity dropdown filled from config');
  check(await page.locator('#emp-year').inputValue() === String(new Date().getFullYear()), 'year defaults to current');

  await page.fill('#emp-name', '');
  await submit(page, '#error-msg.show');
  check(await page.locator('#error-msg').isVisible() && (await page.locator('#error-msg').textContent()).includes('name'), 'empty name caught first');
  check(await page.locator('#emp-name.invalid').count() === 1, 'name field marked invalid');

  await page.fill('#emp-name', 'Test Person');
  await page.selectOption('#emp-entity', 'TST Outpost');
  const supOpts = await page.locator('#emp-supervisor option').allTextContents();
  check(supOpts.includes('Emily / Erica Brinker') && !supOpts.includes('Will Brinker'), 'supervisors follow entity');
  await page.selectOption('#emp-supervisor', 'Emily / Erica Brinker');
  await page.selectOption('#emp-quarter', 'Q3');
  await page.click('#cv-rate-0 [data-val="3"]');
  await page.fill('#cv-word-0', 'warm & <friendly>');
  await page.fill('#seat-name-0', 'Floor lead');
  await page.check('#seat-g-0');
  await page.fill('#rock-name-0', 'Rock "one"');
  await page.click('#rock-rate-0 [data-val="7"]');
  await page.click('#add-rock');
  check(await page.locator('#rock-rows .rock-row').count() === 4, 'add rock appends a row');
  check(await page.locator('#rock-name-0').inputValue() === 'Rock "one"', 'existing rock kept after adding');
  await page.click('#health-belonging-0 [data-val="9"]');
  await page.fill('#health-fb-balanced', 'Fine');
  await page.check('#q-check-0');
  check(await page.locator('#q-ans-0').isVisible(), 'ticking a question reveals its answer box');
  await page.fill('#q-text-0', 'Line one <b>bold?</b>\nLine two | pipe');
  await page.check('#q-check-2');
  await submit(page, '#error-msg.show');
  check((await page.locator('#error-msg').textContent()).includes('no answer'), 'ticked-but-empty question is caught');
  await page.fill('#q-text-2', 'Second answer');

  // draft persistence
  await page.waitForTimeout(600);
  await page.reload();
  check(await page.locator('#emp-name').inputValue() === 'Test Person', 'draft restores text');
  check(await page.locator('#emp-supervisor').inputValue() === 'Emily / Erica Brinker', 'draft restores dependent dropdown');
  check(await page.locator('#cv-rate-0 .selected').getAttribute('data-val') === '3', 'draft restores rating');
  check(await page.locator('#rock-rows .rock-row').count() === 4, 'draft restores added rock row');
  check(await page.locator('#q-ans-0').isVisible(), 'draft restores open question');
  check(await page.locator('.notice.info').isVisible(), 'draft notice shown');
  await page.screenshot({ path: `${OUT}/employee.png`, fullPage: true });

  // failed send keeps the form and shows the link
  failNext = true; expectingFailure = true;
  await submit(page, '#fallback-link');
  expectingFailure = false;
  check(await page.locator('#fallback-link').count() === 1, 'failed send shows copyable link');
  check(await page.locator('#main-form').isVisible(), 'form still visible after failure');
  check(!(await page.locator('#submit-btn').isDisabled()), 'submit re-enabled after failure');

  // successful send
  await submit(page, '#success-screen.show');
  check(await page.locator('#success-screen').isVisible(), 'success screen after send');
  {
    const m = lastMail();
    check(sent[sent.length - 1].auth === 'Bearer test-token', 'Graph call carries the access token');
    check(addrs(m.toRecipients).join(',') === 'erica@thespeckledtrout.com,emily@thespeckledtrout.com', 'to = supervisor emails from config');
    check(addrs(m.ccRecipients).length === 0, 'employee notification has no cc');
    check(m.subject === `5x5x5 submitted — Test Person — Q3 ${new Date().getFullYear()}`, 'subject from config');
    check(header(m) && header(m).value === '5x5-employee', 'x-tst-form header');
    check(sent[sent.length - 1].url.endsWith('/users/forms%40thespeckledtrout.com/sendMail'), 'sent from the shared forms mailbox by default');
    check((m.internetMessageHeaders.find((h) => h.name === 'x-tst-submitted-by') || {}).value === EMPLOYEE.email, 'x-tst-submitted-by header carries the signed-in email');
    check(m.body.contentType === 'HTML' && m.body.content.includes('/5x5-supervisor.html?d=') && m.body.content.includes('Core Values total: 3/18'), 'body has review link and summary');
    check(m.body.content.includes('warm &amp; &lt;friendly&gt;') === false && !m.body.content.includes('<b>bold?</b>'), 'answers are not in the notification body');
    check((await page.evaluate(() => localStorage.getItem('tst-5x5-employee'))) === null, 'draft cleared after success');
  }
  const link = lastMail().body.content.match(/href="([^"]+5x5-supervisor\.html\?d=[^"]+)"/)[1].replace(/&amp;/g, '&').replace(/^https?:\/\/[^/]+/, base);
  console.log('  link length', link.length);

  // ---- supervisor form from that link, signed in as the employee (mismatch) ----
  console.log('5x5-supervisor.html');
  await page.goto(link);
  check(await page.locator('#no-data-notice').isHidden(), 'no-data notice hidden when data present');
  check((await page.locator('#meta-name').textContent()) === 'Test Person', 'employee name shown');
  check(await page.locator('#main-form .notice.warn').count() === 1 && (await page.locator('#main-form .notice.warn').textContent()).includes('addressed to'), 'mismatch notice when signed-in user is not the supervisor');
  await page.screenshot({ path: `${OUT}/supervisor-mismatch.png` });
  await ctx.close();

  // ---- supervisor form as the actual supervisor ----
  const sctx = await signedInContext(SUPERVISOR);
  const sp = await sctx.newPage(); watch(sp);
  await sp.goto(link);
  check(await sp.locator('#main-form .notice.warn').count() === 0, 'no mismatch notice for the addressed supervisor');
  check((await sp.locator('#cv-sup-body tr').first().locator('td').nth(1).textContent()) === 'warm & <friendly>', 'special chars shown literally (escaped)');
  check(await sp.locator('#cv-sup-body tr').first().locator('.rating-row.emp .selected[data-val="3"]').count() === 1, 'employee cv rating shown');
  check((await sp.locator('.rock-title').first().textContent()) === 'Rock "one"', 'rock name shown');
  check((await sp.locator('.emp-answer').first().textContent()).includes('<b>bold?</b>'), 'answer shown without executing HTML');
  check(await sp.locator('#dev-rows input').count() === 6, 'three dev rows');
  await sp.click('#sup-cv-0 [data-val="2"]');
  await sp.click('#sup-rock-0 [data-val="5"]');
  await sp.fill('#dev-area-0', 'Delegation');
  await sp.fill('#dev-plan-0', 'Hand off closing');
  await sp.click('#add-dev');
  check(await sp.locator('#dev-rows input').count() === 8, 'add dev row appends');
  check(await sp.locator('#dev-area-0').inputValue() === 'Delegation', 'dev row kept after adding');
  await sp.fill('#sup-q-note-0', 'Good topic');
  await sp.fill('#sup-overall-notes', 'Overall | notes\nsecond line');
  await sp.waitForTimeout(600);
  await sp.reload();
  check(await sp.locator('#sup-cv-0 .selected').getAttribute('data-val') === '2', 'supervisor draft restores rating');
  check(await sp.locator('#dev-rows input').count() === 8, 'supervisor draft restores added row');
  await sp.screenshot({ path: `${OUT}/supervisor.png`, fullPage: true });
  await submit(sp, '#success-screen.show');
  check(await sp.locator('#success-screen').isVisible(), 'supervisor success screen');
  {
    const m = lastMail();
    const cd = m.body.content;
    check(addrs(m.toRecipients).join(',') === 'erica@thespeckledtrout.com,emily@thespeckledtrout.com', 'completed review to supervisors');
    check(addrs(m.ccRecipients).join(',') === 'ashley@thespeckledtrout.com,test@thespeckledtrout.com', 'completed review cc automation + employee');
    check(m.subject.startsWith('5x5x5 completed review — Test Person — Q3'), 'completed review subject');
    check(header(m).value === '5x5-completed', 'completed review header');
    check(cd.includes('===5x5_DATA_START==='), 'FIELD block present');
    check(cd.includes('FIELD:employee_name|Test Person|||FIELD:entity|TST Outpost|||FIELD:quarter|Q3 ' + new Date().getFullYear()), 'FIELD header values');
    check(cd.includes('FIELD:cv_community_word|warm & <friendly>|||FIELD:cv_community_emp|3|||FIELD:cv_community_sup|2'), 'cv fields raw (unescaped) for the flow');
    check(cd.includes('FIELD:rock_1_name|Rock "one"|||FIELD:rock_1_emp|7|||FIELD:rock_1_sup|5'), 'rock fields');
    check(cd.includes('FIELD:q1|Line one <b>bold?</b> Line two / pipe'), 'question answer flattened to one line, pipe replaced');
    check(cd.includes('FIELD:dev_1_area|Delegation|||FIELD:dev_1_plan|Hand off closing'), 'dev fields');
    check(cd.includes('FIELD:supervisor_notes|Overall / notes second line'), 'supervisor notes flattened');
    check(cd.includes('FIELD:belonging|9|||FIELD:inspired|0'), 'health category totals');
    check(cd.includes('warm &amp; &lt;friendly&gt;'), 'visible HTML is escaped');
    fs.writeFileSync(`${OUT}/completed_data.html`, cd);
  }

  // legacy base64 link
  const legacy = Buffer.from(JSON.stringify({ n: 'Legacy Person', e: 'TST Outpost', q: 'Q1 2026', s: 'Will Brinker', em: 'l@x.com', cv: [{ w: 'a', r: 1 }], se: [], ro: [], h: [[1, 2, 3]], hf: [''], qs: [{ i: 1, a: 'Old answer' }] })).toString('base64');
  await sp.goto(`${base}/5x5-supervisor.html?data=${encodeURIComponent(legacy)}`);
  check((await sp.locator('#meta-name').textContent()) === 'Legacy Person', 'legacy ?data= link still decodes');
  check((await sp.locator('.emp-answer').first().textContent()) === 'Old answer', 'legacy answer shown');

  // no data + sample
  await sp.goto(`${base}/5x5-supervisor.html`);
  check(await sp.locator('#no-data-notice').isVisible(), 'no-data notice shown');
  check(await sp.locator('#main-form').isHidden(), 'form hidden without data');
  await sp.goto(`${base}/5x5-supervisor.html?sample=1`);
  check((await sp.locator('#meta-name').textContent()) === 'Sample Employee', 'sample data loads');

  // ---- rock planner ----
  console.log('rock-planner.html');
  await sp.goto(`${base}/rock-planner.html`);
  check(await sp.locator('#emp-name').inputValue() === SUPERVISOR.name && await sp.locator('#emp-email').inputValue() === SUPERVISOR.email, 'planner prefills name/email');
  check(await sp.locator('#steps-body tr').count() === 13, '13 step rows');
  check(await sp.locator('#resources-body tr').count() === 5, '5 resource rows');
  check(await sp.locator('#smart-rows textarea').count() === 5, '5 SMART boxes');
  await sp.fill('#emp-name', 'Rock Person');
  await sp.fill('#emp-initials', 'rpx');
  await sp.selectOption('#emp-entity', 'TST Outfitters');
  await sp.selectOption('#emp-supervisor', 'Joe Lynch / Phillip Jamison');
  await sp.selectOption('#emp-quarter', 'Q4');
  await sp.fill('#rock-title', 'Inventory <system>');
  await sp.fill('#rock-desc', 'Desc line 1\nline 2');
  for (const k of ['s', 'm', 'a', 'r', 't']) await sp.fill(`#smart-${k}`, `${k} text`);
  for (let i = 0; i < 3; i++) { await sp.fill(`#step-date-${i}`, `2026-10-0${i + 1}`); await sp.fill(`#step-activity-${i}`, `Step ${i + 1}`); }
  await submit(sp, '#error-msg.show');
  check((await sp.locator('#error-msg').textContent()).includes('at least 4'), 'step minimum enforced');
  await sp.fill('#step-activity-3', 'Step 4');
  await sp.fill('#resource-1', 'Budget');
  await submit(sp, '#success-screen.show');
  check(await sp.locator('#success-screen').isVisible(), 'planner success');
  {
    const m = lastMail(); const d = m.body.content;
    check(addrs(m.toRecipients).join(',') === 'joe@thespeckledtrout.com,phillip@thespeckledtrout.com' && addrs(m.ccRecipients).join(',') === 'ashley@thespeckledtrout.com', 'planner recipients');
    check(header(m).value === 'rock-planner' && m.subject.startsWith('Rock planner — Rock Person — Q4'), 'planner header + subject');
    check(d.includes('FIELD:Initials|RPX|||'), 'initials uppercased');
    check(d.includes('FIELD:EmployeeEmail|erica@thespeckledtrout.com|||'), 'employee email from account');
    check(d.includes('FIELD:RockTitle|Inventory <system>|||'), 'raw title in FIELD block');
    check(d.includes('FIELD:RockDescription|Desc line 1<<BR>>line 2|||'), 'newline → <<BR>>');
    check(d.includes('FIELD:Step4|~~Step 4~~|||') && d.includes('FIELD:Step1|2026-10-01~~Step 1~~|||'), 'step row format');
    check(d.includes('FIELD:Resources|Budget|||'), 'resources');
    check(d.includes('Inventory &lt;system&gt;'), 'visible title escaped');
  }

  // ---- rock completion ----
  console.log('rock-completion.html');
  await sp.goto(`${base}/rock-completion.html`);
  check(await sp.locator('#explain-wrap').isHidden(), 'explain hidden initially');
  await sp.check('#complete-no');
  check(await sp.locator('#explain-wrap').isVisible(), 'explain shown on No');
  await sp.fill('#emp-name', 'Done Person');
  await sp.fill('#emp-initials', 'DPZ');
  await sp.selectOption('#emp-entity', 'TST Umbrella (EPS)');
  await sp.selectOption('#emp-supervisor', 'Emily / Erica Brinker');
  await sp.selectOption('#emp-quarter', 'Q2');
  await sp.fill('#rock-title', 'The rock');
  await submit(sp, '#error-msg.show');
  check((await sp.locator('#error-msg').textContent()).includes('prevented'), 'explanation required when No');
  await sp.fill('#explain', 'Ran out of time');
  await sp.fill('#accomplish-1', 'Did a thing');
  await sp.waitForTimeout(600);
  await sp.reload();
  check(await sp.locator('#complete-no').isChecked() && await sp.locator('#explain-wrap').isVisible(), 'radio + conditional restored from draft');
  await submit(sp, '#success-screen.show');
  check(await sp.locator('#success-screen').isVisible(), 'completion success');
  {
    const m = lastMail(); const d = m.body.content;
    check(header(m).value === 'rock-completion' && addrs(m.ccRecipients).join(',') === 'ashley@thespeckledtrout.com', 'completion header + cc');
    check(d.includes('FIELD:FormType|RockCompletion|||') && d.includes('FIELD:IsComplete|No|||') && d.includes('FIELD:ExplainIncomplete|Ran out of time|||') && d.includes('FIELD:Accomplish1|Did a thing|||') && d.includes('FIELD:NextStep3||||'), 'completion FIELD block');
    check(d.includes('✗ Not Complete'), 'status badge');
  }
  await sctx.close();

  // ---- SEND_FROM 'user': own mailbox first, shared mailbox when there is none ----
  console.log("SEND_FROM 'user' fallback");
  {
    const uctx = await signedInContext(EMPLOYEE);
    await uctx.route('**/assets/js/config.js', configWith({ SEND_FROM: 'user' }));
    const up = await uctx.newPage(); watch(up);
    const fill = async () => {
      await up.goto(`${base}/rock-completion.html`);
      await up.fill('#emp-initials', 'ABC'); await up.selectOption('#emp-entity', 'TST Outpost'); await up.selectOption('#emp-supervisor', 'Emily / Erica Brinker');
      await up.selectOption('#emp-quarter', 'Q1'); await up.fill('#rock-title', 'R'); await up.check('#complete-yes'); await up.fill('#accomplish-1', 'x');
    };
    await fill();
    const before = sent.length;
    await submit(up, '#success-screen.show');
    check(sent.length === before + 1 && sent[before].url.endsWith('/me/sendMail'), "with a mailbox, 'user' mode sends from /me");
    noMailbox = true; expectingFailure = true;   // the browser logs the intentional 404
    await up.evaluate(() => localStorage.clear());
    await fill();
    const before2 = sent.length;
    await submit(up, '#success-screen.show');
    noMailbox = false; expectingFailure = false;
    check(sent.length === before2 + 2 && sent[before2].url.endsWith('/me/sendMail') && sent[before2 + 1].url.endsWith('/users/forms%40thespeckledtrout.com/sendMail'), 'without a mailbox, falls back to the shared mailbox');
    await uctx.close();
  }

  // ---- mobile render ----
  const mctx = await signedInContext(EMPLOYEE, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  await mp.goto(`${base}/5x5-employee.html`);
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!overflow, 'no horizontal scroll on phone width');
  await mp.screenshot({ path: `${OUT}/employee-mobile.png`, fullPage: true });
  await mctx.close();

  await browser.close();
  server.close();

  console.log('\nerrors:', errors.length ? errors : 'none');
  console.log('failures:', failures.length ? failures : 'none');
  process.exit(failures.length || errors.length ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
