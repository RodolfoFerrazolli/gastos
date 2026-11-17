// =====================================================================
//  FOTOS: reduz no próprio celular antes de guardar e enviar
//  (lado maior de 1600 px em JPEG: a nota continua legível e o arquivo
//  fica bem menor, economizando espaço e dados móveis).
// =====================================================================
const Fotos = (() => {
  const LADO_MAXIMO = 1600;
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

  async function reduzir(arquivo) {
    let imagem;
    try {
      imagem = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch (e) {
      imagem = await carregarImagem(arquivo);
    }
    const largura = imagem.width || imagem.naturalWidth;
    const altura = imagem.height || imagem.naturalHeight;
    const escala = Math.min(1, LADO_MAXIMO / Math.max(largura, altura));
    const w = Math.max(1, Math.round(largura * escala));
    const h = Math.max(1, Math.round(altura * escala));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imagem, 0, 0, w, h);
    if (imagem.close) imagem.close();
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', QUALIDADE));
    if (!blob) throw new Error('Não foi possível processar a foto.');
    return blob;
  }

  return { reduzir };
})();
