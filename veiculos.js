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
// =====================================================================
const Veiculos = (() => {
  const $ = (id) => document.getElementById(id);
  const App = () => window.App; // funções do app.js (que é carregado depois deste arquivo)

  const TELAS = ['veiculos', 'veiculo-form', 'veiculo', 'v-menu', 'v-lista', 'v-registro'];
  const COMBUSTIVEIS = ['Gasolina Comum', 'Gasolina Aditivada', 'Gasolina Premium', 'Etanol Comum', 'Etanol Aditivado',
    'Diesel S10', 'Diesel S500', 'GNV'];
  // sugestões no campo "Montadora" (dá para digitar outra)
  const MONTADORAS = ['Audi', 'BMW', 'BYD', 'Caoa Chery', 'Chevrolet', 'Citroën', 'Dafra', 'Fiat', 'Ford', 'GWM', 'Harley-Davidson',
    'Honda', 'Hyundai', 'Iveco', 'JAC', 'Jeep', 'Kawasaki', 'Kia', 'Land Rover', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan',
    'Peugeot', 'Porsche', 'RAM', 'Renault', 'Royal Enfield', 'Scania', 'Shineray', 'Subaru', 'Suzuki', 'Toyota', 'Triumph',
    'Volkswagen', 'Volvo', 'Yamaha'];
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
  const OPCOES_NOTA_POSTO = { lerQr: true, ladoMaximo: 2400, qualidade: 0.8, tituloCamera: 'Foto da nota do posto', titulo: 'Nota do posto' };
  const OPCOES_FOTO_VEICULO = { tituloCamera: 'Foto do veículo', titulo: 'Foto do veículo' };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  // campo da tela -> campo do gasto (o que a pessoa mexe deixa de ser "automático" e a IA não troca)
  const CAMPO = {
    'vr-combustivel': 'combustivel', 'vr-tanque': 'tanqueCheio', 'vr-km': 'hodometro', 'vr-preco': 'precoLitro', 'vr-valor': 'valor',
    'vr-data': 'data', 'vr-pagamento': 'formaPagamento', 'vr-local': 'local', 'vr-descricao': 'descricao'
  };

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
  function unidade(comb) { return comb === 'GNV' ? 'm³' : 'L'; }
  function nomeVeiculo(v) { return `${v.modelo} · ${v.placa}`; }
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
    // o número sempre entra pela direita e o "apagar" tira o último, onde quer que esteja o cursor
    input.addEventListener('beforeinput', (e) => {
      const semSelecao = input.selectionStart === input.selectionEnd;
      if (e.inputType === 'insertText' && e.data != null && semSelecao) {
        e.preventDefault();
        const novos = e.data.replace(/\D/g, '');
        if (!novos) return;
        formatar(input.value + novos);
      } else if ((e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') && semSelecao) {
        e.preventDefault();
        formatar(input.value.replace(/\D/g, '').slice(0, -1));
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
      const mudou = VR.alterado || VR.fotosNovas.length || VR.audioNovo || Gravador.gravando();
      if (mudou && !(await App().confirmar('Descartar as alterações deste lançamento?', 'Descartar', 'Continuar editando'))) return false;
      if (Gravador.gravando()) { clearInterval(VR.relogio); Gravador.cancelar(); }
      VR.token = null; // a resposta da IA que ainda chegar é ignorada
      VR.alterado = false;
      VR.fotosNovas = [];
      VR.audioNovo = null;
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
    if (!['veiculos', 'veiculo', 'v-menu', 'v-lista'].includes(tela) || navegando) return;
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
    const aviso = perfil && perfil.servidorSemVeiculos
      ? '<div class="alerta-caixa laranja">O servidor ainda não foi atualizado para a versão 4. Os veículos e os gastos deles ficam guardados neste celular e são enviados depois que o organizador atualizar o Apps Script.</div>'
      : '';
    // sem veículo: só o botão "Adicionar veículo"
    $('vc-lista').innerHTML = aviso + vs.map(v => `<div class="cartao" data-veiculo="${esc(v.id)}" role="button">` +
      `<div class="corpo"><div class="desc">🚗 ${esc(v.modelo)}</div><div class="meta">${esc(v.placa)}</div></div>` +
      `<div class="direita"><span class="valor">${brl(Math.round((totais[v.id] || 0) * 100) / 100)}</span>` +
      `${v.sync === 'pendente' ? '<span class="selo fila">Na fila</span>' : ''}</div></div>`).join('');
    return true;
  }

  // ------------------------------------------------------------------
  //  Cadastro do veículo
  // ------------------------------------------------------------------
  const VF = { id: null, alterado: false };

  async function prepararFormVeiculo(id) {
    let v = null;
    if (id) {
      v = await veiculoAtivo(id);
      if (!v) return false;
    }
    VF.id = id;
    VF.alterado = false;
    $('vf-titulo').textContent = v ? 'Editar veículo' : 'Novo veículo';
    $('vf-montadora').value = v ? v.montadora || '' : '';
    $('vf-modelo').value = v ? v.modelo || '' : '';
    $('vf-ano').value = v && v.ano ? String(v.ano) : '';
    $('vf-placa').value = v ? v.placa || '' : '';
    $('vf-erro').textContent = '';
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
    if (!montadora) return erro('Informe a montadora.');
    if (!modelo) return erro('Informe o modelo.');
    if (!/^\d{4}$/.test(anoTexto) || ano < 1900 || ano > anoMaximo) return erro(`Informe o ano com 4 números (de 1900 a ${anoMaximo}).`);
    if (!placa) return erro('Placa inválida. Use o formato ABC1D23 (Mercosul) ou ABC-1234.');
    const repetida = (await listaVeiculos()).find(x => x.id !== VF.id && x.placa === placa);
    if (repetida) return erro(`Você já cadastrou um veículo com a placa ${placa} (${repetida.modelo}).`);
    const agora = Date.now();
    let v = VF.id ? await Banco.obter('veiculos', VF.id) : null;
    if (VF.id && (!v || v.excluirPendente)) { toast('Este veículo não existe mais.'); VF.alterado = false; App().voltar(); return; }
    if (!v) v = { id: novoId(), criadoEm: agora, versaoBase: 0 };
    Object.assign(v, { montadora, modelo, ano, placa, alteradoEm: agora, sync: 'pendente' });
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

  async function excluirVeiculo() {
    const v = await veiculoAtivo(VF.id);
    if (!v) return;
    const regs = await gastosDo(v.id);
    const n = regs.length;
    const msg = `Excluir o ${v.modelo} (${v.placa})?` +
      (n ? ` ${App().plural(n, 'O gasto lançado nele também será excluído', 'Os # gastos lançados nele também serão excluídos')}, com as fotos.` : '');
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
  function cartaoGasto(r, arqs, avisoKm, comMiniatura) {
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
    let metaHtml = meta.filter(Boolean).map(esc).join(' · ');
    if (avisoKm === 'sem') metaHtml += ' · <span class="aviso-km">⚠️ sem hodômetro</span>';
    if (avisoKm === 'ordem') metaHtml += ' · <span class="aviso-km">⚠️ km fora de ordem</span>';
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
    const mes = hoje().slice(0, 7);
    $('vx-titulo').textContent = v.modelo;
    $('vx-sub').textContent = [v.placa, [v.montadora, v.ano].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
    $('vx-totais').innerHTML = `<div><small>Este mês</small><b>${brl(totalDe(regs.filter(r => String(r.data).slice(0, 7) === mes)))}</b></div>` +
      `<div><small>Total</small><b>${brl(totalDe(regs))}</b></div>`;
    if (!regs.length) {
      $('vx-lista').innerHTML = '<div class="vazio">Nenhum gasto lançado ainda.<br>Toque no botão <b>+</b> lá embaixo para lançar.</div>';
      return true;
    }
    let html = '';
    let mesAtual = '';
    regs.forEach((r) => {
      const m = String(r.data).slice(0, 7);
      if (m !== mesAtual) { mesAtual = m; html += `<div class="dia">${esc(rotuloMes(m))}</div>`; }
      html += cartaoGasto(r, arqs[r.id] || [], km.get(r.id), false);
    });
    $('vx-lista').innerHTML = html;
    return true;
  }

  async function menuDoVeiculo() {
    const d = dadosAtuais();
    const escolha = await App().menuMais('Lançar gasto do veículo', [
      { valor: 'abastecimento', id: 'vx-abastecimento', icone: '⛽', texto: 'Abastecimento' },
      { valor: 'manutencao', id: 'vx-manutencao', icone: '🔧', texto: 'Manutenção' },
      { valor: 'despesas', id: 'vx-despesas', icone: '🧾', texto: 'Despesas' },
      { valor: 'galeria', id: 'vx-galeria', icone: '📷', texto: 'Galeria' }
    ]);
    if (escolha === 'abastecimento') ir('v-registro', { veiculoId: d.veiculoId, tipo: 'abastecimento' });
    else if (escolha === 'despesas') ir('v-menu', { veiculoId: d.veiculoId, menu: 'despesas' });
    else if (escolha) ir('v-lista', { veiculoId: d.veiculoId, tipo: escolha });
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
    $('vl-totais').innerHTML = tipo === 'galeria' ? ''
      : `<div><small>Total</small><b>${brl(totalDe(regs))}</b></div><div><small>Lançamentos</small><b>${regs.length}</b></div>`;
    $('vl-lista').innerHTML = regs.length
      ? regs.map(r => cartaoGasto(r, arqs[r.id] || [], km.get(r.id), tipo === 'galeria')).join('')
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
      fotosNovas: [], removerIds: [], audioNovo: null, alterado: false,
      // valores que o app pôs sozinho (a leitura da IA pode trocar); o que a pessoa digita sai daqui
      auto: new Set(modo === 'novo' ? ['data', 'precoLitro', 'local', 'tanqueCheio'] : (r.status === 'aguardando_ia' ? (r.automaticos || []) : [])),
      gps: null, localPendente: !!r.localPendente, localCoordenadas: r.localCoordenadas || '',
      lendo: '', msgLeitura: null, leituraAgora: null, relogio: null
    };
    montarFormRegistro();
    await preencherFormRegistro();
    if (modo === 'novo' && TEM_LOCAL.has(r.tipo)) capturarLocal(VR.token, false);
    return true;
  }

  function campoValorHtml(id, rotulo, casas = 2) {
    return `<label for="${id}">${rotulo}</label><input id="${id}" class="caixa-registradora" data-casas="${casas}" ` +
      `inputmode="numeric" autocomplete="off" placeholder="${casas === 3 ? '0,000' : '0,00'}">`;
  }
  function campoDataHtml(rotulo = 'Data') {
    return `<label for="vr-data">${rotulo}</label><input type="date" id="vr-data" min="1950-01-01" max="2100-12-31">`;
  }
  const HTML_KM = '<label for="vr-km">Hodômetro (km)</label><input id="vr-km" inputmode="numeric" autocomplete="off">' +
    '<small class="aviso-campo" id="vr-km-aviso"></small>';
  const HTML_PAGAMENTO = '<label for="vr-pagamento">Forma de pagamento</label><select id="vr-pagamento"></select>';
  const HTML_LOCAL = '<div class="rotulo-com-botao"><label for="vr-local">Local</label>' +
    '<button type="button" class="link-pequeno" id="vr-gps">📍 Usar minha localização</button></div>' +
    '<input id="vr-local" autocomplete="off" autocapitalize="sentences" placeholder="Endereço ou nome do lugar">';
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
            '<button class="botao" type="button" id="vr-voz">🎤 Lançar por voz</button>' +
            '<button class="botao" type="button" id="vr-nota">🧾 Ler nota do posto</button></div>' +
          '<div id="vr-ia"></div>' +
          '<label for="vr-combustivel">Combustível</label>' +
          '<div class="linha-combustivel"><select id="vr-combustivel"></select>' +
            '<label class="marcar"><input type="checkbox" id="vr-tanque"> Tanque cheio</label></div>' +
          HTML_KM +
          '<div class="duas-colunas">' +
            `<div>${campoValorHtml('vr-preco', '<span id="vr-preco-rotulo">Valor do litro</span> (R$)', 3)}</div>` +
            `<div>${campoValorHtml('vr-valor', 'Valor total (R$)')}</div></div>` +
          '<div class="litros" id="vr-litros"></div>' +
          campoDataHtml() + HTML_PAGAMENTO + HTML_LOCAL +
          '<div id="vr-bloco-fotos" class="oculto"><label>Fotos da nota</label><div class="fotos" id="vr-fotos"></div></div>';
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
          '<div><label for="vr-validade">Validade</label><input type="date" id="vr-validade" min="1950-01-01" max="2100-12-31"></div></div>' +
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
    html += `<div class="rodape-form"><button class="botao primario grande" id="vr-salvar" type="button">${modo === 'revisar' ? 'Confirmar' : 'Salvar'}</button>` +
      (modo === 'novo' ? '' : `<button class="botao perigo" id="vr-excluir" type="button">${esc(t.excluir)}</button>`) + '</div>';
    $('vr-conteudo').innerHTML = html;
    $('vr-conteudo').querySelectorAll('.caixa-registradora').forEach(caixaRegistradora);
    if ($('vr-km')) mascaraKm($('vr-km'));
  }

  async function preencherFormRegistro() {
    const r = VR.r;
    const L = await App().listas();
    if ($('vr-data')) $('vr-data').value = r.data || hoje();
    if ($('vr-valor')) $('vr-valor').value = paraMascara(r.valor, 2);
    if ($('vr-pagamento')) App().preencherSelect($('vr-pagamento'), meiosVeiculo(L.meios), r.formaPagamento, 'Não informado');
    if ($('vr-descricao')) $('vr-descricao').value = r.descricao || '';
    if ($('vr-local')) $('vr-local').value = r.local || '';
    if ($('vr-km')) $('vr-km').value = textoKm(r.hodometro);
    if ($('vr-seguradora')) {
      $('vr-seguradora').value = r.seguradora || '';
      $('vr-apolice').value = r.apolice || '';
      $('vr-validade').value = r.validade || '';
    }
    if (r.tipo === 'abastecimento') {
      const opcoes = COMBUSTIVEIS.slice();
      if (r.combustivel && !opcoes.includes(r.combustivel)) opcoes.unshift(r.combustivel);
      $('vr-combustivel').innerHTML = '<option value="">Escolha</option>' +
        opcoes.map(c => `<option${c === r.combustivel ? ' selected' : ''}>${esc(c)}</option>`).join('');
      $('vr-tanque').checked = !!r.tanqueCheio;
      $('vr-preco').value = paraMascara(r.precoLitro, 3);
      atualizarRotulosCombustivel();
      atualizarLitros();
      atualizarBotaoVoz();
      renderIA();
    }
    if (TEM_KM.has(r.tipo)) { atualizarPlaceholderKm(); atualizarAvisoKm(); }
    if (r.tipo === 'abastecimento' || r.tipo === 'galeria') await renderFotos();
  }

  // ---- abastecimento: combustível, último preço, litros e hodômetro ----
  function ultimoPreco(comb) {
    const r = VR.outros.filter(x => x.tipo === 'abastecimento' && x.combustivel === comb && x.precoLitro > 0).sort(compararData).pop();
    return r ? r.precoLitro : null;
  }
  /** O valor do litro vem com o último que a pessoa pagou por esse combustível (ela pode trocar). */
  function aplicarUltimoPreco() {
    const campo = $('vr-preco');
    if (!campo || (!VR.auto.has('precoLitro') && campo.value)) return; // a pessoa já digitou o preço
    const comb = $('vr-combustivel').value;
    campo.value = paraMascara(comb ? ultimoPreco(comb) : null, 3);
    VR.auto.add('precoLitro');
  }
  function atualizarRotulosCombustivel() {
    const el = $('vr-preco-rotulo');
    if (el) el.textContent = $('vr-combustivel').value === 'GNV' ? 'Valor do m³' : 'Valor do litro';
  }
  function aoMudarCombustivel() {
    aplicarUltimoPreco();
    atualizarRotulosCombustivel();
    atualizarLitros();
  }
  function atualizarLitros() {
    const el = $('vr-litros');
    if (!el) return;
    const preco = daMascara($('vr-preco'));
    const total = daMascara($('vr-valor'));
    const gnv = $('vr-combustivel').value === 'GNV';
    const nome = gnv ? 'Metros cúbicos' : 'Litros';
    el.innerHTML = preco > 0 && total > 0
      ? `${nome}: <b>${fmtNum(Math.round(total / preco * 1000) / 1000, 3)} ${gnv ? 'm³' : 'L'}</b>`
      : `${nome}: <b>—</b> <small>(valor total ÷ valor do ${gnv ? 'm³' : 'litro'})</small>`;
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
      VR.auto.add('local');
      VR.localPendente = true;
      VR.localCoordenadas = coord;
      if (forcar) VR.alterado = true;
      if (Sync.conexao() === 'offline') return; // o endereço vem depois, na sincronização
      try {
        const r = await Api.chamar('endereco', { lat: pos.lat, lng: pos.lng }, { tempoMs: 15000 });
        if (!VR || VR.token !== token || !r.endereco) return;
        const c2 = $('vr-local');
        if (c2 && c2.value === coord) { c2.value = r.endereco; VR.localPendente = false; }
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
    if (VR.r.tipo === 'abastecimento' && !n && VR.r.lerNota) { VR.r.lerNota = false; VR.r.qrNota = ''; renderIA(); }
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

  // ---- "Lançar por voz" e "Ler nota do posto": a IA preenche só os campos vazios ----
  function audioAtual() {
    if (VR.audioNovo) return VR.audioNovo;
    return VR.arquivos.filter(a => a.tipo === 'audio' && !VR.removerIds.includes(a.id))
      .sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0] || null;
  }
  function atualizarBotaoVoz() {
    const b = $('vr-voz');
    if (!b) return;
    b.classList.remove('gravando');
    b.textContent = audioAtual() ? '🎤 Gravar de novo' : '🎤 Lançar por voz';
  }
  function travarBotoesLeitura(travar) {
    ['vr-voz', 'vr-nota'].forEach((id) => { if ($(id)) $(id).disabled = travar; });
  }

  async function alternarGravacao() {
    if (Gravador.gravando()) { await pararGravacao(true); return; }
    if (VR.lendo) return;
    if (!Gravador.suportado()) { toast('Este navegador não permite gravar áudio. Use o Chrome.', 4500); return; }
    if (audioAtual() && !(await App().confirmar('Gravar de novo? O áudio atual será trocado pelo novo.', 'Gravar de novo', 'Cancelar'))) return;
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
    if ($('vr-nota')) $('vr-nota').disabled = true;
  }

  /** lerJa: no Wi-Fi a IA lê na hora (ao salvar no meio da gravação, a leitura fica para a sincronização). */
  async function pararGravacao(lerJa) {
    clearInterval(VR.relogio);
    const token = VR.token;
    const res = await Gravador.parar();
    if (!VR || VR.token !== token) return;
    atualizarBotaoVoz();
    if ($('vr-nota')) $('vr-nota').disabled = false;
    if (!res) { toast('Nada foi gravado. Toque em “Lançar por voz” para tentar de novo.'); return; }
    if (!VR.audioNovo) { const antigo = audioAtual(); if (antigo) VR.removerIds.push(antigo.id); } // o áudio que já estava salvo sai
    VR.audioNovo = { id: novoId(), blob: res.blob, duracao: res.duracao, mime: res.blob.type || 'audio/webm' };
    VR.alterado = true;
    VR.r.lerVoz = true;
    VR.leituraAgora = null;
    VR.msgLeitura = null;
    atualizarBotaoVoz();
    if (lerJa && Sync.conexao() === 'wifi') lerAgora(['voz']);
    else renderIA();
  }

  function escolherFotoNota() {
    return new Promise((ok) => {
      App().abrirDialogo('<div class="fundo-dialogo"><div class="dialogo" role="dialog"><h2>Nota do posto</h2>' +
        '<p>Tire a foto da nota (ou do cupom) do posto. Com o QR Code, os dados vêm do site da SEFAZ; sem ele, a IA lê a foto.</p>' +
        '<div class="botoes coluna"><button class="botao primario" type="button" id="dlg-nota-camera">📷 Tirar foto</button>' +
        '<label class="botao arquivo">🖼️ Escolher da galeria<input type="file" accept="image/*" id="dlg-nota-galeria"></label>' +
        '<button class="botao" type="button" id="dlg-nota-cancelar">Cancelar</button></div></div></div>', () => ok(null));
      $('dlg-nota-camera').onclick = () => { App().fecharDialogo(); ok({ modo: 'camera' }); };
      $('dlg-nota-cancelar').onclick = () => { App().fecharDialogo(); ok(null); };
      $('dlg-nota-galeria').onchange = (e) => { const input = e.target; App().fecharDialogo(); ok({ modo: 'galeria', input }); };
    });
  }

  async function lerNotaDoPosto() {
    if (VR.lendo || Gravador.gravando()) return;
    const token = VR.token;
    const escolha = await escolherFotoNota();
    if (!escolha) return;
    const novas = [];
    if (escolha.modo === 'camera') await App().tirarFotos(novas, OPCOES_NOTA_POSTO);
    else await App().adicionarFotos(escolha.input, novas, OPCOES_NOTA_POSTO);
    if (!VR || VR.token !== token || !novas.length) return;
    VR.fotosNovas.push(...novas);
    const comQr = novas.find(f => f.qr);
    if (comQr) VR.r.qrNota = comQr.qr;
    VR.alterado = true;
    VR.r.lerNota = true;
    VR.leituraAgora = null;
    VR.msgLeitura = null;
    await renderFotos();
    if (Sync.conexao() === 'wifi') lerAgora(['nota']);
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
  async function fotosParaLeitura() {
    const lista = [];
    const existentes = VR.arquivos.filter(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id))
      .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    for (const a of existentes) lista.push({ mime: a.mime || 'image/jpeg', base64: await base64DoArquivo(a) });
    for (const f of VR.fotosNovas) lista.push({ mime: 'image/jpeg', base64: await Sync.blobParaBase64(f.blob) });
    return lista;
  }

  /** Passa para a tela o que a leitura trouxe: só nos campos vazios ou que o app preencheu sozinho. */
  function aplicarLeituraNoForm(resp) {
    const c = (resp && resp.campos) || {};
    const livre = (id, k) => { const el = $(id); return !!el && (!el.value || VR.auto.has(k)); };
    if (c.combustivel && livre('vr-combustivel', 'combustivel')) {
      const sel = $('vr-combustivel');
      if (!Array.from(sel.options).some(o => o.value === c.combustivel)) sel.add(new Option(c.combustivel, c.combustivel));
      sel.value = c.combustivel;
      VR.auto.delete('combustivel');
      aoMudarCombustivel();
    }
    if (c.hodometro != null && livre('vr-km', 'hodometro')) { $('vr-km').value = textoKm(c.hodometro); VR.auto.delete('hodometro'); }
    if (c.precoLitro > 0 && livre('vr-preco', 'precoLitro')) { $('vr-preco').value = paraMascara(c.precoLitro, 3); VR.auto.delete('precoLitro'); }
    if (c.valorTotal > 0 && livre('vr-valor', 'valor')) { $('vr-valor').value = paraMascara(c.valorTotal, 2); VR.auto.delete('valor'); }
    if (c.formaPagamento && livre('vr-pagamento', 'formaPagamento')) {
      const sel = $('vr-pagamento');
      if (!Array.from(sel.options).some(o => o.value === c.formaPagamento)) sel.add(new Option(c.formaPagamento, c.formaPagamento));
      sel.value = c.formaPagamento;
      VR.auto.delete('formaPagamento');
    }
    if (c.data && livre('vr-data', 'data')) { $('vr-data').value = c.data; VR.auto.delete('data'); }
    if (c.local && livre('vr-local', 'local')) { $('vr-local').value = c.local; VR.auto.delete('local'); VR.localPendente = false; }
    if (c.tanqueCheio === true && $('vr-tanque') && !$('vr-tanque').checked && VR.auto.has('tanqueCheio')) {
      $('vr-tanque').checked = true;
      VR.auto.delete('tanqueCheio');
    }
    VR.alterado = true;
    atualizarLitros();
    atualizarPlaceholderKm();
    atualizarAvisoKm();
  }

  /** Lê agora (no Wi-Fi é automático; nos dados móveis, só se a pessoa pedir). */
  async function lerAgora(modos) {
    if (!VR || VR.lendo || !modos.length) return;
    const token = VR.token;
    VR.msgLeitura = null;
    const leitura = { transcricao: '', avisos: [], fontes: [] };
    let leu = false;
    travarBotoesLeitura(true);
    for (const modo of modos) {
      VR.lendo = modo;
      renderIA();
      const flag = modo === 'voz' ? 'lerVoz' : 'lerNota';
      try {
        let resp;
        if (modo === 'voz') {
          const a = audioAtual();
          if (!a) { VR.r.lerVoz = false; continue; }
          const base64 = await base64DoArquivo(a);
          resp = await Api.chamar('lerVeiculo', { modo: 'audio', mime: a.mime || 'audio/webm', base64 }, { tempoMs: 150000 });
        } else {
          resp = await Sync.lerNotaPosto(qrAtual(), fotosParaLeitura);
        }
        if (!VR || VR.token !== token) return; // a pessoa saiu da tela: a leitura fica para a sincronização
        aplicarLeituraNoForm(resp);
        VR.r[flag] = false;
        if (modo === 'voz') {
          leitura.transcricao = resp.transcricao || '';
          VR.r.transcricao = leitura.transcricao;
          if (!VR.r.fonte) VR.r.fonte = 'voz';
        } else {
          VR.r.fonte = resp.fonte || 'ia';
          if (resp.chave) VR.r.chaveNota = resp.chave;
        }
        const av = Sync.avisosDaLeitura(resp);
        if (av) leitura.avisos.push(av);
        leitura.fontes.push(modo === 'voz' ? 'voz' : (resp.fonte || 'ia'));
        leu = true;
      } catch (e) {
        if (!VR || VR.token !== token) return;
        const oque = modo === 'voz' ? 'O áudio fica guardado e é lido' : 'A nota fica guardada e é lida';
        if (e instanceof Api.ErroServidor && ['ia_falhou', 'dados_invalidos', 'arquivo_inexistente'].includes(e.codigo)) {
          VR.r[flag] = false;
          VR.msgLeitura = { classe: 'vermelho', texto: `<b>${modo === 'voz' ? 'A IA não conseguiu entender o áudio' : 'Não foi possível ler a nota'}.</b> Preencha você mesmo.` };
        } else if (e instanceof Api.ErroServidor && e.codigo === 'ia_limite') {
          VR.msgLeitura = { texto: `<b>O limite gratuito da IA foi atingido agora.</b> ${oque} mais tarde, na sincronização. Você pode salvar assim mesmo.` };
        } else if (e instanceof Api.ErroRede) {
          VR.msgLeitura = { texto: `<b>Sem conexão com o servidor.</b> ${oque} na próxima sincronização. Você pode salvar assim mesmo.` };
        } else {
          VR.msgLeitura = { texto: `<b>${esc(App().mensagemErroGeral(e))}</b> ${oque} depois, na sincronização.` };
        }
      }
    }
    VR.lendo = '';
    if (leu) {
      VR.leituraAgora = { transcricao: leitura.transcricao, avisos: leitura.avisos.join(' '), fontes: leitura.fontes };
      VR.r.observacao = VR.leituraAgora.avisos.slice(0, 500); // vai junto para o servidor (ex.: outros itens da nota)
    }
    travarBotoesLeitura(false);
    renderIA();
  }

  /** Caixa de cima do abastecimento: leitura em andamento, esperando, resultado, áudio. */
  function renderIA() {
    const el = $('vr-ia');
    if (!el || !VR) return;
    const r = VR.r;
    const pendente = !!(r.lerVoz || r.lerNota);
    const partes = [];
    let classe = '';
    if (VR.lendo) {
      partes.push(`<b>⏳ ${VR.lendo === 'voz' ? 'Lendo o áudio…' : 'Lendo a nota…'}</b> A IA vai preencher só os campos que estão vazios.`);
    } else if (pendente) {
      classe = 'laranja';
      const oque = r.lerVoz && r.lerNota ? 'o áudio e a nota' : r.lerVoz ? 'o áudio' : 'a nota';
      const lido = r.lerVoz && r.lerNota ? 'lidos' : r.lerVoz ? 'lido' : 'lida';
      const vai = r.lerVoz && r.lerNota ? 'vão' : 'vai';
      const con = Sync.conexao();
      if (VR.msgLeitura) partes.push(VR.msgLeitura.texto);
      else if (con === 'offline') partes.push(`<b>Sem internet:</b> ${oque} ${vai} ser ${lido} quando o celular estiver conectado. Você pode salvar assim mesmo.`);
      else if (con === 'wifi') partes.push(`<b>${maiuscula(oque)} ainda não ${r.lerVoz && r.lerNota ? 'foram' : 'foi'} ${lido}.</b>`);
      else partes.push(`<b>Sem Wi-Fi:</b> ${oque} ${vai} ser ${lido} quando você tocar nas setas da tela inicial (no Wi-Fi é automático). Você pode salvar assim mesmo.`);
      if (con !== 'offline') {
        partes.push(`<div><button class="botao pequeno" type="button" id="vr-ler-agora">${VR.msgLeitura ? 'Tentar de novo' : con === 'wifi' ? 'Ler agora' : 'Ler agora pelos dados móveis'}</button></div>`);
      }
    } else {
      if (VR.msgLeitura) { partes.push(VR.msgLeitura.texto); classe = VR.msgLeitura.classe || ''; }
      else if (VR.leituraAgora) {
        const f = VR.leituraAgora.fontes || [];
        partes.push(f.length === 1 && f[0] === 'sefaz'
          ? '<b>✓ A nota foi lida no site da SEFAZ (pelo QR Code)</b> e preencheu os campos que estavam vazios. Confira antes de salvar.'
          : f.length === 1 && f[0] !== 'voz'
            ? '<b>✓ A IA leu a foto da nota</b> e preencheu os campos que estavam vazios. Confira antes de salvar.'
            : '<b>✓ A IA preencheu os campos que estavam vazios.</b> Confira antes de salvar.');
      }
      else if (r.status === 'revisar') {
        partes.push(`<b>${r.fonte === 'voz' ? 'O áudio foi lido' : 'A nota foi lida'}.</b> A IA preencheu os campos que estavam vazios. Confira e toque em Confirmar.`);
      } else if (r.fonte) {
        partes.push(r.fonte === 'voz' ? 'Lançado por voz.' : r.fonte === 'sefaz' ? 'Dados lidos da nota pelo site da SEFAZ.' : 'Dados lidos da nota pela IA.');
      }
      const transcricao = (VR.leituraAgora && VR.leituraAgora.transcricao) || r.transcricao;
      if (transcricao) partes.push(`<div class="transcricao">“${esc(transcricao)}”</div>`);
      const avisos = VR.leituraAgora ? VR.leituraAgora.avisos : (r.status === 'revisar' || r.fonte ? r.observacao : '');
      if (avisos) partes.push(`<div class="dica">${esc(avisos)}</div>`);
    }
    const audio = audioAtual();
    if (audio && !VR.lendo) {
      if (audio.blob) partes.push(`<audio controls src="${App().urlDe(audio.blob)}"></audio>`);
      else if (audio.enviado) {
        partes.push(`<div class="ouvir-audio" id="vr-ouvir-caixa"><button class="botao pequeno" type="button" id="vr-ouvir" data-arquivo="${esc(audio.id)}">▶️ Ouvir o áudio</button>` +
          '<small class="dica">O áudio está guardado no servidor (precisa de internet).</small></div>');
      }
    }
    el.innerHTML = partes.length ? `<div class="caixa-ia ${classe}">${partes.join(' ')}</div>` : '';
  }

  async function ouvirAudio(b) {
    b.disabled = true;
    b.textContent = 'Baixando o áudio…';
    try {
      const blob = await App().baixarArquivo(b.dataset.arquivo);
      const caixa = $('vr-ouvir-caixa');
      if (caixa) caixa.innerHTML = `<audio controls autoplay src="${App().urlDe(blob)}"></audio>`;
    } catch (err) {
      toast(App().erroAoBaixar(err, 'o áudio'), 5000);
      if (document.body.contains(b)) { b.disabled = false; b.textContent = '▶️ Ouvir o áudio'; }
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
      r.litros = r.valor > 0 && r.precoLitro > 0 ? Math.round(r.valor / r.precoLitro * 1000) / 1000 : null;
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
    const r = VR.r;
    const t = TIPOS[r.tipo];
    lerCamposDoForm(r);
    const nFotos = VR.arquivos.filter(a => a.tipo === 'foto' && !VR.removerIds.includes(a.id)).length + VR.fotosNovas.length;
    const pendente = !!(r.lerVoz || r.lerNota);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data)) { toast('Informe a data.'); return; }
    // campos obrigatórios (com áudio ou nota esperando a leitura, a IA ainda vai preencher)
    if (!pendente) {
      if (r.tipo === 'abastecimento') {
        if (!r.combustivel) { toast('Escolha o combustível.'); return; }
        if (!(r.precoLitro > 0)) { toast(`Informe o valor do ${r.combustivel === 'GNV' ? 'm³' : 'litro'}.`); return; }
        if (!(r.valor > 0)) { toast('Informe o valor total.'); return; }
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
    r.status = pendente ? 'aguardando_ia' : 'confirmado';
    r.lerVoz = !!r.lerVoz;
    r.lerNota = !!r.lerNota;
    r.automaticos = pendente ? Array.from(VR.auto) : [];
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
          tamanho: f.blob.size, criadoEm: agora + i, enviado: false
        });
      }
      if (VR.audioNovo) {
        const a = VR.audioNovo;
        await Banco.gravar('arquivos', {
          id: a.id, lancamentoId: r.id, tipo: 'audio', mime: a.mime, blob: a.blob,
          tamanho: a.blob.size, duracao: a.duracao, criadoEm: agora, enviado: false
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
      const oque = r.lerVoz && r.lerNota ? 'o áudio e a nota' : r.lerVoz ? 'o áudio' : 'a nota';
      toast(Sync.conexao() === 'wifi' ? `${t.salvo}. A IA vai ler ${oque} agora.`
        : `${t.salvo} no celular. A IA lê ${oque} quando você tocar nas setas da tela inicial (no Wi-Fi é automático).`, 5000);
    } else {
      toastSalvo(VR.modo === 'revisar' ? `${t.nome} confirmado` : t.salvo);
    }
    VR.alterado = false;
    VR.fotosNovas = [];
    VR.audioNovo = null;
    VR.token = null;
    App().voltar();
    App().agendarSync(800);
  }

  async function excluirRegistro() {
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
    VR.audioNovo = null;
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
    if (k) VR.auto.delete(k);
    if (e.target.id === 'vr-local') VR.localPendente = false; // a pessoa escreveu o local
    if (e.target.id === 'vr-combustivel' && e.type === 'change') aoMudarCombustivel();
    if (e.target.id === 'vr-preco' || e.target.id === 'vr-valor') atualizarLitros();
    if (e.target.id === 'vr-data') atualizarPlaceholderKm();
    if (e.target.id === 'vr-km' || e.target.id === 'vr-data') atualizarAvisoKm();
  }
  function aoClicarRegistro(e) {
    if (!VR) return;
    if (e.target.closest('#vr-fotos')) {
      const chave = App().toqueNaMiniatura(e, 'vr-fotos');
      if (chave) removerFoto(chave);
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    switch (b.id) {
      case 'vr-salvar': salvarRegistro(); break;
      case 'vr-excluir': excluirRegistro(); break;
      case 'vr-voz': alternarGravacao(); break;
      case 'vr-nota': lerNotaDoPosto(); break;
      case 'vr-ler-agora': lerAgora([VR.r.lerVoz ? 'voz' : '', VR.r.lerNota ? 'nota' : ''].filter(Boolean)); break;
      case 'vr-gps': capturarLocal(VR.token, true); break;
      case 'vr-camera': tirarFotoGaleria(); break;
      case 'vr-ouvir': ouvirAudio(b); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------
  //  Abastecimentos lidos pela IA esperando a revisão (aviso na tela inicial)
  // ------------------------------------------------------------------
  async function paraRevisar() {
    const ativos = new Set((await Banco.todos('veiculos')).filter(v => !v.excluirPendente).map(v => v.id));
    return (await Banco.todos('registros'))
      .filter(r => r.status === 'revisar' && !r.excluirPendente && ativos.has(r.veiculoId))
      .sort((a, b) => (a.alteradoEm || 0) - (b.alteradoEm || 0));
  }

  // ------------------------------------------------------------------
  //  Botões das telas (os elementos já estão no index.html)
  // ------------------------------------------------------------------
  function ligar() {
    $('vf-montadoras').innerHTML = MONTADORAS.map(m => `<option value="${m}"></option>`).join('');
    ['vc-voltar', 'vf-voltar', 'vx-voltar', 'vm-voltar', 'vl-voltar', 'vr-voltar'].forEach((id) => { $(id).onclick = () => App().voltar(); });
    $('vc-adicionar').onclick = () => ir('veiculo-form', {});
    $('vc-lista').addEventListener('click', (e) => {
      const c = e.target.closest('[data-veiculo]');
      if (c) ir('veiculo', { veiculoId: c.dataset.veiculo });
    });
    $('vx-editar').onclick = () => ir('veiculo-form', { veiculoId: dadosAtuais().veiculoId });
    $('vx-mais').onclick = () => menuDoVeiculo();
    const abrirCartao = (e) => {
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
  }
  ligar();

  return {
    ehTela, mostrar, podeSair, aoSincronizar, paraRevisar,
    abrirLista: () => ir('veiculos', {}),
    abrirRegistro: (id) => ir('v-registro', { registroId: id }),
    // usados nos testes
    _textoMascara: textoMascara, _normalizarPlaca: normalizarPlaca, _analisarKm: analisarKm
  };
})();
