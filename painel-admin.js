/* =====================================================================
   PAINEL-ADMIN.JS — painel de preços escondido dentro do próprio site.

   Como abrir: role até o final do site (rodapé) e clique no link
   discreto "Acesso admin", do lado do "© 2026 CR Store...". Ele pede
   uma senha antes de abrir o painel.

   TROCAR A SENHA — a senha padrão é "crstore2026". Pra trocar:
     1) Abra o navegador (Chrome, por exemplo) em qualquer página.
     2) Aperte F12 pra abrir o DevTools e clique na aba "Console".
     3) Cole a linha abaixo, trocando "novaSenha" pela senha que você
        quiser, e aperte Enter:

        crypto.subtle.digest('SHA-256', new TextEncoder().encode('novaSenha')).then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))

     4) Vai aparecer um código longo (tipo 6f7cb1b8...) — copia ele.
     5) Cola esse código aqui embaixo, no lugar do valor de
        PA_SENHA_HASH (mantendo as aspas).

   IMPORTANTE (seja honesto com você mesmo sobre isso): esse site é só
   HTML/JS estático, sem servidor por trás, então não existe uma senha
   "de verdade" possível aqui — é só uma trava pra não abrir o painel
   sem querer. Quem souber abrir o código-fonte da página (view-source)
   e for atrás consegue tentar adivinhar a senha rodando o mesmo
   cálculo de hash em várias tentativas offline, sem precisar acertar
   de primeira. Isso não deixa o site inseguro (só quem baixa o
   produtos.js novo e sobe no servidor muda o preço de verdade), mas
   não trate essa senha como se fosse a senha do seu banco.
   ===================================================================== */

(function(){

  var PA_SENHA_HASH = "6f7cb1b8caa4629e6aeb8aad9c0f2630138b0d876e29735d36aa17e42b2736ff"; // senha padrão: crstore2026
  var PA_STORAGE_KEY = 'cr_admin_precos_draft_v1';

  // o selo/preço riscado de cada produto vive no array "offers" separado
  // (pra não mexer no formato que o script.js já espera) — aqui a gente só
  // "empresta" esses dois valores pra dentro de cada produto, pra dar pra
  // editar na mesma tabela do painel junto com o resto
  products.forEach(function(p){
    var oferta = offers.find(function(o){ return o.productId === p.id; });
    p.badge = oferta ? oferta.badge : '';
    p.oldPrice = (oferta && oferta.oldPrice != null) ? oferta.oldPrice : null;
  });

  // guarda uma cópia intocada dos preços originais assim que a página
  // carrega, pra sempre saber o que mudou e pra poder "restaurar tudo"
  var paOriginalProducts = JSON.parse(JSON.stringify(products));

  var paFiltroCategoria = 'todos';
  var paTermoBusca = '';

  // fotos NOVAS escolhidas no painel (ainda não publicadas): { "12": { 0: {blob, ext, nome, url, kb, apagar}, 1: ... } }
  // ficam só na memória desta janela — por isso o aviso pra baixar o pacote antes de recarregar
  var paFotosNovas = {};

  /* ---------------------------------------------------------------
     abrir / fechar o painel
     --------------------------------------------------------------- */
  var painelEl = document.getElementById('painel-admin');

  function paAbrir(){
    painelEl.classList.add('pa-aberto');
    painelEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    paCarregarRascunho();                                 // só agora carrega o rascunho salvo (se tiver)
    paSincronizarFotosTemp();                             // fotos novas ainda não publicadas aparecem na prévia
    paReconstruirOffers();                                // reflete selos salvos no carrossel também
    if(typeof renderGrid === 'function') renderGrid();    // e só agora atualiza os cards do site, pra prévia
    paRender();
  }
  function paFechar(){
    painelEl.classList.remove('pa-aberto');
    painelEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // devolve os cards do site pros valores de verdade (os do produtos.js) —
    // o rascunho só deve aparecer enquanto o painel está mesmo aberto
    paFecharFicha(true);
    paReverterParaOriginal();
    window.FOTOS_TEMP = {};                               // some a prévia das fotos novas (elas continuam guardadas no painel)
    if(typeof renderGrid === 'function') renderGrid();
  }
  document.getElementById('pa-btn-fechar').addEventListener('click', paFechar);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && painelEl.classList.contains('pa-aberto')){
      if(fichaEl && !fichaEl.hidden) paFecharFicha(true);
      else paFechar();
    }
  });

  /* ---------------------------------------------------------------
     conferir a senha (hash SHA-256 via Web Crypto, funciona em
     qualquer navegador moderno, celular incluso)
     --------------------------------------------------------------- */
  function paBufferParaHex(buffer){
    return Array.from(new Uint8Array(buffer)).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
  }

  function paPedirSenha(e){
    if(e) e.preventDefault();
    if(!window.crypto || !window.crypto.subtle){
      alert('O painel de senha só funciona no site publicado (https://...) ou em localhost — não funciona abrindo o arquivo direto do computador (file://). Publique o site e tente de novo por lá.');
      return;
    }
    var senha = prompt('Senha de admin:');
    if(senha === null || senha === '') return; // cliente cancelou
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(senha)).then(function(buffer){
      if(paBufferParaHex(buffer) === PA_SENHA_HASH){
        paAbrir();
      } else {
        alert('Senha incorreta.');
      }
    });
  }

  document.getElementById('pa-link-acesso').addEventListener('click', paPedirSenha);

  // link com #preco no final do endereço também pede a senha — útil
  // pra deixar salvo nos favoritos do navegador/celular
  function paChecarHash(){
    if(window.location.hash === '#preco'){
      history.replaceState(null, '', window.location.pathname + window.location.search); // tira o #preco da barra de endereço
      paPedirSenha();
    }
  }
  paChecarHash();
  window.addEventListener('hashchange', paChecarHash);

  /* ---------------------------------------------------------------
     rascunho salvo no navegador — sobrevive a um F5
     --------------------------------------------------------------- */
  function paCarregarRascunho(){
    try{
      var salvo = JSON.parse(localStorage.getItem(PA_STORAGE_KEY));
      if(salvo && Array.isArray(salvo)){
        salvo.forEach(function(edit){
          var p = products.find(function(x){ return x.id === edit.id; });
          if(!p && edit.novo && edit.name){                  // produto criado pelo painel e ainda não publicado
            p = {id:edit.id, name:'', tag:'', note:'', price:'consultar', atacado:'consultar', decant:'consultar',
                 cat:'unissex', c:edit.c || ['#2a2115', '#0b0805'], custo:0, indicacao:false, badge:'', oldPrice:null, __novo:true};
            products.push(p);
          }
          if(p){
            p.price = edit.price; p.atacado = edit.atacado; p.decant = edit.decant;
            if(typeof edit.custo === 'number') p.custo = edit.custo;
            if(typeof edit.indicacao === 'boolean') p.indicacao = edit.indicacao;
            if(typeof edit.badge === 'string') p.badge = edit.badge;
            if(typeof edit.oldPrice !== 'undefined') p.oldPrice = edit.oldPrice;
            if(typeof edit.name === 'string' && edit.name) p.name = edit.name;
            if(typeof edit.tag === 'string') p.tag = edit.tag;
            if(typeof edit.note === 'string') p.note = edit.note;
            if(typeof edit.cat === 'string' && edit.cat) p.cat = edit.cat;
          }
        });
      }
    }catch(e){}
  }
  // (o rascunho só é carregado quando o painel é aberto — veja paAbrir() —
  // assim a página inicial sempre mostra os preços de verdade do produtos.js,
  // nunca um rascunho esquecido de uma edição anterior)

  function paSalvarRascunho(){
    var edits = products.map(function(p){
      var e = {id:p.id, price:p.price, atacado:p.atacado, decant:p.decant, custo:p.custo, indicacao:!!p.indicacao,
               badge:p.badge || '', oldPrice:p.oldPrice, name:p.name, tag:p.tag, note:p.note, cat:p.cat};
      if(p.__novo){ e.novo = true; e.c = p.c; }
      return e;
    });
    try{ localStorage.setItem(PA_STORAGE_KEY, JSON.stringify(edits)); }catch(e){} // navegador pode bloquear localStorage (ex: aba anônima) — segue o jogo mesmo assim
  }

  /* ---------------------------------------------------------------
     quantidades da calculadora de pedido — guardadas separado do
     rascunho de preços, porque isso não vai pro produtos.js nunca
     --------------------------------------------------------------- */
  var PA_PEDIDO_KEY = 'cr_admin_pedido_qtd_v1';
  function paCarregarPedido(){
    try{
      var salvo = JSON.parse(localStorage.getItem(PA_PEDIDO_KEY));
      return (salvo && typeof salvo === 'object') ? salvo : {};
    }catch(e){ return {}; }
  }
  var paPedidoQtd = paCarregarPedido(); // { "12": 6, "45": 12, ... }
  function paSalvarPedido(){
    try{ localStorage.setItem(PA_PEDIDO_KEY, JSON.stringify(paPedidoQtd)); }catch(e){}
  }

  /* ---------------------------------------------------------------
     helpers
     --------------------------------------------------------------- */
  function paFmtMoney(v){
    var n = parseFloat(v);
    return isNaN(n) ? '' : n.toFixed(2);
  }

  // "37,9" / "37.9" / "1.250,50" / "R$ 230" -> número; qualquer outra coisa (ex: "consultar") -> NaN
  function paNumero(txt){
    var s = String(txt == null ? '' : txt).trim().replace(/^R\$\s*/i, '');
    if(!/^[\d.,]+$/.test(s)) return NaN;
    if(s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }
  // o que aparece dentro do campo de preço: número com 2 casas, ou o texto (ex: consultar)
  function paValorCampo(v){
    if(typeof v === 'number' && isFinite(v)) return v.toFixed(2);
    return (v == null) ? '' : String(v);
  }
  // como o preço vai escrito no produtos.js: número (230.00) ou texto entre aspas ("consultar")
  function paPrecoParaArquivo(v){
    return (typeof v === 'number' && isFinite(v)) ? v.toFixed(2) : JSON.stringify(String(v == null ? 'consultar' : v));
  }
  function paEscAttr(s){
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  // texto digitado pelo dono -> texto seguro pro site (uma linha só, sem tags HTML)
  function paLimparTexto(s){
    return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function paDesfazerEntidades(s){
    return String(s == null ? '' : s).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  // devolve o HTML da célula de margem: R$ ganho + % em cima do custo,
  // ou um traço cinza quando o custo ainda não foi preenchido (0)
  function paMargemHtml(p){
    if(typeof p.price !== 'number') return '<span class="pa-margem pa-vazia">preço sob consulta</span>';
    var custo = Number(p.custo) || 0;
    if(custo <= 0) return '<span class="pa-margem pa-vazia">preencha o custo</span>';
    var ganho = p.price - custo;
    var pct = (ganho / custo) * 100;
    var classe = ganho >= 0 ? 'pa-positiva' : 'pa-negativa';
    var sinal = ganho >= 0 ? '+' : '';
    return '<span class="pa-margem ' + classe + '"><strong>' + sinal + 'R$ ' + ganho.toFixed(2).replace('.', ',') + '</strong>' + sinal + pct.toFixed(0) + '%</span>';
  }

  function paProdutoFoiAlterado(p){
    var original = paOriginalProducts.find(function(o){ return o.id === p.id; });
    if(!original) return true;                                  // produto criado pelo painel conta como alterado
    return String(original.name) !== String(p.name) ||
           String(original.tag) !== String(p.tag) ||
           String(original.note) !== String(p.note) ||
           String(original.cat) !== String(p.cat) ||
           String(original.price) !== String(p.price) ||
           String(original.atacado) !== String(p.atacado) ||
           String(original.decant) !== String(p.decant) ||
           String(original.custo) !== String(p.custo) ||
           !!original.indicacao !== !!p.indicacao ||
           String(original.badge || '') !== String(p.badge || '') ||
           String(original.oldPrice || '') !== String(p.oldPrice || '');
  }

  function paListaFiltrada(){
    return products.filter(function(p){
      if(paFiltroCategoria !== 'todos' && p.cat !== paFiltroCategoria) return false;
      if(paTermoBusca && normalizar(p.name).indexOf(normalizar(paTermoBusca)) === -1) return false;
      return true;
    });
  }

  function paMostrarToast(msg){
    var t = document.getElementById('pa-toast');
    t.textContent = msg;
    t.classList.add('pa-show');
    clearTimeout(window.__paToastTimer);
    window.__paToastTimer = setTimeout(function(){ t.classList.remove('pa-show'); }, 2600);
  }

  /* ---------------------------------------------------------------
     editar um campo — atualiza o produto DE VERDADE (o mesmo array
     que o site usa pra desenhar os cards), então a prévia já muda
     na hora, atrás do painel
     --------------------------------------------------------------- */
  function paAtualizarCampo(id, campo, valor){
    var p = products.find(function(x){ return x.id === id; });
    if(!p) return;
    var v = String(valor).trim();
    if(campo === 'custo'){
      var nc = paNumero(v);
      p.custo = isNaN(nc) ? 0 : nc;                         // custo apagado = 0 ("preencha o custo")
    } else if(campo === 'price' || campo === 'atacado' || campo === 'decant'){
      if(v === ''){ paRender(); return; }                   // campo apagado: mantém o que já estava
      var n = paNumero(v);
      p[campo] = isNaN(n) ? paLimparTexto(v) : n;           // número vira R$; texto (ex: consultar) fica como texto
    }
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();      // atualiza os cards do site ao vivo
    paRender();
  }
  window.paAtualizarCampo = paAtualizarCampo; // precisa ser global pro onchange inline no HTML gerado

  // reconstrói o array "offers" (o carrossel de ofertas) a partir do
  // campo "badge" de cada produto — quem tem selo preenchido entra,
  // quem não tem fica de fora. Chamada toda vez que custo/selo mudam.
  function paReconstruirOffers(){
    offers.length = 0; // "offers" é um array const no produtos.js — não dá pra reatribuir, só esvaziar e reencher
    products.forEach(function(p){
      if(p.badge && String(p.badge).trim()){
        offers.push({productId: p.id, badge: String(p.badge).trim(), oldPrice: p.oldPrice || null});
      }
    });
    if(typeof offerIndex !== 'undefined' && offerIndex >= offers.length) offerIndex = 0;
    if(typeof renderOffer === 'function') renderOffer();
  }

  // liga/desliga o selo "indicação do fornecedor" de um produto
  function paAlternarIndicacao(id, marcado){
    var p = products.find(function(x){ return x.id === id; });
    if(!p) return;
    p.indicacao = !!marcado;
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
  }
  window.paAlternarIndicacao = paAlternarIndicacao;

  // edita o selo (badge) ou o preço riscado (oldPrice) de um produto —
  // os dois controlam o carrossel de ofertas e o selinho no card
  function paAtualizarOferta(id, campo, valor){
    var p = products.find(function(x){ return x.id === id; });
    if(!p) return;
    if(campo === 'badge'){
      p.badge = String(valor).trim();
    } else if(campo === 'oldPrice'){
      var n = parseFloat(String(valor).replace(',', '.'));
      p.oldPrice = (valor === '' || isNaN(n)) ? null : n;
    }
    paReconstruirOffers();
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
  }
  window.paAtualizarOferta = paAtualizarOferta;

  /* ---------------------------------------------------------------
     calculadora de pedido: quantidade por produto + barra de totais
     --------------------------------------------------------------- */
  function paAtualizarQtdPedido(id, valor){
    var n = parseInt(valor, 10);
    if(isNaN(n) || n <= 0) delete paPedidoQtd[id];
    else paPedidoQtd[id] = n;
    paSalvarPedido();
    paAtualizarBarraPedido();
  }
  window.paAtualizarQtdPedido = paAtualizarQtdPedido;

  function paLimparPedido(){
    paPedidoQtd = {};
    paSalvarPedido();
    paRender();
  }

  function paAtualizarBarraPedido(){
    var barra = document.getElementById('pa-pedido-bar');
    var ids = Object.keys(paPedidoQtd);
    if(ids.length === 0){ barra.hidden = true; return; }

    var totalItens = 0, totalCusto = 0, totalReceita = 0;
    ids.forEach(function(idStr){
      var qtd = paPedidoQtd[idStr];
      var p = products.find(function(x){ return String(x.id) === idStr; });
      if(!p || !qtd) return;
      totalItens += qtd;
      totalCusto += (Number(p.custo) || 0) * qtd;
      totalReceita += (Number(p.price) || 0) * qtd;
    });
    var lucro = totalReceita - totalCusto;

    document.getElementById('pa-pedido-itens').textContent = totalItens;
    document.getElementById('pa-pedido-custo').textContent = 'R$ ' + totalCusto.toFixed(2).replace('.', ',');
    document.getElementById('pa-pedido-receita').textContent = 'R$ ' + totalReceita.toFixed(2).replace('.', ',');
    var lucroEl = document.getElementById('pa-pedido-lucro');
    lucroEl.textContent = 'R$ ' + lucro.toFixed(2).replace('.', ',');
    lucroEl.classList.toggle('pa-lucro-negativo', lucro < 0);
    barra.hidden = false;
  }
  document.getElementById('pa-btn-limpar-pedido').addEventListener('click', paLimparPedido);

  function paAplicarReajusteEmMassa(){
    var pctRaw = document.getElementById('pa-bulk-pct').value;
    var pct = parseFloat(pctRaw.replace(',', '.'));
    if(isNaN(pct)){
      paMostrarToast('Digite um percentual válido, tipo 10 ou -5.');
      return;
    }
    var visiveis = paListaFiltrada();
    if(visiveis.length === 0){
      paMostrarToast('Nenhum produto visível pra reajustar.');
      return;
    }
    visiveis.forEach(function(p){
      if(typeof p.price === 'number') p.price = Math.round(p.price * (1 + pct/100) * 100) / 100;
      if(typeof p.atacado === 'number') p.atacado = Math.round(p.atacado * (1 + pct/100) * 100) / 100;
      if(typeof p.decant === 'number') p.decant = Math.round(p.decant * (1 + pct/100) * 100) / 100;   // textos (ex: consultar) ficam como estão
    });
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Reajuste de ' + (pct > 0 ? '+' : '') + pct + '% aplicado em ' + visiveis.length + ' produto(s).');
  }

  // volta TODOS os produtos pro que está no produtos.js (texto, preços, selos) e some com os produtos
  // criados pelo painel. Não mexe nas fotos novas guardadas nem no rascunho salvo.
  function paReverterParaOriginal(){
    for(var i = products.length - 1; i >= 0; i--){
      var p = products[i];
      var o = paOriginalProducts.find(function(x){ return x.id === p.id; });
      if(!o){ products.splice(i, 1); continue; }
      p.name = o.name; p.tag = o.tag; p.note = o.note; p.cat = o.cat;
      p.price = o.price; p.atacado = o.atacado; p.decant = o.decant; p.custo = o.custo;
      p.indicacao = o.indicacao; p.badge = o.badge; p.oldPrice = o.oldPrice;
    }
    paReconstruirOffers();
  }

  function paRestaurarTudo(){
    if(!confirm('Isso descarta TODAS as edições feitas no painel (preços, textos, produtos novos e fotos novas ainda não baixadas) e volta ao que está no site hoje. Continuar?')) return;
    paFecharFicha(true);
    paReverterParaOriginal();
    paLimparFotosNovas();
    try{ localStorage.removeItem(PA_STORAGE_KEY); }catch(e){}
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Tudo restaurado.');
  }

  /* ---------------------------------------------------------------
     desenhar a tabela do painel
     --------------------------------------------------------------- */
  function paRender(){
    var tbody = document.getElementById('pa-tbody');
    var lista = paListaFiltrada();
    document.getElementById('pa-empty-msg').hidden = lista.length > 0;

    var linhas = '';
    lista.forEach(function(p){
      var alterado = paProdutoFoiAlterado(p);
      var atacadoValor = paEscAttr(paValorCampo(p.atacado));
      var fotosNovasQtd = paContarFotosNovas(p.id);
      var custoValor = Number(p.custo) || 0;
      var qtdValor = paPedidoQtd[p.id] || '';
      linhas += '' +
        '<tr class="' + (alterado ? 'pa-alterado' : '') + '">' +
          '<td data-label="ID"><span class="pa-id">#' + p.id + '</span></td>' +
          '<td data-label="Produto"><span class="pa-nome">' + p.name + (p.__novo ? '<span class="pa-etiqueta">novo</span>' : '') + (fotosNovasQtd ? '<span class="pa-etiqueta">📷 ' + fotosNovasQtd + ' nova(s)</span>' : '') + '</span><span class="pa-tag">' + p.tag + '</span><button type="button" class="pa-btn-ficha" onclick="paAbrirFicha(' + p.id + ')">✎ Editar ficha e fotos</button></td>' +
          '<td data-label="Categoria"><span class="pa-cat">' + p.cat + '</span></td>' +
          '<td data-label="Preço varejo"><input type="text" value="' + paEscAttr(paValorCampo(p.price)) + '" onchange="paAtualizarCampo(' + p.id + ", 'price', this.value)\"></td>" +
          '<td data-label="Atacado"><input type="text" value="' + atacadoValor + '" onchange="paAtualizarCampo(' + p.id + ", 'atacado', this.value)\"></td>" +
          '<td data-label="Decant"><input type="text" value="' + paEscAttr(paValorCampo(p.decant)) + '" onchange="paAtualizarCampo(' + p.id + ", 'decant', this.value)\"></td>" +
          '<td data-label="Custo (fornec.)"><input type="text" class="pa-input-custo" value="' + (custoValor > 0 ? paFmtMoney(custoValor) : '') + '" placeholder="0,00" onchange="paAtualizarCampo(' + p.id + ", 'custo', this.value)\"></td>" +
          '<td data-label="Margem">' + paMargemHtml(p) + '</td>' +
          '<td data-label="Qtd. pedido"><input type="text" inputmode="numeric" class="pa-input-qtd" value="' + qtdValor + '" placeholder="0" onchange="paAtualizarQtdPedido(' + p.id + ", this.value)\"></td>" +
          '<td data-label="★ Indicação" class="pa-td-indicacao"><input type="checkbox" class="pa-checkbox-indicacao" ' + (p.indicacao ? 'checked' : '') + ' onchange="paAlternarIndicacao(' + p.id + ', this.checked)"></td>' +
          '<td data-label="Selo (carrossel)"><input type="text" value="' + paEscAttr(p.badge || '') + '" placeholder="ex: Mais vendido" onchange="paAtualizarOferta(' + p.id + ", 'badge', this.value)\"></td>" +
          '<td data-label="Preço riscado"><input type="text" value="' + (p.oldPrice ? paFmtMoney(p.oldPrice) : '') + '" placeholder="opcional" onchange="paAtualizarOferta(' + p.id + ", 'oldPrice', this.value)\"></td>" +
        '</tr>';
    });
    tbody.innerHTML = linhas;

    var alteradosTotal = products.filter(paProdutoFoiAlterado).length;
    document.getElementById('pa-dirty-count').textContent = alteradosTotal;
    paAtualizarBarraPedido();
  }

  document.getElementById('pa-campo-busca').addEventListener('input', function(e){ paTermoBusca = e.target.value; paRender(); });
  document.getElementById('pa-filtro-cat').addEventListener('change', function(e){ paFiltroCategoria = e.target.value; paRender(); });
  document.getElementById('pa-btn-bulk').addEventListener('click', paAplicarReajusteEmMassa);
  document.getElementById('pa-btn-reset').addEventListener('click', paRestaurarTudo);
  document.getElementById('pa-btn-download').addEventListener('click', paBaixarProdutosJs);

  /* =====================================================================
     Gera o arquivo produtos.js completo, no mesmo formato do original,
     com os preços atualizados — pronto pra substituir o arquivo antigo.
     ===================================================================== */
  function paGerarProdutosJs(){
    var agora = new Date().toLocaleString('pt-BR');

    var cabecalho = '/* =====================================================================\n' +
'   PRODUTOS.JS — o "banco de dados" da CR Store\n' +
'   Este é o ÚNICO arquivo que você abre no dia a dia pra:\n' +
'     - trocar o número de WhatsApp da loja\n' +
'     - adicionar, remover ou editar produtos (nome, preço, categoria)\n' +
'     - trocar quem aparece no carrossel de ofertas lá no topo do site\n\n' +
'   Não precisa abrir o script.js nem o index.html pra nada disso —\n' +
'   e mexer aqui nunca quebra o funcionamento do site (carrinho,\n' +
'   carrossel, paginação...), porque isso tudo mora no script.js.\n\n' +
'   Fotos dos produtos: continuam funcionando pelo nome do arquivo\n' +
'   (produto-<id>.jpg, produto-<id>-2.jpg, produto-<id>-3.jpg dentro da\n' +
'   pasta "images") — não tem campo de foto aqui embaixo, é automático.\n\n' +
'   ARQUIVO GERADO PELO PAINEL DE PREÇOS em ' + agora + '.\n' +
'   ===================================================================== */\n\n' +
'/* =====================================================================\n' +
'   1) DADOS DA LOJA\n' +
'   Número de WhatsApp que recebe os pedidos. Formato: 55 + DDD + número,\n' +
'   sem espaços, sem símbolos. Se trocar aqui, troque também nos 3\n' +
'   lugares do index.html que têm "wa.me/' + WHATSAPP_NUMERO + '".\n' +
'   ===================================================================== */\n' +
'const WHATSAPP_NUMERO = "' + WHATSAPP_NUMERO + '";\n' +
'const ITENS_POR_PAGINA = ' + ITENS_POR_PAGINA + ';   // <<< quantos produtos aparecem por página\n\n' +
'/* =====================================================================\n' +
'   2) PRODUTOS — SEU CATÁLOGO (' + products.length + ' itens)\n' +
'   id, name, tag, note, price, atacado, decant, cat, c, custo, indicacao\n' +
'   — mesmos campos de sempre (custo = o que você paga pro fornecedor;\n' +
'   indicacao = aparece no chip "Indicações do Fornecedor"). Atualizados\n' +
'   pelo painel; o resto veio do arquivo original sem alteração.\n' +
'   ===================================================================== */\n' +
'  const products = [\n';

    var linhasProdutos = products.map(function(p){
      var atacadoStr = typeof p.atacado === 'number' ? p.atacado.toFixed(2) : JSON.stringify(p.atacado);
      return '    {id:' + p.id + ', name:' + JSON.stringify(p.name) + ', tag:' + JSON.stringify(p.tag) + ', note:' + JSON.stringify(p.note) + ', price:' + paPrecoParaArquivo(p.price) + ', atacado:' + paPrecoParaArquivo(p.atacado) + ', decant:' + paPrecoParaArquivo(p.decant) + ', cat:' + JSON.stringify(p.cat) + ', c:' + JSON.stringify(p.c) + ', custo:' + (Number(p.custo) || 0).toFixed(2) + ', indicacao:' + (!!p.indicacao) + '},';
    }).join('\n\n');

    var rodape = '\n  ];\n\n' +
'/* =====================================================================\n' +
'   3) CARROSSEL DE OFERTAS (caixa ao lado do título "Fragrâncias que\n' +
'   contam histórias")\n' +
'   Cada linha aponta pra um produto (pelo "id" lá de cima) e adiciona\n' +
'   um selo + um preço "de/por". Pra trocar quem aparece no carrossel,\n' +
'   troque o productId. Pra tirar o "preço antigo" (sem promoção), é só\n' +
'   apagar o oldPrice ou deixar null.\n' +
'   ===================================================================== */\n' +
'const offers = [\n' +
offers.map(function(o){
  return '  { productId: ' + o.productId + ', badge: ' + JSON.stringify(o.badge) + ', oldPrice: ' + (o.oldPrice === null ? 'null' : Number(o.oldPrice).toFixed(2)) + ' },';
}).join('\n') +
'\n];\n';

    return cabecalho + linhasProdutos + rodape;
  }

  function paBaixarBlob(blob, nomeArquivo){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  }

  function paBaixarProdutosJs(){
    var blob = new Blob([paGerarProdutosJs()], {type:'text/javascript;charset=utf-8'});
    paBaixarBlob(blob, 'produtos.js');
    paMostrarToast('Download iniciado — substitua o produtos.js antigo por esse.');
  }

  /* =====================================================================
     .ZIP SIMPLES (sem compressão) — pra baixar produtos.js + fotos juntos,
     já com os nomes e pastas certos. É só extrair em cima da pasta do projeto.
     ===================================================================== */
  var PA_CRC_TABELA = null;
  function paCrc32(bytes){
    if(!PA_CRC_TABELA){
      PA_CRC_TABELA = [];
      for(var n = 0; n < 256; n++){
        var c = n;
        for(var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        PA_CRC_TABELA[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for(var i = 0; i < bytes.length; i++) crc = PA_CRC_TABELA[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function paTextoParaBytes(s){ return new TextEncoder().encode(s); }

  // arquivos: [{nome:'images/produto-1.jpg', dados:Uint8Array}] -> Blob (.zip)
  function paMontarZip(arquivos){
    var agora = new Date();
    var dosTime = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
    var dosDate = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
    var partes = [], central = [], offset = 0;
    arquivos.forEach(function(a){
      var nome = paTextoParaBytes(a.nome), crc = paCrc32(a.dados), tam = a.dados.length;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true);
      h.setUint32(18, tam, true); h.setUint32(22, tam, true); h.setUint16(26, nome.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), nome, a.dados);
      var d = new DataView(new ArrayBuffer(46));
      d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true); d.setUint16(10, 0, true);
      d.setUint16(12, dosTime, true); d.setUint16(14, dosDate, true); d.setUint32(16, crc, true);
      d.setUint32(20, tam, true); d.setUint32(24, tam, true); d.setUint16(28, nome.length, true);
      d.setUint16(30, 0, true); d.setUint16(32, 0, true); d.setUint16(34, 0, true); d.setUint16(36, 0, true);
      d.setUint32(38, 0, true); d.setUint32(42, offset, true);
      central.push(new Uint8Array(d.buffer), nome);
      offset += 30 + nome.length + tam;
    });
    var tamCentral = 0;
    central.forEach(function(b){ tamCentral += b.length; });
    var fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(4, 0, true); fim.setUint16(6, 0, true);
    fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, offset, true); fim.setUint16(20, 0, true);
    return new Blob(partes.concat(central, [new Uint8Array(fim.buffer)]), {type:'application/zip'});
  }

  function paLerBlob(blob, cb){
    var r = new FileReader();
    r.onload = function(){ cb(new Uint8Array(r.result)); };
    r.onerror = function(){ cb(null); };
    r.readAsArrayBuffer(blob);
  }

  /* =====================================================================
     FOTOS NOVAS — escolhe, reduz o tamanho, guarda na memória e mostra na
     prévia do site. O pacote .zip leva elas já com o nome certo
     (produto-<id>.jpg, produto-<id>-2.jpg, produto-<id>-3.jpg).
     ===================================================================== */
  function paContarFotosNovas(id){
    var f = paFotosNovas[id], n = 0;
    if(f){ for(var s = 0; s < 3; s++) if(f[s]) n++; }
    return n;
  }
  function paTotalFotosNovas(){
    var n = 0;
    Object.keys(paFotosNovas).forEach(function(id){ n += paContarFotosNovas(id); });
    return n;
  }
  function paSincronizarFotosTemp(){
    var t = {};
    Object.keys(paFotosNovas).forEach(function(id){
      t[id] = {};
      for(var s = 0; s < 3; s++) if(paFotosNovas[id][s]) t[id][s] = paFotosNovas[id][s].url;
    });
    window.FOTOS_TEMP = t;
  }
  function paRemoverFotosDoProduto(id){
    var f = paFotosNovas[id];
    if(f){ for(var s = 0; s < 3; s++) if(f[s]) URL.revokeObjectURL(f[s].url); }
    delete paFotosNovas[id];
  }
  function paLimparFotosNovas(){
    Object.keys(paFotosNovas).forEach(paRemoverFotosDoProduto);
    window.FOTOS_TEMP = {};
  }

  // file -> {blob, ext, kb} já reduzida (máx. 1200px no lado maior). JPG por padrão; PNG só se tiver transparência.
  function paProcessarFoto(file, cb){
    var urlTemp = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function(){
      try{
        var maxLado = 1200;
        var w = img.naturalWidth, h = img.naturalHeight;
        var esc = Math.min(1, maxLado / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * esc)), ch = Math.max(1, Math.round(h * esc));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        var temTransparencia = false;
        if(/png|webp|gif/i.test(file.type)){
          var dados = ctx.getImageData(0, 0, cw, ch).data;
          for(var i = 3; i < dados.length; i += 16){ if(dados[i] < 250){ temTransparencia = true; break; } }
        }
        if(!temTransparencia){                      // JPG não tem transparência: garante fundo branco
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cw, ch);
        }
        var tipo = temTransparencia ? 'image/png' : 'image/jpeg';
        cv.toBlob(function(blob){
          URL.revokeObjectURL(urlTemp);
          if(!blob){ cb('Não consegui converter essa foto. Tente outra.'); return; }
          cb(null, {blob:blob, ext: temTransparencia ? 'png' : 'jpg', kb: Math.max(1, Math.round(blob.size / 1024))});
        }, tipo, 0.88);
      }catch(e){
        URL.revokeObjectURL(urlTemp);
        cb('Erro ao processar a foto: ' + e.message);
      }
    };
    img.onerror = function(){
      URL.revokeObjectURL(urlTemp);
      cb('Não consegui abrir essa imagem. Use JPG, PNG ou WebP (fotos HEIC do iPhone: exporte como JPG).');
    };
    img.src = urlTemp;
  }

  function paGuardarFoto(id, slot, dados){
    if(!paFotosNovas[id]) paFotosNovas[id] = {};
    var antiga = paFotosNovas[id][slot];
    if(antiga) URL.revokeObjectURL(antiga.url);
    paFotosNovas[id][slot] = dados;
    paSincronizarFotosTemp();
    if(typeof renderGrid === 'function') renderGrid();
    if(typeof renderOffer === 'function' && offers.length) renderOffer();
    paRenderFotosFicha();
    paRender();
  }

  /* =====================================================================
     FICHA DO PRODUTO (nome, frase, descrição, categoria e fotos)
     ===================================================================== */
  var fichaEl = document.getElementById('pa-ficha');
  var paFichaId = null, paFichaNovo = false, paSlotAtual = 0;

  function paAbrirFicha(id, novo){
    var p = products.find(function(x){ return x.id === id; });
    if(!p) return;
    paFichaId = id;
    paFichaNovo = !!novo;
    document.getElementById('pa-ficha-titulo').textContent = (novo ? 'Novo produto' : 'Ficha do produto') + ' · #' + id;
    document.getElementById('pa-f-nome').value = paDesfazerEntidades(p.name);
    document.getElementById('pa-f-tag').value = paDesfazerEntidades(p.tag);
    document.getElementById('pa-f-note').value = paDesfazerEntidades(p.note);
    document.getElementById('pa-f-cat').value = p.cat;
    document.getElementById('pa-f-aviso').hidden = true;
    document.getElementById('pa-f-excluir').hidden = !(p.__novo && !novo);   // só produtos criados pelo painel (e já salvos) podem ser excluídos aqui
    paRenderFotosFicha();
    fichaEl.hidden = false;
    setTimeout(function(){ document.getElementById('pa-f-nome').focus(); }, 60);
  }
  window.paAbrirFicha = paAbrirFicha;

  function paFecharFicha(cancelar){
    if(!fichaEl || fichaEl.hidden) return;
    if(cancelar && paFichaNovo){                       // produto novo que nunca foi salvo: descarta
      var idx = products.findIndex(function(x){ return x.id === paFichaId; });
      if(idx !== -1) products.splice(idx, 1);
      paRemoverFotosDoProduto(paFichaId);
      paSincronizarFotosTemp();
      paSalvarRascunho();
      if(typeof renderGrid === 'function') renderGrid();
      paRender();
    }
    fichaEl.hidden = true;
    paFichaId = null;
    paFichaNovo = false;
  }

  function paSalvarFicha(){
    var p = products.find(function(x){ return x.id === paFichaId; });
    if(!p) return;
    var nome = paLimparTexto(document.getElementById('pa-f-nome').value);
    if(!nome){
      paMostrarToast('Dê um nome pro perfume antes de salvar.');
      document.getElementById('pa-f-nome').focus();
      return;
    }
    p.name = nome;
    p.tag = paLimparTexto(document.getElementById('pa-f-tag').value);
    p.note = paLimparTexto(document.getElementById('pa-f-note').value);
    p.cat = document.getElementById('pa-f-cat').value;
    paFichaNovo = false;                                // salvo: não é mais "descartável"
    paFecharFicha(false);
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Ficha salva.');
  }

  // exclui um produto CRIADO PELO PAINEL (os que já estão no site você tira editando o produtos.js)
  function paExcluirNovo(){
    var idx = products.findIndex(function(x){ return x.id === paFichaId; });
    if(idx === -1 || !products[idx].__novo) return;
    if(!confirm('Excluir este produto novo e as fotos novas dele?')) return;
    var id = paFichaId;
    products.splice(idx, 1);
    paRemoverFotosDoProduto(id);
    paSincronizarFotosTemp();
    paFichaNovo = false;
    paFecharFicha(false);
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Produto excluído.');
  }

  // desenha as 3 posições de foto da ficha (as já publicadas no site + as novas escolhidas aqui)
  function paRenderFotosFicha(){
    var caixa = document.getElementById('pa-fotos');
    caixa.innerHTML = '';
    var idAtual = paFichaId;
    for(var s = 0; s < 3; s++){
      (function(s){
        var slot = document.createElement('div'); slot.className = 'pa-foto-slot';
        var prev = document.createElement('div'); prev.className = 'pa-foto-prev'; prev.textContent = 'sem foto';
        var rotulo = document.createElement('div'); rotulo.className = 'pa-foto-rotulo'; rotulo.textContent = 'Foto ' + (s + 1) + (s === 0 ? ' (principal)' : '');
        var botao = document.createElement('button'); botao.type = 'button'; botao.className = 'pa-ghost'; botao.textContent = 'Escolher foto';
        var status = document.createElement('span'); status.className = 'pa-foto-status';
        botao.addEventListener('click', function(){
          paSlotAtual = s;
          var inp = document.getElementById('pa-f-arquivo');
          inp.value = '';
          inp.click();
        });
        var nova = paFotosNovas[idAtual] && paFotosNovas[idAtual][s];
        if(nova){
          var im = new Image(); im.src = nova.url; prev.textContent = ''; prev.appendChild(im);
          status.className = 'pa-foto-status pa-nova'; status.textContent = 'nova · ' + nova.kb + ' KB · ' + nova.nome;
          botao.textContent = 'Trocar foto';
        } else {
          procurarFotoNoServidor(idAtual, s, 0, function(src){      // existe uma foto dessas já publicada?
            if(!src || paFichaId !== idAtual) return;
            var im2 = new Image(); im2.src = src; prev.textContent = ''; prev.appendChild(im2);
            status.textContent = 'já está no site';
            botao.textContent = 'Trocar foto';
          });
        }
        slot.appendChild(prev); slot.appendChild(rotulo); slot.appendChild(botao); slot.appendChild(status);
        caixa.appendChild(slot);
      })(s);
    }
  }

  document.getElementById('pa-f-arquivo').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    if(!file || paFichaId === null) return;
    var id = paFichaId, slot = paSlotAtual;
    var aviso = document.getElementById('pa-f-aviso');
    aviso.hidden = true;
    paMostrarToast('Processando a foto...');
    paProcessarFoto(file, function(erro, res){
      if(erro){ paMostrarToast(erro); return; }
      var nome = 'produto-' + id + (slot === 0 ? '' : '-' + (slot + 1)) + '.' + res.ext;
      // o site usa a 1ª extensão que existir nesta ordem: jpg, jpeg, png, webp. Se já existir no site um
      // arquivo que "ganha" da nova (ex: antigo .jpg e nova .png), o antigo continuaria aparecendo.
      procurarFotoNoServidor(id, slot, 0, function(existente){
        var apagar = null;
        if(existente){
          var extAntiga = existente.split('.').pop().toLowerCase();
          var pa = EXTENSOES_FOTO.indexOf(extAntiga), pn = EXTENSOES_FOTO.indexOf(res.ext);
          if(pa !== -1 && pa < pn) apagar = existente;
        }
        paGuardarFoto(id, slot, {blob:res.blob, ext:res.ext, kb:res.kb, nome:nome, url:URL.createObjectURL(res.blob), apagar:apagar});
        paMostrarToast('Foto ' + (slot + 1) + ' pronta — vai no pacote.');
        if(apagar && paFichaId === id){
          aviso.textContent = 'Atenção: já existe ' + apagar + ' no site e ele tem prioridade sobre a foto nova (' + nome + '). Ao subir o pacote, apague esse arquivo antigo da pasta images, senão a foto antiga continua aparecendo.';
          aviso.hidden = false;
        }
      });
    });
  });

  /* =====================================================================
     NOVO PRODUTO e PACOTE PRA BAIXAR
     ===================================================================== */
  function paNovoProduto(){
    var maxId = 0;
    products.forEach(function(p){ if(p.id > maxId) maxId = p.id; });
    var p = {id:maxId + 1, name:'', tag:'', note:'', price:'consultar', atacado:'consultar', decant:'consultar',
             cat:'unissex', c:['#2a2115', '#0b0805'], custo:0, indicacao:false, badge:'', oldPrice:null, __novo:true};
    products.push(p);                                   // (só entra no rascunho salvo quando a ficha for salva)
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paAbrirFicha(p.id, true);
  }

  function paBaixarPacote(){
    var lista = [];
    Object.keys(paFotosNovas).forEach(function(id){
      for(var s = 0; s < 3; s++) if(paFotosNovas[id][s]) lista.push(paFotosNovas[id][s]);
    });
    if(!lista.length){                                  // sem foto nova, o pacote seria só o produtos.js
      paBaixarProdutosJs();
      return;
    }
    paMostrarToast('Montando o pacote...');
    var arquivos = [{nome:'produtos.js', dados:paTextoParaBytes(paGerarProdutosJs())}];
    var faltam = lista.length, falhou = false;
    lista.forEach(function(f){
      paLerBlob(f.blob, function(bytes){
        if(!bytes) falhou = true; else arquivos.push({nome:'images/' + f.nome, dados:bytes});
        if(--faltam > 0) return;
        if(falhou){ paMostrarToast('Não consegui ler uma das fotos. Escolha ela de novo.'); return; }
        paBaixarBlob(paMontarZip(arquivos), 'pacote-cr-store.zip');
        paMostrarToast('Pacote baixado — extraia na pasta do projeto, em cima dos arquivos.');
        var apagar = lista.filter(function(x){ return x.apagar; }).map(function(x){ return x.apagar; });
        if(apagar.length){
          setTimeout(function(){
            alert('IMPORTANTE: antes de subir, APAGUE estes arquivos antigos da pasta do projeto (eles têm prioridade sobre as fotos novas):\\n\\n' + apagar.join('\\n'));
          }, 400);
        }
      });
    });
  }

  document.getElementById('pa-btn-novo').addEventListener('click', paNovoProduto);
  document.getElementById('pa-btn-pacote').addEventListener('click', paBaixarPacote);
  document.getElementById('pa-ficha-x').addEventListener('click', function(){ paFecharFicha(true); });
  document.getElementById('pa-f-cancelar').addEventListener('click', function(){ paFecharFicha(true); });
  document.getElementById('pa-f-salvar').addEventListener('click', paSalvarFicha);
  document.getElementById('pa-f-excluir').addEventListener('click', paExcluirNovo);

  // fotos novas só existem na memória desta janela: avisa antes de perder
  window.addEventListener('beforeunload', function(e){
    if(paTotalFotosNovas() > 0){ e.preventDefault(); e.returnValue = ''; return ''; }
  });
})();
