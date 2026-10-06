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

  // guarda uma cópia intocada dos preços originais assim que a página
  // carrega, pra sempre saber o que mudou e pra poder "restaurar tudo"
  var paOriginalProducts = JSON.parse(JSON.stringify(products));

  var paFiltroCategoria = 'todos';
  var paTermoBusca = '';

  /* ---------------------------------------------------------------
     abrir / fechar o painel
     --------------------------------------------------------------- */
  var painelEl = document.getElementById('painel-admin');

  function paAbrir(){
    painelEl.classList.add('pa-aberto');
    painelEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    paRender();
  }
  function paFechar(){
    painelEl.classList.remove('pa-aberto');
    painelEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  document.getElementById('pa-btn-fechar').addEventListener('click', paFechar);
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && painelEl.classList.contains('pa-aberto')) paFechar();
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
          if(p){
            p.price = edit.price; p.atacado = edit.atacado; p.decant = edit.decant;
            if(typeof edit.custo === 'number') p.custo = edit.custo;
          }
        });
      }
    }catch(e){}
  }
  paCarregarRascunho();
  if(typeof renderGrid === 'function') renderGrid(); // reflete o rascunho salvo nos cards, se tiver algum

  function paSalvarRascunho(){
    var edits = products.map(function(p){
      return {id:p.id, price:p.price, atacado:p.atacado, decant:p.decant, custo:p.custo};
    });
    localStorage.setItem(PA_STORAGE_KEY, JSON.stringify(edits));
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
    localStorage.setItem(PA_PEDIDO_KEY, JSON.stringify(paPedidoQtd));
  }

  /* ---------------------------------------------------------------
     helpers
     --------------------------------------------------------------- */
  function paFmtMoney(v){
    var n = parseFloat(v);
    return isNaN(n) ? '' : n.toFixed(2);
  }

  // devolve o HTML da célula de margem: R$ ganho + % em cima do custo,
  // ou um traço cinza quando o custo ainda não foi preenchido (0)
  function paMargemHtml(p){
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
    if(!original) return false;
    return String(original.price) !== String(p.price) ||
           String(original.atacado) !== String(p.atacado) ||
           String(original.decant) !== String(p.decant) ||
           String(original.custo) !== String(p.custo);
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
    if(campo === 'atacado'){
      var n = parseFloat(String(valor).replace(',', '.'));
      p.atacado = (!isNaN(n) && /^[\d.,]+$/.test(String(valor).trim())) ? n : String(valor).trim();
    } else {
      var n2 = parseFloat(String(valor).replace(',', '.'));
      if(!isNaN(n2)) p[campo] = n2;
    }
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid(); // atualiza os cards do site ao vivo
    paRender();
  }
  window.paAtualizarCampo = paAtualizarCampo; // precisa ser global pro onchange inline no HTML gerado

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
      p.price = Math.round(p.price * (1 + pct/100) * 100) / 100;
      if(typeof p.atacado === 'number') p.atacado = Math.round(p.atacado * (1 + pct/100) * 100) / 100;
      p.decant = Math.round(p.decant * (1 + pct/100) * 100) / 100;
    });
    paSalvarRascunho();
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Reajuste de ' + (pct > 0 ? '+' : '') + pct + '% aplicado em ' + visiveis.length + ' produto(s).');
  }

  function paRestaurarTudo(){
    if(!confirm('Isso descarta todas as edições feitas no painel e volta aos preços originais. Continuar?')) return;
    products.forEach(function(p){
      var original = paOriginalProducts.find(function(o){ return o.id === p.id; });
      if(original){ p.price = original.price; p.atacado = original.atacado; p.decant = original.decant; p.custo = original.custo; }
    });
    localStorage.removeItem(PA_STORAGE_KEY);
    if(typeof renderGrid === 'function') renderGrid();
    paRender();
    paMostrarToast('Preços restaurados.');
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
      var atacadoValor = typeof p.atacado === 'number' ? paFmtMoney(p.atacado) : p.atacado;
      var custoValor = Number(p.custo) || 0;
      var qtdValor = paPedidoQtd[p.id] || '';
      linhas += '' +
        '<tr class="' + (alterado ? 'pa-alterado' : '') + '">' +
          '<td data-label="ID"><span class="pa-id">#' + p.id + '</span></td>' +
          '<td data-label="Produto"><span class="pa-nome">' + p.name + '</span><span class="pa-tag">' + p.tag + '</span></td>' +
          '<td data-label="Categoria"><span class="pa-cat">' + p.cat + '</span></td>' +
          '<td data-label="Preço varejo"><input type="text" value="' + paFmtMoney(p.price) + '" onchange="paAtualizarCampo(' + p.id + ", 'price', this.value)\"></td>" +
          '<td data-label="Atacado"><input type="text" value="' + atacadoValor + '" onchange="paAtualizarCampo(' + p.id + ", 'atacado', this.value)\"></td>" +
          '<td data-label="Decant"><input type="text" value="' + paFmtMoney(p.decant) + '" onchange="paAtualizarCampo(' + p.id + ", 'decant', this.value)\"></td>" +
          '<td data-label="Custo (fornec.)"><input type="text" class="pa-input-custo" value="' + (custoValor > 0 ? paFmtMoney(custoValor) : '') + '" placeholder="0,00" onchange="paAtualizarCampo(' + p.id + ", 'custo', this.value)\"></td>" +
          '<td data-label="Margem">' + paMargemHtml(p) + '</td>' +
          '<td data-label="Qtd. pedido"><input type="text" inputmode="numeric" class="pa-input-qtd" value="' + qtdValor + '" placeholder="0" onchange="paAtualizarQtdPedido(' + p.id + ", this.value)\"></td>" +
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
  function paBaixarProdutosJs(){
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
'   id, name, tag, note, price, atacado, decant, cat, c, custo — mesmos\n' +
'   campos de sempre (custo = o que você paga pro fornecedor, usado só\n' +
'   pra calcular margem aqui no painel). Preços/custos atualizados pelo\n' +
'   painel; o resto veio do arquivo original sem alteração.\n' +
'   ===================================================================== */\n' +
'  const products = [\n';

    var linhasProdutos = products.map(function(p){
      var atacadoStr = typeof p.atacado === 'number' ? p.atacado.toFixed(2) : JSON.stringify(p.atacado);
      return '    {id:' + p.id + ', name:' + JSON.stringify(p.name) + ', tag:' + JSON.stringify(p.tag) + ', note:' + JSON.stringify(p.note) + ', price:' + Number(p.price).toFixed(2) + ', atacado:' + atacadoStr + ', decant:' + Number(p.decant).toFixed(2) + ', cat:' + JSON.stringify(p.cat) + ', c:' + JSON.stringify(p.c) + ', custo:' + (Number(p.custo) || 0).toFixed(2) + '},';
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

    var conteudoFinal = cabecalho + linhasProdutos + rodape;
    var blob = new Blob([conteudoFinal], {type:'text/javascript;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'produtos.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    paMostrarToast('Download iniciado — substitua o produtos.js antigo por esse.');
  }

})();
