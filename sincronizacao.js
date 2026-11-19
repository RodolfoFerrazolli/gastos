// =====================================================================
//  SINCRONIZAÇÃO
//  - No Wi-Fi: automática enquanto o app está aberto.
//  - Nos dados móveis: só quando a pessoa toca nas setas (ou em
//    "Sincronizar agora").
//  - Cada lançamento e cada arquivo têm um identificador único: reenviar
//    nunca duplica nada no servidor.
//  - Os lançamentos são da conta: entrando em outro celular, o histórico
//    vem junto (fotos e áudios ficam no Drive; o celular mostra um aviso).
//  - V4: os veículos e os gastos de cada um seguem as mesmas regras. O
//    áudio e a nota do posto de um abastecimento são lidos pela IA a
//    pedido do celular (no Wi-Fi sozinho; nos dados móveis pelas setas).
// =====================================================================
const Sync = (() => {
  let rodando = false;

  // Campos que a pessoa edita no aparelho
  const CAMPOS_EDITAVEIS = ['dataHora', 'descricao', 'itens', 'valorTotal', 'categoria', 'meioPagamento', 'banco',
    'titular', 'estabelecimento', 'origem', 'status', 'lat', 'lng', 'precisao', 'alteradoEm', 'qrNota', 'fotosNota'];
  // Campos que só o servidor preenche
  const CAMPOS_SERVIDOR = ['endereco', 'participante', 'transcricao', 'observacaoIA', 'qtdFotos', 'temAudio', 'fonteDados', 'chaveNota'];
  // Veículos (V4)
  const CAMPOS_VEICULO = ['montadora', 'modelo', 'ano', 'placa', 'alteradoEm'];
  const CAMPOS_REGISTRO = ['veiculoId', 'tipo', 'data', 'valor', 'formaPagamento', 'descricao', 'hodometro', 'combustivel',
    'tanqueCheio', 'precoLitro', 'litros', 'seguradora', 'apolice', 'validade', 'local', 'lat', 'lng', 'status', 'fonte',
    'qrNota', 'observacao', 'alteradoEm'];
  const CAMPOS_REGISTRO_SERVIDOR = ['qtdFotos', 'participante'];

  function conexao() {
    if (!navigator.onLine) return 'offline';
    const c = navigator.connection;
    if (c && c.type) {
      if (c.type === 'wifi' || c.type === 'ethernet') return 'wifi';
      if (c.type === 'cellular') return 'celular';
      if (c.type === 'none') return 'offline';
    }
    return 'desconhecida';
  }

  function avisar(estado, extra) {
    window.dispatchEvent(new CustomEvent('sync-estado', { detail: Object.assign({ estado }, extra || {}) }));
  }

  function blobParaBase64(blob) {
    return new Promise((ok, falha) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result); ok(s.slice(s.indexOf(',') + 1)); };
      r.onerror = () => falha(r.error);
      r.readAsDataURL(blob);
    });
  }

  /** Quantos lançamentos (e veículos e gastos dos veículos) ainda têm algo para enviar (dados, exclusão ou arquivos). */
  async function pendentes() {
    const lancs = await Banco.todos('lancamentos');
    const arqs = await Banco.todos('arquivos');
    const veics = await Banco.todos('veiculos');
    const regs = await Banco.todos('registros');
    const ids = new Set();
    lancs.forEach(l => { if (l.sync === 'pendente' || l.excluirPendente) ids.add(l.id); });
    veics.forEach(v => { if (v.sync === 'pendente' || v.excluirPendente) ids.add(v.id); });
    // os gastos de um veículo que está sendo excluído saem junto com ele (não contam separado)
    const saindo = new Set(veics.filter(v => v.excluirPendente).map(v => v.id));
    const ignorar = new Set();
    regs.forEach(r => {
      if (saindo.has(r.veiculoId)) { ignorar.add(r.id); return; }
      // abastecimento com áudio ou nota esperando a leitura: é o celular que gravou que manda ler
      if (r.sync === 'pendente' || r.excluirPendente || (r.status === 'aguardando_ia' && (r.lerVoz || r.lerNota))) ids.add(r.id);
    });
    arqs.forEach(a => {
      if (ignorar.has(a.lancamentoId)) return;
      if ((!a.enviado && !a.remover && a.blob) || (a.remover && a.enviado)) ids.add(a.lancamentoId);
    });
    return ids.size;
  }

  function paraServidor(l) {
    const o = { id: l.id, criadoEm: l.criadoEm, versaoBase: l.versaoBase || 0 };
    CAMPOS_EDITAVEIS.forEach(k => { o[k] = l[k] === undefined ? null : l[k]; });
    return o;
  }

  function copiarDoServidor(local, s) {
    CAMPOS_EDITAVEIS.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    CAMPOS_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    local.versaoBase = s.versao || local.versaoBase || 0;
  }

  function copiarCamposServidor(local, s) {
    CAMPOS_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
  }

  async function apagarLocal(id, store = 'lancamentos') {
    const arqs = await Banco.porIndice('arquivos', 'lancamentoId', id);
    for (const a of arqs) await Banco.apagar('arquivos', a.id);
    await Banco.apagar(store, id);
  }

  /** Tira do celular o veículo, os gastos dele e as fotos e áudios desses gastos. */
  async function apagarVeiculoLocal(id) {
    for (const r of await Banco.porIndice('registros', 'veiculoId', id)) await apagarLocal(r.id, 'registros');
    await Banco.apagar('veiculos', id);
  }

  /**
   * Acerta a lista de fotos/áudio do lançamento com a do servidor: o que só existe
   * no servidor (enviado por outro celular da conta) aparece como "guardado no Drive";
   * o que foi removido em outro celular sai daqui.
   */
  async function sincronizarArquivos(lancamentoId, lista) {
    if (!Array.isArray(lista)) return; // servidor antigo: não mexe
    const locais = await Banco.porIndice('arquivos', 'lancamentoId', lancamentoId);
    const noServidor = new Set(lista.map(a => a.id));
    for (const a of locais) {
      if (a.enviado && !a.remover && !noServidor.has(a.id)) await Banco.apagar('arquivos', a.id);
    }
    const aqui = new Set(locais.map(a => a.id));
    for (const a of lista) {
      if (!a || !a.id || aqui.has(a.id)) continue;
      await Banco.gravar('arquivos', {
        id: a.id, lancamentoId, tipo: a.tipo === 'audio' ? 'audio' : 'foto', mime: a.mime || '', blob: null,
        criadoEm: a.criadoEm || Date.now(), enviado: true, enviadoEm: a.criadoEm || Date.now(), doServidor: true
      });
    }
  }

  /** Resposta do servidor depois de enviar um lançamento. */
  async function aplicarRespostaEnvio(enviado, s, aviso) {
    const local = await Banco.obter('lancamentos', enviado.id);
    if (!local) return;
    if (s.excluido) { await apagarLocal(local.id); return; }
    const editadoDuranteEnvio = local.alteradoEm !== enviado.alteradoEm;
    if (aviso === 'conflito') {
      // o servidor tinha uma alteração mais recente (administrador, IA ou outro celular)
      if (!editadoDuranteEnvio) { copiarDoServidor(local, s); local.sync = 'ok'; }
      else local.versaoBase = s.versao;
    } else {
      local.versaoBase = s.versao;
      copiarCamposServidor(local, s);
      if (!editadoDuranteEnvio) local.sync = 'ok';
    }
    await Banco.gravar('lancamentos', local);
  }

  /** Lançamento vindo do servidor (histórico, outro celular, IA, administrador, endereço). */
  async function aplicarDoServidor(s) {
    const local = await Banco.obter('lancamentos', s.id);
    if (!local) {
      if (s.excluido) return null;
      const novo = { id: s.id, criadoEm: s.criadoEm || s.dataHora || Date.now(), sync: 'ok', tentouEnviar: true };
      copiarDoServidor(novo, s);
      await Banco.gravar('lancamentos', novo);
      await sincronizarArquivos(s.id, s.arquivos);
      return 'novo';
    }
    if (s.excluido) { await apagarLocal(s.id); return 'excluido'; }
    const antes = local.status;
    if (local.excluirPendente) {
      copiarCamposServidor(local, s);
    } else if (local.sync === 'pendente') {
      const servidorMaisNovo = (s.versao || 0) > (local.versaoBase || 0) && (s.alteradoEm || 0) > (local.alteradoEm || 0);
      if (servidorMaisNovo) { copiarDoServidor(local, s); local.sync = 'ok'; }
      else copiarCamposServidor(local, s);
    } else if ((s.versao || 0) >= (local.versaoBase || 0)) {
      copiarDoServidor(local, s);
    } else {
      copiarCamposServidor(local, s);
    }
    await Banco.gravar('lancamentos', local);
    await sincronizarArquivos(s.id, s.arquivos);
    return antes === 'aguardando_ia' && local.status === 'revisar' ? 'interpretado' : 'ok';
  }

  // ------------------------------------------------------------------
  //  Veículos e gastos dos veículos (V4)
  // ------------------------------------------------------------------
  function veiculoParaServidor(v) {
    const o = { id: v.id, criadoEm: v.criadoEm, versaoBase: v.versaoBase || 0 };
    CAMPOS_VEICULO.forEach(k => { o[k] = v[k] === undefined ? null : v[k]; });
    return o;
  }
  function copiarVeiculo(local, s) {
    CAMPOS_VEICULO.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    local.versaoBase = s.versao || local.versaoBase || 0;
  }
  async function aplicarRespostaVeiculo(enviado, s, aviso) {
    const local = await Banco.obter('veiculos', enviado.id);
    if (!local) return;
    if (aviso === 'excluido' || s.excluido) { await apagarVeiculoLocal(local.id); return; } // excluído em outro celular
    const editadoDuranteEnvio = local.alteradoEm !== enviado.alteradoEm;
    if (aviso === 'conflito') {
      if (!editadoDuranteEnvio) { copiarVeiculo(local, s); local.sync = 'ok'; }
      else local.versaoBase = s.versao;
    } else {
      local.versaoBase = s.versao;
      if (!editadoDuranteEnvio) local.sync = 'ok';
    }
    await Banco.gravar('veiculos', local);
  }
  async function aplicarVeiculoDoServidor(s) {
    const local = await Banco.obter('veiculos', s.id);
    if (!local) {
      if (s.excluido) return null;
      const novo = { id: s.id, criadoEm: s.criadoEm || Date.now(), sync: 'ok', tentouEnviar: true };
      copiarVeiculo(novo, s);
      await Banco.gravar('veiculos', novo);
      return 'novo';
    }
    if (s.excluido) { await apagarVeiculoLocal(s.id); return 'excluido'; }
    if (local.excluirPendente) return 'ok';
    if (local.sync === 'pendente') {
      const servidorMaisNovo = (s.versao || 0) > (local.versaoBase || 0) && (s.alteradoEm || 0) > (local.alteradoEm || 0);
      if (!servidorMaisNovo) return 'ok';
      copiarVeiculo(local, s);
      local.sync = 'ok';
    } else if ((s.versao || 0) >= (local.versaoBase || 0)) {
      copiarVeiculo(local, s);
    }
    await Banco.gravar('veiculos', local);
    return 'ok';
  }

  function registroParaServidor(r) {
    const o = { id: r.id, criadoEm: r.criadoEm, versaoBase: r.versaoBase || 0 };
    CAMPOS_REGISTRO.forEach(k => { o[k] = r[k] === undefined ? null : r[k]; });
    return o;
  }
  function copiarCamposServidorRegistro(local, s) {
    CAMPOS_REGISTRO_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
  }
  function copiarRegistro(local, s) {
    CAMPOS_REGISTRO.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    copiarCamposServidorRegistro(local, s);
    local.versaoBase = s.versao || local.versaoBase || 0;
    if (local.status !== 'aguardando_ia') { delete local.lerVoz; delete local.lerNota; } // já foi lido (talvez em outro celular)
  }
  async function aplicarRespostaRegistro(enviado, s, aviso) {
    const local = await Banco.obter('registros', enviado.id);
    if (!local) return;
    if (aviso === 'excluido' || s.excluido) { await apagarLocal(local.id, 'registros'); return; } // o veículo foi excluído
    const editadoDuranteEnvio = local.alteradoEm !== enviado.alteradoEm;
    if (aviso === 'conflito') {
      if (!editadoDuranteEnvio) { copiarRegistro(local, s); local.sync = 'ok'; }
      else local.versaoBase = s.versao;
    } else {
      local.versaoBase = s.versao;
      copiarCamposServidorRegistro(local, s);
      if (!editadoDuranteEnvio) local.sync = 'ok';
    }
    await Banco.gravar('registros', local);
  }
  async function aplicarRegistroDoServidor(s) {
    const local = await Banco.obter('registros', s.id);
    if (!local) {
      if (s.excluido) return null;
      const novo = { id: s.id, criadoEm: s.criadoEm || Date.now(), sync: 'ok', tentouEnviar: true };
      copiarRegistro(novo, s);
      await Banco.gravar('registros', novo);
      await sincronizarArquivos(s.id, s.arquivos);
      return 'novo';
    }
    if (s.excluido) { await apagarLocal(s.id, 'registros'); return 'excluido'; }
    const antes = local.status;
    if (local.excluirPendente) {
      copiarCamposServidorRegistro(local, s);
    } else if (local.sync === 'pendente') {
      const servidorMaisNovo = (s.versao || 0) > (local.versaoBase || 0) && (s.alteradoEm || 0) > (local.alteradoEm || 0);
      if (servidorMaisNovo) { copiarRegistro(local, s); local.sync = 'ok'; }
      else copiarCamposServidorRegistro(local, s);
    } else if ((s.versao || 0) >= (local.versaoBase || 0)) {
      copiarRegistro(local, s);
    } else {
      copiarCamposServidorRegistro(local, s);
    }
    await Banco.gravar('registros', local);
    await sincronizarArquivos(s.id, s.arquivos);
    return antes === 'aguardando_ia' && local.status === 'revisar' ? 'interpretado' : 'ok';
  }

  // ---- leitura do abastecimento pela IA (áudio) ou pela nota do posto (SEFAZ ou IA) ----
  async function base64DoArquivo(a) {
    if (a.blob) return blobParaBase64(a.blob);
    if (!a.enviado) return '';
    const r = await Api.chamar('baixarArquivo', { arquivoId: a.id }, { tempoMs: 90000 }); // a cópia daqui já foi apagada
    return r.base64 || '';
  }

  /**
   * Nota do posto: com o QR Code, tenta primeiro só pelo site da SEFAZ (sem mandar a foto, que gasta mais dados);
   * se não der, manda as fotos para a IA. obterFotos() devolve [{ mime, base64 }].
   */
  async function lerNotaPosto(qr, obterFotos) {
    if (qr) {
      try {
        return await Api.chamar('lerVeiculo', { modo: 'nota', qr }, { tempoMs: 120000 });
      } catch (e) {
        if (!(e instanceof Api.ErroServidor && e.codigo === 'dados_invalidos')) throw e; // "mande a foto": a SEFAZ não trouxe a nota
      }
    }
    const fotos = await obterFotos();
    if (!fotos.length) throw new Api.ErroServidor('dados_invalidos', 'A foto da nota não está neste celular.');
    return Api.chamar('lerVeiculo', { modo: 'nota', qr: qr || '', fotos }, { tempoMs: 150000 });
  }

  /** Texto com os avisos da leitura (outros itens da nota, desconto, dúvidas da IA). */
  function avisosDaLeitura(resp) {
    const partes = [];
    if (resp.aviso) partes.push(resp.aviso);
    if (resp.observacao) partes.push(resp.observacao);
    if (resp.outrosItens && resp.outrosItens.length) partes.push('Outros itens na nota (fora do abastecimento): ' + resp.outrosItens.join('; ') + '.');
    return partes.join(' ');
  }

  /**
   * Passa para o gasto o que a leitura trouxe, só nos campos vazios ou que o app preencheu sozinho
   * ("automaticos": data de hoje, último preço do litro, local do GPS). O que a pessoa digitou fica.
   */
  function mesclarLeitura(reg, resp) {
    const c = (resp && resp.campos) || {};
    const auto = new Set(reg.automaticos || []);
    const livre = (k) => reg[k] == null || reg[k] === '' || auto.has(k);
    const usar = (k, v) => { if (v != null && v !== '' && livre(k)) { reg[k] = v; auto.delete(k); } };
    usar('combustivel', c.combustivel);
    usar('hodometro', c.hodometro);
    usar('precoLitro', c.precoLitro);
    usar('valor', c.valorTotal);
    usar('formaPagamento', c.formaPagamento);
    usar('data', c.data);
    if (c.local && livre('local')) { reg.local = c.local; auto.delete('local'); reg.localPendente = false; }
    if (c.tanqueCheio === true && !reg.tanqueCheio && auto.has('tanqueCheio')) { reg.tanqueCheio = true; auto.delete('tanqueCheio'); }
    if (reg.valor != null && reg.precoLitro > 0) reg.litros = Math.round(reg.valor / reg.precoLitro * 1000) / 1000;
    else if (c.litros != null && reg.litros == null) reg.litros = c.litros;
    reg.automaticos = Array.from(auto);
    return reg;
  }

  /**
   * Lê o áudio e/ou a nota de um abastecimento salvo e grava o resultado para a pessoa revisar.
   * Devolve 'lido', 'nada', ou { parar: 'limite' | 'config', mensagem }.
   */
  async function lerGastoVeiculo(id) {
    const reg = await Banco.obter('registros', id);
    if (!reg || reg.status !== 'aguardando_ia' || reg.excluirPendente) return 'nada';
    const arqs = (await Banco.porIndice('arquivos', 'lancamentoId', id)).filter(a => !a.remover);
    const audio = arqs.filter(a => a.tipo === 'audio').sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0))[0];
    const fotos = arqs.filter(a => a.tipo === 'foto').sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    // só o celular que gravou o áudio ou tirou a foto manda ler (assim a IA gratuita não lê duas vezes);
    // nos outros celulares da conta a pessoa pode pedir "Ler agora" abrindo o abastecimento
    const querVoz = !!reg.lerVoz && !!audio;
    const querNota = !!reg.lerNota && reg.tipo === 'abastecimento' && (fotos.length > 0 || !!reg.qrNota);
    if (!querVoz && !querNota) return 'nada'; // o áudio ou a foto ainda não estão aqui: espera
    const respostas = [];
    const falhas = [];
    for (const modo of [querVoz ? 'voz' : '', querNota ? 'nota' : ''].filter(Boolean)) {
      try {
        respostas.push(modo === 'voz'
          ? Object.assign({ modo }, await Api.chamar('lerVeiculo', { modo: 'audio', mime: audio.mime || 'audio/webm', base64: await base64DoArquivo(audio) }, { tempoMs: 150000 }))
          : Object.assign({ modo }, await lerNotaPosto(reg.qrNota, async () => {
            const lista = [];
            for (const f of fotos) { const b = await base64DoArquivo(f); if (b) lista.push({ mime: f.mime || 'image/jpeg', base64: b }); }
            return lista;
          })));
      } catch (e) {
        if (e instanceof Api.ErroServidor && e.codigo === 'ia_limite') return { parar: 'limite' };
        if (e instanceof Api.ErroServidor && e.codigo === 'ia_config') return { parar: 'config', mensagem: e.message };
        if (e instanceof Api.ErroServidor && (e.codigo === 'ia_falhou' || e.codigo === 'dados_invalidos' || e.codigo === 'arquivo_inexistente')) {
          falhas.push(modo === 'voz' ? 'A IA não conseguiu entender o áudio.' : 'Não foi possível ler a nota.');
          continue;
        }
        throw e; // sem internet, IA ocupada... tenta de novo na próxima sincronização
      }
    }
    const atual = await Banco.obter('registros', id); // pode ter mudado enquanto a IA lia
    if (!atual || atual.excluirPendente) return 'nada';
    const avisos = [];
    respostas.forEach((r) => {
      mesclarLeitura(atual, r);
      if (r.modo === 'voz') { atual.transcricao = r.transcricao || ''; if (!atual.fonte) atual.fonte = 'voz'; }
      else { atual.fonte = r.fonte || atual.fonte; if (r.chave) atual.chaveNota = r.chave; }
      const a = avisosDaLeitura(r);
      if (a) avisos.push(a);
    });
    if (falhas.length) avisos.push(falhas.join(' ') + ' Preencha você mesmo.');
    atual.observacao = avisos.join(' ').slice(0, 500);
    atual.lerVoz = false;
    atual.lerNota = false;
    atual.status = 'revisar';
    atual.alteradoEm = Date.now();
    atual.sync = 'pendente';
    await Banco.gravar('registros', atual);
    return 'lido';
  }

  async function aplicarPerfilServidor(r) {
    const perfil = await Perfil.obter();
    if (perfil) {
      let mudou = false;
      if (r.nome && r.nome !== perfil.nome) { perfil.nome = r.nome; mudou = true; } // o organizador pode ter corrigido o nome
      // WhatsApp da conta e se ela é a do organizador (servidor V2)
      ['whatsapp', 'precisaWhatsapp', 'organizador'].forEach((k) => {
        if (r[k] !== undefined && r[k] !== perfil[k]) { perfil[k] = r[k]; mudou = true; }
      });
      // servidor da versão 1.1 (ainda não atualizado): não sabe ler notas por foto
      const antigo = r.precisaWhatsapp === undefined;
      if (!!perfil.servidorAntigo !== antigo) { perfil.servidorAntigo = antigo; mudou = true; }
      // servidor de antes da V4: ainda não guarda os veículos (eles esperam no celular até o servidor ser atualizado)
      const semVeiculos = r.veiculos === undefined;
      if (!!perfil.servidorSemVeiculos !== semVeiculos) { perfil.servidorSemVeiculos = semVeiculos; mudou = true; }
      // sincronizou: o código do grupo não está atrapalhando (a partir da V3, quem já entrou não depende dele)
      if (perfil.codigoInvalido) { perfil.codigoInvalido = false; mudou = true; }
      if (mudou) await Perfil.salvar(perfil);
    }
    if (r.listas && r.listas.categorias && r.listas.categorias.length) await Banco.gravarConfig('listas', r.listas);
  }

  /** Executa uma chamada de um item; erros só deste item não interrompem o resto. */
  async function item(fn, resumo, ref) {
    try {
      return await fn();
    } catch (e) {
      if (Api.eErroGeral(e)) throw e;
      resumo.erros.push(`${ref}: ${e.message}`);
      return null;
    }
  }

  /**
   * manual: a pessoa pediu (vale também nos dados móveis).
   * somenteBaixar: só busca as novidades do servidor, sem enviar nada (usado ao entrar na conta fora do Wi-Fi).
   */
  async function sincronizar({ manual = false, somenteBaixar = false } = {}) {
    if (rodando) return { ignorado: 'rodando' };
    const tipo = conexao();
    if (tipo === 'offline') { avisar('offline', { manual }); return { ignorado: 'offline' }; }
    if (!manual && !somenteBaixar && tipo !== 'wifi') { avisar('aguardando'); return { ignorado: 'sem_wifi' }; }
    const perfil = await Perfil.obter();
    if (!perfil || !perfil.token) return { ignorado: 'sem_sessao' };
    if (!Api.urlConfigurada()) {
      avisar('erro', { manual, mensagem: 'O app ainda não tem o endereço do servidor (config.js).' });
      return { ignorado: 'sem_url' };
    }

    rodando = true;
    const primeiraVez = !(await Banco.lerConfig('desde', 0)); // logo depois de entrar na conta: traz o histórico
    const visivel = manual || primeiraVez || (!somenteBaixar && (await pendentes()) > 0);
    avisar('sincronizando', { manual, visivel });
    const resumo = { enviados: 0, arquivos: 0, interpretados: 0, notas: 0, veiculosLidos: 0, novos: 0, limite: false, iaIndisponivel: '', erros: [] };
    try {
      if (!somenteBaixar) {
        // 1) exclusões feitas no aparelho
        for (const l of (await Banco.todos('lancamentos')).filter(x => x.excluirPendente)) {
          const r = await item(() => Api.chamar('excluir', { id: l.id }), resumo, 'exclusão');
          if (r) { await apagarLocal(l.id); resumo.enviados++; }
        }

        // 2) lançamentos novos ou alterados
        const paraEnviar = (await Banco.todos('lancamentos'))
          .filter(x => x.sync === 'pendente' && !x.excluirPendente)
          .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
        for (const l of paraEnviar) {
          avisar('sincronizando', { manual, visivel, detalhe: 'Enviando lançamentos…' });
          const atual = await Banco.obter('lancamentos', l.id);
          if (!atual || atual.excluirPendente) continue;
          if (!atual.tentouEnviar) { atual.tentouEnviar = true; await Banco.gravar('lancamentos', atual); }
          const enviado = Object.assign({}, atual);
          const r = await item(() => Api.chamar('salvar', { lancamento: paraServidor(enviado) }), resumo, 'lançamento');
          if (!r) continue;
          await aplicarRespostaEnvio(enviado, r.lancamento, r.aviso);
          resumo.enviados++;
        }

        // (depois de bater no limite gratuito da IA, só tenta de novo após 30 min ou pelo botão)
        const limiteEm = await Banco.lerConfig('iaLimite', null);
        const pularIA = !manual && limiteEm && (Date.now() - limiteEm < 30 * 60 * 1000);

        // V1) veículos excluídos no aparelho (o servidor exclui os gastos deles junto)
        for (const v of (await Banco.todos('veiculos')).filter(x => x.excluirPendente)) {
          const r = await item(() => Api.chamar('excluirVeiculo', { id: v.id }), resumo, 'exclusão do veículo');
          if (r) { await apagarVeiculoLocal(v.id); resumo.enviados++; }
        }

        // V2) veículos novos ou alterados
        const veiculosParaEnviar = (await Banco.todos('veiculos'))
          .filter(x => x.sync === 'pendente' && !x.excluirPendente)
          .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
        for (const v of veiculosParaEnviar) {
          avisar('sincronizando', { manual, visivel, detalhe: 'Enviando veículos…' });
          const atual = await Banco.obter('veiculos', v.id);
          if (!atual || atual.excluirPendente) continue;
          if (!atual.tentouEnviar) { atual.tentouEnviar = true; await Banco.gravar('veiculos', atual); }
          const enviado = Object.assign({}, atual);
          const r = await item(() => Api.chamar('salvarVeiculo', { veiculo: veiculoParaServidor(enviado) }), resumo, 'veículo');
          if (!r) continue;
          await aplicarRespostaVeiculo(enviado, r.veiculo, r.aviso);
          resumo.enviados++;
        }

        // V3) gastos dos veículos excluídos no aparelho
        for (const g of (await Banco.todos('registros')).filter(x => x.excluirPendente)) {
          const r = await item(() => Api.chamar('excluirRegistro', { id: g.id }), resumo, 'exclusão do gasto do veículo');
          if (r) { await apagarLocal(g.id, 'registros'); resumo.enviados++; }
        }

        // V4) abastecimento com áudio ou nota do posto esperando a leitura (só os campos vazios são preenchidos)
        let iaParada = !!pularIA;
        for (const g of (await Banco.todos('registros')).filter(x => x.status === 'aguardando_ia' && (x.lerVoz || x.lerNota) && !x.excluirPendente)) {
          if (iaParada) break;
          const v = await Banco.obter('veiculos', g.veiculoId);
          if (!v || v.excluirPendente) continue;
          avisar('sincronizando', { manual, visivel, detalhe: 'Lendo o abastecimento…' });
          const res = await item(() => lerGastoVeiculo(g.id), resumo, 'leitura do abastecimento');
          if (!res) continue;
          if (res.parar === 'limite') { resumo.limite = true; iaParada = true; }
          else if (res.parar === 'config') { resumo.iaIndisponivel = res.mensagem || 'IA indisponível'; iaParada = true; }
          else if (res === 'lido') resumo.veiculosLidos++;
        }

        // V5) local que ficou só com as coordenadas do GPS (lançado sem internet): busca o endereço
        for (const g of (await Banco.todos('registros')).filter(x => x.localPendente && !x.excluirPendente && x.lat != null && x.lng != null)) {
          if ((g.tentativasEndereco || 0) >= 3) continue;
          let endereco = '';
          try {
            endereco = (await Api.chamar('endereco', { lat: g.lat, lng: g.lng }, { tempoMs: 20000 })).endereco || '';
          } catch (e) {
            if (Api.eErroGeral(e)) throw e;
          }
          const atual = await Banco.obter('registros', g.id);
          if (!atual || !atual.localPendente) continue;
          atual.tentativasEndereco = (atual.tentativasEndereco || 0) + 1;
          if (endereco) {
            // só troca se ainda estiver o texto das coordenadas (a pessoa pode ter escrito outro local)
            if (atual.local === atual.localCoordenadas) {
              atual.local = endereco;
              atual.alteradoEm = Date.now();
              atual.sync = 'pendente';
            }
            atual.localPendente = false;
          }
          await Banco.gravar('registros', atual);
        }

        // V6) gastos dos veículos novos ou alterados (depois que o veículo já está no servidor)
        const gastosParaEnviar = (await Banco.todos('registros'))
          .filter(x => x.sync === 'pendente' && !x.excluirPendente)
          .sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
        for (const g of gastosParaEnviar) {
          const v = await Banco.obter('veiculos', g.veiculoId);
          if (!v || v.excluirPendente || !v.versaoBase) continue; // o veículo ainda não chegou ao servidor
          avisar('sincronizando', { manual, visivel, detalhe: 'Enviando gastos dos veículos…' });
          const atual = await Banco.obter('registros', g.id);
          if (!atual || atual.excluirPendente) continue;
          if (!atual.tentouEnviar) { atual.tentouEnviar = true; await Banco.gravar('registros', atual); }
          const enviado = Object.assign({}, atual);
          const r = await item(() => Api.chamar('salvarRegistro', { registro: registroParaServidor(enviado) }), resumo, 'gasto do veículo');
          if (!r) continue;
          await aplicarRespostaRegistro(enviado, r.registro, r.aviso);
          resumo.enviados++;
        }

        // 3) fotos e áudios
        const arquivos = (await Banco.todos('arquivos'))
          .filter(a => !a.enviado && !a.remover && a.blob)
          .sort((a, b) => (a.tipo === 'audio' ? 0 : 1) - (b.tipo === 'audio' ? 0 : 1) || (a.criadoEm || 0) - (b.criadoEm || 0));
        for (const a of arquivos) {
          // o arquivo é de um lançamento ou de um gasto de veículo (V4)
          const l = (await Banco.obter('lancamentos', a.lancamentoId)) || (await Banco.obter('registros', a.lancamentoId));
          if (!l || l.excluirPendente || (l.sync === 'pendente' && !l.versaoBase)) continue; // o lançamento ainda não chegou ao servidor
          avisar('sincronizando', { manual, visivel, detalhe: a.tipo === 'audio' ? 'Enviando áudio…' : 'Enviando fotos…' });
          const base64 = await blobParaBase64(a.blob);
          const r = await item(() => Api.chamar('arquivo', {
            arquivo: { id: a.id, lancamentoId: a.lancamentoId, tipo: a.tipo, mime: a.mime, base64 }
          }, { tempoMs: 180000 }), resumo, a.tipo);
          if (!r) continue;
          const atual = await Banco.obter('arquivos', a.id);
          if (atual) {
            atual.enviado = true;
            atual.driveId = r.driveId;
            atual.enviadoEm = Date.now();
            // "Limpar dados" foi usado antes de o arquivo subir: agora que está no servidor, sai do celular
            if (atual.limparAoEnviar) { atual.blob = null; atual.limparAoEnviar = false; atual.limpoEm = Date.now(); }
            await Banco.gravar('arquivos', atual);
          }
          resumo.arquivos++;
        }

        // 4) fotos removidas pela pessoa
        for (const a of (await Banco.todos('arquivos')).filter(x => x.remover)) {
          if (a.enviado) {
            const r = await item(() => Api.chamar('excluirArquivo', { arquivoId: a.id }), resumo, 'remoção de foto');
            if (!r) continue;
          }
          await Banco.apagar('arquivos', a.id);
        }

        // 5) interpretar áudios e ler notas que já estão no servidor
        //    (depois de bater no limite gratuito, só tenta de novo após 30 min ou pelo botão;
        //     enquanto isso a rotina do servidor continua tentando sozinha)
        const aguardando = (pularIA || iaParada) ? [] : (await Banco.todos('lancamentos'))
          .filter(x => x.status === 'aguardando_ia' && x.sync === 'ok' && !x.excluirPendente);
        for (const l of aguardando) {
          const arqs = await Banco.porIndice('arquivos', 'lancamentoId', l.id);
          const nota = l.origem === 'foto';
          const audio = arqs.find(a => a.tipo === 'audio');
          if (audio && !audio.enviado) continue;
          if (nota && arqs.some(a => a.tipo === 'foto' && !a.remover && !a.enviado)) continue; // espera todas as fotos da nota
          avisar('sincronizando', { manual, visivel, detalhe: nota ? 'Lendo a nota…' : 'Interpretando áudio…' });
          const r = await item(() => Api.chamar('interpretar', { id: l.id }, { tempoMs: 150000 }), resumo, nota ? 'leitura da nota' : 'interpretação');
          if (!r) continue;
          if (r.lancamento) {
            const res = await aplicarDoServidor(r.lancamento);
            if (res === 'interpretado') { resumo.interpretados++; if (nota) resumo.notas++; }
          }
          if (r.aviso === 'limite') { resumo.limite = true; break; }
          if (r.aviso === 'config') { resumo.iaIndisponivel = r.mensagem || 'IA indisponível'; break; }
        }
      }

      // 6) novidades do servidor (histórico da conta, outros celulares, IA, administrador, endereços, listas)
      const desde = (await Banco.lerConfig('desde', 0)) || 0;
      avisar('sincronizando', { manual, visivel, detalhe: desde ? 'Buscando novidades…' : 'Buscando seus lançamentos…' });
      // o endereço do app vai junto: o painel do organizador monta o link de convite com ele
      const r = await Api.chamar('atualizacoes', { desde, urlApp: location.origin + location.pathname }, { tempoMs: 60000 });
      await aplicarPerfilServidor(r);
      for (const s of r.lancamentos || []) {
        const res = await aplicarDoServidor(s);
        if (res === 'interpretado') { resumo.interpretados++; if (s.origem === 'foto') resumo.notas++; }
        if (res === 'novo') resumo.novos++;
      }
      // veículos e gastos dos veículos (V4): primeiro os veículos, depois os gastos
      for (const s of r.veiculos || []) await aplicarVeiculoDoServidor(s);
      for (const s of r.registros || []) {
        const res = await aplicarRegistroDoServidor(s);
        if (res === 'interpretado') resumo.veiculosLidos++;
      }
      await Banco.gravarConfig('desde', r.agora);
      await Banco.gravarConfig('ultimaSync', Date.now());
      await Banco.gravarConfig('ultimoErro', null);
      if (resumo.limite) await Banco.gravarConfig('iaLimite', Date.now());
      else if (resumo.interpretados > 0 || resumo.veiculosLidos > 0) await Banco.gravarConfig('iaLimite', null);
      avisar('concluido', { manual, visivel, resumo });
      return resumo;
    } catch (e) {
      const p = await Perfil.obter();
      if (p && e instanceof Api.ErroServidor && e.codigo === 'codigo_invalido') {
        p.codigoInvalido = true;
        await Perfil.salvar(p);
      }
      if (p && p.token && e instanceof Api.ErroServidor && e.codigo === 'sessao_invalida') {
        // a sessão acabou (o organizador desconectou o celular, ou a pessoa saiu da conta em outro lugar):
        // os dados ficam no celular e são enviados depois que a pessoa entrar de novo
        p.token = null;
        p.sessaoInvalida = true;
        p.mensagemSessao = e.message;
        await Perfil.salvar(p);
      }
      await Banco.gravarConfig('ultimoErro', { quando: Date.now(), mensagem: e.message, codigo: e.codigo || '' });
      avisar(e instanceof Api.ErroRede ? 'falhou' : 'erro', { manual, visivel, mensagem: e.message, codigo: e.codigo || '' });
      return { erro: e.message, codigo: e.codigo || '' };
    } finally {
      rodando = false;
    }
  }

  return {
    sincronizar, conexao, pendentes, apagarLocal, apagarVeiculoLocal, estaRodando: () => rodando,
    // usados pelo formulário do abastecimento ("Lançar por voz" e "Ler nota do posto" na hora)
    lerNotaPosto, blobParaBase64, avisosDaLeitura
  };
})();
