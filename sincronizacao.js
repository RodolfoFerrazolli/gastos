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
//  - V5: veículos compartilhados. O celular diz ao servidor quais
//    veículos já tem; o servidor responde quais a conta enxerga (os dela
//    e os compartilhados com ela). O compartilhado que sumiu dessa lista
//    (a pessoa saiu, o dono tirou ou excluiu) sai do celular.
// =====================================================================
const Sync = (() => {
  let rodando = false;

  // Campos que a pessoa edita no aparelho
  const CAMPOS_EDITAVEIS = ['dataHora', 'descricao', 'itens', 'valorTotal', 'categoria', 'meioPagamento', 'banco',
    'titular', 'estabelecimento', 'origem', 'status', 'lat', 'lng', 'precisao', 'alteradoEm', 'qrNota', 'fotosNota',
    'enderecoMapa']; // V12: o endereço do lugar marcado no mapa
  // Campos que só o servidor preenche
  const CAMPOS_SERVIDOR = ['endereco', 'participante', 'transcricao', 'observacaoIA', 'qtdFotos', 'temAudio', 'fonteDados', 'chaveNota',
    'enderecoDe', 'alteradoPor', 'cnpj']; // V11: de onde veio o endereço; quem mexeu por último ("IA" = entrou direto: ✨)
  // Veículos (V4; a cor entrou na V5)
  const CAMPOS_VEICULO = ['montadora', 'modelo', 'ano', 'placa', 'cor', 'observacao', 'alteradoEm',
    'tanque', 'pneusInicio']; // V12: capacidade do tanque e a troca antiga dos pneus
  // do veículo, só o servidor sabe: se é da conta ("meu") ou compartilhado com ela, e quem é o dono (V5)
  const CAMPOS_VEICULO_SERVIDOR = ['meu', 'dono'];
  const CAMPOS_REGISTRO = ['veiculoId', 'tipo', 'data', 'valor', 'formaPagamento', 'descricao', 'hodometro', 'combustivel',
    'tanqueCheio', 'precoLitro', 'litros', 'seguradora', 'apolice', 'validade', 'local', 'lat', 'lng', 'status', 'fonte',
    'qrNota', 'observacao', 'alteradoEm',
    'desconto', 'itens', // V11: desconto do abastecimento (o "valor" é o valor pago) e itens da manutenção
    'pneus', 'cnpj']; // V12: pneus trocados na manutenção; CNPJ do posto ou da oficina
  const CAMPOS_REGISTRO_SERVIDOR = ['qtdFotos', 'participante', 'alteradoPor', 'meu'];

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

  function avisarSync(estado, extra) {
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
    // pedidos de correção ou melhoria esperando o envio (V6)
    ((await Banco.lerConfig('melhoriasPendentes', [])) || []).forEach(m => ids.add('melhoria:' + m.id));
    // alterações nos grupos esperando o envio (V9)
    const nGrupos = typeof Grupos !== 'undefined' ? await Grupos.pendentes() : 0;
    return ids.size + nGrupos;
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
    for (const a of await Banco.porIndice('arquivos', 'lancamentoId', id)) await Banco.apagar('arquivos', a.id); // V10: fotos do veículo
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
    if (!o.cor) delete o.cor; // veículo de antes da V5, ainda sem cor: o servidor guarda a que já tem
    return o;
  }
  function copiarVeiculo(local, s) {
    CAMPOS_VEICULO.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    CAMPOS_VEICULO_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
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
      CAMPOS_VEICULO_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
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
      await sincronizarArquivos(s.id, s.arquivos); // V10: fotos do veículo
      return s.meu === false ? 'compartilhado' : 'novo';
    }
    if (s.excluido) { await apagarVeiculoLocal(s.id); return 'excluido'; }
    if (local.excluirPendente) return 'ok';
    if (local.sync === 'pendente') {
      const servidorMaisNovo = (s.versao || 0) > (local.versaoBase || 0) && (s.alteradoEm || 0) > (local.alteradoEm || 0);
      CAMPOS_VEICULO_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
      if (servidorMaisNovo) {
        copiarVeiculo(local, s);
        local.sync = 'ok';
      }
    } else if ((s.versao || 0) >= (local.versaoBase || 0)) {
      copiarVeiculo(local, s);
    } else {
      CAMPOS_VEICULO_SERVIDOR.forEach(k => { if (s[k] !== undefined) local[k] = s[k]; });
    }
    await Banco.gravar('veiculos', local);
    await sincronizarArquivos(s.id, s.arquivos); // V10: fotos do veículo
    return 'ok';
  }

  /**
   * V5: o servidor diz quais veículos a conta enxerga. Um compartilhado que não está mais na lista
   * (a pessoa saiu, o dono tirou ou excluiu o veículo, ou ficou pendente) sai do celular com os gastos dele.
   * Os veículos da própria conta nunca saem por aqui (a exclusão deles chega como "excluido").
   */
  async function aplicarAcessiveis(acessiveis, resumo) {
    if (!Array.isArray(acessiveis)) return; // servidor de antes da V5
    const pode = new Set(acessiveis.map(String));
    for (const v of await Banco.todos('veiculos')) {
      if (v.meu !== false || !v.versaoBase || pode.has(v.id)) continue;
      await apagarVeiculoLocal(v.id);
      if (!v.excluirPendente) resumo.descompartilhados.push(`O ${v.modelo} (${v.placa}) não está mais compartilhado com você.`);
    }
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
    // V6: o que a IA preencheu antes também pode ser trocado por uma leitura nova (com mais áudios ou fotos)
    const ia = new Set(reg.lidosIA || []);
    const livre = (k) => reg[k] == null || reg[k] === '' || auto.has(k) || ia.has(k);
    const usar = (k, v) => { if (v != null && v !== '' && livre(k)) { reg[k] = v; auto.delete(k); ia.add(k); } };
    // V11: aqui dentro o "valor" é o total da bomba; no fim volta a ser o valor pago (total − desconto)
    if (reg.valor != null && Number(reg.desconto) > 0) reg.valor = Math.round((Number(reg.valor) + Number(reg.desconto)) * 100) / 100;
    if (c.desconto > 0 && (reg.desconto == null || reg.desconto === '' || !(Number(reg.desconto) > 0) || ia.has('desconto'))) { reg.desconto = c.desconto; ia.add('desconto'); }
    usar('combustivel', c.combustivel);
    usar('hodometro', c.hodometro);
    usar('precoLitro', c.precoLitro);
    usar('valor', c.valorTotal);
    usar('formaPagamento', c.formaPagamento);
    usar('data', c.data);
    usar('litros', c.litros);
    if (c.local && livre('local')) { reg.local = c.local; auto.delete('local'); reg.localPendente = false; }
    if (c.tanqueCheio === true && !reg.tanqueCheio && auto.has('tanqueCheio')) { reg.tanqueCheio = true; auto.delete('tanqueCheio'); }
    // valor do litro × litros = valor total: com dois informados, o terceiro é calculado (V5)
    const T = ['precoLitro', 'litros', 'valor'];
    const tem = (k) => Number(reg[k]) > 0;
    let base = T.filter(k => tem(k) && !auto.has(k));
    if (base.length < 2 && tem('precoLitro') && auto.has('precoLitro') && reg.calculado !== 'precoLitro') base = base.concat('precoLitro'); // o último preço pago
    if (base.length === 2) {
      const falta = T.find(k => !base.includes(k));
      reg[falta] = calcularTerceiro(falta, reg);
      reg.calculado = reg[falta] != null ? falta : '';
      auto.add(falta);
    } else if (base.length < 2 && reg.calculado && auto.has(reg.calculado)) {
      reg[reg.calculado] = null;
      reg.calculado = '';
    } else if (base.length === 3) {
      reg.calculado = '';
    }
    if (reg.valor != null && Number(reg.desconto) > 0) reg.valor = Math.round((Number(reg.valor) - Number(reg.desconto)) * 100) / 100;
    reg.automaticos = Array.from(auto);
    reg.lidosIA = Array.from(ia).filter(k => !auto.has(k));
    return reg;
  }

  /**
   * V11: o que falta num abastecimento lido pela IA (vazio = nada). Sem nada faltando e sem dúvida da leitura,
   * ele entra confirmado direto (com o selo "✨ IA"); senão vai para "Revisar", com o que falta marcado.
   */
  function faltaNoAbastecimento(reg) {
    const falta = [];
    if (!reg.combustivel) falta.push('combustivel');
    if (!(Number(reg.precoLitro) > 0)) falta.push('precoLitro');
    if (!(Number(reg.litros) > 0)) falta.push('litros');
    if (!(Number(reg.valor) > 0)) falta.push('valor');
    if (reg.hodometro == null || reg.hodometro === '') falta.push('hodometro');
    if (!reg.formaPagamento) falta.push('formaPagamento');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(reg.data || ''))) falta.push('data');
    return falta;
  }
  /** Os três valores não batem (com o total da bomba = valor pago + desconto)? */
  function valoresNaoBatem(reg) {
    const p = Number(reg.precoLitro), l = Number(reg.litros), t = Number(reg.valor) + (Number(reg.desconto) > 0 ? Number(reg.desconto) : 0);
    if (!(p > 0 && l > 0 && t > 0)) return false;
    return Math.abs(t - Math.round(p * l * 100) / 100) > 0.05 + 0.0005 * (l + p);
  }

  /**
   * Leitura do abastecimento (V6): todos os áudios e todas as fotos (nota, bomba e painel) numa leitura só.
   * audios e fotos: [{ mime, qr?, base64: async () => texto }]. Com o servidor ainda na V5, lê o último
   * áudio e a nota separados (como antes). Devolve { campos, fonte, transcricao, tiposFotos, falhas, ... }.
   */
  async function lerAbastecimento({ audios = [], fotos = [], qr = '', lerVoz = true, lerNota = true }) {
    const perfil = await Perfil.obter();
    const antigo = !!(perfil && perfil.versaoServidor && Number(perfil.versaoServidor) < 6);
    if (!antigo) {
      const A = [];
      for (const a of audios) { const b = await a.base64(); if (b) A.push({ mime: a.mime || 'audio/webm', base64: b }); }
      const F = [];
      for (const f of fotos) { const b = await f.base64(); if (b) F.push({ mime: f.mime || 'image/jpeg', base64: b, qr: !!f.qr }); }
      if (!A.length && !F.length && !qr) throw new Api.ErroServidor('dados_invalidos', 'Os áudios e as fotos não estão neste celular.');
      try {
        const r = await Api.chamar('lerVeiculo', { modo: 'tudo', audios: A, fotos: F, qr: qr || '' }, { tempoMs: 170000 });
        return Object.assign(r, { audiosLidos: A.length, falhas: [] });
      } catch (e) {
        if (!(e instanceof Api.ErroServidor && e.codigo === 'dados_invalidos' && /modo de leitura/i.test(e.message || ''))) throw e;
        // o servidor ainda não foi atualizado para a V6: lê como antes
      }
    }
    const respostas = {};
    const falhas = [];
    const falhou = (e, texto) => {
      if (e instanceof Api.ErroServidor && ['ia_falhou', 'dados_invalidos', 'arquivo_inexistente'].includes(e.codigo)) { falhas.push(texto); return; }
      throw e;
    };
    const ultimo = audios[audios.length - 1];
    if (lerVoz && ultimo) {
      try {
        respostas.voz = await Api.chamar('lerVeiculo', { modo: 'audio', mime: ultimo.mime || 'audio/webm', base64: await ultimo.base64() }, { tempoMs: 150000 });
      } catch (e) { falhou(e, 'A IA não conseguiu entender o áudio.'); }
    }
    if (lerNota && (fotos.length || qr)) {
      try {
        respostas.nota = await lerNotaPosto(qr, async () => {
          const lista = [];
          for (const f of fotos) { const b = await f.base64(); if (b) lista.push({ mime: f.mime || 'image/jpeg', base64: b }); }
          return lista;
        });
      } catch (e) { falhou(e, 'Não foi possível ler a nota.'); }
    }
    if (!respostas.voz && !respostas.nota) throw new Api.ErroServidor('ia_falhou', falhas.join(' ') || 'Nada para ler.');
    // a nota vale mais que o áudio; o hodômetro vem do áudio
    const n = (respostas.nota && respostas.nota.campos) || {};
    const v = (respostas.voz && respostas.voz.campos) || {};
    const campos = {};
    ['combustivel', 'precoLitro', 'litros', 'valorTotal', 'formaPagamento', 'data', 'local'].forEach((k) => {
      campos[k] = n[k] != null && n[k] !== '' ? n[k] : (v[k] != null && v[k] !== '' ? v[k] : null);
    });
    campos.hodometro = v.hodometro != null ? v.hodometro : null;
    campos.tanqueCheio = v.tanqueCheio != null ? v.tanqueCheio : null;
    return {
      ok: true, campos, falhas, audiosLidos: respostas.voz ? 1 : 0,
      fonte: [respostas.nota ? respostas.nota.fonte || 'ia' : '', respostas.voz ? 'voz' : ''].filter(Boolean).join('+'),
      transcricao: respostas.voz ? respostas.voz.transcricao || '' : '',
      tiposFotos: respostas.nota ? fotos.map(() => 'nota') : [],
      outrosItens: respostas.nota ? respostas.nota.outrosItens : [],
      aviso: [respostas.nota && respostas.nota.aviso, respostas.voz && respostas.voz.aviso].filter(Boolean).join(' '),
      observacao: [respostas.nota && respostas.nota.observacao, respostas.voz && respostas.voz.observacao].filter(Boolean).join(' '),
      chave: respostas.nota ? respostas.nota.chave || '' : ''
    };
  }

  /** O que a leitura leu, em palavras (ex.: "a nota (pelo site da SEFAZ), a foto da bomba e o áudio"). */
  function resumoDaLeitura(resp) {
    const f = String((resp && resp.fonte) || '').split('+');
    const tipos = (resp && resp.tiposFotos) || [];
    const conta = (t) => tipos.filter(x => x === t).length;
    const partes = [];
    const de = (n, um, varios) => (n > 1 ? varios.replace('#', n) : um);
    if (f.includes('sefaz')) partes.push('a nota (pelo site da SEFAZ, com o QR Code)');
    else if (conta('nota')) partes.push(de(conta('nota'), 'a foto da nota', 'as # fotos da nota'));
    if (conta('bomba')) partes.push(de(conta('bomba'), 'a foto da bomba', 'as # fotos da bomba'));
    if (conta('painel')) partes.push(de(conta('painel'), 'a foto do painel', 'as # fotos do painel'));
    if (f.includes('voz')) partes.push(de(resp.audiosLidos || 1, 'o áudio', 'os # áudios'));
    if (!partes.length && f.includes('ia')) partes.push('as fotos');
    let texto = partes.length > 1 ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1] : (partes[0] || '');
    if (conta('outra')) texto += (texto ? ' ' : '') + `(${de(conta('outra'), '1 foto não era', '# fotos não eram')} da nota, da bomba nem do painel)`;
    return texto;
  }

  /** O valor que falta no abastecimento: total = litro × litros; litros = total ÷ litro; litro = total ÷ litros. */
  function calcularTerceiro(falta, v) {
    const p = Number(v.precoLitro);
    const l = Number(v.litros);
    const t = Number(v.valor);
    if (falta === 'valor') return p > 0 && l > 0 ? Math.round(p * l * 100) / 100 : null;
    if (falta === 'litros') return p > 0 && t > 0 ? Math.round(t / p * 1000) / 1000 : null;
    if (falta === 'precoLitro') return l > 0 && t > 0 ? Math.round(t / l * 1000) / 1000 : null;
    return null;
  }

  /**
   * Lê os áudios e as fotos de um abastecimento salvo e grava o resultado para a pessoa revisar.
   * Devolve 'lido', 'nada', ou { parar: 'limite' | 'config', mensagem }.
   */
  async function lerGastoVeiculo(id) {
    const reg = await Banco.obter('registros', id);
    if (!reg || reg.status !== 'aguardando_ia' || reg.excluirPendente) return 'nada';
    const arqs = (await Banco.porIndice('arquivos', 'lancamentoId', id)).filter(a => !a.remover);
    const porData = (a, b) => (a.criadoEm || 0) - (b.criadoEm || 0);
    const audios = arqs.filter(a => a.tipo === 'audio').sort(porData);
    const fotos = arqs.filter(a => a.tipo === 'foto').sort(porData);
    // só o celular que gravou o áudio ou tirou a foto manda ler (assim a IA gratuita não lê duas vezes);
    // nos outros celulares da conta a pessoa pode pedir "Ler agora" abrindo o abastecimento
    const querVoz = !!reg.lerVoz && audios.length > 0;
    const querNota = !!reg.lerNota && reg.tipo === 'abastecimento' && (fotos.length > 0 || !!reg.qrNota);
    if (!querVoz && !querNota) return 'nada'; // o áudio ou a foto ainda não estão aqui: espera
    let resp;
    try {
      resp = await lerAbastecimento({
        audios: audios.map(a => ({ mime: a.mime || 'audio/webm', base64: () => base64DoArquivo(a) })),
        fotos: fotos.map(f => ({ mime: f.mime || 'image/jpeg', qr: !!f.qr, base64: () => base64DoArquivo(f) })),
        qr: reg.qrNota || '', lerVoz: querVoz, lerNota: querNota
      });
    } catch (e) {
      if (e instanceof Api.ErroServidor && e.codigo === 'ia_limite') return { parar: 'limite' };
      if (e instanceof Api.ErroServidor && e.codigo === 'ia_config') return { parar: 'config', mensagem: e.message };
      if (!(e instanceof Api.ErroServidor && ['ia_falhou', 'dados_invalidos', 'arquivo_inexistente'].includes(e.codigo))) throw e; // sem internet, IA ocupada... tenta de novo depois
      const oque = querVoz && querNota ? 'os áudios e as fotos' : querVoz ? (audios.length > 1 ? 'os áudios' : 'o áudio') : (fotos.length > 1 ? 'as fotos' : 'a foto');
      resp = { campos: {}, falhas: [`A IA não conseguiu ler ${oque}.`] };
    }
    const atual = await Banco.obter('registros', id); // pode ter mudado enquanto a IA lia
    if (!atual || atual.excluirPendente) return 'nada';
    mesclarLeitura(atual, resp);
    if (resp.transcricao) atual.transcricao = resp.transcricao;
    if (resp.fonte) atual.fonte = resp.fonte;
    if (resp.chave) atual.chaveNota = resp.chave;
    const avisos = [avisosDaLeitura(resp)];
    if (resp.falhas && resp.falhas.length) avisos.push(resp.falhas.join(' ') + ' Preencha você mesmo.');
    atual.observacao = avisos.filter(Boolean).join(' ').slice(0, 500);
    atual.resumoLeitura = resumoDaLeitura(resp);
    atual.lerVoz = false;
    atual.lerNota = false;
    // V11: revisar só quando falta algo ou a leitura ficou em dúvida
    const duvida = resp.duvida !== undefined ? !!resp.duvida || !!(resp.falhas && resp.falhas.length)
      : !!(resp.aviso || resp.observacao || (resp.falhas && resp.falhas.length)); // servidor antigo: qualquer aviso
    const revisar = duvida || valoresNaoBatem(atual) || (atual.tipo === 'abastecimento' && faltaNoAbastecimento(atual).length > 0);
    atual.status = revisar ? 'revisar' : 'confirmado';
    atual.autoIA = !revisar; // fica só neste celular: mostra o selo "✨ IA" até a pessoa abrir e salvar
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
      ['whatsapp', 'precisaWhatsapp', 'organizador', 'email', 'precisaEmail', 'versaoServidor'].forEach((k) => {
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
  async function sincronizar({ manual = false, somenteBaixar = false, silencioso = false } = {}) {
    if (rodando) return { ignorado: 'rodando' };
    // silencioso (V7, puxar a tela): sem "Sincronizado" nem avisos de erro; só as setas da tela inicial giram
    const avisar = (estado, extra) => avisarSync(estado, Object.assign({ silencioso }, extra || {}));
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
    const resumo = { enviados: 0, arquivos: 0, interpretados: 0, notas: 0, veiculosLidos: 0, novos: 0, limite: false, iaIndisponivel: '', erros: [],
      compartilhados: [], descompartilhados: [] };
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
          // o arquivo é de um lançamento, de um gasto de veículo (V4) ou do próprio veículo (V10)
          const l = (await Banco.obter('lancamentos', a.lancamentoId)) || (await Banco.obter('registros', a.lancamentoId)) ||
            (await Banco.obter('veiculos', a.lancamentoId));
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

      // M) pedidos de correção ou melhoria (V6): sobem com o áudio e a imagem da tela
      const perfilAgora = await Perfil.obter();
      const servidorAntesDaV6 = !!(perfilAgora && perfilAgora.versaoServidor && Number(perfilAgora.versaoServidor) < 6);
      if (!somenteBaixar && !servidorAntesDaV6 && ((await Banco.lerConfig('melhoriasPendentes', [])) || []).length) {
        // V12: o mesmo envio do segundo plano (com a mesma trava: nunca manda o mesmo pedido duas vezes ao mesmo tempo)
        avisar('sincronizando', { manual, visivel, detalhe: 'Enviando o pedido de melhoria…' });
        const r = await PedidosFundo.enviarTodos();
        resumo.melhorias = (resumo.melhorias || 0) + (r.enviados || 0);
        (r.erros || []).forEach(x => resumo.erros.push('pedido de melhoria: ' + (x.mensagem || x.codigo || 'recusado')));
        if (r.semRede && !r.enviados) resumo.erros.push('pedido de melhoria: sem conexão com o servidor');
      }

      // G) grupos (V9): manda o que mudou e traz os grupos de que a conta participa (servidor antigo: fica guardado aqui)
      if (typeof Grupos !== 'undefined') {
        if (!somenteBaixar && (await Grupos.pendentes()) > 0) avisar('sincronizando', { manual, visivel, detalhe: 'Enviando os grupos…' });
        const rg = await item(() => Grupos.sincronizar({ enviar: !somenteBaixar }), resumo, 'grupos');
        if (rg && rg.recusados) resumo.gruposRecusados = rg.recusados;
      }

      // L) lugares (V12): o que a pessoa corrigiu (nome, ponto, favorito) vai e volta para os outros celulares da conta
      if (typeof Lugares !== 'undefined') await item(() => Lugares.sincronizar({ enviar: !somenteBaixar }), resumo, 'lugares');

      // 6) novidades do servidor (histórico da conta, outros celulares, IA, administrador, endereços, listas)
      const desde = (await Banco.lerConfig('desde', 0)) || 0;
      avisar('sincronizando', { manual, visivel, detalhe: desde ? 'Buscando novidades…' : 'Buscando seus lançamentos…' });
      // o endereço do app vai junto: o painel do organizador monta o link de convite com ele;
      // V5: os veículos que o celular já tem (o que for novo para ele, ex.: acabou de ser compartilhado, vem com todos os gastos)
      const conhecidos = (await Banco.todos('veiculos')).filter(v => v.versaoBase > 0).map(v => v.id);
      // V10: "pedidos": os pedidos do 🐞 desta conta que o organizador resolveu ou descartou
      const r = await Api.chamar('atualizacoes', { desde, urlApp: location.origin + location.pathname, conhecidos, pedidos: true }, { tempoMs: 60000 });
      await aplicarPerfilServidor(r);
      if (Array.isArray(r.pedidos) && window.App && App.receberPedidosRespondidos) {
        try { await App.receberPedidosRespondidos(r.pedidos); } catch (e) { /* não atrapalha a sincronização */ }
      }
      for (const s of r.lancamentos || []) {
        const res = await aplicarDoServidor(s);
        if (res === 'interpretado') { resumo.interpretados++; if (s.origem === 'foto') resumo.notas++; }
        if (res === 'novo') resumo.novos++;
      }
      // veículos e gastos dos veículos (V4): primeiro os veículos, depois os gastos
      for (const s of r.veiculos || []) {
        const res = await aplicarVeiculoDoServidor(s);
        if (res === 'compartilhado') resumo.compartilhados.push(`👥 ${primeiroNome(s.dono) || 'Alguém'} compartilhou o ${s.modelo} com você.`);
      }
      await aplicarAcessiveis(r.acessiveis, resumo);
      const veiculosAqui = new Set((await Banco.todos('veiculos')).map(v => v.id));
      for (const s of r.registros || []) {
        if (!veiculosAqui.has(s.veiculoId)) continue; // gasto de um veículo que não está neste celular
        const res = await aplicarRegistroDoServidor(s);
        if (res === 'interpretado') resumo.veiculosLidos++;
      }
      // compartilhamentos (V5): com quem cada veículo da conta está compartilhado e os pendentes com ela
      if (r.compartilhamentos !== undefined) await Banco.gravarConfig('compartilhamentos', r.compartilhamentos || {});
      if (r.compartilhamentosPendentes !== undefined) await Banco.gravarConfig('compartilhamentosPendentes', r.compartilhamentosPendentes || []);
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
      if (p && p.token && e instanceof Api.ErroServidor && e.codigo === 'conta_excluida') {
        // V7: o organizador excluiu a conta. Os dados ficam no celular (se ele aceitar a pessoa de volta
        // com os dados, ela entra de novo e continua de onde parou).
        p.token = null;
        p.contaExcluida = true;
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

  function primeiroNome(n) { return String(n || '').trim().split(/\s+/)[0]; }

  return {
    sincronizar, conexao, pendentes, apagarLocal, apagarVeiculoLocal, estaRodando: () => rodando, calcularTerceiro,
    // usados pelo formulário do abastecimento ("Lançar por voz" e "Ler nota do posto" na hora)
    lerNotaPosto, blobParaBase64, avisosDaLeitura, lerAbastecimento, resumoDaLeitura,
    faltaNoAbastecimento, valoresNaoBatem // V11
  };
})();
