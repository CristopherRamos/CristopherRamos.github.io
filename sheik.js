/* =====================================================================
   SHEIK.JS — o sheik que aparece dando "oi" quando a página carrega.

   Como funciona (resumo):
   - O vídeo media/sheik.mp4 tem fundo verde. Aqui o fundo é removido ao
     vivo, quadro a quadro, na placa de vídeo (WebGL) e desenhado num <canvas> —
     por isso ele aparece "solto" na tela, sem caixa nem fundo, e o som vem
     junto no mesmo arquivo. Se o aparelho não suportar WebGL, usa um plano B
     no processador (mais pesado) e reduz a resolução sozinho se engasgar.
   - Ele entra SEM SOM (os navegadores bloqueiam som automático). No balão
     tem um botão "Ouvir": ao clicar, o vídeo recomeça com áudio.
   - Aparece uma vez a cada REPETIR_DEPOIS_DE_HORAS por visitante, não bloqueia
     nenhum clique (só o balão e o botão ✕ são clicáveis) e não aparece pra
     quem deixou o celular/PC em "reduzir animações".

   MUDAR O TEXTO DO BALÃO, O LADO DA TELA, OS TEMPOS: é só mexer em CONFIG.
   ===================================================================== */
(function(){

  var CONFIG = {
    VIDEO: 'media/sheik.mp4',
    FALA:'Seja bem-vindo à CR Store.', // <<< texto do balão (troque pelo que o sheik fala no áudio)
    POSICAO: 'direita',            // 'direita' ou 'esquerda'
    ATRASO_MS: 1500,               // espera depois da página carregar, pra não competir com ela
    TEMPO_PARADO_MS: 8000,         // depois que o vídeo acaba, quanto tempo fica parado esperando o clique em "Ouvir"
    REPETIR_DEPOIS_DE_HORAS: 0,   // só aparece de novo pro mesmo visitante depois desse tempo (0 = aparece sempre)
    CHAVE_VERDE_MIN: 8,            // recorte do verde: abaixo disso o pixel é do personagem (100% visível)
    CHAVE_VERDE_MAX: 34,           // ...acima disso é fundo (100% transparente). Se sobrar contorno/véu verde, mexa nesses dois
    FORCAR_2D: false               // true = não usa a placa de vídeo (WebGL) e faz o recorte no processador (mais lento; só pra testar)
  };

  // quem pediu pro aparelho reduzir animações não recebe o personagem
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // já mostrou hoje? então não mostra de novo
  var STORAGE_KEY = 'cr_sheik_visto';
  try{
    var visto = Number(localStorage.getItem(STORAGE_KEY));
    if(CONFIG.REPETIR_DEPOIS_DE_HORAS > 0 && visto && (Date.now() - visto) < CONFIG.REPETIR_DEPOIS_DE_HORAS * 3600 * 1000) return;
  }catch(e){}

  var lado = CONFIG.POSICAO === 'esquerda' ? 'esquerda' : 'direita';
  var wrap, canvas, desenhar, video, botaoOuvir, timerSaida, rodando = false, removido = false;

  /* ---------------------------------------------------------------
     remove o verde de UM quadro: quanto mais "verde puro" o pixel, mais
     transparente ele fica; o que sobra de verde nas bordas é neutralizado
     --------------------------------------------------------------- */
  function removerVerde(dados){
    var LO = CONFIG.CHAVE_VERDE_MIN, HI = CONFIG.CHAVE_VERDE_MAX;
    for(var i = 0; i < dados.length; i += 4){
      var r = dados[i], g = dados[i+1], b = dados[i+2];
      var m = r > b ? r : b;
      var dom = g - m;                       // o quanto o verde "manda" nesse pixel
      if(dom >= HI){ dados[i+3] = 0; continue; }
      if(dom > LO) dados[i+3] = 255 * (HI - dom) / (HI - LO);
      var med = (r + b) / 2 + 1;
      if(g > med) dados[i+1] = med;          // tira o reflexo verde das bordas (ex: entre os dedos)
    }
  }

  /* ---------------------------------------------------------------
     MODO 1 (principal): o recorte do verde roda na PLACA DE VÍDEO (WebGL).
     É o que deixa tudo fluido — o processador quase não trabalha.
     A conta é a mesma de removerVerde(), só que escrita pra GPU.
     --------------------------------------------------------------- */
  var SHADER_VERTICE =
    'attribute vec2 aPos;varying vec2 vUv;' +
    'void main(){vUv=vec2(aPos.x*0.5+0.5,0.5-aPos.y*0.5);gl_Position=vec4(aPos,0.0,1.0);}';
  var SHADER_FRAGMENTO =
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uLim;' +
    'void main(){' +
      'vec3 c=texture2D(uTex,vUv).rgb;' +
      'float dom=c.g-max(c.r,c.b);' +
      'float a=clamp((uLim.y-dom)/(uLim.y-uLim.x),0.0,1.0);' +
      'float g=min(c.g,(c.r+c.b)*0.5+0.004);' +
      'gl_FragColor=vec4(vec3(c.r,g,c.b)*a,a);' +   // saída "premultiplicada", que é o que o canvas espera
    '}';

  function compilarShader(gl, tipo, fonte){
    var s = gl.createShader(tipo);
    gl.shaderSource(s, fonte);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  // devolve a função que desenha um quadro, ou null se a placa de vídeo/navegador não der conta
  function prepararWebGL(cv){
    var gl = null;
    var opcoes = {alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power'};
    try{ gl = cv.getContext('webgl', opcoes) || cv.getContext('experimental-webgl', opcoes); }catch(e){ gl = null; }
    if(!gl) return null;

    var LO = CONFIG.CHAVE_VERDE_MIN, HI = CONFIG.CHAVE_VERDE_MAX;
    if(!(HI > LO)) return null;
    var vs = compilarShader(gl, gl.VERTEX_SHADER, SHADER_VERTICE);
    var fs = compilarShader(gl, gl.FRAGMENT_SHADER, SHADER_FRAGMENTO);
    if(!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
    gl.uniform2f(gl.getUniformLocation(prog, 'uLim'), LO / 255, HI / 255);
    gl.clearColor(0, 0, 0, 0);

    cv.addEventListener('webglcontextlost', function(e){ e.preventDefault(); sair(true); });

    return function(){
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  /* ---------------------------------------------------------------
     MODO 2 (plano B): se a placa de vídeo não estiver disponível, faz o
     recorte no processador. Funciona em qualquer navegador, mas é mais
     pesado — por isso, se perceber que está lento, reduz a resolução sozinho.
     --------------------------------------------------------------- */
  function preparar2D(cv){
    var ctx = cv.getContext('2d', {willReadFrequently: true});
    if(!ctx) return null;
    var medidos = 0, somaMs = 0, reduzido = false;
    return function(){
      var t0 = (window.performance && performance.now) ? performance.now() : 0;
      ctx.drawImage(video, 0, 0, cv.width, cv.height);
      var img = ctx.getImageData(0, 0, cv.width, cv.height);
      removerVerde(img.data);
      ctx.putImageData(img, 0, 0);
      if(!reduzido && t0 && ++medidos <= 10){
        somaMs += performance.now() - t0;
        if(medidos === 10 && somaMs / 10 > 20){ // mais de 20 ms por quadro = vai engasgar
          reduzido = true;
          cv.width = Math.round(cv.width * 0.6);
          cv.height = Math.round(cv.height * 0.6);
        }
      }
    };
  }

  function criarCanvas(){
    var cv = document.createElement('canvas');
    cv.width = 418; cv.height = 600;   // mesmo tamanho do vídeo (ajusta sozinho ao carregar)
    cv.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(cv, wrap.firstChild);
    return cv;
  }

  // tenta o modo rápido (WebGL); se não rolar, usa o plano B. Obs.: um canvas que já
  // virou WebGL não pode virar 2D, por isso o plano B usa um canvas novinho.
  function escolherModo(){
    canvas = criarCanvas();
    desenhar = CONFIG.FORCAR_2D ? null : prepararWebGL(canvas);
    var modoWebGL = !!desenhar;
    if(!desenhar){
      if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = criarCanvas();
      desenhar = preparar2D(canvas);
    }
    if(!desenhar) sair(true);
    else if(window.console && console.info){
      // (aperte F12 > Console pra ver) — ajuda a saber se está no modo rápido
      console.info('[sheik] recorte do verde rodando ' + (modoWebGL ? 'na placa de vídeo (WebGL, modo rápido)' : 'no processador (plano B)'));
    }
  }

  function desenharQuadro(){
    if(!desenhar || removido) return;
    try{
      desenhar();
    }catch(e){
      // acontece, por exemplo, ao abrir o site direto do computador (file://):
      // o navegador proíbe ler o vídeo. Sem drama: some sem quebrar nada.
      sair(true);
    }
  }

  function laco(){
    if(removido || !rodando) return;
    desenharQuadro();
    if(video.requestVideoFrameCallback) video.requestVideoFrameCallback(laco);
    else requestAnimationFrame(laco);
  }

  function comecarLaco(){
    if(rodando) return;
    rodando = true;
    laco();
  }

  /* ---------------------------------------------------------------
     montar a peça na página
     --------------------------------------------------------------- */
  function montar(){
    wrap = document.createElement('div');
    wrap.id = 'sheik';
    wrap.className = 'sheik-' + lado;
    wrap.setAttribute('role', 'complementary');
    wrap.setAttribute('aria-label', 'Boas-vindas');

    var bolha = document.createElement('div');
    bolha.className = 'sheik-bolha';
    var texto = document.createElement('p');
    texto.textContent = CONFIG.FALA;
    botaoOuvir = document.createElement('button');
    botaoOuvir.type = 'button';
    botaoOuvir.className = 'sheik-ouvir';
    botaoOuvir.textContent = '🔊 Ouvir';
    var fechar = document.createElement('button');
    fechar.type = 'button';
    fechar.className = 'sheik-fechar';
    fechar.setAttribute('aria-label', 'Fechar');
    fechar.textContent = '✕';
    bolha.appendChild(fechar);
    bolha.appendChild(texto);
    bolha.appendChild(botaoOuvir);

    wrap.appendChild(bolha);

    // o vídeo de verdade fica escondido; só o canvas (sem o verde) aparece
    video = document.createElement('video');
    video.className = 'sheik-video-oculto';
    video.src = CONFIG.VIDEO;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';

    escolherModo();            // cria o canvas (WebGL ou plano B)
    if(removido) return;

    document.body.appendChild(video);
    document.body.appendChild(wrap);

    botaoOuvir.addEventListener('click', ouvir);
    fechar.addEventListener('click', function(){ sair(false); });
    video.addEventListener('loadedmetadata', function(){
      // o canvas acompanha o tamanho do vídeo (assim dá pra trocar o vídeo por outro sem mexer aqui)
      if(video.videoWidth){ canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    });
    video.addEventListener('play', comecarLaco);
    video.addEventListener('seeked', desenharQuadro);
    video.addEventListener('ended', aoTerminar);
    video.addEventListener('error', function(){ sair(true); });
  }

  function aoTerminar(){
    rodando = false;
    desenharQuadro(); // garante o último quadro (ele parado, sorrindo)
    botaoOuvir.disabled = false;
    botaoOuvir.textContent = '🔊 Ouvir de novo';
    clearTimeout(timerSaida);
    timerSaida = setTimeout(function(){ sair(false); }, CONFIG.TEMPO_PARADO_MS);
  }

  function ouvir(){
    clearTimeout(timerSaida);
    botaoOuvir.disabled = true;
    botaoOuvir.textContent = '🔊 Tocando...';
    video.muted = false;          // este clique é o "gesto" que libera o som
    video.currentTime = 0;
    var p = video.play();
    if(p && p.catch) p.catch(function(){ botaoOuvir.disabled = false; botaoOuvir.textContent = '🔊 Ouvir'; });
  }

  function sair(semBarulho){
    if(removido) return;
    removido = true;
    clearTimeout(timerSaida);
    try{ video.pause(); }catch(e){}
    if(wrap){
      wrap.classList.remove('sheik-visivel');
      setTimeout(function(){
        if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if(video && video.parentNode) video.parentNode.removeChild(video);
      }, semBarulho ? 0 : 700);
    }
  }

  function comecar(){
    montar();
    if(removido) return;
    var jaIniciou = false;
    function aparecer(){
      try{ localStorage.setItem(STORAGE_KEY, String(Date.now())); }catch(e){}
      requestAnimationFrame(function(){ if(wrap && !removido) wrap.classList.add('sheik-visivel'); });
    }
    function iniciar(){
      if(jaIniciou || removido) return;
      jaIniciou = true;
      var p = video.play();
      if(p && p.then) p.then(aparecer).catch(function(){ sair(true); }); // navegador não deixou nem o vídeo mudo: desiste em silêncio
      else aparecer();
    }
    if(video.readyState >= 3) iniciar();
    else video.addEventListener('canplay', iniciar);
  }

  function aoCarregar(){ setTimeout(comecar, CONFIG.ATRASO_MS); }
  if(document.readyState === 'complete') aoCarregar();
  else window.addEventListener('load', aoCarregar);

})();
