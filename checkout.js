(() => {
  'use strict';
  const form = document.getElementById('purchase-form');
  if (!form) return;
  const button = document.getElementById('checkout-button');
  const status = document.getElementById('checkout-status');
  const details = document.querySelector('.future-checkout');
  const site = window.BODYEXPRESS_CONFIG || {};
  const focused = document.body.dataset.page === 'first-lesson';
  let checkout = null;
  let submitting = false;
  let idempotencyKey = '';
  let submissionBody = '';
  let consentAttribution;
  const timeout = () => typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(12000) : undefined;
  const setStatus = (message, error = false) => { status.textContent = message; status.dataset.state = error ? 'error' : 'info'; };

  function apiUrl(path) {
    const base = new URL(site.apiBase || '/', location.origin);
    if (base.origin !== location.origin || base.username || base.password || base.search || base.hash) throw new Error('same_origin_required');
    return `${base.href.replace(/\/$/, '')}${path}`;
  }
  function legalUrl(value) {
    if (typeof value !== 'string' || !value) throw new Error('invalid_legal_url');
    const target = new URL(value, location.href);
    const local = target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
    if (target.origin !== location.origin || (target.protocol !== 'https:' && !local) || target.username || target.password) throw new Error('invalid_legal_url');
    return target.href;
  }
  function cookie(name) {
    const item = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
    if (!item) return '';
    try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return ''; }
  }
  function validMetaId(value, expression) {
    if (!expression.test(value)) return false;
    const timestamp = Number(value.split('.')[2]);
    return timestamp <= Date.now() && timestamp >= Date.now() - 90 * 86400000;
  }
  // Called only after a voluntary, checked marketing consent. Never writes cookies or localStorage.
  function attributionAfterConsent() {
    const params = new URLSearchParams(location.search);
    const attribution = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = params.get(key);
      if (value && /^[A-Za-z0-9_.:+ -]{1,120}$/.test(value)) attribution[key] = value;
    }
    for (const key of ['campaign_id', 'adset_id', 'ad_id']) {
      const value = params.get(key);
      if (value && /^\d{5,30}$/.test(value)) attribution[key] = value;
    }
    const fbp = cookie('_fbp');
    if (validMetaId(fbp, /^fb\.[0-2]\.\d{13}\.\d{1,30}$/)) attribution.fbp = fbp;
    const fbclid = params.get('fbclid');
    const fbc = cookie('_fbc');
    if (fbclid && /^[A-Za-z0-9_-]{1,500}$/.test(fbclid)) attribution.fbc = `fb.1.${Date.now()}.${fbclid}`;
    else if (validMetaId(fbc, /^fb\.[0-2]\.\d{13}\.[A-Za-z0-9_-]{1,500}$/)) attribution.fbc = fbc;
    return attribution;
  }
  const marketing = document.getElementById('purchase-marketing');
  marketing.addEventListener('change', () => { consentAttribution = undefined; });

  async function loadConfig() {
    if (site.apiEnabled !== true || site.checkoutEnabled !== true) return;
    try {
      const response = await fetch(apiUrl('/api/checkout/config'), { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store', signal: timeout() });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      if (data.enabled !== true || data.price !== 99000 || data.currency !== 'czk' || data.flow !== 'pay_then_arrange' || typeof data.testMode !== 'boolean' || typeof data.termsVersion !== 'string' || !data.termsVersion) throw new Error('unavailable');
      const terms = legalUrl(data.termsUrl);
      const privacy = legalUrl(data.privacyUrl);
      form.querySelector('.checkbox-label a').href = terms;
      form.querySelector('.checkbox-label.optional a').href = privacy;
      document.querySelector('.seller-note a').href = terms;
      checkout = data;
      button.disabled = false;
      details.querySelector('summary').firstChild.textContent = data.testMode ? 'Online platba — testovací režim' : 'Objednat a zaplatit první lekci';
      document.querySelector('.future-checkout-intro').textContent = 'Zaplatíte jednu lekci přes Stripe. Konkrétní termín si následně domluvíte se studiem. Platba sama nerezervuje čas v kalendáři.';
      button.querySelector('span').textContent = data.testMode ? 'Vyzkoušet testovací platbu' : 'Objednat a zaplatit 990 Kč';
      setStatus(data.testMode ? 'Testovací režim Stripe. Nevytváří se skutečná platba ani objednávka lekce.' : 'Po zaplacení si termín domluvíte se studiem.');
      if (focused) {
        details.open = true;
        document.querySelector('[data-payment-availability]').textContent = data.testMode ? 'Online platba je v testovacím režimu. Skutečný termín vyberete v Reservantu.' : 'Online platba je dostupná. Termín si po zaplacení domluvíte se studiem.';
        if (!data.testMode) {
          document.body.classList.add('checkout-ready');
          document.querySelectorAll('[data-primary-offer-cta]').forEach(link => { link.href = '#purchase-form'; link.textContent = 'Koupit první lekci · 990 Kč'; });
          document.querySelector('[data-booking-faq]').textContent = 'Zaplatíte první lekci za 990 Kč přes Stripe. Poté zavoláte do studia na +420 774 143 666 a společně domluvíte konkrétní čas. Studio jej zapíše do Reservanta. Samotná platba žádný čas v kalendáři nerezervuje.';
        }
      }
    } catch {
      checkout = null;
      button.disabled = true;
      button.querySelector('span').textContent = 'Online platbu připravujeme';
      setStatus('Online platba zatím není aktivní. Termín si můžete vybrat v kalendáři Reservanto.');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !checkout || !form.reportValidity()) return;
    const payload = { termsAccepted: document.getElementById('purchase-terms').checked, termsVersion: checkout.termsVersion, marketingConsent: marketing.checked, sourceUrl: location.origin + location.pathname };
    if (marketing.checked) {
      consentAttribution ||= attributionAfterConsent();
      if (Object.keys(consentAttribution).length) payload.attribution = consentAttribution;
    } else consentAttribution = undefined;
    const body = JSON.stringify(payload);
    if (!idempotencyKey || body !== submissionBody) { idempotencyKey = crypto.randomUUID(); submissionBody = body; }
    submitting = true;
    button.disabled = true;
    button.querySelector('span').textContent = 'Otevíráme platební bránu…';
    setStatus('Chvilku prosím, připravujeme bezpečnou platbu.');
    try {
      const response = await fetch(apiUrl('/api/checkout/session'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, accept: 'application/json' }, body: submissionBody, signal: timeout() });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error('checkout_failed');
      const target = new URL(data.url);
      if (target.protocol !== 'https:' || target.hostname !== 'checkout.stripe.com' || target.port || target.username || target.password) throw new Error('invalid_checkout');
      location.assign(target.href);
    } catch {
      setStatus('Platební bránu se nepodařilo otevřít. Zkuste to znovu, nebo zavolejte studiu na +420 774 143 666. Na této stránce nebyla platba potvrzena.', true);
      button.querySelector('span').textContent = checkout.testMode ? 'Zkusit testovací platbu znovu' : 'Zkusit platbu znovu';
      button.disabled = false;
      submitting = false;
    }
  });

  let requested = false;
  function requestConfig() { if (!requested) { requested = true; void loadConfig(); } }
  details.addEventListener('toggle', () => { if (details.open) requestConfig(); });
  if (focused) requestConfig();
})();
