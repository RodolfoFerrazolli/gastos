// =====================================================================
//  QR CODE DA NOTA FISCAL (NFC-e)
//  Procura o QR Code na foto: primeiro com o leitor do próprio Android
//  (BarcodeDetector, rápido) e, se não houver, com a biblioteca jsQR
//  (em segundo plano, para não travar a tela). Só vale o QR Code de nota
//  fiscal: endereço de site do governo (.gov.br) com a chave de 44 números.
// =====================================================================
const Qr = (() => {
  let detector = null;
  let semDetector = false;
  let trabalhador = null;
  let seq = 0;
  const esperando = new Map();

  /** É o QR Code de uma NFC-e? */
  function validar(texto) {
    const t = String(texto || '').trim();
    if (t.length > 1000) return false;
    if (!/^https?:\/\/[^\/?#\s]*\.gov\.br([\/?:#]|$)/i.test(t)) return false;
    const m = /[?&](?:p|chNFe)=(\d{44})/i.exec(t);
    return !!m && m[1].substr(20, 2) === '65';
  }

  function copia(origem, lado) {
    const w = origem.width, h = origem.height;
    const e = Math.min(1, lado / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * e));
    c.height = Math.max(1, Math.round(h * e));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origem, 0, 0, c.width, c.height);
    return c;
  }

  /** Pedaço da foto (x, y, largura e altura de 0 a 1), ampliado até "lado" pixels (no máximo 2,5×). */
  function recorte(origem, x, y, w, h, lado) {
    const sx = Math.round(x * origem.width), sy = Math.round(y * origem.height);
    const sw = Math.max(1, Math.round(w * origem.width)), sh = Math.max(1, Math.round(h * origem.height));
    const e = Math.min(2.5, lado / Math.max(sw, sh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(sw * e));
    c.height = Math.max(1, Math.round(sh * e));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origem, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  }
  /**
   * Pedaços da foto para procurar o QR Code com zoom (V7): 2×2 e 3×3, um pouco sobrepostos,
   * começando por baixo (na nota fiscal o QR Code costuma ficar no fim). Também acha o QR Code
   * certo numa foto com mais de um (ex.: passagem com o código de embarque).
   */
  function pedacos() {
    const lista = [];
    [[2, 0.75], [3, 0.5]].forEach(([g, tam]) => {
      const passo = (1 - tam) / (g - 1);
      for (let lin = g - 1; lin >= 0; lin--) {
        for (let col = 0; col < g; col++) lista.push([col * passo, lin * passo, tam, tam]);
      }
    });
    return lista;
  }
  async function procurar(c) {
    const achados = await comDetector(c);
    if (achados) { const v = achados.find(validar); return v ? v.trim() : null; }
    const t = await comJsQR(c);
    return t && validar(t) ? t.trim() : null;
  }

  async function comDetector(c) {
    if (semDetector || !('BarcodeDetector' in window)) { semDetector = true; return null; }
    try {
      if (!detector) {
        const formatos = await window.BarcodeDetector.getSupportedFormats();
        if (!formatos.includes('qr_code')) { semDetector = true; return null; }
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
      const r = await detector.detect(c);
      return r.map(x => x.rawValue);
    } catch (e) {
      return null;
    }
  }

  function obterTrabalhador() {
    if (trabalhador) return trabalhador;
    trabalhador = new Worker('qr-worker.js');
    trabalhador.onmessage = (e) => {
      const { id, texto } = e.data || {};
      const fim = esperando.get(id);
      if (fim) { esperando.delete(id); fim(texto || null); }
    };
    trabalhador.onerror = () => {
      esperando.forEach(fim => fim(null));
      esperando.clear();
      trabalhador = null;
    };
    return trabalhador;
  }

  function comJsQR(c) {
    return new Promise((ok) => {
      let pixels;
      try {
        pixels = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data.buffer;
      } catch (e) { ok(null); return; }
      const id = ++seq;
      const relogio = setTimeout(() => { if (esperando.has(id)) { esperando.delete(id); ok(null); } }, 9000);
      esperando.set(id, (t) => { clearTimeout(relogio); ok(t); });
      try {
        obterTrabalhador().postMessage({ id, largura: c.width, altura: c.height, pixels }, [pixels]);
      } catch (e) {
        esperando.delete(id);
        clearTimeout(relogio);
        ok(null);
      }
    });
  }

  /**
   * Procura o QR Code de nota fiscal numa foto (canvas). Devolve o texto do QR Code ou null.
   * As cópias reduzidas são feitas na hora (a foto original pode ser liberada logo depois).
   */
  async function ler(origem) {
    // cópia própria (a tela de recorte pode liberar a foto antes de a busca em pedaços terminar)
    const base = copia(origem, 3000);
    const copias = [copia(base, 1600), Math.max(base.width, base.height) > 1900 ? copia(base, 2600) : null].filter(Boolean);
    try {
      for (const c of copias) {
        const achados = await comDetector(c);
        if (achados) {
          const v = achados.find(validar);
          if (v) return v.trim();
          continue;
        }
        const t = await comJsQR(c);
        if (t && validar(t)) return t.trim();
      }
      if (!semDetector) {
        // o leitor do Android não achou: uma tentativa com a jsQR na cópia menor
        const t = await comJsQR(copias[0]);
        if (t && validar(t)) return t.trim();
      }
      // V7: procura em pedaços da foto, com zoom (no máximo uns 10 segundos)
      const limite = Date.now() + 10000;
      for (const [x, y, w, h] of pedacos()) {
        if (Date.now() > limite) break;
        const c = recorte(base, x, y, w, h, 1400);
        try {
          const t = await procurar(c);
          if (t) return t;
        } finally { c.width = 0; c.height = 0; }
      }
      return null;
    } finally {
      copias.concat(base).forEach(c => { c.width = 0; c.height = 0; });
    }
  }

  return { ler, validar };
})();
