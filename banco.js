// =====================================================================
//  BANCO LOCAL (IndexedDB): guarda lançamentos, fotos e áudios no
//  aparelho até que sejam enviados ao servidor.
// =====================================================================
const Banco = (() => {
  const NOME = 'controle-gastos';
  const VERSAO = 1;
  let conexao = null;

  function abrir() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise((ok, falha) => {
      const req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('lancamentos')) db.createObjectStore('lancamentos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('arquivos')) {
          const s = db.createObjectStore('arquivos', { keyPath: 'id' });
          s.createIndex('lancamentoId', 'lancamentoId', { unique: false });
        }
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'chave' });
      };
      req.onsuccess = () => {
        conexao = req.result;
        conexao.onversionchange = () => { conexao.close(); conexao = null; };
        ok(conexao);
      };
      req.onerror = () => falha(req.error);
      req.onblocked = () => falha(new Error('O banco local está em uso por outra aba. Feche as outras abas do app.'));
    });
  }

  function pedido(r) {
    return new Promise((ok, falha) => {
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
  }

  async function obter(store, chave) {
    const db = await abrir();
    return pedido(db.transaction(store).objectStore(store).get(chave));
  }

  async function todos(store) {
    const db = await abrir();
    return pedido(db.transaction(store).objectStore(store).getAll());
  }

  async function porIndice(store, indice, valor) {
    const db = await abrir();
    return pedido(db.transaction(store).objectStore(store).index(indice).getAll(valor));
  }

  async function escrever(store, fn) {
    const db = await abrir();
    return new Promise((ok, falha) => {
      const t = db.transaction(store, 'readwrite');
      fn(t.objectStore(store));
      t.oncomplete = () => ok();
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error || new Error('Gravação cancelada'));
    });
  }

  const gravar = (store, obj) => escrever(store, s => s.put(obj)).then(() => obj);
  const apagar = (store, chave) => escrever(store, s => s.delete(chave));
  const limpar = (store) => escrever(store, s => s.clear());

  async function lerConfig(chave, padrao) {
    const r = await obter('config', chave);
    return r === undefined ? padrao : r.valor;
  }
  const gravarConfig = (chave, valor) => gravar('config', { chave, valor });

  return { abrir, obter, todos, porIndice, gravar, apagar, limpar, lerConfig, gravarConfig };
})();

// Perfil deste aparelho: identificador do aparelho, código do grupo e a conta
// conectada (contaId, nome e a sessão "token"; sem token = precisa entrar).
const Perfil = {
  _cache: null,
  async obter() {
    if (!this._cache) this._cache = await Banco.lerConfig('perfil', null);
    return this._cache;
  },
  async salvar(p) {
    this._cache = p;
    await Banco.gravarConfig('perfil', p);
    return p;
  }
};

function novoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
