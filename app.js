(() => {
  'use strict';
  const KEY = 'bodyexpress-consent-v1';
  const VERSION = '2026-11-01';
  const TTL = 180 * 24 * 60 * 60 * 1000;
  const settings = window.BODYEXPRESS_CONFIG || {};
  let config = { pixelId: '', trackingEnabled: false };
  let consent = readConsent();
  let pixelLoaded = false;
  let attributionCreated = false;
  const banner = document.getElementById('cookie-banner');
  const dialog = document.getElementById('cookie-dialog');
  const toggle = document.getElementById('marketing-consent');
  function readConsent() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      if (value && value.version === VERSION && Date.now() - value.timestamp < TTL && value.timestamp <= Date.now() && typeof value.marketing === 'boolean') return value;
    } catch {}
    return null;
  }
  function api(path) { return (settings.apiBase || '') + path; }
  function readCookie(name) {
    const item = document.cookie.split('; ').find(part => part.startsWith(name + '='));
    return item ? decodeURIComponent(item.slice(name.length + 1)) : undefined;
  }
  function removeMarketingCookies() {
    for (const key of ['_fbp', '_fbc']) {
      const host = location.hostname;
      const domains = [null, host, '.' + host];
      const parts = host.split('.');
      while (parts.length > 2) { parts.shift(); domains.push('.' + parts.join('.')); }
      for (const domain of domains) document.cookie = key + '=; Max-Age=0; Path=/' + (domain ? '; Domain=' + domain : '') + '; SameSite=Lax';
    }
  }
  async function applyConsent() {
    if (!consent?.marketing) {
      if (window.fbq) window.fbq('consent', 'revoke');
      removeMarketingCookies();
      attributionCreated = false;
      if (settings.apiEnabled) await fetch(api('/api/attribution'), {method:'DELETE',credentials:'same-origin'}).catch(() => {});
      return;
    }
    if (!config.trackingEnabled || !/^\d+$/.test(config.pixelId)) return;
    if (!pixelLoaded) {
      const q = function() { q.callMethod ? q.callMethod.apply(q, arguments) : q.queue.push(arguments); };
      q.queue = []; q.push = q; q.loaded = true; q.version = '2.0';
      window.fbq = q; window._fbq = q;
      q('consent', 'grant'); q('init', config.pixelId); q('track', 'PageView');
      const script = document.createElement('script'); script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.append(script);
      pixelLoaded = true;
    } else { window.fbq('consent', 'grant'); }
    if (!attributionCreated && settings.apiEnabled) {
      const fbp = readCookie('_fbp');
      let fbc = readCookie('_fbc');
      const click = new URL(location.href).searchParams.get('fbclid');
      if (!fbc && click && /^[A-Za-z0-9_\-]{1,500}$/.test(click)) fbc = 'fb.1.' + Date.now() + '.' + click;
      const payload = {marketingConsent:true,consentVersion:VERSION,sourceUrl:location.origin + location.pathname};
      if (fbp) payload.fbp = fbp;
      if (fbc) payload.fbc = fbc;
      const response = await fetch(api('/api/attribution'), {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).catch(() => null);
      attributionCreated = !!response?.ok;
      // Connector musí bezpečně přiřadit tento serverový záznam k rezervaci.
      // Do externího Reservanta neposíláme vymyšlené query parametry.
    }
  }
  function saveConsent(marketing) {
    consent = {version:VERSION,marketing,timestamp:Date.now()};
    try { localStorage.setItem(KEY, JSON.stringify(consent)); } catch {}
    banner.hidden = true;
    if (dialog.open) dialog.close();
    void applyConsent();
  }
  function openSettings() { toggle.checked = !!consent?.marketing; dialog.showModal(); }
  document.getElementById('reject-cookies').addEventListener('click', () => saveConsent(false));
  document.getElementById('accept-cookies').addEventListener('click', () => saveConsent(true));
  document.getElementById('customize-cookies').addEventListener('click', openSettings);
  document.getElementById('cookie-settings').addEventListener('click', openSettings);
  document.getElementById('save-cookies').addEventListener('click', () => saveConsent(toggle.checked));
  banner.hidden = !!consent;
  const link = document.getElementById('booking-link');
  const services = {
    first: {id:'33',tag:'VAŠE PRVNÍ EMS ZKUŠENOST',name:'EMS Poprvé',description:'Seznámení s technologií, individuální nastavení a úvodní trénink s osobním trenérem.',duration:'První návštěva: 60 minut'},
    returning: {id:'32',tag:'POKRAČUJEME VE VAŠEM TRÉNINKU',name:'EMS Znám',description:'Navazující EMS trénink s osobním trenérem pro ty, kteří už absolvovali úvodní lekci.',duration:'Rezervační blok: 30 minut'}
  };
  document.querySelectorAll('input[name="service"]').forEach(input => input.addEventListener('change', () => {
    const service = services[input.value];
    document.getElementById('service-tag').textContent = service.tag;
    document.getElementById('service-name').textContent = service.name;
    document.getElementById('service-description').textContent = service.description;
    document.getElementById('service-duration').textContent = service.duration;
    link.href = 'https://bodyexpress.cz/reservanto/ems/' + service.id + '/terminy?l=405';
  }));
  link.addEventListener('click', () => {
    if (consent?.marketing && config.trackingEnabled && pixelLoaded) window.fbq('trackCustom', 'BookingCalendarOpen', {studio:'Znojmo'});
    // Kliknutí na kalendář není Lead, Schedule ani Purchase.
  });
  if (settings.apiEnabled) {
    fetch(api('/api/config'), {credentials:'same-origin'}).then(r => r.ok ? r.json() : null).then(value => {
      if (value && typeof value.trackingEnabled === 'boolean') config = value;
      return applyConsent();
    }).catch(() => {});
  }
})();
