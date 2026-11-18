// =====================================================================
//  APLICATIVO — telas e interações
// =====================================================================
(() => {
  const CATEGORIAS_PADRAO = ['Alimentação', 'Transporte', 'Hospedagem', 'Combustível', 'Passeios', 'Compras', 'Outros'];
  const MEIOS_PADRAO = ['Dinheiro', 'PIX', 'Débito', 'Crédito'];
  const NOMES_CONEXAO = { wifi: 'Wi-Fi', celular: 'dados móveis', offline: 'sem internet', desconhecida: 'conexão não identificada' };

  const $ = (id) => document.getElementById(id);
  let telaAtual = null;
  let urlsTemporarias = [];
  let promptInstalacao = null;
  let swEsperando = null;
  let pedimosAtualizacao = false;
  let agendado = null;
  let aparelhoNovo = null; // identificador criado no primeiro acesso, antes de existir perfil

  // ------------------------------------------------------------------
  //  Utilidades
  // ------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function brl(v) {
    if (v == null || v === '' || isNaN(v)) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function lerValor(t) {
    if (t == null) return null;
    let s = String(t).trim().replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : null;
  }
  function valorParaCampo(v) {
    if (v == null || isNaN(v)) return '';
    return Number(v).toFixed(2).replace('.', ',');
  }
  function paraInputLocal(ms) {
    const d = new Date(ms || Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
  function deInputLocal(v) {
    const t = v ? new Date(v).getTime() : NaN;
    return isNaN(t) ? Date.now() : t;
  }
  function hora(ms) {
    return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function chaveDia(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function rotuloDia(ms) {
    const hoje = chaveDia(Date.now());
    const ontem = chaveDia(Date.now() - 86400000);
    const k = chaveDia(ms);
    if (k === hoje) return 'Hoje';
    if (k === ontem) return 'Ontem';
    const t = new Date(ms).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function quando(ms) {
    if (!ms) return '—';
    const k = chaveDia(ms);
    if (k === chaveDia(Date.now())) return 'hoje às ' + hora(ms);
    if (k === chaveDia(Date.now() - 86400000)) return 'ontem às ' + hora(ms);
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' às ' + hora(ms);
  }
  function fmtDuracao(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function normalizarNome(n) {
    const minusculas = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return String(n || '').replace(/\s+/g, ' ').trim().split(' ').map((p, i) => {
      if (!p) return p;
      const baixo = p.toLocaleLowerCase('pt-BR');
      if (i > 0 && minusculas.includes(baixo)) return baixo;
      return p === p.toLocaleLowerCase('pt-BR') ? baixo.charAt(0).toLocaleUpperCase('pt-BR') + baixo.slice(1) : p;
    }).join(' ');
  }
  function nomeValido(n) {
    return n.length >= 4 && n.split(' ').filter(Boolean).length >= 2;
  }
  function plural(n, um, varios) {
    return n === 1 ? um : varios.replace('#', n);
  }
  function urlDe(blob) {
    const u = URL.createObjectURL(blob);
    urlsTemporarias.push(u);
    return u;
  }
  function liberarUrls() {
    urlsTemporarias.forEach(u => URL.revokeObjectURL(u));
    urlsTemporarias = [];
  }
  let toastRelogio = null;
  function toast(msg, ms = 3200) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('oculto');
    clearTimeout(toastRelogio);
    toastRelogio = setTimeout(() => t.classList.add('oculto'), ms);
  }
  function toastSalvo(msg) {
    if (Sync.conexao() === 'wifi') toast(msg + '.');
    else toast(msg + ' no celular. Para enviar, toque nas setas vermelhas lá em cima.', 5000);
  }
  function confirmar(msg, sim = 'Confirmar', nao = 'Cancelar') {
    return new Promise((ok) => {
      const raiz = $('dialogo');
      raiz.innerHTML = `<div class="fundo-dialogo"><div class="dialogo" role="dialog"><p>${esc(msg)}</p>
        <div class="botoes"><button class="botao" id="dlg-nao">${esc(nao)}</button><button class="botao primario" id="dlg-sim">${esc(sim)}</button></div></div></div>`;
      const fim = (r) => { raiz.innerHTML = ''; ok(r); };
      $('dlg-nao').onclick = () => fim(false);
      $('dlg-sim').onclick = () => fim(true);
    });
  }
  async function listas() {
    const l = await Banco.lerConfig('listas', null);
    return (l && l.categorias && l.categorias.length) ? l : { categorias: CATEGORIAS_PADRAO, meios: MEIOS_PADRAO };
  }
  function preencherSelect(sel, lista, atual, rotuloVazio) {
    const valores = lista.slice();
    if (atual && !valores.includes(atual)) valores.unshift(atual);
    sel.innerHTML = `<option value="">${esc(rotuloVazio)}</option>` +
      valores.map(v => `<option${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
  }
  function estaInstalado() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function obterLocalizacao(tempo = 15000) {
    return new Promise((ok) => {
      if (!navigator.geolocation) return ok(null);
      navigator.geolocation.getCurrentPosition(
        p => ok({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }),
        () => ok(null),
        { enableHighAccuracy: true, timeout: tempo, maximumAge: 60000 }
      );
    });
  }
  function renderGps(el, pos, tentarDeNovo) {
    if (pos) {
      el.textContent = `📍 Localização obtida (±${pos.precisao} m)`;
    } else {
      el.innerHTML = '📍 Sem localização — o lançamento será salvo assim mesmo. <button class="botao pequeno" type="button">Tentar de novo</button>';
      el.querySelector('button').onclick = tentarDeNovo;
    }
  }

  // ------------------------------------------------------------------
  //  Navegador: o app deve ser instalado pelo Google Chrome. Outros
  //  navegadores (Samsung Internet, Edge, Opera, Firefox...) geram um
  //  instalador próprio que o Play Protect bloqueia como "app de risco".
  // ------------------------------------------------------------------
  function navegadorNaoChrome() {
    const ua = navigator.userAgent || '';
    if (!/Android/i.test(ua)) return false;
    if (/SamsungBrowser|EdgA\/|OPR\/|OPX\/|Opera|Firefox\/|YaBrowser|UCBrowser|MiuiBrowser|HuaweiBrowser|HeyTapBrowser|VivoBrowser|DuckDuckGo|; wv\)/i.test(ua)) return true;
    // navegadores que se apresentam como Chrome no texto, mas dizem o próprio nome nas "marcas" (ex.: Brave)
    const uad = navigator.userAgentData;
    const marcas = (uad && Array.isArray(uad.brands)) ? uad.brands.map(b => b.brand).join(' | ') : '';
    return /Samsung|Edge|Opera|Brave|Yandex|DuckDuckGo|Vivaldi|Kiwi|Mi Browser|Huawei/i.test(marcas);
  }
  function linkAbrirNoChrome(codigo) {
    const u = new URL(location.href);
    u.hash = '';
    if (codigo) u.searchParams.set('codigo', codigo);
    const reserva = 'https://play.google.com/store/apps/details?id=com.android.chrome';
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(reserva)};end`;
  }
  function mostrarAvisoChrome() {
    return navegadorNaoChrome() && !estaInstalado();
  }

  // ------------------------------------------------------------------
  //  Navegação (o botão "voltar" do Android também funciona)
  // ------------------------------------------------------------------
  function mostrarTela(nome, { empilhar = true } = {}) {
    document.querySelectorAll('.tela').forEach(t => t.classList.add('oculto'));
    $('tela-' + nome).classList.remove('oculto');
    telaAtual = nome;
    window.scrollTo(0, 0);
    if (empilhar) history.pushState({ tela: nome }, '');
  }
  async function podeSairDaTela() {
    if (telaAtual === 'form' && Form.alterado) {
      return confirmar('Descartar as alterações deste lançamento?', 'Descartar', 'Continuar editando');
    }
    if (telaAtual === 'voz' && (Gravador.gravando() || Voz.audio)) {
      const ok = await confirmar('Descartar a gravação?', 'Descartar', 'Continuar');
      if (ok) { Gravador.cancelar(); clearInterval(Voz.relogio); Voz.audio = null; }
      return ok;
    }
    return true;
  }
  window.addEventListener('popstate', async () => {
    if (Recorte.aberto()) {
      // "voltar" com a tela de recorte aberta: só fecha o recorte
      Recorte.cancelar();
      history.pushState({ tela: telaAtual }, '');
      return;
    }
    if (telaAtual === 'inicio' || telaAtual === 'boas-vindas') return;
    if (await podeSairDaTela()) exibirInicio();
    else history.pushState({ tela: telaAtual }, '');
  });
  function voltar() {
    if (history.state && history.state.tela) history.back();
    else exibirInicio();
  }
  function concluirEVoltar() {
    Form.alterado = false;
    Voz.audio = null;
    voltar();
  }
  function exibirInicio() {
    liberarUrls();
    Form.token = null;
    Voz.token = null;
    mostrarTela('inicio', { empilhar: false });
    renderInicio();
  }

  // ------------------------------------------------------------------
  //  Conta: criar ou entrar (nome e sobrenome + senha + código do grupo)
  // ------------------------------------------------------------------
  const Conta = { modo: 'criar' };
  const INTRO = {
    novo: 'Crie sua conta ou entre, se você já tem uma.',
    migracao: 'Novidade: agora cada pessoa tem uma conta com nome e senha, para poder usar o app em outro celular. Crie a sua para continuar. Os lançamentos deste celular continuam aqui.',
    sessao: 'Sua sessão terminou. Entre de novo na sua conta.',
    saiu: 'Você saiu da conta neste celular. Entre com seu nome e senha, ou crie uma conta.'
  };

  function motivoEntrada(p) {
    if (!p) return 'novo';
    if (p.sessaoInvalida) return 'sessao';
    if (!p.contaId && (p.nome || p.registrado)) return 'migracao';
    if (p.saiuEm) return 'saiu';
    return 'novo';
  }

  function modoConta(modo) {
    Conta.modo = modo;
    const criar = modo === 'criar';
    $('bv-aba-criar').classList.toggle('ativa', criar);
    $('bv-aba-entrar').classList.toggle('ativa', !criar);
    $('bv-aba-criar').setAttribute('aria-selected', String(criar));
    $('bv-aba-entrar').setAttribute('aria-selected', String(!criar));
    $('bv-bloco-confirma').classList.toggle('oculto', !criar);
    $('bv-senha').setAttribute('autocomplete', criar ? 'new-password' : 'current-password');
    $('bv-senha').placeholder = criar ? 'Mínimo 4 dígitos ou letras' : 'Sua senha';
    $('bv-comecar').textContent = criar ? 'Criar conta' : 'Entrar';
    $('bv-dica').textContent = criar
      ? 'Guarde o nome e a senha: com eles você entra na sua conta em qualquer celular.'
      : 'Esqueceu a senha? Peça ao organizador para definir uma nova.';
    $('bv-erro').textContent = '';
  }
  $('bv-aba-criar').onclick = () => modoConta('criar');
  $('bv-aba-entrar').onclick = () => modoConta('entrar');
  $('bv-mostrar').onchange = () => {
    const tipo = $('bv-mostrar').checked ? 'text' : 'password';
    $('bv-senha').type = tipo;
    $('bv-senha2').type = tipo;
  };
  $('bv-codigo').addEventListener('input', () => renderAvisoChromeBoasVindas());
  ['bv-nome', 'bv-senha', 'bv-senha2', 'bv-codigo'].forEach(id => {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('bv-comecar').click(); } });
  });

  function avisoChromeHtml(codigo, classe) {
    return `<div class="${classe}"><span><b>Use o Google Chrome.</b> Instalado por este navegador, o app é bloqueado pelo Play Protect como “app de risco”. Pelo Chrome ele instala sem esse aviso.</span>` +
      `<a class="botao pequeno" href="${esc(linkAbrirNoChrome(codigo))}">Abrir no Chrome</a></div>`;
  }
  function renderAvisoChromeBoasVindas() {
    $('bv-chrome').innerHTML = mostrarAvisoChrome() ? avisoChromeHtml($('bv-codigo').value.trim(), 'aviso-chrome') : '';
  }

  async function iniciarBoasVindas(motivo = 'novo') {
    const p = await Perfil.obter();
    const params = new URLSearchParams(location.search);
    $('bv-intro').textContent = INTRO[motivo] || INTRO.novo;
    $('bv-nome').value = motivo === 'migracao' ? (p.nomeServidor || p.nome || '') : motivo === 'sessao' ? (p.nome || '') : '';
    $('bv-senha').value = '';
    $('bv-senha2').value = '';
    $('bv-mostrar').checked = false;
    $('bv-senha').type = 'password';
    $('bv-senha2').type = 'password';
    $('bv-codigo').value = params.get('codigo') || (p && p.codigo) || '';
    modoConta(motivo === 'sessao' || motivo === 'saiu' ? 'entrar' : 'criar');
    renderAvisoChromeBoasVindas();
    mostrarTela('boas-vindas', { empilhar: false });
  }

  function mensagemErroConta(e) {
    if (e instanceof Api.ErroRede) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
    if (e.codigo === 'codigo_invalido') return 'Código do grupo inválido. Confira com o organizador.';
    if (e.codigo === 'senha_incorreta') return 'Senha incorreta. Se esqueceu, peça ao organizador para definir uma nova senha.';
    if (e.codigo === 'acao_desconhecida') return 'O servidor ainda está na versão antiga. Avise o organizador para atualizar o código no Apps Script.';
    return e.message;
  }

  $('bv-comecar').onclick = async () => {
    const criar = Conta.modo === 'criar';
    const nome = normalizarNome($('bv-nome').value);
    const senha = $('bv-senha').value;
    const codigo = $('bv-codigo').value.trim();
    const erro = (m) => { $('bv-erro').textContent = m; };
    erro('');
    if (!nomeValido(nome)) return erro(criar ? 'Informe nome e sobrenome.' : 'Informe o nome e sobrenome da sua conta.');
    if (senha.length < 4) return erro(criar ? 'A senha precisa ter pelo menos 4 caracteres.' : 'Digite sua senha.');
    if (criar && senha !== $('bv-senha2').value) return erro('As duas senhas não estão iguais.');
    if (!codigo) return erro('Informe o código do grupo.');
    if (!Api.urlConfigurada()) return erro('O app ainda não tem o endereço do servidor. Avise o organizador (arquivo config.js).');
    if (!navigator.onLine) return erro('Sem internet. Para criar a conta ou entrar, o celular precisa estar conectado.');

    const anterior = await Perfil.obter();
    const aparelhoId = (anterior && anterior.aparelhoId) || aparelhoNovo || (aparelhoNovo = novoId());
    const temp = { aparelhoId, codigo };
    const botao = $('bv-comecar');
    botao.disabled = true;
    botao.textContent = criar ? 'Criando a conta…' : 'Entrando…';
    try {
      const r = await Api.chamar(criar ? 'criarConta' : 'entrar', { nome, senha, aparelho: await Aparelho.info() }, { perfil: temp, tempoMs: 30000 });
      await concluirEntrada(r, anterior, temp);
    } catch (e) {
      erro(mensagemErroConta(e));
    } finally {
      botao.disabled = false;
      botao.textContent = criar ? 'Criar conta' : 'Entrar';
    }
  };

  async function limparDadosLocais() {
    await Banco.limpar('lancamentos');
    await Banco.limpar('arquivos');
    for (const k of ['desde', 'ultimaSync', 'ultimoErro', 'iaLimite']) await Banco.apagar('config', k);
  }

  async function concluirEntrada(r, anterior, temp) {
    const contaAnterior = anterior && anterior.contaId;
    if (contaAnterior && contaAnterior !== r.conta.id) {
      // outra pessoa entrando neste celular: os dados da conta anterior saem daqui (continuam no servidor)
      const n = await Sync.pendentes();
      if (n > 0) {
        const ok = await confirmar(
          `Este celular tem ${plural(n, '1 lançamento', '# lançamentos')} de ${anterior.nome || 'outra conta'} ainda não ${plural(n, 'enviado', 'enviados')}. ` +
          `Entrando com outra conta, ${plural(n, 'ele será apagado', 'eles serão apagados')} deste celular.`, 'Apagar e entrar', 'Cancelar');
        if (!ok) {
          try { await Api.chamar('sair', {}, { perfil: Object.assign({}, temp, { token: r.token }), tempoMs: 8000 }); } catch (e) { /* sem problema */ }
          return;
        }
      }
      await limparDadosLocais();
    }
    await Perfil.salvar({
      aparelhoId: temp.aparelhoId, codigo: temp.codigo, token: r.token, contaId: r.conta.id, nome: r.conta.nome,
      criadoEm: (anterior && anterior.criadoEm) || Date.now(), entrouEm: Date.now()
    });
    if (r.listas && r.listas.categorias && r.listas.categorias.length) await Banco.gravarConfig('listas', r.listas);
    await Banco.gravarConfig('desde', 0);
    await Banco.apagar('config', 'ultimoErro');
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* opcional */ }
    exibirInicio();
    toast(`Olá, ${r.conta.nome.split(' ')[0]}!`);
    // traz o histórico da conta (no Wi-Fi também envia o que estiver pendente neste celular)
    Sync.sincronizar(Sync.conexao() === 'wifi' ? {} : { somenteBaixar: true });
  }

  // ------------------------------------------------------------------
  //  Tela inicial
  // ------------------------------------------------------------------
  function cartao(l, anexos) {
    const fotos = anexos.filter(a => a.tipo === 'foto').length;
    const temAudio = l.origem === 'voz';
    let desc = l.descricao || (l.itens && l.itens.length ? l.itens.map(i => i.nome).filter(Boolean).join(', ') : '');
    if (!desc) {
      desc = l.status === 'aguardando_ia' ? 'Áudio aguardando interpretação'
        : l.status === 'erro_ia' ? 'Áudio não interpretado' : (l.categoria || 'Lançamento');
    }
    const meta = [hora(l.dataHora), l.categoria, l.meioPagamento].filter(Boolean).join(' · ');
    const selos = [];
    if (l.status === 'revisar') selos.push('<span class="selo revisar">Revisar</span>');
    if (l.status === 'aguardando_ia') selos.push('<span class="selo aguardando">Aguardando IA</span>');
    if (l.status === 'erro_ia') selos.push('<span class="selo erro">Preencher</span>');
    if (l.sync === 'pendente' || anexos.some(a => !a.enviado && a.blob)) selos.push('<span class="selo fila">Na fila</span>');
    const icones = (fotos ? `📷${fotos > 1 ? fotos : ''} ` : '') + (temAudio ? '🎤 ' : '') + (l.lat != null ? '📍' : '');
    return `<div class="cartao" data-id="${esc(l.id)}">
      <div><div class="desc">${esc(desc)}</div><div class="meta">${esc(meta)} ${icones}</div></div>
      <div class="direita"><span class="valor">${l.valorTotal != null ? brl(l.valorTotal) : '—'}</span>${selos.join('')}</div>
    </div>`;
  }

  function alerta(cor, texto, botao, acao) {
    return `<div class="alerta-caixa ${cor}"><span>${esc(texto)}</span>${botao ? `<button class="botao pequeno" data-acao="${acao}">${esc(botao)}</button>` : ''}</div>`;
  }

  async function renderInicio() {
    const perfil = await Perfil.obter();
    if (!perfil || !perfil.token) { iniciarBoasVindas(motivoEntrada(perfil)); return; }
    $('ini-nome').textContent = 'Olá, ' + perfil.nome;
    const lancs = (await Banco.todos('lancamentos'))
      .filter(l => !l.excluirPendente)
      .sort((a, b) => (b.dataHora || 0) - (a.dataHora || 0));
    const porLanc = {};
    (await Banco.todos('arquivos')).forEach(a => {
      if (!a.remover) (porLanc[a.lancamentoId] = porLanc[a.lancamentoId] || []).push(a);
    });

    const hoje = chaveDia(Date.now());
    const comValor = lancs.filter(l => l.valorTotal != null);
    const totalHoje = comValor.filter(l => chaveDia(l.dataHora) === hoje).reduce((s, l) => s + Number(l.valorTotal), 0);
    const total = comValor.reduce((s, l) => s + Number(l.valorTotal), 0);
    $('totais').innerHTML = `<div><small>Hoje</small><b>${brl(totalHoje)}</b></div><div><small>Total lançado</small><b>${brl(total)}</b></div>`;

    if (!lancs.length) {
      $('lista').innerHTML = '<div class="vazio">Nenhum lançamento ainda.<br>Use os botões acima para lançar seu primeiro gasto.</div>';
    } else {
      let html = '';
      let diaAtual = '';
      lancs.forEach(l => {
        const k = chaveDia(l.dataHora);
        if (k !== diaAtual) { diaAtual = k; html += `<div class="dia">${esc(rotuloDia(l.dataHora))}</div>`; }
        html += cartao(l, porLanc[l.id] || []);
      });
      $('lista').innerHTML = html;
    }
    await renderAlertas(lancs, perfil);
    await atualizarIconeSync();
  }

  async function renderAlertas(lancs, perfil) {
    const html = [];
    if (!Api.urlConfigurada()) html.push(alerta('vermelho', 'O app ainda não tem o endereço do servidor. Avise o organizador (arquivo config.js).'));
    if (perfil.codigoInvalido) html.push(alerta('vermelho', 'Código do grupo inválido. Corrija nas configurações.', 'Corrigir', 'abrir-config'));
    if (swEsperando) html.push(alerta('azul', 'Há uma nova versão do app.', 'Atualizar', 'atualizar-app'));
    const revisar = lancs.filter(l => l.status === 'revisar').length;
    if (revisar) {
      html.push(alerta('azul', revisar === 1 ? '1 áudio foi interpretado e está pronto para revisar.'
        : `${revisar} áudios foram interpretados e estão prontos para revisar.`, 'Revisar', 'revisar'));
    }
    const erros = lancs.filter(l => l.status === 'erro_ia').length;
    if (erros) {
      html.push(alerta('vermelho', erros === 1 ? 'A IA não conseguiu interpretar 1 áudio. Preencha você mesmo.'
        : `A IA não conseguiu interpretar ${erros} áudios. Preencha você mesmo.`, 'Ver', 'erro-ia'));
    }
    const aguardando = lancs.filter(l => l.status === 'aguardando_ia').length;
    const limite = await Banco.lerConfig('iaLimite', null);
    if (aguardando && limite && Date.now() - limite < 6 * 3600 * 1000) {
      html.push(alerta('laranja', 'O limite gratuito da IA foi atingido. Os áudios serão interpretados automaticamente mais tarde.'));
    }
    if (mostrarAvisoChrome()) {
      // no Chrome a pessoa entra com o mesmo nome e senha; antes disso, o que está pendente precisa ser enviado
      const n = await Sync.pendentes();
      html.push(`<div class="alerta-caixa laranja coluna"><span><b>Para instalar o app, use o Google Chrome.</b> Por este navegador o Android bloqueia a instalação (“app de risco”, Play Protect). ` +
        `No Chrome, entre com o mesmo nome e senha.${n ? ' Antes, toque nas setas lá em cima para enviar seus lançamentos.' : ''}</span>` +
        `<a class="botao pequeno" href="${esc(linkAbrirNoChrome(perfil.codigo))}">Abrir no Chrome</a></div>`);
    } else if (promptInstalacao && !estaInstalado()) {
      html.push(alerta('azul', 'Instale o app na tela inicial do celular.', 'Instalar', 'instalar'));
    }
    $('alertas').innerHTML = html.join('');
  }

  // ---- ícone de sincronização no topo: vermelho = falta enviar, amarelo = enviando, verde = tudo certo
  let rotuloRelogio = null;
  function rotulo(texto, cor, ms) {
    const el = $('sync-rotulo');
    clearTimeout(rotuloRelogio);
    if (!texto) { el.classList.add('oculto'); return; }
    el.textContent = texto;
    el.className = 'sync-rotulo ' + (cor || '');
    if (ms) rotuloRelogio = setTimeout(() => el.classList.add('oculto'), ms);
  }

  async function atualizarIconeSync() {
    const btn = $('btn-sync');
    let estado = 'ok';
    let titulo = 'Tudo sincronizado';
    let n = 0;
    if (Sync.estaRodando()) {
      estado = 'sincronizando';
      titulo = 'Sincronizando…';
    } else {
      n = await Sync.pendentes();
      const ultima = await Banco.lerConfig('ultimaSync', 0);
      const erro = await Banco.lerConfig('ultimoErro', null);
      const falhou = !!(erro && erro.quando && erro.quando >= (ultima || 0));
      if (Sync.estaRodando()) {
        estado = 'sincronizando';
        titulo = 'Sincronizando…';
      } else if (n > 0) {
        estado = 'pendente';
        titulo = plural(n, '1 lançamento aguardando envio', '# lançamentos aguardando envio') + '. Toque para sincronizar.';
      } else if (falhou || !ultima) {
        estado = 'pendente';
        titulo = falhou ? 'A última sincronização não deu certo. Toque para tentar de novo.' : 'Toque para sincronizar.';
      }
    }
    btn.classList.remove('ok', 'pendente', 'sincronizando');
    btn.classList.add(estado);
    btn.title = titulo;
    btn.setAttribute('aria-label', titulo);
    const cont = $('sync-contador');
    cont.textContent = n > 9 ? '9+' : String(n);
    cont.classList.toggle('oculto', !(estado === 'pendente' && n > 0));
    // "Sincronizado" não pode continuar aparecendo se já há algo novo para enviar
    const r = $('sync-rotulo');
    if (estado !== 'ok' && r.classList.contains('verde') && !r.classList.contains('oculto')) rotulo('');
  }

  $('lista').addEventListener('click', (e) => {
    const c = e.target.closest('.cartao');
    if (c) abrirLancamento(c.dataset.id);
  });

  $('alertas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'abrir-config') abrirConfig();
    if (acao === 'atualizar-app' && swEsperando) { pedimosAtualizacao = true; swEsperando.postMessage('atualizar'); }
    if (acao === 'revisar' || acao === 'erro-ia') {
      const alvo = acao === 'revisar' ? 'revisar' : 'erro_ia';
      const l = (await Banco.todos('lancamentos'))
        .filter(x => x.status === alvo && !x.excluirPendente)
        .sort((a, b) => (a.dataHora || 0) - (b.dataHora || 0))[0];
      if (l) abrirLancamento(l.id);
    }
    if (acao === 'instalar' && promptInstalacao) {
      promptInstalacao.prompt();
      try { await promptInstalacao.userChoice; } catch (x) { /* ignora */ }
      promptInstalacao = null;
      renderInicio();
    }
  });

  $('btn-sync').onclick = () => {
    if (Sync.estaRodando()) { rotulo('Sincronizando…', 'amarelo'); return; }
    Sync.sincronizar({ manual: true });
  };
  $('btn-voz').onclick = () => abrirVoz();
  $('btn-texto').onclick = () => abrirNovoTexto();
  $('ini-config').onclick = () => abrirConfig();

  // ------------------------------------------------------------------
  //  Formulário: novo, editar e revisar
  // ------------------------------------------------------------------
  const Form = { modo: 'novo', l: null, fotosNovas: [], removerIds: [], gps: null, alterado: false, token: null };

  async function abrirNovoTexto() {
    const agora = Date.now();
    Form.modo = 'novo';
    Form.l = {
      id: novoId(), origem: 'texto', status: 'confirmado', dataHora: agora, criadoEm: agora, itens: [],
      valorTotal: null, categoria: '', meioPagamento: '', banco: '', titular: '', estabelecimento: '', descricao: '',
      lat: null, lng: null, precisao: null, versaoBase: 0
    };
    Form.fotosNovas = [];
    Form.removerIds = [];
    Form.gps = null;
    Form.alterado = false;
    Form.token = novoId();
    await preencherForm();
    mostrarTela('form');
    capturarGpsForm(Form.token);
  }

  function capturarGpsForm(token) {
    const el = $('f-gps');
    el.textContent = '📍 Obtendo localização…';
    obterLocalizacao().then(pos => {
      if (Form.token !== token) return;
      Form.gps = pos;
      renderGps(el, pos, () => capturarGpsForm(token));
    });
  }

  async function abrirLancamento(id) {
    const l = await Banco.obter('lancamentos', id);
    if (!l) return;
    Form.modo = (l.status === 'revisar' || l.status === 'erro_ia') ? 'revisar' : 'editar';
    Form.l = JSON.parse(JSON.stringify(l));
    Form.fotosNovas = [];
    Form.removerIds = [];
    Form.gps = null;
    Form.alterado = false;
    Form.token = novoId();
    await preencherForm();
    mostrarTela('form');
  }

  async function preencherForm() {
    const l = Form.l;
    const L = await listas();
    $('form-titulo').textContent = Form.modo === 'novo' ? 'Novo lançamento' : Form.modo === 'revisar' ? 'Revisar lançamento' : 'Editar lançamento';
    $('f-data').value = paraInputLocal(l.dataHora);
    $('f-desc').value = l.descricao || '';
    $('f-valor').value = l.valorTotal != null ? valorParaCampo(l.valorTotal) : '';
    preencherSelect($('f-cat'), L.categorias, l.categoria, 'Escolha a categoria');
    preencherSelect($('f-meio'), L.meios, l.meioPagamento, 'Não informado');
    $('f-banco').value = l.banco || '';
    $('f-titular').value = l.titular || '';
    $('f-estab').value = l.estabelecimento || '';
    $('f-itens').innerHTML = '';
    (l.itens || []).forEach(i => addItem(i.nome, i.valor));
    atualizarSoma();
    await renderCaixaIA();
    await renderFotosForm();
    if (Form.modo !== 'novo') {
      $('f-gps').textContent = l.lat != null
        ? '📍 ' + (l.endereco || `Localização registrada (±${l.precisao || '?'} m)`)
        : '📍 Sem localização registrada.';
    }
    $('form-salvar').textContent = Form.modo === 'revisar' ? 'Confirmar' : 'Salvar';
    $('form-excluir').classList.toggle('oculto', Form.modo === 'novo');
  }

  async function renderCaixaIA() {
    const l = Form.l;
    const el = $('form-ia');
    if (l.origem !== 'voz') { el.innerHTML = ''; return; }
    const audio = (await Banco.porIndice('arquivos', 'lancamentoId', l.id)).find(a => a.tipo === 'audio');
    const player = audio && audio.blob
      ? `<audio controls src="${urlDe(audio.blob)}"></audio>`
      : '<div class="dica">O áudio está guardado no Drive do organizador.</div>';
    let classe = '';
    let msg = '';
    if (l.status === 'aguardando_ia') {
      classe = 'laranja';
      msg = '<b>Aguardando a IA.</b> O áudio é interpretado quando for enviado (no Wi-Fi ou pelas setas lá em cima). Se preferir, preencha você mesmo: com valor e categoria preenchidos, o lançamento fica confirmado.';
    } else if (l.status === 'revisar') {
      msg = '<b>A IA preencheu os campos abaixo.</b> Confira, corrija se precisar e toque em Confirmar.';
    } else if (l.status === 'erro_ia') {
      classe = 'vermelho';
      msg = '<b>A IA não conseguiu interpretar este áudio.</b> Ouça e preencha os campos abaixo.';
    } else {
      msg = '<b>Lançamento feito por voz.</b>';
    }
    const transc = l.transcricao ? `<div class="transcricao">“${esc(l.transcricao)}”</div>` : '';
    const obs = l.observacaoIA ? `<div class="dica">${esc(l.observacaoIA)}</div>` : '';
    el.innerHTML = `<div class="caixa-ia ${classe}">${msg}${transc}${obs}${player}</div>`;
  }

  function addItem(nome = '', valor = null) {
    const div = document.createElement('div');
    div.className = 'item-linha';
    div.innerHTML = `<input placeholder="Item" value="${esc(nome)}"><input placeholder="Valor" inputmode="decimal" value="${valor != null ? esc(valorParaCampo(valor)) : ''}"><button type="button" aria-label="Remover item">✕</button>`;
    div.querySelector('button').onclick = () => { div.remove(); Form.alterado = true; atualizarSoma(); };
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', atualizarSoma));
    $('f-itens').appendChild(div);
  }
  function lerItensForm() {
    return Array.from($('f-itens').querySelectorAll('.item-linha')).map(d => {
      const campos = d.querySelectorAll('input');
      return { nome: campos[0].value.trim(), valor: lerValor(campos[1].value) };
    }).filter(i => i.nome || i.valor != null);
  }
  function atualizarSoma() {
    const it = lerItensForm();
    const soma = it.reduce((s, i) => s + (i.valor || 0), 0);
    $('f-soma').textContent = it.some(i => i.valor != null)
      ? `Soma dos itens: ${brl(soma)}${$('f-valor').value.trim() ? '' : ' (será usada como total)'}`
      : '';
  }
  $('f-add-item').onclick = () => { addItem(); Form.alterado = true; };
  $('f-valor').addEventListener('input', atualizarSoma);
  // (escolher foto não conta como alteração sozinho: só se a pessoa usar a foto no recorte)
  $('tela-form').addEventListener('input', (e) => { if (e.target.type !== 'file') Form.alterado = true; });
  $('tela-form').addEventListener('change', (e) => { if (e.target.type !== 'file') Form.alterado = true; });

  function miniatura(blob, chave) {
    const conteudo = blob ? `<img src="${urlDe(blob)}" alt="foto">` : '<div class="sem-arquivo">Foto guardada no Drive</div>';
    return `<div class="foto">${conteudo}<button class="remover" type="button" data-remover="${esc(chave)}" aria-label="Remover foto">✕</button></div>`;
  }
  async function renderFotosForm() {
    const existentes = Form.modo === 'novo' ? [] : (await Banco.porIndice('arquivos', 'lancamentoId', Form.l.id))
      .filter(a => a.tipo === 'foto' && !a.remover && !Form.removerIds.includes(a.id));
    const html = existentes.map(a => miniatura(a.blob, 'e:' + a.id)).concat(Form.fotosNovas.map(f => miniatura(f.blob, 'n:' + f.id)));
    $('f-fotos').innerHTML = html.join('') || '<small class="dica">Nenhuma foto.</small>';
  }
  $('f-fotos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remover]');
    if (!b) return;
    const [tipo, id] = b.dataset.remover.split(/:(.+)/);
    if (tipo === 'e') Form.removerIds.push(id);
    else Form.fotosNovas = Form.fotosNovas.filter(f => f.id !== id);
    Form.alterado = true;
    renderFotosForm();
  });

  /** Abre a tela de recorte para cada foto escolhida; guarda as que a pessoa usar. */
  async function adicionarFotos(input, destino) {
    const arquivos = Array.from(input.files || []);
    input.value = '';
    let n = 0;
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const blob = await Recorte.abrir(arquivos[i], { titulo: arquivos.length > 1 ? `Foto ${i + 1} de ${arquivos.length}` : '' });
        if (blob === undefined) break; // "voltar" do Android: desiste das fotos restantes
        if (blob) { destino.push({ id: novoId(), blob }); n++; }
      } catch (e) {
        toast('Não foi possível usar uma das fotos: ' + e.message, 4500);
      }
    }
    return n;
  }
  const aoEscolherFotoForm = async (e) => {
    if (await adicionarFotos(e.target, Form.fotosNovas)) { Form.alterado = true; renderFotosForm(); }
  };
  $('f-camera').onchange = aoEscolherFotoForm;
  $('f-galeria').onchange = aoEscolherFotoForm;

  async function salvarForm() {
    const l = Form.l;
    const itens = lerItensForm();
    let valor = lerValor($('f-valor').value);
    if (valor == null && itens.some(i => i.valor != null)) {
      valor = Math.round(itens.reduce((s, i) => s + (i.valor || 0), 0) * 100) / 100;
    }
    const categoria = $('f-cat').value;
    const aguardandoIA = l.status === 'aguardando_ia';
    const completo = valor != null && valor > 0 && !!categoria;
    if (!aguardandoIA && !completo) {
      toast(valor == null || valor <= 0 ? 'Informe o valor.' : 'Escolha a categoria.');
      return;
    }
    let descricao = $('f-desc').value.trim();
    if (!descricao && itens.length) descricao = itens.map(i => i.nome).filter(Boolean).join(', ');
    Object.assign(l, {
      dataHora: deInputLocal($('f-data').value),
      descricao,
      itens,
      valorTotal: valor,
      categoria,
      meioPagamento: $('f-meio').value,
      banco: $('f-banco').value.trim(),
      titular: $('f-titular').value.trim(),
      estabelecimento: $('f-estab').value.trim()
    });
    if (Form.modo === 'revisar' || (aguardandoIA && completo)) l.status = 'confirmado';
    if (Form.modo === 'novo' && Form.gps) Object.assign(l, Form.gps);
    l.alteradoEm = Date.now();
    l.sync = 'pendente';

    const botao = $('form-salvar');
    botao.disabled = true;
    try {
      // pega o estado mais recente salvo no aparelho (a sincronização pode ter atualizado algo)
      const salvo = await Banco.obter('lancamentos', l.id);
      if (salvo) {
        ['versaoBase', 'tentouEnviar', 'endereco', 'participante', 'transcricao', 'observacaoIA', 'qtdFotos', 'temAudio'].forEach(k => {
          if (salvo[k] !== undefined) l[k] = salvo[k];
        });
      }
      await Banco.gravar('lancamentos', l);
      for (const f of Form.fotosNovas) {
        await Banco.gravar('arquivos', {
          id: f.id, lancamentoId: l.id, tipo: 'foto', mime: 'image/jpeg', blob: f.blob,
          tamanho: f.blob.size, criadoEm: Date.now(), enviado: false
        });
      }
      for (const id of Form.removerIds) {
        const a = await Banco.obter('arquivos', id);
        if (!a) continue;
        if (a.enviado) { a.remover = true; await Banco.gravar('arquivos', a); }
        else await Banco.apagar('arquivos', id);
      }
    } catch (e) {
      toast('Não foi possível salvar no aparelho: ' + e.message, 5000);
      return;
    } finally {
      botao.disabled = false;
    }
    toastSalvo(Form.modo === 'revisar' ? 'Lançamento confirmado' : 'Lançamento salvo');
    concluirEVoltar();
    agendarSync(800);
  }
  $('form-salvar').onclick = salvarForm;

  $('form-excluir').onclick = async () => {
    if (!await confirmar('Excluir este lançamento?', 'Excluir', 'Cancelar')) return;
    const l = await Banco.obter('lancamentos', Form.l.id);
    let precisaEnviar = false;
    if (l) {
      if (!l.tentouEnviar && !l.versaoBase) {
        await Sync.apagarLocal(l.id); // nunca foi enviado: basta apagar daqui
      } else {
        l.excluirPendente = true;
        l.alteradoEm = Date.now();
        await Banco.gravar('lancamentos', l);
        precisaEnviar = true;
      }
    }
    if (precisaEnviar) toastSalvo('Lançamento excluído');
    else toast('Lançamento excluído.');
    concluirEVoltar();
    agendarSync(800);
  };
  $('form-voltar').onclick = () => voltar();

  // ------------------------------------------------------------------
  //  Lançamento por voz
  // ------------------------------------------------------------------
  const Voz = { audio: null, duracao: 0, fotos: [], gps: null, relogio: null, token: null };

  function abrirVoz() {
    if (!Gravador.suportado()) { toast('Este navegador não permite gravar áudio. Use o Chrome.', 4500); return; }
    Voz.audio = null;
    Voz.fotos = [];
    Voz.gps = null;
    Voz.token = novoId();
    $('voz-previa').classList.add('oculto');
    $('voz-salvar').disabled = true;
    $('voz-tempo').textContent = 'Toque para gravar';
    $('voz-mic').classList.remove('gravando');
    $('voz-mic').textContent = '🎤';
    renderFotosVoz();
    mostrarTela('voz');
    capturarGpsVoz(Voz.token);
  }

  function capturarGpsVoz(token) {
    const el = $('voz-gps');
    el.textContent = '📍 Obtendo localização…';
    obterLocalizacao().then(pos => {
      if (Voz.token !== token) return;
      Voz.gps = pos;
      renderGps(el, pos, () => capturarGpsVoz(token));
    });
  }

  function atualizarTempo() {
    $('voz-tempo').textContent = `Gravando… ${fmtDuracao(Gravador.segundos())} — toque para parar`;
  }

  $('voz-mic').onclick = async () => {
    if (Gravador.gravando()) { await pararGravacao(); return; }
    if (Voz.audio && !await confirmar('Gravar de novo? O áudio atual será descartado.', 'Gravar de novo', 'Cancelar')) return;
    try {
      await Gravador.iniciar();
    } catch (e) {
      toast(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para gravar.' : 'Não foi possível usar o microfone: ' + (e && e.message), 4500);
      return;
    }
    Voz.audio = null;
    $('voz-previa').classList.add('oculto');
    $('voz-salvar').disabled = true;
    $('voz-mic').classList.add('gravando');
    $('voz-mic').textContent = '⏹';
    atualizarTempo();
    Voz.relogio = setInterval(atualizarTempo, 500);
  };

  async function pararGravacao() {
    clearInterval(Voz.relogio);
    const r = await Gravador.parar();
    $('voz-mic').classList.remove('gravando');
    $('voz-mic').textContent = '🎤';
    if (!r) { $('voz-tempo').textContent = 'Nada foi gravado. Toque para tentar de novo.'; return; }
    Voz.audio = r.blob;
    Voz.duracao = r.duracao;
    $('voz-tempo').textContent = `Áudio de ${fmtDuracao(r.duracao)} gravado`;
    $('voz-audio').src = urlDe(r.blob);
    $('voz-previa').classList.remove('oculto');
    $('voz-salvar').disabled = false;
  }
  $('voz-regravar').onclick = () => $('voz-mic').click();

  function renderFotosVoz() {
    $('voz-fotos').innerHTML = Voz.fotos.map(f => miniatura(f.blob, 'n:' + f.id)).join('') || '<small class="dica">Nenhuma foto.</small>';
  }
  $('voz-fotos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remover]');
    if (!b) return;
    const id = b.dataset.remover.split(/:(.+)/)[1];
    Voz.fotos = Voz.fotos.filter(f => f.id !== id);
    renderFotosVoz();
  });
  const aoEscolherFotoVoz = async (e) => { if (await adicionarFotos(e.target, Voz.fotos)) renderFotosVoz(); };
  $('voz-camera').onchange = aoEscolherFotoVoz;
  $('voz-galeria').onchange = aoEscolherFotoVoz;

  $('voz-salvar').onclick = async () => {
    if (Gravador.gravando()) await pararGravacao();
    if (!Voz.audio) return;
    const agora = Date.now();
    const gps = Voz.gps || {};
    const l = {
      id: novoId(), origem: 'voz', status: 'aguardando_ia', dataHora: agora, criadoEm: agora, alteradoEm: agora,
      descricao: '', itens: [], valorTotal: null, categoria: '', meioPagamento: '', banco: '', titular: '', estabelecimento: '',
      lat: gps.lat != null ? gps.lat : null, lng: gps.lng != null ? gps.lng : null, precisao: gps.precisao != null ? gps.precisao : null,
      sync: 'pendente', versaoBase: 0
    };
    $('voz-salvar').disabled = true;
    try {
      await Banco.gravar('lancamentos', l);
      await Banco.gravar('arquivos', {
        id: novoId(), lancamentoId: l.id, tipo: 'audio', mime: Voz.audio.type || 'audio/webm', blob: Voz.audio,
        tamanho: Voz.audio.size, duracao: Voz.duracao, criadoEm: agora, enviado: false
      });
      for (const f of Voz.fotos) {
        await Banco.gravar('arquivos', {
          id: f.id, lancamentoId: l.id, tipo: 'foto', mime: 'image/jpeg', blob: f.blob,
          tamanho: f.blob.size, criadoEm: agora, enviado: false
        });
      }
    } catch (e) {
      toast('Não foi possível salvar no aparelho: ' + e.message, 5000);
      $('voz-salvar').disabled = false;
      return;
    }
    toast(Sync.conexao() === 'wifi'
      ? 'Áudio salvo. Enviando para a IA…'
      : 'Áudio salvo no celular. Para enviar à IA, toque nas setas vermelhas lá em cima (no Wi-Fi é automático).', 5000);
    concluirEVoltar();
    agendarSync(500);
  };
  $('voz-voltar').onclick = () => voltar();

  // ------------------------------------------------------------------
  //  Configurações
  // ------------------------------------------------------------------
  async function abrirConfig() {
    const p = await Perfil.obter();
    if (!p || !p.token) { iniciarBoasVindas(motivoEntrada(p)); return; }
    $('cfg-conta').innerHTML = `<b>${esc(p.nome)}</b><small>Conta conectada neste celular</small>`;
    $('cfg-codigo').value = p.codigo;
    mostrarTela('config');
    await renderInfo();
  }

  async function renderInfo() {
    const p = await Perfil.obter();
    if (!p) return;
    const ultima = await Banco.lerConfig('ultimaSync', null);
    const erro = await Banco.lerConfig('ultimoErro', null);
    let armazenamento = '—';
    try {
      const e = await navigator.storage.estimate();
      armazenamento = `${(e.usage / 1048576).toFixed(1)} MB usados`;
      if (navigator.storage.persisted && await navigator.storage.persisted()) armazenamento += ' (protegido)';
    } catch (x) { /* opcional */ }
    const itens = [
      ['Aparelho', p.aparelhoId.slice(0, 8)],
      ['Versão do app', VERSAO_DO_APP],
      ['Conexão', NOMES_CONEXAO[Sync.conexao()]],
      ['Aguardando envio', String(await Sync.pendentes())],
      ['Última sincronização', ultima ? quando(ultima) : 'nunca'],
      ['Armazenamento', armazenamento],
      ['Último erro', erro && erro.mensagem ? `${quando(erro.quando)}: ${erro.mensagem}` : 'nenhum']
    ];
    $('cfg-info').innerHTML = itens.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }

  $('cfg-salvar').onclick = async () => {
    const codigo = $('cfg-codigo').value.trim();
    if (!codigo) { toast('Informe o código do grupo.'); return; }
    const p = await Perfil.obter();
    if (codigo === p.codigo && !p.codigoInvalido) { toast('Nada mudou.'); return; }
    p.codigo = codigo;
    p.codigoInvalido = false;
    await Perfil.salvar(p);
    if (Sync.conexao() === 'offline') { toast('Código salvo. Ele será conferido quando houver internet.'); return; }
    toast('Conferindo o código…', 2000);
    const r = await Sync.sincronizar({ somenteBaixar: true });
    const atual = await Perfil.obter();
    if (atual && atual.codigoInvalido) toast('Código do grupo inválido. Confira com o organizador.', 4500);
    else if (r && !r.erro && !r.ignorado) toast('Código salvo e conferido.');
    else if (r && r.ignorado) toast('Código salvo.');
    renderInfo();
  };
  $('cfg-sync').onclick = async () => {
    await Sync.sincronizar({ manual: true });
    if (telaAtual === 'config') renderInfo();
  };
  $('cfg-atualizar').onclick = async () => {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { toast('Não foi possível verificar agora.'); return; }
    toast('Procurando atualização…');
    try { await reg.update(); } catch (e) { toast('Sem conexão para verificar.'); return; }
    setTimeout(() => toast(swEsperando || reg.waiting || reg.installing ? 'Nova versão encontrada: veja o aviso na tela inicial.' : 'O app já está na versão mais recente.'), 2500);
  };
  $('cfg-sair').onclick = async () => {
    const n = await Sync.pendentes();
    const msg = n > 0
      ? `${plural(n, 'Há 1 lançamento que ainda não foi enviado', 'Há # lançamentos que ainda não foram enviados')}. Se sair agora, ${plural(n, 'ele será perdido', 'eles serão perdidos')}. ` +
        'Para enviar antes, toque em "Sincronizar agora".'
      : 'Sair da sua conta neste celular? Seus lançamentos continuam guardados e aparecem de novo quando você entrar.';
    if (!await confirmar(msg, n > 0 ? 'Sair mesmo assim' : 'Sair', 'Cancelar')) return;
    if (Sync.estaRodando()) {
      toast('Aguarde: terminando a sincronização…', 60000);
      const limite = Date.now() + 120000;
      while (Sync.estaRodando() && Date.now() < limite) await new Promise(ok => setTimeout(ok, 300));
    }
    const p = await Perfil.obter();
    try { await Api.chamar('sair', {}, { tempoMs: 8000 }); } catch (e) { /* sem internet: a sessão só deixa de ser usada */ }
    await limparDadosLocais();
    await Perfil.salvar({ aparelhoId: p.aparelhoId, codigo: p.codigo, criadoEm: p.criadoEm, saiuEm: Date.now() });
    rotulo('');
    toast('Você saiu da conta neste celular.');
    iniciarBoasVindas('saiu');
  };
  $('cfg-voltar').onclick = () => voltar();

  // ------------------------------------------------------------------
  //  Sincronização automática (só no Wi-Fi) e o ícone do topo
  // ------------------------------------------------------------------
  function agendarSync(atraso = 1500) {
    clearTimeout(agendado);
    agendado = setTimeout(() => { if (Sync.conexao() === 'wifi') Sync.sincronizar(); }, atraso);
  }

  let ultimoAvisoErro = { msg: '', quando: 0 };
  window.addEventListener('sync-estado', async (ev) => {
    const d = ev.detail;
    if (d.estado === 'sincronizando') {
      if (d.visivel) rotulo('Sincronizando…', 'amarelo');
      atualizarIconeSync();
      return;
    }
    if (d.estado === 'concluido') {
      const r = d.resumo;
      const faltam = await Sync.pendentes();
      if (d.visivel || !$('sync-rotulo').classList.contains('oculto')) {
        if (faltam === 0 && !r.erros.length) rotulo('Sincronizado', 'verde', 2500);
        else rotulo('');
      }
      if (r.interpretados) toast(r.interpretados === 1 ? 'Um áudio foi interpretado. Toque em Revisar.' : `${r.interpretados} áudios interpretados. Toque em Revisar.`, 4500);
      else if (r.limite) toast('Limite gratuito da IA atingido. Os áudios serão interpretados mais tarde.', 4500);
      else if (r.iaIndisponivel) toast('IA indisponível agora: ' + r.iaIndisponivel, 4500);
      else if (r.erros.length) toast('Alguns itens não foram enviados; vou tentar de novo.', 4000);
      else if (d.manual && telaAtual === 'config') toast('Sincronização concluída.');
      if (telaAtual === 'inicio') renderInicio();
      else atualizarIconeSync();
      if (telaAtual === 'config') renderInfo();
      return;
    }
    if (d.estado === 'falhou' || d.estado === 'erro') {
      rotulo('');
      if (d.codigo === 'sessao_invalida') {
        if (telaAtual === 'inicio' || telaAtual === 'config') iniciarBoasVindas('sessao');
        return; // nas outras telas, a pessoa termina o que está fazendo; o pedido para entrar aparece ao voltar
      }
      const repetido = d.mensagem === ultimoAvisoErro.msg && Date.now() - ultimoAvisoErro.quando < 10 * 60 * 1000;
      if (d.manual || (d.estado === 'erro' && !repetido)) {
        toast(d.mensagem, 5000);
        ultimoAvisoErro = { msg: d.mensagem, quando: Date.now() };
      }
      if (telaAtual === 'inicio') renderInicio();
      else atualizarIconeSync();
      if (telaAtual === 'config') renderInfo();
      return;
    }
    if (d.estado === 'offline' && d.manual) toast('Sem internet no momento.');
    atualizarIconeSync();
  });

  window.addEventListener('online', () => { atualizarIconeSync(); agendarSync(); });
  window.addEventListener('offline', () => atualizarIconeSync());
  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', () => { atualizarIconeSync(); agendarSync(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { atualizarIconeSync(); agendarSync(500); }
  });
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || Sync.conexao() !== 'wifi' || Sync.estaRodando()) return;
    const p = await Perfil.obter();
    if (!p || !p.token) return;
    const n = await Sync.pendentes();
    const ultima = await Banco.lerConfig('ultimaSync', 0);
    if (n > 0 || Date.now() - (ultima || 0) > 5 * 60 * 1000) Sync.sincronizar();
  }, 60000);

  // ------------------------------------------------------------------
  //  Instalação e atualização do app
  // ------------------------------------------------------------------
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptInstalacao = e;
    if (telaAtual === 'inicio') renderInicio();
  });
  window.addEventListener('appinstalled', () => {
    promptInstalacao = null;
    toast('App instalado na tela inicial!');
    if (telaAtual === 'inicio') renderInicio();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (pedimosAtualizacao) { pedimosAtualizacao = false; location.reload(); }
    });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        const avisarNovaVersao = (w) => { swEsperando = w; if (telaAtual === 'inicio') renderInicio(); };
        if (reg.waiting && navigator.serviceWorker.controller) avisarNovaVersao(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener('statechange', () => {
            if (novo.state === 'installed' && navigator.serviceWorker.controller) avisarNovaVersao(novo);
          });
        });
      } catch (e) {
        console.warn('Service worker não registrado:', e);
      }
    });
  }

  // ------------------------------------------------------------------
  //  Início
  // ------------------------------------------------------------------
  async function limparArquivosAntigos() {
    // fotos e áudios já enviados há mais de 30 dias saem do celular (continuam no Drive)
    const limite = Date.now() - 30 * 24 * 3600 * 1000;
    for (const a of await Banco.todos('arquivos')) {
      if (a.enviado && a.blob && (a.enviadoEm || a.criadoEm || 0) < limite) {
        a.blob = null;
        await Banco.gravar('arquivos', a);
      }
    }
  }

  async function iniciar() {
    try {
      await Banco.abrir();
    } catch (e) {
      document.body.innerHTML = `<p style="padding:24px">Não foi possível abrir o armazenamento do app: ${esc(e.message)}</p>`;
      return;
    }
    try { await limparArquivosAntigos(); } catch (e) { /* não impede o uso */ }
    const perfil = await Perfil.obter();
    if (!perfil || !perfil.token) { iniciarBoasVindas(motivoEntrada(perfil)); return; }
    exibirInicio();
    agendarSync(800);
  }

  iniciar();
})();
