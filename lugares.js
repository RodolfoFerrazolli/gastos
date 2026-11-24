// =====================================================================
//  V12: LUGARES (postos, oficinas, mercados, restaurantes...)
//  O app aprende os lugares com os lançamentos:
//  - junta pelo CNPJ da nota (vem na chave do QR Code ou a IA lê na nota);
//  - sem nota, pelo nome (sem diferença de maiúsculas, acentos e "Ltda");
//  - aprende o ponto no mapa quando 2 ou mais lançamentos do mesmo lugar
//    têm o GPS a menos de ~150 m um do outro;
//  - o que a pessoa corrige (nome, categoria, endereço, ponto) fica guardado
//    e vai para o servidor (os outros celulares da conta recebem).
//  Um lugar vira favorito ⭐ sozinho a partir do 4º lançamento; a pessoa
//  também pode pôr ou tirar a ⭐.
//  O mapa para marcar o lugar usa o Leaflet com o OpenStreetMap (grátis).
// =====================================================================
const Lugares = (() => {
  const App = () => window.App;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => App().esc(s);
  const toast = (m, ms) => App().toast(m, ms);
  const RAIO = 150; // metros: dois lançamentos "no mesmo lugar"
  const TELAS = ['lugares', 'lugar'];
  const CATS_VEIC = {
    posto: { k: 'posto', nome: 'Postos', ic: '⛽', um: 'abastecimento', varios: 'abastecimentos', singular: 'Posto' },
    oficina: { k: 'oficina', nome: 'Oficinas', ic: '🔧', um: 'manutenção', varios: 'manutenções', singular: 'Oficina' }
  };
  const ICONES = { 'Alimentação': '🍽️', 'Transporte': '🚌', 'Hospedagem': '🏨', 'Passeios': '🎡', 'Compras': '🛍️', 'Outros': '📌', 'Saúde': '💊', 'Lazer': '🎉', 'Mercado': '🛒' };

  function infoCat(k) {
    return CATS_VEIC[k] || { k, nome: k || 'Outros', ic: ICONES[k] || '📌', um: 'lançamento', varios: 'lançamentos', singular: k || 'Lugar' };
  }
  function catDeLanc(l) { return l.categoria === 'Combustível' ? 'posto' : (l.categoria || 'Outros'); }
  function catDeReg(r) { return r.tipo === 'abastecimento' ? 'posto' : r.tipo === 'manutencao' ? 'oficina' : null; }

  /** "Mercado Nicolau Max LTDA." e "mercado nicolau max" são o mesmo nome. */
  function normalizar(t) {
    return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(ltda|me|eireli|epp|s ?a|cia|comercio de|com)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  const ehCoord = (t) => /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(String(t || ''));
  function nomeDoLocal(local) { return !local || ehCoord(local) ? '' : String(local).split(' — ')[0].trim(); }
  function enderecoDoLocal(local) { const p = String(local || '').split(' — '); return p.length > 1 ? p.slice(1).join(' — ').trim() : ''; }
  function distancia(a, b) {
    const R = 6371000;
    const rad = (x) => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const temPonto = (x) => x && x.lat != null && x.lng != null && isFinite(x.lat) && isFinite(x.lng);
  function textoDistancia(m) { return m < 1000 ? `a ${Math.max(5, Math.round(m / 5) * 5)} m` : `a ${(m / 1000).toFixed(1).replace('.', ',')} km`; }
  function dataBR(iso) { return iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''; }
  function novoIdLugar() { return 'l' + (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

  // ------------------------------------------------------------------
  //  Dados: os lugares guardados (corrigidos pela pessoa) + o que o app aprende com os lançamentos
  // ------------------------------------------------------------------
  let guardados = null;
  let cache = null;
  async function carregar() {
    if (!guardados) guardados = ((await Banco.lerConfig('lugares', [])) || []).filter(x => x && x.id);
    return guardados;
  }
  async function gravarGuardados(lista) { guardados = lista; cache = null; await Banco.gravarConfig('lugares', lista); }
  function invalidar() { cache = null; guardados = null; }

  /** Cada lançamento com um lugar: { nome, chave, cat, cnpj, lat, lng, endereco, data, tipo, id }. */
  async function usos() {
    const lista = [];
    const veic = new Set((await Banco.todos('veiculos')).filter(v => !v.excluirPendente).map(v => v.id));
    (await Banco.todos('lancamentos')).forEach((l) => {
      if (l.excluirPendente || !l.estabelecimento) return;
      const d = l.dataHora ? new Date(l.dataHora) : null;
      lista.push({
        nome: String(l.estabelecimento).trim(), chave: normalizar(l.estabelecimento), cat: catDeLanc(l), cnpj: l.cnpj || '',
        lat: l.lat != null ? Number(l.lat) : null, lng: l.lng != null ? Number(l.lng) : null,
        gpsDaFoto: l.origem === 'foto' && l.enderecoDe !== 'mapa', // GPS de onde a foto foi tirada (pode não ser o lugar)
        endereco: l.enderecoDe === 'nota' || l.enderecoDe === 'mapa' ? l.endereco || '' : '',
        data: d ? App().chaveDia(d.getTime()) : '', tipo: 'lanc', id: l.id
      });
    });
    (await Banco.todos('registros')).forEach((r) => {
      const cat = catDeReg(r);
      const nome = nomeDoLocal(r.local);
      if (!cat || r.excluirPendente || !veic.has(r.veiculoId) || !nome) return;
      lista.push({
        nome, chave: normalizar(nome), cat, cnpj: r.cnpj || '', lat: r.lat != null ? Number(r.lat) : null, lng: r.lng != null ? Number(r.lng) : null,
        endereco: enderecoDoLocal(r.local), data: r.data || '', tipo: 'reg', id: r.id, combustivel: r.combustivel || '', precoLitro: r.precoLitro
      });
    });
    return lista.filter(u => u.chave).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }

  /** O ponto aprendido: 2 ou mais lançamentos com o GPS a menos de 150 m um do outro (o centro deles). */
  function aprenderPonto(us) {
    const pts = us.filter(u => temPonto(u) && !u.gpsDaFoto);
    let melhor = [];
    pts.forEach((p) => {
      const viz = pts.filter(q => distancia(p, q) <= RAIO);
      if (viz.length > melhor.length) melhor = viz;
    });
    if (melhor.length < 2) return null;
    return { lat: melhor.reduce((s, p) => s + p.lat, 0) / melhor.length, lng: melhor.reduce((s, p) => s + p.lng, 0) / melhor.length, n: melhor.length };
  }

  /** O ponto de um lugar: o marcado, o aprendido ou o GPS do único lançamento que tem. */
  function pontoDe(c) {
    if (temPonto(c)) return c;
    return aprenderPonto(c.usos) || c.usos.find(x => temPonto(x) && !x.gpsDaFoto) || null;
  }

  async function indice() {
    if (cache) return cache;
    const gs = (await carregar()).filter(g => !g.excluido).map(g => Object.assign({}, g, {
      guardado: true, usos: [], chaves: new Set([normalizar(g.nome)].concat((g.apelidos || []).map(normalizar)).filter(Boolean))
    }));
    const porCnpj = new Map();
    gs.forEach((g) => { if (g.cnpj) porCnpj.set(g.cnpj, g); });
    (await usos()).forEach((u) => {
      let g = u.cnpj ? porCnpj.get(u.cnpj) : null;
      if (!g) {
        let cands = gs.filter(x => x.categoria === u.cat && x.chaves.has(u.chave) && (!u.cnpj || !x.cnpj));
        // o mesmo nome em lugares diferentes (ex.: duas lojas da mesma rede): o GPS separa (mais de 1 km = outro lugar)
        if (cands.length && temPonto(u) && !u.gpsDaFoto) {
          const comD = cands.map((c) => { const p = pontoDe(c); return { c, d: p ? distancia(u, p) : null }; });
          const perto = comD.filter(x => x.d !== null && x.d <= 1000).sort((a, b) => a.d - b.d);
          if (perto.length) g = perto[0].c;
          else if (comD.every(x => x.d !== null)) cands = []; // todos longe daqui: é outro lugar
          else g = comD.find(x => x.d === null).c; // um deles ainda não tem ponto
        }
        if (!g && cands.length) g = cands.slice().sort((a, b) => b.usos.length - a.usos.length)[0]; // sem GPS: o que tem mais lançamentos
      }
      if (!g) {
        let id = u.cnpj ? 'c:' + u.cnpj : 'v:' + u.cat + ':' + u.chave;
        if (gs.some(x => x.id === id)) { let n = 2; while (gs.some(x => x.id === id + ':' + n)) n++; id += ':' + n; }
        g = { id, nome: u.nome, categoria: u.cat, cnpj: u.cnpj || '', endereco: '', lat: null, lng: null,
          favorito: null, apelidos: [], guardado: false, usos: [], chaves: new Set([u.chave]) };
        gs.push(g);
        if (u.cnpj) porCnpj.set(u.cnpj, g);
      } else {
        if (u.cnpj && !g.cnpj) { g.cnpj = u.cnpj; porCnpj.set(u.cnpj, g); }
        g.chaves.add(u.chave);
      }
      g.usos.push(u);
    });
    gs.forEach((g) => {
      const us = g.usos;
      g.qtd = us.length;
      g.ultima = us.length ? us[us.length - 1].data : '';
      if (!g.guardado && us.length) {
        g.nome = us[us.length - 1].nome; // o nome mais recente
        const conta = {};
        us.forEach((u) => { conta[u.cat] = (conta[u.cat] || 0) + 1; });
        g.categoria = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
      }
      if (!temPonto(g)) {
        const p = aprenderPonto(us);
        if (p) { g.lat = p.lat; g.lng = p.lng; g.pontoAprendido = true; }
      }
      if (!g.endereco) { const e = us.slice().reverse().find(u => u.endereco); g.endereco = e ? e.endereco : ''; }
      g.fav = g.favorito === true || (g.favorito !== false && g.qtd > 3);
      g.nomes = Array.from(new Set(us.map(u => u.nome))).filter(n => normalizar(n) !== normalizar(g.nome));
    });
    cache = gs.filter(g => g.qtd > 0 || g.guardado);
    return cache;
  }

  function ordenar(lista) {
    return lista.slice().sort((a, b) => (b.fav - a.fav) || (b.qtd - a.qtd) || String(b.ultima).localeCompare(String(a.ultima)) || a.nome.localeCompare(b.nome));
  }
  async function daCategoria(cat) { return ordenar((await indice()).filter(g => g.categoria === cat)); }
  async function porId(id) { return (await indice()).find(g => g.id === id) || null; }
  /** O lugar com ponto mais perto (até 150 m) do GPS, da categoria. */
  async function perto(pos, cat) {
    if (!temPonto(pos)) return null;
    const l = (await indice()).filter(g => (!cat || g.categoria === cat) && temPonto(g)).map(g => ({ g, d: distancia(pos, g) }))
      .filter(x => x.d <= Math.max(RAIO, Math.min(400, (pos.precisao || 0)))).sort((a, b) => a.d - b.d);
    return l[0] || null;
  }
  async function doNome(nome, cat) {
    const k = normalizar(nome);
    if (!k) return [];
    return (await indice()).filter(g => (!cat || g.categoria === cat) && g.chaves.has(k));
  }

  /** Guarda (cria ou atualiza) um lugar corrigido pela pessoa. */
  async function guardar(g, mudancas) {
    const lista = (await carregar()).slice();
    let x = g.guardado ? lista.find(y => y.id === g.id) : null;
    if (!x) {
      x = { id: novoIdLugar(), nome: g.nome, categoria: g.categoria, endereco: g.endereco || '', lat: g.pontoAprendido ? null : (g.lat != null ? g.lat : null),
        lng: g.pontoAprendido ? null : (g.lng != null ? g.lng : null), cnpj: g.cnpj || '', favorito: g.favorito != null ? g.favorito : null,
        apelidos: (g.nomes || []).slice(0, 10), pontoManual: false };
      lista.push(x);
    }
    Object.assign(x, mudancas || {}, { alteradoEm: Date.now(), sync: 'pendente' });
    x.apelidos = Array.from(new Set((x.apelidos || []).filter(a => normalizar(a) && normalizar(a) !== normalizar(x.nome)))).slice(0, 10);
    await gravarGuardados(lista);
    return x;
  }

  /** Marca o ponto de um lugar (pelo nome e categoria; cria o lugar se for preciso). */
  async function marcarPontoDoNome(nome, cat, ponto) {
    if (!nome || !cat || !temPonto(ponto)) return null;
    const lista = await doNome(nome, cat);
    let g = lista.length === 1 ? lista[0] : lista.find(x => temPonto(x) && distancia(x, ponto) <= RAIO * 2) || null;
    if (!g) g = { id: '', nome, categoria: cat, endereco: '', lat: null, lng: null, cnpj: '', favorito: null, nomes: [], guardado: false };
    return guardar(g, { lat: ponto.lat, lng: ponto.lng, pontoManual: true, endereco: ponto.endereco || g.endereco || '' });
  }

  // ------------------------------------------------------------------
  //  Sincronização (o servidor guarda os lugares de cada conta)
  // ------------------------------------------------------------------
  async function sincronizar({ enviar = true } = {}) {
    const lista = await carregar();
    const pend = lista.filter(x => x.sync === 'pendente');
    let r;
    try {
      r = await Api.chamar('lugares', { lugares: enviar ? pend.map(x => { const o = Object.assign({}, x); delete o.sync; return o; }) : [] }, { tempoMs: 30000 });
    } catch (e) {
      if (e && e.codigo === 'acao_desconhecida') return { antigo: true }; // servidor ainda na v11
      throw e;
    }
    const doServidor = new Map((r.lugares || []).map(x => [x.id, x]));
    const atual = await carregar();
    const novo = [];
    const vistos = new Set();
    atual.forEach((x) => {
      const s = doServidor.get(x.id);
      vistos.add(x.id);
      if (!s) { novo.push(x); return; } // ainda não chegou ao servidor
      if (x.sync === 'pendente' && (x.alteradoEm || 0) > (s.alteradoEm || 0)) { novo.push(x); return; } // mudou durante o envio
      novo.push(Object.assign({}, s, { sync: 'ok' }));
    });
    doServidor.forEach((s, id) => { if (!vistos.has(id)) novo.push(Object.assign({}, s, { sync: 'ok' })); });
    await gravarGuardados(novo);
    return { enviados: enviar ? pend.length : 0 };
  }
  async function pendentes() { return (await carregar()).filter(x => x.sync === 'pendente').length; }

  // ------------------------------------------------------------------
  //  Mapa para marcar o lugar (Leaflet + OpenStreetMap)
  // ------------------------------------------------------------------
  let M = null; // { mapa, resolver, relogio, ultimo }
  function mapaAberto() { return !!M; }
  function fecharMapa(resultado) {
    if (!M) return;
    const { resolver } = M;
    clearTimeout(M.relogio);
    try { M.mapa.remove(); } catch (e) { /* já removido */ }
    M = null;
    $('mapa-lugar').classList.add('oculto');
    document.body.classList.remove('sem-rolagem');
    if (typeof travarZoomDaPagina === 'function') travarZoomDaPagina(false, 'mapa');
    if (App().fecharCamada) App().fecharCamada(); // tira a entrada do histórico (se o "voltar" já não tirou)
    resolver(resultado || null);
  }

  /** Abre o mapa. Devolve { lat, lng, endereco } ou null. */
  function escolherNoMapa({ lat = null, lng = null, titulo = 'Marcar o lugar', sub = '' } = {}) {
    if (M) fecharMapa(null);
    return new Promise((resolver) => {
      if (typeof L === 'undefined') { toast('O mapa não carregou. Confira a internet e tente de novo.'); resolver(null); return; }
      $('ml-titulo').textContent = titulo;
      $('ml-sub').textContent = sub;
      $('ml-end').textContent = 'Arraste o mapa…';
      $('mapa-lugar').classList.remove('oculto');
      document.body.classList.add('sem-rolagem');
      if (typeof travarZoomDaPagina === 'function') travarZoomDaPagina(true, 'mapa');
      if (App().abrirCamada) App().abrirCamada('mapa');
      const temInicio = lat != null && lng != null;
      const mapa = L.map('ml-mapa', { zoomControl: false, attributionControl: true }).setView(temInicio ? [lat, lng] : [-15.78, -47.93], temInicio ? 17 : 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
      mapa.attributionControl.setPrefix(false);
      M = { mapa, resolver, relogio: null, ultimo: null };
      mapa.on('movestart', () => { $('ml-end').textContent = '…'; });
      mapa.on('moveend', () => buscarEnderecoDoCentro());
      setTimeout(() => { if (M && M.mapa === mapa) { mapa.invalidateSize(); buscarEnderecoDoCentro(); } }, 120);
      if (!temInicio) irParaOndeEstou(true);
    });
  }
  async function irParaOndeEstou(silencioso) {
    if (!M) return;
    if (!silencioso) toast('Buscando a sua localização…', 2000);
    const pos = await App().obterLocalizacao(12000);
    if (!M) return;
    if (!pos) { if (!silencioso) toast('Não foi possível pegar a localização. Confira se o GPS está ligado.'); return; }
    M.mapa.setView([pos.lat, pos.lng], 18);
  }
  function buscarEnderecoDoCentro() {
    if (!M) return;
    clearTimeout(M.relogio);
    const mapa = M.mapa;
    M.relogio = setTimeout(async () => {
      if (!M || M.mapa !== mapa) return;
      const c = mapa.getCenter();
      const coord = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
      M.ultimo = { lat: c.lat, lng: c.lng, endereco: '' };
      if (mapa.getZoom() < 14) { $('ml-end').textContent = 'Aproxime o mapa do lugar'; return; }
      if (Sync.conexao() === 'offline') { $('ml-end').textContent = coord; return; }
      try {
        const r = await Api.chamar('endereco', { lat: c.lat, lng: c.lng }, { tempoMs: 15000 });
        if (!M || !M.ultimo || M.ultimo.lat !== c.lat) return;
        M.ultimo.endereco = r.endereco || '';
        $('ml-end').textContent = r.endereco || coord;
      } catch (e) {
        if (M && M.ultimo && M.ultimo.lat === c.lat) $('ml-end').textContent = coord;
      }
    }, 650);
  }
  function usarCentro() {
    if (!M) return;
    if (M.mapa.getZoom() < 14) { toast('Aproxime o mapa (com dois dedos) até ver as ruas do lugar.'); return; }
    const c = M.mapa.getCenter();
    const r = { lat: Math.round(c.lat * 1e6) / 1e6, lng: Math.round(c.lng * 1e6) / 1e6, endereco: M.ultimo && M.ultimo.lat === c.lat ? M.ultimo.endereco : '' };
    fecharMapa(r);
  }

  // ------------------------------------------------------------------
  //  "Qual Mercado Nicolau Max?" (o mesmo nome em lugares diferentes, sem o GPS para decidir)
  // ------------------------------------------------------------------
  /** Devolve o lugar escolhido, 'mapa' (marcar outro lugar), 'nao-sei' ou null (voltou). */
  function perguntarQual(nome, opcoes) {
    return new Promise((ok) => {
      const op = opcoes.map((g, i) => {
        const u = infoCat(g.categoria);
        const quando = g.ultima ? (g.qtd === 1 ? ` · em ${dataBR(g.ultima)}` : ` · a última em ${dataBR(g.ultima)}`) : '';
        return `<label class="opcao-lugar${i === 0 ? ' marcada' : ''}"><input type="radio" name="ql" value="${i}"${i === 0 ? ' checked' : ''}>` +
          `<span><b>${esc(g.endereco || g.nome)}</b><small>${g.qtd} ${g.qtd === 1 ? u.um : u.varios}${quando}</small></span></label>`;
      }).join('');
      App().abrirDialogo(`<div class="fundo-dialogo"><div class="dialogo" role="dialog"><h2>Qual ${esc(nome)}?</h2>` +
        `<p class="dica">Você já lançou ${opcoes.length === 2 ? 'dois' : opcoes.length} lugares com esse nome. Qual foi este?</p>${op}` +
        '<label class="opcao-lugar"><input type="radio" name="ql" value="mapa"><span><b>🗺️ Outro lugar</b><small>marcar no mapa</small></span></label>' +
        '<label class="opcao-lugar"><input type="radio" name="ql" value="nao-sei"><span><b>Não sei</b><small>fica só o nome (o mapa procura pelo nome)</small></span></label>' +
        '<div class="botoes"><button class="botao" type="button" id="ql-voltar">Voltar</button><button class="botao primario" type="button" id="ql-ok">Salvar</button></div></div></div>',
      () => ok(null));
      const caixa = $('dialogo');
      caixa.querySelectorAll('input[name="ql"]').forEach((r) => {
        r.onchange = () => caixa.querySelectorAll('.opcao-lugar').forEach(l => l.classList.toggle('marcada', l.contains(caixa.querySelector('input[name="ql"]:checked'))));
      });
      $('ql-voltar').onclick = () => { App().fecharDialogo(); ok(null); };
      $('ql-ok').onclick = () => {
        const v = (caixa.querySelector('input[name="ql"]:checked') || {}).value;
        App().fecharDialogo();
        ok(v === 'mapa' || v === 'nao-sei' ? v : opcoes[Number(v)]);
      };
    });
  }

  /**
   * Na hora de salvar: o lugar pelo nome. Se o nome é de um lugar só (com o ponto), usa o ponto dele.
   * Se é de mais de um lugar e o GPS não decide, pergunta. Devolve { lat, lng, endereco? } ou null (fica como está),
   * ou false (a pessoa voltou: não salva).
   */
  async function pontoPeloNome(nome, cat, gps) {
    const lista = (await doNome(nome, cat)).filter(g => temPonto(g));
    if (!lista.length) return null;
    if (temPonto(gps)) {
      const p = lista.map(g => ({ g, d: distancia(gps, g) })).sort((a, b) => a.d - b.d)[0];
      if (p.d <= RAIO * 2) return null; // o GPS já está no lugar
    }
    const distintos = [];
    lista.forEach((g) => { if (!distintos.some(x => distancia(x, g) <= RAIO * 2)) distintos.push(g); });
    if (distintos.length === 1) return temPonto(gps) ? null : { lat: distintos[0].lat, lng: distintos[0].lng };
    const r = await perguntarQual(nome, distintos.sort((a, b) => b.qtd - a.qtd));
    if (r === null) return false;
    if (r === 'nao-sei') return null;
    if (r === 'mapa') {
      const m = await escolherNoMapa({ titulo: 'Marcar o lugar', sub: nome, lat: gps && gps.lat, lng: gps && gps.lng });
      return m ? { lat: m.lat, lng: m.lng, endereco: m.endereco, mapa: true } : false;
    }
    return { lat: r.lat, lng: r.lng, endereco: r.endereco };
  }

  // ------------------------------------------------------------------
  //  Chips de lugares nos formulários (posto do abastecimento; lugares da categoria no lançamento)
  // ------------------------------------------------------------------
  /** HTML: "Você está no X" (pelo GPS) + os lugares (favoritos primeiro) + "+ Outro". */
  function chipsHtml({ lista, marcado, detectado, rotulo, outro }) {
    let h = '';
    if (detectado) {
      h += `<div class="posto-detectado" data-lugar="${esc(detectado.g.id)}"><span class="pd-ic" aria-hidden="true">📍</span><div class="pd-tx"><b>Você está no ${esc(detectado.g.nome)}</b>` +
        `<small>${esc([detectado.g.endereco, textoDistancia(detectado.d)].filter(Boolean).join(' · '))}</small></div><span class="pd-ok" aria-hidden="true">✓</span></div>`;
    }
    const mostrar = lista.slice(0, 6);
    if (mostrar.length) {
      h += `<span class="rotulo-lugares">${esc(rotulo)}</span><div class="chips-lugares">` +
        mostrar.map(g => `<button class="chip-lugar${marcado && marcado === g.id ? ' marcado' : ''}" type="button" data-lugar="${esc(g.id)}">${g.fav ? '⭐ ' : ''}${esc(g.nome)}</button>`).join('') +
        (outro ? `<button class="chip-lugar outro" type="button" data-lugar-outro="1">${esc(outro)}</button>` : '') + '</div>';
    }
    return h;
  }

  /** O chip tocado é de um lugar sem ponto: "Você está no X agora?" (guarda o ponto pelo GPS). */
  async function talvezGuardarPonto(g) {
    if (!g || temPonto(g)) return null;
    const r = await App().escolher(`Você está no ${g.nome} agora? Este lugar ainda não tem o lugar marcado. Se você estiver lá, o app guarda o lugar pelo GPS e, ` +
      'da próxima vez, já reconhece sozinho.', [
      { valor: 'sim', texto: '📍 Estou lá, guardar o lugar', classe: 'primario' },
      { valor: 'nao', texto: 'Não estou lá agora' }
    ]);
    if (r !== 'sim') return null;
    toast('Buscando a sua localização…', 2500);
    const pos = await App().obterLocalizacao(15000);
    if (!pos) { toast('Não foi possível pegar a localização. Confira se o GPS está ligado.', 4000); return null; }
    let endereco = '';
    try { endereco = (await Api.chamar('endereco', { lat: pos.lat, lng: pos.lng }, { tempoMs: 12000 })).endereco || ''; } catch (e) { /* sem endereço */ }
    await guardar(g, { lat: pos.lat, lng: pos.lng, pontoManual: true, endereco: g.endereco || endereco });
    toast(`Lugar do ${g.nome} guardado 📍`);
    return pos;
  }

  // ------------------------------------------------------------------
  //  Telas: Meus lugares e um lugar
  // ------------------------------------------------------------------
  const T = { cat: 'posto', id: null, alterado: false, ponto: null };
  function ehTela(n) { return TELAS.includes(n); }

  async function preparar(tela, dados) {
    if (tela === 'lugares') return renderLista(dados || {});
    if (tela === 'lugar') return renderLugar(dados || {});
    return false;
  }
  async function ir(tela, dados = {}) {
    if (!(await preparar(tela, dados))) { toast('Este lugar não existe mais.'); return; }
    App().mostrarTela(tela, { dados });
  }
  async function mostrar(tela, dados) {
    if (!(await preparar(tela, dados))) { history.back(); return; }
    App().mostrarTela(tela, { empilhar: false, dados: dados || {} });
  }
  async function podeSair() {
    if (App().telaAtual() === 'lugar' && T.alterado) {
      const ok = await App().confirmar('Descartar as alterações deste lugar?', 'Descartar', 'Continuar editando');
      if (ok) T.alterado = false;
      return ok;
    }
    return true;
  }
  async function aoSincronizar() {
    invalidar();
    if (App().telaAtual() === 'lugares') renderLista(App().dadosTela() || {});
  }

  async function categoriasComLugares() {
    const todos = await indice();
    const conta = {};
    todos.forEach((g) => { conta[g.categoria] = (conta[g.categoria] || 0) + 1; });
    const ordem = ['posto', 'oficina'].concat(Object.keys(conta).filter(k => k !== 'posto' && k !== 'oficina').sort());
    return ordem.map(k => ({ k, n: conta[k] || 0 })).filter(x => x.n || x.k === 'posto' || x.k === 'oficina');
  }

  async function renderLista(dados) {
    if (dados.cat) T.cat = dados.cat;
    const cats = await categoriasComLugares();
    if (!cats.some(c => c.k === T.cat)) T.cat = cats[0] ? cats[0].k : 'posto';
    const lista = await daCategoria(T.cat);
    const info = infoCat(T.cat);
    let h = '<div class="cats" role="tablist">' + cats.map(c => { const i = infoCat(c.k); return `<button type="button" role="tab" class="cat${c.k === T.cat ? ' ativa' : ''}" data-cat="${esc(c.k)}">${i.ic} ${esc(i.nome)} ${c.n}</button>`; }).join('') + '</div>';
    h += '<p class="nota-lugares">Um lugar vira favorito ⭐ sozinho quando tem <b>mais de 3</b> lançamentos. Toque num lugar para mudar o nome, o endereço ou a categoria.</p>';
    const linha = (g) => {
      const u = infoCat(g.categoria);
      const meta = `${g.qtd} ${g.qtd === 1 ? u.um : u.varios}${g.ultima ? (g.qtd === 1 ? ' · em ' : ' · o último em ') + dataBR(g.ultima) : ''}`;
      const situ = temPonto(g) ? `<span class="ok">📍 ${esc(g.endereco || 'Lugar marcado no mapa')}</span>`
        : g.endereco ? `<span>${esc(g.endereco)}</span> · <span class="sem">sem o ponto no mapa</span>` : '<span class="sem">⚠️ Lugar ainda não marcado</span>';
      return `<div class="lugar" data-abrir-lugar="${esc(g.id)}" role="button" tabindex="0">` +
        `<button type="button" class="estrela${g.fav ? '' : ' vazia'}" data-estrela="${esc(g.id)}" aria-label="${g.fav ? 'Tirar dos favoritos' : 'Pôr nos favoritos'}">${g.fav ? '⭐' : '☆'}</button>` +
        `<div class="lt"><b>${esc(g.nome)}</b><small>${meta}</small><small>${situ}</small></div>` +
        (temPonto(g) ? '<span class="seta" aria-hidden="true">›</span>' : `<button class="botao pequeno" type="button" data-marcar-lugar="${esc(g.id)}">📍 Marcar</button>`) + '</div>';
    };
    const favs = lista.filter(g => g.fav);
    const outros = lista.filter(g => !g.fav);
    if (!lista.length) h += `<div class="vazio">Nenhum lugar de ${esc(info.nome.toLowerCase())} ainda. Eles aparecem aqui conforme você lança.</div>`;
    if (favs.length) h += '<div class="secao-lugares">Favoritos</div>' + favs.map(linha).join('');
    if (outros.length) h += `<div class="secao-lugares">${favs.length ? 'Outros' : 'Os'} ${esc(info.nome.toLowerCase())} que você já usou</div>` + outros.map(linha).join('');
    $('lg-corpo').innerHTML = h;
    return true;
  }

  function miniMapa(g) {
    const el = $('lu-mapa');
    if (!el) return;
    if (T.mini) { try { T.mini.remove(); } catch (e) { /* já removido */ } T.mini = null; }
    if (!temPonto(g) || typeof L === 'undefined') { el.classList.add('oculto'); return; }
    el.classList.remove('oculto');
    const m = L.map(el, { zoomControl: false, attributionControl: true, dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false })
      .setView([g.lat, g.lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    m.attributionControl.setPrefix(false);
    T.mini = m;
    setTimeout(() => { try { m.invalidateSize(); } catch (e) { /* fechou */ } }, 150);
  }

  async function renderLugar(dados) {
    const g = await porId(dados.id);
    if (!g) return false;
    T.id = g.id;
    T.alterado = false;
    T.ponto = temPonto(g) ? { lat: g.lat, lng: g.lng } : null;
    const u = infoCat(g.categoria);
    $('lu-sub').textContent = `${u.ic} ${u.singular} · ${g.qtd} ${g.qtd === 1 ? u.um : u.varios}`;
    const cats = await categoriasComLugares();
    const listas = await App().listas();
    const opcoes = ['posto', 'oficina'].concat(listas.categorias.filter(c => c !== 'Combustível'));
    cats.forEach((c) => { if (!opcoes.includes(c.k)) opcoes.push(c.k); });
    $('lu-nome').value = g.nome;
    $('lu-cat').innerHTML = opcoes.map(k => { const i = infoCat(k); return `<option value="${esc(k)}"${k === g.categoria ? ' selected' : ''}>${i.ic} ${esc(i.nome)}</option>`; }).join('');
    $('lu-end').value = g.endereco || '';
    $('lu-fav').checked = !!g.fav;
    const ap = (g.apelidos || []).concat(g.nomes || []).filter((n, i, a) => a.findIndex(x => normalizar(x) === normalizar(n)) === i && normalizar(n) !== normalizar(g.nome));
    $('lu-apelidos').innerHTML = ap.length ? `Também contam como este lugar os lançamentos com o nome ${ap.slice(0, 5).map(n => `<b>“${esc(n)}”</b>`).join(', ')}.` : '';
    $('lu-apelidos').classList.toggle('oculto', !ap.length);
    $('lu-ponto').textContent = T.ponto ? (g.pontoAprendido ? '📍 Lugar aprendido pelo GPS dos seus lançamentos.' : '📍 Lugar marcado no mapa.') : '⚠️ Lugar ainda não marcado no mapa.';
    setTimeout(() => miniMapa(Object.assign({}, g, T.ponto || {})), 60);
    return true;
  }

  async function salvarLugar() {
    const g = await porId(T.id);
    if (!g) return;
    const nome = $('lu-nome').value.replace(/\s+/g, ' ').trim();
    if (!nome) { toast('Escreva o nome do lugar.'); return; }
    const apelidos = (g.apelidos || []).concat(g.nomes || []);
    if (normalizar(nome) !== normalizar(g.nome)) apelidos.push(g.nome); // os lançamentos com o nome antigo continuam contando
    const fav = $('lu-fav').checked;
    const m = { nome, categoria: $('lu-cat').value, endereco: $('lu-end').value.replace(/\s+/g, ' ').trim(), apelidos,
      favorito: fav === (g.qtd > 3) && g.favorito == null ? null : fav };
    if (T.ponto && (T.ponto.lat !== g.lat || T.ponto.lng !== g.lng || g.pontoAprendido)) Object.assign(m, { lat: T.ponto.lat, lng: T.ponto.lng, pontoManual: true });
    await guardar(g, m);
    T.alterado = false;
    toast('Lugar salvo');
    App().voltar();
    App().agendarSync(800);
  }

  async function alternarEstrela(id) {
    const g = await porId(id);
    if (!g) return;
    const novo = !g.fav;
    await guardar(g, { favorito: novo === (g.qtd > 3) ? null : novo });
    toast(novo ? `${g.nome} está nos favoritos ⭐` : `${g.nome} saiu dos favoritos`);
    await renderLista({});
    App().agendarSync(1500);
  }

  async function marcarLugar(id) {
    const g = await porId(id);
    if (!g) return;
    const p = await escolherNoMapa({ titulo: 'Marcar o lugar', sub: g.nome, lat: g.lat, lng: g.lng });
    if (!p) return;
    await guardar(g, { lat: p.lat, lng: p.lng, pontoManual: true, endereco: g.endereco || p.endereco || '' });
    toast(`Lugar do ${g.nome} marcado 📍`);
    if (App().telaAtual() === 'lugares') await renderLista({});
    App().agendarSync(1500);
  }

  function ligar() {
    $('lg-corpo').addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]');
      if (c) { T.cat = c.dataset.cat; renderLista({}); return; }
      const est = e.target.closest('[data-estrela]');
      if (est) { alternarEstrela(est.dataset.estrela); return; }
      const mk = e.target.closest('[data-marcar-lugar]');
      if (mk) { marcarLugar(mk.dataset.marcarLugar); return; }
      const ab = e.target.closest('[data-abrir-lugar]');
      if (ab) ir('lugar', { id: ab.dataset.abrirLugar });
    });
    $('lg-voltar').onclick = () => App().voltar();
    $('lu-voltar').onclick = () => App().voltar();
    $('lu-salvar').onclick = salvarLugar;
    ['lu-nome', 'lu-cat', 'lu-end', 'lu-fav'].forEach((id) => {
      $(id).addEventListener('input', () => { T.alterado = true; });
      $(id).addEventListener('change', () => { T.alterado = true; });
    });
    $('lu-mudar').onclick = async () => {
      const g = await porId(T.id);
      const p = await escolherNoMapa({ titulo: 'Marcar o lugar', sub: $('lu-nome').value || (g && g.nome) || '', lat: T.ponto && T.ponto.lat, lng: T.ponto && T.ponto.lng });
      if (!p) return;
      T.ponto = { lat: p.lat, lng: p.lng };
      T.alterado = true;
      if (!$('lu-end').value.trim() && p.endereco) $('lu-end').value = p.endereco;
      $('lu-ponto').textContent = '📍 Lugar marcado no mapa (toque em Salvar).';
      miniMapa(Object.assign({}, g || {}, T.ponto));
    };
    $('lu-aqui').onclick = async () => {
      toast('Buscando a sua localização…', 2500);
      const pos = await App().obterLocalizacao(15000);
      if (!pos) { toast('Não foi possível pegar a localização. Confira se o GPS está ligado.', 4000); return; }
      T.ponto = { lat: pos.lat, lng: pos.lng };
      T.alterado = true;
      $('lu-ponto').textContent = '📍 Lugar pelo GPS de agora (toque em Salvar).';
      const g = await porId(T.id);
      miniMapa(Object.assign({}, g || {}, T.ponto));
      if (!$('lu-end').value.trim()) {
        try { const r = await Api.chamar('endereco', { lat: pos.lat, lng: pos.lng }, { tempoMs: 12000 }); if (r.endereco && !$('lu-end').value.trim()) $('lu-end').value = r.endereco; } catch (e) { /* sem endereço */ }
      }
    };
    // mapa
    $('ml-voltar').onclick = () => fecharMapa(null);
    $('ml-usar').onclick = usarCentro;
    $('ml-onde').onclick = () => irParaOndeEstou(false);
  }
  ligar();

  return {
    ehTela, ir, mostrar, podeSair, aoSincronizar, invalidar, sincronizar, pendentes,
    indice, daCategoria, porId, perto, doNome, guardar, marcarPontoDoNome, pontoPeloNome, talvezGuardarPonto,
    escolherNoMapa, mapaAberto, fecharMapa: () => fecharMapa(null), chipsHtml, infoCat, catDeLanc, catDeReg, nomeDoLocal, temPonto,
    // usados nos testes
    _normalizar: normalizar, _aprenderPonto: aprenderPonto, _distancia: distancia, _mapaAtual: () => (M ? M.mapa : null)
  };
})();
