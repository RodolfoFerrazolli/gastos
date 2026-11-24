// =====================================================================
//  V12: PEDIDOS DE MELHORIA EM SEGUNDO PLANO
//  O pedido (áudio, texto, imagem da tela e fotos) fica guardado no celular
//  e é enviado na hora, com qualquer internet (Wi-Fi ou dados móveis).
//  Sem internet, o Android avisa o app quando ela voltar (Background Sync)
//  e o pedido vai sozinho, mesmo com o app fechado.
//  Este arquivo roda na página e no service worker (sw.js).
// =====================================================================
const PedidosFundo = (() => {
  const NOME_BANCO = 'controle-gastos';
  const TRAVA = 'gastos-envio-pedidos'; // o app do administrador usa outro nome
  const ETIQUETA = 'gastos-enviar-pedidos';

  /** Abre o banco do app sem mudar a versão dele (quem cria as tabelas é o app). */
  function abrirBanco() {
    return new Promise((ok) => {
      let req;
      try { req = indexedDB.open(NOME_BANCO); } catch (e) { ok(null); return; }
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('config')) { db.close(); ok(null); return; }
        ok(db);
      };
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    });
  }

  function lerConfig(db, chave, padrao) {
    return new Promise((ok) => {
      try {
        const r = db.transaction('config').objectStore('config').get(chave);
        r.onsuccess = () => ok(r.result ? r.result.valor : padrao);
        r.onerror = () => ok(padrao);
      } catch (e) { ok(padrao); }
    });
  }

  function gravarConfig(db, chave, valor) {
    return new Promise((ok, falha) => {
      try {
        const t = db.transaction('config', 'readwrite');
        t.objectStore('config').put({ chave, valor });
        t.oncomplete = () => ok();
        t.onerror = () => falha(t.error);
      } catch (e) { falha(e); }
    });
  }

  async function base64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function urlDoServidor() {
    const u = (typeof CONFIG !== 'undefined' && CONFIG.URL_SERVIDOR) || '';
    return (/^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)) ? u : '';
  }

  /** 'ok', 'rede' (sem internet ou servidor fora do ar) ou 'erro' (o servidor recusou). */
  async function enviarUm(m, perfil, url) {
    const dados = {
      id: m.id, criadoEm: m.criadoEm, tela: m.tela, nomeTela: m.nomeTela, janela: m.janela || '', texto: m.texto || '',
      duracao: m.duracao || 0, versaoApp: m.versaoApp || '', aparelho: m.aparelho || ''
    };
    if (m.audio) dados.audio = { mime: m.audioMime || m.audio.type || 'audio/webm', base64: await base64(m.audio) };
    if (m.imagem) dados.imagem = { mime: 'image/jpeg', base64: await base64(m.imagem) };
    if (Array.isArray(m.fotos) && m.fotos.length) {
      dados.fotos = [];
      for (const f of m.fotos.slice(0, 5)) dados.fotos.push({ mime: f.type || 'image/jpeg', base64: await base64(f) });
    }
    const corpo = Object.assign({ acao: 'enviarMelhoria', codigo: perfil.codigo, aparelhoId: perfil.aparelhoId, versaoApp: m.versaoApp || '' },
      perfil.token ? { token: perfil.token } : {}, { melhoria: dados });
    let texto;
    try {
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), 180000);
      const resp = await fetch(url, {
        method: 'POST', body: JSON.stringify(corpo), headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow', cache: 'no-store', signal: controle.signal
      });
      texto = await resp.text();
      clearTimeout(relogio);
    } catch (e) {
      return { r: 'rede' };
    }
    let j = null;
    try { j = JSON.parse(texto); } catch (e) { return { r: 'rede' }; }
    if (j && j.ok) return { r: 'ok', numero: j.numero };
    return { r: 'erro', codigo: (j && j.erro) || '', mensagem: (j && j.mensagem) || '' };
  }

  async function semTrava() {
    const db = await abrirBanco();
    if (!db) return { enviados: 0, restantes: 0, semRede: false };
    try {
      const perfil = await lerConfig(db, 'perfil', null);
      const url = urlDoServidor();
      const lista = (await lerConfig(db, 'melhoriasPendentes', [])) || [];
      if (!lista.length || !perfil || !perfil.token || !url) return { enviados: 0, restantes: lista.length, semRede: false };
      let enviados = 0;
      let semRede = false;
      const erros = [];
      for (const m of lista) {
        const res = await enviarUm(m, perfil, url);
        if (res.r === 'rede') { semRede = true; break; }
        if (res.r === 'erro') { erros.push(res); continue; }
        enviados++;
        const resto = ((await lerConfig(db, 'melhoriasPendentes', [])) || []).filter(x => x.id !== m.id);
        await gravarConfig(db, 'melhoriasPendentes', resto);
      }
      const restantes = ((await lerConfig(db, 'melhoriasPendentes', [])) || []).length;
      return { enviados, restantes, semRede, erros };
    } finally {
      db.close();
    }
  }

  /** Envia todos os pedidos guardados. Só um envio por vez (a página e o service worker usam a mesma trava). */
  function enviarTodos() {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && nav.locks && nav.locks.request) return nav.locks.request(TRAVA, semTrava);
    return semTrava();
  }

  async function pendentes() {
    const db = await abrirBanco();
    if (!db) return [];
    try { return (await lerConfig(db, 'melhoriasPendentes', [])) || []; } finally { db.close(); }
  }

  /** Pede ao Android para avisar quando houver internet (funciona com o app fechado). */
  async function agendar() {
    try {
      if (typeof navigator === 'undefined' || !navigator.serviceWorker) return false;
      const reg = await navigator.serviceWorker.ready;
      if (!reg.sync) return false;
      await reg.sync.register(ETIQUETA);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { enviarTodos, pendentes, agendar, ETIQUETA };
})();
