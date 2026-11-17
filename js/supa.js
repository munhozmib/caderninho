// Adaptador Supabase. Mesma API do adaptador local — quem usa não sabe a diferença.
// A segurança não está aqui: está nas policies de RLS do schema.sql.

import { createClient } from 'supabase';
import { hojeISO, semAcento } from './util.js';

export function criarAdaptadorSupabase({ url, anonKey }) {
  const sb = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  const ok = ({ data, error }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  return {
    modo: 'supabase',
    cliente: sb,

    async sessao() {
      const { data } = await sb.auth.getSession();
      return { modo: 'supabase', usuario: data?.session?.user ?? null };
    },

    aoMudarSessao(cb) {
      return sb.auth.onAuthStateChange((_e, s) => cb(s?.user ?? null));
    },

    async entrar(email, senha) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw new Error(traduzErro(error.message));
      return data.user;
    },

    async sair() {
      await sb.auth.signOut();
    },

    async listarPessoas({ busca = '', tag = null, cultivo = null, arquivados = false } = {}) {
      let q = sb.from('v_pessoa').select('*').eq('arquivado', arquivados).order('nome');
      if (cultivo !== null) q = q.eq('cultivo', cultivo);
      if (tag) q = q.contains('tags', [tag]);
      if (busca) q = q.or(`nome.ilike.%${busca}%,contexto.ilike.%${busca}%,tratamento.ilike.%${busca}%`);
      return ok(await q);
    },

    async obterPessoa(id) {
      const [pessoa, fatos, vinculos] = await Promise.all([
        sb.from('v_pessoa').select('*').eq('id', id).maybeSingle().then(ok),
        sb.from('fato').select('*').eq('pessoa_id', id).order('criado_em', { ascending: false }).then(ok),
        sb.from('interacao_pessoa')
          .select('interacao(id, quando, canal, resumo, interacao_pessoa(pessoa(id, nome)))')
          .eq('pessoa_id', id)
          .then(ok),
      ]);
      if (!pessoa) return null;
      const interacoes = (vinculos || [])
        .map((v) => v.interacao)
        .filter(Boolean)
        .map((i) => ({
          id: i.id, quando: i.quando, canal: i.canal, resumo: i.resumo,
          pessoas: (i.interacao_pessoa || []).map((x) => x.pessoa).filter(Boolean),
        }))
        .sort((a, b) => (a.quando < b.quando ? 1 : -1));
      return { pessoa, fatos: fatos || [], interacoes };
    },

    async salvarPessoa(dados) {
      const campos = {
        nome: dados.nome,
        tratamento: dados.tratamento || null,
        contexto: dados.contexto || null,
        onde_conheci: dados.onde_conheci || null,
        nascimento: dados.nascimento || null,
        cultivo: dados.cultivo ?? true,
        cadencia_dias: dados.cadencia_dias || null,
      };
      if (dados.id) {
        return ok(await sb.from('pessoa').update(campos).eq('id', dados.id).select().single());
      }
      return ok(await sb.from('pessoa').insert(campos).select().single());
    },

    async arquivarPessoa(id, valor = true) {
      ok(await sb.from('pessoa').update({ arquivado: valor }).eq('id', id));
    },

    async excluirPessoa(id) {
      ok(await sb.from('pessoa').delete().eq('id', id));
    },

    async salvarFato(dados) {
      const campos = {
        pessoa_id: dados.pessoa_id,
        tipo: dados.tipo,
        texto: dados.texto,
        quando: dados.quando || null,
        anual: !!dados.anual,
      };
      if (dados.id) {
        return ok(await sb.from('fato').update(campos).eq('id', dados.id).select().single());
      }
      return ok(await sb.from('fato').insert(campos).select().single());
    },

    async alternarFato(id) {
      const atual = ok(await sb.from('fato').select('resolvido_em').eq('id', id).single());
      ok(await sb.from('fato')
        .update({ resolvido_em: atual.resolvido_em ? null : hojeISO() })
        .eq('id', id));
    },

    async excluirFato(id) {
      ok(await sb.from('fato').delete().eq('id', id));
    },

    async registrarInteracao({ quando, canal, resumo, pessoaIds }) {
      const i = ok(await sb.from('interacao')
        .insert({ quando: quando || hojeISO(), canal: canal || null, resumo: resumo || null })
        .select().single());
      if (pessoaIds?.length) {
        ok(await sb.from('interacao_pessoa')
          .insert(pessoaIds.map((pid) => ({ interacao_id: i.id, pessoa_id: pid }))));
      }
      return i;
    },

    async excluirInteracao(id) {
      ok(await sb.from('interacao').delete().eq('id', id));
    },

    async agenda(janela) {
      const cfg = await this.obterConfig();
      const limite = janela ?? cfg.janela_dias ?? 30;
      return ok(await sb.from('v_agenda').select('*').lte('dias', limite).order('dias'));
    },

    async abertos() {
      const dados = ok(await sb.from('fato')
        .select('*, pessoa:pessoa_id(id, nome, arquivado)')
        .eq('tipo', 'pendencia')
        .is('resolvido_em', null));
      return (dados || []).filter((f) => f.pessoa && !f.pessoa.arquivado);
    },

    async frios() {
      const dados = await this.listarPessoas({ cultivo: true });
      return (dados || [])
        .filter((p) => p.dias_desde === null || p.dias_desde >= p.cadencia_efetiva)
        .sort((a, b) => (b.dias_desde ?? 99999) - (a.dias_desde ?? 99999));
    },

    async listarTags() {
      const [tags, usos] = await Promise.all([
        sb.from('tag').select('*').order('nome').then(ok),
        sb.from('pessoa_tag').select('tag_id').then(ok),
      ]);
      const conta = {};
      (usos || []).forEach((u) => { conta[u.tag_id] = (conta[u.tag_id] || 0) + 1; });
      return (tags || []).map((t) => ({ ...t, uso: conta[t.id] || 0 }));
    },

    async definirTags(pessoaId, nomes) {
      const limpos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
      const existentes = ok(await sb.from('tag').select('*'));
      const ids = [];
      for (const nome of limpos) {
        let t = (existentes || []).find((x) => semAcento(x.nome) === semAcento(nome));
        if (!t) t = ok(await sb.from('tag').insert({ nome }).select().single());
        ids.push(t.id);
      }
      ok(await sb.from('pessoa_tag').delete().eq('pessoa_id', pessoaId));
      if (ids.length) {
        ok(await sb.from('pessoa_tag')
          .insert(ids.map((tag_id) => ({ pessoa_id: pessoaId, tag_id }))));
      }
    },

    async renomearTag(id, nome) {
      ok(await sb.from('tag').update({ nome }).eq('id', id));
    },

    async excluirTag(id) {
      ok(await sb.from('tag').delete().eq('id', id));
    },

    async obterConfig() {
      const atual = ok(await sb.from('config').select('*').maybeSingle());
      if (atual) return atual;
      return ok(await sb.from('config').insert({}).select().single());
    },

    async salvarConfig(c) {
      const atual = await this.obterConfig();
      return ok(await sb.from('config').update(c).eq('owner_id', atual.owner_id).select().single());
    },
  };
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado.';
  return msg;
}
