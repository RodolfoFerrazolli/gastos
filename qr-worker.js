// =====================================================================
//  Leitura do QR Code fora da tela principal (não trava o app enquanto
//  procura o QR Code na foto). Usa a biblioteca jsQR.
// =====================================================================
importScripts('vendor/jsQR.js');

self.onmessage = (e) => {
  const { id, largura, altura, pixels } = e.data || {};
  let texto = null;
  try {
    const r = self.jsQR(new Uint8ClampedArray(pixels), largura, altura, { inversionAttempts: 'attemptBoth' });
    texto = r && r.data ? r.data : null;
  } catch (x) {
    texto = null;
  }
  self.postMessage({ id, texto });
};
