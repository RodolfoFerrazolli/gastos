// =====================================================================
//  VISOR DE FOTOS — abre a foto em tela cheia
//  - Pinça (dois dedos) para ampliar; toque duplo amplia ou volta ao normal
//  - Com a foto ampliada, arraste para andar pela foto
//  - Arraste para os lados (ou use as setas) para ver a próxima foto
//  - Fecha no X ou no "voltar" do Android
//  Foto que não está mais no celular (guardada no servidor) é baixada na
//  hora, se houver internet.
// =====================================================================
const Visor = (() => {
  const $ = (id) => document.getElementById(id);
  let estado = null; // { itens, i, baixar, mensagemErro, urls, escala, tx, ty, vez }
  const ponteiros = new Map();
  let gesto = null;
  let ultimoToque = { t: 0, x: 0, y: 0 };
  const ESCALA_MAX = 6;

  const palco = () => $('visor-palco');
  const img = () => $('visor-img');

  function aberto() { return !!estado; }

  /**
   * itens: [{ blob, arquivoId }] — blob null = foto guardada no servidor.
   * opcoes.baixar(item) => Promise<Blob>; opcoes.mensagemErro(e) => texto.
   */
  function abrir(itens, indice = 0, opcoes = {}) {
    if (!itens || !itens.length) return;
    if (estado) fechar();
    estado = {
      itens: itens.map(x => ({ blob: x.blob || null, arquivoId: x.arquivoId || '' })),
      i: Math.max(0, Math.min(indice, itens.length - 1)),
      baixar: opcoes.baixar || null,
      mensagemErro: opcoes.mensagemErro || ((e) => (e && e.message) || 'Não foi possível abrir a foto.'),
      urls: [], escala: 1, tx: 0, ty: 0, vez: 0
    };
    $('visor').classList.remove('oculto');
    document.body.classList.add('sem-rolagem');
    mostrar(estado.i, 0);
  }

  function fechar() {
    if (!estado) return;
    estado.urls.forEach(u => URL.revokeObjectURL(u));
    estado = null;
    ponteiros.clear();
    gesto = null;
    const im = img();
    im.removeAttribute('src');
    im.style.transform = '';
    $('visor').classList.add('oculto');
    $('visor-msg').classList.add('oculto');
    document.body.classList.remove('sem-rolagem');
  }

  function mensagem(html, tentar) {
    const m = $('visor-msg');
    if (!html) { m.classList.add('oculto'); m.innerHTML = ''; return; }
    m.innerHTML = html + (tentar ? '<button class="botao primario" type="button" id="visor-tentar">Tentar de novo</button>' : '');
    m.classList.remove('oculto');
    if (tentar) $('visor-tentar').onclick = tentar;
  }

  function atualizarSetas() {
    const e = estado;
    const ampliada = e.escala > 1.01;
    $('visor-ant').classList.toggle('oculto', e.itens.length < 2 || e.i === 0 || ampliada);
    $('visor-prox').classList.toggle('oculto', e.itens.length < 2 || e.i === e.itens.length - 1 || ampliada);
  }

  async function mostrar(i, direcao) {
    const e = estado;
    if (!e) return;
    e.i = i;
    const vez = ++e.vez;
    e.escala = 1; e.tx = 0; e.ty = 0;
    $('visor-contador').textContent = e.itens.length > 1 ? `${i + 1} de ${e.itens.length}` : '';
    atualizarSetas();
    const im = img();
    const item = e.itens[i];
    mensagem('');
    let blob = item.blob;
    if (!blob) {
      im.classList.add('oculto');
      im.removeAttribute('src');
      if (!e.baixar || !item.arquivoId) { mensagem('<p>Esta foto não está neste celular.</p>'); return; }
      mensagem('<p>☁️ Baixando a foto do servidor…</p>');
      try {
        blob = await e.baixar(item);
      } catch (err) {
        if (estado !== e || e.vez !== vez) return;
        mensagem(`<p>${esc(e.mensagemErro(err))}</p>`, () => mostrar(i, 0));
        return;
      }
      if (estado !== e || e.vez !== vez) return;
      if (!blob) { mensagem('<p>Não foi possível abrir a foto.</p>', () => mostrar(i, 0)); return; }
      item.blob = blob;
      mensagem('');
    }
    const url = URL.createObjectURL(blob);
    e.urls.push(url);
    im.classList.remove('animar');
    im.src = url;
    im.classList.remove('oculto');
    if (direcao) {
      // a foto nova entra pelo lado
      im.style.transform = `translate(${direcao > 0 ? palco().clientWidth : -palco().clientWidth}px, 0)`;
      void im.offsetWidth;
      im.classList.add('animar');
    }
    aplicar(!!direcao);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ------------------------------------------------------------------
  //  Ampliar e mover
  // ------------------------------------------------------------------
  /** Mantém a foto dentro da tela (e centralizada quando cabe). */
  function limitar() {
    const e = estado;
    const W = palco().clientWidth;
    const H = palco().clientHeight;
    const nw = img().naturalWidth || W;
    const nh = img().naturalHeight || H;
    const ajuste = Math.min(W / nw, H / nh);
    const pw = nw * ajuste;
    const ph = nh * ajuste;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    const s = e.escala;
    if (pw * s <= W) e.tx = (W - pw * s) / 2 - px * s;
    else e.tx = Math.min(-px * s, Math.max(W - (px + pw) * s, e.tx));
    if (ph * s <= H) e.ty = (H - ph * s) / 2 - py * s;
    else e.ty = Math.min(-py * s, Math.max(H - (py + ph) * s, e.ty));
  }

  function aplicar(animar) {
    if (!estado) return;
    const im = img();
    im.classList.toggle('animar', !!animar);
    im.style.transform = `translate(${estado.tx}px, ${estado.ty}px) scale(${estado.escala})`;
    atualizarSetas();
  }

  function zoomDuplo(cx, cy) {
    const e = estado;
    const r = palco().getBoundingClientRect();
    if (e.escala > 1.01) {
      e.escala = 1; e.tx = 0; e.ty = 0;
    } else {
      const s = 2.5;
      const x = cx - r.left;
      const y = cy - r.top;
      const qx = (x - e.tx) / e.escala;
      const qy = (y - e.ty) / e.escala;
      e.escala = s; e.tx = x - qx * s; e.ty = y - qy * s;
    }
    limitar();
    aplicar(true);
  }

  function ir(passo) {
    const e = estado;
    if (!e) return;
    const destino = e.i + passo;
    if (destino < 0 || destino >= e.itens.length) { aplicar(true); return; }
    const im = img();
    im.classList.add('animar');
    im.style.transform = `translate(${passo > 0 ? -palco().clientWidth : palco().clientWidth}px, 0)`;
    setTimeout(() => { if (estado === e) mostrar(destino, passo); }, 180);
  }

  function iniciarGesto(depoisDePinca) {
    const pts = [...ponteiros.values()];
    const r = palco().getBoundingClientRect();
    gesto = { s0: estado.escala, tx0: estado.tx, ty0: estado.ty, n: pts.length, t0: Date.now(), moveu: false, dx: 0, semToque: !!depoisDePinca };
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesto.d0 = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      gesto.m0 = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
    } else if (pts.length === 1) {
      gesto.p0 = { x: pts[0].x - r.left, y: pts[0].y - r.top };
    }
  }

  function moverGesto() {
    const e = estado;
    if (!e || !gesto) return;
    const pts = [...ponteiros.values()];
    const r = palco().getBoundingClientRect();
    if (pts.length >= 2 && gesto.n >= 2) {
      const [a, b] = pts;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const s = Math.min(ESCALA_MAX, Math.max(1, gesto.s0 * d / gesto.d0));
      const qx = (gesto.m0.x - gesto.tx0) / gesto.s0;
      const qy = (gesto.m0.y - gesto.ty0) / gesto.s0;
      e.escala = s; e.tx = m.x - qx * s; e.ty = m.y - qy * s;
      gesto.moveu = true;
      limitar();
      aplicar(false);
    } else if (pts.length === 1 && gesto.n === 1) {
      const dx = pts[0].x - r.left - gesto.p0.x;
      const dy = pts[0].y - r.top - gesto.p0.y;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) gesto.moveu = true;
      if (!gesto.moveu) return;
      if (e.escala > 1.01) {
        e.tx = gesto.tx0 + dx; e.ty = gesto.ty0 + dy;
        limitar();
        aplicar(false);
      } else if (e.itens.length > 1 && !img().classList.contains('oculto')) {
        gesto.dx = dx; // arrastando para o lado: próxima/anterior
        const im = img();
        im.classList.remove('animar');
        im.style.transform = `translate(${dx}px, 0)`;
      }
    }
  }

  function terminarGesto(ev) {
    const e = estado;
    if (!e || !gesto) return;
    if (gesto.n === 1) {
      if (e.escala <= 1.01 && e.itens.length > 1 && gesto.moveu) {
        const W = palco().clientWidth;
        const rapido = Math.abs(gesto.dx) / Math.max(1, Date.now() - gesto.t0) > 0.5;
        if ((gesto.dx < -W * 0.18 || (rapido && gesto.dx < -30)) && e.i < e.itens.length - 1) { ir(1); return; }
        if ((gesto.dx > W * 0.18 || (rapido && gesto.dx > 30)) && e.i > 0) { ir(-1); return; }
        aplicar(true); // volta para o lugar
        return;
      }
      if (!gesto.moveu && !gesto.semToque) {
        const agora = Date.now();
        if (agora - ultimoToque.t < 320 && Math.hypot(ev.clientX - ultimoToque.x, ev.clientY - ultimoToque.y) < 40) {
          ultimoToque.t = 0;
          zoomDuplo(ev.clientX, ev.clientY);
        } else {
          ultimoToque = { t: agora, x: ev.clientX, y: ev.clientY };
        }
      }
      return;
    }
    if (e.escala < 1.03) { e.escala = 1; limitar(); aplicar(true); }
  }

  function iniciar() {
    const p = palco();
    p.addEventListener('pointerdown', (ev) => {
      if (!estado) return;
      try { p.setPointerCapture(ev.pointerId); } catch (e) { /* opcional */ }
      ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      iniciarGesto(false);
    });
    p.addEventListener('pointermove', (ev) => {
      if (!estado || !ponteiros.has(ev.pointerId)) return;
      ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      moverGesto();
    });
    const soltar = (ev) => {
      if (!ponteiros.has(ev.pointerId)) return;
      ponteiros.delete(ev.pointerId);
      terminarGesto(ev);
      if (estado && ponteiros.size) iniciarGesto(true); // o dedo que ficou continua movendo a foto
      else gesto = null;
    };
    p.addEventListener('pointerup', soltar);
    p.addEventListener('pointercancel', soltar);
    img().addEventListener('load', () => { if (estado && estado.escala > 1.01) { limitar(); aplicar(false); } });
    $('visor').addEventListener('contextmenu', (ev) => ev.preventDefault());
    $('visor-fechar').onclick = () => fechar();
    $('visor-ant').onclick = () => ir(-1);
    $('visor-prox').onclick = () => ir(1);
    window.addEventListener('resize', () => { if (estado) { limitar(); aplicar(false); } });
    document.addEventListener('keydown', (ev) => {
      if (!estado) return;
      if (ev.key === 'Escape') fechar();
      if (ev.key === 'ArrowLeft') ir(-1);
      if (ev.key === 'ArrowRight') ir(1);
    });
  }

  iniciar();
  return { abrir, fechar, aberto };
})();
