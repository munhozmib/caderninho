// Adaptador local: guarda tudo no localStorage do navegador.
// Serve para rodar o app sem Supabase — desenvolvimento, demonstração e
// o modo "só olhar" quando você ainda não configurou a nuvem.

import { uid, hojeISO, dISO, parseISO, diasEntre, proximaOcorrencia, idadeEm, semAcento } from './util.js';

const CHAVE = 'caderninho.v1';

const vazio = () => ({
  pessoas: [], fatos: [], interacoes: [], vinculos: [], tags: [], pessoaTags: [],
  config: { cadencia_padrao_dias: 180, janela_dias: 30 },
});

function carregar() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return semente();
    return { ...vazio(), ...JSON.parse(cru) };
  } catch {
    return semente();
  }
}

let db = null;
const bd = () => (db ??= carregar());

function gravar() {
  localStorage.setItem(CHAVE, JSON.stringify(db));
}

// ---------------------------------------------------------------- semente

function diasAFrente(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dISO(d);
}

function aniversarioDaqui(dias, anosAtras) {
  const alvo = parseISO(diasAFrente(dias));
  return dISO(new Date(alvo.getFullYear() - anosAtras, alvo.getMonth(), alvo.getDate()));
}

function semente() {
  const d = vazio();
  const p = (nome, extra) => {
    const pessoa = {
      id: uid(), nome, tratamento: null, contexto: null, onde_conheci: null,
      nascimento: null, cultivo: true, cadencia_dias: null, arquivado: false,
      criado_em: new Date().toISOString(), ...extra,
    };
    d.pessoas.push(pessoa);
    return pessoa;
  };
  const f = (pessoa, tipo, texto, extra = {}) =>
    d.fatos.push({
      id: uid(), pessoa_id: pessoa.id, tipo, texto, quando: null, anual: false,
      resolvido_em: null, criado_em: new Date().toISOString(), ...extra,
    });
  const conversa = (pessoas, quando, canal, resumo) => {
    const i = { id: uid(), quando, canal, resumo, criado_em: new Date().toISOString() };
    d.interacoes.push(i);
    pessoas.forEach((pe) => d.vinculos.push({ interacao_id: i.id, pessoa_id: pe.id }));
  };
  const tag = (nome) => {
    const t = { id: uid(), nome };
    d.tags.push(t);
    return t;
  };
  const marcar = (pessoa, t) => d.pessoaTags.push({ pessoa_id: pessoa.id, tag_id: t.id });

  const tCaixa = tag('caixa');
  const tTech = tag('tecnologia');
  const tMentor = tag('mentoria');
  const tFora = tag('fora da caixa');

  const helena = p('Helena Fontes', {
    tratamento: 'Lena',
    contexto: 'GECRM, CAIXA',
    onde_conheci: 'Projeto de canais digitais, 2024',
    nascimento: aniversarioDaqui(4, 41),
  });
  marcar(helena, tCaixa); marcar(helena, tTech);
  f(helena, 'nota', 'Casada com o Rafael, que é professor de história');
  f(helena, 'data', 'Pedro, filho', { quando: aniversarioDaqui(19, 6), anual: true });
  f(helena, 'nota', 'Corre maratona. Fez a de Porto Alegre esse ano');
  f(helena, 'gancho', 'Falou que ia começar um MBA em análise de dados');
  conversa([helena], diasAFrente(-23), 'almoço', 'Contou do MBA e reclamou da reorganização da área. Perguntou se eu conhecia alguém de dados.');

  const joaquim = p('Joaquim Vieira', {
    contexto: 'Superintendência regional, CAIXA',
    onde_conheci: 'Curso de liderança',
    nascimento: aniversarioDaqui(-60, 53),
  });
  marcar(joaquim, tCaixa); marcar(joaquim, tMentor);
  f(joaquim, 'nota', 'Três filhos já adultos. O do meio mora em Portugal');
  f(joaquim, 'nota', 'Torce pro Athletico e nunca perde um clássico');
  f(joaquim, 'pendencia', 'Prometi mandar o artigo sobre carreira em banco público');
  conversa([joaquim], diasAFrente(-71), 'café', 'Conversa longa sobre carreira. Ofereceu ajuda se eu quiser tentar a regional.');

  const marta = p('Marta Okada', {
    contexto: 'Produto, Nubank',
    onde_conheci: 'Meetup de produto em 2023',
    nascimento: aniversarioDaqui(12, 36),
  });
  marcar(marta, tFora); marcar(marta, tTech);
  f(marta, 'nota', 'Mora em Lisboa desde o ano passado');
  f(marta, 'data', 'Aniversário de casamento', { quando: aniversarioDaqui(23, 4), anual: true });
  f(marta, 'nota', 'Vegetariana — lembrar na hora de escolher restaurante');
  conversa([marta], diasAFrente(-210), 'mensagem', 'Trocamos mensagens no fim do ano. Ela falou que a mudança foi mais dura que o esperado.');

  const caio = p('Caio Bastos', {
    contexto: 'Auditoria, CAIXA',
    onde_conheci: 'Fui apresentado pelo Joaquim',
    cultivo: false,
  });
  marcar(caio, tCaixa);
  f(caio, 'nota', 'Pessoa fechada no começo, mas abriu quando falamos de música');

  d.config.__semente = true;
  db = d;
  gravar();
  return d;
}

// ---------------------------------------------------------------- consultas

function tagsDe(pessoaId) {
  return bd().pessoaTags
    .filter((pt) => pt.pessoa_id === pessoaId)
    .map((pt) => bd().tags.find((t) => t.id === pt.tag_id)?.nome)
    .filter(Boolean)
    .sort();
}

function ultimaDe(pessoaId) {
  const ids = bd().vinculos.filter((v) => v.pessoa_id === pessoaId).map((v) => v.interacao_id);
  const datas = bd().interacoes.filter((i) => ids.includes(i.id)).map((i) => i.quando).sort();
  return datas.length ? datas[datas.length - 1] : null;
}

function enriquecer(p) {
  const ultima = ultimaDe(p.id);
  const abertos = bd().fatos.filter(
    (f) => f.pessoa_id === p.id && ['pendencia', 'gancho'].includes(f.tipo) && !f.resolvido_em
  ).length;
  return {
    ...p,
    ultima,
    dias_desde: ultima ? diasEntre(ultima) : null,
    cadencia_efetiva: p.cadencia_dias || bd().config.cadencia_padrao_dias || 180,
    idade: idadeEm(p.nascimento),
    tags: tagsDe(p.id),
    pendencias_abertas: abertos,
  };
}

export const adaptadorLocal = {
  modo: 'local',

  async sessao() {
    return { modo: 'local', usuario: { email: 'modo local' } };
  },
  async entrar() {
    throw new Error('Modo local não tem login.');
  },
  async sair() {},

  async listarPessoas({ busca = '', tag = null, cultivo = null, arquivados = false } = {}) {
    const b = semAcento(busca);
    return bd().pessoas
      .filter((p) => !!p.arquivado === !!arquivados)
      .map(enriquecer)
      .filter((p) => (cultivo === null ? true : !!p.cultivo === cultivo))
      .filter((p) => (tag ? p.tags.includes(tag) : true))
      .filter((p) => (b ? semAcento(`${p.nome} ${p.contexto || ''} ${p.tratamento || ''}`).includes(b) : true))
      .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  },

  async obterPessoa(id) {
    const p = bd().pessoas.find((x) => x.id === id);
    if (!p) return null;
    const fatos = bd().fatos
      .filter((f) => f.pessoa_id === id)
      .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1));
    const ids = bd().vinculos.filter((v) => v.pessoa_id === id).map((v) => v.interacao_id);
    const interacoes = bd().interacoes
      .filter((i) => ids.includes(i.id))
      .map((i) => ({
        ...i,
        pessoas: bd().vinculos
          .filter((v) => v.interacao_id === i.id)
          .map((v) => bd().pessoas.find((p2) => p2.id === v.pessoa_id))
          .filter(Boolean)
          .map((p2) => ({ id: p2.id, nome: p2.nome })),
      }))
      .sort((a, b) => (a.quando < b.quando ? 1 : -1));
    return { pessoa: enriquecer(p), fatos, interacoes };
  },

  async salvarPessoa(dados) {
    const atual = bd().pessoas.find((p) => p.id === dados.id);
    if (atual) {
      Object.assign(atual, dados);
      gravar();
      return enriquecer(atual);
    }
    const nova = {
      id: uid(), nome: '', tratamento: null, contexto: null, onde_conheci: null,
      nascimento: null, cultivo: true, cadencia_dias: null, arquivado: false,
      criado_em: new Date().toISOString(), ...dados,
    };
    bd().pessoas.push(nova);
    gravar();
    return enriquecer(nova);
  },

  async arquivarPessoa(id, valor = true) {
    const p = bd().pessoas.find((x) => x.id === id);
    if (p) { p.arquivado = valor; gravar(); }
  },

  async excluirPessoa(id) {
    db.pessoas = db.pessoas.filter((p) => p.id !== id);
    db.fatos = db.fatos.filter((f) => f.pessoa_id !== id);
    db.vinculos = db.vinculos.filter((v) => v.pessoa_id !== id);
    db.pessoaTags = db.pessoaTags.filter((pt) => pt.pessoa_id !== id);
    gravar();
  },

  async salvarFato(dados) {
    if (dados.id) {
      const f = bd().fatos.find((x) => x.id === dados.id);
      Object.assign(f, dados);
      gravar();
      return f;
    }
    const novo = {
      id: uid(), tipo: 'nota', texto: '', quando: null, anual: false,
      resolvido_em: null, criado_em: new Date().toISOString(), ...dados,
    };
    bd().fatos.push(novo);
    gravar();
    return novo;
  },

  async alternarFato(id) {
    const f = bd().fatos.find((x) => x.id === id);
    if (f) { f.resolvido_em = f.resolvido_em ? null : hojeISO(); gravar(); }
  },

  async excluirFato(id) {
    db.fatos = db.fatos.filter((f) => f.id !== id);
    gravar();
  },

  async registrarInteracao({ quando, canal, resumo, pessoaIds }) {
    const i = { id: uid(), quando: quando || hojeISO(), canal, resumo, criado_em: new Date().toISOString() };
    bd().interacoes.push(i);
    pessoaIds.forEach((pid) => bd().vinculos.push({ interacao_id: i.id, pessoa_id: pid }));
    gravar();
    return i;
  },

  async excluirInteracao(id) {
    db.interacoes = db.interacoes.filter((i) => i.id !== id);
    db.vinculos = db.vinculos.filter((v) => v.interacao_id !== id);
    gravar();
  },

  async agenda(janela) {
    const limite = janela ?? bd().config.janela_dias ?? 30;
    const itens = [];
    for (const p of bd().pessoas.filter((x) => !x.arquivado)) {
      if (p.nascimento) {
        const prox = proximaOcorrencia(p.nascimento);
        itens.push({
          pessoa_id: p.id, pessoa: p.nome, rotulo: 'Aniversário',
          data_original: p.nascimento, proxima: prox,
          dias: diasEntre(hojeISO(), prox), faz_anos: idadeEm(p.nascimento, prox),
        });
      }
    }
    for (const f of bd().fatos.filter((x) => x.tipo === 'data' && x.anual && x.quando)) {
      const p = bd().pessoas.find((x) => x.id === f.pessoa_id);
      if (!p || p.arquivado) continue;
      const prox = proximaOcorrencia(f.quando);
      itens.push({
        pessoa_id: p.id, pessoa: p.nome, rotulo: f.texto,
        data_original: f.quando, proxima: prox,
        dias: diasEntre(hojeISO(), prox), faz_anos: idadeEm(f.quando, prox),
      });
    }
    return itens.filter((i) => i.dias <= limite).sort((a, b) => a.dias - b.dias);
  },

  async abertos() {
    return bd().fatos
      .filter((f) => ['pendencia', 'gancho'].includes(f.tipo) && !f.resolvido_em)
      .map((f) => ({ ...f, pessoa: bd().pessoas.find((p) => p.id === f.pessoa_id) }))
      .filter((f) => f.pessoa && !f.pessoa.arquivado)
      .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'pendencia' ? -1 : 1));
  },

  async frios() {
    return (await this.listarPessoas({ cultivo: true }))
      .filter((p) => p.dias_desde === null || p.dias_desde >= p.cadencia_efetiva)
      .sort((a, b) => (b.dias_desde ?? 99999) - (a.dias_desde ?? 99999));
  },

  async listarTags() {
    return bd().tags
      .map((t) => ({ ...t, uso: bd().pessoaTags.filter((pt) => pt.tag_id === t.id).length }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  async definirTags(pessoaId, nomes) {
    db.pessoaTags = db.pessoaTags.filter((pt) => pt.pessoa_id !== pessoaId);
    for (const nome of nomes) {
      const limpo = nome.trim();
      if (!limpo) continue;
      let t = bd().tags.find((x) => semAcento(x.nome) === semAcento(limpo));
      if (!t) { t = { id: uid(), nome: limpo }; bd().tags.push(t); }
      db.pessoaTags.push({ pessoa_id: pessoaId, tag_id: t.id });
    }
    gravar();
  },

  async renomearTag(id, nome) {
    const t = bd().tags.find((x) => x.id === id);
    if (t) { t.nome = nome; gravar(); }
  },

  async excluirTag(id) {
    db.tags = db.tags.filter((t) => t.id !== id);
    db.pessoaTags = db.pessoaTags.filter((pt) => pt.tag_id !== id);
    gravar();
  },

  async obterConfig() {
    return { ...bd().config };
  },

  async salvarConfig(c) {
    Object.assign(bd().config, c);
    gravar();
    return bd().config;
  },

  async zerar() {
    localStorage.removeItem(CHAVE);
    db = null;
    semente();
  },
};
