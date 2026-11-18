// =====================================================================
//  CÂMERA DENTRO DO APP
//  Tira a foto direto (sem a tela "Repetir / OK" da câmera do celular)
//  e já entrega para a tela de recorte. Tem lanterna, quando o celular
//  permite. Se não der para usar a câmera aqui (permissão negada, por
//  exemplo), oferece a câmera do próprio celular.
// =====================================================================
const Camera = (() => {
  const $ = (id) => document.getElementById(id);
  let estado = null; // { stream, track, resolver, lanterna, ocupado }
  let esperaSistema = null; // câmera do próprio celular (quando a pessoa prefere ou a do app não funciona)

  function suportada() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
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

  function fechar(resultado) {
    if (!estado) return;
    const { resolver } = estado;
    pararStream();
    estado = null;
    $('camera').classList.add('oculto');
    document.body.classList.remove('sem-rolagem');
    resolver(resultado || null);
  }

  async function obterStream() {
    const pedidos = [
      { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } } },
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      { audio: false, video: true }
    ];
    let ultimo = null;
    for (const p of pedidos) {
      try {
        return await navigator.mediaDevices.getUserMedia(p);
      } catch (e) {
        ultimo = e;
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) break; // permissão negada: não adianta insistir
      }
    }
    throw ultimo || new Error('câmera indisponível');
  }

  function mostrarErro(e) {
    const negado = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    const msg = $('camera-msg');
    msg.innerHTML = `<p>${negado
      ? 'O app não tem permissão para usar a câmera. Você pode permitir nas configurações do Chrome (ícone ao lado do endereço) ou usar a câmera do celular.'
      : 'Não foi possível abrir a câmera aqui.'}</p>` +
      '<label class="botao primario" for="camera-sistema">📷 Usar a câmera do celular</label>' +
      '<button class="botao escuro" type="button" id="camera-cancelar">Cancelar</button>';
    msg.classList.remove('oculto');
    $('camera-disparo').classList.add('oculto');
    $('camera-cancelar').onclick = () => fechar(null);
  }

  async function ligar() {
    const v = $('camera-video');
    const stream = await obterStream();
    if (!estado) { // fechada enquanto esperava a permissão
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* já parada */ } });
      return;
    }
    estado.stream = stream;
    estado.track = estado.stream.getVideoTracks()[0] || null;
    v.srcObject = estado.stream;
    try { await v.play(); } catch (e) { /* toca sozinho (autoplay) */ }
    let cap = {};
    try { cap = (estado.track && estado.track.getCapabilities) ? estado.track.getCapabilities() : {}; } catch (e) { cap = {}; }
    if (cap.focusMode && cap.focusMode.includes('continuous')) {
      try { await estado.track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) { /* opcional */ }
    }
    estado.lanterna = false;
    const botao = $('camera-lanterna');
    botao.classList.toggle('oculto', !cap.torch);
    botao.classList.remove('ligada');
    botao.setAttribute('aria-pressed', 'false');
    $('camera-disparo').disabled = false;
  }

  /**
   * Abre a câmera. Devolve a foto (Blob/File) ou null se a pessoa fechar.
   */
  function abrir({ titulo = '' } = {}) {
    if (estado) fechar(null);
    return new Promise((resolver) => {
      estado = { stream: null, track: null, resolver, lanterna: false, ocupado: false };
      $('camera-titulo').textContent = titulo || 'Foto da nota';
      $('camera-msg').classList.add('oculto');
      $('camera-disparo').classList.remove('oculto');
      $('camera-disparo').disabled = true;
      $('camera-lanterna').classList.add('oculto');
      $('camera').classList.remove('oculto');
      document.body.classList.add('sem-rolagem');
      if (!suportada()) { mostrarErro(null); return; }
      ligar().catch((e) => { if (estado) { pararStream(); mostrarErro(e); } });
    });
  }

  function quadroDoVideo() {
    const v = $('camera-video');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    if (!c.width || !c.height) return Promise.resolve(null);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    return new Promise(ok => c.toBlob((b) => { c.width = c.height = 0; ok(b); }, 'image/jpeg', 0.92));
  }

  async function capturar() {
    if (!estado || estado.ocupado || !estado.track) return;
    estado.ocupado = true;
    $('camera-disparo').disabled = true;
    $('camera').classList.add('piscar');
    setTimeout(() => $('camera').classList.remove('piscar'), 180);
    let foto = null;
    // com a lanterna ligada, a foto sai do próprio vídeo (o "takePhoto" desliga a luz em vários celulares)
    if (!estado.lanterna && window.ImageCapture) {
      try {
        const ic = new ImageCapture(estado.track);
        foto = await Promise.race([ic.takePhoto(), new Promise((_, falha) => setTimeout(() => falha(new Error('demorou')), 5000))]);
      } catch (e) {
        foto = null;
      }
    }
    if (!estado) return;
    if (!foto || !foto.size) foto = await quadroDoVideo();
    if (!estado) return;
    if (!foto) {
      estado.ocupado = false;
      $('camera-disparo').disabled = false;
      return;
    }
    fechar(foto);
  }

  async function alternarLanterna() {
    if (!estado || !estado.track) return;
    const ligar = !estado.lanterna;
    try {
      await estado.track.applyConstraints({ advanced: [{ torch: ligar }] });
      estado.lanterna = ligar;
    } catch (e) {
      return;
    }
    const b = $('camera-lanterna');
    b.classList.toggle('ligada', ligar);
    b.setAttribute('aria-pressed', String(ligar));
    b.setAttribute('aria-label', ligar ? 'Desligar a lanterna' : 'Ligar a lanterna');
  }

  function iniciar() {
    $('camera-fechar').onclick = () => fechar(null);
    $('camera-disparo').onclick = () => capturar();
    $('camera-lanterna').onclick = () => alternarLanterna();
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
      if (document.visibilityState === 'visible' && estado && estado.track && estado.track.readyState === 'ended') {
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

  iniciar();
  return { abrir, abrirSistema, suportada, aberta: () => !!estado, cancelar: () => fechar(null) };
})();
