// =====================================================================
//  RECORTE DE FOTO: depois de tirar ou escolher a foto, a pessoa ajusta
//  a área (arrastando os cantos ou o meio), pode girar, e escolhe
//  "Usar foto". O recorte é feito na foto em alta resolução e só depois
//  ela é reduzida (Fotos.exportar).
// =====================================================================
const Recorte = (() => {
  const MIN = 48;     // tamanho mínimo da seleção, em pixels da tela
  const MARGEM = 18;  // espaço em volta da foto (para os cantos não ficarem cortados)
  const $ = (id) => document.getElementById(id);
  let estado = null;  // { img, sel: {x0,y0,x1,y1} em frações da foto, dw, dh, ox, oy, resolver }
  let arrasto = null;

  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const selInteira = () => ({ x0: 0, y0: 0, x1: 1, y1: 1 });

  function liberar(c) { if (c) { c.width = 0; c.height = 0; } }

  function desenhar() {
    if (!estado) return;
    const area = $('recorte-area');
    const canvas = $('recorte-canvas');
    const img = estado.img;
    const maxW = Math.max(60, area.clientWidth - MARGEM * 2);
    const maxH = Math.max(60, area.clientHeight - MARGEM * 2);
    const escala = Math.min(maxW / img.width, maxH / img.height);
    const dw = Math.max(1, Math.floor(img.width * escala));
    const dh = Math.max(1, Math.floor(img.height * escala));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(dw * dpr);
    canvas.height = Math.round(dh * dpr);
    canvas.style.width = dw + 'px';
    canvas.style.height = dh + 'px';
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    estado.dw = dw;
    estado.dh = dh;
    estado.ox = canvas.offsetLeft;
    estado.oy = canvas.offsetTop;
    posicionarCaixa();
  }

  function posicionarCaixa() {
    const { sel, dw, dh, ox, oy } = estado;
    const caixa = $('recorte-caixa');
    caixa.style.left = (ox + sel.x0 * dw) + 'px';
    caixa.style.top = (oy + sel.y0 * dh) + 'px';
    caixa.style.width = ((sel.x1 - sel.x0) * dw) + 'px';
    caixa.style.height = ((sel.y1 - sel.y0) * dh) + 'px';
    const inteira = sel.x0 <= 0.001 && sel.y0 <= 0.001 && sel.x1 >= 0.999 && sel.y1 >= 0.999;
    $('recorte-inteira').disabled = inteira;
  }

  function aoTocar(e) {
    if (!estado) return;
    const alca = e.target.closest('.alca');
    if (!alca && !e.target.closest('#recorte-caixa')) return;
    e.preventDefault();
    arrasto = { modo: alca ? alca.dataset.alca : 'mover', x: e.clientX, y: e.clientY, sel: Object.assign({}, estado.sel), id: e.pointerId };
    try { $('recorte-area').setPointerCapture(e.pointerId); } catch (x) { /* opcional */ }
  }

  function aoMover(e) {
    if (!estado || !arrasto || e.pointerId !== arrasto.id) return;
    e.preventDefault();
    const dx = (e.clientX - arrasto.x) / estado.dw;
    const dy = (e.clientY - arrasto.y) / estado.dh;
    const s = Object.assign({}, arrasto.sel);
    const minX = Math.min(1, MIN / estado.dw);
    const minY = Math.min(1, MIN / estado.dh);
    if (arrasto.modo === 'mover') {
      const w = s.x1 - s.x0;
      const h = s.y1 - s.y0;
      s.x0 = limitar(s.x0 + dx, 0, 1 - w);
      s.y0 = limitar(s.y0 + dy, 0, 1 - h);
      s.x1 = s.x0 + w;
      s.y1 = s.y0 + h;
    } else {
      if (arrasto.modo.includes('w')) s.x0 = limitar(s.x0 + dx, 0, s.x1 - minX);
      if (arrasto.modo.includes('e')) s.x1 = limitar(s.x1 + dx, s.x0 + minX, 1);
      if (arrasto.modo.includes('n')) s.y0 = limitar(s.y0 + dy, 0, s.y1 - minY);
      if (arrasto.modo.includes('s')) s.y1 = limitar(s.y1 + dy, s.y0 + minY, 1);
    }
    estado.sel = s;
    posicionarCaixa();
  }

  function aoSoltar(e) {
    if (arrasto && e.pointerId === arrasto.id) arrasto = null;
  }

  function fechar(resultado, erro) {
    if (!estado) return;
    const { resolver, rejeitar, img } = estado;
    estado = null;
    arrasto = null;
    liberar(img);
    const canvas = $('recorte-canvas');
    canvas.width = canvas.height = 0;
    $('recorte').classList.add('oculto');
    document.body.classList.remove('sem-rolagem');
    if (erro) rejeitar(erro);
    else resolver(resultado);
  }

  /**
   * Mostra a tela de recorte. Devolve a foto pronta (Blob JPEG) ou null se a
   * pessoa descartar. Dá erro se o formato da imagem não for suportado.
   */
  async function abrir(arquivo, { titulo = '' } = {}) {
    if (estado) fechar(null);
    const img = await Fotos.carregar(arquivo);
    return new Promise((resolver, rejeitar) => {
      estado = { img, sel: selInteira(), resolver, rejeitar, dw: 1, dh: 1, ox: 0, oy: 0 };
      $('recorte-titulo').textContent = titulo || 'Recortar a foto';
      $('recorte-usar').disabled = false;
      $('recorte').classList.remove('oculto');
      document.body.classList.add('sem-rolagem');
      requestAnimationFrame(desenhar);
    });
  }

  function iniciar() {
    const area = $('recorte-area');
    area.addEventListener('pointerdown', aoTocar);
    area.addEventListener('pointermove', aoMover);
    area.addEventListener('pointerup', aoSoltar);
    area.addEventListener('pointercancel', aoSoltar);
    window.addEventListener('resize', () => { if (estado) requestAnimationFrame(desenhar); });

    $('recorte-descartar').onclick = () => fechar(null);
    $('recorte-inteira').onclick = () => { if (!estado) return; estado.sel = selInteira(); posicionarCaixa(); };
    $('recorte-girar').onclick = () => {
      if (!estado) return;
      const antiga = estado.img;
      estado.img = Fotos.girar(antiga);
      liberar(antiga);
      estado.sel = selInteira();
      desenhar();
    };
    $('recorte-usar').onclick = async () => {
      if (!estado) return;
      const { img, sel } = estado;
      const sx = Math.round(sel.x0 * img.width);
      const sy = Math.round(sel.y0 * img.height);
      const sw = Math.max(1, Math.round((sel.x1 - sel.x0) * img.width));
      const sh = Math.max(1, Math.round((sel.y1 - sel.y0) * img.height));
      $('recorte-usar').disabled = true;
      try {
        fechar(await Fotos.exportar(img, sx, sy, Math.min(sw, img.width - sx), Math.min(sh, img.height - sy)));
      } catch (e) {
        fechar(null, e);
      }
    };
  }

  iniciar();
  // cancelar(): usado pelo "voltar" do Android; devolve undefined (a pessoa desistiu de todas as fotos escolhidas)
  return { abrir, aberto: () => !!estado, cancelar: () => fechar(undefined) };
})();
