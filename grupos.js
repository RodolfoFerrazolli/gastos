// =====================================================================
//  GRUPOS (V9): despesas divididas (viagem em grupo, república…)
//  Cada grupo tem as pessoas (com ou sem o app), as despesas (quem
//  pagou e como dividir: igual ou valor individual, com inteira e meia)
//  e os pagamentos do acerto ("Marcar como pago"). O app calcula quanto
//  cada um pagou, a parte de cada um, quem deve e quem recebe, e o
//  menor número de pagamentos para acertar tudo.
//  Nada de cobrança: o app só mostra (e tem o relatório do grupo).
//  Os dados ficam no celular (no "config", chave 'grupos', para o banco
//  continuar na versão 2) e sobem para o servidor na sincronização.
//  Quem tem o app e foi colocada no grupo pelo e-mail vê e lança também.
//  Na tela Lançamentos entra só o que saiu do bolso da pessoa: a despesa
//  que ela pagou (pelo valor cheio) e o pagamento do acerto que ela fez.
// =====================================================================
const Grupos = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App;
  const U = () => Veiculos._util; // valor "de calculadora" e calendário (veiculos.js)

  const TELAS = ['grupos', 'grupo', 'grupo-despesa', 'grupo-pessoa', 'grupo-relatorio'];
  const ABAS = [['despesas', 'Despesas'], ['saldos', 'Saldos'], ['acertar', 'Acertar'], ['pessoas', 'Pessoas']];
  const CORES = ['#2f6fb0', '#7a5cc7', '#d9822b', '#2a9d8f', '#c0392b', '#5fb3a8', '#8a6d3b', '#b04a8a', '#6b7785', '#4a6a8a',
    '#3f8f4f', '#a0522d', '#5d6fd6', '#c2185b', '#00897b', '#7b6f2a'];
  const ICONES = { 'Alimentação': '🍽️', 'Transporte': '✈️', 'Hospedagem': '🏨', 'Combustível': '⛽', 'Passeios': '🚙', 'Compras': '🛍️' };
  const CHIPS_VISIVEIS = 5;

  const esc = (s) => App().esc(s);
  const brl = (v) => App().brl(v);
  const toast = (m, ms) => App().toast(m, ms);
  const plural = (n, um, varios) => App().plural(n, um, varios);
  const hoje = () => App().chaveDia(Date.now());
  const c2v = (c) => Math.round(c) / 100;            // centavos -> reais
  const v2c = (v) => Math.round(Number(v || 0) * 100); // reais -> centavos
  function dataCurta(d) {
    const p = String(d || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}` : '';
  }
  function dataLonga(d) {
    const p = String(d || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
  }
  function novoId(prefixo) {
    return prefixo + Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 8);
  }
  const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0];

  // ------------------------------------------------------------------
  //  Dados no celular: { objetos: { id: { id, tipo, grupoId, dados, alteradoEm, excluido, pendente, noServidor } }, semServidor }
  // ------------------------------------------------------------------
  async function ler() {
    const st = (await Banco.lerConfig('grupos', null)) || {};
    if (!st.objetos || typeof st.objetos !== 'object') st.objetos = {};
    return st;
  }
  async function guardar(st) { await Banco.gravarConfig('grupos', st); }

  /** Grava uma alteração (fica "na fila" até a próxima sincronização). */
  async function alterar(obj) {
    const st = await ler();
    const ant = st.objetos[obj.id];
    obj.alteradoEm = Math.max(Date.now(), ((ant && ant.alteradoEm) || 0) + 1);
    obj.pendente = true;
    obj.noServidor = !!(ant && ant.noServidor);
    st.objetos[obj.id] = obj;
    await guardar(st);
    App().agendarSync(1500);
    return obj;
  }
  /** Exclui (o que nunca foi para o servidor sai direto do celular). */
  async function excluir(ids) {
    const st = await ler();
    ids.forEach((id) => {
      const o = st.objetos[id];
      if (!o) return;
      if (!o.noServidor) { delete st.objetos[id]; return; }
      o.excluido = true;
      o.pendente = true;
      o.alteradoEm = Math.max(Date.now(), (o.alteradoEm || 0) + 1);
    });
    await guardar(st);
    App().agendarSync(1500);
  }

  /** Tudo de um grupo (sem o que foi excluído). */
  function montarGrupo(st, grupoId) {
    const g = st.objetos[grupoId];
    if (!g || g.tipo !== 'grupo' || g.excluido) return null;
    const doGrupo = Object.values(st.objetos).filter(o => o.grupoId === grupoId && o.tipo !== 'grupo' && !o.excluido);
    const pessoas = doGrupo.filter(o => o.tipo === 'pessoa').sort((a, b) => {
      if (!!b.dados.souEu !== !!a.dados.souEu) return b.dados.souEu ? 1 : -1; // você primeiro
      return a.id < b.id ? -1 : 1; // na ordem em que entraram
    });
    const ordem = [...pessoas].sort((a, b) => (a.id < b.id ? -1 : 1));
    const cor = {};
    ordem.forEach((p, i) => { cor[p.id] = CORES[i % CORES.length]; });
    const despesas = doGrupo.filter(o => o.tipo === 'despesa')
      .sort((a, b) => (String(b.dados.data).localeCompare(String(a.dados.data)) || (a.id < b.id ? 1 : -1)));
    const pagamentos = doGrupo.filter(o => o.tipo === 'pagamento')
      .sort((a, b) => (String(a.dados.data).localeCompare(String(b.dados.data)) || (a.id < b.id ? -1 : 1)));
    const porId = {};
    pessoas.forEach((p) => { porId[p.id] = p; });
    const eu = pessoas.find(p => p.dados.souEu) || null;
    return { g, pessoas, despesas, pagamentos, porId, eu, cor, pendente: [g].concat(doGrupo).some(o => o.pendente) };
  }
  async function grupos() {
    const st = await ler();
    return Object.values(st.objetos).filter(o => o.tipo === 'grupo' && !o.excluido)
      .map(o => montarGrupo(st, o.id)).filter(Boolean)
      .sort((a, b) => a.g.dados.nome.localeCompare(b.g.dados.nome, 'pt-BR'));
  }
  async function grupo(id) { return montarGrupo(await ler(), id); }

  // ------------------------------------------------------------------
  //  Contas (tudo em centavos)
  // ------------------------------------------------------------------
  /** Quanto cada um pagou, a parte de cada um e o saldo (positivo: recebe; negativo: deve). */
  function calcular(G) {
    const por = {};
    G.pessoas.forEach((p) => { por[p.id] = { pagou: 0, parte: 0, pagos: 0, recebidos: 0, saldo: 0 }; });
    let total = 0;
    G.despesas.forEach((d) => {
      const v = v2c(d.dados.valor);
      total += v;
      if (por[d.dados.pagoPor]) por[d.dados.pagoPor].pagou += v;
      (d.dados.partes || []).forEach((pt) => { if (por[pt.p]) por[pt.p].parte += v2c(pt.v); });
    });
    G.pagamentos.forEach((pg) => {
      const v = v2c(pg.dados.valor);
      if (por[pg.dados.de]) por[pg.dados.de].pagos += v;
      if (por[pg.dados.para]) por[pg.dados.para].recebidos += v;
    });
    Object.values(por).forEach((c) => { c.saldo = c.pagou - c.parte + c.pagos - c.recebidos; });
    return { total, por, transf: transferencias(G, por) };
  }
  /** O menor número de pagamentos para acertar: quem mais deve paga para quem mais tem a receber. */
  function transferencias(G, por) {
    const ordem = (lista) => lista.sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1));
    const dev = ordem(G.pessoas.filter(p => por[p.id].saldo < 0).map(p => ({ id: p.id, v: -por[p.id].saldo })));
    const cre = ordem(G.pessoas.filter(p => por[p.id].saldo > 0).map(p => ({ id: p.id, v: por[p.id].saldo })));
    const t = [];
    let i = 0;
    let j = 0;
    while (i < dev.length && j < cre.length) {
      const v = Math.min(dev[i].v, cre[j].v);
      if (v > 0) t.push({ de: dev[i].id, para: cre[j].id, v });
      dev[i].v -= v;
      cre[j].v -= v;
      if (!dev[i].v) i++;
      if (!cre[j].v) j++;
    }
    return t;
  }
  /**
   * Divide o valor (centavos) entre quem participou.
   * participantes: [{ p, t: 'base'|'meia'|'fixo', c (centavos, só no fixo) }]
   * Devolve { partes: [{ p, c, t }], inteira, meia, falta } (falta: o que sobra (+) ou passa (-) do total; 0 = fecha).
   */
  function dividir(totalC, participantes) {
    const fixos = participantes.filter(x => x.t === 'fixo');
    const somaFixos = fixos.reduce((s, x) => s + (x.c || 0), 0);
    const resto = totalC - somaFixos;
    const nBase = participantes.filter(x => x.t === 'base').length;
    const nMeia = participantes.filter(x => x.t === 'meia').length;
    const peso = nBase * 2 + nMeia; // em "meias"
    const partes = participantes.map(x => ({ p: x.p, t: x.t, c: x.t === 'fixo' ? (x.c || 0) : 0 }));
    if (!peso) return { partes, inteira: 0, meia: 0, falta: resto };
    if (resto < 0) return { partes, inteira: 0, meia: 0, falta: resto };
    const meia = Math.floor(resto / peso);
    partes.forEach((x) => { if (x.t === 'base') x.c = meia * 2; else if (x.t === 'meia') x.c = meia; });
    // os centavos que sobram da divisão: um para cada (primeiro quem paga inteira)
    let sobra = resto - meia * peso;
    const fila = partes.filter(x => x.t === 'base').concat(partes.filter(x => x.t === 'meia'));
    for (let k = 0; sobra > 0; k = (k + 1) % fila.length) { fila[k].c++; sobra--; }
    return { partes, inteira: meia * 2, meia, falta: 0 };
  }
  function dividirIgual(totalC, ids) { return dividir(totalC, ids.map(p => ({ p, t: 'base' }))); }

  // ------------------------------------------------------------------
  //  Sincronização (chamada pelo sincronizacao.js)
  // ------------------------------------------------------------------
  async function pendentes() {
    const st = await ler();
    if (st.semServidor) return 0; // servidor antigo: fica guardado aqui até ele ser atualizado
    return Object.values(st.objetos).filter(o => o.pendente).length;
  }
  function paraEnvio(o) {
    const d = Object.assign({}, o.dados);
    return { id: o.id, tipo: o.tipo, grupoId: o.grupoId, dados: d, alteradoEm: o.alteradoEm, excluido: !!o.excluido };
  }
  /** Manda o que mudou aqui e traz os grupos de que a conta participa. Devolve { recusados, semServidor }. */
  async function sincronizar({ enviar = true } = {}) {
    const antes = await ler();
    const alts = enviar ? Object.values(antes.objetos).filter(o => o.pendente).map(paraEnvio) : [];
    let r;
    try {
      r = await Api.chamar('sincronizarGrupos', { alteracoes: alts }, { tempoMs: 60000 });
    } catch (e) {
      if (e instanceof Api.ErroServidor && e.codigo === 'acao_desconhecida') {
        const st = await ler();
        if (!st.semServidor) { st.semServidor = true; await guardar(st); }
        return { semServidor: true, recusados: 0 };
      }
      throw e;
    }
    const enviados = new Map(alts.map(a => [a.id, a.alteradoEm]));
    const recusados = new Map((r.recusados || []).map(x => [x.id, x.motivo]));
    const st = await ler(); // o que mudou enquanto a resposta não vinha continua na fila
    const novo = {};
    (r.objetos || []).forEach((o) => {
      const loc = st.objetos[o.id];
      if (loc && loc.pendente && enviados.get(o.id) !== loc.alteradoEm) { // mudou aqui depois do envio
        loc.noServidor = true;
        if (o.tipo === 'pessoa') ['temApp', 'souEu', 'emailSemConta'].forEach((k) => { loc.dados[k] = o.dados[k]; });
        if (o.tipo === 'grupo') loc.dados.souDono = o.dados.souDono;
        novo[o.id] = loc;
        return;
      }
      novo[o.id] = { id: o.id, tipo: o.tipo, grupoId: o.grupoId, dados: o.dados || {}, alteradoEm: Number(o.alteradoEm) || 0, noServidor: true };
    });
    // o que está aqui e não veio: excluído ou o grupo saiu da conta (some); na fila e ainda não enviado: fica
    Object.values(st.objetos).forEach((loc) => {
      if (novo[loc.id]) return;
      if (loc.pendente && enviados.get(loc.id) !== loc.alteradoEm) novo[loc.id] = loc;
    });
    let nRecusados = 0;
    recusados.forEach((motivo) => { if (motivo !== 'antigo') nRecusados++; });
    await guardar({ objetos: novo });
    return { recusados: nRecusados, semServidor: false };
  }

  // ------------------------------------------------------------------
  //  Navegação (igual às telas dos veículos: uma dentro da outra)
  // ------------------------------------------------------------------
  const abas = {}; // grupoId -> aba aberta
  const rolagens = {};
  const chaveRolagem = (tela, dados) => tela + '|' + JSON.stringify(dados || {});
  let navegando = false;
  function ehTela(nome) { return TELAS.includes(nome); }
  async function preparar(tela, dados) {
    dados = dados || {};
    switch (tela) {
      case 'grupos': return renderGrupos();
      case 'grupo': return renderGrupo(dados.grupoId);
      case 'grupo-despesa': return prepararDespesa(dados);
      case 'grupo-pessoa': return prepararPessoa(dados);
      case 'grupo-relatorio': return renderRelatorio(dados.grupoId);
      default: return false;
    }
  }
  async function ir(tela, dados = {}) {
    if (navegando) return;
    navegando = true;
    try {
      const atual = App().telaAtual();
      if (ehTela(atual)) rolagens[chaveRolagem(atual, App().dadosTela())] = window.scrollY;
      if (!(await preparar(tela, dados))) { toast('Este item não existe mais.'); return; }
      App().mostrarTela(tela, { dados });
    } finally {
      navegando = false;
    }
  }
  async function mostrar(tela, dados) {
    if (!(await preparar(tela, dados))) { history.back(); return; }
    App().mostrarTela(tela, { empilhar: false, dados: dados || {} });
    const y = rolagens[chaveRolagem(tela, dados)];
    if (y) window.scrollTo(0, y);
  }
  async function podeSair() {
    const tela = App().telaAtual();
    const F = tela === 'grupo-despesa' ? GD : tela === 'grupo-pessoa' ? GP : null;
    if (F && F.alterado) {
      const ok = await App().confirmar('Descartar as alterações?', 'Descartar', 'Continuar editando');
      if (ok) F.alterado = false;
      return ok;
    }
    return true;
  }
  async function aoSincronizar() {
    const tela = App().telaAtual();
    if (!['grupos', 'grupo', 'grupo-relatorio'].includes(tela) || navegando || document.querySelector('#dialogo .fundo-dialogo')) return;
    const y = window.scrollY;
    if (!(await preparar(tela, App().dadosTela() || {}))) { history.back(); return; }
    if (App().telaAtual() === tela) window.scrollTo(0, y);
  }
  const voltar = () => App().voltar();
  const dadosAtuais = () => App().dadosTela() || {};

  // ------------------------------------------------------------------
  //  Pedaços de tela
  // ------------------------------------------------------------------
  function avatar(G, p) {
    const letra = esc((String(p.dados.nome || '?').trim()[0] || '?').toUpperCase());
    return `<span class="g-av" style="background:${G.cor[p.id] || CORES[0]}" aria-hidden="true">${letra}</span>`;
  }
  function nomeDe(G, id, { voce = false, curto = false } = {}) {
    const p = G.porId[id];
    if (!p) return 'pessoa removida';
    if (p.dados.souEu && voce) return 'Você';
    const n = curto ? primeiroNome(p.dados.nome) : p.dados.nome;
    return p.dados.souEu ? n + ' (você)' : n;
  }
  function tags(p) {
    return (p.dados.souEu ? ' <span class="g-tag t-voce">você</span>' : '') + (p.dados.temApp ? ' <span class="g-tag t-app">tem o app</span>' : '');
  }
  function icone(d) { return ICONES[d.dados.categoria] || '🧾'; }
  function textoDivisao(G, d) {
    const partes = d.dados.partes || [];
    if (!partes.length) return '';
    if (d.dados.modo === 'igual') {
      const v = Math.min(...partes.map(x => v2c(x.v)));
      const n = partes.length;
      if (n === G.pessoas.length && n > 1) return `Dividido igual entre ${n} · ${brl(c2v(v))} cada`;
      return n === 1 ? `Só para ${nomeDe(G, partes[0].p, { curto: true })}` : `Dividido igual entre ${n} · ${brl(c2v(v))} cada`;
    }
    const meias = partes.filter(x => x.t === 'meia').length;
    return `Valor individual entre ${partes.length}` + (meias ? ` · ${plural(meias, '1 meia', '# meias')}` : '');
  }
  function resumoSaldo(c) {
    if (c.saldo > 0) return `<b class="verde">você recebe ${brl(c2v(c.saldo))}</b>`;
    if (c.saldo < 0) return `<b class="vermelho">você deve ${brl(c2v(-c.saldo))}</b>`;
    return 'tudo acertado';
  }
  function aviso(texto) { return `<div class="g-aviso">${texto}</div>`; }

  // ------------------------------------------------------------------
  //  Lista dos grupos
  // ------------------------------------------------------------------
  async function renderGrupos() {
    const st = await ler();
    const lista = await grupos();
    let html = st.semServidor
      ? aviso('O servidor ainda não foi atualizado para os grupos. O que você lançar fica guardado neste celular e é enviado depois que o organizador atualizar o Apps Script.')
      : '';
    if (!lista.length) {
      html += '<div class="vazio">Nenhum grupo ainda.<br>Crie um grupo para dividir as despesas de uma viagem, de uma casa ou de um evento.</div>';
    }
    html += lista.map((G) => {
      const C = calcular(G);
      const meu = G.eu ? C.por[G.eu.id] : null;
      const meta = [plural(G.pessoas.length, '1 pessoa', '# pessoas'), plural(G.despesas.length, '1 despesa', '# despesas')];
      let dir = '';
      if (meu && meu.saldo > 0) dir = `<span class="valor verde">${brl(c2v(meu.saldo))}</span><small class="g-dir">recebe</small>`;
      else if (meu && meu.saldo < 0) dir = `<span class="valor vermelho">${brl(c2v(-meu.saldo))}</span><small class="g-dir">deve</small>`;
      else dir = `<span class="valor">${brl(c2v(C.total))}</span><small class="g-dir">total</small>`;
      return `<div class="cartao" data-grupo="${esc(G.g.id)}" role="button"><div class="corpo"><div class="desc">👥 ${esc(G.g.dados.nome)}</div>` +
        `<div class="meta">${meta.join(' · ')} · total ${brl(c2v(C.total))}</div></div>` +
        `<div class="direita">${dir}${G.pendente ? '<span class="selo fila">Na fila</span>' : ''}</div></div>`;
    }).join('');
    $('gr-lista').innerHTML = html;
    return true;
  }
  async function criarGrupo() {
    const perfil = await Perfil.obter();
    let id = null;
    const ok = await App().dialogoCampos({
      titulo: 'Novo grupo',
      texto: 'Ex.: Viagem para Jeri, Casa da praia, Churrasco do fim de ano.',
      campos: [{ id: 'dlg-grupo-nome', rotulo: 'Nome do grupo', placeholder: 'Ex.: Viagem Jeri' }],
      sim: 'Criar',
      aoConfirmar: async (v) => {
        const nome = String(v['dlg-grupo-nome'] || '').trim().slice(0, 60);
        if (!nome) return 'Dê um nome ao grupo.';
        id = novoId('g');
        await alterar({ id, tipo: 'grupo', grupoId: id, dados: { nome, souDono: true } });
        await alterar({ id: novoId('p'), tipo: 'pessoa', grupoId: id, dados: { nome: (perfil && perfil.nome) || 'Eu', email: '', crianca: false, souEu: true, temApp: true } });
        return '';
      }
    });
    if (!ok || !id) return;
    abas[id] = 'pessoas';
    await ir('grupo', { grupoId: id });
    toast('Grupo criado. Agora adicione as pessoas.');
  }

  // ------------------------------------------------------------------
  //  Tela do grupo: resumo e as 4 abas
  // ------------------------------------------------------------------
  function abaAtual() {
    const d = dadosAtuais();
    return App().telaAtual() === 'grupo' ? (abas[d.grupoId] || 'despesas') : '';
  }
  async function renderGrupo(grupoId) {
    const G = await grupo(grupoId);
    if (!G) return false;
    const C = calcular(G);
    const aba = abas[grupoId] || 'despesas';
    $('gx-titulo').textContent = G.g.dados.nome;
    $('gx-sub').textContent = `${plural(G.pessoas.length, '1 pessoa', '# pessoas')} · ${plural(G.despesas.length, '1 despesa', '# despesas')}`;
    // resumo: total, a sua parte, o que você pagou e o seu saldo
    let resumo = '';
    if (G.eu) {
      const m = C.por[G.eu.id];
      const recebidos = m.recebidos;
      let saldo;
      if (m.saldo > 0) {
        saldo = `<button type="button" class="g-saldo recebe clic" data-acao="quem-falta"><span>Você tem a receber${recebidos ? `<span class="mais">já recebeu ${brl(c2v(recebidos))}</span>` : ''}</span><span>${brl(c2v(m.saldo))} ›</span></button>`;
      } else if (m.saldo < 0) {
        saldo = `<button type="button" class="g-saldo deve clic" data-acao="quem-falta"><span>Você deve${m.pagos ? `<span class="mais">já pagou ${brl(c2v(m.pagos))}</span>` : ''}</span><span>${brl(c2v(-m.saldo))} ›</span></button>`;
      } else {
        saldo = `<div class="g-saldo ok"><span>${G.despesas.length ? 'Você está quite com o grupo' : 'Nenhuma despesa ainda'}</span><span>✓</span></div>`;
      }
      resumo = '<div class="g-resumo"><div class="linha3">' +
        `<div><small>Total do grupo</small><b>${brl(c2v(C.total))}</b></div>` +
        `<div><small>Sua parte</small><b>${brl(c2v(m.parte))}</b></div>` +
        `<div><small>Você pagou</small><b>${brl(c2v(m.pagou))}</b></div></div>${saldo}</div>`;
    } else {
      resumo = `<div class="g-resumo"><div class="linha3 um"><div><small>Total do grupo</small><b>${brl(c2v(C.total))}</b></div></div></div>`;
    }
    const st = await ler();
    if (st.semServidor) resumo = aviso('O servidor ainda não foi atualizado para os grupos: por enquanto, o grupo fica só neste celular.') + resumo;
    $('gx-resumo').innerHTML = resumo;
    $('gx-abas').innerHTML = ABAS.map(([k, n]) => `<button type="button" role="tab" class="${k === aba ? 'on' : ''}" aria-selected="${k === aba}" data-aba="${k}">${n}</button>`).join('');
    $('gx-corpo').innerHTML = ({ despesas: abaDespesas, saldos: abaSaldos, acertar: abaAcertar, pessoas: abaPessoas })[aba](G, C);
    return true;
  }

  function abaDespesas(G) {
    let html = '';
    if (!G.despesas.length) {
      html = G.pessoas.length < 2
        ? '<div class="vazio">Nenhuma despesa ainda.<br>Primeiro adicione as pessoas do grupo na aba <b>Pessoas</b>.</div>'
        : '<div class="vazio">Nenhuma despesa ainda.<br>Toque em <b>Despesa do grupo</b> para lançar a primeira.</div>';
    }
    html += G.despesas.map(d => `<button type="button" class="g-desp" data-despesa="${esc(d.id)}"><span class="ic" aria-hidden="true">${icone(d)}</span>` +
      `<span class="t"><b>${esc(d.dados.descricao || 'Despesa')}</b><small>Pago por <b class="em-linha">${esc(nomeDe(G, d.dados.pagoPor))}</b> · ${esc(dataCurta(d.dados.data))}</small>` +
      `<small>${esc(textoDivisao(G, d))}</small></span>` +
      `<span class="v">${brl(d.dados.valor)}${d.pendente ? '<span class="selo fila">Na fila</span>' : ''}</span></button>`).join('');
    return html + '<button type="button" class="g-fab" data-acao="nova-despesa">＋ Despesa do grupo</button>';
  }

  function abaSaldos(G, C) {
    if (!G.despesas.length) return '<div class="vazio">Os saldos aparecem depois da primeira despesa.</div>';
    const maior = Math.max(1, ...G.pessoas.map(p => Math.abs(C.por[p.id].saldo)));
    return aviso('Saldo = o que a pessoa <b>pagou</b> − a <b>parte dela</b> nas despesas (contando os acertos já pagos). Verde recebe, vermelho deve.') +
      G.pessoas.map((p) => {
        const c = C.por[p.id];
        const cls = c.saldo > 0 ? 'verde' : c.saldo < 0 ? 'vermelho' : 'cinza';
        const rot = c.saldo > 0 ? 'recebe' : c.saldo < 0 ? 'deve' : 'quite';
        const extra = (c.pagos ? ` · acertou ${brl(c2v(c.pagos))}` : '') + (c.recebidos ? ` · recebeu ${brl(c2v(c.recebidos))}` : '');
        const larg = Math.max(4, Math.round(Math.abs(c.saldo) / maior * 100));
        return `<div class="g-pessoa">${avatar(G, p)}<div class="n"><b>${esc(p.dados.nome)}${tags(p)}</b>` +
          `<small>Pagou ${brl(c2v(c.pagou))} · parte ${brl(c2v(c.parte))}${extra}</small>` +
          (c.saldo ? `<div class="g-barra ${cls}" style="width:${larg}%"></div>` : '') + '</div>' +
          `<div class="s ${cls}">${brl(c2v(Math.abs(c.saldo)))}<small>${rot}</small></div></div>`;
      }).join('') + '<button type="button" class="g-fab" data-acao="relatorio">📊 Ver o relatório do grupo</button>';
  }

  function abaAcertar(G, C) {
    const pagos = G.pagamentos;
    const faltam = C.transf.reduce((s, t) => s + t.v, 0);
    let html = '<div class="g-resumo apertado"><div class="linha3">' +
      `<div><small>Pagamentos</small><b>${pagos.length + C.transf.length}</b></div>` +
      `<div><small>Já pagos</small><b class="verde">${pagos.length}</b></div>` +
      `<div><small>Faltam</small><b class="${faltam ? 'vermelho' : 'verde'}">${brl(c2v(faltam))}</b></div></div></div>`;
    if (!G.despesas.length) return html + '<div class="vazio">Nada para acertar ainda.</div>';
    const linha = (de, para, v) => `<div class="de">${avatar(G, G.porId[de] || { id: de, dados: { nome: '?' } })}<b>${esc(nomeDe(G, de, { voce: true, curto: true }))}</b>` +
      `<span class="seta" aria-hidden="true">→</span>${avatar(G, G.porId[para] || { id: para, dados: { nome: '?' } })}<b>${esc(nomeDe(G, para, { voce: true, curto: true }))}</b><span class="v">${brl(c2v(v))}</span></div>`;
    html += pagos.map(pg => `<button type="button" class="g-pix pago" data-pagamento="${esc(pg.id)}">${linha(pg.dados.de, pg.dados.para, v2c(pg.dados.valor))}` +
      `<div class="ok">✓ Pago${pg.dados.data ? ' em ' + esc(dataCurta(pg.dados.data)) : ''}${pg.dados.marcadoPor ? ' · marcado por ' + esc(primeiroNome(pg.dados.marcadoPor)) : ''}` +
      `${pg.pendente ? ' <span class="selo fila">Na fila</span>' : ''}</div></button>`).join('');
    html += C.transf.map((t, i) => `<div class="g-pix">${linha(t.de, t.para, t.v)}` +
      `<div class="acoes"><button type="button" class="botao pequeno" data-acao="marcar-pago" data-i="${i}">✓ Marcar como pago</button></div></div>`).join('');
    if (!C.transf.length) html += '<div class="g-ok grande">✓ Tudo acertado: ninguém deve nada.</div>';
    return html + '<button type="button" class="g-fab" data-acao="relatorio">📊 Ver o relatório do grupo</button>';
  }

  function abaPessoas(G) {
    return G.pessoas.map(p => `<button type="button" class="g-pessoa" data-pessoa="${esc(p.id)}">${avatar(G, p)}<span class="n"><b>${esc(p.dados.nome)}${tags(p)}</b>` +
      (p.dados.crianca ? '<small>criança até 6 anos</small>' : '') + `</span>${p.pendente ? '<span class="selo fila">Na fila</span>' : ''}<span class="seta" aria-hidden="true">›</span></button>`).join('') +
      '<button type="button" class="g-fab" data-acao="nova-pessoa">＋ Adicionar pessoa</button>';
  }

  // "Você tem a receber" (ou "Você deve"): quem falta pagar (sem cobrança, só para ver)
  async function quemFalta() {
    const G = await grupo(dadosAtuais().grupoId);
    if (!G || !G.eu) return;
    const C = calcular(G);
    const m = C.por[G.eu.id];
    const recebe = m.saldo > 0;
    const lista = C.transf.filter(t => (recebe ? t.para : t.de) === G.eu.id);
    const total = recebe ? m.saldo + m.recebidos : -m.saldo + m.pagos;
    const sub = recebe ? `${brl(c2v(m.saldo))} de ${brl(c2v(total))}` : `${brl(c2v(-m.saldo))} de ${brl(c2v(total))}`;
    const linhas = lista.map((t) => {
      const outro = G.porId[recebe ? t.de : t.para];
      return `<div class="g-pessoa">${avatar(G, outro)}<div class="n"><b>${esc(outro.dados.nome)}</b><small>${recebe ? 'ainda não pagou' : 'você ainda não pagou'}</small></div>` +
        `<div class="s vermelho">${brl(c2v(t.v))}</div></div>`;
    }).join('');
    App().abrirDialogo('<div class="fundo-dialogo folha-fundo" id="gf-fundo"><div class="dialogo g-folha" role="dialog" aria-label="' + (recebe ? 'Quem falta te pagar' : 'Quem você precisa pagar') + '">' +
      `<div class="puxador" aria-hidden="true"></div><h3>${recebe ? 'Quem falta te pagar' : 'Quem você precisa pagar'}</h3>` +
      `<p class="sub">${esc(G.g.dados.nome)} · ${sub}</p><div class="g-folha-lista">${linhas}</div>` +
      '<div class="botoes"><button class="botao primario" type="button" id="gf-fechar">Fechar</button></div></div></div>', () => { /* só fecha */ }, { fora: true });
    $('gf-fechar').onclick = () => App().fecharDialogo();
  }

  async function marcarPago(i) {
    const G = await grupo(dadosAtuais().grupoId);
    if (!G) return;
    const t = calcular(G).transf[i];
    if (!t) return;
    const de = nomeDe(G, t.de, { voce: true });
    const para = nomeDe(G, t.para, { voce: true }).replace(/^Você$/, 'você');
    if (!(await App().confirmar(`Marcar que ${de} pagou ${brl(c2v(t.v))} para ${para}?`, 'Marcar como pago', 'Cancelar'))) return;
    const perfil = await Perfil.obter();
    await alterar({ id: novoId('a'), tipo: 'pagamento', grupoId: G.g.id, dados: { de: t.de, para: t.para, valor: c2v(t.v), data: hoje(), marcadoPor: (perfil && perfil.nome) || '' } });
    toast(t.de === (G.eu && G.eu.id) ? 'Pagamento marcado. Ele entra nos seus lançamentos.' : 'Pagamento marcado.');
    renderGrupo(G.g.id);
  }
  async function desfazerPagamento(id) {
    const G = await grupo(dadosAtuais().grupoId);
    const pg = G && G.pagamentos.find(x => x.id === id);
    if (!pg) return;
    const ok = await App().confirmar(`Desfazer o pagamento de ${brl(pg.dados.valor)} (${nomeDe(G, pg.dados.de, { curto: true })} → ${nomeDe(G, pg.dados.para, { curto: true })})?`, 'Desfazer', 'Cancelar');
    if (!ok) return;
    await excluir([id]);
    toast('Pagamento desfeito.');
    renderGrupo(G.g.id);
  }

  async function opcoesGrupo() {
    const G = await grupo(dadosAtuais().grupoId);
    if (!G) return;
    const dono = !!G.g.dados.souDono;
    const ops = [{ texto: '✏️ Mudar o nome do grupo', valor: 'nome' }, { texto: '📊 Relatório do grupo', valor: 'relatorio' }];
    ops.push(dono ? { texto: '🗑️ Excluir o grupo', valor: 'excluir', classe: 'perigo' } : { texto: '🚪 Sair do grupo', valor: 'sair', classe: 'perigo' });
    ops.push({ texto: 'Cancelar', valor: null });
    const r = await App().escolher(G.g.dados.nome, ops);
    if (r === 'relatorio') { ir('grupo-relatorio', { grupoId: G.g.id }); return; }
    if (r === 'nome') {
      const ok = await App().dialogoCampos({
        titulo: 'Nome do grupo',
        campos: [{ id: 'dlg-grupo-nome', rotulo: 'Nome', valor: G.g.dados.nome }],
        aoConfirmar: async (v) => {
          const nome = String(v['dlg-grupo-nome'] || '').trim().slice(0, 60);
          if (!nome) return 'Dê um nome ao grupo.';
          const g = await grupo(G.g.id);
          if (!g) return 'O grupo não existe mais.';
          await alterar(Object.assign({}, g.g, { dados: Object.assign({}, g.g.dados, { nome }) }));
          return '';
        }
      });
      if (ok) renderGrupo(G.g.id);
      return;
    }
    if (r === 'excluir') {
      const ok = await App().confirmar(`Excluir o grupo "${G.g.dados.nome}"? Ele some para todas as pessoas, com as despesas e os pagamentos. Não dá para desfazer.`, 'Excluir o grupo', 'Cancelar');
      if (!ok) return;
      const st = await ler();
      const ids = Object.values(st.objetos).filter(o => o.grupoId === G.g.id).map(o => o.id);
      if (G.g.noServidor) {
        // vai só a exclusão do grupo (o servidor esconde o resto); o resto sai do celular agora
        const resto = ids.filter(id => id !== G.g.id);
        resto.forEach((id) => { delete st.objetos[id]; });
        await guardar(st);
        await excluir([G.g.id]);
      } else {
        ids.forEach((id) => { delete st.objetos[id]; });
        await guardar(st);
      }
      toast('Grupo excluído.');
      voltar();
      return;
    }
    if (r === 'sair') {
      if (!G.eu) return;
      if (participa(G, G.eu.id)) {
        await App().escolher('Você está nas despesas ou nos pagamentos deste grupo. Para sair, peça para tirarem você dessas despesas (ou para quem criou o grupo excluí-lo).', [{ texto: 'Entendi', valor: null, classe: 'primario' }]);
        return;
      }
      const ok = await App().confirmar(`Sair do grupo "${G.g.dados.nome}"? Ele deixa de aparecer para você.`, 'Sair do grupo', 'Cancelar');
      if (!ok) return;
      await excluir([G.eu.id]);
      // o grupo some daqui na próxima sincronização; até lá, fica escondido
      const st = await ler();
      Object.values(st.objetos).filter(o => o.grupoId === G.g.id && o.id !== G.eu.id).forEach((o) => { delete st.objetos[o.id]; });
      await guardar(st);
      toast('Você saiu do grupo.');
      voltar();
    }
  }
  function participa(G, pessoaId) {
    return G.despesas.some(d => d.dados.pagoPor === pessoaId || (d.dados.partes || []).some(x => x.p === pessoaId)) ||
      G.pagamentos.some(pg => pg.dados.de === pessoaId || pg.dados.para === pessoaId);
  }

  // ------------------------------------------------------------------
  //  Despesa do grupo (nova ou editar)
  // ------------------------------------------------------------------
  // GD: { G, id, modo, pagoPor, marcados: Set, tipos: { pessoaId: 'base'|'meia'|'fixo' }, fixos: { pessoaId: centavos }, todosChips, alterado, pop }
  let GD = null;
  async function prepararDespesa(dados) {
    const G = await grupo(dados.grupoId);
    if (!G) return false;
    const d = dados.despesaId ? G.despesas.find(x => x.id === dados.despesaId) : null;
    if (dados.despesaId && !d) return false;
    const marcados = new Set();
    const tipos = {};
    const fixos = {};
    if (d) {
      (d.dados.partes || []).forEach((x) => {
        if (!G.porId[x.p]) return;
        marcados.add(x.p);
        tipos[x.p] = x.t || 'base';
        if (x.t === 'fixo') fixos[x.p] = v2c(x.v);
      });
    } else {
      G.pessoas.forEach((p) => { if (!p.dados.crianca) marcados.add(p.id); }); // criança até 6 anos vem desmarcada
    }
    const pagoPor = d ? d.dados.pagoPor : (G.eu ? G.eu.id : (G.pessoas[0] && G.pessoas[0].id));
    const idxPagador = G.pessoas.findIndex(p => p.id === pagoPor);
    GD = { G, d, id: d ? d.id : null, modo: d ? d.dados.modo : 'igual', pagoPor, marcados, tipos, fixos, todosChips: idxPagador >= CHIPS_VISIVEIS, alterado: false, pop: null };
    $('gd-titulo').textContent = d ? 'Despesa do grupo' : 'Nova despesa do grupo';
    $('gd-sub').textContent = G.g.dados.nome;
    const l = await App().listas();
    $('gd-conteudo').innerHTML =
      '<label for="gd-desc">Descrição</label><input id="gd-desc" autocapitalize="sentences" autocomplete="off" maxlength="120" placeholder="Ex.: Passeio de barco">' +
      '<div class="g-precos"><div><label for="gd-valor">Valor total</label>' +
      '<input id="gd-valor" class="caixa-registradora" data-casas="2" inputmode="numeric" autocomplete="off" placeholder="R$ 0,00"></div>' +
      '<div><label for="gd-data">Data</label><button type="button" class="campo-data" id="gd-data"></button></div></div>' +
      '<label>Quem pagou?</label><div class="g-chips" id="gd-pagou"></div>' +
      '<div id="gd-forma-caixa"><label for="gd-forma">Forma de pagamento <small class="opcional">(aparece nos seus lançamentos)</small></label><select id="gd-forma"></select></div>' +
      '<label for="gd-cat">Categoria <small class="opcional">(opcional)</small></label><select id="gd-cat"></select>' +
      '<label>Como dividir?</label><div class="g-seg dois" id="gd-modo">' +
      '<button type="button" data-modo="igual">Igual</button><button type="button" data-modo="individual">Valor individual</button></div>' +
      '<label id="gd-rot-lista"></label><div class="g-lista" id="gd-lista"></div><div class="g-conta" id="gd-conta"></div>' +
      '<p class="erro" id="gd-erro"></p>' +
      '<div class="g-salvar"><button class="botao" type="button" id="gd-cancelar">Cancelar</button><button class="botao primario" type="button" id="gd-salvar">Salvar</button></div>' +
      (d ? '<button class="botao perigo largo" type="button" id="gd-excluir">Excluir despesa</button>' +
        `<p class="g-rodape">Lançada por ${esc(primeiroNome(d.dados.lancadoPor) || 'alguém')}</p>` : '');
    $('gd-desc').value = d ? d.dados.descricao || '' : '';
    const valor = $('gd-valor');
    U().caixaRegistradora(valor);
    valor.value = d ? U().paraMascara(d.dados.valor, 2) : '';
    U().definirData($('gd-data'), d ? d.dados.data || hoje() : hoje());
    App().preencherSelect($('gd-forma'), l.meios, d ? d.dados.formaPagamento || '' : '', 'Escolha');
    App().preencherSelect($('gd-cat'), l.categorias, d ? d.dados.categoria || '' : '', 'Sem categoria');
    desenharDespesa();
    return true;
  }
  function totalDigitado() { return v2c(U().daMascara($('gd-valor')) || 0); }
  function divisaoAtual() {
    const ids = GD.G.pessoas.filter(p => GD.marcados.has(p.id)).map(p => p.id);
    if (GD.modo === 'igual') return dividirIgual(totalDigitado(), ids);
    return dividir(totalDigitado(), ids.map(p => ({ p, t: GD.tipos[p] || 'base', c: GD.fixos[p] || 0 })));
  }
  function desenharDespesa() {
    const { G } = GD;
    // quem pagou: os 5 primeiros e "+ N" para ver o resto
    const chips = GD.todosChips ? G.pessoas : G.pessoas.slice(0, CHIPS_VISIVEIS);
    $('gd-pagou').innerHTML = chips.map(p => `<button type="button" class="${p.id === GD.pagoPor ? 'on' : ''}" data-pagou="${esc(p.id)}">${esc(nomeDe(G, p.id))}</button>`).join('') +
      (!GD.todosChips && G.pessoas.length > CHIPS_VISIVEIS ? `<button type="button" data-acao="mais-chips">+ ${G.pessoas.length - CHIPS_VISIVEIS}</button>` : '');
    $('gd-forma-caixa').classList.toggle('oculto', !(G.eu && GD.pagoPor === G.eu.id));
    $('gd-modo').querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.modo === GD.modo); });
    $('gd-rot-lista').innerHTML = GD.modo === 'igual' ? 'Quem participou? <small class="opcional">(desmarque quem não foi)</small>'
      : 'Quem participou e quanto <small class="opcional">(toque no valor para mudar)</small>';
    const div = divisaoAtual();
    const parte = {};
    div.partes.forEach((x) => { parte[x.p] = x; });
    $('gd-lista').innerHTML = G.pessoas.map((p) => {
      const on = GD.marcados.has(p.id);
      const x = parte[p.id];
      let val = '<span class="val cinza">—</span>';
      if (on && GD.modo === 'igual') val = `<span class="val">${totalDigitado() ? brl(c2v(x.c)) : '—'}</span>`;
      if (on && GD.modo === 'individual') {
        const marca = x.t === 'meia' ? '<span class="g-tag t-meia">meia</span>' : x.t === 'fixo' ? '<span class="g-tag t-nome">outro</span>' : '';
        val = `${marca}<button type="button" class="g-valbtn${GD.pop === p.id ? ' ativo' : ''}" data-valor="${esc(p.id)}">${brl(c2v(x.c))}</button>`;
      }
      let pop = '';
      if (on && GD.modo === 'individual' && GD.pop === p.id) {
        const t = GD.tipos[p.id] || 'base';
        pop = '<div class="g-pop" role="dialog" aria-label="Valor de ' + esc(p.dados.nome) + '">' +
          `<button type="button" class="${t === 'base' ? 'on' : ''}" data-tipo="base"><small>inteira</small>${div.inteira ? brl(c2v(div.inteira)) : 'Inteira'}</button>` +
          `<button type="button" class="${t === 'meia' ? 'on' : ''}" data-tipo="meia"><small>meia</small>${div.meia ? brl(c2v(div.meia)) : 'Meia'}</button>` +
          `<span class="g-pop-outro"><input id="gd-outro" class="caixa-registradora" data-casas="2" inputmode="numeric" autocomplete="off" placeholder="R$ outro" aria-label="Outro valor">` +
          '<button type="button" class="botao pequeno primario" data-tipo="fixo">OK</button></span></div>';
      }
      return `<div class="l${pop ? ' g-linha-pop' : ''}"><button type="button" class="g-check-linha" data-marcar="${esc(p.id)}" aria-pressed="${on}">` +
        `<span class="g-check${on ? ' on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>${avatar(G, p)}<span class="nome">${esc(nomeDe(G, p.id))}</span></button>${val}${pop}</div>`;
    }).join('');
    if (GD.pop) {
      const outro = $('gd-outro');
      if (outro) {
        U().caixaRegistradora(outro);
        if (GD.tipos[GD.pop] === 'fixo') outro.value = U().paraMascara(c2v(GD.fixos[GD.pop] || 0), 2);
        outro.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aplicarTipo('fixo'); } });
      }
    }
    // a conta embaixo: "7 × R$ 100,00 + 2 × R$ 50,00" e se fecha com o total
    const tot = totalDigitado();
    const fora = G.pessoas.filter(p => !GD.marcados.has(p.id)).map(p => primeiroNome(p.dados.nome));
    if (!div.partes.length) {
      $('gd-conta').innerHTML = 'Marque quem participou da despesa.';
    } else if (!tot) {
      $('gd-conta').innerHTML = `${plural(div.partes.length, '1 pessoa', '# pessoas')} · digite o valor total.`;
    } else {
      const grupos = {};
      div.partes.forEach((x) => { grupos[x.c] = (grupos[x.c] || 0) + 1; });
      const conta = Object.keys(grupos).map(Number).sort((a, b) => b - a).map(c => `${grupos[c]} × ${brl(c2v(c))}`).join(' + ');
      const soma = div.partes.reduce((s, x) => s + x.c, 0);
      const ok = soma === tot;
      const quemNao = fora.length ? ` <small>(${fora.length === 1 ? fora[0] + ' não participou' : fora.length + ' não participaram'})</small>` : '';
      $('gd-conta').innerHTML = `${conta}${quemNao}<br><b>Soma: ${brl(c2v(soma))}</b>` +
        (ok ? '<div class="g-ok">✓ fecha com o valor total</div>'
          : `<div class="g-nao">⚠️ ${soma < tot ? 'faltam ' + brl(c2v(tot - soma)) : 'passa ' + brl(c2v(soma - tot))} para fechar com o valor total</div>`);
    }
  }
  function aplicarTipo(tipo) {
    const id = GD.pop;
    if (!id) return;
    if (tipo === 'fixo') {
      const c = v2c(U().daMascara($('gd-outro')) || 0);
      if (!c) { toast('Digite o valor.'); return; }
      GD.fixos[id] = c;
    }
    GD.tipos[id] = tipo;
    GD.pop = null;
    GD.alterado = true;
    desenharDespesa();
  }
  function aoClicarDespesa(e) {
    const b = e.target.closest('button');
    // tocar fora da janelinha do valor fecha
    if (GD && GD.pop && !e.target.closest('.g-pop') && !(b && b.dataset.valor)) { GD.pop = null; desenharDespesa(); if (!b) return; }
    if (!b || !GD) return;
    if (b.id === 'gd-data') { U().abrirCalendario(b); return; }
    if (b.id === 'gd-salvar') { salvarDespesa(); return; }
    if (b.id === 'gd-cancelar') { voltar(); return; }
    if (b.id === 'gd-excluir') { excluirDespesa(); return; }
    if (b.dataset.acao === 'mais-chips') { GD.todosChips = true; desenharDespesa(); return; }
    if (b.dataset.pagou) { GD.pagoPor = b.dataset.pagou; GD.alterado = true; desenharDespesa(); return; }
    if (b.dataset.modo) { GD.modo = b.dataset.modo; GD.pop = null; GD.alterado = true; desenharDespesa(); return; }
    if (b.dataset.marcar) {
      const id = b.dataset.marcar;
      if (GD.marcados.has(id)) GD.marcados.delete(id); else GD.marcados.add(id);
      if (GD.pop === id) GD.pop = null;
      GD.alterado = true;
      desenharDespesa();
      return;
    }
    if (b.dataset.valor) { GD.pop = GD.pop === b.dataset.valor ? null : b.dataset.valor; desenharDespesa(); return; }
    if (b.dataset.tipo) aplicarTipo(b.dataset.tipo);
  }
  async function salvarDespesa() {
    const erro = (m) => { $('gd-erro').textContent = m; };
    const descricao = $('gd-desc').value.trim();
    const tot = totalDigitado();
    const data = $('gd-data').value;
    if (!descricao) return erro('Escreva a descrição da despesa.');
    if (!tot) return erro('Digite o valor total.');
    if (!data) return erro('Escolha a data.');
    if (!GD.G.porId[GD.pagoPor]) return erro('Escolha quem pagou.');
    const div = divisaoAtual();
    if (!div.partes.length) return erro('Marque quem participou da despesa.');
    const soma = div.partes.reduce((s, x) => s + x.c, 0);
    if (soma !== tot) return erro('A soma dos valores não fecha com o valor total. Toque nos valores para acertar.');
    const perfil = await Perfil.obter();
    const souEu = GD.G.eu && GD.pagoPor === GD.G.eu.id;
    const dados = {
      descricao, valor: c2v(tot), data, categoria: $('gd-cat').value, pagoPor: GD.pagoPor,
      formaPagamento: souEu ? $('gd-forma').value : (GD.d ? GD.d.dados.formaPagamento || '' : ''),
      modo: GD.modo, partes: div.partes.map(x => ({ p: x.p, v: c2v(x.c), t: GD.modo === 'igual' ? 'base' : x.t })),
      lancadoPor: GD.d ? GD.d.dados.lancadoPor : ((perfil && perfil.nome) || '')
    };
    await alterar({ id: GD.id || novoId('d'), tipo: 'despesa', grupoId: GD.G.g.id, dados });
    GD.alterado = false;
    toast(souEu && !GD.d ? 'Despesa salva. Ela entra nos seus lançamentos pelo valor cheio.' : 'Despesa salva.');
    voltar();
  }
  async function excluirDespesa() {
    if (!(await App().confirmar('Excluir esta despesa? Ela sai do grupo para todas as pessoas.', 'Excluir', 'Cancelar'))) return;
    await excluir([GD.id]);
    GD.alterado = false;
    toast('Despesa excluída.');
    voltar();
  }

  // ------------------------------------------------------------------
  //  Pessoa do grupo (adicionar ou editar)
  // ------------------------------------------------------------------
  let GP = null;
  async function prepararPessoa(dados) {
    const G = await grupo(dados.grupoId);
    if (!G) return false;
    const p = dados.pessoaId ? G.porId[dados.pessoaId] : null;
    if (dados.pessoaId && !p) return false;
    const temApp = !!(p && (p.dados.email || p.dados.temApp)) && !(p && p.dados.souEu);
    GP = { G, p, temApp, alterado: false };
    $('gp-titulo').textContent = p ? (p.dados.souEu ? 'Você no grupo' : p.dados.nome) : 'Adicionar pessoa';
    $('gp-sub').textContent = G.g.dados.nome;
    let situacao = '';
    if (p && !p.dados.souEu && p.dados.temApp) situacao = '<div class="g-ok">✓ Ela tem o app: vê o grupo e lança despesas no celular dela.</div>';
    else if (p && p.dados.emailSemConta) situacao = aviso('Ainda não existe conta com esse e-mail. Quando ela criar a conta com ele, o grupo aparece para ela.');
    $('gp-conteudo').innerHTML =
      '<label for="gp-nome">Nome <small class="opcional">(obrigatório)</small></label><input id="gp-nome" autocapitalize="words" autocomplete="off" maxlength="60" placeholder="Ex.: Lucas">' +
      (p && p.dados.souEu ? '' :
        '<label>Ela tem o app Controle de Gastos?</label><div class="g-seg dois" id="gp-app">' +
        '<button type="button" data-app="nao">Não</button><button type="button" data-app="sim">Sim</button></div>' +
        '<div id="gp-email-caixa"><label for="gp-email">E-mail do cadastro dela</label>' +
        '<input id="gp-email" type="email" inputmode="email" autocomplete="off" autocapitalize="off" placeholder="nome@exemplo.com">' +
        '<p class="g-dica">Com o e-mail, ela passa a ver o grupo e lançar despesas no celular dela.</p></div>' + situacao +
        '<label class="marcar g-crianca"><input type="checkbox" id="gp-crianca"> <b>Criança até 6 anos</b></label>' +
        '<p class="g-dica recuo">Entra no grupo como qualquer pessoa, mas nas despesas já vem <b>desmarcada</b> (por padrão não gasta nada). Se em alguma despesa ela tiver que pagar, é só marcar.</p>') +
      '<p class="erro" id="gp-erro"></p>' +
      `<div class="g-salvar"><button class="botao" type="button" id="gp-cancelar">Cancelar</button><button class="botao primario" type="button" id="gp-salvar">${p ? 'Salvar' : 'Adicionar'}</button></div>` +
      (p && !p.dados.souEu ? '<button class="botao perigo largo" type="button" id="gp-excluir">Tirar do grupo</button>' : '');
    $('gp-nome').value = p ? p.dados.nome : '';
    if ($('gp-email')) $('gp-email').value = p ? p.dados.email || '' : '';
    if ($('gp-crianca')) $('gp-crianca').checked = !!(p && p.dados.crianca);
    desenharPessoa();
    setTimeout(() => { if (!p && $('gp-nome')) $('gp-nome').focus(); }, 80);
    return true;
  }
  function desenharPessoa() {
    if (!$('gp-app')) return;
    $('gp-app').querySelectorAll('button').forEach((b) => { b.classList.toggle('on', (b.dataset.app === 'sim') === GP.temApp); });
    $('gp-email-caixa').classList.toggle('oculto', !GP.temApp);
  }
  function aoClicarPessoa(e) {
    const b = e.target.closest('button');
    if (!b || !GP) return;
    if (b.dataset.app) { GP.temApp = b.dataset.app === 'sim'; GP.alterado = true; desenharPessoa(); if (GP.temApp) setTimeout(() => $('gp-email').focus(), 50); return; }
    if (b.id === 'gp-salvar') salvarPessoa();
    if (b.id === 'gp-cancelar') voltar();
    if (b.id === 'gp-excluir') excluirPessoa();
  }
  async function salvarPessoa() {
    const erro = (m) => { $('gp-erro').textContent = m; };
    const { G, p } = GP;
    const nome = $('gp-nome').value.trim().slice(0, 60);
    if (!nome) return erro('Digite o nome.');
    const igual = G.pessoas.find(x => x.id !== (p && p.id) && x.dados.nome.trim().toLowerCase() === nome.toLowerCase());
    if (igual) return erro('Já existe uma pessoa com esse nome no grupo. Use outro (ex.: com o sobrenome).');
    let email = '';
    if (!(p && p.dados.souEu) && GP.temApp) {
      const digitado = $('gp-email').value.trim();
      email = App().normalizarEmail(digitado);
      if (!email) return erro(digitado ? 'E-mail inválido.' : 'Digite o e-mail do cadastro dela (ou marque "Não").');
      if (G.pessoas.some(x => x.id !== (p && p.id) && x.dados.email === email)) return erro('Esse e-mail já está em outra pessoa do grupo.');
    }
    const dados = p ? Object.assign({}, p.dados) : {};
    dados.nome = nome;
    if (!(p && p.dados.souEu)) {
      if (!p || dados.email !== email) { dados.temApp = false; dados.emailSemConta = false; }
      dados.email = email;
      dados.crianca = $('gp-crianca').checked;
    }
    await alterar({ id: p ? p.id : novoId('p'), tipo: 'pessoa', grupoId: G.g.id, dados });
    GP.alterado = false;
    toast(p ? 'Pessoa salva.' : `${primeiroNome(nome)} entrou no grupo.`);
    voltar();
  }
  async function excluirPessoa() {
    const { G, p } = GP;
    if (participa(G, p.id)) {
      await App().escolher(`${primeiroNome(p.dados.nome)} está em despesas ou pagamentos do grupo. Tire ${primeiroNome(p.dados.nome)} dessas despesas antes (ou exclua as despesas).`, [{ texto: 'Entendi', valor: null, classe: 'primario' }]);
      return;
    }
    if (!(await App().confirmar(`Tirar ${p.dados.nome} do grupo?`, 'Tirar do grupo', 'Cancelar'))) return;
    await excluir([p.id]);
    GP.alterado = false;
    toast('Pessoa removida do grupo.');
    voltar();
  }

  // ------------------------------------------------------------------
  //  Relatório do grupo (só para ver no app)
  // ------------------------------------------------------------------
  async function renderRelatorio(grupoId) {
    const G = await grupo(grupoId);
    if (!G) return false;
    const C = calcular(G);
    $('gl-sub').textContent = G.g.dados.nome;
    const partes = G.pessoas.map(p => C.por[p.id].parte);
    const todosIguais = G.pessoas.length > 1 && partes.every(v => v === partes[0]) && partes[0] > 0;
    let html = '<div class="g-secao">Despesas</div><div class="g-tabela">' +
      (G.despesas.length ? G.despesas.map(d => `<div><span>${icone(d)} ${esc(d.dados.descricao || 'Despesa')} <small>(${esc(nomeDe(G, d.dados.pagoPor, { curto: true }).replace(' (você)', ''))} · ${esc(dataCurta(d.dados.data))})</small></span><b>${brl(d.dados.valor)}</b></div>`).join('')
        : '<div><span class="cinza">Nenhuma despesa ainda.</span></div>') +
      `<div class="total"><span><b>Total</b>${todosIguais ? ' · ' + brl(c2v(partes[0])) + ' por pessoa' : ''}</span><b>${brl(c2v(C.total))}</b></div></div>`;
    html += '<div class="g-secao">Cada um</div><div class="g-tabela pequena">' + G.pessoas.map((p) => {
      const c = C.por[p.id];
      const s = c.saldo > 0 ? `<b class="verde">recebe ${brl(c2v(c.saldo))}</b>` : c.saldo < 0 ? `<b class="vermelho">deve ${brl(c2v(-c.saldo))}</b>` : '<b class="cinza">quite</b>';
      const extra = (c.pagos ? ` · acertou ${brl(c2v(c.pagos))}` : '') + (c.recebidos ? ` · recebeu ${brl(c2v(c.recebidos))}` : '');
      return `<div><span class="nome">${esc(p.dados.nome)}</span><span class="dir"><small>pagou ${brl(c2v(c.pagou))} · parte ${brl(c2v(c.parte))}${extra}</small>${s}</span></div>`;
    }).join('') + '</div>';
    // quem paga quem: os já pagos (✅) e os que faltam (iguais para a mesma pessoa ficam juntos)
    const linhas = G.pagamentos.map(pg => `<div><span>✅ ${esc(nomeDe(G, pg.dados.de, { curto: true }).replace(' (você)', ''))} → ${esc(nomeDe(G, pg.dados.para, { curto: true }).replace(' (você)', ''))}</span><b>${brl(pg.dados.valor)}</b></div>`);
    const juntos = [];
    C.transf.forEach((t) => {
      const j = juntos.find(x => x.para === t.para && x.v === t.v);
      if (j) j.de.push(t.de); else juntos.push({ para: t.para, v: t.v, de: [t.de] });
    });
    juntos.forEach((j) => {
      const nomes = j.de.map(id => nomeDe(G, id, { curto: true }).replace(' (você)', ''));
      const quem = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
      linhas.push(`<div><span>${esc(quem)} → ${esc(nomeDe(G, j.para, { curto: true }).replace(' (você)', ''))}</span><b class="sem-quebra">${brl(c2v(j.v))}${nomes.length > 1 ? ' cada' : ''}</b></div>`);
    });
    html += '<div class="g-secao">Quem paga quem</div><div class="g-tabela">' + (linhas.length ? linhas.join('') : '<div><span class="cinza">Ninguém deve nada.</span></div>') + '</div>' +
      '<p class="g-dica">✅ = já pago (marcado em "Acertar"). Os outros são os pagamentos que faltam para acertar tudo.</p>';
    $('gl-conteudo').innerHTML = html;
    return true;
  }

  // ------------------------------------------------------------------
  //  Tela inicial e Lançamentos
  // ------------------------------------------------------------------
  /** O que saiu do bolso da pessoa: as despesas que ela pagou (valor cheio) e os pagamentos do acerto que ela fez. */
  async function paraInicio() {
    const itens = [];
    for (const G of await grupos()) {
      if (!G.eu) continue;
      const quando = (d) => {
        const [a, m, dd] = String(d || '').split('-').map(Number);
        return a ? new Date(a, m - 1, dd, 12).getTime() : Date.now();
      };
      const tag = `<span class="g-grupo-tag">👥 ${esc(G.g.dados.nome)}</span>`;
      G.despesas.filter(d => d.dados.pagoPor === G.eu.id).forEach((d) => {
        const minha = (d.dados.partes || []).filter(x => x.p === G.eu.id).reduce((s, x) => s + v2c(x.v), 0);
        const receber = v2c(d.dados.valor) - minha;
        const meta = [d.dados.categoria, d.dados.formaPagamento].filter(Boolean).map(esc).join(' · ');
        itens.push({
          quando: quando(d.dados.data), valor: Number(d.dados.valor), comHora: false,
          resumo: `${icone(d)} ${d.dados.descricao || 'Despesa'} · ${G.g.dados.nome}`,
          html: `<div class="cartao g-cartao" data-gdesp="${esc(d.id)}" data-grupo="${esc(G.g.id)}" role="button"><div><div class="desc">${icone(d)} ${esc(d.dados.descricao || 'Despesa')}</div>` +
            (meta ? `<div class="meta">${meta}</div>` : '') +
            `<div class="meta">Sua parte: ${brl(c2v(minha))} · a receber: ${brl(c2v(receber))}</div>${tag}</div>` +
            `<div class="direita"><span class="valor">${brl(d.dados.valor)}</span>${d.pendente ? '<span class="selo fila">Na fila</span>' : ''}</div></div>`
        });
      });
      G.pagamentos.filter(pg => pg.dados.de === G.eu.id).forEach((pg) => {
        itens.push({
          quando: quando(pg.dados.data), valor: Number(pg.dados.valor), comHora: false,
          resumo: `🤝 Acerto · ${G.g.dados.nome}`,
          html: `<div class="cartao g-cartao" data-gpag="${esc(pg.id)}" data-grupo="${esc(G.g.id)}" role="button"><div><div class="desc">🤝 Acerto · ${esc(G.g.dados.nome)}</div>` +
            `<div class="meta">Pago para ${esc(nomeDe(G, pg.dados.para, { curto: true }))}</div>${tag}</div>` +
            `<div class="direita"><span class="valor">${brl(pg.dados.valor)}</span>${pg.pendente ? '<span class="selo fila">Na fila</span>' : ''}</div></div>`
        });
      });
    }
    return itens;
  }
  /** Saldos de todos os grupos (para a tela inicial e a Lançamentos). */
  async function saldos() {
    const r = { receber: 0, dever: 0, nomesReceber: [], nomesDever: [], lista: await grupos() };
    r.lista.forEach((G) => {
      if (!G.eu) return;
      const s = calcular(G).por[G.eu.id].saldo;
      if (s > 0) { r.receber += s; r.nomesReceber.push(G.g.dados.nome); }
      if (s < 0) { r.dever -= s; r.nomesDever.push(G.g.dados.nome); }
    });
    return r;
  }
  async function resumoInicio() {
    const S = await saldos();
    const n = S.lista.length;
    if (!n) return 'Divida as despesas de uma viagem ou de um grupo';
    const partes = [];
    if (S.receber) partes.push(`<b class="verde">você recebe ${brl(c2v(S.receber))}</b>`);
    if (S.dever) partes.push(`<b class="vermelho">você deve ${brl(c2v(S.dever))}</b>`);
    if (!partes.length) partes.push(S.lista.some(G => G.despesas.length) ? 'tudo acertado' : 'nenhuma despesa ainda');
    if (n === 1) {
      const G = S.lista[0];
      return `${esc(G.g.dados.nome)} · ${plural(G.pessoas.length, '1 pessoa', '# pessoas')} · ${partes.join(' · ')}`;
    }
    return `${plural(n, '1 grupo', '# grupos')} · ${partes.join(' · ')}`;
  }
  /** Cartão "A receber dos grupos" (ou "A pagar nos grupos") da tela Lançamentos. */
  async function cartaoLancamentos() {
    const S = await saldos();
    let html = '';
    if (S.receber) html += `<button type="button" class="g-receber" data-acao="abrir-grupos"><span>A receber dos grupos<small>${esc(S.nomesReceber.join(', '))}</small></span><b>${brl(c2v(S.receber))}</b></button>`;
    if (S.dever) html += `<button type="button" class="g-receber deve" data-acao="abrir-grupos"><span>A pagar nos grupos<small>${esc(S.nomesDever.join(', '))}</small></span><b>${brl(c2v(S.dever))}</b></button>`;
    return html;
  }
  async function abrirLista() { await ir('grupos', {}); }
  async function abrirDoLancamento(el) {
    const grupoId = el.dataset.grupo;
    if (el.dataset.gdesp) { App().abrirVer({ tipo: 'gdesp', id: el.dataset.gdesp, grupoId }); return; } // V10: ver antes de editar
    abas[grupoId] = 'acertar';
    ir('grupo', { grupoId });
  }
  async function abrirSaldos() {
    const S = await saldos();
    const com = S.lista.filter(G => G.eu && calcular(G).por[G.eu.id].saldo !== 0);
    if (com.length === 1) { abas[com[0].g.id] = 'acertar'; ir('grupo', { grupoId: com[0].g.id }); return; }
    ir('grupos', {});
  }

  // ------------------------------------------------------------------
  //  V10: ver a despesa do grupo antes de editar (o lápis ✏️ abre o formulário)
  // ------------------------------------------------------------------
  async function htmlVer(id) {
    const G = (await grupos()).find(x => x.despesas.some(d => d.id === id));
    if (!G) return null;
    const d = G.despesas.find(x => x.id === id);
    const L = App().linhaVer;
    const partes = d.dados.partes || [];
    const porPessoa = {};
    partes.forEach((x) => { porPessoa[x.p] = x; });
    const linhas = G.pessoas.map((p) => {
      const x = porPessoa[p.id];
      const marca = x && x.t === 'meia' ? ' <span class="g-tag t-meia">meia</span>' : x && x.t === 'fixo' && d.dados.modo === 'individual' ? ' <span class="g-tag t-nome">outro</span>' : '';
      const crianca = p.dados.crianca ? ' <span class="g-tag t-nome">criança</span>' : '';
      return `<div class="ver-pes${x ? '' : ' fora'}">${avatar(G, p)}<span class="n">${esc(nomeDe(G, p.id))}${marca}${x ? '' : crianca}</span>` +
        `<span class="v">${x ? brl(x.v) : 'não participou'}</span></div>`;
    }).join('');
    const soma = partes.reduce((s2, x) => s2 + v2c(x.v), 0);
    const fecha = soma === v2c(d.dados.valor);
    const corpo = '<div class="g-conteudo ver-grupo">' +
      `<div class="ver-cab"><div><div class="t">${icone(d)} ${esc(d.dados.descricao || 'Despesa')}</div>` +
      `<div class="s">Pago por ${esc(nomeDe(G, d.dados.pagoPor))} · ${esc(dataCurta(d.dados.data))}</div></div><div class="v">${brl(d.dados.valor)}</div></div>` +
      '<div class="ver-caixa">' + L('Categoria', d.dados.categoria) + L('Forma de pagamento', d.dados.formaPagamento) +
      L('Como foi dividido', d.dados.modo === 'individual' ? 'Valor individual' : 'Igual') + L('Lançada por', primeiroNome(d.dados.lancadoPor) || '') + '</div>' +
      `<div class="ver-secao">Quem participou</div><div class="ver-caixa">${linhas}</div>` +
      `<div class="ver-caixa ver-soma"><div class="ver-item total"><div><b>Soma</b></div><b>${brl(c2v(soma))}${fecha ? ' ✓' : ''}</b></div></div>` +
      App().rodapeVer(true) + '</div>';
    return { titulo: 'Despesa do grupo', sub: G.g.dados.nome, corpo, podeEditar: true, editar: () => ir('grupo-despesa', { grupoId: G.g.id, despesaId: id }) };
  }

  // ------------------------------------------------------------------
  //  Botões
  // ------------------------------------------------------------------
  function ligar() {
    $('gr-voltar').onclick = voltar;
    $('gr-criar').onclick = criarGrupo;
    $('gr-lista').addEventListener('click', (e) => {
      const c = e.target.closest('[data-grupo]');
      if (c) ir('grupo', { grupoId: c.dataset.grupo });
    });
    $('gx-voltar').onclick = voltar;
    $('gx-config').onclick = opcoesGrupo;
    $('gx-abas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-aba]');
      if (!b) return;
      const id = dadosAtuais().grupoId;
      abas[id] = b.dataset.aba;
      renderGrupo(id);
    });
    $('tela-grupo').addEventListener('click', (e) => {
      const el = e.target.closest('[data-acao],[data-despesa],[data-pessoa],[data-pagamento]');
      if (!el) return;
      const grupoId = dadosAtuais().grupoId;
      if (el.dataset.despesa) { App().abrirVer({ tipo: 'gdesp', id: el.dataset.despesa, grupoId }); return; } // V10
      if (el.dataset.pessoa) { ir('grupo-pessoa', { grupoId, pessoaId: el.dataset.pessoa }); return; }
      if (el.dataset.pagamento) { desfazerPagamento(el.dataset.pagamento); return; }
      const acao = el.dataset.acao;
      if (acao === 'nova-despesa') {
        grupo(grupoId).then((G) => {
          if (G && G.pessoas.length < 2) { toast('Primeiro adicione as pessoas do grupo (aba Pessoas).', 4000); abas[grupoId] = 'pessoas'; renderGrupo(grupoId); return; }
          ir('grupo-despesa', { grupoId });
        });
      }
      if (acao === 'nova-pessoa') ir('grupo-pessoa', { grupoId });
      if (acao === 'relatorio') ir('grupo-relatorio', { grupoId });
      if (acao === 'quem-falta') quemFalta();
      if (acao === 'marcar-pago') marcarPago(Number(el.dataset.i));
    });
    $('gd-voltar').onclick = voltar;
    $('gd-conteudo').addEventListener('click', aoClicarDespesa);
    $('gd-conteudo').addEventListener('input', (e) => {
      if (!GD) return;
      if (e.target.id === 'gd-outro') return;
      GD.alterado = true;
      if (e.target.id === 'gd-valor') desenharDespesa();
      $('gd-erro').textContent = '';
    });
    $('gd-conteudo').addEventListener('change', () => { if (GD) GD.alterado = true; });
    $('gp-voltar').onclick = voltar;
    $('gp-conteudo').addEventListener('click', aoClicarPessoa);
    $('gp-conteudo').addEventListener('input', () => { if (GP) { GP.alterado = true; $('gp-erro').textContent = ''; } });
    $('gp-conteudo').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); salvarPessoa(); } });
    $('gl-voltar').onclick = voltar;
  }
  ligar();

  return {
    ehTela, mostrar, podeSair, aoSincronizar, ir, abrirLista, abrirDoLancamento, abrirSaldos, abaAtual,
    paraInicio, resumoInicio, cartaoLancamentos, sincronizar, pendentes, htmlVer,
    // usados nos testes
    _dividir: dividir, _calcular: calcular, _transferencias: transferencias
  };
})();
