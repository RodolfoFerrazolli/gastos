// =====================================================================
//  COMUNICAÇÃO COM O SERVIDOR (Apps Script)
// =====================================================================
const Api = (() => {
  class ErroRede extends Error {}
  class ErroServidor extends Error {
    constructor(codigo, mensagem) {
      super(mensagem || codigo);
      this.codigo = codigo;
    }
  }

  // Erros que impedem qualquer sincronização (não adianta tentar o próximo item).
  const ERROS_GERAIS = ['codigo_invalido', 'servidor_nao_configurado', 'sem_url', 'resposta_invalida', 'aparelho_invalido'];

  function urlConfigurada() {
    const u = (typeof CONFIG !== 'undefined' && CONFIG.URL_SERVIDOR) || '';
    return (/^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)) ? u : '';
  }

  async function chamar(acao, dados = {}, { tempoMs = 30000, perfil = null } = {}) {
    const p = perfil || await Perfil.obter();
    const url = urlConfigurada();
    if (!url) throw new ErroServidor('sem_url', 'O app ainda não tem o endereço do servidor (arquivo config.js).');
    if (!p) throw new ErroServidor('sem_perfil', 'Perfil não configurado.');
    const corpo = Object.assign({
      acao,
      codigo: p.codigo,
      aparelhoId: p.aparelhoId,
      nome: p.nome,
      versaoApp: CONFIG.VERSAO_APP
    }, dados);

    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), tempoMs);
    let texto;
    try {
      // text/plain evita a "pré-verificação" de CORS, que o Apps Script não aceita
      const resp = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(corpo),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        cache: 'no-store',
        signal: controle.signal
      });
      texto = await resp.text();
    } catch (e) {
      throw new ErroRede(e && e.name === 'AbortError' ? 'O servidor demorou demais para responder.' : 'Sem conexão com o servidor.');
    } finally {
      clearTimeout(relogio);
    }

    let j;
    try {
      j = JSON.parse(texto);
    } catch (e) {
      throw new ErroServidor('resposta_invalida', 'O servidor não respondeu corretamente. Confira o endereço em config.js e se a implantação está com acesso para "Qualquer pessoa".');
    }
    if (!j.ok) throw new ErroServidor(j.erro || 'erro', j.mensagem || 'Erro no servidor.');
    return j;
  }

  function eErroGeral(e) {
    return e instanceof ErroRede || (e instanceof ErroServidor && ERROS_GERAIS.includes(e.codigo));
  }

  return { chamar, ErroRede, ErroServidor, eErroGeral, urlConfigurada };
})();

// Informações do aparelho (modelo e versão do Android, quando o navegador informa).
const Aparelho = {
  async info() {
    let modelo = '', android = '', navegador = '';
    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const v = await navigator.userAgentData.getHighEntropyValues(['model', 'platformVersion', 'fullVersionList']);
        modelo = v.model || '';
        if ((navigator.userAgentData.platform || '').toLowerCase() === 'android') android = v.platformVersion || '';
        const marca = (v.fullVersionList || []).find(b => /Chrome|Samsung|Edge|Opera/i.test(b.brand) && !/Chromium/i.test(b.brand));
        if (marca) navegador = `${marca.brand} ${marca.version.split('.')[0]}`;
      }
    } catch (e) { /* o navegador não informou */ }
    const ua = navigator.userAgent || '';
    if (!android) { const m = ua.match(/Android\s([\d.]+)/); if (m) android = m[1]; }
    if (!modelo) { const m = ua.match(/Android [\d.]+; ([^;)]+)[;)]/); if (m && m[1] !== 'K') modelo = m[1].trim(); }
    if (!navegador) { const m = ua.match(/(SamsungBrowser|Chrome|Firefox)\/(\d+)/); if (m) navegador = `${m[1]} ${m[2]}`; }
    return { modelo, android, navegador };
  }
};
