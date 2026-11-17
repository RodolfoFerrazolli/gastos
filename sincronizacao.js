// =====================================================================
//  SINCRONIZAÇÃO
//  - No Wi-Fi: automática enquanto o app está aberto.
//  - Nos dados móveis: só quando a pessoa toca em "Sincronizar".
//  - Cada lançamento e cada arquivo têm um identificador único: reenviar
//    nunca duplica nada no servidor.
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

  /** Resposta do servidor depois de enviar um lançamento. */
  async function aplicarRespostaEnvio(enviado, s, aviso) {
    const local = await Banco.obter('lancamentos', enviado.id);
    if (!local) return;
    if (s.excluido) { await apagarLocal(local.id); return; }
    const editadoDuranteEnvio = local.alteradoEm !== enviado.alteradoEm;
    if (aviso === 'conflito') {
      // o servidor tinha uma alteração mais recente (administrador ou IA)
      if (!editadoDuranteEnvio) { copiarDoServidor(local, s); local.sync = 'ok'; }
      else local.versaoBase = s.versao;
    } else {
      local.versaoBase = s.versao;
      copiarCamposServidor(local, s);
      if (!editadoDuranteEnvio) local.sync = 'ok';
    }
    await Banco.gravar('lancamentos', local);
  }

  /** Atualização vinda do servidor (IA, administrador, endereço). */
  async function aplicarDoServidor(s) {
    const local = await Banco.obter('lancamentos', s.id);
    if (!local) return null;
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
    return antes === 'aguardando_ia' && local.status === 'revisar' ? 'interpretado' : 'ok';
  }

  async function aplicarPerfilServidor(r) {
    const perfil = await Perfil.obter();
    if (r.nome && perfil && r.nome !== perfil.nomeServidor) {
      perfil.nomeServidor = r.nome;
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

  async function sincronizar({ manual = false } = {}) {
    if (rodando) return { ignorado: 'rodando' };
    const tipo = conexao();
    if (tipo === 'offline') { avisar('offline'); return { ignorado: 'offline' }; }
    if (!manual && tipo !== 'wifi') { avisar('aguardando'); return { ignorado: 'sem_wifi' }; }
    const perfil = await Perfil.obter();
    if (!perfil) return { ignorado: 'sem_perfil' };
    if (!Api.urlConfigurada()) { avisar('erro', { mensagem: 'O app ainda não tem o endereço do servidor (config.js).' }); return { ignorado: 'sem_url' }; }

    rodando = true;
    avisar('sincronizando');
    const resumo = { enviados: 0, arquivos: 0, interpretados: 0, limite: false, iaIndisponivel: '', erros: [] };
    try {
      // 0) registro do aparelho (primeira vez ou depois de mudar nome/código)
      if (!perfil.registrado || perfil.precisaRegistrar) {
        const r = await Api.chamar('registrar', { aparelho: await Aparelho.info() });
        const p = await Perfil.obter();
        p.registrado = true;
        p.precisaRegistrar = false;
        p.codigoInvalido = false;
        await Perfil.salvar(p);
        await aplicarPerfilServidor(r);
      }

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
        avisar('sincronizando', { detalhe: 'Enviando lançamentos…' });
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
        avisar('sincronizando', { detalhe: a.tipo === 'audio' ? 'Enviando áudio…' : 'Enviando fotos…' });
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
        avisar('sincronizando', { detalhe: 'Interpretando áudio…' });
        const r = await item(() => Api.chamar('interpretar', { id: l.id }, { tempoMs: 150000 }), resumo, 'interpretação');
        if (!r) continue;
        if (r.lancamento) {
          const res = await aplicarDoServidor(r.lancamento);
          if (res === 'interpretado') resumo.interpretados++;
        }
        if (r.aviso === 'limite') { resumo.limite = true; break; }
        if (r.aviso === 'config') { resumo.iaIndisponivel = r.mensagem || 'IA indisponível'; break; }
      }

      // 6) novidades do servidor (IA, administrador, endereços, listas)
      const desde = await Banco.lerConfig('desde', 0);
      const r = await Api.chamar('atualizacoes', { desde });
      await aplicarPerfilServidor(r);
      for (const s of r.lancamentos || []) {
        const res = await aplicarDoServidor(s);
        if (res === 'interpretado') resumo.interpretados++;
      }
      await Banco.gravarConfig('desde', r.agora);
      await Banco.gravarConfig('ultimaSync', Date.now());
      await Banco.gravarConfig('ultimoErro', null);
      if (resumo.limite) await Banco.gravarConfig('iaLimite', Date.now());
      else if (resumo.interpretados > 0) await Banco.gravarConfig('iaLimite', null);
      avisar('concluido', { resumo });
      return resumo;
    } catch (e) {
      if (e instanceof Api.ErroServidor && e.codigo === 'codigo_invalido') {
        const p = await Perfil.obter();
        p.codigoInvalido = true;
        await Perfil.salvar(p);
      }
      await Banco.gravarConfig('ultimoErro', { quando: Date.now(), mensagem: e.message, codigo: e.codigo || '' });
      avisar(e instanceof Api.ErroRede ? 'falhou' : 'erro', { mensagem: e.message, codigo: e.codigo || '' });
      return { erro: e.message, codigo: e.codigo || '' };
    } finally {
      rodando = false;
    }
  }

  return { sincronizar, conexao, pendentes, apagarLocal, estaRodando: () => rodando };
})();
