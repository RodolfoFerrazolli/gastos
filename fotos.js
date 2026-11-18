// =====================================================================
//  FOTOS: abre, gira, recorta e reduz no próprio celular antes de guardar
//  e enviar (lado maior de 1600 px em JPEG: a nota continua legível e o
//  arquivo fica bem menor, economizando espaço e dados móveis). As fotos
//  do "Lançar por foto" ficam maiores (2400 px), para a IA ler a nota.
// =====================================================================
const Fotos = (() => {
  const LADO_MAXIMO = 1600;   // foto final
  const LADO_TRABALHO = 4000; // cópia usada no recorte (evita estourar a memória com câmeras de 50 MP)
  const QUALIDADE = 0.75;

  function carregarImagem(arquivo) {
    return new Promise((ok, falha) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Formato de imagem não suportado.')); };
      img.src = url;
    });
  }

  async function decodificar(arquivo) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch (e) {
      return carregarImagem(arquivo);
    }
  }

  function novaTela(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  /** Abre a foto já na orientação certa, numa tela (canvas) de no máximo 4000 px. */
  async function carregar(arquivo) {
    const img = await decodificar(arquivo);
    const w0 = img.width || img.naturalWidth;
    const h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) throw new Error('Formato de imagem não suportado.');
    const escala = Math.min(1, LADO_TRABALHO / Math.max(w0, h0));
    const c = novaTela(w0 * escala, h0 * escala);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    return c;
  }

  /** Gira 90° no sentido horário. */
  function girar(origem) {
    const c = novaTela(origem.height, origem.width);
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(origem, 0, 0);
    return c;
  }

  /** Recorta a região (em pixels da tela de trabalho) e reduz para no máximo 1600 px (ou o lado pedido), em JPEG. */
  async function exportar(origem, sx = 0, sy = 0, sw = origem.width, sh = origem.height, ladoMaximo = LADO_MAXIMO, qualidade = QUALIDADE) {
    const escala = Math.min(1, ladoMaximo / Math.max(sw, sh));
    const c = novaTela(sw * escala, sh * escala);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(origem, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', qualidade));
    c.width = c.height = 0;
    if (!blob) throw new Error('Não foi possível processar a foto.');
    return blob;
  }

  /** Foto inteira, só reduzida. */
  async function reduzir(arquivo) {
    const c = await carregar(arquivo);
    const blob = await exportar(c);
    c.width = c.height = 0;
    return blob;
  }

  return { carregar, girar, exportar, reduzir };
})();
