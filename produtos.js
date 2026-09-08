/* =====================================================================
   PRODUTOS.JS — o "banco de dados" da CR Store
   Este é o ÚNICO arquivo que você abre no dia a dia pra:
     - trocar o número de WhatsApp da loja
     - adicionar, remover ou editar produtos (nome, preço, categoria)
     - trocar quem aparece no carrossel de ofertas lá no topo do site

   Não precisa abrir o script.js nem o index.html pra nada disso —
   e mexer aqui nunca quebra o funcionamento do site (carrinho,
   carrossel, paginação...), porque isso tudo mora no script.js.

   Fotos dos produtos: continuam funcionando pelo nome do arquivo
   (produto-<id>.jpg, produto-<id>-2.jpg, produto-<id>-3.jpg dentro da
   pasta "images") — não tem campo de foto aqui embaixo, é automático.
   ===================================================================== */

/* =====================================================================
   1) DADOS DA LOJA
   Número de WhatsApp que recebe os pedidos. Formato: 55 + DDD + número,
   sem espaços, sem símbolos. Se trocar aqui, troque também nos 3
   lugares do index.html que têm "wa.me/5511994773243".
   ===================================================================== */
const WHATSAPP_NUMERO = "5511994773243";
const ITENS_POR_PAGINA = 8;   // <<< quantos produtos aparecem por página

/* =====================================================================
   2) PRODUTOS — SEU CATÁLOGO (60 itens)
   Cada produto é um objeto com estes campos:

   id      -> número único (não repita) — É ESSE NÚMERO QUE DEFINE O
              NOME DA FOTO desse produto (veja "FOTOS" logo abaixo)
   name    -> nome do perfume
   tag     -> categoria olfativa curta (aparece em cima do nome no card)
   note    -> descrição das notas do perfume
   price   -> preço de VAREJO (unidade normal). Use ponto, não vírgula. Ex: 189.90
   atacado -> preço de ATACADO (compra em quantidade). Mesma regra: ponto, não vírgula.
   decant  -> preço do DECANT (amostra/fracionado). Mesma regra: ponto, não vírgula.
   cat     -> "masculino", "feminino" ou "unissex" (usado no filtro)
   c       -> cor do ícone de prévia (só aparece enquanto não há foto real).

   -------------------------------------------------------------------
   FOTOS — AGORA NÃO PRECISA MEXER NO CÓDIGO PRA COLOCAR FOTO! 🎉
   -------------------------------------------------------------------
   É só salvar a foto com o nome certo e arrastar pra dentro da pasta
   "images", do lado do index.html. O site acha ela sozinho, pelo
   número (id) do produto:

     produto-1.jpg     -> foto principal do produto de id 1
     produto-1-2.jpg    -> segunda foto do produto de id 1
     produto-1-3.jpg    -> terceira foto do produto de id 1

     produto-2.jpg, produto-2-2.jpg, produto-2-3.jpg -> do produto id 2
     ...e assim por diante, pra cada um dos 60 produtos.

   Pode ser .jpg, .jpeg, .png ou .webp — o site testa todos os
   formatos sozinho, então não precisa se preocupar em acertar a
   extensão certinha.

   Se colocar só a foto principal (produto-N.jpg) tudo bem, o card
   funciona normal, só sem as setinhas de trocar foto. Se colocar as
   3, o carrossel do card aparece automático. Enquanto não tiver
   NENHUMA foto daquele produto, aparece o ícone de frasco dourado
   como prévia — sem quebrar nada.
   ===================================================================== */
  const products = [
    {id:1, name:"Asad elixir (Lattafa)", tag:"Amadeirado Intenso", note:"Amadeirado, âmbar, tabaco e baunilha, com toques de patchouli, doce e citrinos", price:250.00, atacado:"consultar", decant:46.41, cat:"masculino", c:["#3a2c12","#160f06"]},


    {id:2, name:"Asad tradicional (Lattafa)", tag:"Oriental especiado e amadeirado", note:"Perfume marcante e sedutor, que mistura o picante da pimenta com um fundo quente de café, baunilha e âmbar amadeirado.", price:230.00, atacado:"consultar", decant:37.90, cat:"masculino", c:["#3a1a1c","#160a0b"]},


    {id:3, name:"Asad burbon (Lattafa)", tag:"Oriental Amadeirado Gourmand (Rico, alcoólico e quente).", note:"Perfume licoroso e sedutor, com um toque alcoólico de bourbon combinado com cacau e um fundo marcante de baunilha amadeirada.", price:250.00, atacado:"consultar", decant:46.41, cat:"masculino", c:["#3a230f","#170f06"]},


    {id:4, name:"Asad Zanzibar Limited Edition (Lattafa) ", tag:"Aromático, Amadeirado e Especiado", note:"Versão mais exclusiva e refinada, que troca o toque tropical por uma explosão picante de pimenta e cardamomo, combinada com íris e um fundo denso de baunilha e âmbar amadeirado.", price:220.00, atacado:"consultar", decant:37.90, cat:"masculino", c:["#232323","#0c0c0c"]},


    {id:5, name:"Yara Tradicional (Lattafa)", tag:"Oriental Floral Gourmand (Doce, cremoso, frutado e delicado)", note:"Perfume feminino, doce e extremamente cremoso, que combina flores delicadas com o toque irresistível de frutas tropicais, baunilha e um fundo aveludado estilo marshmallow.", price:230.00, atacado:"cosultar", decant:37.90, cat:"feminino", c:["#1c150a","#090604"]},


    {id:6, name:"Yara elixir", tag:"Oriental Floral Gourmand Intenso (Mais fechado, sedutor e marcante que o tradicional).", note:"Versão intensa e sedutora da linha Yara, que combina o toque frutado e licoroso das frutas vermelhas com flores marcantes e um fundo potente de baunilha e âmbar.", price:250.00, atacado:"consultar", decant:46.41, cat:"feminino", c:["#331c28","#130a0f"]},


    {id:7, name:"Xeique", tag:"Amadeirado Especiado", note:"Cardamomo, canela e baunilha", price:199.90, atacado:149.90, decant:43.90, cat:"masculino", c:["#211a10","#0b0805"]},


    {id:8, name:"Emir Dourado", tag:"Oriental Marcante", note:"Couro, fumo e especiarias", price:214.90, atacado:161.90, decant:47.90, cat:"masculino", c:["#2a2115","#0f0b06"]},


    {id:9, name:"Guerreiro de Ouro", tag:"Couro e Especiarias", note:"Sândalo, pimenta e cedro", price:214.90, atacado:161.90, decant:47.90, cat:"masculino", c:["#3a2c12","#160f06"]},


    {id:10, name:"Trono Real", tag:"Amadeirado Clássico", note:"Oud, café e baunilha", price:229.90, atacado:172.90, decant:50.90, cat:"masculino", c:["#3a1a1c","#160a0b"]},


    {id:11, name:"Principe Arabe", tag:"Amadeirado Intenso", note:"Oud, âmbar e patchouli", price:154.90, atacado:116.90, decant:34.90, cat:"masculino", c:["#3a230f","#170f06"]},


    {id:12, name:"Leao do Deserto", tag:"Amadeirado Especiado", note:"Cardamomo, canela e baunilha", price:169.90, atacado:127.90, decant:37.90, cat:"masculino", c:["#232323","#0c0c0c"]},


    {id:13, name:"Escudo de Oud", tag:"Oriental Marcante", note:"Couro, fumo e especiarias", price:169.90, atacado:127.90, decant:37.90, cat:"masculino", c:["#1c150a","#090604"]},


    {id:14, name:"Falcao Real", tag:"Couro e Especiarias", note:"Sândalo, pimenta e cedro", price:184.90, atacado:138.90, decant:40.90, cat:"masculino", c:["#331c28","#130a0f"]},


    {id:15, name:"Deserto Ardente", tag:"Amadeirado Clássico", note:"Oud, café e baunilha", price:184.90, atacado:138.90, decant:40.90, cat:"masculino", c:["#211a10","#0b0805"]},


    {id:16, name:"Sombra Real", tag:"Amadeirado Intenso", note:"Oud, âmbar e patchouli", price:199.90, atacado:149.90, decant:43.90, cat:"masculino", c:["#2a2115","#0f0b06"]},


    {id:17, name:"Coroa Negra", tag:"Amadeirado Especiado", note:"Cardamomo, canela e baunilha", price:199.90, atacado:149.90, decant:43.90, cat:"masculino", c:["#3a2c12","#160f06"]},


    {id:18, name:"Espada de Ouro", tag:"Oriental Marcante", note:"Couro, fumo e especiarias", price:214.90, atacado:161.90, decant:47.90, cat:"masculino", c:["#3a1a1c","#160a0b"]},


    {id:19, name:"Areia Dourada", tag:"Couro e Especiarias", note:"Sândalo, pimenta e cedro", price:214.90, atacado:161.90, decant:47.90, cat:"masculino", c:["#3a230f","#170f06"]},


    {id:20, name:"Vento do Saara", tag:"Amadeirado Clássico", note:"Oud, café e baunilha", price:229.90, atacado:172.90, decant:50.90, cat:"masculino", c:["#232323","#0c0c0c"]},


    {id:21, name:"Rosa do Deserto", tag:"Floral Oriental", note:"Rosa turca, açafrão e almíscar", price:154.90, atacado:116.90, decant:34.90, cat:"feminino", c:["#1c150a","#090604"]},


    {id:22, name:"Veu de Ambar", tag:"Floral Adocicado", note:"Âmbar, baunilha e jasmim", price:169.90, atacado:127.90, decant:37.90, cat:"feminino", c:["#331c28","#130a0f"]},


    {id:23, name:"Jardim de Meca", tag:"Floral Frutado", note:"Damasco, lírio e almíscar", price:169.90, atacado:127.90, decant:37.90, cat:"feminino", c:["#211a10","#0b0805"]},


    {id:24, name:"Princesa Dourada", tag:"Floral Amadeirado", note:"Jasmim, sândalo e mel", price:184.90, atacado:138.90, decant:40.90, cat:"feminino", c:["#2a2115","#0f0b06"]},


    {id:25, name:"Noiva Arabe", tag:"Doce Oriental", note:"Flor de laranjeira e âmbar", price:184.90, atacado:138.90, decant:40.90, cat:"feminino", c:["#3a2c12","#160f06"]},


    {id:26, name:"Flor de Marrakech", tag:"Floral Oriental", note:"Rosa turca, açafrão e almíscar", price:199.90, atacado:149.90, decant:43.90, cat:"feminino", c:["#3a1a1c","#160a0b"]},


    {id:27, name:"Sultana", tag:"Floral Adocicado", note:"Âmbar, baunilha e jasmim", price:199.90, atacado:149.90, decant:43.90, cat:"feminino", c:["#3a230f","#170f06"]},


    {id:28, name:"Harem Dourado", tag:"Floral Frutado", note:"Damasco, lírio e almíscar", price:214.90, atacado:161.90, decant:47.90, cat:"feminino", c:["#232323","#0c0c0c"]},


    {id:29, name:"Veu Real", tag:"Floral Amadeirado", note:"Jasmim, sândalo e mel", price:214.90, atacado:161.90, decant:47.90, cat:"feminino", c:["#1c150a","#090604"]},


    {id:30, name:"Jasmim Real", tag:"Doce Oriental", note:"Flor de laranjeira e âmbar", price:229.90, atacado:172.90, decant:50.90, cat:"feminino", c:["#331c28","#130a0f"]},


    {id:31, name:"Lagrima de Ouro", tag:"Floral Oriental", note:"Rosa turca, açafrão e almíscar", price:154.90, atacado:116.90, decant:34.90, cat:"feminino", c:["#211a10","#0b0805"]},


    {id:32, name:"Orquidea Negra", tag:"Floral Adocicado", note:"Âmbar, baunilha e jasmim", price:169.90, atacado:127.90, decant:37.90, cat:"feminino", c:["#2a2115","#0f0b06"]},


    {id:33, name:"Perola do Oriente", tag:"Floral Frutado", note:"Damasco, lírio e almíscar", price:169.90, atacado:127.90, decant:37.90, cat:"feminino", c:["#3a2c12","#160f06"]},


    {id:34, name:"Seda Dourada", tag:"Floral Amadeirado", note:"Jasmim, sândalo e mel", price:184.90, atacado:138.90, decant:40.90, cat:"feminino", c:["#3a1a1c","#160a0b"]},


    {id:35, name:"Miragem Floral", tag:"Doce Oriental", note:"Flor de laranjeira e âmbar", price:184.90, atacado:138.90, decant:40.90, cat:"feminino", c:["#3a230f","#170f06"]},


    {id:36, name:"Noite de Marrakech", tag:"Floral Oriental", note:"Rosa turca, açafrão e almíscar", price:199.90, atacado:149.90, decant:43.90, cat:"feminino", c:["#232323","#0c0c0c"]},


    {id:37, name:"Deserto Rosado", tag:"Floral Adocicado", note:"Âmbar, baunilha e jasmim", price:199.90, atacado:149.90, decant:43.90, cat:"feminino", c:["#1c150a","#090604"]},


    {id:38, name:"Rainha de Saba", tag:"Floral Frutado", note:"Damasco, lírio e almíscar", price:214.90, atacado:161.90, decant:47.90, cat:"feminino", c:["#331c28","#130a0f"]},


    {id:39, name:"Odalisca", tag:"Floral Amadeirado", note:"Jasmim, sândalo e mel", price:214.90, atacado:161.90, decant:47.90, cat:"feminino", c:["#211a10","#0b0805"]},


    {id:40, name:"Flor do Oriente", tag:"Doce Oriental", note:"Flor de laranjeira e âmbar", price:229.90, atacado:172.90, decant:50.90, cat:"feminino", c:["#2a2115","#0f0b06"]},


    {id:41, name:"Almiscar Real", tag:"Unissex Amadeirado", note:"Almíscar branco e sândalo", price:154.90, atacado:116.90, decant:34.90, cat:"unissex", c:["#3a2c12","#160f06"]},


    {id:42, name:"Ambar Negro", tag:"Unissex Intenso", note:"Âmbar negro, baunilha e couro", price:159.90, atacado:119.90, decant:35.90, cat:"unissex", c:["#3a1a1c","#160a0b"]},


    {id:43, name:"Trilha do Deserto", tag:"Oriental Resinoso", note:"Incenso, oud e resinas", price:174.90, atacado:131.90, decant:38.90, cat:"unissex", c:["#3a230f","#170f06"]},


    {id:44, name:"Vento de Oud", tag:"Unissex Ambarado", note:"Âmbar, sândalo e especiarias", price:189.90, atacado:142.90, decant:41.90, cat:"unissex", c:["#232323","#0c0c0c"]},


    {id:45, name:"Essencia Real", tag:"Fresco Amadeirado", note:"Oud, rosa e almíscar", price:189.90, atacado:142.90, decant:41.90, cat:"unissex", c:["#1c150a","#090604"]},


    {id:46, name:"Fumaca Dourada", tag:"Unissex Amadeirado", note:"Almíscar branco e sândalo", price:204.90, atacado:153.90, decant:45.90, cat:"unissex", c:["#331c28","#130a0f"]},


    {id:47, name:"Caravana", tag:"Unissex Intenso", note:"Âmbar negro, baunilha e couro", price:219.90, atacado:164.90, decant:48.90, cat:"unissex", c:["#211a10","#0b0805"]},


    {id:48, name:"Oasis Negro", tag:"Oriental Resinoso", note:"Incenso, oud e resinas", price:219.90, atacado:164.90, decant:48.90, cat:"unissex", c:["#2a2115","#0f0b06"]},


    {id:49, name:"Incenso Real", tag:"Unissex Ambarado", note:"Âmbar, sândalo e especiarias", price:154.90, atacado:116.90, decant:34.90, cat:"unissex", c:["#3a2c12","#160f06"]},


    {id:50, name:"Terra Dourada", tag:"Fresco Amadeirado", note:"Oud, rosa e almíscar", price:169.90, atacado:127.90, decant:37.90, cat:"unissex", c:["#3a1a1c","#160a0b"]},


    {id:51, name:"Segredo Arabe", tag:"Unissex Amadeirado", note:"Almíscar branco e sândalo", price:169.90, atacado:127.90, decant:37.90, cat:"unissex", c:["#3a230f","#170f06"]},


    {id:52, name:"Alma do Deserto", tag:"Unissex Intenso", note:"Âmbar negro, baunilha e couro", price:184.90, atacado:138.90, decant:40.90, cat:"unissex", c:["#232323","#0c0c0c"]},


    {id:53, name:"Lenda Dourada", tag:"Oriental Resinoso", note:"Incenso, oud e resinas", price:199.90, atacado:149.90, decant:43.90, cat:"unissex", c:["#1c150a","#090604"]},


    {id:54, name:"Horizonte Arabe", tag:"Unissex Ambarado", note:"Âmbar, sândalo e especiarias", price:199.90, atacado:149.90, decant:43.90, cat:"unissex", c:["#331c28","#130a0f"]},


    {id:55, name:"Chama Dourada", tag:"Fresco Amadeirado", note:"Oud, rosa e almíscar", price:214.90, atacado:161.90, decant:47.90, cat:"unissex", c:["#211a10","#0b0805"]},


    {id:56, name:"Sombra de Oud", tag:"Unissex Amadeirado", note:"Almíscar branco e sândalo", price:229.90, atacado:172.90, decant:50.90, cat:"unissex", c:["#2a2115","#0f0b06"]},


    {id:57, name:"Miragem Dourada", tag:"Unissex Intenso", note:"Âmbar negro, baunilha e couro", price:149.90, atacado:112.90, decant:32.90, cat:"unissex", c:["#3a2c12","#160f06"]},


    {id:58, name:"Reino de Ouro", tag:"Oriental Resinoso", note:"Incenso, oud e resinas", price:164.90, atacado:123.90, decant:36.90, cat:"unissex", c:["#3a1a1c","#160a0b"]},


    {id:59, name:"Estrela do Deserto", tag:"Unissex Ambarado", note:"Âmbar, sândalo e especiarias", price:179.90, atacado:134.90, decant:39.90, cat:"unissex", c:["#3a230f","#170f06"]},


    {id:60, name:"Heranca Real", tag:"Fresco Amadeirado", note:"Oud, rosa e almíscar", price:179.90, atacado:134.90, decant:39.90, cat:"unissex", c:["#232323","#0c0c0c"]},
  ];

/* =====================================================================
   3) CARROSSEL DE OFERTAS (caixa ao lado do título "Fragrâncias que
   contam histórias")
   Cada linha aponta pra um produto (pelo "id" lá de cima) e adiciona
   um selo + um preço "de/por". Pra trocar quem aparece no carrossel,
   troque o productId. Pra tirar o "preço antigo" (sem promoção), é só
   apagar o oldPrice ou deixar null.
   ===================================================================== */
const offers = [
  { productId: 6,  badge: "OFERTA",       oldPrice: 229.90 },
  { productId: 21, badge: "MAIS VENDIDO", oldPrice: null   },
  { productId: 47, badge: "LANÇAMENTO",   oldPrice: null   },
  { productId: 30, badge: "OFERTA",       oldPrice: 259.90 },
  { productId: 8,  badge: "MAIS VENDIDO", oldPrice: null   },
];
