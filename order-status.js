'use strict';
(() => {
  const text = document.getElementById('order-status');
  const heading = document.getElementById('order-heading');
  const retry = document.getElementById('retry-status');
  const appointmentNote = document.getElementById('appointment-note');
  const config = window.BODYEXPRESS_CONFIG || {};
  const session = new URLSearchParams(location.search).get('session_id') || '';
  const revoke = document.createElement('button');
  revoke.type = 'button';
  revoke.textContent = 'Odvolat souhlas s měřením nákupu';
  revoke.hidden = true;
  document.querySelector('.actions').after(revoke);
  const revokeStatus = document.createElement('p');
  revokeStatus.setAttribute('role','status');
  revoke.after(revokeStatus);
  let verifiedEndpoint = '';
  revoke.addEventListener('click', async () => {
    if (!verifiedEndpoint) return;
    revoke.disabled = true;
    try {
      const response = await fetch(`${verifiedEndpoint}/api/orders/marketing-consent?session_id=${encodeURIComponent(session)}`, {method:'DELETE',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      const result = await response.json();
      if (!response.ok || result.revoked !== true) throw new Error('Not revoked');
      revoke.hidden = true;
      revokeStatus.textContent = 'Souhlas s měřením této objednávky byl odvolán. Zakoupená lekce se tím neruší.';
    } catch {
      revokeStatus.textContent = 'Odvolání se nepodařilo potvrdit. Zkuste to znovu nebo kontaktujte studio.';
      revoke.disabled = false;
    }
  });
  async function check() {
    retry.hidden = true;
    if (appointmentNote) appointmentNote.hidden = false;
    if (!config.apiEnabled) {
      heading.textContent = 'Online platbu připravujeme';
      text.textContent = 'Tento náhled není připojený k platebnímu systému. Žádnou platbu ani termín zde nepotvrzujeme.';
      return;
    }
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9]{12,240}$/.test(session)) {
      heading.textContent = 'Chybí odkaz k objednávce';
      text.textContent = 'Použijte návratový odkaz z platby nebo se obraťte na studio. Neopakujte platbu bez ověření.';
      return;
    }
    text.textContent = 'Ověřujeme stav platby…';
    try {
      const base = new URL(config.apiBase || '/', location.origin);
      if (base.origin !== location.origin || base.username || base.password || base.search || base.hash) throw new Error('Same-origin API required');
      const response = await fetch(`${base.href.replace(/\/$/,'')}/api/orders/status?session_id=${encodeURIComponent(session)}`, {credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Not verified');
      const order = await response.json();
      if (!['pending','paid','expired','failed','partially_refunded','refunded'].includes(order.status)) throw new Error('Invalid status');
      verifiedEndpoint = base.href.replace(/\/$/,'');
      revoke.hidden = false;
      if (order.status === 'paid' && order.paid === true) {
        if (typeof order.testMode !== 'boolean') throw new Error('Unverified payment mode');
        heading.textContent = order.testMode ? 'Testovací platba je potvrzená' : 'Platba je potvrzená';
        text.textContent = order.testMode ? 'Proběhla pouze testovací platba Stripe. Nevznikla skutečná úhrada, objednávka lekce ani rezervace termínu.' : 'Děkujeme za úhradu první lekce. Zavolejte nám a společně vybereme termín. Termín zatím není potvrzený.';
        if (!order.testMode && order.appointmentConfirmed === true) {
          if (typeof order.confirmedStartsAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(order.confirmedStartsAt) || !Number.isFinite(Date.parse(order.confirmedStartsAt))) throw new Error('Unverified appointment');
          const date = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Prague' }).format(new Date(order.confirmedStartsAt));
          heading.textContent = 'Platba i termín jsou potvrzené';
          text.textContent = `Studio potvrdilo vaši první lekci: ${date} (čas v ČR). Těšíme se na vás v BODYEXPRESS Znojmo, Kovářská 307/6. Případnou změnu domluvte přímo se studiem.`;
          if (appointmentNote) appointmentNote.hidden = true;
        }
      } else if (['refunded','partially_refunded'].includes(order.status)) {
        heading.textContent = 'Platba byla vrácena';
        text.textContent = order.status === 'refunded' ? 'Úhrada byla vrácena v plné výši. Podrobnosti ověřte se studiem.' : 'Část úhrady byla vrácena. Podrobnosti ověřte se studiem.';
      } else if (['expired','failed'].includes(order.status)) {
        heading.textContent = 'Platba není potvrzená';
        text.textContent = 'Platba nebyla dokončena nebo platnost odkazu vypršela. Pokud byla částka stržena, nejprve kontaktujte studio.';
      } else {
        heading.textContent = 'Čekáme na potvrzení platby';
        text.textContent = 'Potvrzení může chvíli trvat. Zkuste stav znovu ověřit. Platbu zatím neopakujte.';
        retry.hidden = false;
      }
    } catch {
      heading.textContent = 'Platbu se nepodařilo ověřit';
      text.textContent = 'To neznamená, že platba neproběhla. Zkuste ověření znovu nebo zavolejte do studia. Platbu zatím neopakujte.';
      retry.hidden = false;
    }
  }
  retry.addEventListener('click',check);
  check();
})();
