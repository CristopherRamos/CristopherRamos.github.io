/* =====================================================================
   EFEITOS.JS — a parte "inteligente" das animações (CR Store)
   O visual está no efeitos.css; aqui ficam os efeitos que dependem do
   mouse, da rolagem e do tempo.

   >>> PAINEL DE LIGA/DESLIGA: mude true/false e pronto <<<
   ===================================================================== */
const EFEITOS = {
  abertura:      true,   // tela de abertura com o logo girando (1x por visita; teste com ?intro no endereço)
  barraProgresso:true,   // fio dourado no topo que enche conforme você rola
  aura:          true,   // luz dourada suave que segue o mouse (só computador)
  fagulhas:      true,   // fagulhas douradas no rastro do mouse e ao clicar (só computador)
  inclinarCards: true,   // cards inclinam em 3D e ganham "holofote" (só computador)
  parallax:      true    // o fundo do topo se move mais devagar que a página
};

(function(){
  const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const temMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const novo = (tag, id, cls) => { const e = document.createElement(tag); if(id) e.id = id; if(cls) e.className = cls; return e; };

  /* ---------- ABERTURA ---------- */
  if(EFEITOS.abertura && !menosMovimento){
    let jaViu = false;
    try{ jaViu = sessionStorage.getItem('cr_intro') === '1'; }catch(e){}
    if(!jaViu || /[?&]intro/.test(location.search)){
      try{ sessionStorage.setItem('cr_intro', '1'); }catch(e){}
      const sp = novo('div', 'ef-splash');
      sp.innerHTML = '<div class="ef-splash-logo"><img src="images/logo.jpg" alt=""></div><div class="ef-splash-nome">CR STORE</div><div class="ef-splash-barra"><i></i></div>';
      document.documentElement.appendChild(sp);
      document.documentElement.style.overflow = 'hidden';
      const inicio = Date.now();
      const sair = () => { sp.classList.add('ef-sai'); document.documentElement.style.overflow = ''; setTimeout(() => sp.remove(), 1000); };
      window.addEventListener('load', () => setTimeout(sair, Math.max(0, 1500 - (Date.now() - inicio))));
      setTimeout(sair, 3500); // garantia: nunca trava o site
    }
  }

  /* ---------- BARRA DE PROGRESSO + PARALLAX ---------- */
  const barra = EFEITOS.barraProgresso ? document.body.appendChild(novo('div', 'ef-progresso')) : null;
  const hero = document.querySelector('.hero');
  let ticking = false;
  function aoRolar(){
    ticking = false;
    const y = window.scrollY, h = document.documentElement.scrollHeight - innerHeight;
    if(barra) barra.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
    if(EFEITOS.parallax && hero && !menosMovimento && y < innerHeight * 1.2) hero.style.backgroundPositionY = 'calc(50% + ' + (y * 0.25) + 'px)';
  }
  addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(aoRolar); } }, {passive:true});
  aoRolar();

  /* ---------- CARDS EM CASCATA (entram um depois do outro) ---------- */
  const grade = document.getElementById('product-grid');
  if(grade) new MutationObserver(() => {
    Array.prototype.forEach.call(grade.children, (c, i) => { c.style.transitionDelay = (i % 4) * 90 + 'ms'; });
  }).observe(grade, {childList:true});

  /* ---------- CONTADOR DO CARRINHO PULA AO MUDAR ---------- */
  ['cart-count', 'fav-nav-count'].forEach(id => {
    const el = document.getElementById(id);
    if(el) new MutationObserver(() => { el.classList.remove('ef-pula'); void el.offsetWidth; el.classList.add('ef-pula'); })
      .observe(el, {childList:true, characterData:true, subtree:true});
  });

  if(!temMouse || menosMovimento) return; // o resto é só pra quem usa mouse

  /* ---------- AURA + FAGULHAS + INCLINAÇÃO DOS CARDS ---------- */
  const aura = EFEITOS.aura ? document.body.appendChild(novo('div', 'ef-aura')) : null;
  let ax = 0, ay = 0, mx = 0, my = 0, ultimaFagulha = 0, animando = false;
  function seguir(){
    ax += (mx - ax) * 0.14; ay += (my - ay) * 0.14;
    aura.style.transform = 'translate(' + ax + 'px,' + ay + 'px)';
    if(Math.abs(mx - ax) + Math.abs(my - ay) > 0.5) requestAnimationFrame(seguir); else animando = false;
  }
  function fagulha(x, y, forte){
    const f = novo('span', '', 'ef-fagulha');
    f.textContent = Math.random() > .5 ? '✦' : '✧';
    const ang = Math.random() * Math.PI * 2, dist = forte ? 40 + Math.random() * 50 : 8 + Math.random() * 14;
    f.style.cssText = 'left:' + x + 'px;top:' + y + 'px;--dx:' + Math.cos(ang) * dist + 'px;--dy:' + (Math.sin(ang) * dist + (forte ? 0 : 18)) + 'px;--d:' + (forte ? .9 : .7) + 's;font-size:' + (8 + Math.random() * 8) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }
  let cardAtual = null;
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if(aura){ aura.classList.add('ef-on'); if(!animando){ animando = true; requestAnimationFrame(seguir); } }
    if(EFEITOS.fagulhas && Date.now() - ultimaFagulha > 70){ ultimaFagulha = Date.now(); fagulha(mx, my, false); }
    if(EFEITOS.inclinarCards){
      const card = e.target.closest && e.target.closest('.card');
      if(cardAtual && cardAtual !== card) soltar(cardAtual);
      if(card){
        cardAtual = card;
        const r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.classList.remove('ef-solta');
        card.style.setProperty('--mx', (px * 100) + '%'); card.style.setProperty('--my', (py * 100) + '%');
        if(card.classList.contains('in-view')) card.style.transform = 'perspective(900px) rotateX(' + ((.5 - py) * 7) + 'deg) rotateY(' + ((px - .5) * 9) + 'deg) translateY(-4px)';
      }
    }
  }, {passive:true});
  function soltar(c){ c.classList.add('ef-solta'); c.style.transform = ''; if(c === cardAtual) cardAtual = null; }
  document.addEventListener('pointerleave', () => { if(aura) aura.classList.remove('ef-on'); if(cardAtual) soltar(cardAtual); });
  // explosão de fagulhas ao clicar em botões e links
  if(EFEITOS.fagulhas) addEventListener('click', e => {
    if(e.target.closest && e.target.closest('button, a, .chip')) for(let i = 0; i < 9; i++) fagulha(e.clientX, e.clientY, true);
  });
})();
