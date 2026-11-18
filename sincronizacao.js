// =====================================================================
//  SINCRONIZAÇÃO
//  - No Wi-Fi: automática enquanto o app está aberto.
//  - Nos dados móveis: só quando a pessoa toca nas setas (ou em
//    "Sincronizar agora").
//  - Cada lançamento e cada arquivo têm um identificador único: reenviar
//    nunca duplica nada no servidor.
//  - Os lançamentos são da conta: entrando em outro celular, o histórico
//    vem junto (fotos e áudios ficam no Drive; o celular mostra um aviso).
// =====================================================================
const Sync = (() => {
  let rodando = false;

  // Campos que a pessoa edita no aparelho
  const CAMPOS_EDITAVEIS = ['dataHora', 'descricao', 'itens', 'valorTotal', 'categoria', 'meioPagamento', 'banco',
    'titular', 'estabelecimento', 'origem', 'status', 'lat', 'lng', 'precisao', 'alteradoEm'];
  // Campos que só o servidor preenche
  const CAMPOS_SERVIDOR = ['endereco', 'participante', 'transcricao', 'observacaoIA', 'qtdFotos', 'temAudio'];

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

  /** Quantos lançamentos ainda têm algo para enviar (dados, exclusão ou arquivos). */
  async function pendentes() {
    const lancs = await Banco.todos('lancamentos');
    const arqs = await Banco.todos('arquivos');
    const ids = new Set();
    lancs.forEach(l => { if (l.sync === 'pendente' || l.excluirPendente) ids.add(l.id); });
    arqs.forEach(a => { if ((!a.enviado && !a.remover && a.blob) || (a.remover && a.enviado)) ids.add(a.lancamentoId); });
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

  async function apagarLocal(id) {
    const arqs = await Banco.porIndice('arquivos', 'lancamentoId', id);
    for (const a of arqs) await Banco.apagar('arquivos', a.id);
    await Banco.apagar('lancamentos', id);
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

  async function aplicarPerfilServidor(r) {
    const perfil = await Perfil.obter();
    if (perfil && r.nome && r.nome !== perfil.nome) {
      perfil.nome = r.nome; // o organizador pode ter corrigido o nome da conta
      await Perfil.salvar(perfil);
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
    const resumo = { enviados: 0, arquivos: 0, interpretados: 0, novos: 0, limite: false, iaIndisponivel: '', erros: [] };
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

        // 3) fotos e áudios
        const arquivos = (await Banco.todos('arquivos'))
          .filter(a => !a.enviado && !a.remover && a.blob)
          .sort((a, b) => (a.tipo === 'audio' ? 0 : 1) - (b.tipo === 'audio' ? 0 : 1) || (a.criadoEm || 0) - (b.criadoEm || 0));
        for (const a of arquivos) {
          const l = await Banco.obter('lancamentos', a.lancamentoId);
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

        // 5) interpretar áudios que já estão no servidor
        //    (depois de bater no limite gratuito, só tenta de novo após 30 min ou pelo botão;
        //     enquanto isso a rotina do servidor continua tentando sozinha)
        const limiteEm = await Banco.lerConfig('iaLimite', null);
        const pularIA = !manual && limiteEm && (Date.now() - limiteEm < 30 * 60 * 1000);
        const aguardando = pularIA ? [] : (await Banco.todos('lancamentos'))
          .filter(x => x.status === 'aguardando_ia' && x.sync === 'ok' && !x.excluirPendente);
        for (const l of aguardando) {
          const arqs = await Banco.porIndice('arquivos', 'lancamentoId', l.id);
          const audio = arqs.find(a => a.tipo === 'audio');
          if (audio && !audio.enviado) continue;
          avisar('sincronizando', { manual, visivel, detalhe: 'Interpretando áudio…' });
          const r = await item(() => Api.chamar('interpretar', { id: l.id }, { tempoMs: 150000 }), resumo, 'interpretação');
          if (!r) continue;
          if (r.lancamento) {
            const res = await aplicarDoServidor(r.lancamento);
            if (res === 'interpretado') resumo.interpretados++;
          }
          if (r.aviso === 'limite') { resumo.limite = true; break; }
          if (r.aviso === 'config') { resumo.iaIndisponivel = r.mensagem || 'IA indisponível'; break; }
        }
      }

      // 6) novidades do servidor (histórico da conta, outros celulares, IA, administrador, endereços, listas)
      const desde = (await Banco.lerConfig('desde', 0)) || 0;
      avisar('sincronizando', { manual, visivel, detalhe: desde ? 'Buscando novidades…' : 'Buscando seus lançamentos…' });
      const r = await Api.chamar('atualizacoes', { desde }, { tempoMs: 60000 });
      await aplicarPerfilServidor(r);
      for (const s of r.lancamentos || []) {
        const res = await aplicarDoServidor(s);
        if (res === 'interpretado') resumo.interpretados++;
        if (res === 'novo') resumo.novos++;
      }
      await Banco.gravarConfig('desde', r.agora);
      await Banco.gravarConfig('ultimaSync', Date.now());
      await Banco.gravarConfig('ultimoErro', null);
      if (resumo.limite) await Banco.gravarConfig('iaLimite', Date.now());
      else if (resumo.interpretados > 0) await Banco.gravarConfig('iaLimite', null);
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

  return { sincronizar, conexao, pendentes, apagarLocal, estaRodando: () => rodando };
})();
