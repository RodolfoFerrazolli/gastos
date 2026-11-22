// =====================================================================
//  PEDIDOS DE CORREÇÃO E MELHORIA (V6)
//  Em toda tela (depois de entrar na conta), um ícone discreto no topo
//  abre a janela para gravar um áudio (e, se quiser, escrever) contando
//  o problema ou a ideia. Vai junto uma imagem da tela. O pedido fica no
//  celular e sobe na sincronização; só o organizador vê, no painel.
//  Cada tela tem um número fixo (catálogo de telas, que vai no zip de
//  cada versão). O número nunca aparece no app: só no painel.
// =====================================================================
const Melhorias = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App;

  // Números fixos das telas: uma tela nova ganha o próximo número livre; número de tela que sair não volta a ser usado.
  const CATALOGO = {
    1: 'Tela inicial',
    2: 'Menu do "+" da tela inicial (saiu na V7)',
    3: 'Lançar por voz',
    4: 'Lançar por foto (nota fiscal)',
    5: 'Lançamento (por texto, editar ou revisar)',
    6: 'Câmera do app',
    7: 'Recortar a foto',
    8: 'Ver a foto (tela cheia)',
    9: 'Configurações',
    10: 'O que há de novo',
    11: 'Entrar / Criar conta',
    12: 'Esqueci minha senha',
    13: 'Cadastrar o WhatsApp',
    14: 'App removido',
    15: 'Veículos (lista)',
    16: 'Cadastro do veículo (novo ou editar)',
    17: 'Extrato do veículo',
    18: 'Menu do "+" do veículo',
    19: 'Abastecimento',
    20: 'Manutenção (lista)',
    21: 'Manutenção (item)',
    22: 'Despesas (Seguro, Impostos, Multas e Outros)',
    23: 'Seguro (lista)',
    24: 'Seguro (item)',
    25: 'Impostos (IPVA e Licenciamento)',
    26: 'IPVA (lista)',
    27: 'IPVA (pagamento)',
    28: 'Licenciamento (lista)',
    29: 'Licenciamento (pagamento)',
    30: 'Multas (lista)',
    31: 'Multa (item)',
    32: 'Outras despesas (lista)',
    33: 'Outra despesa (item)',
    34: 'Galeria do veículo (lista)',
    35: 'Galeria do veículo (item)',
    36: 'Compartilhar veículo',
    37: 'Engrenagem do veículo',
    38: 'Informações do veículo',
    39: 'Calendário (datas dos veículos)',
    40: 'Pedido de correção ou melhoria',
    41: 'Lançamentos (histórico)',
    42: 'Relatório do veículo',
    43: 'Relatório: Gastos (lista)',
    44: 'Relatório: Gastos (gráfico)',
    45: 'Relatório: Desempenho',
    46: 'Exportar planilha do veículo',
    47: 'Grupos (lista)',
    48: 'Grupo: Despesas',
    49: 'Grupo: Saldos',
    50: 'Grupo: Acertar',
    51: 'Grupo: Pessoas',
    52: 'Despesa do grupo (nova ou editar)',
    53: 'Pessoa do grupo (adicionar ou editar)',
    54: 'Relatório do grupo',
    55: 'Quem falta te pagar (grupo)',
    56: 'Menu do "+" dos Lançamentos',
    57: 'Ver lançamento',
    58: 'Ver gasto do veículo',
    59: 'Ver despesa do grupo',
    60: 'Pedido resolvido (aviso)',
    61: 'Pedido não vai ser feito (aviso)'
  };
  const LISTA = { manutencao: 20, seguro: 23, ipva: 26, licenciamento: 28, multa: 30, outros: 32, galeria: 34 };
  const ITEM = { abastecimento: 19, manutencao: 21, seguro: 24, ipva: 27, licenciamento: 29, multa: 31, outros: 33, galeria: 35 };
  const TELAS_SIMPLES = {
    inicio: 1, voz: 3, foto: 4, form: 5, config: 9, 'boas-vindas': 11, senha: 12, whatsapp: 13, removido: 14,
    veiculos: 15, 'veiculo-form': 16, veiculo: 17, 'v-compartilhar': 36,
    lancamentos: 41, 'v-relatorio': 42, 'v-desempenho': 45,
    grupos: 47, 'grupo-despesa': 52, 'grupo-pessoa': 53, 'grupo-relatorio': 54
  };
  const ABA_GRUPO = { despesas: 48, saldos: 49, acertar: 50, pessoas: 51 };
  // telas em que o ícone não aparece (ainda sem conta)
  const SEM_ICONE = new Set(['boas-vindas', 'senha', 'removido']);

  const visivel = (id) => { const el = $(id); return !!el && !el.classList.contains('oculto'); };

  /** Número e nome da tela que está na frente agora. */
  function telaAtual() {
    let num = 0;
    if (visivel('visor')) num = 8;
    else if (document.querySelector('.aviso-pedido.feliz')) num = 60; // V10
    else if (document.querySelector('.aviso-pedido.triste')) num = 61;
    else if (document.querySelector('.folha-mais') && App().telaAtual() === 'lancamentos') num = 56;
    else if (document.querySelector('.dialogo.exportar')) num = 46; // V8
    else if (document.querySelector('.dialogo.g-folha')) num = 55; // V9
    else if (visivel('recorte')) num = 7;
    else if (visivel('camera')) num = 6;
    else {
      const tela = App().telaAtual();
      const tipo = typeof Veiculos !== 'undefined' && Veiculos.tipoNaTela ? Veiculos.tipoNaTela() : '';
      if (tela === 'v-registro') num = ITEM[tipo] || 0;
      else if (tela === 'v-lista') num = LISTA[tipo] || 0;
      else if (tela === 'v-menu') num = tipo === 'impostos' ? 25 : 22;
      else if (tela === 'grupo') num = ABA_GRUPO[typeof Grupos !== 'undefined' ? Grupos.abaAtual() : ''] || 48;
      else if (tela === 'v-gastos') num = typeof Relatorio !== 'undefined' && Relatorio.abaAtual() === 'grafico' ? 44 : 43;
      else if (tela === 'ver') num = ({ lanc: 57, reg: 58, gdesp: 59 })[(App().dadosTela() || {}).tipo] || 57; // V10
      else num = TELAS_SIMPLES[tela] || 0;
    }
    return { num, nome: CATALOGO[num] || App().telaAtual() || 'tela' };
  }

  // ---- ícone discreto no topo de cada tela ----
  const SVG_BUG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17a6.002 6.002 0 0 0-2.83 0L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-4 7c0 2.21-1.79 4-4 4s-4-1.79-4-4v-4c0-2.21 1.79-4 4-4s4 1.79 4 4v4zm-6-1h4v2h-4v-2zm0-4h4v2h-4v-2z"/></svg>';
  function colocarIcones() {
    document.querySelectorAll('section.tela').forEach((sec) => {
      const nome = sec.id.replace(/^tela-/, '');
      const topo = sec.querySelector('header.topo');
      if (!topo || SEM_ICONE.has(nome) || topo.querySelector('.botao-bug')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'botao-bug';
      b.setAttribute('aria-label', 'Avisar um problema ou dar uma ideia');
      b.title = 'Avisar um problema ou dar uma ideia';
      b.innerHTML = SVG_BUG;
      b.addEventListener('click', abrir);
      // fica antes do último botão do topo (a engrenagem, por exemplo); no topo sem botões, fica no fim
      const acoes = topo.querySelector('.topo-acoes');
      if (acoes) acoes.insertBefore(b, acoes.firstChild);
      else if (topo.lastElementChild && topo.lastElementChild.tagName === 'SPAN' && !topo.lastElementChild.children.length) topo.replaceChild(b, topo.lastElementChild);
      else topo.appendChild(b);
    });
  }

  // ---- imagem da tela (o Chrome não deixa o app tirar print: ele desenha a própria tela) ----
  let carregando = null;
  function carregarBiblioteca() {
    if (window.html2canvas) return Promise.resolve();
    if (!carregando) {
      carregando = new Promise((ok, falhou) => {
        const s = document.createElement('script');
        s.src = 'vendor/html2canvas.min.js';
        s.onload = () => ok();
        s.onerror = () => { carregando = null; falhou(new Error('não carregou')); };
        document.head.appendChild(s);
      });
    }
    return carregando;
  }
  async function imagemDaTela() {
    try {
      await carregarBiblioteca();
      const canvas = await window.html2canvas(document.body, {
        backgroundColor: '#eef2f6', logging: false, useCORS: true, scale: Math.min(2, window.devicePixelRatio || 1),
        x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight,
        windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
        ignoreElements: (el) => el.id === 'toast' || el.id === 'dica-flutuante' || el.id === 'puxar-atualizar'
      });
      return await new Promise((ok) => canvas.toBlob((b) => ok(b), 'image/jpeg', 0.72));
    } catch (e) {
      return null; // sem a imagem, o pedido vai assim mesmo
    }
  }

  // V10: o Chrome novo esconde o modelo no texto do navegador ("K"); o modelo de verdade vem do Aparelho.info()
  async function modeloDoCelular() {
    const ua = navigator.userAgent || '';
    const m = ua.match(/Android\s+([\d.]+);\s*([^;)]+)/);
    let modelo = m && m[2].trim() !== 'K' ? m[2].trim() : '';
    let android = m ? m[1] : '';
    try {
      const i = await Aparelho.info();
      if (i.modelo) modelo = i.modelo;
      if (i.android) android = i.android;
    } catch (e) { /* fica o do navegador */ }
    if (modelo) return android ? `${modelo} · Android ${android}` : modelo;
    return m ? `celular · Android ${android}` : ua.slice(0, 100);
  }
  const MAX_IMAGENS = 5; // a imagem da tela + fotos (tirar foto ou galeria)

  // ---- janela do pedido ----
  let P = null; // pedido sendo montado
  async function abrir() {
    if (P) return;
    if (Gravador.gravando()) { App().toast('Termine a gravação que está em andamento antes.'); return; }
    const tela = telaAtual();
    P = { id: novoId(), tela, imagem: null, audio: null, duracao: 0, relogio: null, url: '', fotos: [] };
    const pedido = P;
    App().toast('Preparando…', 1500);
    pedido.imagem = await imagemDaTela();
    if (P !== pedido) return;
    $('toast').classList.add('oculto');
    pedido.url = pedido.imagem ? URL.createObjectURL(pedido.imagem) : '';
    App().abrirDialogo('<div class="fundo-dialogo"><div class="dialogo pedido-melhoria" role="dialog" aria-label="Avisar um problema ou dar uma ideia">' +
      '<h2>🐞 Problema ou ideia</h2>' +
      '<p class="dica">Conte o que está errado nesta tela ou o que pode melhorar. O pedido vai só para o organizador, junto com uma imagem desta tela.</p>' +
      // V10: a imagem da tela (com × para tirar) e mais fotos (tirar foto ou da galeria), até 5 no total
      '<div class="pm-fotos" id="pm-fotos"></div>' +
      '<div class="pm-botoes"><button class="botao" type="button" id="pm-camera">📷 Tirar foto</button>' +
      '<label class="botao arquivo" id="pm-galeria-botao">🖼️ Galeria<input type="file" accept="image/*" multiple id="pm-galeria"></label></div>' +
      '<div class="pm-conta" id="pm-conta"></div>' +
      '<button class="botao" type="button" id="pm-gravar">🎤 Gravar áudio</button>' +
      '<div id="pm-audio"></div>' +
      '<label for="pm-texto">Ou escreva (opcional)</label>' +
      '<textarea id="pm-texto" rows="3" maxlength="3000" autocapitalize="sentences" placeholder="Ex.: o botão Salvar está cobrindo o campo do valor"></textarea>' +
      '<p class="erro" id="pm-erro"></p>' +
      '<div class="botoes"><button class="botao" type="button" id="pm-cancelar">Cancelar</button>' +
      '<button class="botao primario" type="button" id="pm-enviar">Enviar</button></div></div></div>', () => descartar());
    $('pm-gravar').onclick = () => alternarGravacao();
    renderFotos();
    $('pm-fotos').addEventListener('click', (e) => {
      const x = e.target.closest('[data-tirar]');
      if (!x || !P) return;
      if (x.dataset.tirar === 'tela') { if (P.url) URL.revokeObjectURL(P.url); P.imagem = null; P.url = ''; }
      else P.fotos = P.fotos.filter((f) => f.id !== x.dataset.tirar);
      renderFotos();
    });
    $('pm-camera').onclick = async () => {
      if (!P || cabem() <= 0) return;
      const pedido = P;
      const novas = [];
      if (await App().tirarFotos(novas, { tituloCamera: 'Foto para o pedido' }) && P === pedido) { pedido.fotos.push(...novas.slice(0, cabem())); renderFotos(); }
    };
    $('pm-galeria').onchange = async (e) => {
      if (!P) return;
      const pedido = P;
      const novas = [];
      if (await App().adicionarFotos(e.target, novas) && P === pedido) { pedido.fotos.push(...novas.slice(0, cabem())); renderFotos(); }
    };
    $('pm-cancelar').onclick = () => { App().fecharDialogo(); descartar(); };
    $('pm-enviar').onclick = () => enviar();
  }

  function cabem() { return P ? MAX_IMAGENS - (P.imagem ? 1 : 0) - P.fotos.length : 0; }
  function renderFotos() {
    const caixa = $('pm-fotos');
    if (!caixa || !P) return;
    const itens = [];
    if (P.imagem && P.url) itens.push(`<div class="pm-foto"><img src="${P.url}" alt="Imagem desta tela"><button class="x" type="button" data-tirar="tela" aria-label="Tirar a imagem da tela">×</button><small>esta tela</small></div>`);
    P.fotos.forEach((f) => itens.push(`<div class="pm-foto"><img src="${App().urlDe(f.blob)}" alt="foto"><button class="x" type="button" data-tirar="${f.id}" aria-label="Tirar esta foto">×</button><small>foto</small></div>`));
    caixa.innerHTML = itens.join('');
    caixa.classList.toggle('oculto', !itens.length);
    const total = itens.length;
    $('pm-conta').textContent = total ? `${total} de ${MAX_IMAGENS} ${MAX_IMAGENS === 1 ? 'foto' : 'fotos'}` : `Você pode juntar até ${MAX_IMAGENS} fotos.`;
    const cheio = cabem() <= 0;
    $('pm-camera').disabled = cheio;
    $('pm-galeria').disabled = cheio;
    $('pm-galeria-botao').classList.toggle('desativado', cheio);
  }

  function descartar() {
    if (!P) return;
    clearInterval(P.relogio);
    if (Gravador.gravando()) Gravador.cancelar();
    if (P.url) URL.revokeObjectURL(P.url);
    P = null;
  }

  async function alternarGravacao() {
    const b = $('pm-gravar');
    if (!P || !b) return;
    if (Gravador.gravando()) { await pararGravacao(); return; }
    if (!Gravador.suportado()) { $('pm-erro').textContent = 'Este navegador não permite gravar áudio. Escreva o pedido.'; return; }
    try {
      await Gravador.iniciar();
    } catch (e) {
      $('pm-erro').textContent = e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para gravar.' : 'Não foi possível usar o microfone.';
      return;
    }
    $('pm-erro').textContent = '';
    b.classList.add('gravando');
    const tique = () => { const x = $('pm-gravar'); if (x && Gravador.gravando()) x.textContent = `⏹ Parar (${App().fmtDuracao(Gravador.segundos())})`; };
    tique();
    P.relogio = setInterval(tique, 500);
  }

  async function pararGravacao() {
    const pedido = P;
    clearInterval(pedido.relogio);
    const res = await Gravador.parar();
    if (P !== pedido) return;
    const b = $('pm-gravar');
    if (b) b.classList.remove('gravando');
    if (!res) { if (b) b.textContent = '🎤 Gravar áudio'; return; }
    pedido.audio = res.blob;
    pedido.duracao = res.duracao;
    if (b) b.textContent = '🎤 Gravar de novo';
    $('pm-audio').innerHTML = `<audio controls src="${App().urlDe(res.blob)}"></audio>`;
  }

  async function enviar() {
    const pedido = P;
    if (!pedido) return;
    if (Gravador.gravando()) await pararGravacao();
    const texto = ($('pm-texto').value || '').trim();
    if (!pedido.audio && !texto) { $('pm-erro').textContent = 'Grave um áudio ou escreva o que aconteceu.'; return; }
    const registro = {
      id: pedido.id, criadoEm: Date.now(), tela: pedido.tela.num ? String(pedido.tela.num) : '', nomeTela: pedido.tela.nome, texto,
      audio: pedido.audio, audioMime: pedido.audio ? (pedido.audio.type || 'audio/webm') : '', duracao: pedido.duracao || 0,
      imagem: pedido.imagem, fotos: pedido.fotos.map((f) => f.blob), versaoApp: typeof VERSAO_DO_APP !== 'undefined' ? VERSAO_DO_APP : '',
      aparelho: await modeloDoCelular()
    };
    try {
      const lista = (await Banco.lerConfig('melhoriasPendentes', [])) || [];
      lista.push(registro);
      await Banco.gravarConfig('melhoriasPendentes', lista);
    } catch (e) {
      $('pm-erro').textContent = 'Não foi possível guardar o pedido: ' + e.message;
      return;
    }
    App().fecharDialogo();
    descartar();
    App().toast(Sync.conexao() === 'wifi' ? 'Obrigado! O pedido vai para o organizador agora.'
      : 'Obrigado! O pedido vai para o organizador na próxima sincronização (no Wi-Fi é automático).', 4500);
    App().agendarSync(800);
  }

  function novoId() {
    return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }

  return { colocarIcones, telaAtual, abrir, CATALOGO };
})();
