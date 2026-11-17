// Lista de pessoas e o formulário de cadastro/edição.

import { useState } from 'preact/hooks';
import {
  html, Card, Chip, Avatar, Vazio, Carregando, Erro, Campo, Texto, Interruptor, useDados, ir,
} from '../ui.js';
import { store } from '../store.js';
import { tempoRelativo } from '../util.js';

export function Pessoas({ busca }) {
  const [tag, setTag] = useState(null);
  const [soCultivo, setSoCultivo] = useState(false);

  const { dados, carregando, erro } = useDados(
    async () => ({
      pessoas: await store.listarPessoas({ busca, tag, cultivo: soCultivo ? true : null }),
      tags: await store.listarTags(),
    }),
    [busca, tag, soCultivo]
  );

  if (carregando) return html`<${Carregando} />`;
  if (erro) return html`<${Erro}>${erro}<//>`;

  const { pessoas, tags } = dados;

  return html`
    <h2 class="tela">Pessoas</h2>
    <p class="legenda">
      ${pessoas.length} ${pessoas.length === 1 ? 'pessoa' : 'pessoas'}${busca ? ` para "${busca}"` : ''}
    </p>

    <div class="filtros">
      <button class=${soCultivo ? 'ativo' : ''} onClick=${() => setSoCultivo(!soCultivo)}>
        só quem eu cultivo
      </button>
      ${tags.map((t) => html`
        <button key=${t.id} class=${tag === t.nome ? 'ativo' : ''}
                onClick=${() => setTag(tag === t.nome ? null : t.nome)}>
          ${t.nome} ${t.uso}
        </button>
      `)}
    </div>

    <${Card}>
      ${!pessoas.length && html`<${Vazio}>Ninguém por aqui ainda.<//>`}
      ${pessoas.map((p) => html`
        <div class="item" key=${p.id}>
          <a class="pessoa-linha" href=${`#/pessoa/${p.id}`}>
            <${Avatar} nome=${p.nome} />
            <div class="corpo">
              <span class="nome">${p.nome}</span>
              <span class="sub">
                ${p.contexto || 'sem contexto'} · ${tempoRelativo(p.dias_desde)}
              </span>
              ${p.tags.length > 0 && html`
                <div class="chips">
                  ${p.tags.map((t) => html`<${Chip} key=${t} cor="verde">${t}<//>`)}
                  ${p.pendencias_abertas > 0 && html`<${Chip} cor="rosa">${p.pendencias_abertas} em aberto<//>`}
                </div>
              `}
            </div>
          </a>
        </div>
      `)}
    <//>
  `;
}

const VAZIA = {
  nome: '', tratamento: '', contexto: '', onde_conheci: '',
  nascimento: '', cultivo: true, cadencia_dias: '',
};

export function FormPessoa({ id }) {
  const novo = !id;
  const { dados, carregando, erro } = useDados(
    async () => (novo ? { pessoa: { ...VAZIA }, tags: [] } : await store.obterPessoa(id)),
    [id]
  );
  const [form, setForm] = useState(null);
  const [tagsTexto, setTagsTexto] = useState(null);
  const [salvando, setSalvando] = useState(false);

  if (carregando) return html`<${Carregando} />`;
  if (erro) return html`<${Erro}>${erro}<//>`;
  if (!dados) return html`<${Erro}>Pessoa não encontrada.<//>`;

  const base = form ?? { ...VAZIA, ...dados.pessoa };
  const tagsAtuais = tagsTexto ?? (dados.pessoa.tags || []).join(', ');
  const mudar = (campo) => (valor) => setForm({ ...base, [campo]: valor });

  const salvar = async (e) => {
    e.preventDefault();
    if (!base.nome.trim()) return;
    setSalvando(true);
    try {
      const salva = await store.salvarPessoa({
        ...(novo ? {} : { id }),
        nome: base.nome.trim(),
        tratamento: base.tratamento || null,
        contexto: base.contexto || null,
        onde_conheci: base.onde_conheci || null,
        nascimento: base.nascimento || null,
        cultivo: !!base.cultivo,
        cadencia_dias: base.cadencia_dias ? Number(base.cadencia_dias) : null,
      });
      await store.definirTags(salva.id, tagsAtuais.split(',').map((t) => t.trim()).filter(Boolean));
      ir(`#/pessoa/${salva.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvando(false);
    }
  };

  return html`
    <h2 class="tela">${novo ? 'Nova pessoa' : 'Editar'}</h2>
    <p class="legenda">
      Só o essencial. Telefone e e-mail já estão na sua agenda — aqui mora o que você esquece.
    </p>

    <form onSubmit=${salvar}>
      <${Card}>
        <${Campo} rotulo="Nome">
          <${Texto} valor=${base.nome} aoMudar=${mudar('nome')} placeholder="Nome completo" autofocus />
        <//>
        <${Campo} rotulo="Como eu chamo" dica="Apelido, primeiro nome, como ela prefere">
          <${Texto} valor=${base.tratamento} aoMudar=${mudar('tratamento')} />
        <//>
        <${Campo} rotulo="Contexto" dica="Onde trabalha, área, cidade — texto livre, sem hierarquia">
          <${Texto} valor=${base.contexto} aoMudar=${mudar('contexto')} placeholder="GECRM, CAIXA" />
        <//>
        <${Campo} rotulo="Onde nos conhecemos">
          <${Texto} valor=${base.onde_conheci} aoMudar=${mudar('onde_conheci')} />
        <//>
        <${Campo} rotulo="Aniversário" dica="Só a data. A idade o app calcula sozinho.">
          <input type="date" value=${base.nascimento || ''}
                 onInput=${(e) => mudar('nascimento')(e.target.value)} />
        <//>
        <${Campo} rotulo="Tags" dica="Separadas por vírgula. É isso que substitui organograma.">
          <${Texto} valor=${tagsAtuais} aoMudar=${setTagsTexto} placeholder="caixa, tecnologia" />
        <//>
      <//>

      <${Card}>
        <${Interruptor} marcado=${base.cultivo} aoMudar=${mudar('cultivo')}>
          Cultivar: entra na lista de "faz muito tempo"
        <//>
        <${Campo} rotulo="Cadência própria (dias)" dica="Em branco usa o padrão. Quase sempre dá para deixar em branco.">
          <input type="number" min="7" max="1095" value=${base.cadencia_dias || ''}
                 onInput=${(e) => mudar('cadencia_dias')(e.target.value)} />
        <//>
      <//>

      <div class="acoes">
        <button class="btn cheio" type="submit" disabled=${salvando || !base.nome.trim()}>
          ${salvando ? 'salvando…' : 'salvar'}
        </button>
        <button class="btn" type="button" onClick=${() => history.back()}>cancelar</button>
      </div>
    </form>
  `;
}
