(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const menuButton = $('#menu-toggle');
  const menu = $('#main-nav');
  function closeMenu() { menu.classList.remove('open'); menuButton.setAttribute('aria-expanded','false'); menuButton.setAttribute('aria-label','Otevřít menu'); }
  menuButton.addEventListener('click', () => { const open = menuButton.getAttribute('aria-expanded') !== 'true'; menuButton.setAttribute('aria-expanded',String(open)); menuButton.setAttribute('aria-label',open ? 'Zavřít menu' : 'Otevřít menu'); menu.classList.toggle('open',open); });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event => { if(event.key==='Escape') closeMenu(); });

  const steps = [
    {eyebrow:'Pohyb je základ',title:'Necvičí za vás oblek.\nCvičíte vy.',description:'Během lekce děláte jednoduché pohyby. Trenér vám ukáže provedení a průběžně vás opraví, abyste věděli, co a proč děláte.',phase:'Vše začíná vaším pohybem'},
    {eyebrow:'Pohyb a stimulace společně',title:'Impulz se přidá\nk vašemu pohybu.',description:'Elektrody v EMS vybavení přivádějí impulzy, které stimulují svaly. Aktivní fáze se střídá s uvolněním. Intenzitu nastavuje trenér, nikoli tato ukázka.',phase:'Ilustrace aktivní fáze impulzu'},
    {eyebrow:'Lidské vedení od začátku',title:'Technologie s vámi.\nTrenér vedle vás.',description:'Trenér vede cviky a upravuje intenzitu podle průběhu lekce a vaší zkušenosti. Průběžně s ním komunikujete, co při tréninku vnímáte.',phase:'Nastavení a vedení trenérem'}
  ];
  const visual = $('#ems-visual');
  const playButton = $('#play-demo');
  let demoTimers = [];
  let playing = false;
  function clearDemoTimers() { demoTimers.forEach(clearTimeout); demoTimers=[]; }
  function showStep(index) {
    const step=steps[index];
    visual.dataset.step=String(index); visual.dataset.phase=index===1?'active':'rest';
    $('#diagram-index').textContent=`0${index+1} / 03`;
    $('#phase-label').textContent=step.phase;
    $('#step-eyebrow').textContent=step.eyebrow;
    $('#step-title').replaceChildren(...step.title.split('\n').flatMap((line,i)=>i ? [document.createElement('br'),document.createTextNode(line)] : [document.createTextNode(line)]));
    $('#step-description').textContent=step.description;
    document.querySelectorAll('[data-ems-step]').forEach(button=>{const active=Number(button.dataset.emsStep)===index; button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  }
  function stopDemo() { clearDemoTimers();playing=false;visual.dataset.playing='false';playButton.setAttribute('aria-pressed','false');playButton.querySelector('span').textContent=reducedMotion.matches?'Další krok':'Spustit ukázku'; }
  document.querySelectorAll('[data-ems-step]').forEach(button=>button.addEventListener('click',()=>{stopDemo();showStep(Number(button.dataset.emsStep));}));
  playButton.addEventListener('click',()=>{
    if(playing){stopDemo();return;}
    if(reducedMotion.matches){showStep((Number(visual.dataset.step)+1)%3);return;}
    playing=true;visual.dataset.playing='true';playButton.setAttribute('aria-pressed','true');playButton.querySelector('span').textContent='Pozastavit';showStep(0);
    demoTimers.push(setTimeout(()=>showStep(1),2400));
    demoTimers.push(setTimeout(()=>{visual.dataset.phase='rest';$('#phase-label').textContent='Ilustrace fáze uvolnění';},4800));
    demoTimers.push(setTimeout(()=>showStep(2),6500));
    demoTimers.push(setTimeout(stopDemo,9400));
  });
  reducedMotion.addEventListener('change',()=>{stopDemo();playButton.querySelector('span').textContent=reducedMotion.matches?'Další krok':'Spustit ukázku';});
  if(reducedMotion.matches)playButton.querySelector('span').textContent='Další krok';
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDemo();});

  const privacyDialog=$('#privacy-dialog');
  $('#cookie-settings').addEventListener('click',()=>privacyDialog.showModal());
  privacyDialog.addEventListener('click',event=>{if(event.target===privacyDialog){const r=privacyDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)privacyDialog.close();}});
  const mobileCta=$('#mobile-cta');
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>mobileCta.classList.toggle('hidden-by-order',entry.isIntersecting)),{threshold:.1});observer.observe($('.order-card'));}

})();
