// =====================================================================
//  CÂMERA DENTRO DO APP
//  Tira a foto direto (sem a tela "Repetir / OK" da câmera do celular)
//  e já entrega para a tela de recorte.
//  - Escolhe a câmera principal de trás (em celulares com várias câmeras,
//    o Chrome às vezes abre a grande-angular, que não foca de perto e
//    não tem flash). A escolha fica guardada no celular.
//  - Foco automático contínuo e "toque para focar".
//  - Flash: lanterna (fica acesa) ou flash na hora da foto, conforme o
//    celular permitir. Se ele não permitir, o botão explica o porquê.
//  Se não der para usar a câmera aqui (permissão negada, por exemplo),
//  oferece a câmera do próprio celular.
// =====================================================================
const Camera = (() => {
  const $ = (id) => document.getElementById(id);
  const CHAVE = 'cameraTraseira'; // configuração: { deviceId, label } da câmera escolhida
  let estado = null; // { stream, track, resolver, luz, lanterna, flash, ocupado, cap, fotoCap, traseiras, relogios }
  let esperaSistema = null; // câmera do próprio celular (quando a pessoa prefere ou a do app não funciona)

  const esperar = (ms) => new Promise(ok => setTimeout(ok, ms));
  const negado = (e) => !!(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'));

  function suportada() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  let relogioAviso = null;
  function aviso(msg, ms = 3200) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('oculto');
    clearTimeout(relogioAviso);
    relogioAviso = setTimeout(() => t.classList.add('oculto'), ms);
  }

  function pararStream() {
    if (estado && estado.stream) {
      estado.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* já parada */ } });
      estado.stream = null;
      estado.track = null;
    }
    const v = $('camera-video');
    try { v.pause(); } catch (e) { /* sem vídeo */ }
    v.srcObject = null;
  }

  function limparRelogios() {
    if (!estado) return;
    Object.values(estado.relogios).forEach(r => clearTimeout(r));
    estado.relogios = {};
  }

  function fechar(resultado) {
    if (!estado) return;
    const { resolver } = estado;
    limparRelogios();
    pararStream();
    estado = null;
    $('camera').classList.add('oculto');
    $('camera-foco').classList.add('oculto');
    document.body.classList.remove('sem-rolagem');
    // V8: sem foto, tira a entrada do histórico; com foto, ela fica para o recorte que vem logo depois
    if (!resultado && window.App && App.fecharCamada) App.fecharCamada();
    resolver(resultado || null);
  }

  // ------------------------------------------------------------------
  //  Abrir e escolher a câmera
  // ------------------------------------------------------------------
  async function abrirStream(deviceId) {
    const tamanho = { width: { ideal: 2560 }, height: { ideal: 1440 } };
    const pedidos = deviceId
      ? [{ audio: false, video: Object.assign({ deviceId: { exact: deviceId } }, tamanho) },
        { audio: false, video: { deviceId: { exact: deviceId } } }]
      : [{ audio: false, video: Object.assign({ facingMode: { ideal: 'environment' } }, tamanho) },
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        { audio: false, video: true }];
    let ultimo = null;
    for (const p of pedidos) {
      try {
        return await navigator.mediaDevices.getUserMedia(p);
      } catch (e) {
        ultimo = e;
        if (negado(e)) break; // permissão negada: não adianta insistir
        if (e && e.name === 'NotReadableError') await esperar(400); // a câmera anterior ainda estava sendo liberada
      }
    }
    throw ultimo || new Error('câmera indisponível');
  }

  /** Guarda o stream novo (ou descarta, se a câmera foi fechada enquanto abria). */
  function usar(stream) {
    if (!estado) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* já parada */ } });
      return false;
    }
    estado.stream = stream;
    estado.track = stream.getVideoTracks()[0] || null;
    estado.cap = {};
    estado.fotoCap = null;
    return true;
  }

  async function mostrarVideo() {
    const v = $('camera-video');
    v.srcObject = estado.stream;
    try { await v.play(); } catch (e) { /* toca sozinho (autoplay) */ }
  }

  function idAtual() {
    try { return (estado && estado.track && estado.track.getSettings().deviceId) || ''; } catch (e) { return ''; }
  }

  /** Câmeras de trás, a de número menor primeiro (no Android, a "camera2 0, facing back" é a principal). */
  async function camerasTraseiras() {
    let lista = [];
    try {
      lista = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    } catch (e) {
      return [];
    }
    const tras = lista.filter(d => /back|rear|environment|traseira/i.test(d.label || ''));
    const numero = (d) => {
      const m = /(\d+)\s*,/.exec(d.label || '');
      return m ? Number(m[1]) : 99;
    };
    return tras.map((d, i) => ({ deviceId: d.deviceId, label: d.label || '', n: numero(d), i }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i));
  }

  /** As capacidades (lanterna, foco) aparecem alguns instantes depois de a câmera ligar: espera um pouco. */
  async function lerCapacidades(track, ms = 1600) {
    const fim = Date.now() + ms;
    let cap = {};
    for (;;) {
      try { cap = (track && track.getCapabilities) ? (track.getCapabilities() || {}) : {}; } catch (e) { cap = {}; }
      if (cap.torch || (cap.focusMode && cap.focusMode.length)) return cap;
      if (Date.now() >= fim || !track || track.readyState === 'ended') return cap;
      await esperar(200);
    }
  }

  async function capacidadesDaFoto(track) {
    if (!window.ImageCapture || !track) return null;
    try {
      const ic = new ImageCapture(track);
      return await Promise.race([ic.getPhotoCapabilities(), esperar(2500).then(() => null)]);
    } catch (e) {
      return null;
    }
  }

  function pontos(cap) {
    const f = (cap && cap.focusMode) || [];
    return (cap && cap.torch ? 2 : 0) + (f.includes('continuous') ? 2 : 0) + (f.includes('single-shot') ? 1 : 0);
  }

  async function lembrar() {
    if (!estado || !estado.track) return;
    try { await Banco.gravarConfig(CHAVE, { deviceId: idAtual(), label: estado.track.label || '' }); } catch (e) { /* opcional */ }
  }

  /** Troca para outra câmera. Se ela não abrir, volta para a câmera padrão. */
  async function trocarPara(deviceId) {
    if (!estado) return false;
    limparRelogios();
    pararStream();
    await esperar(150);
    if (!estado) return false;
    let stream = null;
    let certo = true;
    try {
      stream = await abrirStream(deviceId);
    } catch (e) {
      if (negado(e) || !estado) throw e;
      certo = false;
      stream = await abrirStream(null);
    }
    if (!usar(stream)) return false;
    await mostrarVideo();
    return certo;
  }

  /** Primeira vez: deixa ligada a câmera principal de trás (a que tem foco automático e flash). */
  async function escolherMelhor() {
    const tras = estado.traseiras;
    if (tras.length < 2) return;
    const atual = idAtual();
    const principal = tras.find(d => d.n === 0);
    if (principal) {
      if (principal.deviceId !== atual) await trocarPara(principal.deviceId);
      return;
    }
    // nomes sem número: testa as câmeras de trás (no máximo 3) e fica com a que tem foco e lanterna
    let melhor = { id: atual, p: pontos(await lerCapacidades(estado.track)) };
    let testadas = 0;
    for (const d of tras) {
      if (!estado || melhor.p >= 4 || testadas >= 3) break;
      if (d.deviceId === atual) continue;
      testadas++;
      if (!(await trocarPara(d.deviceId))) continue;
      const p = pontos(await lerCapacidades(estado.track));
      if (p > melhor.p) melhor = { id: d.deviceId, p };
    }
    if (estado && melhor.id && melhor.id !== idAtual()) await trocarPara(melhor.id);
  }

  async function ligar() {
    let salvo = null;
    try { salvo = await Banco.lerConfig(CHAVE, null); } catch (e) { salvo = null; }
    let stream = null;
    if (salvo && salvo.deviceId) {
      try { stream = await abrirStream(salvo.deviceId); } catch (e) { if (negado(e)) throw e; stream = null; }
    }
    if (!stream) stream = await abrirStream(null);
    if (!usar(stream)) return;
    await mostrarVideo();
    estado.traseiras = await camerasTraseiras();
    if (!estado) return;
    const usandoSalva = !!(salvo && salvo.deviceId && salvo.deviceId === idAtual());
    if (!usandoSalva) {
      $('camera-carregando').classList.remove('oculto');
      try { await escolherMelhor(); } finally { $('camera-carregando').classList.add('oculto'); }
      if (!estado) return;
      await lembrar();
    }
    $('camera-trocar').classList.toggle('oculto', estado.traseiras.length < 2);
    $('camera-disparo').disabled = false;
    mostrarDica();
    prepararRecursos();
  }

  /** Foco contínuo e luz (lanterna ou flash), depois que as capacidades da câmera aparecem. */
  async function prepararRecursos() {
    if (!estado || !estado.track) return;
    const track = estado.track;
    estado.luz = 'testar';
    estado.lanterna = false;
    estado.flash = false;
    atualizarBotaoLuz();
    const [cap, fotoCap] = await Promise.all([lerCapacidades(track), capacidadesDaFoto(track)]);
    if (!estado || estado.track !== track) return;
    estado.cap = cap;
    estado.fotoCap = fotoCap;
    const modos = cap.focusMode || [];
    if (modos.includes('continuous')) {
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* opcional */ }
    }
    if (!estado || estado.track !== track) return;
    if (estado.luz === 'testar') {
      if (cap.torch) estado.luz = 'lanterna';
      else if (temFlash()) estado.luz = 'flash';
      atualizarBotaoLuz();
    }
  }

  function mostrarErro(e) {
    const msg = $('camera-msg');
    msg.innerHTML = `<p>${negado(e)
      ? 'O app não tem permissão para usar a câmera. Você pode permitir nas configurações do Chrome (ícone ao lado do endereço) ou usar a câmera do celular.'
      : 'Não foi possível abrir a câmera aqui.'}</p>` +
      '<label class="botao primario" for="camera-sistema">📷 Usar a câmera do celular</label>' +
      '<button class="botao escuro" type="button" id="camera-cancelar">Cancelar</button>';
    msg.classList.remove('oculto');
    $('camera-disparo').classList.add('oculto');
    $('camera-trocar').classList.add('oculto');
    $('camera-lanterna').classList.add('oculto');
    $('camera-carregando').classList.add('oculto');
    $('camera-cancelar').onclick = () => fechar(null);
  }

  /**
   * Abre a câmera. Devolve a foto (Blob/File) ou null se a pessoa fechar.
   */
  function abrir({ titulo = '' } = {}) {
    if (estado) fechar(null);
    return new Promise((resolver) => {
      estado = {
        stream: null, track: null, resolver, luz: 'testar', lanterna: false, flash: false,
        ocupado: false, cap: {}, fotoCap: null, traseiras: [], relogios: {}
      };
      $('camera-titulo').textContent = titulo || 'Foto da nota';
      $('camera-msg').classList.add('oculto');
      $('camera-disparo').classList.remove('oculto');
      $('camera-disparo').disabled = true;
      $('camera-lanterna').classList.add('oculto');
      $('camera-trocar').classList.add('oculto');
      $('camera-carregando').classList.add('oculto');
      $('camera-dica').classList.add('oculto');
      $('camera-foco').classList.add('oculto');
      $('camera').classList.remove('oculto');
      document.body.classList.add('sem-rolagem');
      if (window.App && App.abrirCamada) App.abrirCamada('camera'); // V8: entrada própria no histórico
      if (!suportada()) { mostrarErro(null); return; }
      ligar().catch((e) => { if (estado) { pararStream(); mostrarErro(e); } });
    });
  }

  function mostrarDica() {
    const d = $('camera-dica');
    d.classList.remove('oculto', 'sumindo');
    clearTimeout(estado.relogios.dica);
    estado.relogios.dica = setTimeout(() => {
      d.classList.add('sumindo');
      if (estado) estado.relogios.dica = setTimeout(() => d.classList.add('oculto'), 600);
    }, 6000);
  }

  // ------------------------------------------------------------------
  //  Foto
  // ------------------------------------------------------------------
  function quadroDoVideo() {
    const v = $('camera-video');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    if (!c.width || !c.height) return Promise.resolve(null);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob((b) => { c.width = c.height = 0; ok(b); }, 'image/jpeg', 0.92));
  }

  function temFlash() {
    return !!(estado && estado.fotoCap && (estado.fotoCap.fillLightMode || []).includes('flash'));
  }

  async function capturar() {
    if (!estado || estado.ocupado || !estado.track) return;
    estado.ocupado = true;
    $('camera-disparo').disabled = true;
    $('camera').classList.add('piscar');
    setTimeout(() => $('camera').classList.remove('piscar'), 180);
    let foto = null;
    const track = estado.track;
    // com a lanterna ligada, a foto sai do próprio vídeo (o "takePhoto" desliga a luz em vários celulares)
    if (!estado.lanterna && window.ImageCapture) {
      const comFlash = estado.luz === 'flash' && estado.flash;
      try {
        const ic = new ImageCapture(track);
        foto = await Promise.race([
          comFlash ? ic.takePhoto({ fillLightMode: 'flash' }) : ic.takePhoto(),
          new Promise((_, falha) => setTimeout(() => falha(new Error('demorou')), comFlash ? 8000 : 5000))
        ]);
      } catch (e) {
        foto = null;
      }
    }
    if (!estado || estado.track !== track) return;
    if (!foto || !foto.size) foto = await quadroDoVideo();
    if (!estado) return;
    if (!foto) {
      estado.ocupado = false;
      $('camera-disparo').disabled = false;
      return;
    }
    fechar(foto);
  }

  // ------------------------------------------------------------------
  //  Flash / lanterna
  // ------------------------------------------------------------------
  function atualizarBotaoLuz() {
    if (!estado) return;
    const b = $('camera-lanterna');
    const flash = estado.luz === 'flash';
    const ligada = flash ? estado.flash : estado.lanterna;
    b.classList.remove('oculto');
    b.classList.toggle('ligada', !!ligada);
    b.classList.toggle('apagada', estado.luz === 'nenhum');
    b.classList.toggle('modo-flash', flash);
    b.setAttribute('aria-pressed', String(!!ligada));
    b.setAttribute('aria-label', flash
      ? (ligada ? 'Desligar o flash' : 'Ligar o flash')
      : (ligada ? 'Desligar a lanterna' : 'Ligar a lanterna'));
  }

  async function ligarLanterna(track, ligar, conferir) {
    try {
      await track.applyConstraints({ advanced: [{ torch: ligar }] });
    } catch (e) {
      return false;
    }
    if (!conferir || !ligar) return true;
    // quando a lanterna não aparece nas capacidades, só vale se o próprio celular confirmar que acendeu
    await esperar(150);
    let s = {};
    try { s = track.getSettings() || {}; } catch (e) { s = {}; }
    return s.torch === true;
  }

  function explicarSemLuz() {
    const msg = $('camera-msg');
    const varias = estado.traseiras.length > 1;
    msg.innerHTML = '<p><b>O flash não está liberado para o app neste celular.</b></p>' +
      '<p>Se precisar de luz, use a câmera do próprio celular (ela tem o flash)' +
      (varias ? ', ou toque em <b>🔄</b> para testar outra câmera de trás' : '') + '.</p>' +
      '<p class="pequeno">Dica: para usar sempre a câmera do celular, vá em Configurações → Câmera.</p>' +
      '<label class="botao primario" for="camera-sistema">📷 Usar a câmera do celular</label>' +
      '<button class="botao escuro" type="button" id="camera-continuar">Continuar aqui</button>';
    msg.classList.remove('oculto');
    $('camera-continuar').onclick = () => msg.classList.add('oculto');
  }

  async function alternarLuz() {
    if (!estado || !estado.track || estado.ocupado) return;
    const track = estado.track;
    if (estado.luz === 'testar') {
      // ainda não deu para saber: confere de novo (as capacidades podem ter chegado agora)
      let cap = {};
      try { cap = track.getCapabilities() || {}; } catch (e) { cap = {}; }
      if (!estado.fotoCap) estado.fotoCap = await capacidadesDaFoto(track);
      if (!estado || estado.track !== track) return;
      if (cap.torch) {
        estado.luz = 'lanterna';
      } else if (await ligarLanterna(track, true, true)) {
        if (!estado || estado.track !== track) return;
        estado.luz = 'lanterna';
        estado.lanterna = true;
        atualizarBotaoLuz();
        return;
      } else if (temFlash()) {
        estado.luz = 'flash';
      } else {
        estado.luz = 'nenhum';
      }
      if (!estado || estado.track !== track) return;
    }
    if (estado.luz === 'lanterna') {
      const ligar = !estado.lanterna;
      if (await ligarLanterna(track, ligar, false)) {
        if (!estado || estado.track !== track) return;
        estado.lanterna = ligar;
      } else if (ligar) {
        estado.luz = temFlash() ? 'flash' : 'nenhum';
        if (estado.luz === 'flash') { estado.flash = true; aviso('O flash vai disparar na hora da foto.'); }
      }
      atualizarBotaoLuz();
      if (estado.luz === 'nenhum') explicarSemLuz();
      return;
    }
    if (estado.luz === 'flash') {
      estado.flash = !estado.flash;
      atualizarBotaoLuz();
      aviso(estado.flash ? 'Flash ligado: ele dispara na hora da foto.' : 'Flash desligado.');
      return;
    }
    atualizarBotaoLuz();
    explicarSemLuz();
  }

  // ------------------------------------------------------------------
  //  Foco: toque na tela para focar naquele ponto
  // ------------------------------------------------------------------
  function mostrarAnel(x, y) {
    const a = $('camera-foco');
    a.style.left = x + 'px';
    a.style.top = y + 'px';
    a.classList.remove('oculto', 'ok', 'animar');
    void a.offsetWidth; // reinicia a animação
    a.classList.add('animar');
    clearTimeout(estado.relogios.anel);
    clearTimeout(estado.relogios.anelOk);
    estado.relogios.anelOk = setTimeout(() => a.classList.add('ok'), 700);
    estado.relogios.anel = setTimeout(() => a.classList.add('oculto'), 1600);
  }

  async function focarEm(ev) {
    if (!estado || !estado.track || estado.ocupado) return;
    if (ev.target.closest('button, label, .camera-msg, .camera-topo, .camera-baixo')) return;
    const v = $('camera-video');
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) return;
    const r = v.getBoundingClientRect();
    const cobre = getComputedStyle(v).objectFit !== 'contain';
    const s = cobre ? Math.max(r.width / vw, r.height / vh) : Math.min(r.width / vw, r.height / vh);
    const dw = vw * s;
    const dh = vh * s;
    const x = Math.min(1, Math.max(0, (ev.clientX - r.left - (r.width - dw) / 2) / dw));
    const y = Math.min(1, Math.max(0, (ev.clientY - r.top - (r.height - dh) / 2) / dh));
    mostrarAnel(ev.clientX, ev.clientY);
    const dica = $('camera-dica');
    if (!dica.classList.contains('oculto')) dica.classList.add('sumindo');

    const track = estado.track;
    let cap = estado.cap || {};
    try { cap = track.getCapabilities() || cap; } catch (e) { /* usa o que tinha */ }
    const modos = cap.focusMode || [];
    let ponto = false;
    try { ponto = !!navigator.mediaDevices.getSupportedConstraints().pointsOfInterest; } catch (e) { ponto = false; }
    const pedido = {};
    if (ponto) pedido.pointsOfInterest = [{ x, y }];
    if (modos.includes('single-shot')) pedido.focusMode = 'single-shot';
    else if (modos.includes('continuous')) pedido.focusMode = 'continuous';
    if (!pedido.focusMode) return; // câmera de foco fixo
    try { await track.applyConstraints({ advanced: [pedido] }); } catch (e) { /* opcional */ }
    if (!estado || estado.track !== track) return;
    clearTimeout(estado.relogios.foco);
    if (pedido.focusMode === 'single-shot' && modos.includes('continuous')) {
      // depois de focar no ponto, volta ao foco contínuo (que continua dando prioridade ao ponto tocado)
      estado.relogios.foco = setTimeout(() => {
        if (!estado || estado.track !== track) return;
        const volta = { focusMode: 'continuous' };
        if (ponto) volta.pointsOfInterest = [{ x, y }];
        track.applyConstraints({ advanced: [volta] }).catch(() => { /* opcional */ });
      }, 3000);
    }
  }

  // ------------------------------------------------------------------
  //  Trocar de câmera (quando o celular tem mais de uma atrás)
  // ------------------------------------------------------------------
  async function trocarCamera() {
    if (!estado || estado.ocupado || estado.traseiras.length < 2) return;
    estado.ocupado = true;
    $('camera-disparo').disabled = true;
    $('camera-msg').classList.add('oculto');
    const lista = estado.traseiras;
    const atual = lista.findIndex(d => d.deviceId === idAtual());
    const proxima = (atual + 1) % lista.length;
    try {
      await trocarPara(lista[proxima].deviceId);
    } catch (e) {
      if (estado) { pararStream(); mostrarErro(e); }
      return;
    }
    if (!estado) return;
    await lembrar();
    if (!estado) return;
    const agora = lista.findIndex(d => d.deviceId === idAtual());
    aviso(`Câmera ${(agora < 0 ? proxima : agora) + 1} de ${lista.length}`, 2000);
    estado.ocupado = false;
    $('camera-disparo').disabled = false;
    prepararRecursos();
  }

  function iniciar() {
    $('camera-fechar').onclick = () => fechar(null);
    $('camera-disparo').onclick = () => capturar();
    $('camera-lanterna').onclick = () => alternarLuz();
    $('camera-trocar').onclick = () => trocarCamera();
    $('camera').addEventListener('click', (ev) => { focarEm(ev); });
    const sistema = $('camera-sistema');
    sistema.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (estado) { if (f) fechar(f); return; }
      if (esperaSistema) { const fim = esperaSistema; esperaSistema = null; fim(f || null); }
    });
    sistema.addEventListener('cancel', () => {
      if (!estado && esperaSistema) { const fim = esperaSistema; esperaSistema = null; fim(null); }
    });
    document.addEventListener('visibilitychange', () => {
      // voltando de outro app: se a câmera foi desligada pelo Android, liga de novo
      if (document.visibilityState === 'visible' && estado && estado.track && estado.track.readyState === 'ended' && !estado.ocupado) {
        pararStream();
        ligar().catch((e) => { if (estado) mostrarErro(e); });
      }
    });
  }

  /** Câmera do próprio celular (tem a tela "Repetir / OK" do Android). Precisa ser chamada logo depois de um toque. */
  function abrirSistema() {
    return new Promise((ok) => {
      if (esperaSistema) esperaSistema(null);
      esperaSistema = ok;
      const inp = $('camera-sistema');
      inp.value = '';
      inp.click();
    });
  }

  /** Esquece a câmera escolhida (a próxima abertura escolhe de novo). */
  function esquecerEscolha() {
    return Banco.gravarConfig(CHAVE, null).catch(() => { /* opcional */ });
  }

  iniciar();
  return { abrir, abrirSistema, suportada, aberta: () => !!estado, cancelar: () => fechar(null), esquecerEscolha };
})();
