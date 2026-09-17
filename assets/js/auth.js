/* ==========================================================================
   auth.js — Microsoft sign-in for every form. Loaded after shared.js.

   Uses MSAL.js (loaded from the CDN on each page) against the company's
   Microsoft 365 tenant. The form stays hidden until someone from the tenant
   is signed in; their submission is then emailed from their own mailbox via
   Microsoft Graph (see sendMail in shared.js). Setup is in README.md.

   Pages use it as:  TST.auth.ready.then(init)   — resolves with { name, email }
   ========================================================================== */
(function () {
  'use strict';

  const { CONFIG, $, esc } = TST;
  const SCOPES = ['User.Read', 'Mail.Send'];

  let pca = null;       // MSAL PublicClientApplication
  let account = null;   // the signed-in MSAL account
  let fake = null;      // test-only identity (see start())

  /* ---------- screens ---------- */
  function screen(message, { button = false } = {}) {
    const s = $('auth-screen');
    if (!s) return;
    s.hidden = false;
    $('auth-message').textContent = message;
    $('auth-signin').hidden = !button;
  }

  const wait = () => new Promise(() => {});   // never resolves: page stays on the sign-in screen

  function reveal() {
    const s = $('auth-screen');
    if (s) s.hidden = true;
    const form = $('main-form');
    if (form) form.hidden = false;
    const links = document.querySelector('#main-form .header-links');
    if (links) {
      links.insertAdjacentHTML('beforeend',
        ` · Signed in as <strong>${esc(user().name)}</strong> <button type="button" class="btn-link" id="auth-signout">Not you?</button>`);
      $('auth-signout').addEventListener('click', signOut);
    }
  }

  /* ---------- identity + tokens ---------- */
  function user() {
    if (fake) return fake;
    const claims = account.idTokenClaims || {};
    return { name: claims.name || account.name || account.username, email: (claims.preferred_username || account.username || '').toLowerCase() };
  }

  async function token() {
    if (fake) return 'test-token';
    try {
      const r = await pca.acquireTokenSilent({ scopes: ['Mail.Send'], account });
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
    pca.logoutRedirect({ account, postLogoutRedirectUri: location.origin + location.pathname });
  }

  /* ---------- start-up ---------- */
  async function start() {
    /* Test hook: the automated tests inject a fake user before any script runs
       so they can exercise the forms without a Microsoft account. */
    if (window.__TST_FAKE_USER) { fake = window.__TST_FAKE_USER; reveal(); return fake; }

    if (!CONFIG.AUTH || !CONFIG.AUTH.CLIENT_ID || !CONFIG.AUTH.TENANT_ID) {
      screen('Sign-in has not been set up for this site yet. An administrator needs to follow "Microsoft sign-in setup" in the README.');
      return wait();
    }
    if (!window.msal) {
      screen('The Microsoft sign-in library did not load. Check your connection and reload the page.');
      return wait();
    }

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

    if (!account) {
      screen('Sign in with your Speckled Trout Microsoft account to open this form.', { button: true });
      $('auth-signin').addEventListener('click', () => pca.loginRedirect({ scopes: SCOPES }));
      return wait();
    }

    pca.setActiveAccount(account);
    reveal();
    return user();
  }

  TST.auth = {
    ready: start().catch((e) => {
      console.error(e);
      screen('Sign-in failed: ' + (e.errorMessage || e.message || e) + '. Reload the page to try again.');
      return wait();
    }),
    user,
    token,
    signOut
  };
})();
