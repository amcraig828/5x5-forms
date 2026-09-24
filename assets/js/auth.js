/* ==========================================================================
   auth.js — who is using the form. Loaded after shared.js.

   Normal path: Microsoft sign-in with MSAL.js (loaded from the CDN on each
   page) against the company tenant. The form stays hidden until someone in
   the directory is signed in; their submission then goes out through
   Microsoft Graph from the shared forms mailbox (see sendMail in shared.js).

   Temporary guest path (CONFIG.GUEST_ACCESS): people without a Microsoft
   account enter the team passphrase, and their submission goes out through
   EmailJS behind a reCAPTCHA. Only pages whose <body> has
   data-guest-access="allowed" offer it.

   Pages use it as:  TST.auth.ready.then(init)
     → resolves with { name, email }            for a signed-in person
     → resolves with { name: '', email: '', guest: true } for a guest
   ========================================================================== */
(function () {
  'use strict';

  const { CONFIG, $, esc } = TST;
  const SCOPES = ['User.Read', 'Mail.Send', 'Mail.Send.Shared', 'email'];
  const GUEST = CONFIG.GUEST_ACCESS || {};
  const GUEST_SESSION_KEY = 'tst-guest';

  let pca = null;       // MSAL PublicClientApplication
  let account = null;   // the signed-in MSAL account
  let fake = null;      // test-only identity (see start())
  let guest = false;    // true once the passphrase has been accepted

  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });

  /* ---------- screens ---------- */
  function screen(message, { button = false } = {}) {
    const s = $('auth-screen');
    if (!s) return;
    s.hidden = false;
    $('auth-message').textContent = message;
    $('auth-signin').hidden = !button;
    const link = $('auth-guest-link');
    if (link) link.hidden = !(button && guestAllowed());
  }

  function reveal() {
    const s = $('auth-screen');
    if (s) s.hidden = true;
    const form = $('main-form');
    if (form) form.hidden = false;
    const links = document.querySelector('#main-form .header-links');
    if (links) {
      links.insertAdjacentHTML('beforeend', guest
        ? ` · Continuing as a guest <button type="button" class="btn-link" id="auth-signout">Sign in instead</button>`
        : ` · Signed in as <strong>${esc(user().name)}</strong> <button type="button" class="btn-link" id="auth-signout">Not you?</button>`);
      $('auth-signout').addEventListener('click', signOut);
    }
    if (guest) mountCaptcha();
  }

  /* ---------- identity + tokens ---------- */
  function user() {
    if (fake) return fake;
    if (guest) return { name: '', email: '', guest: true };
    const claims = account.idTokenClaims || {};
    /* Guests signed in with an outside address have a synthetic username like
       "jane_gmail.com#EXT#@tenant.onmicrosoft.com"; their real address is in the
       email claim. Staff have the same value in both. */
    let email = String(claims.email || claims.preferred_username || account.username || '').toLowerCase();
    if (email.includes('#ext#')) email = email.split('#ext#')[0].replace(/_(?=[^_]*$)/, '@');
    return { name: claims.name || account.name || email, email };
  }

  async function token() {
    if (fake) return 'test-token';
    try {
      const r = await pca.acquireTokenSilent({ scopes: ['Mail.Send', 'Mail.Send.Shared'], account });
      return r.accessToken;
    } catch (e) {
      if (window.msal && e instanceof msal.InteractionRequiredAuthError) {
        /* Session expired: send them through Microsoft and back. The draft
           autosave keeps their answers, so they just submit again. */
        await pca.acquireTokenRedirect({ scopes: SCOPES, account });
        const err = new Error('redirecting for sign-in');
        err.userMessage = 'Refreshing your Microsoft sign-in. Your answers are saved — submit again when you are back.';
        throw err;
      }
      throw e;
    }
  }

  function signOut() {
    if (fake) return;
    if (guest) { try { sessionStorage.removeItem(GUEST_SESSION_KEY); } catch (e) { /* ignore */ } window.location.reload(); return; }
    pca.logoutRedirect({ account, postLogoutRedirectUri: location.origin + location.pathname });
  }

  /* ---------- guest path ---------- */
  const guestAllowed = () => !!(GUEST.ENABLED && GUEST.PASSPHRASE_SHA256 && GUEST.EMAILJS
    && document.body.dataset.guestAccess === 'allowed' && window.crypto && window.crypto.subtle);
  const captchaEnabled = () => !!GUEST.RECAPTCHA_SITE_KEY;

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });

  let librariesPromise = null;
  /* EmailJS SDK and (if a site key is set) the reCAPTCHA API, loaded only when a guest needs them. */
  function libraries() {
    if (!librariesPromise) {
      librariesPromise = Promise.all([
        window.emailjs ? Promise.resolve() : loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js'),
        (!captchaEnabled() || window.grecaptcha) ? Promise.resolve() : new Promise((res, rej) => {
          window.__tstRecaptchaReady = res;
          loadScript('https://www.google.com/recaptcha/api.js?onload=__tstRecaptchaReady&render=explicit').catch(rej);
        })
      ]);
    }
    return librariesPromise;
  }

  let captchaWidget = null;
  async function mountCaptcha() {
    const anchor = $('error-msg');
    if (!captchaEnabled() || !anchor || $('guest-captcha')) return;
    anchor.insertAdjacentHTML('beforebegin',
      `<div class="guest-captcha" id="guest-captcha-wrap"><div class="col-label">One last check before you submit</div><div id="guest-captcha"></div></div>`);
    try {
      await libraries();
      captchaWidget = window.grecaptcha.render('guest-captcha', { sitekey: GUEST.RECAPTCHA_SITE_KEY });
    } catch (e) {
      console.error(e);
      $('guest-captcha').textContent = 'The "I\'m not a robot" check could not load. Reload the page and try again.';
    }
  }
  const captchaToken = () => (window.grecaptcha && captchaWidget !== null) ? window.grecaptcha.getResponse(captchaWidget) : '';
  const resetCaptcha = () => { if (window.grecaptcha && captchaWidget !== null) window.grecaptcha.reset(captchaWidget); };

  function wireGuestPanel() {
    const open = $('auth-guest-open'), panel = $('auth-guest-panel'), input = $('guest-passphrase'), go = $('auth-guest-continue'), err = $('guest-error');
    if (!open || !panel) return;
    open.addEventListener('click', () => { panel.hidden = false; $('auth-guest-link').hidden = true; input.focus(); });
    const attempt = async () => {
      err.textContent = '';
      const phrase = input.value.trim();
      if (!phrase) { err.textContent = 'Please enter the team passphrase.'; return; }
      if ((await sha256(phrase)) !== String(GUEST.PASSPHRASE_SHA256).toLowerCase()) { err.textContent = "That passphrase isn't right. Ask your supervisor for the current one."; input.select(); return; }
      try { sessionStorage.setItem(GUEST_SESSION_KEY, '1'); } catch (e) { /* ignore */ }
      enterAsGuest();
    };
    go.addEventListener('click', attempt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); attempt(); } });
  }

  function enterAsGuest() {
    guest = true;
    reveal();
    resolveReady(user());
  }

  /* ---------- start-up ---------- */
  async function start() {
    /* Test hook: the automated tests inject a fake user before any script runs
       so they can exercise the forms without a Microsoft account. */
    if (window.__TST_FAKE_USER) { fake = window.__TST_FAKE_USER; reveal(); resolveReady(fake); return; }

    wireGuestPanel();

    const msalConfigured = !!(CONFIG.AUTH && CONFIG.AUTH.CLIENT_ID && CONFIG.AUTH.TENANT_ID && window.msal);

    if (msalConfigured) {
      pca = new msal.PublicClientApplication({
        auth: {
          clientId: CONFIG.AUTH.CLIENT_ID,
          authority: `https://login.microsoftonline.com/${CONFIG.AUTH.TENANT_ID}`,
          redirectUri: location.origin + location.pathname,   /* each page is its own registered redirect URI */
          navigateToLoginRequestUrl: true                     /* come back to the exact URL, query string included */
        },
        cache: { cacheLocation: 'localStorage' }               /* stay signed in across visits */
      });
      await pca.initialize();
      screen('Checking your Microsoft sign-in…');

      const response = await pca.handleRedirectPromise().catch((e) => { console.error('Sign-in redirect failed', e); return null; });
      account = (response && response.account) || pca.getActiveAccount() || pca.getAllAccounts()[0] || null;

      if (!account) {
        /* Already signed in to Microsoft 365 in this browser? Then this is invisible. */
        try { account = (await pca.ssoSilent({ scopes: SCOPES })).account; } catch (e) { /* no session; ask */ }
      }
      if (account) {
        pca.setActiveAccount(account);
        reveal();
        resolveReady(user());
        return;
      }
    }

    /* No Microsoft session. A guest who already entered the passphrase this session carries on. */
    let guestSession = false;
    try { guestSession = sessionStorage.getItem(GUEST_SESSION_KEY) === '1'; } catch (e) { /* ignore */ }
    if (guestAllowed() && guestSession) { enterAsGuest(); return; }

    if (!msalConfigured) {
      screen(CONFIG.AUTH && CONFIG.AUTH.CLIENT_ID
        ? 'The Microsoft sign-in library did not load. Check your connection and reload the page.'
        : 'Sign-in has not been set up for this site yet. An administrator needs to follow "Microsoft sign-in setup" in the README.', { button: false });
      if (guestAllowed()) $('auth-guest-link').hidden = false;
      return;
    }

    screen('Sign in with your Speckled Trout Microsoft account to open this form.', { button: true });
    $('auth-signin').addEventListener('click', () => pca.loginRedirect({ scopes: SCOPES }));
  }

  start().catch((e) => {
    console.error(e);
    screen('Sign-in failed: ' + (e.errorMessage || e.message || e) + '. Reload the page to try again.');
  });

  TST.auth = { ready, user, token, signOut };
  TST.guest = { libraries, captchaToken, resetCaptcha, captchaEnabled, hash: sha256 };
})();
