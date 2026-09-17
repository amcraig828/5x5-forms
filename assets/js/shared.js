/* ==========================================================================
   shared.js — helpers used by every form. Load order on each page:
     config.js → (5x5-content.js) → vendor/lz-string.min.js → shared.js → <form>.js

   Exposes a single global, `TST`. Nothing in here needs editing for routine
   changes to people or wording — see config.js and 5x5-content.js for that.
   ========================================================================== */

window.TST = (function () {
  'use strict';

  const CONFIG = window.TST_CONFIG;

  /* ---------- tiny DOM helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const val = (id) => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
  const checked = (id) => { const el = $(id); return !!(el && el.checked); };

  /* Escape text before placing it inside HTML. Use on every user-entered value. */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- dates ---------- */
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const longDate = (d = new Date()) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const shortDate = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  /* ---------- shared header fields (entity → supervisor, year) ---------- */
  function fillEntities(select) {
    select.innerHTML = '<option value="">Select entity…</option>' +
      CONFIG.ENTITIES.map((e) => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('');
  }

  function fillSupervisors(select, entityName) {
    const entity = CONFIG.ENTITIES.find((e) => e.name === entityName);
    const names = entity ? entity.supervisors : [];
    const previous = select.value;
    select.innerHTML = `<option value="">${names.length ? 'Select supervisor…' : 'Select entity first…'}</option>` +
      names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if (names.includes(previous)) select.value = previous;
  }

  /* Populates the entity dropdown from config and keeps the supervisor
     dropdown in sync with whichever entity is chosen. */
  function wireEntitySupervisor(entityId, supervisorId) {
    const entity = $(entityId), supervisor = $(supervisorId);
    fillEntities(entity);
    fillSupervisors(supervisor, entity.value);
    entity.addEventListener('change', () => fillSupervisors(supervisor, entity.value));
  }

  /* Year dropdown: last year, this year, next year — defaulting to this year. */
  function fillYears(select) {
    const now = new Date().getFullYear();
    select.innerHTML = [now - 1, now, now + 1].map((y) => `<option value="${y}"${y === now ? ' selected' : ''}>${y}</option>`).join('');
  }

  function supervisorFor(label) {
    return CONFIG.SUPERVISORS[label] || { name: label, email: '' };
  }

  /* ---------- rating button groups ----------
     ratingRow() returns markup; clicks are handled once, below, for every
     row on the page. Read with ratingValue(id); set with setRating(). */
  function ratingRow({ id, max, selected = null, tone = 'emp', readOnly = false, label = '' }) {
    const buttons = Array.from({ length: max }, (_, i) => i + 1).map((n) => {
      const on = selected === n;
      return `<button type="button" class="rating-btn${on ? ' selected' : ''}" data-val="${n}" role="radio" aria-checked="${on}"${readOnly ? ' disabled' : ''}>${n}</button>`;
    }).join('');
    const classes = ['rating-row', tone, max > 5 ? 'compact' : ''].filter(Boolean).join(' ');
    return `<div class="${classes}"${id ? ` id="${esc(id)}"` : ''} role="radiogroup" aria-label="${esc(label)}">${buttons}</div>`;
  }

  function ratingValue(id) {
    const row = $(id);
    const on = row && row.querySelector('.rating-btn.selected');
    return on ? Number(on.dataset.val) : null;
  }

  function setRating(row, value) {
    if (!row) return;
    row.querySelectorAll('.rating-btn').forEach((b) => {
      const on = Number(b.dataset.val) === value;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.rating-row .rating-btn');
    if (!btn || btn.disabled) return;
    const row = btn.closest('.rating-row');
    setRating(row, Number(btn.dataset.val));
    row.dispatchEvent(new CustomEvent('rating-change', { bubbles: true }));
  });

  /* ---------- messages ---------- */
  function clearError() {
    const box = $('error-msg');
    if (box) { box.classList.remove('show'); box.innerHTML = ''; }
    document.querySelectorAll('.invalid').forEach((el) => { el.classList.remove('invalid'); el.removeAttribute('aria-invalid'); });
  }

  /* showError('text') or showError('text', { html: '<extra markup>', field: 'input-id' }) */
  function showError(message, { html = '', field = null } = {}) {
    const box = $('error-msg');
    if (!box) { alert(message); return; }
    box.innerHTML = `<div>${esc(message)}</div>${html}`;
    box.classList.add('show');
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (field && $(field)) { $(field).classList.add('invalid'); $(field).setAttribute('aria-invalid', 'true'); }
  }

  /* Throw from a validate() function: fail('Please enter your name.', 'emp-name') */
  function fail(message, field) {
    const err = new Error(message);
    err.userMessage = message;
    err.field = field;
    err.isValidation = true;
    return err;
  }

  function showSuccess() {
    $('main-form').style.display = 'none';
    $('success-screen').classList.add('show');
    window.scrollTo(0, 0);
  }

  /* ---------- submit lifecycle ---------- */
  function setBusy(isBusy) {
    const btn = $('submit-btn');
    if (btn) {
      if (isBusy) { btn.dataset.label = btn.textContent; btn.textContent = 'Submitting…'; }
      else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
      btn.disabled = isBusy;
    }
    const overlay = $('sending-overlay');
    if (overlay) overlay.classList.toggle('show', isBusy);
  }

  /* Wires the page's <form id="main-form">. The handler may throw an error
     created with fail() to show a validation message; anything else becomes a
     generic "try again" message. */
  function onSubmit(handler) {
    const form = $('main-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      setBusy(true);
      try {
        await handler();
      } catch (err) {
        if (!err.isValidation) console.error(err);
        showError(err.userMessage || 'Something went wrong. Please try again.', { field: err.field });
      } finally {
        setBusy(false);
      }
    });
    /* Enter inside a single-line box should not submit a long form. */
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"]):not([type="radio"])')) e.preventDefault();
    });
  }

  let emailReady = false;
  async function sendEmail(templateId, params) {
    if (!window.emailjs) throw new Error('The email library did not load.');
    if (!emailReady) { window.emailjs.init({ publicKey: CONFIG.EMAILJS.PUBLIC_KEY }); emailReady = true; }
    try {
      return await window.emailjs.send(CONFIG.EMAILJS.SERVICE_ID, templateId, params);
    } catch (e) {
      const detail = (e && (e.text || e.message)) || String(e);
      throw new Error('EmailJS send failed: ' + detail);
    }
  }

  /* ---------- passing data between pages ----------
     The employee form puts its answers in the supervisor link. They are
     compressed (lz-string) so the link stays short enough for email clients.
     Older links used plain base64 under ?data= and are still accepted. */
  function encodePayload(obj) {
    return window.LZString.compressToEncodedURIComponent(JSON.stringify(obj));
  }

  function decodePayload() {
    const params = new URLSearchParams(window.location.search);
    try {
      if (params.get('d')) {
        return JSON.parse(window.LZString.decompressFromEncodedURIComponent(params.get('d')));
      }
      if (params.get('data')) {
        const bytes = Uint8Array.from(atob(params.get('data')), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      }
    } catch (e) {
      console.error('Could not read data from the link', e);
    }
    return null;
  }

  /* The public address of a sibling page, e.g. pageUrl('5x5-supervisor.html'). */
  function pageUrl(file) {
    if (/^https?:/.test(window.location.protocol)) return new URL(file, window.location.href).href;
    return `${CONFIG.SITE_URL}/${file}`;
  }

  /* ---------- drafts: autosave to this browser so a refresh loses nothing ----------
     draft.init('storage-key', { extra() {...}, beforeRestore(extra) {...} })
     `extra` lets a page remember things like how many rows it added. */
  const draft = {
    key: null,
    hooks: {},
    init(key, hooks = {}) {
      this.key = key;
      this.hooks = hooks;
      const form = $('main-form');
      const save = debounce(() => this.save(), 400);
      ['input', 'change', 'rating-change'].forEach((ev) => form.addEventListener(ev, save));
      if (this.restore()) this.showNotice();
    },
    storage() { try { return window.localStorage; } catch (e) { return null; } },
    snapshot() {
      const fields = {}, ratings = {};
      document.querySelectorAll('#main-form input[id], #main-form select[id], #main-form textarea[id]').forEach((el) => {
        if (el.type === 'button' || el.type === 'submit') return;
        fields[el.id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
      });
      document.querySelectorAll('#main-form .rating-row[id]').forEach((row) => {
        const v = ratingValue(row.id);
        if (v) ratings[row.id] = v;
      });
      return { savedAt: Date.now(), fields, ratings, extra: this.hooks.extra ? this.hooks.extra() : null };
    },
    save() {
      const s = this.storage();
      if (!s || !this.key) return;
      try { s.setItem(this.key, JSON.stringify(this.snapshot())); } catch (e) { /* storage full or blocked */ }
    },
    restore() {
      const s = this.storage();
      if (!s || !this.key) return false;
      let d = null;
      try { d = JSON.parse(s.getItem(this.key) || 'null'); } catch (e) { d = null; }
      if (!d || !d.fields) return false;
      if (this.hooks.beforeRestore) this.hooks.beforeRestore(d.extra || {});
      Object.entries(d.fields).forEach(([id, v]) => {
        const el = $(id);
        if (!el) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v; else el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      Object.entries(d.ratings || {}).forEach(([id, v]) => setRating($(id), v));
      this.savedAt = d.savedAt;
      return true;
    },
    clear() {
      const s = this.storage();
      if (s && this.key) s.removeItem(this.key);
    },
    showNotice() {
      const form = $('main-form');
      const when = this.savedAt ? new Date(this.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'earlier';
      const notice = document.createElement('div');
      notice.className = 'notice info show';
      notice.setAttribute('role', 'status');
      notice.innerHTML = `We restored the answers you were working on (saved ${esc(when)}). <button type="button" class="btn-link" id="draft-clear">Start over</button>`;
      const header = form.querySelector('.header');
      (header || form).insertAdjacentElement(header ? 'afterend' : 'afterbegin', notice);
      notice.querySelector('#draft-clear').addEventListener('click', () => {
        if (!confirm('Clear everything you have entered and start over?')) return;
        this.clear();
        window.location.reload();
      });
    }
  };

  /* ---------- email markup helpers (inline styles; email clients ignore CSS files) ---------- */
  const email = {
    header(title, subtitle = '') {
      return `<div style="border-bottom:2px solid #1a1a18;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9a9a93;margin-bottom:4px;">${esc(CONFIG.COMPANY)}</div>
    <div style="font-size:24px;color:#d24d29;">${esc(title)}</div>${subtitle ? `<div style="font-family:Arial,sans-serif;font-size:13px;color:#5a5a55;margin-top:4px;">${esc(subtitle)}</div>` : ''}
  </div>`;
    },
    metaTable(rows) {
      return `<table style="width:100%;font-family:Arial,sans-serif;font-size:13px;margin-bottom:20px;">
    ${rows.map(([k, v], i) => `<tr><td style="color:#5a5a55;padding:3px 0;width:120px;">${esc(k)}</td><td style="padding:3px 0;">${i === 0 ? `<strong>${esc(v)}</strong>` : esc(v)}</td></tr>`).join('\n    ')}
  </table>`;
    },
    label(text) {
      return `<div style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5a5a55;margin-bottom:8px;font-weight:bold;">${esc(text)}</div>`;
    },
    footer(text) {
      return `<div style="border-top:1px solid #e2e0d8;padding-top:12px;margin-top:24px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;color:#9a9a93;">${esc(text)}</div>
  </div>`;
    },
    /* A cell in a simple bordered table. */
    td: (content, extra = '') => `<td style="padding:6px 8px;border:1px solid #e2e0d8;${extra}">${content}</td>`,
    th: (content, extra = '') => `<th style="text-align:left;padding:6px 8px;border:1px solid #e2e0d8;font-size:11px;${extra}">${content}</th>`
  };

  /* Values written into the machine-readable FIELD block must stay on one
     line and must not contain the "|" separator. */
  const fieldValue = (s) => String(s == null ? '' : s).replace(/\|/g, '/').replace(/\r?\n/g, '<<BR>>');

  return {
    CONFIG, $, val, checked, esc, debounce, todayISO, longDate, shortDate,
    wireEntitySupervisor, fillYears, supervisorFor,
    ratingRow, ratingValue, setRating,
    clearError, showError, fail, showSuccess, onSubmit, sendEmail,
    encodePayload, decodePayload, pageUrl, draft, email, fieldValue
  };
})();
