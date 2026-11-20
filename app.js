// =====================================================================
//  APLICATIVO — telas e interações
// =====================================================================
(() => {
  const CATEGORIAS_PADRAO = ['Alimentação', 'Transporte', 'Hospedagem', 'Combustível', 'Passeios', 'Compras', 'Outros'];
  const MEIOS_PADRAO = ['Dinheiro', 'PIX', 'Débito', 'Crédito'];
  const NOMES_CONEXAO = { wifi: 'Wi-Fi', celular: 'dados móveis', offline: 'sem internet', desconhecida: 'conexão não identificada' };

  const $ = (id) => document.getElementById(id);
  let telaAtual = null;
  let dadosTela = null; // dados da tela atual (ex.: qual veículo está aberto), guardados também no histórico
  let urlsTemporarias = [];
  let promptInstalacao = null;
  let swEsperando = null;
  let pedimosAtualizacao = false;
  let agendado = null;
  let aparelhoNovo = null; // identificador criado no primeiro acesso, antes de existir perfil
  let prefCameraSistema = false; // configurações: usar a câmera do próprio celular em vez da câmera do app
  let removido = false; // "Remover app" foi usado: não grava nem sincroniza mais nada
  let pedidosSenha = []; // organizador: pedidos de senha nova em aberto
  let ultimaBuscaPedidos = 0;

  // Histórico das versões (o mais novo primeiro). Aparece em Configurações > "O que há de novo"
  // e abre sozinho uma vez depois de cada atualização.
  const NOVIDADES = [
    { titulo: 'Versão 6', itens: [
      '🚗 <b>Gastos dos veículos na tela inicial:</b> agora eles aparecem junto com os outros lançamentos e entram no <b>Hoje</b> e no <b>Total lançado</b> (a Galeria fica de fora; num veículo compartilhado, só os que você lançou). Tocando no gasto, ele abre direto.',
      '🔄 <b>Puxar a tela para baixo</b> atualiza (sincroniza) sem sair da tela em que você está e sem perder o que estiver digitado.',
      '⛽ <b>Abastecimento com vários áudios e várias fotos:</b> cada áudio novo fica guardado (dá para ouvir e apagar cada um). O botão <b>📷 Fotos</b> serve para a nota, a bomba (valor do litro, litros e total) e o painel (hodômetro): a IA descobre qual é qual e lê tudo junto.',
      '👆 <b>Tocar fora</b> fecha os avisos e os menus. As perguntas importantes (como “Salvar mesmo assim?”) continuam pedindo uma resposta.',
      '🐞 <b>Avisar um problema ou dar uma ideia:</b> o ícone discreto no topo de cada tela grava um áudio (ou você escreve) e manda junto uma imagem da tela. Só o organizador vê.',
      '📝 <b>Observação</b> no cadastro do veículo (até 1000 letras), para deixar um comentário (ex.: “Carro alugado para o passeio”).',
      'ℹ️ <b>Informações do veículo:</b> o ícone ℹ️ na tela do veículo mostra tudo o que está cadastrado, inclusive para quem recebeu o compartilhamento.'
    ] },
    { titulo: 'Versão 5', itens: [
      '👥 <b>Compartilhar veículo:</b> na tela do veículo, a engrenagem ⚙️ tem <b>Editar veículo</b> e <b>Compartilhar veículo</b>. Você informa o primeiro nome e o e-mail da pessoa e o veículo aparece na lista dela, com 👥. Ela vê tudo e lança gastos, mas só altera ou exclui o que ela mesma lançou. Você, que é o dono, pode tudo e tira a pessoa quando quiser. O extrato mostra quem lançou cada gasto.',
      '📧 <b>E-mail:</b> toda conta agora tem um e-mail (cada e-mail só pode estar em uma conta). Quem já tinha conta cadastra pelo aviso que aparece ao abrir o app ou nas Configurações.',
      '🎨 <b>Cor do veículo:</b> agora é obrigatória. Veículo sem cor mostra um aviso até você completar o cadastro.',
      '⛽ <b>Abastecimento:</b> valor do litro, litros e valor total. Com dois deles, o app calcula o terceiro. Se você digitar os três e eles não baterem, aparece ⚠️ (toque nele para ver o porquê). O próximo abastecimento já vem com o combustível, o valor do litro e a forma de pagamento do último daquele veículo.',
      '📅 <b>Datas dos veículos:</b> calendário novo. No ✏️ você digita a data num campo vazio (dd/mm/aaaa).',
      '✖️ O campo <b>Local</b> tem um × no fim para apagar tudo de uma vez.',
      '💰 Os totais viraram etiquetas: no veículo fica só o <b>Total</b>; na tela inicial, <b>Hoje</b> e <b>Total lançado</b>.',
      '👆 <b>Tocar e segurar:</b> nas setas, a situação aparece por 3 segundos; na engrenagem aparece “Configurações” e no + aparece “Adicionar um item”.',
      '➕ Com o menu do + aberto, arrastar a tela fecha o menu.'
    ] },
    { titulo: 'Versão 4', itens: [
      '➕ <b>Botão +</b> no meio da parte de baixo da tela inicial: ele abre o <b>Lançar por voz</b>, o <b>Lançar por foto</b>, o <b>Lançar por texto</b> e o novo <b>Veículos</b>. O histórico fica logo abaixo do título.',
      '🚗 <b>Veículos:</b> cadastre seus veículos (montadora, modelo, ano e placa) e lance os gastos de cada um: <b>abastecimento</b>, <b>manutenção</b>, <b>despesas</b> (seguro, IPVA, licenciamento, multas e outros) e uma <b>galeria</b> de fotos. Cada veículo tem o extrato dele, do mais novo para o mais velho, com o total. Esses gastos não entram no histórico da tela inicial.',
      '⛽ <b>Abastecimento:</b> combustível e tanque cheio, hodômetro (o último fica de fundo), valor do litro (vem com o último que você pagou), valor total, litros calculados, data, pagamento e local pelo GPS. Dá para <b>lançar por voz</b> ou <b>ler a nota do posto</b>: a IA preenche só os campos vazios.',
      '🔢 Nos valores dos veículos você digita só os números, como numa calculadora (6 → 0,006 → 0,061 → 6,199).',
      '⚠️ Abastecimento ou manutenção sem hodômetro, ou com o km fora de ordem, ficam marcados com ⚠️.',
      '💵 Pagando em <b>Dinheiro</b>, o campo Banco/conta fica desligado.',
      '⚙️ Nas Configurações, o botão <b>Sair da conta neste celular</b> foi para junto do <b>Remover app</b>.'
    ] },
    { titulo: 'Versão 3', itens: [
      '🔍 <b>Ver as fotos:</b> toque na foto para abrir em tela cheia. Amplie com dois dedos (ou com dois toques) e arraste para o lado para ver a próxima. Foto ou áudio que já saiu do celular é baixado do servidor na hora (precisa de internet).',
      '📸 <b>Câmera melhor:</b> o app usa a câmera principal de trás, com foco automático, e você pode tocar na nota para focar. O botão do flash aparece sempre (se o celular não liberar o flash para o app, ele explica o que fazer). Celular com várias câmeras atrás: o botão 🔄 troca de câmera.',
      '🧾 <b>Lançar por foto:</b> primeiro você escolhe entre <b>Tirar foto</b> e <b>Galeria</b>.',
      '🔄 <b>Setas de sincronização:</b> giram sem texto. Tocando nelas enquanto estão amarelas aparece “Sincronizando…”; tocando e segurando aparece a situação (ex.: “Sincronizado”).',
      '🧹 <b>Limpar dados</b> (em Configurações): apaga do celular as fotos e os áudios que já estão no servidor, para liberar espaço. Os gastos continuam aqui.',
      '🔑 O <b>código do grupo</b> saiu das Configurações: ele já vem no link do app.',
      '✨ E mais: o “voltar” do celular fecha estas janelas, os botões de foto têm o mesmo tamanho e os textos não ficam selecionados ao tocar.'
    ] },
    { titulo: 'Versão 2', itens: [
      '📷 <b>Lançar por foto:</b> tire a foto da nota fiscal e o app preenche os itens (com quantidade e preço de cada um), o total, o local, a data e a hora. Se a nota tiver QR Code, os dados vêm direto do site da SEFAZ.',
      '📸 <b>Câmera dentro do app</b>, com lanterna: depois da foto você vai direto para o recorte, que agora tem o botão <b>Repetir foto</b>.',
      '🧮 <b>Itens com quantidade e preço de cada um</b> (ex.: 2 × R$ 5,00 = R$ 10,00), também por voz e por texto.',
      '🔑 <b>Esqueci minha senha:</b> o organizador manda um código pelo seu WhatsApp para você criar uma senha nova.',
      '⚙️ Nas configurações: <b>Trocar senha</b>, <b>Alterar WhatsApp</b>, código do grupo escondido (toque no olho para ver) e o botão <b>Remover app</b>.',
      '🏷️ A versão do app aparece ao lado do nome, na tela inicial.'
    ] },
    { titulo: 'Versão 1.1', itens: [
      'Conta com nome e senha: entre em qualquer celular e veja os seus lançamentos.',
      'Recorte e giro das fotos antes de salvar.',
      'Ícone de sincronização no alto da tela (vermelho: falta enviar; amarelo: enviando; verde: tudo enviado).',
      'Exemplo de como falar no lançamento por voz.',
      'Aviso para instalar pelo Google Chrome (sem o bloqueio do Play Protect).'
    ] },
    { titulo: 'Versão 1.0', itens: [
      'Lançamento por voz (a IA preenche) e por texto, com fotos e localização.',
      'Funciona sem internet: os lançamentos ficam no celular e são enviados depois.'
    ] }
  ];

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
  function lerQtd(t) {
    const s = String(t == null ? '' : t).trim().replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
  }
  function lerUnit(t) {
    if (t == null) return null;
    let s = String(t).trim().replace(/[R$\s]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return isFinite(n) ? Math.round(n * 1000) / 1000 : null;
  }
  function qtdParaCampo(q) { return q == null ? '' : String(q).replace('.', ','); }
  function unitParaCampo(v) {
    if (v == null || isNaN(v)) return '';
    const tres = Math.abs(Math.round(v * 100) - v * 100) > 1e-6; // ex.: litro a R$ 6,199
    return Number(v).toFixed(tres ? 3 : 2).replace('.', ',');
  }
  // WhatsApp: guardado só com os números; na tela, "(83) 99999-8888"
  function digitosZap(v) {
    let d = String(v || '').replace(/\D/g, '');
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    return d.replace(/^0+/, '');
  }
  function zapValido(v) {
    const d = digitosZap(v);
    return (d.length === 10 || d.length === 11) && Number(d.slice(0, 2)) >= 11;
  }
  function formatarZap(v) {
    const d = digitosZap(v).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  // E-mail (V5): minúsculas e sem espaços; '' se não parecer um e-mail
  function normalizarEmail(v) {
    const e = String(v || '').trim().toLowerCase();
    return e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
  }
  function mascaraZap(input) {
    input.addEventListener('input', () => {
      const noFim = input.selectionStart === input.value.length;
      const novo = formatarZap(input.value);
      if (novo !== input.value) {
        input.value = novo;
        if (noFim) input.setSelectionRange(novo.length, novo.length);
      }
    });
  }
  function linkZap(numero, texto) {
    return 'https://wa.me/' + String(numero || '').replace(/\D/g, '') + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
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
  // ------------------------------------------------------------------
  //  Diálogos: o "voltar" do Android fecha o diálogo (como "Cancelar").
  //  Cada diálogo aberto ganha uma entrada no histórico; quando ele fecha
  //  por um botão, o próprio app tira essa entrada.
  // ------------------------------------------------------------------
  let dialogoAberto = null; // { aoVoltar, entrada }
  let popsPendentes = 0;    // "voltar" feitos pelo app para tirar a entrada de um diálogo
  let aoTerminarPops = [];
  function quandoHistoricoPronto(fn) {
    if (popsPendentes) aoTerminarPops.push(fn); else fn();
  }
  /** fora: tocar fora da caixa fecha (vale como "cancelar"); só nos avisos e menus, nunca nas decisões importantes. */
  function abrirDialogo(html, aoVoltar, { fora = false } = {}) {
    $('dialogo').innerHTML = html;
    const d = { aoVoltar, entrada: false };
    dialogoAberto = d;
    const fundo = $('dialogo').firstElementChild;
    if (fora && fundo) {
      fundo.addEventListener('click', (e) => {
        if (e.target !== e.currentTarget || dialogoAberto !== d) return;
        fecharDialogo();
        d.aoVoltar();
      });
    }
    quandoHistoricoPronto(() => {
      if (dialogoAberto !== d) return;
      d.entrada = true;
      history.pushState(Object.assign(estadoTela(), { dialogo: true }), '');
    });
  }
  function fecharDialogo() {
    $('dialogo').innerHTML = '';
    const d = dialogoAberto;
    dialogoAberto = null;
    if (d && d.entrada) { popsPendentes++; history.back(); }
  }
  /** Chamado pelo "voltar": devolve true se o "voltar" era de um diálogo (e ele foi fechado). */
  function voltarNoDialogo() {
    if (popsPendentes > 0) {
      popsPendentes--;
      if (!popsPendentes) { const fila = aoTerminarPops; aoTerminarPops = []; fila.forEach(f => f()); }
      return true;
    }
    if (!dialogoAberto) return false;
    const d = dialogoAberto;
    dialogoAberto = null;
    $('dialogo').innerHTML = '';
    if (!d.entrada) history.pushState(estadoTela(), ''); // o "voltar" tirou a entrada da tela: devolve
    d.aoVoltar();
    return true;
  }
  /**
   * Diálogo com várias opções (cada uma vira um botão). Devolve o "valor" da escolhida (null no "voltar" ou tocando fora).
   * importante: decisão que precisa de resposta (tocar fora não fecha).
   */
  function escolher(msg, opcoes, { importante = false } = {}) {
    return new Promise((ok) => {
      abrirDialogo(`<div class="fundo-dialogo"><div class="dialogo" role="dialog"><p>${esc(msg)}</p><div class="botoes coluna">` +
        opcoes.map((o, i) => `<button class="botao ${o.classe || ''}" data-opcao="${i}">${esc(o.texto)}</button>`).join('') + '</div></div></div>',
      () => ok(null), { fora: !importante });
      $('dialogo').querySelectorAll('[data-opcao]').forEach((b) => {
        b.onclick = () => { fecharDialogo(); ok(opcoes[Number(b.dataset.opcao)].valor); };
      });
    });
  }
  /**
   * Diálogo com campos. aoConfirmar(valores) devolve '' (deu certo) ou a mensagem de erro (o diálogo continua aberto).
   */
  function dialogoCampos({ titulo, texto = '', campos, sim = 'Salvar', mostrarSenha = false, aoConfirmar }) {
    return new Promise((ok) => {
      abrirDialogo(`<div class="fundo-dialogo"><div class="dialogo" role="dialog"><h2>${esc(titulo)}</h2>${texto ? `<p class="dica">${esc(texto)}</p>` : ''}` +
        campos.map(c => `<label for="${c.id}">${esc(c.rotulo)}</label><input id="${c.id}" type="${c.tipo || 'text'}"` +
          `${c.inputmode ? ` inputmode="${c.inputmode}"` : ''} autocomplete="${c.autocomplete || 'off'}" placeholder="${esc(c.placeholder || '')}" value="${esc(c.valor || '')}">`).join('') +
        (mostrarSenha ? '<label class="marcar"><input type="checkbox" id="dlg-mostrar"> Mostrar senha</label>' : '') +
        `<p class="erro" id="dlg-erro"></p><div class="botoes"><button class="botao" id="dlg-nao">Cancelar</button>` +
        `<button class="botao primario" id="dlg-sim">${esc(sim)}</button></div></div></div>`, () => ok(false));
      campos.forEach((c) => {
        if (c.mascaraZap) mascaraZap($(c.id));
        $(c.id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('dlg-sim').click(); } });
      });
      if (mostrarSenha) {
        $('dlg-mostrar').onchange = () => campos.forEach((c) => { if (c.tipo === 'password' || c.senha) { c.senha = true; $(c.id).type = $('dlg-mostrar').checked ? 'text' : 'password'; } });
      }
      $('dlg-nao').onclick = () => { fecharDialogo(); ok(false); };
      $('dlg-sim').onclick = async () => {
        const valores = {};
        campos.forEach((c) => { valores[c.id] = $(c.id).value; });
        $('dlg-sim').disabled = true;
        let erro = '';
        try { erro = await aoConfirmar(valores); } catch (e) { erro = e.message; }
        if (!$('dlg-sim')) return;
        $('dlg-sim').disabled = false;
        if (erro) { $('dlg-erro').textContent = erro; return; }
        fecharDialogo();
        ok(true);
      };
      setTimeout(() => { const f = $(campos[0].id); if (f) f.focus(); }, 50);
    });
  }
  /**
   * Menu do botão "+": opções grandes acima do botão (que vira um "×"). Tocar fora, no "×" ou no
   * "voltar" do celular fecha. Devolve o "valor" da opção escolhida (null se fechou).
   */
  function menuMais(rotulo, opcoes) {
    $('toast').classList.add('oculto'); // o aviso que estava na tela não cobre as opções
    return new Promise((ok) => {
      abrirDialogo(`<div class="fundo-dialogo menu-mais" id="mm-fundo"><div class="folha-mais" role="dialog" aria-label="${esc(rotulo)}">` +
        opcoes.map((o, i) => `<button class="opcao-mais" type="button"${o.id ? ` id="${esc(o.id)}"` : ''} data-opcao="${i}">` +
          `<span class="icone-mais" aria-hidden="true">${o.icone}</span>${esc(o.texto)}</button>`).join('') +
        '</div><button class="fab fechar" type="button" id="mm-fechar" aria-label="Fechar"><span aria-hidden="true">+</span></button></div>',
      () => ok(null));
      $('dialogo').querySelectorAll('[data-opcao]').forEach((b) => {
        b.onclick = () => { fecharDialogo(); ok(opcoes[Number(b.dataset.opcao)].valor); };
      });
      const fundo = $('mm-fundo');
      const fechar = () => { if ($('mm-fundo') === fundo) { fecharDialogo(); ok(null); } };
      $('mm-fechar').onclick = fechar;
      fundo.addEventListener('click', (e) => { if (e.target === e.currentTarget) fechar(); });
      // arrastar a tela (a lista que está atrás do menu) também fecha o menu (V5)
      let inicio = null;
      fundo.addEventListener('pointerdown', (e) => { inicio = e.target === e.currentTarget ? { x: e.clientX, y: e.clientY } : null; });
      fundo.addEventListener('pointermove', (e) => { if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 12) fechar(); });
      fundo.addEventListener('pointerup', () => { setTimeout(() => { inicio = null; }, 0); });
      fundo.addEventListener('pointercancel', () => { if (inicio) fechar(); }); // o navegador começou a rolar a tela
      fundo.addEventListener('touchmove', (e) => { if (e.target === e.currentTarget) fechar(); }, { passive: true });
      fundo.addEventListener('wheel', fechar, { passive: true });
      const aoRolar = (e) => {
        if ($('mm-fundo') !== fundo) { document.removeEventListener('scroll', aoRolar, true); return; } // o menu já fechou
        if (!(e.target instanceof Node) || !fundo.contains(e.target)) fechar();
      };
      document.addEventListener('scroll', aoRolar, { capture: true, passive: true });
    });
  }
  function confirmar(msg, sim = 'Confirmar', nao = 'Cancelar') {
    return new Promise((ok) => {
      abrirDialogo(`<div class="fundo-dialogo"><div class="dialogo" role="dialog"><p>${esc(msg)}</p>
        <div class="botoes"><button class="botao" id="dlg-nao">${esc(nao)}</button><button class="botao primario" id="dlg-sim">${esc(sim)}</button></div></div></div>`,
      () => ok(false));
      const fim = (r) => { fecharDialogo(); ok(r); };
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
  function mensagemErroGeral(e) {
    if (e instanceof Api.ErroRede) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
    if (e && e.codigo === 'acao_desconhecida') return 'O servidor ainda está na versão antiga. Avise o organizador para atualizar o código no Apps Script.';
    return (e && e.message) || 'Algo deu errado. Tente de novo.';
  }
  function abrirNovidades() {
    const blocos = NOVIDADES.map((v, i) => `<div class="${i === 0 ? 'atual' : ''}"><h4>${esc(v.titulo)}${i === 0 ? ' <small>(esta versão)</small>' : ''}</h4>` +
      `<ul>${v.itens.map(t => `<li>${t}</li>`).join('')}</ul></div>`).join('');
    abrirDialogo(`<div class="fundo-dialogo" id="nov-fundo"><div class="dialogo novidades" role="dialog" aria-label="O que há de novo"><h2>✨ O que há de novo</h2>${blocos}` +
      '<div class="botoes"><button class="botao primario" id="nov-ok">Entendi</button></div></div></div>', () => { /* só fecha */ }, { fora: true });
    $('nov-ok').onclick = () => fecharDialogo();
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
  function estadoTela() {
    return dadosTela ? { tela: telaAtual, dados: dadosTela } : { tela: telaAtual };
  }
  function mostrarTela(nome, { empilhar = true, dados = null } = {}) {
    document.querySelectorAll('.tela').forEach(t => t.classList.add('oculto'));
    $('tela-' + nome).classList.remove('oculto');
    telaAtual = nome;
    dadosTela = dados;
    document.body.classList.toggle('tem-fab', nome === 'inicio' || nome === 'veiculo'); // o aviso (toast) sobe acima do "+"
    window.scrollTo(0, 0);
    if (empilhar) { const estado = estadoTela(); quandoHistoricoPronto(() => history.pushState(estado, '')); }
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
    if (telaAtual === 'foto' && Foto.fotos.length) {
      const ok = await confirmar('Descartar as fotos desta nota?', 'Descartar', 'Continuar');
      if (ok) Foto.fotos = [];
      return ok;
    }
    return true;
  }
  window.addEventListener('popstate', async () => {
    if (voltarNoDialogo()) return;
    if (Visor.aberto()) {
      // "voltar" com uma foto aberta em tela cheia: só fecha a foto
      Visor.fechar();
      history.pushState(estadoTela(), '');
      return;
    }
    if (Camera.aberta()) {
      // "voltar" com a câmera aberta: só fecha a câmera
      Camera.cancelar();
      history.pushState(estadoTela(), '');
      return;
    }
    if (Recorte.aberto()) {
      // "voltar" com a tela de recorte aberta: só fecha o recorte
      Recorte.cancelar();
      history.pushState(estadoTela(), '');
      return;
    }
    if (telaAtual === 'senha') { mostrarTela('boas-vindas', { empilhar: false }); return; }
    if (['inicio', 'boas-vindas', 'whatsapp', 'removido'].includes(telaAtual)) return;
    if (Veiculos.ehTela(telaAtual)) {
      // telas dos veículos: uma dentro da outra; o "voltar" vai para a tela anterior (guardada no histórico)
      const destino = history.state;
      if (!(await Veiculos.podeSair())) { quandoHistoricoPronto(() => history.pushState(estadoTela(), '')); return; }
      if (destino && Veiculos.ehTela(destino.tela)) Veiculos.mostrar(destino.tela, destino.dados);
      else exibirInicio();
      return;
    }
    if (await podeSairDaTela()) exibirInicio();
    else quandoHistoricoPronto(() => history.pushState(estadoTela(), '')); // depois que a pergunta sair do histórico
  });
  function voltar() {
    quandoHistoricoPronto(() => {
      if (history.state && history.state.tela) history.back();
      else exibirInicio();
    });
  }
  function concluirEVoltar() {
    Form.alterado = false;
    Voz.audio = null;
    Foto.fotos = [];
    voltar();
  }
  async function exibirInicio() {
    liberarUrls();
    Form.token = null;
    Voz.token = null;
    Foto.token = null;
    if (removido) return;
    const p = await Perfil.obter();
    // contas antigas: o WhatsApp passa a ser obrigatório (para o "Esqueci minha senha")
    if (p && p.token && p.precisaWhatsapp && navigator.onLine && Api.urlConfigurada()) { abrirTelaWhatsapp(); return; }
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
    $('bv-bloco-zap').classList.toggle('oculto', !criar);
    $('bv-bloco-email').classList.toggle('oculto', !criar);
    $('bv-esqueci').classList.toggle('oculto', criar);
    $('bv-senha').setAttribute('autocomplete', criar ? 'new-password' : 'current-password');
    $('bv-senha').placeholder = criar ? 'Mínimo 4 dígitos ou letras' : 'Sua senha';
    $('bv-comecar').textContent = criar ? 'Criar conta' : 'Entrar';
    $('bv-dica').textContent = criar
      ? 'Guarde o nome e a senha: com eles você entra na sua conta em qualquer celular.'
      : 'Use o mesmo nome e senha de quando criou a conta.';
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
  mascaraZap($('bv-zap'));
  ['bv-nome', 'bv-senha', 'bv-senha2', 'bv-zap', 'bv-codigo'].forEach(id => {
    $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('bv-comecar').click(); } });
  });

  function avisoChromeHtml(codigo, classe) {
    return `<div class="${classe}"><span><b>Use o Google Chrome.</b> Instalado por este navegador, o app é bloqueado pelo Play Protect como “app de risco”. Pelo Chrome ele instala sem esse aviso.</span>` +
      `<a class="botao pequeno" href="${esc(linkAbrirNoChrome(codigo))}">Abrir no Chrome</a></div>`;
  }
  function renderAvisoChromeBoasVindas() {
    $('bv-chrome').innerHTML = mostrarAvisoChrome() ? avisoChromeHtml($('bv-codigo').value.trim(), 'aviso-chrome') : '';
  }

  // ------------------------------------------------------------------
  //  Código do grupo: vem no link de convite (?codigo=...) e fica guardado no celular.
  //  Só aparece para digitar se o app não souber o código ou se o servidor recusar.
  // ------------------------------------------------------------------
  async function guardarCodigoDoLink() {
    const params = new URLSearchParams(location.search);
    const codigo = (params.get('codigo') || '').trim();
    if (!codigo) return;
    await Banco.gravarConfig('codigoGrupo', codigo);
    const p = await Perfil.obter();
    if (p && p.codigo !== codigo) {
      p.codigo = codigo;
      p.codigoInvalido = false;
      await Perfil.salvar(p);
    }
    // tira o código da barra de endereço (ele já está guardado)
    params.delete('codigo');
    const resto = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (resto ? '?' + resto : '') + location.hash); } catch (e) { /* opcional */ }
  }
  async function codigoConhecido() {
    const p = await Perfil.obter();
    return String((await Banco.lerConfig('codigoGrupo', '')) || (p && p.codigo) || '').trim();
  }
  function mostrarCampoCodigo(bloco, campo, focar) {
    $(bloco).classList.remove('oculto');
    if (focar) setTimeout(() => { $(campo).focus(); $(campo).select(); }, 50);
  }

  async function iniciarBoasVindas(motivo = 'novo') {
    const p = await Perfil.obter();
    $('bv-intro').textContent = INTRO[motivo] || INTRO.novo;
    $('bv-nome').value = motivo === 'migracao' ? (p.nomeServidor || p.nome || '') : motivo === 'sessao' ? (p.nome || '') : '';
    $('bv-senha').value = '';
    $('bv-senha2').value = '';
    $('bv-zap').value = '';
    $('bv-email').value = '';
    $('bv-mostrar').checked = false;
    $('bv-senha').type = 'password';
    $('bv-senha2').type = 'password';
    const codigo = await codigoConhecido();
    $('bv-codigo').value = codigo;
    $('bv-bloco-codigo').classList.toggle('oculto', !!codigo);
    modoConta(motivo === 'sessao' || motivo === 'saiu' ? 'entrar' : 'criar');
    renderAvisoChromeBoasVindas();
    mostrarTela('boas-vindas', { empilhar: false });
  }

  function mensagemErroConta(e) {
    if (e instanceof Api.ErroRede) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
    if (e.codigo === 'codigo_invalido') return 'O código do grupo não confere. Digite o código que está no link do app (ou peça ao organizador).';
    if (e.codigo === 'senha_incorreta') return 'Senha incorreta. Se esqueceu, toque em “Esqueci minha senha”.';
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
    if (criar && !zapValido($('bv-zap').value)) return erro('Informe seu WhatsApp com DDD (ex.: (83) 99999-8888).');
    const email = normalizarEmail($('bv-email').value);
    if (criar && !email) return erro('Informe seu e-mail (ex.: nome@gmail.com).');
    if (!codigo) {
      mostrarCampoCodigo('bv-bloco-codigo', 'bv-codigo', true);
      return erro('Informe o código do grupo. Ele vem no link do app que o organizador mandou.');
    }
    if (!Api.urlConfigurada()) return erro('O app ainda não tem o endereço do servidor. Avise o organizador (arquivo config.js).');
    if (!navigator.onLine) return erro('Sem internet. Para criar a conta ou entrar, o celular precisa estar conectado.');

    const anterior = await Perfil.obter();
    const aparelhoId = (anterior && anterior.aparelhoId) || aparelhoNovo || (aparelhoNovo = novoId());
    const temp = { aparelhoId, codigo };
    const botao = $('bv-comecar');
    botao.disabled = true;
    botao.textContent = criar ? 'Criando a conta…' : 'Entrando…';
    try {
      const dados = { nome, senha, aparelho: await Aparelho.info() };
      if (criar) { dados.whatsapp = digitosZap($('bv-zap').value); dados.email = email; }
      const r = await Api.chamar(criar ? 'criarConta' : 'entrar', dados, { perfil: temp, tempoMs: 30000 });
      await concluirEntrada(r, anterior, temp);
    } catch (e) {
      erro(mensagemErroConta(e));
      if (e.codigo === 'codigo_invalido') mostrarCampoCodigo('bv-bloco-codigo', 'bv-codigo', true);
    } finally {
      botao.disabled = false;
      botao.textContent = criar ? 'Criar conta' : 'Entrar';
    }
  };

  async function limparDadosLocais() {
    await Banco.limpar('lancamentos');
    await Banco.limpar('arquivos');
    await Banco.limpar('veiculos');
    await Banco.limpar('registros');
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
    await Banco.gravarConfig('codigoGrupo', temp.codigo);
    await Perfil.salvar({
      aparelhoId: temp.aparelhoId, codigo: temp.codigo, token: r.token, contaId: r.conta.id, nome: r.conta.nome,
      criadoEm: (anterior && anterior.criadoEm) || Date.now(), entrouEm: Date.now(),
      whatsapp: r.whatsapp || '', precisaWhatsapp: !!r.precisaWhatsapp, organizador: !!r.organizador,
      email: r.email || '', precisaEmail: r.precisaEmail === true, // servidor de antes da V5 não manda: sem aviso
      servidorAntigo: r.precisaWhatsapp === undefined
    });
    await Banco.gravarConfig('versaoVista', VERSAO_DO_APP); // quem acabou de entrar não precisa ver o "O que há de novo"
    if (r.listas && r.listas.categorias && r.listas.categorias.length) await Banco.gravarConfig('listas', r.listas);
    await Banco.gravarConfig('desde', 0);
    await Banco.apagar('config', 'ultimoErro');
    try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* opcional */ }
    pedidosSenha = [];
    exibirInicio();
    toast(`Olá, ${r.conta.nome.split(' ')[0]}!`);
    // traz o histórico da conta (no Wi-Fi também envia o que estiver pendente neste celular)
    Sync.sincronizar(Sync.conexao() === 'wifi' ? {} : { somenteBaixar: true });
    if (r.organizador) buscarPedidos(true);
    talvezPedirEmail();
  }

  // ------------------------------------------------------------------
  //  Esqueci minha senha: o organizador manda um código pelo WhatsApp
  // ------------------------------------------------------------------
  const Esqueci = { nome: '', grupo: '' };

  function erroEsqueci(m) { $('es-erro').textContent = m || ''; }
  function renderContatoOrganizador(org, nome) {
    const el = $('es-org');
    if (org && org.whatsapp) {
      const msg = `Oi! Aqui é ${nome || 'do grupo'}. Pedi um código para trocar a minha senha do Controle de Gastos.`;
      el.innerHTML = `<a class="botao zap grande" target="_blank" rel="noopener" href="${esc(linkZap(org.whatsapp, msg))}">💬 Falar com o organizador no WhatsApp</a>` +
        `<small class="dica">Se o código demorar, mande uma mensagem: o organizador (${esc(org.nome)}) pode não estar com o app aberto.</small>`;
    } else {
      el.innerHTML = '<small class="dica">Se o código demorar, avise o organizador do grupo.</small>';
    }
  }
  function abrirEsqueci() {
    $('es-nome').value = normalizarNome($('bv-nome').value);
    $('es-grupo').value = $('bv-codigo').value.trim();
    $('es-bloco-grupo').classList.toggle('oculto', !!$('es-grupo').value);
    $('es-passo1').classList.remove('oculto');
    $('es-passo2').classList.add('oculto');
    ['es-cod', 'es-senha', 'es-senha2'].forEach((id) => { $(id).value = ''; });
    $('es-mostrar').checked = false;
    $('es-senha').type = $('es-senha2').type = 'password';
    $('es-org').innerHTML = '';
    erroEsqueci('');
    mostrarTela('senha');
  }
  $('bv-esqueci').onclick = () => abrirEsqueci();
  $('es-voltar').onclick = () => voltar();
  $('es-mostrar').onchange = () => { $('es-senha').type = $('es-senha2').type = $('es-mostrar').checked ? 'text' : 'password'; };
  ['es-nome', 'es-grupo'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('es-pedir').click(); } }));
  ['es-cod', 'es-senha', 'es-senha2'].forEach((id) => $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('es-trocar').click(); } }));

  async function aparelhoParaConta() {
    const anterior = await Perfil.obter();
    return { anterior, aparelhoId: (anterior && anterior.aparelhoId) || aparelhoNovo || (aparelhoNovo = novoId()) };
  }

  async function pedirCodigo() {
    const nome = normalizarNome($('es-nome').value);
    const grupo = $('es-grupo').value.trim();
    erroEsqueci('');
    if (!nomeValido(nome)) return erroEsqueci('Informe o nome e sobrenome da sua conta.');
    if (!grupo) {
      mostrarCampoCodigo('es-bloco-grupo', 'es-grupo', true);
      return erroEsqueci('Informe o código do grupo. Ele vem no link do app que o organizador mandou.');
    }
    if (!Api.urlConfigurada()) return erroEsqueci('O app ainda não tem o endereço do servidor. Avise o organizador (arquivo config.js).');
    if (!navigator.onLine) return erroEsqueci('Sem internet. Conecte o celular para pedir o código.');
    const { aparelhoId } = await aparelhoParaConta();
    const botao = $('es-pedir');
    botao.disabled = true;
    botao.textContent = 'Pedindo…';
    try {
      const r = await Api.chamar('pedirCodigoSenha', { nome }, { perfil: { aparelhoId, codigo: grupo }, tempoMs: 30000 });
      Esqueci.nome = nome;
      Esqueci.grupo = grupo;
      const quem = r.organizador ? `O organizador (${esc(r.organizador.nome)})` : 'O organizador';
      $('es-info').innerHTML = `<b>Pedido enviado!</b> ${quem} vai mandar um código de 6 números para o seu WhatsApp` +
        `${r.whatsappFinal ? ` terminado em <b>${esc(r.whatsappFinal)}</b>` : ''}. Quando chegar, digite abaixo e crie a senha nova.`;
      $('es-passo1').classList.add('oculto');
      $('es-passo2').classList.remove('oculto');
      renderContatoOrganizador(r.organizador, nome);
      setTimeout(() => $('es-cod').focus(), 50);
    } catch (e) {
      if (e.codigo === 'codigo_invalido') {
        mostrarCampoCodigo('es-bloco-grupo', 'es-grupo', true);
        erroEsqueci('O código do grupo não confere. Digite o código que está no link do app (ou peça ao organizador).');
      } else {
        erroEsqueci(mensagemErroGeral(e));
      }
      if (e.dados && e.dados.organizador !== undefined) renderContatoOrganizador(e.dados.organizador, nome);
    } finally {
      botao.disabled = false;
      botao.textContent = 'Pedir código';
    }
  }
  $('es-pedir').onclick = () => pedirCodigo();
  $('es-pedir-de-novo').onclick = () => {
    $('es-passo2').classList.add('oculto');
    $('es-passo1').classList.remove('oculto');
    erroEsqueci('');
  };
  $('es-trocar').onclick = async () => {
    const codigo = $('es-cod').value.replace(/\D/g, '');
    const senha = $('es-senha').value;
    erroEsqueci('');
    if (codigo.length !== 6) return erroEsqueci('Digite o código de 6 números que chegou no seu WhatsApp.');
    if (senha.length < 4) return erroEsqueci('A senha nova precisa ter pelo menos 4 caracteres.');
    if (senha !== $('es-senha2').value) return erroEsqueci('As duas senhas não estão iguais.');
    if (!navigator.onLine) return erroEsqueci('Sem internet. Conecte o celular e tente de novo.');
    const { anterior, aparelhoId } = await aparelhoParaConta();
    const temp = { aparelhoId, codigo: Esqueci.grupo };
    const botao = $('es-trocar');
    botao.disabled = true;
    botao.textContent = 'Trocando a senha…';
    try {
      const r = await Api.chamar('redefinirSenha', { nome: Esqueci.nome, codigoSenha: codigo, senhaNova: senha, aparelho: await Aparelho.info() },
        { perfil: temp, tempoMs: 30000 });
      await concluirEntrada(r, anterior, temp);
      toast('Senha nova criada. Você já entrou na sua conta.', 4500);
    } catch (e) {
      erroEsqueci(mensagemErroGeral(e));
    } finally {
      botao.disabled = false;
      botao.textContent = 'Trocar a senha e entrar';
    }
  };

  // ------------------------------------------------------------------
  //  WhatsApp das contas antigas (obrigatório a partir da V2)
  // ------------------------------------------------------------------
  mascaraZap($('zap-numero'));
  function abrirTelaWhatsapp() {
    $('zap-numero').value = '';
    $('zap-erro').textContent = '';
    mostrarTela('whatsapp', { empilhar: false });
  }
  async function salvarWhatsapp(numero) {
    const r = await Api.chamar('salvarWhatsapp', { whatsapp: digitosZap(numero) }, { tempoMs: 20000 });
    const p = await Perfil.obter();
    p.whatsapp = r.whatsapp || digitosZap(numero);
    p.precisaWhatsapp = false;
    await Perfil.salvar(p);
    return p;
  }
  $('zap-numero').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('zap-salvar').click(); } });
  $('zap-salvar').onclick = async () => {
    const v = $('zap-numero').value;
    $('zap-erro').textContent = '';
    if (!zapValido(v)) { $('zap-erro').textContent = 'Informe o WhatsApp com DDD (ex.: (83) 99999-8888).'; return; }
    const botao = $('zap-salvar');
    botao.disabled = true;
    try {
      await salvarWhatsapp(v);
      toast('WhatsApp salvo. Obrigado!');
      exibirInicio();
    } catch (e) {
      if (e.codigo === 'sessao_invalida') { iniciarBoasVindas('sessao'); return; }
      $('zap-erro').textContent = mensagemErroGeral(e);
    } finally {
      botao.disabled = false;
    }
  };

  // ------------------------------------------------------------------
  //  Organizador: pedidos de senha nova (código para mandar pelo WhatsApp)
  // ------------------------------------------------------------------
  function textoCodigo(pd) {
    const v = new Date(pd.validoAte);
    return `Olá, ${primeiroNome(pd.nome)}! Aqui é do Controle de Gastos. Seu código para criar uma senha nova é *${pd.codigo}*.\n` +
      `Digite no app, na tela "Esqueci minha senha". O código vale até ${v.toLocaleDateString('pt-BR')} às ` +
      `${v.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`;
  }
  async function buscarPedidos(forcar = false) {
    if (removido) return;
    const p = await Perfil.obter();
    if (!p || !p.token || !p.organizador || !navigator.onLine || !Api.urlConfigurada()) return;
    if (!forcar && Date.now() - ultimaBuscaPedidos < 60000) return;
    ultimaBuscaPedidos = Date.now();
    let r;
    try { r = await Api.chamar('pedidosSenha', {}, { tempoMs: 20000 }); } catch (e) { return; }
    const antes = JSON.stringify(pedidosSenha);
    pedidosSenha = Array.isArray(r.pedidos) ? r.pedidos : [];
    if (r.organizador === false) {
      const atual = await Perfil.obter();
      if (atual && atual.organizador) { atual.organizador = false; await Perfil.salvar(atual); }
    }
    if (JSON.stringify(pedidosSenha) !== antes && telaAtual === 'inicio') renderInicio();
  }

  // ------------------------------------------------------------------
  //  Tela inicial
  // ------------------------------------------------------------------
  function cartao(l, anexos) {
    const fotos = anexos.filter(a => a.tipo === 'foto').length;
    const temAudio = l.origem === 'voz';
    const nota = l.origem === 'foto';
    let desc = l.descricao || (l.itens && l.itens.length ? l.itens.map(i => i.nome).filter(Boolean).join(', ') : '');
    if (!desc) {
      desc = l.status === 'aguardando_ia' ? (nota ? 'Nota aguardando leitura' : 'Áudio aguardando interpretação')
        : l.status === 'erro_ia' ? (nota ? 'Nota não lida' : 'Áudio não interpretado') : (l.categoria || 'Lançamento');
    }
    const meta = [hora(l.dataHora), l.categoria, l.meioPagamento].filter(Boolean).join(' · ');
    const selos = [];
    if (l.status === 'revisar') selos.push('<span class="selo revisar">Revisar</span>');
    if (l.status === 'aguardando_ia') selos.push(`<span class="selo aguardando">${nota ? 'Aguardando leitura' : 'Aguardando IA'}</span>`);
    if (l.status === 'erro_ia') selos.push('<span class="selo erro">Preencher</span>');
    if (l.sync === 'pendente' || anexos.some(a => !a.enviado && a.blob)) selos.push('<span class="selo fila">Na fila</span>');
    const icones = (nota ? `🧾${fotos > 1 ? fotos : ''} ` : fotos ? `📷${fotos > 1 ? fotos : ''} ` : '') + (temAudio ? '🎤 ' : '') + (l.lat != null ? '📍' : '');
    return `<div class="cartao" data-id="${esc(l.id)}">
      <div><div class="desc">${esc(desc)}</div><div class="meta">${esc(meta)} ${icones}</div></div>
      <div class="direita"><span class="valor">${l.valorTotal != null ? brl(l.valorTotal) : '—'}</span>${selos.join('')}</div>
    </div>`;
  }

  function alerta(cor, texto, botao, acao) {
    return `<div class="alerta-caixa ${cor}"><span>${esc(texto)}</span>${botao ? `<button class="botao pequeno" data-acao="${acao}">${esc(botao)}</button>` : ''}</div>`;
  }

  async function renderInicio() {
    if (removido) return;
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

    // V6: os gastos dos veículos (os que a pessoa lançou; menos a Galeria) entram na lista e nos totais
    const doVeiculo = await Veiculos.paraInicio();
    const itens = lancs.map(l => ({ quando: l.dataHora || 0, valor: l.valorTotal, l }))
      .concat(doVeiculo.map(g => ({ quando: g.quando, valor: g.valor, html: g.html })))
      .sort((a, b) => b.quando - a.quando);

    const hoje = chaveDia(Date.now());
    const comValor = itens.filter(x => x.valor != null);
    const totalHoje = comValor.filter(x => chaveDia(x.quando) === hoje).reduce((s, x) => s + Number(x.valor), 0);
    const total = comValor.reduce((s, x) => s + Number(x.valor), 0);
    $('totais').innerHTML = `<div><small>Hoje</small> <b>${brl(Math.round(totalHoje * 100) / 100)}</b></div><div><small>Total lançado</small> <b>${brl(Math.round(total * 100) / 100)}</b></div>`;

    if (!itens.length) {
      $('lista').innerHTML = '<div class="vazio">Nenhum lançamento ainda.<br>Toque no botão <b>+</b> lá embaixo para lançar seu primeiro gasto.</div>';
    } else {
      let html = '';
      let diaAtual = '';
      itens.forEach(x => {
        const k = chaveDia(x.quando);
        if (k !== diaAtual) { diaAtual = k; html += `<div class="dia">${esc(rotuloDia(x.quando))}</div>`; }
        html += x.l ? cartao(x.l, porLanc[x.l.id] || []) : x.html;
      });
      $('lista').innerHTML = html;
    }
    await renderAlertas(lancs, perfil);
    await atualizarIconeSync();
  }

  async function renderAlertas(lancs, perfil) {
    const html = [];
    if (!Api.urlConfigurada()) html.push(alerta('vermelho', 'O app ainda não tem o endereço do servidor. Avise o organizador (arquivo config.js).'));
    if (perfil.codigoInvalido) html.push(alerta('vermelho', 'O código do grupo mudou. Peça ao organizador o link novo do app e abra-o neste celular.'));
    if (swEsperando) html.push(alerta('azul', 'Há uma nova versão do app.', 'Atualizar', 'atualizar-app'));
    // organizador: pedidos de senha nova (manda o código pelo WhatsApp da pessoa)
    const vistos = await Banco.lerConfig('pedidosVistos', []);
    pedidosSenha.filter(pd => !vistos.includes(pd.contaId + '|' + pd.codigo)).forEach((pd) => {
      html.push(`<div class="alerta-caixa laranja coluna"><span>🔑 <b>${esc(pd.nome)}</b> pediu uma senha nova. Código: <b class="codigo">${esc(pd.codigo)}</b></span>` +
        `<div class="linha-botoes"><a class="botao pequeno zap" target="_blank" rel="noopener" href="${esc(linkZap(pd.whatsapp, textoCodigo(pd)))}">Enviar pelo WhatsApp</a>` +
        `<button class="botao pequeno" data-acao="pedido-ok" data-pedido="${esc(pd.contaId + '|' + pd.codigo)}">Já enviei</button></div></div>`);
    });
    const revisar = lancs.filter(l => l.status === 'revisar');
    if (revisar.length) {
      const notas = revisar.filter(l => l.origem === 'foto').length;
      const audios = revisar.length - notas;
      const texto = !notas ? (audios === 1 ? '1 áudio foi interpretado e está pronto para revisar.' : `${audios} áudios foram interpretados e estão prontos para revisar.`)
        : !audios ? (notas === 1 ? '1 nota foi lida e está pronta para revisar.' : `${notas} notas foram lidas e estão prontas para revisar.`)
          : `${revisar.length} lançamentos (áudios e notas) estão prontos para revisar.`;
      html.push(alerta('azul', texto, 'Revisar', 'revisar'));
    }
    const comErro = lancs.filter(l => l.status === 'erro_ia');
    if (comErro.length) {
      const notas = comErro.filter(l => l.origem === 'foto').length;
      const audios = comErro.length - notas;
      const texto = !notas ? (audios === 1 ? 'A IA não conseguiu interpretar 1 áudio. Preencha você mesmo.' : `A IA não conseguiu interpretar ${audios} áudios. Preencha você mesmo.`)
        : !audios ? (notas === 1 ? 'Não foi possível ler 1 nota. Preencha você mesmo.' : `Não foi possível ler ${notas} notas. Preencha você mesmo.`)
          : `${comErro.length} lançamentos não foram lidos pela IA. Preencha você mesmo.`;
      html.push(alerta('vermelho', texto, 'Ver', 'erro-ia'));
    }
    // veículos (V4): abastecimento lido pela IA (voz ou nota do posto) esperando a revisão
    const regsRevisar = await Veiculos.paraRevisar();
    if (regsRevisar.length) {
      html.push(alerta('azul', regsRevisar.length === 1 ? '1 abastecimento foi lido e está pronto para revisar.'
        : `${regsRevisar.length} abastecimentos foram lidos e estão prontos para revisar.`, 'Revisar', 'revisar-veiculo'));
    }
    const aguardando = lancs.filter(l => l.status === 'aguardando_ia').length;
    const limite = await Banco.lerConfig('iaLimite', null);
    if (aguardando && limite && Date.now() - limite < 6 * 3600 * 1000) {
      html.push(alerta('laranja', 'O limite gratuito da IA foi atingido. Os áudios e as notas serão lidos automaticamente mais tarde.'));
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
    if (removido) return;
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
    const aviso = e.target.closest('[data-aviso]');
    if (aviso) { Veiculos.explicarAviso(aviso.dataset.aviso, aviso.dataset.id); return; } // ⚠️ de um gasto do veículo
    const g = e.target.closest('[data-registro]');
    if (g) { Veiculos.abrirRegistro(g.dataset.registro); return; } // gasto do veículo: abre direto (V6)
    const c = e.target.closest('.cartao');
    if (c) abrirLancamento(c.dataset.id);
  });

  $('alertas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'abrir-config') abrirConfig();
    if (acao === 'pedido-ok') {
      const vistos = (await Banco.lerConfig('pedidosVistos', [])).concat(b.dataset.pedido).slice(-50);
      await Banco.gravarConfig('pedidosVistos', vistos);
      renderInicio();
    }
    if (acao === 'atualizar-app' && swEsperando) { pedimosAtualizacao = true; swEsperando.postMessage('atualizar'); }
    if (acao === 'revisar-veiculo') {
      const r = (await Veiculos.paraRevisar())[0];
      if (r) Veiculos.abrirRegistro(r.id);
    }
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

  // Setas de sincronização: tocar sincroniza (se já estão girando, mostra "Sincronizando…" por 3 s);
  // tocar e segurar mostra a situação atual por 3 s.
  let seguraRelogio = null;
  let segurou = false;
  async function mostrarSituacaoSync() {
    if (Sync.estaRodando()) { rotulo('Sincronizando…', 'amarelo', 3000); return; }
    const n = await Sync.pendentes();
    const ultima = await Banco.lerConfig('ultimaSync', 0);
    const erro = await Banco.lerConfig('ultimoErro', null);
    const falhou = !!(erro && erro.quando && erro.quando >= (ultima || 0));
    const semInternet = Sync.conexao() === 'offline' ? ' · sem internet' : '';
    if (n > 0) rotulo(plural(n, '1 lançamento para enviar', '# lançamentos para enviar') + semInternet, 'vermelho', 3000);
    else if (falhou || !ultima) rotulo('Não sincronizado' + semInternet, 'vermelho', 3000);
    else rotulo('Sincronizado', 'verde', 3000);
  }
  $('btn-sync').addEventListener('pointerdown', () => {
    segurou = false;
    clearTimeout(seguraRelogio);
    seguraRelogio = setTimeout(() => { segurou = true; mostrarSituacaoSync(); }, 500);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('btn-sync').addEventListener(ev, () => clearTimeout(seguraRelogio)));
  $('btn-sync').addEventListener('contextmenu', (e) => {
    // no Android, segurar o dedo também gera este evento: vale como "tocar e segurar"
    e.preventDefault();
    if (!segurou) { segurou = true; clearTimeout(seguraRelogio); mostrarSituacaoSync(); }
  });
  $('btn-sync').onclick = () => {
    if (segurou) { segurou = false; return; } // foi "tocar e segurar": só mostra a situação
    if (Sync.estaRodando()) { rotulo('Sincronizando…', 'amarelo', 3000); return; }
    Sync.sincronizar({ manual: true });
  };
  // botão "+": as três formas de lançar e os veículos
  $('btn-mais').onclick = async () => {
    const escolha = await menuMais('Lançar', [
      { valor: 'voz', id: 'btn-voz', icone: '🎤', texto: 'Lançar por voz' },
      { valor: 'foto', id: 'btn-foto', icone: '📷', texto: 'Lançar por foto' },
      { valor: 'texto', id: 'btn-texto', icone: '✏️', texto: 'Lançar por texto' },
      { valor: 'veiculos', id: 'btn-veiculos', icone: '🚗', texto: 'Veículos' }
    ]);
    if (escolha === 'voz') abrirVoz();
    else if (escolha === 'foto') abrirFoto();
    else if (escolha === 'texto') abrirNovoTexto();
    else if (escolha === 'veiculos') Veiculos.abrirLista();
  };

  // Tocar e segurar a engrenagem ou o "+" mostra o nome do botão por 3 s (V5)
  let dicaRelogio = null;
  function mostrarDica(botao, texto) {
    let el = $('dica-flutuante');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dica-flutuante';
      el.className = 'dica-flutuante oculto';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = texto;
    el.classList.remove('oculto', 'acima', 'abaixo');
    const r = botao.getBoundingClientRect();
    const acima = r.top > window.innerHeight / 2; // botão lá embaixo (o "+"): a dica fica em cima dele
    el.classList.add(acima ? 'acima' : 'abaixo');
    const centro = r.left + r.width / 2;
    const esquerda = Math.max(8, Math.min(window.innerWidth - el.offsetWidth - 8, centro - el.offsetWidth / 2));
    el.style.left = esquerda + 'px';
    el.style.top = (acima ? r.top - el.offsetHeight - 12 : r.bottom + 10) + 'px';
    el.style.setProperty('--seta', (centro - esquerda) + 'px');
    clearTimeout(dicaRelogio);
    dicaRelogio = setTimeout(() => el.classList.add('oculto'), 3000);
  }
  function dicaAoSegurar(botao, texto) {
    if (!botao) return;
    let relogio = null;
    let segurou = false;
    const mostrar = () => { segurou = true; mostrarDica(botao, texto); };
    botao.addEventListener('pointerdown', () => { segurou = false; clearTimeout(relogio); relogio = setTimeout(mostrar, 500); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => botao.addEventListener(ev, () => clearTimeout(relogio)));
    // no Android, segurar o dedo também gera este evento: vale como "tocar e segurar"
    botao.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!segurou) { clearTimeout(relogio); mostrar(); } });
    // depois de segurar, soltar o dedo não vale como toque no botão
    botao.addEventListener('click', (e) => { if (segurou) { segurou = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  dicaAoSegurar($('ini-config'), 'Configurações');
  dicaAoSegurar($('btn-mais'), 'Adicionar um item');
  dicaAoSegurar($('vx-mais'), 'Adicionar um item');
  dicaAoSegurar($('vx-config'), 'Configurações do veículo');
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

  // a localização é registrada sem aparecer na tela
  function capturarGpsForm(token) {
    obterLocalizacao().then(pos => { if (Form.token === token) Form.gps = pos; });
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
    travarBanco();
    $('f-titular').value = l.titular || '';
    $('f-estab').value = l.estabelecimento || '';
    $('f-itens').innerHTML = '';
    (l.itens || []).forEach(i => addItem(i));
    atualizarSoma();
    await renderCaixaIA();
    await renderFotosForm();
    $('form-salvar').textContent = Form.modo === 'revisar' ? 'Confirmar' : 'Salvar';
    $('form-excluir').classList.toggle('oculto', Form.modo === 'novo');
  }

  async function renderCaixaIA() {
    const l = Form.l;
    const el = $('form-ia');
    if (l.origem === 'foto') { renderCaixaNota(); return; }
    if (l.origem !== 'voz') { el.innerHTML = ''; return; }
    const audio = (await Banco.porIndice('arquivos', 'lancamentoId', l.id)).find(a => a.tipo === 'audio');
    const baixado = audio && !audio.blob ? baixados.get(audio.id) : null;
    const player = audio && (audio.blob || baixado)
      ? `<audio controls src="${urlDe(audio.blob || baixado)}"></audio>`
      : audio && audio.enviado
        ? `<div class="ouvir-audio" id="f-ouvir-caixa"><button class="botao pequeno" type="button" id="f-ouvir" data-arquivo="${esc(audio.id)}">▶️ Ouvir o áudio</button>` +
          '<small class="dica">O áudio está guardado no servidor (precisa de internet).</small></div>'
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

  $('form-ia').addEventListener('click', async (e) => {
    const b = e.target.closest('#f-ouvir');
    if (!b) return;
    b.disabled = true;
    b.textContent = 'Baixando o áudio…';
    try {
      const blob = await baixarArquivo(b.dataset.arquivo);
      const caixa = $('f-ouvir-caixa');
      if (caixa) caixa.innerHTML = `<audio controls autoplay src="${urlDe(blob)}"></audio>`;
    } catch (err) {
      toast(erroAoBaixar(err, 'o áudio'), 5000);
      if (document.body.contains(b)) { b.disabled = false; b.textContent = '▶️ Ouvir o áudio'; }
    }
  });

  function renderCaixaNota() {
    const l = Form.l;
    const fonte = { sefaz: 'do site da SEFAZ (pelo QR Code da nota)', ia: 'da foto da nota, pela IA', 'sefaz+ia': 'da nota pela IA (foto e site da SEFAZ)' }[l.fonteDados] || '';
    let classe = '';
    let msg = '';
    if (l.status === 'aguardando_ia') {
      classe = 'laranja';
      msg = '<b>Aguardando a leitura da nota.</b> Ela é lida quando for enviada (no Wi-Fi ou pelas setas lá em cima). Se preferir, preencha você mesmo: com valor e categoria preenchidos, o lançamento fica confirmado.';
    } else if (l.status === 'revisar') {
      msg = `<b>Os dados vieram ${fonte || 'da nota'}.</b> Confira, corrija se precisar e toque em Confirmar.`;
    } else if (l.status === 'erro_ia') {
      classe = 'vermelho';
      msg = '<b>Não foi possível ler esta nota.</b> Veja a foto abaixo e preencha os campos.';
    } else {
      msg = `<b>Lançamento feito pela foto da nota.</b>${fonte ? ` Dados lidos ${fonte}.` : ''}`;
    }
    const obs = l.observacaoIA ? `<div class="dica">${esc(l.observacaoIA)}</div>` : '';
    $('form-ia').innerHTML = `<div class="caixa-ia ${classe}">${msg}${obs}</div>`;
  }

  // item: nome; quantidade × preço de cada = valor (o valor é calculado sozinho)
  function addItem(i = {}) {
    const div = document.createElement('div');
    div.className = 'item-linha';
    div.innerHTML = `<input class="i-nome" placeholder="Item" autocapitalize="sentences" value="${esc(i.nome || '')}">` +
      '<button type="button" aria-label="Remover item">✕</button>' +
      `<div class="item-calc"><input class="i-qtd" inputmode="decimal" placeholder="Qtd" aria-label="Quantidade" value="${esc(qtdParaCampo(i.qtd))}">` +
      `<span>×</span><input class="i-unit" inputmode="decimal" placeholder="Preço un." aria-label="Preço de cada" value="${esc(unitParaCampo(i.unitario))}">` +
      `<span>=</span><input class="i-valor" inputmode="decimal" placeholder="Valor" aria-label="Valor do item" value="${i.valor != null ? esc(valorParaCampo(i.valor)) : ''}"></div>`;
    const q = div.querySelector('.i-qtd');
    const u = div.querySelector('.i-unit');
    const v = div.querySelector('.i-valor');
    const calcular = () => {
      const nq = lerQtd(q.value);
      const nu = lerUnit(u.value);
      if (nq != null && nu != null) v.value = valorParaCampo(Math.round(nq * nu * 100) / 100);
    };
    q.addEventListener('input', calcular);
    u.addEventListener('input', calcular);
    div.querySelector('button').onclick = () => { div.remove(); Form.alterado = true; atualizarSoma(); };
    div.querySelectorAll('input').forEach(x => x.addEventListener('input', atualizarSoma));
    $('f-itens').appendChild(div);
  }
  function lerItensForm() {
    return Array.from($('f-itens').querySelectorAll('.item-linha')).map(d => {
      const qtd = lerQtd(d.querySelector('.i-qtd').value);
      const unitario = lerUnit(d.querySelector('.i-unit').value);
      let valor = lerValor(d.querySelector('.i-valor').value);
      if (valor == null && qtd != null && unitario != null) valor = Math.round(qtd * unitario * 100) / 100;
      return { nome: d.querySelector('.i-nome').value.trim(), qtd, unitario, valor };
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
  // pagamento em dinheiro: o dinheiro está com a pessoa, não tem banco/conta (o titular continua)
  function ehDinheiro(meio) {
    return /^(dinheiro|especie|em especie)$/.test(String(meio || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
  }
  function travarBanco() {
    const dinheiro = ehDinheiro($('f-meio').value);
    const b = $('f-banco');
    if (dinheiro) b.value = '';
    b.disabled = dinheiro;
    b.placeholder = dinheiro ? 'Não se aplica (dinheiro)' : 'Ex.: Nubank';
  }
  $('f-meio').addEventListener('change', travarBanco);
  $('f-valor').addEventListener('input', atualizarSoma);
  // (escolher foto não conta como alteração sozinho: só se a pessoa usar a foto no recorte)
  $('tela-form').addEventListener('input', (e) => { if (e.target.type !== 'file') Form.alterado = true; });
  $('tela-form').addEventListener('change', (e) => { if (e.target.type !== 'file') Form.alterado = true; });

  function miniatura(blob, chave) {
    const conteudo = blob ? `<img src="${urlDe(blob)}" alt="foto">` : '<div class="sem-arquivo">☁️ Foto guardada no servidor<b>Toque para ver</b></div>';
    return `<div class="foto" data-ver="${esc(chave)}" role="button" aria-label="Ver a foto">${conteudo}` +
      `<button class="remover" type="button" data-remover="${esc(chave)}" aria-label="Remover foto">✕</button></div>`;
  }

  // ------------------------------------------------------------------
  //  Ver as fotos em tela cheia (e baixar do servidor as que já saíram do celular)
  // ------------------------------------------------------------------
  const listasVisor = {}; // id da lista na tela -> [{ chave, blob, arquivoId }]
  const baixados = new Map(); // arquivos baixados nesta sessão (não são gravados de volta no celular)
  async function base64ParaBlob(base64, mime) {
    try {
      return await (await fetch(`data:${mime};base64,${base64}`)).blob();
    } catch (e) {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
  }
  async function baixarArquivo(arquivoId) {
    if (baixados.has(arquivoId)) return baixados.get(arquivoId);
    if (!navigator.onLine) throw new Api.ErroRede('Sem internet.');
    const r = await Api.chamar('baixarArquivo', { arquivoId }, { tempoMs: 90000 });
    const blob = await base64ParaBlob(r.base64, r.mime || 'application/octet-stream');
    baixados.set(arquivoId, blob);
    return blob;
  }
  function erroAoBaixar(e, oque = 'a foto') {
    if (e instanceof Api.ErroRede) return `Sem internet para baixar ${oque}. Ela continua guardada no servidor: tente de novo quando estiver conectado.`;
    return mensagemErroGeral(e);
  }
  function abrirVisor(lista, chave) {
    const itens = listasVisor[lista] || [];
    const i = itens.findIndex(x => x.chave === chave);
    if (i < 0) return;
    Visor.abrir(itens.map(x => ({ blob: x.blob, arquivoId: x.arquivoId })), i, {
      baixar: (item) => baixarArquivo(item.arquivoId),
      mensagemErro: (e) => erroAoBaixar(e)
    });
  }
  /** Toque na miniatura: abre a foto. Toque no "✕": devolve a chave para remover. */
  function toqueNaMiniatura(e, lista) {
    const b = e.target.closest('[data-remover]');
    if (b) return b.dataset.remover;
    const f = e.target.closest('[data-ver]');
    if (f) abrirVisor(lista, f.dataset.ver);
    return null;
  }
  async function renderFotosForm() {
    const existentes = Form.modo === 'novo' ? [] : (await Banco.porIndice('arquivos', 'lancamentoId', Form.l.id))
      .filter(a => a.tipo === 'foto' && !a.remover && !Form.removerIds.includes(a.id));
    const html = existentes.map(a => miniatura(a.blob, 'e:' + a.id)).concat(Form.fotosNovas.map(f => miniatura(f.blob, 'n:' + f.id)));
    listasVisor['f-fotos'] = existentes.map(a => ({ chave: 'e:' + a.id, blob: a.blob || null, arquivoId: a.id }))
      .concat(Form.fotosNovas.map(f => ({ chave: 'n:' + f.id, blob: f.blob, arquivoId: '' })));
    $('f-fotos').innerHTML = html.join('') || '<small class="dica">Nenhuma foto.</small>';
  }
  $('f-fotos').addEventListener('click', (e) => {
    const chave = toqueNaMiniatura(e, 'f-fotos');
    if (!chave) return;
    const [tipo, id] = chave.split(/:(.+)/);
    if (tipo === 'e') Form.removerIds.push(id);
    else Form.fotosNovas = Form.fotosNovas.filter(f => f.id !== id);
    Form.alterado = true;
    renderFotosForm();
  });

  /** Abre a tela de recorte para cada foto escolhida na galeria; guarda as que a pessoa usar. */
  async function adicionarFotos(input, destino, opcoes = {}) {
    const arquivos = Array.from(input.files || []);
    input.value = '';
    let n = 0;
    for (let i = 0; i < arquivos.length; i++) {
      try {
        const r = await Recorte.abrir(arquivos[i], Object.assign({ titulo: arquivos.length > 1 ? `Foto ${i + 1} de ${arquivos.length}` : '' }, opcoes));
        if (r.acao === 'voltar') break; // "voltar" do Android: desiste das fotos restantes
        if (r.acao === 'usar') { destino.push({ id: novoId(), blob: r.blob, qr: r.qr || null }); n++; }
      } catch (e) {
        toast('Não foi possível usar uma das fotos: ' + e.message, 4500);
      }
    }
    return n;
  }
  // câmera do app (ou a do celular, se a pessoa preferir nas configurações)
  function obterFotoCamera(titulo) {
    if (prefCameraSistema || !Camera.suportada()) return Camera.abrirSistema();
    return Camera.abrir({ titulo });
  }
  /** Tira a foto e vai direto para o recorte ("Repetir foto" volta para a câmera). Devolve quantas fotos foram guardadas. */
  async function tirarFotos(destino, opcoes = {}) {
    for (;;) {
      const arquivo = await obterFotoCamera(opcoes.tituloCamera);
      if (!arquivo) return 0;
      let r;
      try {
        r = await Recorte.abrir(arquivo, Object.assign({ repetir: true }, opcoes));
      } catch (e) {
        toast('Não foi possível usar a foto: ' + e.message, 4500);
        return 0;
      }
      if (r.acao === 'repetir') continue;
      if (r.acao === 'usar') { destino.push({ id: novoId(), blob: r.blob, qr: r.qr || null }); return 1; }
      return 0;
    }
  }
  const OPCOES_COMPROVANTE = { tituloCamera: 'Foto da nota ou comprovante' };
  $('f-camera').onclick = async () => {
    if (await tirarFotos(Form.fotosNovas, OPCOES_COMPROVANTE)) { Form.alterado = true; renderFotosForm(); }
  };
  $('f-galeria').onchange = async (e) => {
    if (await adicionarFotos(e.target, Form.fotosNovas)) { Form.alterado = true; renderFotosForm(); }
  };

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
      banco: ehDinheiro($('f-meio').value) ? '' : $('f-banco').value.trim(),
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
        ['versaoBase', 'tentouEnviar', 'endereco', 'participante', 'transcricao', 'observacaoIA', 'qtdFotos', 'temAudio', 'fonteDados', 'chaveNota'].forEach(k => {
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

  // a localização é registrada sem aparecer na tela
  function capturarGpsVoz(token) {
    obterLocalizacao().then(pos => { if (Voz.token === token) Voz.gps = pos; });
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
    listasVisor['voz-fotos'] = Voz.fotos.map(f => ({ chave: 'n:' + f.id, blob: f.blob, arquivoId: '' }));
    $('voz-fotos').innerHTML = Voz.fotos.map(f => miniatura(f.blob, 'n:' + f.id)).join('') || '<small class="dica">Nenhuma foto.</small>';
  }
  $('voz-fotos').addEventListener('click', (e) => {
    const chave = toqueNaMiniatura(e, 'voz-fotos');
    if (!chave) return;
    const id = chave.split(/:(.+)/)[1];
    Voz.fotos = Voz.fotos.filter(f => f.id !== id);
    renderFotosVoz();
  });
  $('voz-camera').onclick = async () => { if (await tirarFotos(Voz.fotos, OPCOES_COMPROVANTE)) renderFotosVoz(); };
  $('voz-galeria').onchange = async (e) => { if (await adicionarFotos(e.target, Voz.fotos)) renderFotosVoz(); };

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
  //  Lançar por foto: fotos da nota fiscal (o servidor lê pela SEFAZ ou pela IA)
  // ------------------------------------------------------------------
  const Foto = { fotos: [], gps: null, token: null };
  const OPCOES_NOTA = { lerQr: true, ladoMaximo: 2400, qualidade: 0.8, tituloCamera: 'Foto da nota' };

  function qrDaNota() {
    const f = Foto.fotos.find(x => x.qr);
    return f ? f.qr : '';
  }
  function renderFotoNota() {
    listasVisor['foto-lista'] = Foto.fotos.map(f => ({ chave: 'n:' + f.id, blob: f.blob, arquivoId: '' }));
    $('foto-lista').innerHTML = Foto.fotos.map(f => miniatura(f.blob, 'n:' + f.id)).join('') || '<small class="dica">Nenhuma foto ainda.</small>';
    const qr = qrDaNota();
    const el = $('foto-qr');
    el.className = 'foto-qr' + (qr ? ' achou' : '');
    el.textContent = !Foto.fotos.length ? ''
      : qr ? '✓ QR Code da nota encontrado: os dados virão do site da SEFAZ.'
        : 'QR Code não encontrado nas fotos: a IA vai ler a nota.';
    $('foto-camera-texto').textContent = Foto.fotos.length ? 'Tirar mais uma foto' : 'Tirar foto';
    $('foto-salvar').disabled = !Foto.fotos.length;
  }
  async function tirarFotoNota() {
    const titulo = Foto.fotos.length ? `Foto ${Foto.fotos.length + 1} da nota` : 'Foto da nota';
    if (await tirarFotos(Foto.fotos, Object.assign({ titulo }, OPCOES_NOTA))) renderFotoNota();
  }
  async function abrirFoto() {
    const p = await Perfil.obter();
    if (p && p.servidorAntigo) {
      toast('O servidor ainda está na versão antiga e não lê notas por foto. Avise o organizador para atualizar o Apps Script.', 6000);
      return;
    }
    Foto.fotos = [];
    Foto.gps = null;
    Foto.token = novoId();
    const token = Foto.token;
    renderFotoNota();
    mostrarTela('foto');
    obterLocalizacao().then(pos => { if (Foto.token === token) Foto.gps = pos; });
    // a pessoa escolhe: "Tirar foto" (câmera) ou "Galeria"
  }
  $('foto-camera').onclick = () => tirarFotoNota();
  $('foto-galeria').onchange = async (e) => { if (await adicionarFotos(e.target, Foto.fotos, OPCOES_NOTA)) renderFotoNota(); };
  $('foto-lista').addEventListener('click', (e) => {
    const chave = toqueNaMiniatura(e, 'foto-lista');
    if (!chave) return;
    const id = chave.split(/:(.+)/)[1];
    Foto.fotos = Foto.fotos.filter(f => f.id !== id);
    renderFotoNota();
  });
  $('foto-voltar').onclick = () => voltar();
  $('foto-salvar').onclick = async () => {
    if (!Foto.fotos.length) return;
    const agora = Date.now();
    const gps = Foto.gps || {};
    const l = {
      id: novoId(), origem: 'foto', status: 'aguardando_ia', dataHora: agora, criadoEm: agora, alteradoEm: agora,
      descricao: '', itens: [], valorTotal: null, categoria: '', meioPagamento: '', banco: '', titular: '', estabelecimento: '',
      qrNota: qrDaNota(), fotosNota: Foto.fotos.length,
      lat: gps.lat != null ? gps.lat : null, lng: gps.lng != null ? gps.lng : null, precisao: gps.precisao != null ? gps.precisao : null,
      sync: 'pendente', versaoBase: 0
    };
    $('foto-salvar').disabled = true;
    try {
      await Banco.gravar('lancamentos', l);
      for (let i = 0; i < Foto.fotos.length; i++) {
        const f = Foto.fotos[i];
        await Banco.gravar('arquivos', {
          id: f.id, lancamentoId: l.id, tipo: 'foto', mime: 'image/jpeg', blob: f.blob,
          tamanho: f.blob.size, criadoEm: agora + i, enviado: false // a ordem das fotos é a ordem da nota
        });
      }
    } catch (e) {
      toast('Não foi possível salvar no aparelho: ' + e.message, 5000);
      $('foto-salvar').disabled = false;
      return;
    }
    toast(Sync.conexao() === 'wifi'
      ? 'Nota salva. Enviando para leitura…'
      : 'Nota salva no celular. Para enviar, toque nas setas vermelhas lá em cima (no Wi-Fi é automático).', 5000);
    concluirEVoltar();
    agendarSync(500);
  };

  // ------------------------------------------------------------------
  //  Configurações
  // ------------------------------------------------------------------
  function renderConta(p) {
    $('cfg-conta').innerHTML = `<b>${esc(p.nome)}</b><small>Conta conectada neste celular</small>` +
      `<small>WhatsApp: ${p.whatsapp ? esc(formatarZap(p.whatsapp)) : 'não cadastrado'}</small>` +
      `<small>E-mail: ${p.email ? esc(p.email) : '<b class="texto-laranja">não cadastrado</b>'}</small>`;
    $('cfg-email').textContent = p.email ? 'Alterar e-mail' : 'Cadastrar e-mail';
  }

  /** E-mail da conta (V5): cada e-mail só pode estar em uma conta; precisa de internet. */
  function dialogoEmail(p) {
    return dialogoCampos({
      titulo: p.email ? 'Alterar e-mail' : 'Cadastrar e-mail',
      texto: 'Cada e-mail só pode estar em uma conta. Ele é usado para compartilhar veículos com você.',
      campos: [{ id: 'dlg-email', rotulo: 'E-mail', tipo: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'nome@gmail.com', valor: p.email || '' }],
      sim: 'Salvar',
      aoConfirmar: async (v) => {
        const email = normalizarEmail(v['dlg-email']);
        if (!email) return 'Informe um e-mail válido (ex.: nome@gmail.com).';
        if (!navigator.onLine) return 'Sem internet. Conecte o celular e tente de novo.';
        try {
          const r = await Api.chamar('salvarEmail', { email }, { tempoMs: 20000 });
          const atual = await Perfil.obter();
          atual.email = r.email || email;
          atual.precisaEmail = false;
          await Perfil.salvar(atual);
          if (telaAtual === 'config') renderConta(atual);
          toast('E-mail salvo.');
          return '';
        } catch (e) {
          return mensagemErroGeral(e);
        }
      }
    });
  }

  // Conta sem e-mail (criada antes da V5): toda vez que o app abre, pergunta se quer cadastrar (não bloqueia o uso)
  let emailPerguntado = false;
  async function talvezPedirEmail() {
    if (emailPerguntado || removido) return;
    const p = await Perfil.obter();
    if (!p || !p.token || p.precisaEmail !== true) return;
    emailPerguntado = true;
    let espera = 0;
    const tentar = async () => {
      // espera a tela inicial ficar livre (sem "O que há de novo" ou outro aviso aberto)
      if (dialogoAberto || telaAtual !== 'inicio') {
        if ((espera += 1) < 240) setTimeout(tentar, 500); // tenta por até 2 minutos
        else emailPerguntado = false;
        return;
      }
      const atual = await Perfil.obter();
      if (!atual || !atual.token || atual.precisaEmail !== true) return;
      const quer = await escolher('📧 Cadastre seu e-mail. Agora cada conta tem um e-mail (só um por conta): ele é usado para compartilhar veículos com você.', [
        { valor: true, texto: 'Cadastrar', classe: 'primario' },
        { valor: false, texto: 'Agora não' }
      ]);
      if (quer) await dialogoEmail(await Perfil.obter());
    };
    setTimeout(tentar, 900);
  }

  async function abrirConfig() {
    const p = await Perfil.obter();
    if (!p || !p.token) { iniciarBoasVindas(motivoEntrada(p)); return; }
    renderConta(p);
    $('cfg-camera-sistema').checked = prefCameraSistema;
    mostrarTela('config');
    await renderInfo();
  }

  $('cfg-novidades').onclick = () => abrirNovidades();
  $('cfg-camera-sistema').onchange = async (e) => {
    prefCameraSistema = e.target.checked;
    await Banco.gravarConfig('cameraSistema', prefCameraSistema);
    toast(prefCameraSistema ? 'As fotos vão usar a câmera do celular.' : 'As fotos vão usar a câmera do app.');
  };
  $('cfg-zap').onclick = async () => {
    const p = await Perfil.obter();
    await dialogoCampos({
      titulo: 'Alterar WhatsApp',
      texto: 'O número é usado se você esquecer a senha: o organizador manda um código para ele.',
      campos: [{ id: 'dlg-zap', rotulo: 'WhatsApp com DDD', tipo: 'tel', inputmode: 'tel', autocomplete: 'tel-national', placeholder: '(83) 99999-8888', valor: formatarZap(p.whatsapp || ''), mascaraZap: true }],
      sim: 'Salvar',
      aoConfirmar: async (v) => {
        if (!zapValido(v['dlg-zap'])) return 'Informe o WhatsApp com DDD (ex.: (83) 99999-8888).';
        if (!navigator.onLine) return 'Sem internet. Conecte o celular e tente de novo.';
        try {
          renderConta(await salvarWhatsapp(v['dlg-zap']));
          toast('WhatsApp salvo.');
          return '';
        } catch (e) {
          return mensagemErroGeral(e);
        }
      }
    });
  };
  $('cfg-email').onclick = async () => { await dialogoEmail(await Perfil.obter()); };
  $('cfg-senha').onclick = () => dialogoCampos({
    titulo: 'Trocar senha',
    texto: 'Os outros celulares em que você já entrou continuam conectados.',
    campos: [
      { id: 'dlg-s1', rotulo: 'Senha nova', tipo: 'password', autocomplete: 'new-password', placeholder: 'Mínimo 4 dígitos ou letras' },
      { id: 'dlg-s2', rotulo: 'Repita a senha nova', tipo: 'password', autocomplete: 'new-password' }
    ],
    mostrarSenha: true,
    sim: 'Trocar senha',
    aoConfirmar: async (v) => {
      if (v['dlg-s1'].length < 4) return 'A senha precisa ter pelo menos 4 caracteres.';
      if (v['dlg-s1'] !== v['dlg-s2']) return 'As duas senhas não estão iguais.';
      if (!navigator.onLine) return 'Sem internet. Conecte o celular e tente de novo.';
      try {
        await Api.chamar('trocarSenha', { senhaNova: v['dlg-s1'] }, { tempoMs: 20000 });
        toast('Senha trocada. Use a senha nova para entrar em outros celulares.', 4500);
        return '';
      } catch (e) {
        return mensagemErroGeral(e);
      }
    }
  });

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
      ['Versão do app', 'V' + VERSAO_DO_APP],
      ['Conexão', NOMES_CONEXAO[Sync.conexao()]],
      ['Aguardando envio', String(await Sync.pendentes())],
      ['Última sincronização', ultima ? quando(ultima) : 'nunca'],
      ['Armazenamento', armazenamento],
      ['Último erro', erro && erro.mensagem ? `${quando(erro.quando)}: ${erro.mensagem}` : 'nenhum']
    ];
    $('cfg-info').innerHTML = itens.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }

  // "Limpar dados": apaga do celular as fotos e os áudios que já estão no servidor (os gastos ficam);
  // os que ainda não foram enviados ficam até serem enviados e depois saem sozinhos
  function tamanhoTexto(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
  $('cfg-limpar').onclick = async () => {
    const arqs = (await Banco.todos('arquivos')).filter(a => a.blob && !a.remover);
    const enviados = arqs.filter(a => a.enviado);
    const pendentes = arqs.filter(a => !a.enviado && !a.limparAoEnviar);
    if (!enviados.length && !pendentes.length) {
      toast(arqs.length
        ? 'As fotos e os áudios que faltam enviar já vão sair do celular assim que forem enviados.'
        : 'Não há fotos nem áudios guardados neste celular.', 4500);
      return;
    }
    const bytes = enviados.reduce((t, a) => t + ((a.blob && a.blob.size) || 0), 0);
    const fotos = enviados.filter(a => a.tipo === 'foto').length;
    const audios = enviados.length - fotos;
    const partes = [];
    if (fotos) partes.push(plural(fotos, '1 foto', '# fotos'));
    if (audios) partes.push(plural(audios, '1 áudio', '# áudios'));
    let msg = enviados.length
      ? `Apagar deste celular ${partes.join(' e ')} (${tamanhoTexto(bytes)}) que já ${enviados.length === 1 ? 'está' : 'estão'} no servidor? ` +
        'Os gastos continuam aqui, e as fotos e os áudios continuam guardados no servidor.'
      : 'Ainda não há fotos nem áudios enviados para apagar.';
    if (pendentes.length) {
      msg += ' ' + plural(pendentes.length,
        '1 arquivo ainda não foi enviado: ele fica no celular até ser enviado e depois é apagado sozinho.',
        '# arquivos ainda não foram enviados: eles ficam no celular até serem enviados e depois são apagados sozinhos.');
    }
    if (!(await confirmar(msg, 'Limpar', 'Cancelar'))) return;
    let liberados = 0;
    for (const a of enviados.concat(pendentes)) {
      const atual = await Banco.obter('arquivos', a.id);
      if (!atual || !atual.blob) continue;
      if (atual.enviado) {
        liberados += atual.blob.size || 0;
        atual.blob = null;
        atual.limpoEm = Date.now();
      } else {
        atual.limparAoEnviar = true;
      }
      await Banco.gravar('arquivos', atual);
    }
    toast(liberados
      ? `Pronto: ${tamanhoTexto(liberados)} liberados.` + (pendentes.length ? ' O resto sai depois de enviado.' : '')
      : 'Pronto: os arquivos saem do celular depois de enviados.', 4500);
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

  // Remover app: apaga tudo o que o app guardou neste celular (o que foi enviado continua no servidor)
  async function esperarSync() {
    const limite = Date.now() + 120000;
    while (Sync.estaRodando() && Date.now() < limite) await new Promise(ok => setTimeout(ok, 300));
  }
  async function removerApp() {
    removido = true;
    clearTimeout(agendado);
    toast('Removendo…', 20000);
    try { await Api.chamar('sair', {}, { tempoMs: 8000 }); } catch (e) { /* sem internet: a sessão só deixa de ser usada */ }
    try { await Banco.apagarTudo(); } catch (e) { /* segue */ }
    try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* segue */ }
    try {
      if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    } catch (e) { /* segue */ }
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) { /* segue */ }
    $('toast').classList.add('oculto');
    $('dialogo').innerHTML = '';
    dialogoAberto = null;
    mostrarTela('removido', { empilhar: false });
  }
  $('cfg-remover').onclick = async () => {
    const n = await Sync.pendentes();
    if (n > 0) {
      const escolha = await escolher(
        `${plural(n, 'Há 1 lançamento que ainda não foi enviado', 'Há # lançamentos que ainda não foram enviados')} ao servidor. ` +
        `Removendo o app sem enviar, ${plural(n, 'ele será perdido', 'eles serão perdidos')}.`,
        [{ valor: 'enviar', texto: 'Enviar e remover', classe: 'primario' }, { valor: 'remover', texto: 'Remover sem enviar', classe: 'perigo' }, { valor: null, texto: 'Cancelar' }],
        { importante: true });
      if (!escolha) return;
      if (escolha === 'enviar') {
        if (Sync.conexao() === 'offline') { toast('Sem internet. Conecte o celular para enviar antes de remover.', 4500); return; }
        toast('Enviando seus lançamentos…', 60000);
        await esperarSync();
        await Sync.sincronizar({ manual: true });
        const faltam = await Sync.pendentes();
        if (faltam > 0) { toast('Não foi possível enviar tudo. Tente de novo com uma internet melhor.', 5000); return; }
      }
    } else if (!await confirmar('Remover o app deste celular? Tudo o que o app guardou aqui (lançamentos, fotos e áudios) será apagado deste celular. ' +
        'Seus lançamentos continuam guardados no servidor: para voltar, abra o link do app e entre com seu nome e senha.', 'Remover', 'Cancelar')) {
      return;
    }
    await esperarSync();
    await removerApp();
  };

  // ------------------------------------------------------------------
  //  Sincronização automática (só no Wi-Fi) e o ícone do topo
  // ------------------------------------------------------------------
  function agendarSync(atraso = 1500) {
    if (removido) return;
    clearTimeout(agendado);
    agendado = setTimeout(() => { if (!removido && Sync.conexao() === 'wifi') Sync.sincronizar(); }, atraso);
  }
  function textoLidos(r) {
    const notas = r.notas || 0;
    const audios = (r.interpretados || 0) - notas;
    if (notas && !audios) return notas === 1 ? 'Uma nota foi lida. Toque em Revisar.' : `${notas} notas foram lidas. Toque em Revisar.`;
    if (audios && !notas) return audios === 1 ? 'Um áudio foi interpretado. Toque em Revisar.' : `${audios} áudios interpretados. Toque em Revisar.`;
    return `${r.interpretados} lançamentos prontos para revisar. Toque em Revisar.`;
  }

  let ultimoAvisoErro = { msg: '', quando: 0 };
  window.addEventListener('sync-estado', async (ev) => {
    const d = ev.detail;
    if (d.estado === 'sincronizando') {
      // as setas amarelas girando já mostram que está sincronizando (o texto só aparece se a pessoa tocar)
      if ($('sync-rotulo').classList.contains('vermelho')) rotulo('');
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
      if (r.compartilhados && r.compartilhados.length) toast(r.compartilhados.join(' '), 6000);
      else if (r.descompartilhados && r.descompartilhados.length) toast(r.descompartilhados.join(' '), 6000);
      else if (r.interpretados) toast(textoLidos(r), 4500);
      else if (r.veiculosLidos) toast(r.veiculosLidos === 1 ? 'Um abastecimento foi lido. Abra para revisar.' : `${r.veiculosLidos} abastecimentos foram lidos. Abra para revisar.`, 4500);
      else if (r.limite) toast('Limite gratuito da IA atingido. Os áudios e as notas serão lidos mais tarde.', 4500);
      else if (r.iaIndisponivel) toast('IA indisponível agora: ' + r.iaIndisponivel, 4500);
      else if (r.erros.length) toast('Alguns itens não foram enviados; vou tentar de novo.', 4000);
      else if (d.manual && telaAtual === 'config') toast('Sincronização concluída.');
      if (telaAtual === 'inicio') renderInicio();
      else atualizarIconeSync();
      if (telaAtual === 'config') renderInfo();
      if (Veiculos.ehTela(telaAtual)) Veiculos.aoSincronizar();
      buscarPedidos();
      talvezPedirEmail(); // logo depois da atualização para a V5, o servidor avisa aqui que a conta está sem e-mail
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

  window.addEventListener('online', () => { atualizarIconeSync(); agendarSync(); buscarPedidos(); });
  window.addEventListener('offline', () => atualizarIconeSync());
  if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', () => { atualizarIconeSync(); agendarSync(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !removido) { atualizarIconeSync(); agendarSync(500); buscarPedidos(); }
  });
  setInterval(async () => {
    if (removido || document.visibilityState !== 'visible') return;
    buscarPedidos(); // organizador: pedidos de senha (no máximo 1 consulta por minuto)
    if (Sync.conexao() !== 'wifi' || Sync.estaRodando()) return;
    const p = await Perfil.obter();
    if (!p || !p.token) return;
    const n = await Sync.pendentes();
    const ultima = await Banco.lerConfig('ultimaSync', 0);
    if (n > 0 || Date.now() - (ultima || 0) > 5 * 60 * 1000) Sync.sincronizar();
  }, 60000);

  // ------------------------------------------------------------------
  //  Puxar a tela para baixo atualiza (V6): sincroniza e redesenha a tela
  //  em que a pessoa está, sem recarregar o app e sem perder o que estiver
  //  digitado. Nos dados móveis vale como tocar nas setas.
  // ------------------------------------------------------------------
  const PUXAR_LIMITE = 64;
  const SEM_PUXAR = new Set(['boas-vindas', 'senha', 'removido', 'whatsapp']);
  const puxar = { y0: null, d: 0, el: null };
  function prepararPuxar() {
    const el = document.createElement('div');
    el.id = 'puxar-atualizar';
    el.className = 'puxar';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = $('btn-sync').querySelector('svg').outerHTML;
    document.body.appendChild(el);
    puxar.el = el;
    const podeComecar = (e) => e.touches.length === 1 && !dialogoAberto && !removido && window.scrollY <= 0 &&
      !SEM_PUXAR.has(telaAtual) && !Visor.aberto() && !Camera.aberta() && !Recorte.aberto() &&
      !el.classList.contains('girando') && !(e.target.closest && e.target.closest('textarea, select, .fundo-dialogo'));
    document.addEventListener('touchstart', (e) => {
      puxar.y0 = podeComecar(e) ? e.touches[0].clientY : null;
      puxar.d = 0;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (puxar.y0 == null) return;
      const dy = e.touches[0].clientY - puxar.y0;
      if (dy <= 0 || window.scrollY > 0) { if (puxar.d) esconderPuxar(); puxar.d = 0; return; }
      puxar.d = Math.min(dy * 0.5, 110);
      el.classList.add('arrastando');
      el.classList.toggle('pronto', puxar.d >= PUXAR_LIMITE);
      el.style.opacity = String(Math.min(1, puxar.d / 40));
      el.style.transform = `translateY(${puxar.d - 44}px) rotate(${-puxar.d * 3}deg)`;
    }, { passive: true });
    const soltar = () => {
      if (puxar.y0 == null) return;
      puxar.y0 = null;
      el.classList.remove('arrastando');
      if (puxar.d >= PUXAR_LIMITE) atualizarPuxando();
      else esconderPuxar();
      puxar.d = 0;
    };
    document.addEventListener('touchend', soltar, { passive: true });
    document.addEventListener('touchcancel', soltar, { passive: true });
  }
  function esconderPuxar() {
    const el = puxar.el;
    el.classList.remove('arrastando', 'pronto', 'girando');
    el.style.opacity = '0';
    el.style.transform = '';
  }
  async function atualizarPuxando() {
    const el = puxar.el;
    el.classList.add('girando');
    el.classList.remove('pronto');
    el.style.opacity = '1';
    el.style.transform = 'translateY(22px)';
    const inicio = Date.now();
    try {
      let r = await Sync.sincronizar({ manual: true });
      // já estava sincronizando: espera terminar (no máximo 3 minutos)
      while (r && r.ignorado === 'rodando' && Sync.estaRodando() && Date.now() - inicio < 180000) {
        await new Promise(ok => setTimeout(ok, 400));
        if (!Sync.estaRodando()) r = null;
      }
      // a sincronização redesenha a tela inicial e as listas dos veículos; nas outras telas nada é apagado
      if (telaAtual === 'inicio' && r && r.ignorado) renderInicio();
    } catch (e) { /* o aviso da sincronização já aparece */ }
    const falta = 600 - (Date.now() - inicio);
    if (falta > 0) await new Promise(ok => setTimeout(ok, falta));
    esconderPuxar();
  }
  prepararPuxar();

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

  // ------------------------------------------------------------------
  //  Funções do app usadas pelas telas dos veículos (veiculos.js)
  // ------------------------------------------------------------------
  window.App = {
    esc, brl, plural, toast, confirmar, escolher, abrirDialogo, fecharDialogo, menuMais, listas, preencherSelect,
    obterLocalizacao, mensagemErroGeral, miniatura, listasVisor, toqueNaMiniatura, baixarArquivo, erroAoBaixar,
    tirarFotos, adicionarFotos, fmtDuracao, urlDe, agendarSync, mostrarTela, voltar, exibirInicio, quandoHistoricoPronto,
    chaveDia, ehDinheiro, normalizarEmail, dialogoCampos, mostrarDica,
    telaAtual: () => telaAtual,
    dadosTela: () => dadosTela
  };

  async function iniciar() {
    try {
      await Banco.abrir();
    } catch (e) {
      document.body.innerHTML = `<p style="padding:24px">Não foi possível abrir o armazenamento do app: ${esc(e.message)}</p>`;
      return;
    }
    try { await guardarCodigoDoLink(); } catch (e) { /* segue */ }
    try { await limparArquivosAntigos(); } catch (e) { /* não impede o uso */ }
    $('ini-versao').textContent = 'v' + VERSAO_DO_APP;
    Melhorias.colocarIcones(); // ícone discreto do pedido de correção ou melhoria (V6)
    prefCameraSistema = !!(await Banco.lerConfig('cameraSistema', false));
    const perfil = await Perfil.obter();
    if (!perfil || !perfil.token) { iniciarBoasVindas(motivoEntrada(perfil)); return; }
    await exibirInicio();
    agendarSync(800);
    buscarPedidos(true);
    // "O que há de novo" abre sozinho uma vez depois de cada atualização
    if ((await Banco.lerConfig('versaoVista', null)) !== VERSAO_DO_APP) {
      await Banco.gravarConfig('versaoVista', VERSAO_DO_APP);
      setTimeout(abrirNovidades, 700);
    }
    talvezPedirEmail(); // conta sem e-mail: pergunta toda vez que o app abre
  }

  iniciar();
})();
