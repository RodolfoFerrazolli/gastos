// =====================================================================
//  VEÍCULOS (V4)
//  Cada conta cadastra os seus veículos (montadora, modelo, ano e placa)
//  e lança os gastos de cada um: abastecimento, manutenção, despesas
//  (seguro, IPVA, licenciamento, multas e outros) e uma galeria de
//  fotos. Esses gastos não aparecem no histórico da tela inicial: cada
//  veículo tem o extrato dele. Tudo vai para o servidor, então nada se
//  perde ao entrar na conta em outro celular.
//  As telas ficam uma dentro da outra; cada uma guarda no histórico do
//  navegador quais dados mostra (o "voltar" do Android volta uma tela).
//  V5: cor do veículo, compartilhamento com outras contas (o dono pode
//  tudo; quem recebe lança e mexe só no que lançou), os três valores do
//  abastecimento (dois calculam o terceiro) e o calendário das datas.
//  V6: os gastos (menos a Galeria) também aparecem na tela inicial;
//  observação no cadastro e ℹ️ com as informações do veículo; o
//  abastecimento guarda vários áudios e várias fotos (nota, bomba e
//  painel), lidos juntos pela IA numa leitura só.
// =====================================================================
const Veiculos = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App; // funções do app.js (que é carregado depois deste arquivo)

  const TELAS = ['veiculos', 'veiculo-form', 'veiculo', 'v-menu', 'v-lista', 'v-registro', 'v-compartilhar', 'v-relatorio', 'v-gastos', 'v-desempenho'];
  const COMBUSTIVEIS = ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Premium', 'Etanol Comum', 'Etanol Aditivado',
    'Diesel S10', 'Diesel S500', 'GNV'];
  // sugestões no campo "Montadora" (dá para digitar outra)
  const MONTADORAS = ['Audi', 'BMW', 'BYD', 'Caoa Chery', 'Chevrolet', 'Citroën', 'Dafra', 'Fiat', 'Ford', 'GWM', 'Harley-Davidson',
    'Honda', 'Hyundai', 'Iveco', 'JAC', 'Jeep', 'Kawasaki', 'Kia', 'Land Rover', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan',
    'Peugeot', 'Porsche', 'RAM', 'Renault', 'Royal Enfield', 'Scania', 'Shineray', 'Subaru', 'Suzuki', 'Toyota', 'Triumph',
    'Volkswagen', 'Volvo', 'Yamaha'];
  // sugestões no campo "Cor" (dá para digitar qualquer outra)
  const CORES = ['Branco', 'Preto', 'Prata', 'Cinza', 'Grafite', 'Vermelho', 'Vinho', 'Azul', 'Verde', 'Amarelo', 'Laranja',
    'Bege', 'Marrom', 'Dourado', 'Rosa', 'Roxo'];
  const TIPOS = {
    abastecimento: { icone: '⛽', nome: 'Abastecimento', novo: 'Novo abastecimento', isto: 'este abastecimento', salvo: 'Abastecimento salvo', excluir: 'Excluir abastecimento' },
    manutencao: { icone: '🔧', nome: 'Manutenção', lista: 'Manutenção', novo: 'Nova manutenção', isto: 'esta manutenção', salvo: 'Manutenção salva', excluir: 'Excluir manutenção', adicionar: '+ Adicionar item', vazio: 'Nenhuma manutenção lançada.' },
    seguro: { icone: '🛡️', nome: 'Seguro', lista: 'Seguro', novo: 'Novo seguro', isto: 'este seguro', salvo: 'Seguro salvo', excluir: 'Excluir seguro', adicionar: '+ Adicionar seguro', vazio: 'Nenhum seguro lançado.' },
    ipva: { icone: '🏛️', nome: 'IPVA', lista: 'IPVA', novo: 'Pagamento do IPVA', isto: 'este pagamento do IPVA', salvo: 'Pagamento salvo', excluir: 'Excluir pagamento', adicionar: '+ Adicionar pagamento', vazio: 'Nenhum pagamento do IPVA lançado.' },
    licenciamento: { icone: '📄', nome: 'Licenciamento', lista: 'Licenciamento', novo: 'Pagamento do licenciamento', isto: 'este pagamento do licenciamento', salvo: 'Pagamento salvo', excluir: 'Excluir pagamento', adicionar: '+ Adicionar pagamento', vazio: 'Nenhum pagamento do licenciamento lançado.' },
    multa: { icone: '🚨', nome: 'Multa', lista: 'Multas', novo: 'Nova multa', isto: 'esta multa', salvo: 'Multa salva', excluir: 'Excluir multa', adicionar: '+ Adicionar multa', vazio: 'Nenhuma multa lançada.' },
    outros: { icone: '📦', nome: 'Outros', lista: 'Outros', novo: 'Outra despesa', isto: 'esta despesa', salvo: 'Despesa salva', excluir: 'Excluir despesa', adicionar: '+ Adicionar despesa', vazio: 'Nenhuma despesa lançada.' },
    galeria: { icone: '📷', nome: 'Galeria', lista: 'Galeria', novo: 'Galeria', isto: 'este item da galeria (com as fotos)', salvo: 'Galeria salva', excluir: 'Excluir da galeria', adicionar: '+ Adicionar', vazio: 'Nenhuma foto na galeria ainda.' }
  };
  const TEM_KM = new Set(['abastecimento', 'manutencao']);
  const TEM_LOCAL = new Set(['abastecimento', 'manutencao', 'galeria']);
  const KM_MAXIMO = 1000000;
  // fotos do abastecimento (V6): da nota, da bomba e do painel; o QR Code da nota é procurado em todas
  const OPCOES_NOTA_POSTO = { lerQr: true, ladoMaximo: 2400, qualidade: 0.8, tituloCamera: 'Foto do abastecimento', titulo: 'Foto do abastecimento' };
  const OPCOES_FOTO_VEICULO = { tituloCamera: 'Foto do veículo', titulo: 'Foto do veículo' };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  // campo da tela -> campo do gasto (o que a pessoa mexe deixa de ser "automático" e a IA não troca)
  const CAMPO = {
    'vr-combustivel': 'combustivel', 'vr-tanque': 'tanqueCheio', 'vr-km': 'hodometro', 'vr-preco': 'precoLitro', 'vr-valor': 'valor',
    'vr-litros': 'litros', 'vr-data': 'data', 'vr-pagamento': 'formaPagamento', 'vr-local': 'local', 'vr-descricao': 'descricao'
  };
  // abastecimento: valor do litro × litros = valor total (campo da tela -> campo do gasto)
  const TRES = { 'vr-preco': 'precoLitro', 'vr-litros': 'litros', 'vr-valor': 'valor' };
  const ID_TRES = { precoLitro: 'vr-preco', litros: 'vr-litros', valor: 'vr-valor' };

  // ------------------------------------------------------------------
  //  Utilidades
  // ------------------------------------------------------------------
  const esc = (s) => App().esc(s);
  const brl = (v) => App().brl(v);
  const toast = (m, ms) => App().toast(m, ms);
  function hoje() { return App().chaveDia(Date.now()); }
  function dataCurta(d) {
    const p = String(d || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : '';
  }
  function rotuloMes(chave) {
    const [a, m] = String(chave).split('-');
    return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} de ${a}` : '';
  }
  function fmtNum(n, casas) {
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  function fmtKm(n) { return Number(n).toLocaleString('pt-BR') + ' km'; }
  function brl3(v) { return 'R$\u00a0' + fmtNum(v, 3); } // valor do litro, com 3 casas
  function unidade(comb) { return comb === 'GNV' ? 'm³' : 'L'; }
  function nomeVeiculo(v) { return `${v.modelo} · ${v.placa}`; }
  /** O veículo é da conta (e não compartilhado com ela por outra pessoa)? */
  function ehMeu(v) { return !!v && v.meu !== false; }
  /** Quem pode mudar um gasto: quem lançou e o dono do veículo. */
  function podeAlterar(r, v) { return r.meu !== false || ehMeu(v); }
  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0]; }
  /** Quem lançou: o primeiro nome; de uma conta que o organizador excluiu (V7): "Maria (conta excluída)". */
  function autorDe(participante) {
    const p = String(participante || '').trim();
    const excluida = /\(conta exclu[íi]da\)\s*$/i.test(p);
    const nome = primeiroNome(p.replace(/\(conta exclu[íi]da\)\s*$/i, ''));
    return nome && excluida ? nome + ' (conta excluída)' : nome;
  }
  async function compartilhamentosDe(veiculoId) {
    const m = (await Banco.lerConfig('compartilhamentos', {})) || {};
    return m[veiculoId] || [];
  }
  /**
   * Os três valores do abastecimento não batem? (litro × litros ≠ total)
   * Aceita alguns centavos de diferença, mais o arredondamento das 3 casas do litro e dos litros.
   */
  function difValores(preco, litros, total) {
    const p = Number(preco);
    const l = Number(litros);
    const t = Number(total);
    if (!(p > 0 && l > 0 && t > 0)) return null;
    const conta = Math.round(p * l * 100) / 100;
    const dif = Math.round((t - conta) * 100) / 100;
    return Math.abs(dif) > 0.05 + 0.0005 * (l + p) ? { conta, dif } : null;
  }
  function textoDifValores(p, l, t, comb) {
    const d = difValores(p, l, t);
    if (!d) return '';
    const u = unidade(comb);
    return `${brl3(p)} × ${fmtNum(l, 3)} ${u} = ${brl(d.conta)}, mas o valor total está ${brl(t)} ` +
      `(${d.dif > 0 ? 'sobram' : 'faltam'} ${brl(Math.abs(d.dif))}).`;
  }
  function primeiraLinha(t) { return String(t || '').split('\n')[0].trim(); }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function maiuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /** "ABC1D23" (Mercosul) ou "ABC-1234" (antiga); '' se não for placa. */
  function normalizarPlaca(v) {
    const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z]{3}\d{4}$/.test(s)) return s.slice(0, 3) + '-' + s.slice(3);
    if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(s)) return s;
    return '';
  }
  function normalizarMontadora(v) {
    const t = String(v || '').replace(/\s+/g, ' ').trim();
    return MONTADORAS.find(m => semAcento(m) === semAcento(t)) || t;
  }
  function normalizarCor(v) {
    const t = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return CORES.find(c => semAcento(c) === semAcento(t)) || (t ? maiuscula(t) : '');
  }
  /** Ordem dos gastos: pela data e, no mesmo dia, pela hora em que foram lançados. */
  function compararData(a, b) {
    return String(a.data || '').localeCompare(String(b.data || '')) || (a.criadoEm || 0) - (b.criadoEm || 0);
  }
  function totalDe(regs) {
    return Math.round(regs.reduce((s, r) => s + (r.tipo !== 'galeria' && r.valor > 0 ? Number(r.valor) : 0), 0) * 100) / 100;
  }
  function meiosVeiculo(meios) {
    const lista = (meios || []).slice();
    if (!lista.some(m => /boleto/i.test(m))) lista.push('Boleto');
    return lista;
  }
  function toastSalvo(msg) {
    if (Sync.conexao() === 'wifi') toast(msg + '.');
    else toast(msg + ' no celular. Para enviar, toque nas setas vermelhas da tela inicial.', 5000);
  }

  // ---- valores digitados como numa calculadora: 6 -> 0,006 -> 0,061 -> 0,619 -> 6,199 ----
  const MAX_DIGITOS = { 2: 9, 3: 6 }; // até R$ 9.999.999,99 e R$ 999,999 o litro
  function textoMascara(digitos, casas) {
    const d = String(digitos).padStart(casas + 1, '0');
    const inteiros = d.slice(0, d.length - casas).replace(/^0+(?=\d)/, '');
    return inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d.slice(d.length - casas);
  }
  function paraMascara(v, casas) {
    if (v == null || v === '' || isNaN(v) || Number(v) <= 0) return '';
    return textoMascara(String(Math.round(Number(v) * Math.pow(10, casas))), casas);
  }
  function daMascara(input) {
    if (!input) return null;
    const d = input.value.replace(/\D/g, '');
    if (!d || !Number(d)) return null;
    return Number(d) / Math.pow(10, Number(input.dataset.casas || 2));
  }
  function fimDoCampo(input) {
    const n = input.value.length;
    try { input.setSelectionRange(n, n); } catch (e) { /* campo sem cursor */ }
  }
  function caixaRegistradora(input) {
    const casas = Number(input.dataset.casas || 2);
    const maximo = MAX_DIGITOS[casas] || 9;
    const formatar = (d) => {
      d = d.replace(/\D/g, '').replace(/^0+/, '').slice(0, maximo);
      input.value = d ? textoMascara(d, casas) : '';
      fimDoCampo(input);
    };
    // o número sempre entra pela direita e o "apagar" tira o último, onde quer que esteja o cursor;
    // num valor que o app pôs sozinho (calculado ou sugerido), o primeiro toque começa do zero (V5)
    input.addEventListener('beforeinput', (e) => {
      const semSelecao = input.selectionStart === input.selectionEnd;
      const doZero = input.dataset.substituir === '1';
      if (e.inputType === 'insertText' && e.data != null && semSelecao) {
        e.preventDefault();
        const novos = e.data.replace(/\D/g, '');
        if (!novos) return;
        delete input.dataset.substituir;
        formatar((doZero ? '' : input.value) + novos);
      } else if ((e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') && semSelecao) {
        e.preventDefault();
        delete input.dataset.substituir;
        formatar(doZero ? '' : input.value.replace(/\D/g, '').slice(0, -1));
      } else {
        return; // colar, apagar uma seleção, teclados que compõem o texto: o "input" abaixo arruma
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    input.addEventListener('input', () => formatar(input.value));
    ['focus', 'click'].forEach(ev => input.addEventListener(ev, () => setTimeout(() => fimDoCampo(input), 0)));
  }
  // ---- hodômetro: só números inteiros, até 1.000.000, com o ponto do milhar ----
  function mascaraKm(input) {
    input.addEventListener('input', () => {
      let d = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 7);
      if (Number(d) > KM_MAXIMO) { d = d.slice(0, 6); toast('O hodômetro vai até 1.000.000 km.'); }
      input.value = d ? Number(d).toLocaleString('pt-BR') : '';
      fimDoCampo(input);
    });
  }
  function daKm(input) {
    const d = input ? input.value.replace(/\D/g, '') : '';
    return d ? Number(d) : null;
  }
  function textoKm(n) { return n == null || n === '' ? '' : Number(n).toLocaleString('pt-BR'); }

  // ------------------------------------------------------------------
  //  Dados guardados no celular
  // ------------------------------------------------------------------
  async function veiculoAtivo(id) {
    const v = id ? await Banco.obter('veiculos', id) : null;
    return v && !v.excluirPendente ? v : null;
  }
  async function listaVeiculos() {
    return (await Banco.todos('veiculos')).filter(v => !v.excluirPendente)
      .sort((a, b) => semAcento(a.modelo).localeCompare(semAcento(b.modelo)) || String(a.placa).localeCompare(String(b.placa)));
  }
  async function gastosDo(veiculoId) {
    return (await Banco.porIndice('registros', 'veiculoId', veiculoId)).filter(r => !r.excluirPendente);
  }
  async function arquivosDe(ids) {
    const quero = new Set(ids);
    const por = {};
    (await Banco.todos('arquivos')).forEach((a) => {
      if (quero.has(a.lancamentoId) && !a.remover) (por[a.lancamentoId] = por[a.lancamentoId] || []).push(a);
    });
    return por;
  }

  /**
   * ⚠️ dos gastos com hodômetro: 'sem' (não informado) ou 'ordem' (km menor que o do gasto anterior).
   * Quando dois vizinhos não combinam, o aviso fica no que foi lançado por último (o que a pessoa
   * salvou mesmo com o aviso); corrigindo qualquer um dos dois, o aviso some.
   */
  function analisarKm(regs) {
    const res = new Map();
    const comKm = regs.filter(r => TEM_KM.has(r.tipo)).sort(compararData);
    comKm.forEach((r) => { if (r.hodometro == null && r.status !== 'aguardando_ia') res.set(r.id, 'sem'); });
    const lista = comKm.filter(r => r.hodometro != null);
    for (let i = 1; i < lista.length; i++) {
      const ant = lista[i - 1];
      const atual = lista[i];
      if (atual.hodometro < ant.hodometro) res.set(((atual.criadoEm || 0) >= (ant.criadoEm || 0) ? atual : ant).id, 'ordem');
    }
    return res;
  }

  // ------------------------------------------------------------------
  //  Navegação entre as telas dos veículos
  // ------------------------------------------------------------------
  const rolagens = {}; // posição da lista de cada tela, para voltar no mesmo lugar
  const chaveRolagem = (tela, dados) => tela + '|' + JSON.stringify(dados || {});
  const dadosAtuais = () => App().dadosTela() || {};
  let navegando = false;

  function ehTela(nome) { return TELAS.includes(nome); }

  /** Monta a tela com os dados; devolve false se o que ela mostraria não existe mais (ex.: veículo excluído). */
  async function preparar(tela, dados) {
    dados = dados || {};
    switch (tela) {
      case 'veiculos': return renderVeiculos();
      case 'veiculo-form': return prepararFormVeiculo(dados.veiculoId || null);
      case 'veiculo': return renderVeiculo(dados.veiculoId);
      case 'v-menu': return renderMenu(dados.veiculoId, dados.menu);
      case 'v-lista': return renderLista(dados.veiculoId, dados.tipo);
      case 'v-registro': return prepararRegistro(dados);
      case 'v-compartilhar': return renderCompartilhar(dados.veiculoId);
      case 'v-relatorio': case 'v-gastos': case 'v-desempenho': return Relatorio.preparar(tela, dados); // V7 (relatorio.js)
      default: return false;
    }
  }

  /** Abre uma tela "por cima" da atual (ganha uma entrada no histórico). */
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

  /** Volta para uma tela que já estava no histórico (chamado pelo "voltar"). */
  async function mostrar(tela, dados) {
    if (!(await preparar(tela, dados))) { history.back(); return; } // não existe mais: volta mais uma tela
    App().mostrarTela(tela, { empilhar: false, dados: dados || {} });
    const y = rolagens[chaveRolagem(tela, dados)];
    if (y) window.scrollTo(0, y);
  }

  /** Antes de sair de uma tela: confirma se há alterações não salvas. */
  async function podeSair() {
    const tela = App().telaAtual();
    if (tela === 'v-registro' && VR) {
      const mudou = VR.alterado || VR.fotosNovas.length || VR.audiosNovos.length || Gravador.gravando();
      if (mudou && !(await App().confirmar('Descartar as alterações deste lançamento?', 'Descartar', 'Continuar editando'))) return false;
      if (Gravador.gravando()) { clearInterval(VR.relogio); Gravador.cancelar(); }
      VR.token = null; // a resposta da IA que ainda chegar é ignorada
      VR.alterado = false;
      VR.fotosNovas = [];
      VR.audiosNovos = [];
      return true;
    }
    if (tela === 'veiculo-form' && VF.alterado) {
      const ok = await App().confirmar('Descartar as alterações do veículo?', 'Descartar', 'Continuar editando');
      if (ok) VF.alterado = false;
      return ok;
    }
    return true;
  }

  /** Terminou uma sincronização: as listas abertas mostram o que chegou. */
  async function aoSincronizar() {
    const tela = App().telaAtual();
    if (!['veiculos', 'veiculo', 'v-menu', 'v-lista', 'v-compartilhar', 'v-relatorio', 'v-gastos', 'v-desempenho'].includes(tela) || navegando) return;
    const y = window.scrollY;
    if (!(await preparar(tela, dadosAtuais()))) { history.back(); return; } // o veículo foi excluído em outro celular
    if (App().telaAtual() === tela) window.scrollTo(0, y);
  }

  // ------------------------------------------------------------------
  //  Lista dos veículos
  // ------------------------------------------------------------------
  async function renderVeiculos() {
    const vs = await listaVeiculos();
    const totais = {};
    (await Banco.todos('registros')).forEach((r) => {
      if (!r.excluirPendente && r.tipo !== 'galeria' && r.valor > 0) totais[r.veiculoId] = (totais[r.veiculoId] || 0) + Number(r.valor);
    });
    const perfil = await Perfil.obter();
    const comp = (await Banco.lerConfig('compartilhamentos', {})) || {};
    const pendentes = (await Banco.lerConfig('compartilhamentosPendentes', [])) || [];
    let html = perfil && perfil.servidorSemVeiculos
      ? '<div class="alerta-caixa laranja">O servidor ainda não foi atualizado para a versão 4. Os veículos e os gastos deles ficam guardados neste celular e são enviados depois que o organizador atualizar o Apps Script.</div>'
      : '';
    // compartilhamento pendente: a pessoa já tem um veículo com a mesma placa (precisa excluir o dela para receber)
    pendentes.forEach((p) => {
      const dele = vs.find(v => ehMeu(v) && v.placa === p.placa);
      const quem = esc(primeiroNome(p.dono) || 'Alguém');
      const carro = `<b>${esc(p.modelo || p.veiculo)} (${esc(p.placa)})</b>`;
      html += '<div class="alerta-caixa laranja coluna aviso-pendente">' + (dele
        ? `<div>👥 ${quem} compartilhou o ${carro} com você, mas você já tem um veículo com essa placa. ` +
          'Para receber o compartilhamento, exclua o seu veículo (os gastos dele também são excluídos). Até lá, ele fica pendente.</div>'
        : `<div>👥 ${quem} compartilhou o ${carro} com você. Ele aparece aqui depois da próxima sincronização.</div>`) +
        '<div class="linha-botoes">' +
        (dele ? `<button class="botao pequeno" type="button" data-acao="abrir-meu" data-id="${esc(dele.id)}">Abrir o meu veículo</button>` : '') +
        `<button class="botao pequeno" type="button" data-acao="recusar" data-id="${esc(p.veiculoId)}">Recusar</button></div></div>`;
    });
    // sem veículo: só o botão "Adicionar veículo"
    html += vs.map((v) => {
      const meta = [esc(v.placa)];
      if (v.cor) meta.push(esc(v.cor));
      if (!ehMeu(v)) meta.push(`👥 de ${esc(primeiroNome(v.dono) || 'outra conta')}`);
      else if ((comp[v.id] || []).length) meta.push('👥 compartilhado');
      if (ehMeu(v) && !v.cor) meta.push('<span class="aviso-km">⚠️ sem cor</span>');
      return `<div class="cartao" data-veiculo="${esc(v.id)}" role="button">` +
        `<div class="corpo"><div class="desc">🚗 ${esc(v.modelo)}</div><div class="meta">${meta.join(' · ')}</div></div>` +
        `<div class="direita"><span class="valor">${brl(Math.round((totais[v.id] || 0) * 100) / 100)}</span>` +
        `${v.sync === 'pendente' ? '<span class="selo fila">Na fila</span>' : ''}</div></div>`;
    }).join('');
    $('vc-lista').innerHTML = html;
    return true;
  }

  /** Entrar em Veículos (pelo "+" da tela inicial): veículo da conta sem cor ganha um aviso, toda vez (não bloqueia). */
  async function abrirLista() {
    await ir('veiculos', {});
    if (App().telaAtual() !== 'veiculos') return;
    const semCor = (await listaVeiculos()).filter(v => ehMeu(v) && !v.cor);
    if (!semCor.length) return;
    const nomes = semCor.map(v => `${v.modelo} (${v.placa})`);
    const msg = semCor.length === 1
      ? `🎨 O ${nomes[0]} está sem a cor. Agora a cor do veículo é obrigatória: complete o cadastro.`
      : `🎨 Estes veículos estão sem a cor: ${nomes.join(', ')}. Agora a cor do veículo é obrigatória: complete o cadastro deles.`;
    const sim = semCor.length === 1 ? 'Informar a cor' : `Começar pelo ${semCor[0].modelo}`;
    if (await App().confirmar(msg, sim, 'Agora não') && App().telaAtual() === 'veiculos') ir('veiculo-form', { veiculoId: semCor[0].id });
  }

  /** Quem recebeu um compartilhamento pendente pode recusar (o veículo não aparece para ela). */
  async function recusarPendente(veiculoId) {
    const p = ((await Banco.lerConfig('compartilhamentosPendentes', [])) || []).find(x => x.veiculoId === veiculoId);
    if (!p) return;
    if (!(await App().confirmar(`Recusar o ${p.modelo} (${p.placa}) que ${primeiroNome(p.dono) || 'a pessoa'} compartilhou com você?`, 'Recusar', 'Cancelar'))) return;
    if (Sync.conexao() === 'offline') { toast('Sem internet. Para recusar, o celular precisa estar conectado.'); return; }
    try {
      await Api.chamar('sairCompartilhamento', { veiculoId }, { tempoMs: 20000 });
    } catch (e) {
      toast(App().mensagemErroGeral(e), 5000);
      return;
    }
    const resto = ((await Banco.lerConfig('compartilhamentosPendentes', [])) || []).filter(x => x.veiculoId !== veiculoId);
    await Banco.gravarConfig('compartilhamentosPendentes', resto);
    toast('Compartilhamento recusado.');
    if (App().telaAtual() === 'veiculos') renderVeiculos();
  }

  // ------------------------------------------------------------------
  //  Cadastro do veículo
  // ------------------------------------------------------------------
  const VF = { id: null, alterado: false };

  async function prepararFormVeiculo(id) {
    let v = null;
    if (id) {
      v = await veiculoAtivo(id);
      if (!v || !ehMeu(v)) return false; // compartilhado: só o dono altera o cadastro
    }
    VF.id = id;
    VF.alterado = false;
    $('vf-titulo').textContent = v ? 'Editar veículo' : 'Novo veículo';
    $('vf-montadora').value = v ? v.montadora || '' : '';
    $('vf-modelo').value = v ? v.modelo || '' : '';
    $('vf-ano').value = v && v.ano ? String(v.ano) : '';
    $('vf-placa').value = v ? v.placa || '' : '';
    $('vf-cor').value = v ? v.cor || '' : '';
    $('vf-obs').value = v ? v.observacao || '' : '';
    contarLetrasObs();
    // veículo de antes da V5, sem a cor: o campo já aparece marcado
    $('vf-erro').textContent = v && !v.cor ? 'Falta a cor do veículo.' : '';
    $('vf-cor').classList.toggle('falta', !!(v && !v.cor));
    $('vf-excluir').classList.toggle('oculto', !v);
    return true;
  }

  async function salvarVeiculo() {
    const erro = (m) => { $('vf-erro').textContent = m; };
    const montadora = normalizarMontadora($('vf-montadora').value);
    const modelo = $('vf-modelo').value.replace(/\s+/g, ' ').trim();
    const anoTexto = $('vf-ano').value.trim();
    const ano = Number(anoTexto);
    const anoMaximo = new Date().getFullYear() + 1;
    const placa = normalizarPlaca($('vf-placa').value);
    const cor = normalizarCor($('vf-cor').value);
    const observacao = $('vf-obs').value.trim().slice(0, 1000);
    if (!montadora) return erro('Informe a montadora.');
    if (!modelo) return erro('Informe o modelo.');
    if (!/^\d{4}$/.test(anoTexto) || ano < 1900 || ano > anoMaximo) return erro(`Informe o ano com 4 números (de 1900 a ${anoMaximo}).`);
    if (!placa) return erro('Placa inválida. Use o formato ABC1D23 (Mercosul) ou ABC-1234.');
    if (!cor) return erro('Informe a cor do veículo.');
    const repetida = (await listaVeiculos()).find(x => x.id !== VF.id && x.placa === placa);
    if (repetida && ehMeu(repetida)) return erro(`Você já cadastrou um veículo com a placa ${placa} (${repetida.modelo}).`);
    if (repetida) return erro(`O veículo com a placa ${placa} (${repetida.modelo}) já está na sua lista: ${primeiroNome(repetida.dono) || 'outra pessoa'} compartilhou com você.`);
    const agora = Date.now();
    let v = VF.id ? await Banco.obter('veiculos', VF.id) : null;
    if (VF.id && (!v || v.excluirPendente)) { toast('Este veículo não existe mais.'); VF.alterado = false; App().voltar(); return; }
    if (!v) v = { id: novoId(), criadoEm: agora, versaoBase: 0 };
    Object.assign(v, { montadora, modelo, ano, placa, cor, observacao, alteradoEm: agora, sync: 'pendente' });
    const botao = $('vf-salvar');
    botao.disabled = true;
    try {
      await Banco.gravar('veiculos', v);
    } catch (e) {
      toast('Não foi possível salvar no aparelho: ' + e.message, 5000);
      return;
    } finally {
      botao.disabled = false;
    }
    toastSalvo(VF.id ? 'Veículo salvo' : 'Veículo cadastrado');
    VF.alterado = false;
    App().voltar();
    App().agendarSync(800);
  }

  function contarLetrasObs() {
    const n = $('vf-obs').value.length;
    $('vf-obs-contador').textContent = n ? `${n} de 1000 letras` : '';
  }

  async function excluirVeiculo() {
    const v = await veiculoAtivo(VF.id);
    if (!v) return;
    const regs = await gastosDo(v.id);
    const n = regs.length;
    const comp = await compartilhamentosDe(v.id);
    const nomes = comp.map(c => primeiroNome(c.nome)).filter(Boolean);
    const msg = `Excluir o ${v.modelo} (${v.placa})?` +
      (n ? ` ${App().plural(n, 'O gasto lançado nele também será excluído', 'Os # gastos lançados nele também serão excluídos')}, com as fotos.` : '') +
      (nomes.length ? ` Ele também some para ${nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]}, com quem está compartilhado.` : '');
    if (!(await App().confirmar(msg, 'Excluir', 'Cancelar'))) return;
    if (!v.tentouEnviar && !v.versaoBase) {
      await Sync.apagarVeiculoLocal(v.id); // nunca foi enviado: basta apagar daqui
    } else {
      v.excluirPendente = true;
      v.alteradoEm = Date.now();
      await Banco.gravar('veiculos', v);
      // os gastos que nunca foram enviados saem daqui; os outros saem junto com o veículo, no servidor
      for (const r of regs) if (!r.tentouEnviar && !r.versaoBase) await Sync.apagarLocal(r.id, 'registros');
    }
    VF.alterado = false;
    toast('Veículo excluído.');
    App().voltar(); // a tela do veículo não existe mais: o "voltar" segue até a lista
    App().agendarSync(800);
  }

  // ------------------------------------------------------------------
  //  Extrato do veículo
  // ------------------------------------------------------------------
  /** autor: primeiro nome de quem lançou (só nos veículos compartilhados); '' para não mostrar. */
  function cartaoGasto(r, arqs, avisoKm, comMiniatura, autor, veiculo) {
    const t = TIPOS[r.tipo] || { icone: '•', nome: r.tipo };
    const fotos = arqs.filter(a => a.tipo === 'foto');
    const nFotos = Math.max(fotos.length, Number(r.qtdFotos) || 0);
    let titulo = t.nome;
    const meta = [dataCurta(r.data)];
    if (r.tipo === 'abastecimento') {
      if (r.combustivel) titulo += ' · ' + r.combustivel;
      if (r.hodometro != null) meta.push(fmtKm(r.hodometro));
      if (r.litros > 0) meta.push(fmtNum(r.litros, 3) + ' ' + unidade(r.combustivel));
      if (r.tanqueCheio) meta.push('tanque cheio');
    } else if (r.tipo === 'manutencao') {
      if (r.descricao) titulo = primeiraLinha(r.descricao);
      if (r.hodometro != null) meta.push(fmtKm(r.hodometro));
    } else if (r.tipo === 'seguro') {
      if (r.seguradora) titulo += ' · ' + r.seguradora;
      if (r.validade) meta.push('validade ' + dataCurta(r.validade));
    } else if (r.tipo === 'ipva' || r.tipo === 'licenciamento') {
      if (r.formaPagamento) meta.push(r.formaPagamento);
    } else if (r.tipo === 'multa') {
      if (r.descricao) titulo += ' · ' + primeiraLinha(r.descricao);
      meta[0] = 'infração em ' + meta[0];
    } else if (r.tipo === 'outros') {
      if (r.descricao) titulo = primeiraLinha(r.descricao);
    } else if (r.tipo === 'galeria') {
      if (r.descricao) titulo = primeiraLinha(r.descricao);
      meta.push(nFotos ? App().plural(nFotos, '1 foto', '# fotos') : 'sem fotos');
      if (r.local) meta.push(r.local);
    }
    if (autor) meta.push('por ' + autor);
    if (veiculo) meta[0] = '🚗 ' + nomeVeiculo(veiculo); // tela inicial (V6): a data já está no título do dia
    let metaHtml = meta.filter(Boolean).map(esc).join(' · ');
    // os avisos são botões: tocar explica o porquê (V5)
    const aviso = (tipo, texto) => ` · <button type="button" class="aviso-km aviso-botao" data-aviso="${tipo}" data-id="${esc(r.id)}">⚠️ ${texto}</button>`;
    if (avisoKm === 'sem') metaHtml += aviso('sem', 'sem hodômetro');
    if (avisoKm === 'ordem') metaHtml += aviso('ordem', 'km fora de ordem');
    if (r.tipo === 'abastecimento' && difValores(r.precoLitro, r.litros, r.valor)) metaHtml += aviso('valores', 'valores não batem');
    const selos = [];
    if (r.status === 'aguardando_ia') selos.push('<span class="selo aguardando">Aguardando leitura</span>');
    if (r.status === 'revisar') selos.push('<span class="selo revisar">Revisar</span>');
    if (r.sync === 'pendente' || arqs.some(a => !a.enviado && a.blob)) selos.push('<span class="selo fila">Na fila</span>');
    const valor = r.tipo === 'galeria' ? `📷${nFotos > 1 ? ' ' + nFotos : ''}` : brl(r.valor);
    let mini = '';
    if (comMiniatura) {
      const primeira = fotos.filter(a => a.blob).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))[0];
      mini = `<div class="miniatura">${primeira ? `<img src="${App().urlDe(primeira.blob)}" alt="">` : '📷'}</div>`;
    }
    return `<div class="cartao${comMiniatura ? ' com-miniatura' : ''}" data-registro="${esc(r.id)}" role="button">${mini}` +
      `<div class="corpo"><div class="desc"><span class="icone-tipo" aria-hidden="true">${t.icone}</span> ${esc(titulo)}</div><div class="meta">${metaHtml}</div></div>` +
      `<div class="direita"><span class="valor">${valor}</span>${selos.join('')}</div></div>`;
  }

  async function renderVeiculo(id) {
    const v = await veiculoAtivo(id);
    if (!v) return false;
    const regs = (await gastosDo(id)).sort((a, b) => compararData(b, a)); // do mais novo para o mais velho
    const arqs = await arquivosDe(regs.map(r => r.id));
    const km = analisarKm(regs);
    const autorDe = await autores(v, regs);
    $('vx-titulo').textContent = v.modelo;
    $('vx-sub').textContent = [v.placa, ehMeu(v) ? '' : '👥 de ' + (primeiroNome(v.dono) || 'outra conta'), [v.montadora, v.ano].filter(Boolean).join(' '), v.cor]
      .filter(Boolean).join(' · ');
    $('vx-totais').innerHTML = `<div><small>Total</small> <b>${brl(totalDe(regs))}</b></div>`;
    if (!regs.length) {
      $('vx-lista').innerHTML = '<div class="vazio">Nenhum gasto lançado ainda.<br>Toque no botão <b>+</b> lá embaixo para lançar.</div>';
      return true;
    }
    let html = '';
    let mesAtual = '';
    regs.forEach((r) => {
      const m = String(r.data).slice(0, 7);
      if (m !== mesAtual) { mesAtual = m; html += `<div class="dia">${esc(rotuloMes(m))}</div>`; }
      html += cartaoGasto(r, arqs[r.id] || [], km.get(r.id), false, autorDe(r));
    });
    $('vx-lista').innerHTML = html;
    return true;
  }

  /**
   * Nos veículos compartilhados, o extrato mostra quem lançou cada gasto.
   * Devolve a função gasto -> primeiro nome (ou '' quando o veículo não é compartilhado).
   */
  async function autores(v, regs) {
    const compartilhado = !ehMeu(v) || (await compartilhamentosDe(v.id)).length > 0 || regs.some(r => r.meu === false);
    if (!compartilhado) return () => '';
    const eu = primeiroNome(((await Perfil.obter()) || {}).nome);
    return (r) => autorDe(r.participante) || (r.meu === false ? '' : eu);
  }

  /** Engrenagem da tela do veículo: o dono edita e compartilha; quem recebeu pode sair do compartilhamento. */
  async function configDoVeiculo() {
    const v = await veiculoAtivo(dadosAtuais().veiculoId);
    if (!v) return;
    if (ehMeu(v)) {
      const comp = await compartilhamentosDe(v.id);
      const escolha = await App().escolher(`${v.modelo} · ${v.placa}` + (comp.length ? ` (compartilhado com ${App().plural(comp.length, '1 pessoa', '# pessoas')})` : ''), [
        { valor: 'editar', texto: '✏️ Editar veículo' },
        { valor: 'compartilhar', texto: '👥 Compartilhar veículo' },
        { valor: null, texto: 'Cancelar' }
      ]);
      if (escolha === 'editar') ir('veiculo-form', { veiculoId: v.id });
      if (escolha === 'compartilhar') ir('v-compartilhar', { veiculoId: v.id });
      return;
    }
    const quem = primeiroNome(v.dono) || 'Outra pessoa';
    const escolha = await App().escolher(`👥 ${quem} compartilhou o ${v.modelo} (${v.placa}) com você. Você vê tudo e lança gastos; ` +
      'só altera ou exclui os gastos que você lançou.', [
      { valor: 'sair', texto: '🚪 Sair do compartilhamento', classe: 'perigo' },
      { valor: null, texto: 'Fechar' }
    ]);
    if (escolha === 'sair') sairDoCompartilhamento(v);
  }

  async function sairDoCompartilhamento(v) {
    const naFila = (await gastosDo(v.id)).filter(r => r.sync === 'pendente' && r.meu !== false).length;
    if (naFila) {
      toast(`Antes de sair, sincronize: ${App().plural(naFila, 'há 1 gasto seu', 'há # gastos seus')} deste veículo ainda não ${App().plural(naFila, 'enviado', 'enviados')}.`, 6000);
      return;
    }
    if (!(await App().confirmar(`Sair do compartilhamento do ${v.modelo} (${v.placa})? Ele some da sua lista. Os gastos que você lançou nele continuam no veículo.`,
      'Sair', 'Cancelar'))) return;
    if (Sync.conexao() === 'offline') { toast('Sem internet. Para sair do compartilhamento, o celular precisa estar conectado.'); return; }
    try {
      await Api.chamar('sairCompartilhamento', { veiculoId: v.id }, { tempoMs: 20000 });
    } catch (e) {
      toast(App().mensagemErroGeral(e), 5000);
      return;
    }
    await Sync.apagarVeiculoLocal(v.id);
    toast('Você saiu do compartilhamento.');
    App().voltar(); // a tela do veículo não existe mais: o "voltar" segue até a lista
  }

  /** ℹ️ da tela do veículo (V6): tudo o que está cadastrado, só para ver (também para quem recebeu o compartilhamento). */
  async function infoDoVeiculo() {
    const v = await veiculoAtivo(dadosAtuais().veiculoId);
    if (!v) return;
    const linha = (rot, val) => `<div class="info-linha"><small>${rot}</small><div>${val ? esc(val) : '<span class="dica">Não informado</span>'}</div></div>`;
    let comp = '';
    if (ehMeu(v)) {
      const lista = await compartilhamentosDe(v.id);
      comp = lista.length
        ? lista.map(c => esc(c.nome) + (c.situacao === 'pendente' ? ' <small class="texto-laranja">(pendente)</small>' : '')).join('<br>')
        : 'Não está compartilhado.';
    } else {
      comp = `${esc(primeiroNome(v.dono) || 'Outra pessoa')} compartilhou com você.`;
    }
    const obs = v.observacao ? `<div class="info-obs">${esc(v.observacao)}</div>` : '<span class="dica">Nenhuma observação.</span>';
    App().abrirDialogo('<div class="fundo-dialogo"><div class="dialogo info-veiculo" role="dialog"><h2>ℹ️ Informações do veículo</h2>' +
      linha('Montadora', v.montadora) + linha('Modelo', v.modelo) + linha('Ano', v.ano ? String(v.ano) : '') +
      linha('Placa', v.placa) + linha('Cor', v.cor) +
      `<div class="info-linha"><small>Observação</small><div>${obs}</div></div>` +
      linha('Dono', ehMeu(v) ? 'Você' : (v.dono || 'Outra pessoa')) +
      `<div class="info-linha"><small>Compartilhamento</small><div>${comp}</div></div>` +
      '<div class="botoes"><button class="botao primario" type="button" id="vi-ok">Fechar</button></div></div></div>',
    () => { /* só fecha */ }, { fora: true });
    $('vi-ok').onclick = () => App().fecharDialogo();
  }

  /** Tocar no ⚠️ de um gasto explica o porquê. */
  async function explicarAviso(tipo, id) {
    const r = await Banco.obter('registros', id);
    if (!r) return;
    let msg = '';
    if (tipo === 'sem') {
      msg = 'Este lançamento está sem o hodômetro (o km do painel). Abra o lançamento e informe o km para tirar o ⚠️.';
    } else if (tipo === 'ordem') {
      const comKm = (await gastosDo(r.veiculoId)).filter(x => TEM_KM.has(x.tipo) && x.hodometro != null).sort(compararData);
      const i = comKm.findIndex(x => x.id === r.id);
      const ant = comKm[i - 1];
      const prox = comKm[i + 1];
      const de = (x) => `${x.tipo === 'manutencao' ? 'da manutenção' : 'do abastecimento'} de ${dataCurta(x.data)} (${fmtKm(x.hodometro)})`;
      if (ant && r.hodometro < ant.hodometro) msg = `O hodômetro deste lançamento (${fmtKm(r.hodometro)}) está menor que o ${de(ant)}, que é de antes.`;
      else if (prox && r.hodometro > prox.hodometro) msg = `O hodômetro deste lançamento (${fmtKm(r.hodometro)}) está maior que o ${de(prox)}, que é de depois.`;
      else msg = 'O hodômetro deste lançamento não combina com o de um lançamento vizinho.';
      msg += ' Confira os números (e as datas): corrigindo, o ⚠️ some.';
    } else if (tipo === 'valores') {
      msg = `Os três valores deste abastecimento não batem: ${textoDifValores(r.precoLitro, r.litros, r.valor, r.combustivel)} ` +
        'Confira o valor do litro, os litros e o valor total (ex.: no painel da bomba ou na nota). Se estiverem certos (um desconto, por exemplo), pode deixar assim.';
    }
    if (msg) await App().escolher('⚠️ ' + msg, [{ valor: true, texto: 'Entendi', classe: 'primario' }]);
  }

  async function menuDoVeiculo() {
    const d = dadosAtuais();
    const escolha = await App().menuMais('Lançar gasto do veículo', [
      { valor: 'abastecimento', id: 'vx-abastecimento', icone: '⛽', texto: 'Abastecimento' },
      { valor: 'manutencao', id: 'vx-manutencao', icone: '🔧', texto: 'Manutenção' },
      { valor: 'despesas', id: 'vx-despesas', icone: '🧾', texto: 'Despesas' },
      { valor: 'galeria', id: 'vx-galeria', icone: '📷', texto: 'Galeria' },
      { valor: 'relatorio', id: 'vx-relatorio', icone: '📊', texto: 'Relatório', larga: true } // V7
    ]);
    if (escolha === 'relatorio') ir('v-relatorio', { veiculoId: d.veiculoId });
    else if (escolha === 'abastecimento') ir('v-registro', { veiculoId: d.veiculoId, tipo: 'abastecimento' });
    else if (escolha === 'despesas') ir('v-menu', { veiculoId: d.veiculoId, menu: 'despesas' });
    else if (escolha) ir('v-lista', { veiculoId: d.veiculoId, tipo: escolha });
  }

  // ------------------------------------------------------------------
  //  Compartilhar o veículo (V5): pelo primeiro nome e o e-mail da pessoa; precisa de internet
  // ------------------------------------------------------------------
  async function renderCompartilhar(veiculoId) {
    const v = await veiculoAtivo(veiculoId);
    if (!v || !ehMeu(v)) return false;
    const lista = (await compartilhamentosDe(v.id)).slice().sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    $('vs-sub').textContent = nomeVeiculo(v);
    $('vs-pessoas').innerHTML = lista.length
      ? lista.map(c => '<div class="pessoa">' +
          `<div class="pessoa-nome"><b>${esc(c.nome)}</b>` +
          (c.situacao === 'pendente'
            ? '<small class="texto-laranja">⏳ Pendente: a pessoa já tem um veículo com a mesma placa. Vale quando ela excluir o dela.</small>'
            : `<small>Com acesso${c.criadoEm ? ' desde ' + dataCurta(App().chaveDia(c.criadoEm)) : ''}</small>`) +
          `</div><button class="botao pequeno perigo" type="button" data-remover-comp="${esc(c.id)}">Remover</button></div>`).join('')
      : '<p class="dica">Ainda não está compartilhado com ninguém.</p>';
    const naoEnviado = !v.versaoBase;
    $('vs-aviso').innerHTML = naoEnviado
      ? '<div class="alerta-caixa laranja">Este veículo ainda não foi enviado ao servidor. Sincronize (setas da tela inicial) antes de compartilhar.</div>'
      : '';
    $('vs-compartilhar').disabled = naoEnviado;
    $('vs-erro').textContent = '';
    return true;
  }

  async function guardarCompartilhamentos(veiculoId, lista) {
    const m = (await Banco.lerConfig('compartilhamentos', {})) || {};
    if (lista.length) m[veiculoId] = lista; else delete m[veiculoId];
    await Banco.gravarConfig('compartilhamentos', m);
  }

  async function compartilhar() {
    const veiculoId = dadosAtuais().veiculoId;
    const v = await veiculoAtivo(veiculoId);
    if (!v) return;
    const erro = (m) => { $('vs-erro').textContent = m; };
    const nome = primeiroNome($('vs-nome').value.replace(/[^\p{L}\s'-]/gu, ' '));
    const email = App().normalizarEmail($('vs-email').value);
    erro('');
    if (!nome) return erro('Informe o primeiro nome da pessoa.');
    if (!email) return erro('Informe o e-mail da pessoa (ex.: nome@gmail.com).');
    if (Sync.conexao() === 'offline') return erro('Sem internet. Para compartilhar, o celular precisa estar conectado.');
    const botao = $('vs-compartilhar');
    botao.disabled = true;
    botao.textContent = 'Compartilhando…';
    let r;
    try {
      r = await Api.chamar('compartilharVeiculo', { veiculoId, nome, email }, { tempoMs: 30000 });
    } catch (e) {
      erro(App().mensagemErroGeral(e));
      return;
    } finally {
      botao.disabled = false;
      botao.textContent = '👥 Compartilhar';
    }
    const c = r.compartilhamento;
    const lista = (await compartilhamentosDe(veiculoId)).filter(x => x.id !== c.id).concat(c);
    await guardarCompartilhamentos(veiculoId, lista);
    $('vs-nome').value = '';
    $('vs-email').value = '';
    const quem = primeiroNome(c.nome) || nome;
    if (r.jaTinha) toast(`${quem} já tinha acesso a este veículo.`, 4000);
    else if (c.situacao === 'pendente') toast(`Compartilhado, mas fica pendente: ${quem} já tem um veículo com a placa ${v.placa}. Vale quando ${quem} excluir esse veículo.`, 7000);
    else toast(`Pronto! O ${v.modelo} aparece para ${quem} na próxima sincronização.`, 6000);
    if (App().telaAtual() === 'v-compartilhar') renderCompartilhar(veiculoId);
  }

  async function removerCompartilhamento(id) {
    const veiculoId = dadosAtuais().veiculoId;
    const lista = await compartilhamentosDe(veiculoId);
    const c = lista.find(x => x.id === id);
    if (!c) return;
    const quem = primeiroNome(c.nome) || c.nome;
    if (!(await App().confirmar(`Tirar ${c.nome} do compartilhamento? O veículo some da lista de ${quem}. Os gastos que ${quem} lançou continuam aqui.`,
      'Remover', 'Cancelar'))) return;
    if (Sync.conexao() === 'offline') { toast('Sem internet. Para remover, o celular precisa estar conectado.'); return; }
    try {
      await Api.chamar('removerCompartilhamento', { id }, { tempoMs: 20000 });
    } catch (e) {
      toast(App().mensagemErroGeral(e), 5000);
      return;
    }
    await guardarCompartilhamentos(veiculoId, (await compartilhamentosDe(veiculoId)).filter(x => x.id !== id));
    toast(`${primeiroNome(c.nome)} não tem mais acesso ao veículo.`);
    if (App().telaAtual() === 'v-compartilhar') renderCompartilhar(veiculoId);
  }

  // ------------------------------------------------------------------
  //  Despesas (seguro, impostos, multas, outros) e Impostos (IPVA, licenciamento)
  // ------------------------------------------------------------------
  async function renderMenu(veiculoId, menu) {
    const v = await veiculoAtivo(veiculoId);
    if (!v || !['despesas', 'impostos'].includes(menu)) return false;
    const regs = await gastosDo(veiculoId);
    const resumo = (tipos) => {
      const rs = regs.filter(r => tipos.includes(r.tipo));
      return rs.length ? brl(totalDe(rs)) : 'Nenhum lançamento';
    };
    const opcoes = menu === 'impostos'
      ? [{ tipo: 'ipva', icone: '🏛️', nome: 'IPVA' }, { tipo: 'licenciamento', icone: '📄', nome: 'Licenciamento' }]
      : [{ tipo: 'seguro', icone: '🛡️', nome: 'Seguro' }, { menu: 'impostos', icone: '🏛️', nome: 'Impostos', tipos: ['ipva', 'licenciamento'] },
        { tipo: 'multa', icone: '🚨', nome: 'Multas' }, { tipo: 'outros', icone: '📦', nome: 'Outros' }];
    $('vm-titulo').textContent = menu === 'impostos' ? 'Impostos' : 'Despesas';
    $('vm-sub').textContent = nomeVeiculo(v);
    $('vm-opcoes').innerHTML = opcoes.map(o => `<button class="opcao-grande" type="button" id="vm-${o.tipo || o.menu}" ` +
      `${o.menu ? `data-menu="${o.menu}"` : `data-tipo="${o.tipo}"`}><span class="icone-mais" aria-hidden="true">${o.icone}</span>` +
      `<b>${esc(o.nome)}</b><small>${esc(resumo(o.tipos || [o.tipo]))}</small></button>`).join('');
    return true;
  }

  // ------------------------------------------------------------------
  //  Lista de um tipo de gasto (com o botão Adicionar)
  // ------------------------------------------------------------------
  async function renderLista(veiculoId, tipo) {
    const v = await veiculoAtivo(veiculoId);
    const t = TIPOS[tipo];
    if (!v || !t) return false;
    const todos = await gastosDo(veiculoId);
    const regs = todos.filter(r => r.tipo === tipo).sort((a, b) => compararData(b, a));
    const arqs = await arquivosDe(regs.map(r => r.id));
    const km = TEM_KM.has(tipo) ? analisarKm(todos) : new Map();
    $('vl-titulo').textContent = t.lista || t.nome;
    $('vl-sub').textContent = nomeVeiculo(v);
    $('vl-adicionar').textContent = t.adicionar || '+ Adicionar';
    $('vl-totais').innerHTML = tipo === 'galeria' ? '' : `<div><small>Total</small> <b>${brl(totalDe(regs))}</b></div>`;
    const autorDe = await autores(v, todos);
    $('vl-lista').innerHTML = regs.length
      ? regs.map(r => cartaoGasto(r, arqs[r.id] || [], km.get(r.id), tipo === 'galeria', autorDe(r))).join('')
      : `<div class="vazio">${esc(t.vazio || 'Nada lançado ainda.')}</div>`;
    return true;
  }

  // ------------------------------------------------------------------
  //  Gasto do veículo: novo, editar e revisar (os campos mudam com o tipo)
  // ------------------------------------------------------------------
  let VR = null;

  function novoGasto(veiculoId, tipo) {
    return {
      id: novoId(), veiculoId, tipo, data: hoje(), valor: null, formaPagamento: '', descricao: '', hodometro: null,
      combustivel: '', tanqueCheio: false, precoLitro: null, litros: null, seguradora: '', apolice: '', validade: '',
      local: '', lat: null, lng: null, status: 'confirmado', fonte: '', qrNota: '', observacao: '',
      criadoEm: Date.now(), versaoBase: 0
    };
  }

  async function prepararRegistro(dados) {
    let r;
    let modo;
    if (dados.registroId) {
      const salvo = await Banco.obter('registros', dados.registroId);
      if (!salvo || salvo.excluirPendente) return false;
      r = JSON.parse(JSON.stringify(salvo));
      modo = r.status === 'revisar' ? 'revisar' : 'editar';
    } else {
      if (!TIPOS[dados.tipo]) return false;
      r = novoGasto(dados.veiculoId, dados.tipo);
      modo = 'novo';
    }
    const v = await veiculoAtivo(r.veiculoId);
    if (!v) return false;
    const arquivos = modo === 'novo' ? [] : (await Banco.porIndice('arquivos', 'lancamentoId', r.id)).filter(a => !a.remover);
    if (r.status === 'aguardando_ia' && r.lerVoz === undefined && r.lerNota === undefined) {
      // lançado em outro celular: lê o que estiver anexado (áudio e/ou nota do posto)
      r.lerVoz = arquivos.some(a => a.tipo === 'audio');
      r.lerNota = r.tipo === 'abastecimento' && (arquivos.some(a => a.tipo === 'foto') || !!r.qrNota);
    }
    if (VR && VR.relogio) clearInterval(VR.relogio);
    if (Gravador.gravando()) Gravador.cancelar();
    VR = {
      modo, r, veiculo: v, token: novoId(),
      outros: (await gastosDo(v.id)).filter(x => x.id !== r.id),
      arquivos,
      fotosNovas: [], removerIds: [], audiosNovos: [], alterado: false,
      // valores que o app pôs sozinho (a leitura da IA pode trocar); o que a pessoa digita sai daqui
      auto: new Set(modo === 'novo' ? ['data', 'precoLitro', 'local', 'tanqueCheio'] : (r.status === 'aguardando_ia' ? (r.automaticos || []) : [])),
      // V6: valores que a IA leu (uma leitura nova, com mais áudios ou fotos, pode trocar); o que a pessoa digita sai daqui
      ia: new Set(modo === 'novo' ? [] : (r.lidosIA || [])),
      gps: null, localPendente: !!r.localPendente, localCoordenadas: r.localCoordenadas || '',
      lendo: '', msgLeitura: null, leituraAgora: null, relogio: null,
      // valor do litro, litros e total: 'user' (digitado), 'ia' (lido pela IA), 'pre' (preço sugerido), 'calc' (calculado) ou 'vazio'
      calc: { precoLitro: 'vazio', litros: 'vazio', valor: 'vazio' },
      // compartilhado: quem não lançou (e não é o dono do veículo) só vê (V5)
      somenteLeitura: modo !== 'novo' && !podeAlterar(r, v),
      autor: ''
    };
    if (modo !== 'novo' && (!ehMeu(v) || r.meu === false || (await compartilhamentosDe(v.id)).length)) {
      VR.autor = r.meu === false ? primeiroNome(r.participante) || 'outra pessoa' : 'você';
    }
    if (modo === 'novo' && r.tipo === 'abastecimento') {
      // o próximo abastecimento vem com o combustível, o valor do litro e a forma de pagamento do último deste veículo
      const ultimo = VR.outros.filter(x => x.tipo === 'abastecimento').sort(compararData).pop();
      if (ultimo && ultimo.combustivel) { r.combustivel = ultimo.combustivel; VR.auto.add('combustivel'); }
      if (ultimo && ultimo.formaPagamento) { r.formaPagamento = ultimo.formaPagamento; VR.auto.add('formaPagamento'); }
      r.precoLitro = r.combustivel ? ultimoPreco(r.combustivel) : null;
    }
    if (r.tipo === 'abastecimento') prepararTres();
    montarFormRegistro();
    await preencherFormRegistro();
    if (modo === 'novo' && TEM_LOCAL.has(r.tipo)) capturarLocal(VR.token, false);
    return true;
  }

  function campoValorHtml(id, rotulo, casas = 2, exemplo) {
    return `<label for="${id}">${rotulo}</label><input id="${id}" class="caixa-registradora" data-casas="${casas}" ` +
      `inputmode="numeric" autocomplete="off" placeholder="${exemplo || (casas === 3 ? '0,000' : '0,00')}">`;
  }
  // as datas abrem o calendário do app (V5); o botão guarda a data em "value" (aaaa-mm-dd)
  function campoDataHtml(rotulo = 'Data', id = 'vr-data', opcional = false) {
    return `<label for="${id}">${rotulo}</label><button type="button" class="campo-data" id="${id}"${opcional ? ' data-opcional="1"' : ''}></button>`;
  }
  const HTML_KM = '<label for="vr-km">Hodômetro (km)</label><input id="vr-km" inputmode="numeric" autocomplete="off">' +
    '<small class="aviso-campo" id="vr-km-aviso"></small>';
  const HTML_PAGAMENTO = '<label for="vr-pagamento">Forma de pagamento</label><select id="vr-pagamento"></select>';
  const HTML_LOCAL = '<div class="rotulo-com-botao"><label for="vr-local">Local</label>' +
    '<button type="button" class="link-pequeno" id="vr-gps">📍 Usar minha localização</button></div>' +
    '<div class="campo-com-x"><input id="vr-local" autocomplete="off" autocapitalize="sentences" placeholder="Endereço ou nome do lugar">' +
    '<button type="button" class="limpar-campo oculto" id="vr-local-limpar" aria-label="Apagar o local" title="Apagar o local">×</button></div>';
  function campoDescricaoHtml(rotulo, exemplo) {
    return `<label for="vr-descricao">${rotulo}</label><textarea id="vr-descricao" rows="3" autocapitalize="sentences" placeholder="${exemplo}"></textarea>`;
  }

  function montarFormRegistro() {
    const { r, modo } = VR;
    const t = TIPOS[r.tipo];
    $('vr-titulo').textContent = modo === 'novo' ? t.novo : modo === 'revisar' ? 'Revisar ' + t.nome.toLowerCase() : t.nome;
    $('vr-sub').textContent = nomeVeiculo(VR.veiculo);
    let html = '';
    switch (r.tipo) {
      case 'abastecimento':
        html = '<div class="linha-botoes botoes-foto botoes-leitura">' +
            '<button class="botao" type="button" id="vr-voz">🎤 Gravar áudio</button>' +
            '<button class="botao" type="button" id="vr-foto">📷 Fotos</button></div>' +
          '<small class="dica dica-leitura" id="vr-dica-leitura">Grave áudios contando o abastecimento e/ou tire fotos da nota, da bomba ' +
            '(valor do litro, litros e total) e do painel (hodômetro). A IA lê tudo junto e preenche os campos vazios.</small>' +
          '<div id="vr-ia"></div>' +
          '<div id="vr-audios"></div>' +
          '<div id="vr-bloco-fotos" class="oculto"><label>Fotos do abastecimento</label><div class="fotos" id="vr-fotos"></div></div>' +
          '<label for="vr-combustivel">Combustível</label>' +
          '<div class="linha-combustivel"><select id="vr-combustivel"></select>' +
            '<label class="marcar"><input type="checkbox" id="vr-tanque"> Tanque cheio</label></div>' +
          HTML_KM +
          // dois dos três valores bastam: o app calcula o outro
          '<div class="tres-colunas">' +
            `<div>${campoValorHtml('vr-preco', '<span id="vr-preco-rotulo">Valor do litro</span>', 3, 'R$ 0,000')}</div>` +
            `<div>${campoValorHtml('vr-litros', '<span id="vr-litros-rotulo">Litros</span>', 3)}</div>` +
            `<div>${campoValorHtml('vr-valor', 'Valor total', 2, 'R$ 0,00')}</div></div>` +
          '<div class="tres-info" id="vr-tres"></div>' +
          campoDataHtml() + HTML_PAGAMENTO + HTML_LOCAL;
        break;
      case 'manutencao':
        html = campoDataHtml() + HTML_KM + campoValorHtml('vr-valor', 'Valor pago (R$)') +
          campoDescricaoHtml('Descrição', 'Ex.: Troca de óleo e do filtro') + HTML_LOCAL + HTML_PAGAMENTO;
        break;
      case 'seguro':
        html = campoDataHtml() +
          '<label for="vr-seguradora">Nome da seguradora</label><input id="vr-seguradora" autocapitalize="words" autocomplete="off" placeholder="Ex.: Porto Seguro">' +
          campoValorHtml('vr-valor', 'Valor (R$)') +
          '<div class="duas-colunas"><div><label for="vr-apolice">Nº da apólice</label><input id="vr-apolice" autocomplete="off"></div>' +
          `<div>${campoDataHtml('Validade', 'vr-validade', true)}</div></div>` +
          HTML_PAGAMENTO;
        break;
      case 'ipva':
      case 'licenciamento':
        html = campoValorHtml('vr-valor', 'Valor pago (R$)') + campoDataHtml() + HTML_PAGAMENTO;
        break;
      case 'multa':
        html = campoDataHtml('Data da infração') + campoValorHtml('vr-valor', 'Valor (R$)') +
          campoDescricaoHtml('Descrição', 'Ex.: Excesso de velocidade') + HTML_PAGAMENTO;
        break;
      case 'outros':
        html = campoValorHtml('vr-valor', 'Valor (R$)') + campoDescricaoHtml('Descrição', 'Ex.: Lavagem completa') +
          campoDataHtml() + HTML_PAGAMENTO;
        break;
      case 'galeria':
        html = campoDataHtml() + HTML_LOCAL + campoDescricaoHtml('Texto', 'Ex.: Arranhão na porta de trás') +
          '<label>Fotos</label><div class="fotos" id="vr-fotos"></div>' +
          '<div class="linha-botoes botoes-foto"><button class="botao pequeno" type="button" id="vr-camera">📷 Tirar foto</button>' +
          '<label class="botao pequeno arquivo">🖼️ Galeria<input type="file" accept="image/*" multiple id="vr-galeria"></label></div>';
        break;
    }
    if (VR.somenteLeitura) {
      html = `<div class="nota-autor">👤 Lançado por <b>${esc(VR.autor)}</b>. Só quem lançou (ou o dono do veículo) pode alterar ou excluir.</div>` + html;
    } else {
      if (VR.autor) html = `<div class="nota-autor">👤 Lançado por <b>${esc(VR.autor)}</b>.</div>` + html;
      html += `<div class="rodape-form"><button class="botao primario grande" id="vr-salvar" type="button">${modo === 'revisar' ? 'Confirmar' : 'Salvar'}</button>` +
        (modo === 'novo' ? '' : `<button class="botao perigo" id="vr-excluir" type="button">${esc(t.excluir)}</button>`) + '</div>';
    }
    $('vr-conteudo').innerHTML = html;
    $('vr-conteudo').classList.toggle('somente-leitura', VR.somenteLeitura);
    $('vr-conteudo').querySelectorAll('.caixa-registradora').forEach(caixaRegistradora);
    if ($('vr-km')) mascaraKm($('vr-km'));
  }

  async function preencherFormRegistro() {
    const r = VR.r;
    const L = await App().listas();
    if ($('vr-data')) definirData($('vr-data'), r.data || hoje());
    if ($('vr-valor')) $('vr-valor').value = paraMascara(r.valor, 2);
    if ($('vr-pagamento')) App().preencherSelect($('vr-pagamento'), meiosVeiculo(L.meios), r.formaPagamento, 'Não informado');
    if ($('vr-descricao')) $('vr-descricao').value = r.descricao || '';
    if ($('vr-local')) { $('vr-local').value = r.local || ''; atualizarXLocal(); }
    if ($('vr-km')) $('vr-km').value = textoKm(r.hodometro);
    if ($('vr-seguradora')) {
      $('vr-seguradora').value = r.seguradora || '';
      $('vr-apolice').value = r.apolice || '';
      definirData($('vr-validade'), r.validade || '');
    }
    if (r.tipo === 'abastecimento') {
      const opcoes = COMBUSTIVEIS.slice();
      if (r.combustivel && !opcoes.includes(r.combustivel)) opcoes.unshift(r.combustivel);
      $('vr-combustivel').innerHTML = '<option value="">Escolha</option>' +
        opcoes.map(c => `<option${c === r.combustivel ? ' selected' : ''}>${esc(c)}</option>`).join('');
      $('vr-tanque').checked = !!r.tanqueCheio;
      $('vr-preco').value = paraMascara(r.precoLitro, 3);
      $('vr-litros').value = paraMascara(r.litros, 3);
      atualizarRotulosCombustivel();
      recalcularTres(null);
      atualizarBotaoVoz();
      renderIA();
      renderAudios();
      if (VR.somenteLeitura && $('vr-dica-leitura')) $('vr-dica-leitura').classList.add('oculto');
    }
    if (TEM_KM.has(r.tipo)) { atualizarPlaceholderKm(); atualizarAvisoKm(); }
    if (r.tipo === 'abastecimento' || r.tipo === 'galeria') await renderFotos();
    if (VR.somenteLeitura) {
      // só ver: os campos ficam desligados (as fotos e o áudio continuam abrindo)
      $('vr-conteudo').querySelectorAll('input, select, textarea, button').forEach((el) => {
        if (el.dataset.ouvir || el.closest('#vr-fotos')) return;
        el.disabled = true;
      });
    }
  }

  // ---- abastecimento: combustível, último preço, litros e hodômetro ----
  function ultimoPreco(comb) {
    const r = VR.outros.filter(x => x.tipo === 'abastecimento' && x.combustivel === comb && x.precoLitro > 0).sort(compararData).pop();
    return r ? r.precoLitro : null;
  }
  /** O valor do litro vem com o último que a pessoa pagou por esse combustível (ela pode trocar). */
  function aplicarUltimoPreco() {
    const campo = $('vr-preco');
    if (!campo || ['user', 'ia', 'calc'].includes(VR.calc.precoLitro)) return; // digitado, lido ou calculado: fica
    const comb = $('vr-combustivel').value;
    const preco = comb ? ultimoPreco(comb) : null;
    campo.value = paraMascara(preco, 3);
    VR.calc.precoLitro = preco ? 'pre' : 'vazio';
  }
  function atualizarRotulosCombustivel() {
    const gnv = $('vr-combustivel').value === 'GNV';
    if ($('vr-preco-rotulo')) $('vr-preco-rotulo').textContent = gnv ? 'Valor do m³' : 'Valor do litro';
    if ($('vr-litros-rotulo')) $('vr-litros-rotulo').textContent = gnv ? 'Metros cúbicos' : 'Litros';
  }
  function aoMudarCombustivel() {
    aplicarUltimoPreco();
    atualizarRotulosCombustivel();
    recalcularTres(null);
  }

  // ---- valor do litro × litros = valor total: com dois, o app calcula o terceiro (V5) ----
  /** De onde vem cada um dos três valores ao abrir o gasto. */
  function prepararTres() {
    const r = VR.r;
    const c = VR.calc;
    const tem = (k) => Number(r[k]) > 0;
    Object.keys(c).forEach((k) => { c[k] = tem(k) ? (VR.ia.has(k) ? 'ia' : 'user') : 'vazio'; });
    if (VR.modo === 'novo') { if (tem('precoLitro')) c.precoLitro = 'pre'; return; }
    const auto = new Set(r.automaticos || []);
    if (r.status === 'aguardando_ia' && tem('precoLitro') && auto.has('precoLitro') && r.calculado !== 'precoLitro') c.precoLitro = 'pre';
    // o que o app calculou continua automático (guardado neste celular; vindo de outro celular, os litros)
    if (tem('precoLitro') && tem('litros') && tem('valor') && !difValores(r.precoLitro, r.litros, r.valor)) {
      c[Object.keys(c).includes(r.calculado) ? r.calculado : 'litros'] = 'calc';
    }
  }
  /**
   * Refaz a conta depois que um dos três mudou (origemId: o campo que a pessoa mexeu).
   * O campo calculado nunca é o que a pessoa está digitando: ele é refeito quando ela sai do campo.
   */
  function recalcularTres(origemId, { ignorarFoco = false } = {}) {
    if (!VR || VR.r.tipo !== 'abastecimento' || !$('vr-preco')) return;
    const c = VR.calc;
    const T = ['precoLitro', 'litros', 'valor'];
    const val = {};
    T.forEach((k) => { val[k] = daMascara($(ID_TRES[k])); });
    if (origemId && TRES[origemId]) { const k = TRES[origemId]; c[k] = val[k] > 0 ? 'user' : 'vazio'; }
    const ativo = document.activeElement;
    const focado = !ignorarFoco && ativo && TRES[ativo.id] ? ativo.id : '';
    const base = T.filter(k => (c[k] === 'user' || c[k] === 'ia') && val[k] > 0);
    if (base.length < 2 && c.precoLitro === 'pre' && val.precoLitro > 0) base.push('precoLitro'); // o último preço pago
    if (base.length === 2) {
      const falta = T.find(k => !base.includes(k));
      if (ID_TRES[falta] !== focado && origemId !== ID_TRES[falta]) {
        const novo = Sync.calcularTerceiro(falta, val);
        $(ID_TRES[falta]).value = paraMascara(novo, falta === 'valor' ? 2 : 3);
        c[falta] = novo ? 'calc' : 'vazio';
      }
    } else if (base.length < 2) {
      T.forEach((k) => {
        if (c[k] === 'calc' && ID_TRES[k] !== focado) { $(ID_TRES[k]).value = ''; c[k] = 'vazio'; }
      });
    }
    T.forEach((k) => { if (c[k] === 'calc' || c[k] === 'pre') VR.auto.add(k); else VR.auto.delete(k); });
    atualizarTres();
  }
  /** Mostra qual valor foi calculado ou o ⚠️ quando os três foram digitados e não batem. */
  function atualizarTres() {
    const el = $('vr-tres');
    if (!el) return;
    const c = VR.calc;
    const T = ['precoLitro', 'litros', 'valor'];
    T.forEach((k) => {
      const campo = $(ID_TRES[k]);
      campo.classList.toggle('calculado', c[k] === 'calc');
      if ((c[k] === 'calc' || c[k] === 'pre') && campo.value) campo.dataset.substituir = '1';
      else delete campo.dataset.substituir;
    });
    const gnv = $('vr-combustivel').value === 'GNV';
    const val = {};
    T.forEach((k) => { val[k] = daMascara($(ID_TRES[k])); });
    const naoBate = T.every(k => c[k] === 'user' || c[k] === 'ia') && difValores(val.precoLitro, val.litros, val.valor);
    if (naoBate) {
      el.innerHTML = '<button type="button" class="aviso-botao aviso-valores" id="vr-aviso-valores">⚠️ Os três valores não batem. Toque para ver.</button>';
      return;
    }
    const nomes = {
      precoLitro: gnv ? 'Valor do m³ calculado' : 'Valor do litro calculado',
      litros: gnv ? 'Metros cúbicos calculados' : 'Litros calculados',
      valor: 'Valor total calculado'
    };
    const calc = T.find(k => c[k] === 'calc');
    el.innerHTML = calc ? `<small>🧮 ${nomes[calc]} pelo app.</small>`
      : '<small>Preencha dois dos três valores: o app calcula o outro.</small>';
  }
  function explicarValores() {
    const val = {};
    ['precoLitro', 'litros', 'valor'].forEach((k) => { val[k] = daMascara($(ID_TRES[k])); });
    const texto = textoDifValores(val.precoLitro, val.litros, val.valor, $('vr-combustivel').value);
    if (!texto) return;
    App().escolher(`⚠️ Os três valores não batem: ${texto} Confira o valor do litro, os litros e o valor total (no painel da bomba ou na nota). ` +
      'Se estiverem certos (um desconto, por exemplo), dá para salvar assim mesmo: o lançamento fica marcado com ⚠️.',
    [{ valor: true, texto: 'Entendi', classe: 'primario' }]);
  }
  function posicaoAtual() {
    return { data: ($('vr-data') && $('vr-data').value) || VR.r.data, criadoEm: VR.r.criadoEm };
  }
  /** O gasto com hodômetro logo antes deste (pela data); num gasto novo, é o mais recente. */
  function kmAnterior() {
    const atual = posicaoAtual();
    const antes = VR.outros.filter(x => TEM_KM.has(x.tipo) && x.hodometro != null && compararData(x, atual) < 0).sort(compararData);
    return antes.length ? antes[antes.length - 1] : null;
  }
  function atualizarPlaceholderKm() {
    const campo = $('vr-km');
    if (!campo) return;
    const ant = kmAnterior();
    campo.placeholder = ant ? 'Último: ' + fmtKm(ant.hodometro) : 'Ex.: 105.000';
  }
  /** O km digitado combina com os gastos de antes e de depois? */
  function conflitoKm(km) {
    if (km == null) return null;
    const atual = posicaoAtual();
    const comKm = VR.outros.filter(x => TEM_KM.has(x.tipo) && x.hodometro != null).sort(compararData);
    const antes = comKm.filter(x => compararData(x, atual) < 0);
    const depois = comKm.filter(x => compararData(x, atual) > 0);
    const ant = antes[antes.length - 1];
    const prox = depois[0];
    if (ant && km < ant.hodometro) return { ref: ant, menor: true };
    if (prox && km > prox.hodometro) return { ref: prox, menor: false };
    return null;
  }
  function textoConflito(c) {
    const de = c.ref.tipo === 'manutencao' ? 'da manutenção' : 'do abastecimento';
    return c.menor
      ? `menor que o ${de} de ${dataCurta(c.ref.data)} (${fmtKm(c.ref.hodometro)})`
      : `maior que o ${de} de ${dataCurta(c.ref.data)} (${fmtKm(c.ref.hodometro)}), que é de depois`;
  }
  function atualizarAvisoKm() {
    const el = $('vr-km-aviso');
    if (!el) return;
    const km = daKm($('vr-km'));
    if (km == null) {
      el.className = 'aviso-campo';
      el.textContent = 'Se ficar em branco, o lançamento fica marcado com ⚠️.';
      return;
    }
    const c = conflitoKm(km);
    el.className = 'aviso-campo' + (c ? ' laranja' : '');
    el.textContent = c ? `⚠️ O hodômetro está ${textoConflito(c)}.` : '';
  }

  // ---- local pelo GPS (com internet vira endereço; sem internet ficam as coordenadas) ----
  function textoCoordenadas(p) { return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`; }
  /** O × no fim do campo Local aparece quando há algo escrito (V5). */
  function atualizarXLocal() {
    const x = $('vr-local-limpar');
    if (x) x.classList.toggle('oculto', !$('vr-local').value || !!VR.somenteLeitura);
  }
  function limparLocal() {
    const c = $('vr-local');
    if (!c) return;
    c.value = '';
    VR.auto.delete('local'); // o GPS que ainda responder não escreve mais aqui
    VR.localPendente = false;
    VR.alterado = true;
    atualizarXLocal();
    c.focus();
  }
  function capturarLocal(token, forcar) {
    const campo = $('vr-local');
    if (!campo || !VR) return;
    if (forcar) toast('Buscando a sua localização…', 2500);
    campo.placeholder = 'Buscando a localização…';
    App().obterLocalizacao().then(async (pos) => {
      if (!VR || VR.token !== token) return;
      const c = $('vr-local');
      if (!c) return;
      c.placeholder = 'Endereço ou nome do lugar';
      if (!pos) {
        if (forcar) toast('Não foi possível pegar a localização. Confira se o GPS está ligado e se o app pode usá-lo.', 5000);
        else c.placeholder = 'Digite o local (o GPS não respondeu)';
        return;
      }
      VR.gps = pos;
      if (!forcar && !VR.auto.has('local')) return; // a pessoa já escreveu o local: guarda só as coordenadas
      const coord = textoCoordenadas(pos);
      c.value = coord;
      atualizarXLocal();
      VR.auto.add('local');
      VR.localPendente = true;
      VR.localCoordenadas = coord;
      if (forcar) VR.alterado = true;
      if (Sync.conexao() === 'offline') return; // o endereço vem depois, na sincronização
      try {
        const r = await Api.chamar('endereco', { lat: pos.lat, lng: pos.lng }, { tempoMs: 15000 });
        if (!VR || VR.token !== token || !r.endereco) return;
        const c2 = $('vr-local');
        if (c2 && c2.value === coord) { c2.value = r.endereco; VR.localPendente = false; atualizarXLocal(); }
      } catch (e) { /* fica com as coordenadas; o endereço vem na sincronização */ }
    });
  }

  // ---- fotos (nota do posto no abastecimento; fotos da galeria) ----
  async function renderFotos() {
    const el = $('vr-fotos');
    if (!el || !VR) return 0;
    const existentes = VR.arquivos.filter(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id))
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    const lista = existentes.map(a => ({ chave: 'e:' + a.id, blob: a.blob || null, arquivoId: a.id }))
      .concat(VR.fotosNovas.map(f => ({ chave: 'n:' + f.id, blob: f.blob, arquivoId: '' })));
    App().listasVisor['vr-fotos'] = lista;
    el.innerHTML = lista.map(x => App().miniatura(x.blob, x.chave)).join('') || '<small class="dica">Nenhuma foto ainda.</small>';
    if ($('vr-bloco-fotos')) $('vr-bloco-fotos').classList.toggle('oculto', !lista.length);
    return lista.length;
  }
  async function removerFoto(chave) {
    const [tipo, id] = chave.split(/:(.+)/);
    if (tipo === 'e') VR.removerIds.push(id);
    else VR.fotosNovas = VR.fotosNovas.filter(f => f.id !== id);
    VR.alterado = true;
    const n = await renderFotos();
    if (VR.r.tipo === 'abastecimento') {
      if (!VR.fotosNovas.some(f => f.qr) && tipo === 'n' && VR.r.qrNota && !VR.arquivos.some(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id))) VR.r.qrNota = '';
      if (!n && VR.r.lerNota) { VR.r.lerNota = false; VR.r.qrNota = ''; }
      renderIA();
    }
  }
  /** Fotos escolhidas na galeria do celular (galeria do veículo): várias de uma vez, sem a tela de recorte. */
  async function adicionarDaGaleria(input) {
    const arquivos = Array.from(input.files || []);
    input.value = '';
    if (!arquivos.length || !VR) return;
    const token = VR.token;
    if (arquivos.length > 2) toast(`Preparando ${arquivos.length} fotos…`, 4000);
    let n = 0;
    for (const f of arquivos) {
      try {
        const blob = await Fotos.reduzir(f);
        if (!VR || VR.token !== token) return;
        VR.fotosNovas.push({ id: novoId(), blob });
        n++;
      } catch (e) {
        toast('Não foi possível usar uma das fotos: ' + e.message, 4500);
      }
    }
    if (n) { VR.alterado = true; renderFotos(); }
  }
  async function tirarFotoGaleria() {
    const token = VR.token;
    const novas = [];
    await App().tirarFotos(novas, OPCOES_FOTO_VEICULO);
    if (!VR || VR.token !== token || !novas.length) return;
    VR.fotosNovas.push(...novas);
    VR.alterado = true;
    renderFotos();
  }

  // ---- áudios e fotos do abastecimento (V6): todos ficam guardados e são lidos juntos pela IA ----
  function audiosAtuais() {
    return VR.arquivos.filter(a => a.tipo === 'audio' && !VR.removerIds.includes(a.id))
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
      .map(a => ({ chave: 'e:' + a.id, id: a.id, blob: a.blob || null, enviado: !!a.enviado, duracao: a.duracao, mime: a.mime }))
      .concat(VR.audiosNovos.map(a => ({ chave: 'n:' + a.id, id: a.id, blob: a.blob, enviado: false, duracao: a.duracao, mime: a.mime })));
  }
  function fotosAtuais() {
    return VR.arquivos.filter(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id))
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0))
      .concat(VR.fotosNovas.map(f => ({ id: f.id, blob: f.blob, mime: 'image/jpeg', qr: f.qr || '' })));
  }
  function atualizarBotaoVoz() {
    const b = $('vr-voz');
    if (!b) return;
    b.classList.remove('gravando');
    b.textContent = audiosAtuais().length ? '🎤 Gravar outro áudio' : '🎤 Gravar áudio';
  }
  function travarBotoesLeitura(travar) {
    ['vr-voz', 'vr-foto'].forEach((id) => { if ($(id)) $(id).disabled = travar; });
  }
  /** Lista dos áudios: cada um dá para ouvir e (para quem pode alterar) apagar. */
  function renderAudios() {
    const el = $('vr-audios');
    if (!el || !VR) return;
    const lista = audiosAtuais();
    if (!lista.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<label>' + (lista.length > 1 ? `Áudios (${lista.length})` : 'Áudio') + '</label><div class="lista-audios">' +
      lista.map((a, i) => {
        const tempo = a.duracao ? ' · ' + App().fmtDuracao(a.duracao) : '';
        const tocar = a.blob ? `<audio controls preload="none" src="${App().urlDe(a.blob)}"></audio>`
          : a.enviado ? `<div class="ouvir-audio"><button class="botao pequeno" type="button" data-ouvir="${esc(a.id)}">▶️ Ouvir</button>` +
            '<small class="dica">Guardado no servidor (precisa de internet).</small></div>'
            : '<small class="dica">Este áudio está no celular de quem gravou.</small>';
        const apagar = VR.somenteLeitura ? '' :
          `<button type="button" class="botao-apagar-audio" data-remover-audio="${esc(a.chave)}" aria-label="Apagar o áudio ${i + 1}" title="Apagar este áudio">🗑️</button>`;
        return `<div class="audio-item"><div class="audio-topo"><span>🎤 Áudio ${i + 1}${tempo}</span>${apagar}</div>${tocar}</div>`;
      }).join('') + '</div>';
  }
  async function removerAudio(chave) {
    if (VR.lendo) return;
    if (!(await App().confirmar('Apagar este áudio?', 'Apagar', 'Cancelar'))) return;
    if (!VR) return;
    const [tipo, id] = chave.split(/:(.+)/);
    if (tipo === 'e') VR.removerIds.push(id);
    else VR.audiosNovos = VR.audiosNovos.filter(a => a.id !== id);
    VR.alterado = true;
    if (!audiosAtuais().length && VR.r.lerVoz) VR.r.lerVoz = false;
    renderAudios();
    atualizarBotaoVoz();
    renderIA();
  }

  async function alternarGravacao() {
    if (Gravador.gravando()) { await pararGravacao(true); return; }
    if (VR.lendo) return;
    if (!Gravador.suportado()) { toast('Este navegador não permite gravar áudio. Use o Chrome.', 4500); return; }
    try {
      await Gravador.iniciar();
    } catch (e) {
      toast(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para gravar.' : 'Não foi possível usar o microfone: ' + (e && e.message), 4500);
      return;
    }
    const b = $('vr-voz');
    if (b) b.classList.add('gravando');
    const tique = () => { const x = $('vr-voz'); if (x && Gravador.gravando()) x.textContent = `⏹ Parar (${App().fmtDuracao(Gravador.segundos())})`; };
    tique();
    VR.relogio = setInterval(tique, 500);
    if ($('vr-foto')) $('vr-foto').disabled = true;
  }

  /** lerJa: no Wi-Fi a IA lê na hora (ao salvar no meio da gravação, a leitura fica para a sincronização). */
  async function pararGravacao(lerJa) {
    clearInterval(VR.relogio);
    const token = VR.token;
    const res = await Gravador.parar();
    if (!VR || VR.token !== token) return;
    atualizarBotaoVoz();
    if ($('vr-foto')) $('vr-foto').disabled = false;
    if (!res) { toast('Nada foi gravado. Toque em “Gravar áudio” para tentar de novo.'); return; }
    // cada áudio novo fica guardado junto com os anteriores (V6)
    VR.audiosNovos.push({ id: novoId(), blob: res.blob, duracao: res.duracao, mime: res.blob.type || 'audio/webm' });
    VR.alterado = true;
    VR.r.lerVoz = true;
    VR.leituraAgora = null;
    VR.msgLeitura = null;
    atualizarBotaoVoz();
    renderAudios();
    if (lerJa && Sync.conexao() === 'wifi') lerAgora();
    else renderIA();
  }

  /** Fotos do abastecimento: tirar ou escolher na galeria (tocar fora fecha). */
  function escolherFotos() {
    return new Promise((ok) => {
      App().abrirDialogo('<div class="fundo-dialogo"><div class="dialogo" role="dialog"><h2>Fotos do abastecimento</h2>' +
        '<p>Tire a foto da <b>nota</b> (ou do cupom), da <b>bomba</b> (valor do litro, litros e total) ou do <b>painel</b> (hodômetro). ' +
        'A IA descobre qual é qual. Com o QR Code da nota, os dados vêm do site da SEFAZ.</p>' +
        '<div class="botoes coluna"><button class="botao primario" type="button" id="dlg-nota-camera">📷 Tirar foto</button>' +
        '<label class="botao arquivo">🖼️ Escolher da galeria<input type="file" accept="image/*" multiple id="dlg-nota-galeria"></label>' +
        '<button class="botao" type="button" id="dlg-nota-cancelar">Cancelar</button></div></div></div>', () => ok(null), { fora: true });
      $('dlg-nota-camera').onclick = () => { App().fecharDialogo(); ok({ modo: 'camera' }); };
      $('dlg-nota-cancelar').onclick = () => { App().fecharDialogo(); ok(null); };
      $('dlg-nota-galeria').onchange = (e) => { const input = e.target; App().fecharDialogo(); ok({ modo: 'galeria', input }); };
    });
  }

  async function adicionarFotosAbastecimento() {
    if (VR.lendo || Gravador.gravando()) return;
    const token = VR.token;
    const escolha = await escolherFotos();
    if (!escolha) return;
    const novas = [];
    if (escolha.modo === 'camera') await App().tirarFotos(novas, OPCOES_NOTA_POSTO);
    else await App().adicionarFotos(escolha.input, novas, OPCOES_NOTA_POSTO);
    if (!VR || VR.token !== token || !novas.length) return;
    VR.fotosNovas.push(...novas);
    const comQr = novas.find(f => f.qr);
    if (comQr && !VR.r.qrNota) VR.r.qrNota = comQr.qr;
    VR.alterado = true;
    VR.r.lerNota = true;
    VR.leituraAgora = null;
    VR.msgLeitura = null;
    await renderFotos();
    if (Sync.conexao() === 'wifi') lerAgora();
    else renderIA();
  }

  function qrAtual() {
    const f = VR.fotosNovas.find(x => x.qr);
    return VR.r.qrNota || (f ? f.qr : '');
  }
  async function base64DoArquivo(a) {
    if (a.blob) return Sync.blobParaBase64(a.blob);
    return Sync.blobParaBase64(await App().baixarArquivo(a.id)); // já saiu do celular: vem do servidor
  }

  /** O que ainda falta ler, em palavras ("o áudio", "as fotos", "os áudios e a foto"...). */
  function oQueFaltaLer() {
    const nA = audiosAtuais().length;
    const nF = fotosAtuais().length || (VR.r.qrNota ? 1 : 0);
    const a = VR.r.lerVoz && nA ? (nA > 1 ? 'os áudios' : 'o áudio') : '';
    const f = VR.r.lerNota && nF ? (nF > 1 ? 'as fotos' : 'a foto') : '';
    const plural = !!(a && f) || (a && nA > 1) || (f && nF > 1);
    const fem = !a && !!f;
    return {
      oque: [a, f].filter(Boolean).join(' e ') || 'o abastecimento',
      lido: (fem ? 'lida' : 'lido') + (plural ? 's' : ''), vai: plural ? 'vão' : 'vai', foi: plural ? 'foram' : 'foi'
    };
  }

  /** Passa para a tela o que a leitura trouxe: só nos campos vazios, preenchidos pelo app ou lidos antes pela IA. */
  function aplicarLeituraNoForm(resp) {
    const c = (resp && resp.campos) || {};
    const livre = (id, k) => { const el = $(id); return !!el && (!el.value || VR.auto.has(k) || VR.ia.has(k)); };
    const usou = (k) => { VR.auto.delete(k); VR.ia.add(k); };
    if (c.combustivel && livre('vr-combustivel', 'combustivel')) {
      const sel = $('vr-combustivel');
      if (!Array.from(sel.options).some(o => o.value === c.combustivel)) sel.add(new Option(c.combustivel, c.combustivel));
      sel.value = c.combustivel;
      usou('combustivel');
      aoMudarCombustivel();
    }
    if (c.hodometro != null && livre('vr-km', 'hodometro')) { $('vr-km').value = textoKm(c.hodometro); usou('hodometro'); }
    // os três valores: a leitura entra onde a pessoa não digitou (vazio, calculado, preço sugerido ou lido antes)
    const lidos = [];
    [['precoLitro', c.precoLitro, 3], ['litros', c.litros, 3], ['valor', c.valorTotal, 2]].forEach(([k, v, casas]) => {
      if (!(v > 0) || !$(ID_TRES[k]) || VR.calc[k] === 'user') return;
      $(ID_TRES[k]).value = paraMascara(v, casas);
      VR.calc[k] = 'ia';
      usou(k);
      lidos.push(k);
    });
    // a leitura trouxe os três e eles batem: um deles continua automático (se a pessoa mudar outro, ele é refeito)
    const T = ['precoLitro', 'litros', 'valor'];
    const vals = {};
    T.forEach((k) => { vals[k] = daMascara($(ID_TRES[k])); });
    if (lidos.length && T.every(k => VR.calc[k] === 'user' || VR.calc[k] === 'ia') && !difValores(vals.precoLitro, vals.litros, vals.valor)) {
      const k = ['litros', 'precoLitro', 'valor'].find(x => lidos.includes(x));
      VR.calc[k] = 'calc';
      VR.ia.delete(k);
    }
    if (c.formaPagamento && livre('vr-pagamento', 'formaPagamento')) {
      const sel = $('vr-pagamento');
      if (!Array.from(sel.options).some(o => o.value === c.formaPagamento)) sel.add(new Option(c.formaPagamento, c.formaPagamento));
      sel.value = c.formaPagamento;
      usou('formaPagamento');
    }
    if (c.data && livre('vr-data', 'data')) { definirData($('vr-data'), c.data); usou('data'); }
    if (c.local && livre('vr-local', 'local')) { $('vr-local').value = c.local; usou('local'); VR.localPendente = false; atualizarXLocal(); }
    if (c.tanqueCheio === true && $('vr-tanque') && !$('vr-tanque').checked && VR.auto.has('tanqueCheio')) {
      $('vr-tanque').checked = true;
      VR.auto.delete('tanqueCheio');
    }
    VR.alterado = true;
    recalcularTres(null, { ignorarFoco: true });
    atualizarPlaceholderKm();
    atualizarAvisoKm();
  }

  /** Lê agora todos os áudios e fotos juntos (no Wi-Fi é automático; nos dados móveis, só se a pessoa pedir). */
  async function lerAgora() {
    if (!VR || VR.lendo) return;
    const token = VR.token;
    const audios = audiosAtuais();
    const fotos = fotosAtuais();
    const qr = qrAtual();
    if (!audios.length && !fotos.length && !qr) { VR.r.lerVoz = false; VR.r.lerNota = false; renderIA(); return; }
    VR.msgLeitura = null;
    VR.lendo = 'tudo';
    travarBotoesLeitura(true);
    renderIA();
    try {
      const resp = await Sync.lerAbastecimento({
        audios: audios.map(a => ({ mime: a.mime || 'audio/webm', base64: () => base64DoArquivo(a) })),
        fotos: fotos.map(f => ({ mime: f.mime || 'image/jpeg', qr: !!f.qr, base64: () => base64DoArquivo(f) })),
        qr, lerVoz: !!VR.r.lerVoz, lerNota: !!VR.r.lerNota
      });
      if (!VR || VR.token !== token) return; // a pessoa saiu da tela: a leitura fica para a sincronização
      aplicarLeituraNoForm(resp);
      VR.r.lerVoz = false;
      VR.r.lerNota = false;
      if (resp.transcricao) VR.r.transcricao = resp.transcricao;
      if (resp.fonte) VR.r.fonte = resp.fonte;
      if (resp.chave) VR.r.chaveNota = resp.chave;
      const avisos = [Sync.avisosDaLeitura(resp)];
      if (resp.falhas && resp.falhas.length) avisos.push(resp.falhas.join(' ') + ' Preencha você mesmo o que faltar.');
      VR.r.resumoLeitura = Sync.resumoDaLeitura(resp);
      VR.leituraAgora = { transcricao: resp.transcricao || '', avisos: avisos.filter(Boolean).join(' '), resumo: VR.r.resumoLeitura };
      VR.r.observacao = VR.leituraAgora.avisos.slice(0, 500); // vai junto para o servidor (ex.: outros itens da nota)
    } catch (e) {
      if (!VR || VR.token !== token) return;
      const { oque, lido, foi } = oQueFaltaLer();
      const guardado = `${maiuscula(oque)} ${foi === 'foram' ? 'ficam' : 'fica'} ${lido.replace('lid', 'guardad')}`; // "o áudio fica guardado", "as fotos ficam guardadas"
      if (e instanceof Api.ErroServidor && ['ia_falhou', 'dados_invalidos', 'arquivo_inexistente'].includes(e.codigo)) {
        VR.r.lerVoz = false;
        VR.r.lerNota = false;
        VR.msgLeitura = { classe: 'vermelho', texto: `<b>A IA não conseguiu ler ${oque}.</b> Preencha você mesmo.` };
      } else if (e instanceof Api.ErroServidor && e.codigo === 'ia_limite') {
        VR.msgLeitura = { texto: `<b>O limite gratuito da IA foi atingido agora.</b> ${guardado} e ${foi === 'foram' ? 'são' : 'é'} ${lido} mais tarde, na sincronização. Você pode salvar assim mesmo.` };
      } else if (e instanceof Api.ErroRede) {
        VR.msgLeitura = { texto: `<b>Sem conexão com o servidor.</b> ${guardado} e ${foi === 'foram' ? 'são' : 'é'} ${lido} na próxima sincronização. Você pode salvar assim mesmo.` };
      } else {
        VR.msgLeitura = { texto: `<b>${esc(App().mensagemErroGeral(e))}</b> ${guardado} e ${foi === 'foram' ? 'são' : 'é'} ${lido} depois, na sincronização.` };
      }
    }
    VR.lendo = '';
    travarBotoesLeitura(false);
    renderIA();
  }

  /** De onde vieram os dados de um abastecimento já lido. */
  function textoFonte(f) {
    if (f === 'voz') return 'Lançado por voz.';
    if (f === 'sefaz') return 'Dados lidos da nota pelo site da SEFAZ.';
    if (f === 'ia') return 'Dados lidos da nota pela IA.';
    const p = String(f || '').split('+');
    if (!f) return '';
    return 'Dados lidos pela IA' + (p.includes('sefaz') ? ' e pelo site da SEFAZ (QR Code da nota)' : '') + '.';
  }

  /** Caixa de cima do abastecimento: leitura em andamento, esperando, resultado. */
  function renderIA() {
    const el = $('vr-ia');
    if (!el || !VR) return;
    const r = VR.r;
    const pendente = !!(r.lerVoz || r.lerNota);
    const partes = [];
    let classe = '';
    if (VR.lendo) {
      partes.push('<b>⏳ Lendo os áudios e as fotos…</b> A IA vai preencher só os campos que estão vazios.');
    } else if (pendente) {
      classe = 'laranja';
      const { oque, lido, vai, foi } = oQueFaltaLer();
      const con = Sync.conexao();
      if (VR.msgLeitura) partes.push(VR.msgLeitura.texto);
      else if (con === 'offline') partes.push(`<b>Sem internet:</b> ${oque} ${vai} ser ${lido} quando o celular estiver conectado. Você pode salvar assim mesmo.`);
      else if (con === 'wifi') partes.push(`<b>${maiuscula(oque)} ainda não ${foi} ${lido}.</b>`);
      else partes.push(`<b>Sem Wi-Fi:</b> ${oque} ${vai} ser ${lido} quando você tocar nas setas da tela inicial (no Wi-Fi é automático). Você pode salvar assim mesmo.`);
      if (con !== 'offline') {
        partes.push(`<div><button class="botao pequeno" type="button" id="vr-ler-agora">${VR.msgLeitura ? 'Tentar de novo' : con === 'wifi' ? 'Ler agora' : 'Ler agora pelos dados móveis'}</button></div>`);
      }
    } else {
      if (VR.msgLeitura) { partes.push(VR.msgLeitura.texto); classe = VR.msgLeitura.classe || ''; }
      else if (VR.leituraAgora) {
        const res = VR.leituraAgora.resumo;
        partes.push(res ? `<b>✓ Leitura feita:</b> ${esc(res)}. Os campos que estavam vazios foram preenchidos. Confira antes de salvar.`
          : '<b>✓ A IA preencheu os campos que estavam vazios.</b> Confira antes de salvar.');
      } else if (r.status === 'revisar') {
        partes.push((r.resumoLeitura ? `<b>Leitura feita:</b> ${esc(r.resumoLeitura)}.` : '<b>A leitura foi feita.</b>') +
          ' A IA preencheu os campos que estavam vazios. Confira e toque em Confirmar.');
      } else if (r.fonte) {
        partes.push(textoFonte(r.fonte));
      }
      const transcricao = (VR.leituraAgora && VR.leituraAgora.transcricao) || r.transcricao;
      if (transcricao) partes.push(`<div class="transcricao">“${esc(transcricao)}”</div>`);
      const avisos = VR.leituraAgora ? VR.leituraAgora.avisos : (r.status === 'revisar' || r.fonte ? r.observacao : '');
      if (avisos) partes.push(`<div class="dica">${esc(avisos)}</div>`);
    }
    el.innerHTML = partes.length ? `<div class="caixa-ia ${classe}">${partes.join(' ')}</div>` : '';
  }

  async function ouvirAudio(b) {
    b.disabled = true;
    b.textContent = 'Baixando…';
    try {
      const blob = await App().baixarArquivo(b.dataset.ouvir);
      const caixa = b.closest('.ouvir-audio');
      if (caixa) caixa.outerHTML = `<audio controls autoplay src="${App().urlDe(blob)}"></audio>`;
    } catch (err) {
      toast(App().erroAoBaixar(err, 'o áudio'), 5000);
      if (document.body.contains(b)) { b.disabled = false; b.textContent = '▶️ Ouvir'; }
    }
  }

  // ---- salvar e excluir ----
  function lerCamposDoForm(r) {
    const val = (id) => ($(id) ? $(id).value.trim() : '');
    r.data = val('vr-data');
    if ($('vr-valor')) r.valor = daMascara($('vr-valor'));
    if ($('vr-pagamento')) r.formaPagamento = $('vr-pagamento').value;
    if ($('vr-descricao')) r.descricao = $('vr-descricao').value.trim();
    if ($('vr-local')) r.local = val('vr-local');
    if ($('vr-km')) r.hodometro = daKm($('vr-km'));
    if (r.tipo === 'abastecimento') {
      r.combustivel = $('vr-combustivel').value;
      r.tanqueCheio = $('vr-tanque').checked;
      r.precoLitro = daMascara($('vr-preco'));
      r.litros = daMascara($('vr-litros'));
      r.calculado = ['precoLitro', 'litros', 'valor'].find(k => VR.calc[k] === 'calc') || ''; // fica só neste celular
    }
    if (r.tipo === 'seguro') {
      r.seguradora = val('vr-seguradora');
      r.apolice = val('vr-apolice');
      r.validade = val('vr-validade');
    }
    if (r.tipo === 'galeria') { r.valor = null; r.formaPagamento = ''; }
  }

  async function salvarRegistro() {
    if (!VR) return;
    if (VR.lendo) { toast('Aguarde: a IA ainda está lendo.'); return; }
    if (Gravador.gravando()) await pararGravacao(false); // o áudio é lido depois, na sincronização
    if (VR.somenteLeitura) return;
    const r = VR.r;
    const t = TIPOS[r.tipo];
    recalcularTres(null, { ignorarFoco: true }); // o campo calculado que estava sendo apagado volta
    lerCamposDoForm(r);
    const nFotos = VR.arquivos.filter(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id)).length + VR.fotosNovas.length;
    const pendente = !!(r.lerVoz || r.lerNota);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) { toast('Informe a data.'); return; }
    // campos obrigatórios (com áudio ou nota esperando a leitura, a IA ainda vai preencher)
    if (!pendente) {
      if (r.tipo === 'abastecimento') {
        const gnv = r.combustivel === 'GNV';
        if (!r.combustivel) { toast('Escolha o combustível.'); return; }
        if (!(r.valor > 0) && !(r.precoLitro > 0 && r.litros > 0)) { toast(`Informe o valor total (ou o valor do ${gnv ? 'm³' : 'litro'} e ${gnv ? 'os m³' : 'os litros'}).`); return; }
        if (!(r.precoLitro > 0)) { toast(`Informe o valor do ${gnv ? 'm³' : 'litro'} ou ${gnv ? 'os m³' : 'os litros'}.`); return; }
      } else if (r.tipo === 'galeria') {
        if (!nFotos && !r.descricao) { toast('Tire ou escolha uma foto (ou escreva um texto).'); return; }
      } else {
        if (!(r.valor > 0)) { toast('Informe o valor.'); return; }
        if (r.tipo === 'outros' && !r.descricao) { toast('Escreva a descrição da despesa.'); return; }
      }
    }
    if (TEM_KM.has(r.tipo) && r.hodometro != null) {
      const c = conflitoKm(r.hodometro);
      if (c && !(await App().confirmar(`O hodômetro (${fmtKm(r.hodometro)}) está ${textoConflito(c)}. Confira o número. ` +
          'Salvar mesmo assim? O lançamento fica marcado com ⚠️.', 'Salvar assim', 'Corrigir'))) {
        if ($('vr-km')) $('vr-km').focus();
        return;
      }
    }
    // os três valores do abastecimento foram digitados e não batem (V5)
    if (r.tipo === 'abastecimento' && !pendente && difValores(r.precoLitro, r.litros, r.valor)) {
      if (!(await App().confirmar(`Os três valores não batem: ${textoDifValores(r.precoLitro, r.litros, r.valor, r.combustivel)} ` +
          'Salvar mesmo assim? O lançamento fica marcado com ⚠️.', 'Salvar assim', 'Corrigir'))) return;
    }
    r.status = pendente ? 'aguardando_ia' : 'confirmado';
    r.lerVoz = !!r.lerVoz;
    r.lerNota = !!r.lerNota;
    r.automaticos = pendente ? Array.from(VR.auto) : [];
    r.lidosIA = Array.from(VR.ia); // fica só neste celular (V6)
    if (VR.gps) { r.lat = VR.gps.lat; r.lng = VR.gps.lng; }
    // local que ficou só com as coordenadas: o endereço é buscado na sincronização
    r.localPendente = !!(VR.localPendente && r.local && r.local === VR.localCoordenadas);
    r.localCoordenadas = r.localPendente ? VR.localCoordenadas : '';
    r.alteradoEm = Date.now();
    r.sync = 'pendente';
    const botao = $('vr-salvar');
    botao.disabled = true;
    try {
      // o mais recente salvo no aparelho (a sincronização pode ter atualizado algo)
      const salvo = await Banco.obter('registros', r.id);
      if (salvo) {
        ['versaoBase', 'tentouEnviar', 'qtdFotos', 'participante', 'chaveNota', 'tentativasEndereco'].forEach((k) => {
          if (salvo[k] !== undefined) r[k] = salvo[k];
        });
      }
      await Banco.gravar('registros', r);
      const agora = Date.now();
      for (let i = 0; i < VR.fotosNovas.length; i++) {
        const f = VR.fotosNovas[i];
        await Banco.gravar('arquivos', {
          id: f.id, lancamentoId: r.id, tipo: 'foto', mime: 'image/jpeg', blob: f.blob,
          tamanho: f.blob.size, criadoEm: agora + i, enviado: false, qr: f.qr || ''
        });
      }
      // todos os áudios novos ficam guardados, na ordem em que foram gravados (V6)
      for (let i = 0; i < VR.audiosNovos.length; i++) {
        const a = VR.audiosNovos[i];
        await Banco.gravar('arquivos', {
          id: a.id, lancamentoId: r.id, tipo: 'audio', mime: a.mime, blob: a.blob,
          tamanho: a.blob.size, duracao: a.duracao, criadoEm: agora + i, enviado: false
        });
      }
      for (const id of VR.removerIds) {
        const a = await Banco.obter('arquivos', id);
        if (!a) continue;
        if (a.enviado) { a.remover = true; await Banco.gravar('arquivos', a); } else await Banco.apagar('arquivos', id);
      }
    } catch (e) {
      toast('Não foi possível salvar no aparelho: ' + e.message, 5000);
      return;
    } finally {
      if (document.body.contains(botao)) botao.disabled = false;
    }
    if (pendente) {
      const { oque } = oQueFaltaLer();
      toast(Sync.conexao() === 'wifi' ? `${t.salvo}. A IA vai ler ${oque} agora.`
        : `${t.salvo} no celular. A IA lê ${oque} quando você tocar nas setas da tela inicial (no Wi-Fi é automático).`, 5000);
    } else {
      toastSalvo(VR.modo === 'revisar' ? `${t.nome} confirmado` : t.salvo);
    }
    VR.alterado = false;
    VR.fotosNovas = [];
    VR.audiosNovos = [];
    VR.token = null;
    App().voltar();
    App().agendarSync(800);
  }

  async function excluirRegistro() {
    if (VR.somenteLeitura) return;
    const t = TIPOS[VR.r.tipo];
    if (!(await App().confirmar(`Excluir ${t.isto}?`, 'Excluir', 'Cancelar'))) return;
    if (Gravador.gravando()) { clearInterval(VR.relogio); Gravador.cancelar(); }
    const r = await Banco.obter('registros', VR.r.id);
    let precisaEnviar = false;
    if (r) {
      if (!r.tentouEnviar && !r.versaoBase) {
        await Sync.apagarLocal(r.id, 'registros'); // nunca foi enviado: basta apagar daqui
      } else {
        r.excluirPendente = true;
        r.alteradoEm = Date.now();
        await Banco.gravar('registros', r);
        precisaEnviar = true;
      }
    }
    VR.alterado = false;
    VR.fotosNovas = [];
    VR.audiosNovos = [];
    VR.token = null;
    if (precisaEnviar) toastSalvo('Excluído');
    else toast('Excluído.');
    App().voltar();
    App().agendarSync(800);
  }

  // ---- eventos do formulário (um ouvinte só para todos os campos, que mudam com o tipo) ----
  function aoEditarRegistro(e) {
    if (!VR) return;
    if (e.target.type === 'file') {
      if (e.type === 'change' && e.target.id === 'vr-galeria') adicionarDaGaleria(e.target);
      return;
    }
    VR.alterado = true;
    const k = CAMPO[e.target.id];
    if (k) { VR.auto.delete(k); VR.ia.delete(k); }
    if (e.target.id === 'vr-local') { VR.localPendente = false; atualizarXLocal(); } // a pessoa escreveu o local
    if (e.target.id === 'vr-combustivel' && e.type === 'change') aoMudarCombustivel();
    if (TRES[e.target.id] && e.type === 'input') recalcularTres(e.target.id);
    if (e.target.id === 'vr-data') atualizarPlaceholderKm();
    if (e.target.id === 'vr-km' || e.target.id === 'vr-data') atualizarAvisoKm();
  }
  /** Saiu de um dos três valores: o calculado que ficou vazio é refeito. */
  function aoSairDoCampo(e) {
    if (VR && TRES[e.target.id]) setTimeout(() => { if (VR && $('vr-preco')) recalcularTres(null); }, 0);
  }
  function aoClicarRegistro(e) {
    if (!VR) return;
    if (e.target.closest('#vr-fotos')) {
      const chave = App().toqueNaMiniatura(e, 'vr-fotos');
      if (chave && !VR.somenteLeitura) removerFoto(chave);
      return;
    }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.classList.contains('campo-data')) { abrirCalendario(b); return; }
    switch (b.id) {
      case 'vr-local-limpar': limparLocal(); break;
      case 'vr-aviso-valores': explicarValores(); break;
      case 'vr-salvar': salvarRegistro(); break;
      case 'vr-excluir': excluirRegistro(); break;
      case 'vr-voz': alternarGravacao(); break;
      case 'vr-foto': adicionarFotosAbastecimento(); break;
      case 'vr-ler-agora': lerAgora(); break;
      case 'vr-gps': capturarLocal(VR.token, true); break;
      case 'vr-camera': tirarFotoGaleria(); break;
      default:
        if (b.dataset.ouvir) ouvirAudio(b);
        else if (b.dataset.removerAudio && !VR.somenteLeitura) removerAudio(b.dataset.removerAudio);
        break;
    }
  }

  // ------------------------------------------------------------------
  //  Calendário das datas dos veículos (V5): o ✏️ troca o calendário por um campo vazio (dd/mm/aaaa)
  // ------------------------------------------------------------------
  const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
  const MESES_CURTOS = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  const ANO_MIN = 1950;
  const ANO_MAX = 2100;

  /** Mostra a data no botão do campo (o valor fica em "value", no formato aaaa-mm-dd). */
  function definirData(campo, iso) {
    if (!campo) return;
    campo.value = iso || '';
    campo.textContent = iso ? dataCurta(iso) : (campo.dataset.opcional ? 'Não informada' : 'Escolha a data');
    campo.classList.toggle('vazio', !iso);
  }
  function isoDe(a, m, d) { return `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }
  function dataLonga(iso) {
    const [a, m, d] = iso.split('-').map(Number);
    return `${DIAS[new Date(a, m - 1, d).getDay()]}, ${d} de ${MESES_CURTOS[m - 1]} de ${a}`;
  }
  /** "19/11/2026" (ou "19/11/26") -> "2026-11-19"; '' se não for uma data de verdade. */
  function lerDataDigitada(t) {
    const d = String(t || '').replace(/\D/g, '');
    if (d.length !== 8 && d.length !== 6) return '';
    const dia = Number(d.slice(0, 2));
    const mes = Number(d.slice(2, 4));
    const ano = Number(d.slice(4)) + (d.length === 6 ? 2000 : 0);
    const dt = new Date(ano, mes - 1, dia);
    if (ano < ANO_MIN || ano > ANO_MAX || dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return '';
    return isoDe(ano, mes - 1, dia);
  }
  function mascaraData(input) {
    input.addEventListener('input', () => {
      const d = input.value.replace(/\D/g, '').slice(0, 8);
      let t = d.slice(0, 2);
      if (d.length > 2) t += '/' + d.slice(2, 4);
      if (d.length > 4) t += '/' + d.slice(4);
      if (t !== input.value) { input.value = t; fimDoCampo(input); }
    });
  }

  function abrirCalendario(campo) {
    const rotuloEl = document.querySelector(`label[for="${campo.id}"]`);
    const rotulo = rotuloEl ? rotuloEl.textContent.trim() : 'Data';
    const opcional = !!campo.dataset.opcional;
    const inicio = campo.value || hoje();
    const C = { sel: campo.value || '', ano: Number(inicio.slice(0, 4)), mes: Number(inicio.slice(5, 7)) - 1, digitar: false };
    App().abrirDialogo('<div class="fundo-dialogo" id="cal-fundo"><div class="dialogo calendario" role="dialog" aria-label="' + esc(rotulo) + '">' +
      `<div class="cal-topo"><div class="cal-titulo"><small>${esc(rotulo)}</small><b id="cal-escolhida"></b></div>` +
      '<button type="button" class="cal-modo" id="cal-modo"></button></div>' +
      '<div id="cal-corpo"></div><p class="erro" id="cal-erro"></p>' +
      '<div class="botoes cal-botoes">' + (opcional ? '<button class="botao" type="button" id="cal-limpar">Limpar</button>' : '') +
      '<span class="cal-espaco"></span><button class="botao" type="button" id="cal-cancelar">Cancelar</button>' +
      '<button class="botao primario" type="button" id="cal-ok">OK</button></div></div></div>', () => { /* o "voltar" só fecha */ });
    const desenhar = () => {
      $('cal-escolhida').textContent = C.sel ? dataLonga(C.sel) : 'Nenhuma data';
      const modo = $('cal-modo');
      modo.textContent = C.digitar ? '📅' : '✏️';
      modo.setAttribute('aria-label', C.digitar ? 'Escolher no calendário' : 'Digitar a data');
      modo.title = modo.getAttribute('aria-label');
      if (C.digitar) {
        // o campo para digitar começa vazio
        $('cal-corpo').innerHTML = '<label for="cal-texto">Digite a data</label>' +
          '<input id="cal-texto" inputmode="numeric" autocomplete="off" placeholder="dd/mm/aaaa" maxlength="10">';
        const t = $('cal-texto');
        mascaraData(t);
        t.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('cal-ok').click(); } });
        setTimeout(() => { if ($('cal-texto') === t) t.focus(); }, 50);
        return;
      }
      const primeiro = new Date(C.ano, C.mes, 1).getDay();
      const dias = new Date(C.ano, C.mes + 1, 0).getDate();
      const hj = hoje();
      let html = '<div class="cal-mes">' +
        `<button type="button" class="cal-seta" id="cal-ant" aria-label="Mês anterior"${C.ano <= ANO_MIN && C.mes === 0 ? ' disabled' : ''}>‹</button>` +
        `<b>${MESES[C.mes]} de ${C.ano}</b>` +
        `<button type="button" class="cal-seta" id="cal-prox" aria-label="Próximo mês"${C.ano >= ANO_MAX && C.mes === 11 ? ' disabled' : ''}>›</button></div>` +
        '<div class="cal-grade">' + SEMANA.map(d => `<span class="cal-sem">${d}</span>`).join('');
      for (let i = 0; i < primeiro; i++) html += '<span></span>';
      for (let d = 1; d <= dias; d++) {
        const iso = isoDe(C.ano, C.mes, d);
        html += `<button type="button" class="cal-dia${iso === C.sel ? ' escolhido' : ''}${iso === hj ? ' hoje' : ''}" data-dia="${iso}">${d}</button>`;
      }
      $('cal-corpo').innerHTML = html + '</div>';
    };
    const concluir = (iso) => {
      App().fecharDialogo();
      if (iso === campo.value) return;
      definirData(campo, iso);
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    };
    $('cal-fundo').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) { App().fecharDialogo(); return; } // tocar fora: cancela
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      $('cal-erro').textContent = '';
      if (b.dataset.dia) { C.sel = b.dataset.dia; desenhar(); return; }
      if (b.id === 'cal-ant' || b.id === 'cal-prox') {
        const m = C.ano * 12 + C.mes + (b.id === 'cal-ant' ? -1 : 1);
        C.ano = Math.floor(m / 12);
        C.mes = m % 12;
        desenhar();
      } else if (b.id === 'cal-modo') {
        if (C.digitar) {
          const iso = lerDataDigitada($('cal-texto').value);
          if (iso) { C.sel = iso; C.ano = Number(iso.slice(0, 4)); C.mes = Number(iso.slice(5, 7)) - 1; }
        }
        C.digitar = !C.digitar;
        desenhar();
      } else if (b.id === 'cal-cancelar') {
        App().fecharDialogo();
      } else if (b.id === 'cal-limpar') {
        concluir('');
      } else if (b.id === 'cal-ok') {
        let iso = C.sel;
        if (C.digitar) {
          const t = $('cal-texto').value;
          iso = lerDataDigitada(t);
          if (!iso) { $('cal-erro').textContent = t.trim() ? 'Data inválida. Use dd/mm/aaaa (ex.: 19/11/2026).' : 'Digite a data (dd/mm/aaaa).'; return; }
        }
        if (!iso) {
          if (opcional) concluir('');
          else $('cal-erro').textContent = 'Escolha uma data.';
          return;
        }
        concluir(iso);
      }
    });
    desenhar();
  }

  // ------------------------------------------------------------------
  //  Tela inicial (V6): os gastos dos veículos que a pessoa lançou (menos a Galeria)
  //  entram na lista e nos totais; tocando, o gasto abre direto.
  // ------------------------------------------------------------------
  async function paraInicio() {
    const veiculos = new Map((await Banco.todos('veiculos')).filter(v => !v.excluirPendente).map(v => [v.id, v]));
    const regs = (await Banco.todos('registros'))
      .filter(r => !r.excluirPendente && r.tipo !== 'galeria' && r.meu !== false && veiculos.has(r.veiculoId));
    if (!regs.length) return [];
    const arqs = await arquivosDe(regs.map(r => r.id));
    // ⚠️ do hodômetro: comparando com os outros gastos do mesmo veículo
    const km = new Map();
    const porVeiculo = {};
    (await Banco.todos('registros')).filter(r => !r.excluirPendente).forEach((r) => { (porVeiculo[r.veiculoId] = porVeiculo[r.veiculoId] || []).push(r); });
    Object.values(porVeiculo).forEach((lista) => { analisarKm(lista).forEach((v, k) => km.set(k, v)); });
    return regs.map((r) => {
      const [a, m, d] = String(r.data || '').split('-').map(Number);
      // o gasto de hoje entra na hora em que foi lançado; o de outro dia, ao meio-dia daquele dia
      let quando = a ? new Date(a, m - 1, d, 12).getTime() : (r.criadoEm || 0);
      if (r.criadoEm && App().chaveDia(r.criadoEm) === r.data) quando = r.criadoEm;
      return { quando, valor: r.valor > 0 ? Number(r.valor) : null, html: cartaoGasto(r, arqs[r.id] || [], km.get(r.id), false, '', veiculos.get(r.veiculoId)),
        resumo: resumoGasto(r, veiculos.get(r.veiculoId)), comHora: !!(r.criadoEm && App().chaveDia(r.criadoEm) === r.data) };
    });
  }
  function resumoGasto(r, v) {
    const t = TIPOS[r.tipo] || { icone: '•', nome: r.tipo };
    const nome = (r.tipo === 'manutencao' || r.tipo === 'outros') && r.descricao ? primeiraLinha(r.descricao) : t.nome;
    return `${t.icone} ${nome}${v ? ' · ' + v.modelo : ''}`;
  }

  /** Cartão "Veículos" da tela inicial (V7): quantos veículos e o último gasto (de qualquer pessoa, sem a Galeria). */
  async function resumoInicio() {
    const vs = await listaVeiculos();
    if (!vs.length) return { qtd: 0, texto: 'Cadastre seus veículos e lance os gastos de cada um' };
    const ids = new Map(vs.map(v => [v.id, v]));
    const ult = (await Banco.todos('registros')).filter(r => !r.excluirPendente && r.tipo !== 'galeria' && ids.has(r.veiculoId))
      .sort((a, b) => compararData(b, a))[0];
    const quem = vs.length === 1 ? vs[0].modelo : App().plural(vs.length, '1 veículo', '# veículos');
    if (!ult) return { qtd: vs.length, texto: quem + ' · nenhum gasto lançado ainda' };
    const t = TIPOS[ult.tipo] || { nome: ult.tipo };
    const nome = (ult.tipo === 'manutencao' || ult.tipo === 'outros') && ult.descricao ? primeiraLinha(ult.descricao) : t.nome;
    return { qtd: vs.length, texto: `${quem} · último gasto: ${nome}${vs.length > 1 ? ' (' + ids.get(ult.veiculoId).modelo + ')' : ''} · ${brl(ult.valor)}` };
  }

  /** Para o pedido de melhoria (V6): qual tipo de gasto (ou menu) a tela dos veículos está mostrando. */
  function tipoNaTela() {
    const tela = App().telaAtual();
    const d = dadosAtuais();
    if (tela === 'v-registro') return (VR && VR.r && VR.r.tipo) || d.tipo || '';
    if (tela === 'v-lista') return d.tipo || '';
    if (tela === 'v-menu') return d.menu || '';
    return '';
  }

  // ------------------------------------------------------------------
  //  Abastecimentos lidos pela IA esperando a revisão (aviso na tela inicial)
  // ------------------------------------------------------------------
  async function paraRevisar() {
    const ativos = new Set((await Banco.todos('veiculos')).filter(v => !v.excluirPendente).map(v => v.id));
    // só os que a própria pessoa lançou (o de quem compartilha o veículo é ela que revisa)
    return (await Banco.todos('registros'))
      .filter(r => r.status === 'revisar' && !r.excluirPendente && r.meu !== false && ativos.has(r.veiculoId))
      .sort((a, b) => (a.alteradoEm || 0) - (b.alteradoEm || 0));
  }

  // ------------------------------------------------------------------
  //  Botões das telas (os elementos já estão no index.html)
  // ------------------------------------------------------------------
  function ligar() {
    $('vf-montadoras').innerHTML = MONTADORAS.map(m => `<option value="${m}"></option>`).join('');
    $('vf-cores').innerHTML = CORES.map(c => `<option value="${c}"></option>`).join('');
    ['vc-voltar', 'vf-voltar', 'vx-voltar', 'vm-voltar', 'vl-voltar', 'vr-voltar', 'vs-voltar'].forEach((id) => { $(id).onclick = () => App().voltar(); });
    $('vc-adicionar').onclick = () => ir('veiculo-form', {});
    $('vc-lista').addEventListener('click', (e) => {
      const b = e.target.closest('[data-acao]');
      if (b) {
        if (b.dataset.acao === 'abrir-meu') ir('veiculo', { veiculoId: b.dataset.id });
        if (b.dataset.acao === 'recusar') recusarPendente(b.dataset.id);
        return;
      }
      const c = e.target.closest('[data-veiculo]');
      if (c) ir('veiculo', { veiculoId: c.dataset.veiculo });
    });
    $('vx-config').onclick = () => configDoVeiculo();
    $('vx-info').onclick = () => infoDoVeiculo();
    $('vf-obs').addEventListener('input', contarLetrasObs);
    $('vx-mais').onclick = () => menuDoVeiculo();
    const abrirCartao = (e) => {
      const aviso = e.target.closest('[data-aviso]');
      if (aviso) { explicarAviso(aviso.dataset.aviso, aviso.dataset.id); return; } // o ⚠️ explica, não abre o gasto
      const c = e.target.closest('[data-registro]');
      if (c) ir('v-registro', { registroId: c.dataset.registro });
    };
    $('vx-lista').addEventListener('click', abrirCartao);
    $('vl-lista').addEventListener('click', abrirCartao);
    $('vm-opcoes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tipo], [data-menu]');
      if (!b) return;
      const d = dadosAtuais();
      if (b.dataset.menu) ir('v-menu', { veiculoId: d.veiculoId, menu: b.dataset.menu });
      else ir('v-lista', { veiculoId: d.veiculoId, tipo: b.dataset.tipo });
    });
    $('vl-adicionar').onclick = () => {
      const d = dadosAtuais();
      ir('v-registro', { veiculoId: d.veiculoId, tipo: d.tipo });
    };
    $('vf-salvar').onclick = salvarVeiculo;
    $('vf-excluir').onclick = excluirVeiculo;
    $('tela-veiculo-form').addEventListener('input', () => { VF.alterado = true; $('vf-erro').textContent = ''; });
    const placa = $('vf-placa');
    placa.addEventListener('input', () => {
      const v = placa.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8);
      if (v !== placa.value) { placa.value = v; fimDoCampo(placa); }
    });
    placa.addEventListener('blur', () => { const n = normalizarPlaca(placa.value); if (n) placa.value = n; });
    const ano = $('vf-ano');
    ano.addEventListener('input', () => { const v = ano.value.replace(/\D/g, '').slice(0, 4); if (v !== ano.value) ano.value = v; });
    $('vr-conteudo').addEventListener('input', aoEditarRegistro);
    $('vr-conteudo').addEventListener('change', aoEditarRegistro);
    $('vr-conteudo').addEventListener('click', aoClicarRegistro);
    $('vr-conteudo').addEventListener('focusout', aoSairDoCampo);
    // compartilhar (V5)
    $('vs-compartilhar').onclick = () => compartilhar();
    ['vs-nome', 'vs-email'].forEach((id) => {
      $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (id === 'vs-nome') $('vs-email').focus(); else compartilhar(); } });
      $(id).addEventListener('input', () => { $('vs-erro').textContent = ''; });
    });
    $('vs-pessoas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-remover-comp]');
      if (b) removerCompartilhamento(b.dataset.removerComp);
    });
  }
  ligar();

  return {
    ehTela, mostrar, podeSair, aoSincronizar, paraRevisar,
    abrirLista, paraInicio, resumoInicio, tipoNaTela, explicarAviso, ir,
    // usados pelo relatório (relatorio.js, V7)
    _util: {
      veiculoAtivo, gastosDo, abrirCalendario, definirData,
      // V8 (planilha): o veículo é compartilhado (soma os gastos de todos)?
      compartilhado: async (v, regs) => !ehMeu(v) || (await compartilhamentosDe(v.id)).length > 0 || regs.some(r => r.meu === false)
    },
    abrirRegistro: (id) => ir('v-registro', { registroId: id }),
    // usados nos testes
    _textoMascara: textoMascara, _normalizarPlaca: normalizarPlaca, _analisarKm: analisarKm,
    _difValores: difValores, _lerDataDigitada: lerDataDigitada, _normalizarCor: normalizarCor
  };
})();
