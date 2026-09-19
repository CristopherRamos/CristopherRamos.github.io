/* =====================================================================
   SCRIPT.JS — CR Store (motor do site)
   Aqui mora só a "engrenagem": catálogo, paginação, carrossel,
   carrinho e o envio do pedido pro WhatsApp — nenhum dado de produto
   fica aqui. Pra mexer em produtos, preços, fotos ou no número do
   WhatsApp, quem você quer é o arquivo produtos.js, carregado ANTES
   deste (ele te dá as variáveis WHATSAPP_NUMERO, ITENS_POR_PAGINA,
   products e offers que este arquivo usa).
   ===================================================================== */

const fmt = v => v.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

/* ---------------------------------------------------------------------
   ícone de frasco (usado só quando o produto NÃO tem foto real, ou
   seja, quando img:null). Se você já colocou fotos em todos os
   produtos, pode ignorar essa função por completo.
   --------------------------------------------------------------------- */
const bottleSVG = (color1, color2) => `
  <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g${color1}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${color1}"/>
        <stop offset="100%" stop-color="${color2}"/>
      </linearGradient>
    </defs>
    <rect x="40" y="10" width="20" height="16" rx="2" fill="#c9a227"/>
    <rect x="44" y="4" width="12" height="10" rx="2" fill="#8a6a1f"/>
    <path d="M30 30 Q30 26 36 26 L64 26 Q70 26 70 30 L74 120 Q74 132 62 132 L38 132 Q26 132 26 120 Z" fill="url(#g${color1})" stroke="#e8c766" stroke-width="1.2"/>
    <rect x="34" y="55" width="32" height="42" rx="1" fill="rgba(232,199,102,0.14)" stroke="#e8c766" stroke-width="0.6"/>
    <circle cx="50" cy="76" r="8" fill="none" stroke="#e8c766" stroke-width="0.8"/>
  </svg>`;

// -------------------------------------------------------------------
// MINI-CARROSSEL DE FOTOS DO CARD
// Todo produto tem sempre 3 "posições" de foto (0, 1 e 2). Pra cada
// posição: se você preencheu img/img2/img3 com o nome de um arquivo,
// mostra a foto real; se ainda estiver null, mostra um ícone de
// frasco (numa variação de cor diferente) só como prévia, pra você
// já ver o carrossel funcionando em todos os 60 produtos antes de
// colocar as fotos de verdade.
// -------------------------------------------------------------------

// 3 variações de cor do ícone de frasco, usadas como prévia enquanto
// a foto real (img/img2/img3) daquele produto ainda não foi colocada.
function placeholderIcon(p, slot){
  const variants = [
    [p.c[0], p.c[1]],   // posição 1: cor original do produto
    [p.c[1], p.c[0]],   // posição 2: cor invertida (efeito "outro ângulo")
    ["#c9a227", "#2a2115"], // posição 3: variação dourada mais clara
  ];
  const [c1, c2] = variants[slot % variants.length];
  return bottleSVG(c1, c2);
}

// Formatos de imagem que o site tenta, nessa ordem, até achar o
// arquivo. Assim não precisa se preocupar se salvou como .jpg, .jpeg,
// .png ou .webp — um desses vai bater com o nome certo.
const EXTENSOES_FOTO = ['jpg', 'jpeg', 'png', 'webp'];

// Monta o caminho esperado da foto de um produto, pela convenção de
// nome: produto-<id>.jpg (posição 0), produto-<id>-2.jpg (posição 1),
// produto-<id>-3.jpg (posição 2).
function caminhoFoto(productId, slot, ext){
  const sufixo = slot === 0 ? '' : `-${slot + 1}`;
  return `images/produto-${productId}${sufixo}.${ext}`;
}

// Retorna o HTML da posição "slot" (0, 1 ou 2) de um produto: tenta
// carregar a foto real pelo nome padrão (produto-N.jpg); se não achar
// em nenhuma extensão, mostra o ícone de prévia (ver testarFoto acima).

// Testa se existe foto real pra um produto + posição. Dispara o teste
// de TODAS as extensões (jpg, jpeg, png, webp) ao mesmo tempo — em vez
// de uma de cada vez — e usa a primeira que existir, respeitando a
// ordem de prioridade. Isso evita que, em conexões de celular mais
// lentas, uma foto (por exemplo, salva em .webp) demore vários
// "vai-e-volta" de rede pra aparecer só porque é testada por último.
// Quando termina de testar todas, chama callback(caminho) se achou
// alguma, ou callback(null) se não existe foto nenhuma nessa posição.
function testarFoto(pid, slot, extIndex, callback){
  const resultados = new Array(EXTENSOES_FOTO.length).fill(undefined);
  let pendentes = EXTENSOES_FOTO.length;

  function finalizarSeCompleto(){
    if(pendentes > 0) return;
    const encontrado = resultados.find(r => r);
    callback(encontrado || null);
  }

  EXTENSOES_FOTO.forEach((ext, i) => {
    const teste = new Image();
    const src = caminhoFoto(pid, slot, ext);
    teste.onload = () => { resultados[i] = src; pendentes--; finalizarSeCompleto(); };
    teste.onerror = () => { resultados[i] = null; pendentes--; finalizarSeCompleto(); };
    teste.src = src;
  });
}

// Retorna o HTML da posição "slot" (0, 1 ou 2) de um produto. SEMPRE
// devolve o ícone de prévia (frasco dourado) na hora — nunca aparece
// ícone de foto quebrada. Por trás dos panos, testa se existe foto
// real; se achar, troca sozinho o conteúdo do elemento de id
// "containerId" assim que a foto terminar de carregar de verdade.
function slotVisual(p, slot, containerId){
  testarFoto(p.id, slot, 0, (src) => {
    if(!src) return; // nenhuma foto encontrada -> mantém o ícone de prévia
    const el = document.getElementById(containerId);
    if(!el) return; // o card já não está mais na tela (trocou de página, fechou o carrinho...)
    el.innerHTML = `<img src="${src}" alt="${p.name}" onclick="event.stopPropagation(); openLightbox(this.src)">`;
  });
  return placeholderIcon(p, slot);
}

// Abre a foto em tela cheia (zoom). Chamada pelo clique em qualquer
// foto real de produto — não faz nada nos ícones de prévia dourados.
function openLightbox(src){
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-overlay').classList.add('open');
}
function closeLightbox(){
  document.getElementById('lightbox-overlay').classList.remove('open');
}

// Imagem "única" do produto — usada onde só cabe UMA foto por vez
// (carrinho e carrossel de ofertas do topo): sempre a posição 0.
// "containerId" é o id do elemento que deve ser atualizado quando a
// foto real (se existir) terminar de carregar.
function productVisual(p, containerId){
  return slotVisual(p, 0, containerId);
}

// Guarda em qual posição (0, 1 ou 2) cada card do catálogo está parado.
// Ex: cardImageIndex[5] = 1  -> o produto de id 5 está mostrando a 2ª posição.
let cardImageIndex = {};

// Monta o conteúdo visual do card no catálogo, respeitando a posição
// atual dele. Chamado tanto na primeira renderização quanto de novo
// (só essa parte, sem redesenhar o card inteiro) quando o cliente
// clica nas setinhas ‹ ›.
function cardVisual(p, containerId){
  const slot = cardImageIndex[p.id] || 0;
  return slotVisual(p, slot, containerId);
}

// Troca a foto do card (chamado pelas setinhas ‹ ›). delta é -1 ou +1.
function changeCardImage(id, delta){
  cardImageIndex[id] = ((cardImageIndex[id] || 0) + delta + 3) % 3;
  updateCardVisual(id);
}

// Vai direto pra uma posição específica (chamado ao clicar numa bolinha).
function goToCardImage(id, i){
  cardImageIndex[id] = i;
  updateCardVisual(id);
}

// Redesenha só o quadrado da foto + as bolinhas do card (sem mexer no
// resto do card, é mais rápido e não "pisca" o card inteiro).
function updateCardVisual(id){
  const p = products.find(pr => pr.id === id);
  const icon = document.getElementById(`icon-${id}`);
  if(icon) icon.innerHTML = cardVisual(p, `icon-${id}`);
  document.querySelectorAll(`.mini-dot[data-pid="${id}"]`).forEach((dot,i) => {
    dot.classList.toggle('active', i === (cardImageIndex[id] || 0));
  });
}

// Gera o HTML das setinhas ‹ › e das 3 bolinhas — aparece em TODOS os
// cards, dos 60 produtos, em todas as páginas (não depende de você já
// ter colocado foto real ou não).
function cardCarouselControls(p){
  const dots = [0,1,2].map(i =>
    `<button class="mini-dot ${i===(cardImageIndex[p.id]||0)?'active':''}" data-pid="${p.id}" onclick="event.stopPropagation(); goToCardImage(${p.id}, ${i})"></button>`
  ).join('');
  return `
    <button class="mini-arrow left" onclick="event.stopPropagation(); changeCardImage(${p.id}, -1)">‹</button>
    <button class="mini-arrow right" onclick="event.stopPropagation(); changeCardImage(${p.id}, 1)">›</button>
    <div class="mini-dots">${dots}</div>`;
}

/* =====================================================================
   ANIMAÇÃO DE ENTRADA AO ROLAR A PÁGINA
   Qualquer elemento com a classe "reveal" começa invisível e sobe
   suavemente na tela quando o usuário rola até ele (título da coleção,
   cards de produto, faixa de destaques, rodapé...). O efeito em si
   está no style.css (.reveal / .reveal.in-view) — aqui é só o
   "sensor" que liga a classe .in-view na hora certa.
   ===================================================================== */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target); // já apareceu, não precisa observar de novo
    }
  });
}, { threshold: 0.15 });

function observeReveal(el){ revealObserver.observe(el); }

// elementos que já existem no HTML desde o início (título da coleção,
// faixa "100% / Envio / Pedido", rodapé) — os cards de produto são
// observados dinamicamente lá na função renderGrid().
document.querySelectorAll('.reveal').forEach(observeReveal);

/* =====================================================================
   4) CATÁLOGO — filtro por categoria + paginação (Página 1, 2, 3...)
   Não precisa mexer aqui pra trocar produto/preço/foto — isso é tudo
   lá em cima, no item 2. Aqui é só a lógica que desenha a tela.
   ===================================================================== */
let currentFilter = 'todos';
let currentPage = 1;
let searchTerm = '';

// tira acento pra busca não ficar chata ("orquidea" tem que achar "Orquídea")
function normalizar(str){
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function filteredProducts(){
  let list = products;
  if(currentFilter === 'favoritos') list = list.filter(p => isFavorite(p.id));
  else if(currentFilter !== 'todos') list = list.filter(p => p.cat === currentFilter);

  if(searchTerm){
    const termo = normalizar(searchTerm);
    list = list.filter(p =>
      normalizar(p.name).includes(termo) ||
      normalizar(p.tag).includes(termo) ||
      normalizar(p.note).includes(termo)
    );
  }
  return list;
}

/* =====================================================================
   FAVORITOS (lista de desejos)
   Guardado no localStorage do navegador do cliente — continua salvo
   mesmo se ele fechar a aba e voltar depois, sem precisar de login.
   ===================================================================== */
function loadFavorites(){
  try{ return JSON.parse(localStorage.getItem('cr_favoritos')) || []; }
  catch(e){ return []; }
}
let favorites = loadFavorites();

function isFavorite(id){ return favorites.includes(id); }

function toggleFavorite(id){
  favorites = isFavorite(id) ? favorites.filter(f => f !== id) : [...favorites, id];
  localStorage.setItem('cr_favoritos', JSON.stringify(favorites));
  document.querySelectorAll(`.fav-btn[data-pid="${id}"]`).forEach(btn => btn.classList.toggle('active', isFavorite(id)));
  updateFavNavCount();
  if(currentFilter === 'favoritos') renderGrid(); // se estava filtrando por favoritos, atualiza a lista na hora
}

// número de favoritos que aparece "pulando" no coração do cabeçalho
function updateFavNavCount(){
  document.getElementById('fav-nav-count').textContent = favorites.length;
}

// clique no coração do cabeçalho: leva direto pra coleção já filtrada
// só nos favoritos — essa é a "aba" de favoritos do site.
function goToFavorites(){
  currentFilter = 'favoritos';
  currentPage = 1;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === 'favoritos'));
  renderGrid();
  document.getElementById('colecao').scrollIntoView({behavior:'smooth', block:'start'});
}

// selo (Oferta / Mais vendido / Lançamento) — só aparece se o produto
// estiver no array "offers" do produtos.js.
function offerBadgeFor(id){
  const offer = offers.find(o => o.productId === id);
  return offer ? offer.badge : null;
}

function renderGrid(){
  const grid = document.getElementById('product-grid');
  const emptyState = document.getElementById('empty-state');
  const list = filteredProducts();

  emptyState.hidden = list.length > 0;
  const totalPages = Math.max(1, Math.ceil(list.length / ITENS_POR_PAGINA));
  if(currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * ITENS_POR_PAGINA;
  const pageItems = list.slice(start, start + ITENS_POR_PAGINA);

  grid.innerHTML = '';
  pageItems.forEach((p, index) => {
    const card = document.createElement('article');
    card.className = 'card reveal';
    card.style.transitionDelay = `${(index % ITENS_POR_PAGINA) * 0.06}s`; // efeito cascata
    const badge = offerBadgeFor(p.id);
    card.innerHTML = `
      <div class="card-icon-wrap">
        ${badge ? `<span class="card-badge">${badge}</span>` : ''}
        <button class="fav-btn ${isFavorite(p.id)?'active':''}" data-pid="${p.id}" onclick="event.stopPropagation(); toggleFavorite(${p.id})" aria-label="Favoritar">♥</button>
        <div class="card-icon" id="icon-${p.id}">${cardVisual(p, 'icon-'+p.id)}</div>
        ${cardCarouselControls(p)}
      </div>
      <div class="card-tag">${p.tag}</div>
      <div class="card-name">${p.name}</div>
      <div class="card-note">${p.note}</div>
      <div class="price-list">
        <div class="price-row price-row-action">
          <span class="price-label">Atacado</span>
          <span class="price-right">
            <span class="price-val">${fmt(p.atacado)}</span>
            <button class="mini-add" onclick="event.stopPropagation(); addToCart(${p.id}, 'atacado')" aria-label="Adicionar atacado ao carrinho">+</button>
          </span>
        </div>
        <div class="price-row price-row-action">
          <span class="price-label">Decant 5ml</span>
          <span class="price-right">
            <span class="price-val">${fmt(p.decant)}</span>
            <button class="mini-add" onclick="event.stopPropagation(); addToCart(${p.id}, 'decant')" aria-label="Adicionar decant ao carrinho">+</button>
          </span>
        </div>
      </div>
      <div class="card-foot">
        <div>
          <span class="price-label">Varejo</span>
          <span class="card-price">${fmt(p.price)}</span>
        </div>
        <button class="add-btn" onclick="addToCart(${p.id}, 'varejo')">+</button>
      </div>`;
    grid.appendChild(card);
    observeReveal(card); // registra o card na animação de entrada ao rolar
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const el = document.getElementById('pagination');
  if(totalPages <= 1){ el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${currentPage===1?'disabled':''} onclick="goToPage(${currentPage-1})">‹</button>`;
  for(let i=1; i<=totalPages; i++){
    html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goToPage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${currentPage===totalPages?'disabled':''} onclick="goToPage(${currentPage+1})">›</button>`;
  el.innerHTML = html;
}

function goToPage(n){
  currentPage = n;
  renderGrid();
  document.getElementById('colecao').scrollIntoView({behavior:'smooth', block:'start'});
}

document.getElementById('chips').addEventListener('click', e => {
  if(!e.target.classList.contains('chip')) return;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  currentPage = 1;               // volta pra página 1 ao trocar de categoria
  renderGrid();
});

document.getElementById('search-input').addEventListener('input', e => {
  searchTerm = e.target.value;
  currentPage = 1;
  renderGrid();
});

renderGrid();
updateFavNavCount();

/* =====================================================================
   MENU MOBILE (hambúrguer no cabeçalho)
   ===================================================================== */
function toggleMobileMenu(){
  const open = document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', open);
}
function closeMobileMenu(){
  document.getElementById('mobile-menu').classList.remove('open');
  document.getElementById('menu-btn').setAttribute('aria-expanded', 'false');
}

/* =====================================================================
   CABEÇALHO COM SOMBRA AO ROLAR + BOTÃO "VOLTAR AO TOPO"
   ===================================================================== */
const headerEl = document.querySelector('header');
const topFloatEl = document.getElementById('top-float');
window.addEventListener('scroll', () => {
  const rolou = window.scrollY > 40;
  headerEl.classList.toggle('scrolled', rolou);
  topFloatEl.classList.toggle('visible', window.scrollY > 500);
});

/* =====================================================================
   5) CARROSSEL DE OFERTAS — lógica (troca de slide, setas, bolinhas,
   autoplay a cada 5s). Os itens vêm do array "offers" lá em cima.
   ===================================================================== */
let offerIndex = 0;
let offerTimer = null;

function renderOffer(){
  const slideEl = document.getElementById('offer-slide');
  slideEl.style.opacity = '0';        // esconde o slide atual...
  setTimeout(() => {
    fillOfferSlide();
    slideEl.style.opacity = '1';      // ...e mostra o novo com um fade suave
  }, 180);
}

function fillOfferSlide(){
  const offer = offers[offerIndex];
  const p = products.find(prod => prod.id === offer.productId);
  if(!p) return;

  document.getElementById('offer-slide').innerHTML = `
    <span class="offer-badge" style="position:static; margin-bottom:10px;">${offer.badge}</span>
    <div class="card-icon" id="offer-icon">${productVisual(p, 'offer-icon')}</div>
    <div class="offer-name">${p.name}</div>
    <div class="offer-tag">${p.tag}</div>
    <div class="offer-prices">
      ${offer.oldPrice ? `<span class="offer-old">${fmt(offer.oldPrice)}</span>` : ''}
      <span class="offer-price">${fmt(p.price)}</span>
    </div>
    <button class="offer-cta" onclick="document.getElementById('colecao').scrollIntoView({behavior:'smooth'})">Ver na coleção</button>`;

  document.getElementById('offer-dots').innerHTML = offers.map((o,i) =>
    `<button class="offer-dot ${i===offerIndex?'active':''}" onclick="goToOffer(${i})"></button>`
  ).join('');
}

function nextOffer(){ offerIndex = (offerIndex + 1) % offers.length; renderOffer(); restartAutoplay(); }
function prevOffer(){ offerIndex = (offerIndex - 1 + offers.length) % offers.length; renderOffer(); restartAutoplay(); }
function goToOffer(i){ offerIndex = i; renderOffer(); restartAutoplay(); }

function restartAutoplay(){
  clearInterval(offerTimer);
  offerTimer = setInterval(nextOffer, 5000); // troca de slide sozinho a cada 5s
}

renderOffer();
restartAutoplay();

/* =====================================================================
   6) CARRINHO DE COMPRAS
   (Fica só na memória da página — se o cliente recarregar o site, o
   carrinho reseta. Isso é proposital pra não precisar de servidor.)

   Cada item do carrinho guarda também a "variant" (variante):
   "varejo" ou "decant" — assim, se o cliente adicionar o mesmo
   perfume nas duas versões, elas aparecem como duas linhas
   separadas no carrinho (com preços diferentes).
   ===================================================================== */
let cart = [];

// variant: "varejo" (padrão, preço normal), "atacado" ou "decant".
function addToCart(id, variant){
  variant = variant || 'varejo';
  const key = `${id}_${variant}`;
  const existing = cart.find(i => i.key === key);
  if(existing){ existing.qty += 1; }
  else{
    const p = products.find(p => p.id === id);
    const price = variant === 'decant' ? p.decant : variant === 'atacado' ? p.atacado : p.price;
    cart.push({
      key, id:p.id, variant, qty:1, price,
      name:p.name, c:p.c
    });
  }
  renderCart();
  openCart();
}
function changeQty(key, delta){
  const item = cart.find(i => i.key === key);
  if(!item) return;
  item.qty += delta;
  if(item.qty <= 0) cart = cart.filter(i => i.key !== key);
  renderCart();
}
function removeItem(key){
  cart = cart.filter(i => i.key !== key);
  renderCart();
}
function cartTotal(){ return cart.reduce((s,i)=> s + i.price*i.qty, 0); }

// Rótulo mostrado no carrinho e na mensagem do WhatsApp quando o item
// é atacado ou decant, pra ficar claro qual variante o cliente escolheu.
function variantLabel(i){
  if(i.variant === 'decant') return ' (Decant 5ml)';
  if(i.variant === 'atacado') return ' (Atacado)';
  return '';
}

function renderCart(){
  const body = document.getElementById('drawer-body');
  const count = cart.reduce((s,i)=>s+i.qty,0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total-mini').textContent = fmt(cartTotal());
  document.getElementById('drawer-total').textContent = fmt(cartTotal());
  document.getElementById('checkout-open').disabled = cart.length === 0;

  if(cart.length === 0){
    body.innerHTML = '<p class="empty-cart">Seu carrinho está vazio.<br>Adicione um perfume da coleção.</p>';
    return;
  }
  body.innerHTML = cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-icon" id="cart-icon-${i.key}">${productVisual(i, 'cart-icon-'+i.key)}</div>
      <div class="cart-item-info">
        <div class="name">${i.name}${variantLabel(i)}</div>
        <div class="unit">${fmt(i.price)} un.</div>
        <div class="qty-row">
          <button class="qty-btn" onclick="changeQty('${i.key}',-1)">−</button>
          <span>${i.qty}</span>
          <button class="qty-btn" onclick="changeQty('${i.key}',1)">+</button>
          <button class="remove-item" onclick="removeItem('${i.key}')">remover</button>
        </div>
      </div>
      <div class="item-total">${fmt(i.price*i.qty)}</div>
    </div>`).join('');
}

function openCart(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
}
function closeCart(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

/* =====================================================================
   7) CHECKOUT -> ENVIO PARA O WHATSAPP
   Monta a mensagem com os itens do carrinho + dados do cliente e abre
   o WhatsApp já com o texto pronto (número definido no item 1, lá em cima).
   ===================================================================== */
function openCheckout(){
  if(cart.length === 0) return;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeCheckout(){
  document.getElementById('modal-overlay').classList.remove('open');
}

function sendToWhatsApp(){
  const nome = document.getElementById('f-nome').value.trim();
  const endereco = document.getElementById('f-endereco').value.trim();
  const pagamento = document.getElementById('f-pagamento').value;
  const obs = document.getElementById('f-obs').value.trim();

  if(!nome || !endereco){
    alert('Preencha nome e endereço para enviar o pedido.');
    return;
  }

  let msg = `Olá, CR Store! Gostaria de finalizar meu pedido:\n\n`;
  cart.forEach(i => {
    msg += `• ${i.qty}x ${i.name}${variantLabel(i)} — ${fmt(i.price)} = ${fmt(i.price*i.qty)}\n`;
  });
  msg += `\n*Total: ${fmt(cartTotal())}*\n\n`;
  msg += `*Nome:* ${nome}\n`;
  msg += `*Endereço:* ${endereco}\n`;
  msg += `*Pagamento:* ${pagamento}\n`;
  if(obs) msg += `*Observações:* ${obs}\n`;

  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
  closeCheckout();
  closeCart();
}
