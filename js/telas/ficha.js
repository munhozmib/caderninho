// A ficha da pessoa e o modo encontro — o cartão na mão antes do almoço.

import { useState } from 'preact/hooks';
import {
  html, Card, Chip, Avatar, Vazio, Carregando, Erro, useDados, ir, ICONES_TIPO, CORES_TIPO,
} from '../ui.js';
import { store } from '../store.js';
import {
  tempoRelativo, dBR, dCurto, idadeRotulo, proximaOcorrencia, diasEntre, hojeISO, emDias, ROTULO_TIPO,
} from '../util.js';

function rotuloFato(f) {
  if (f.tipo !== 'data' || !f.quando) return f.texto;
  const idade = idadeRotulo(f.quando);
  return idade ? `${f.texto} — ${idade}` : f.texto;
}

export function Ficha({ id }) {
  const { dados, carregando, erro, recarregar } = useDados(() => store.obterPessoa(id), [id]);
  const [novo, setNovo] = useState({ tipo: 'nota', texto: '', quando: '', anual: true });
  const [salvando, setSalvando] = useState(false);

  if (carregando) return html`<${Carregando} />`;
  if (erro) return html`<${Erro}>${erro}<//>`;
  if (!dados) return html`<${Erro}>Pessoa não encontrada.<//>`;

  const { pessoa, fatos, interacoes } = dados;
  const sabidos = fatos.filter((f) => ['nota', 'data'].includes(f.tipo));
  const abertos = fatos.filter((f) => f.tipo === 'pendencia' && !f.resolvido_em);
  const fechados = fatos.filter((f) => f.tipo === 'pendencia' && f.resolvido_em);

  const adicionar = async (e) => {
    e.preventDefault();
    if (!novo.texto.trim()) return;
    setSalvando(true);
    try {
      await store.salvarFato({
        pessoa_id: id,
        tipo: novo.tipo,
        texto: novo.texto.trim(),
        quando: novo.tipo === 'data' ? novo.quando || null : null,
        anual: novo.tipo === 'data' ? !!novo.anual : false,
      });
      setNovo({ tipo: novo.tipo, texto: '', quando: '', anual: true });
      recarregar();
    } finally {
      setSalvando(false);
    }
  };

  const falei = async () => {
    await store.registrarInteracao({
      quando: hojeISO(), canal: 'conversa', resumo: null, pessoaIds: [id],
    });
    recarregar();
  };

  return html`
    <div class="pessoa-linha" style="margin-bottom:14px">
      <${Avatar} nome=${pessoa.nome} />
      <div class="corpo">
        <h2 class="tela" style="font-size:24px;margin:0">${pessoa.nome}</h2>
        <span class="sub">
          ${pessoa.tratamento ? `"${pessoa.tratamento}" · ` : ''}${pessoa.contexto || 'sem contexto'}
        </span>
      </div>
    </div>

    ${pessoa.tags.length > 0 && html`
      <div class="chips" style="margin-bottom:14px">
        ${pessoa.tags.map((t) => html`<${Chip} key=${t} cor="verde">${t}<//>`)}
      </div>
    `}

    <div class="acoes" style="margin-bottom:16px">
      <button class="btn cheio" onClick=${() => ir(`#/encontro/${id}`)}>vou encontrar</button>
      <button class="btn" onClick=${() => ir(`#/registrar?p=${id}`)}>registrar conversa</button>
      <button class="btn" onClick=${falei}>falei hoje</button>
      <button class="btn" onClick=${() => ir(`#/editar/${id}`)}>editar</button>
    </div>

    <${Card} titulo="Quem é">
      <p style="margin:0 0 6px">
        Última conversa: <strong>${tempoRelativo(pessoa.dias_desde)}</strong>
        ${pessoa.ultima ? ` (${dBR(pessoa.ultima)})` : ''}
      </p>
      ${pessoa.nascimento && html`
        <p style="margin:0 0 6px">
          Aniversário: ${dCurto(pessoa.nascimento)} · ${pessoa.idade} anos · ${emDias(diasEntre(hojeISO(), proximaOcorrencia(pessoa.nascimento)))}
        </p>
      `}
      ${pessoa.onde_conheci && html`<p style="margin:0" class="sub">Nos conhecemos: ${pessoa.onde_conheci}</p>`}
      ${!pessoa.cultivo && html`<p class="sub" style="margin:6px 0 0">Fora da roda de cultivo.</p>`}
    <//>

    ${abertos.length > 0 && html`
      <${Card} titulo="Em aberto">
        ${abertos.map((f) => html`
          <div class="fato" key=${f.id}>
            <span>${ICONES_TIPO[f.tipo]}</span>
            <span class="texto">
              ${f.texto}
              <${Chip} cor=${CORES_TIPO[f.tipo]}>${ROTULO_TIPO[f.tipo]}<//>
            </span>
            <button class="btn pequeno" onClick=${async () => { await store.alternarFato(f.id); recarregar(); }}>
              ✓
            </button>
          </div>
        `)}
      <//>
    `}

    <${Card} titulo="O que eu sei">
      ${!sabidos.length && html`<${Vazio}>Nada anotado ainda. Comece pelo que você não quer esquecer.<//>`}
      ${sabidos.map((f) => html`
        <div class="fato" key=${f.id}>
          <span>${ICONES_TIPO[f.tipo]}</span>
          <span class="texto">
            ${rotuloFato(f)}
            ${f.tipo === 'data' && f.quando && html`<span class="sub"> · ${dBR(f.quando)}</span>`}
          </span>
          <button class="btn pequeno perigo" title="apagar"
                  onClick=${async () => {
                    if (confirm('Apagar esse fato?')) { await store.excluirFato(f.id); recarregar(); }
                  }}>×</button>
        </div>
      `)}

      <form onSubmit=${adicionar} style="margin-top:14px">
        <div class="filtros" style="padding-bottom:8px">
          ${['nota', 'data', 'pendencia'].map((t) => html`
            <button type="button" key=${t} class=${novo.tipo === t ? 'ativo' : ''}
                    onClick=${() => setNovo({ ...novo, tipo: t })}>
              ${ICONES_TIPO[t]} ${ROTULO_TIPO[t]}
            </button>
          `)}
        </div>
        <input class="busca" style="box-shadow:none;border:1px solid var(--linha)"
               value=${novo.texto}
               placeholder=${novo.tipo === 'data' ? 'Helena, filha' : 'o que você não quer esquecer'}
               onInput=${(e) => setNovo({ ...novo, texto: e.target.value })} />
        ${novo.tipo === 'data' && html`
          <div class="linha2" style="margin-top:10px">
            <input type="date" value=${novo.quando}
                   onInput=${(e) => setNovo({ ...novo, quando: e.target.value })} />
            <label class="switch" style="border:0;padding:0">
              <input type="checkbox" checked=${novo.anual}
                     onChange=${(e) => setNovo({ ...novo, anual: e.target.checked })} />
              <span>todo ano</span>
            </label>
          </div>
        `}
        <div class="acoes">
          <button class="btn cheio" type="submit" disabled=${salvando || !novo.texto.trim()}>anotar</button>
        </div>
      </form>
    <//>

    <${Card} titulo=${`Conversas (${interacoes.length})`}>
      ${!interacoes.length && html`<${Vazio}>Nenhuma conversa registrada.<//>`}
      ${interacoes.map((i) => html`
        <div class="item" key=${i.id}>
          <strong>${dBR(i.quando)}</strong>
          <span class="sub"> · ${i.canal || 'conversa'}</span>
          ${i.pessoas && i.pessoas.length > 1 && html`
            <span class="sub"> · com ${i.pessoas.filter((p) => p.id !== id).map((p) => p.nome).join(', ')}</span>
          `}
          ${i.resumo && html`<p style="margin:4px 0 0">${i.resumo}</p>`}
        </div>
      `)}
    <//>

    ${fechados.length > 0 && html`
      <${Card} titulo="Resolvidos">
        ${fechados.map((f) => html`
          <div class="fato feito" key=${f.id}>
            <span>${ICONES_TIPO[f.tipo]}</span>
            <span class="texto">${f.texto}</span>
            <button class="btn pequeno" onClick=${async () => { await store.alternarFato(f.id); recarregar(); }}>
              reabrir
            </button>
          </div>
        `)}
      <//>
    `}

    <div class="acoes" style="margin-top:18px">
      <button class="btn perigo" onClick=${async () => {
        if (confirm(`Arquivar ${pessoa.nome}? Ela some das listas, mas nada é apagado.`)) {
          await store.arquivarPessoa(id, true);
          ir('#/pessoas');
        }
      }}>arquivar</button>
    </div>
  `;
}

export function Encontro({ id }) {
  const { dados, carregando, erro } = useDados(() => store.obterPessoa(id), [id]);

  if (carregando) return html`<${Carregando} />`;
  if (erro) return html`<${Erro}>${erro}<//>`;
  if (!dados) return html`<${Erro}>Pessoa não encontrada.<//>`;

  const { pessoa, fatos, interacoes } = dados;
  const ultima = interacoes[0];
  const datas = fatos.filter((f) => f.tipo === 'data' && f.quando);
  const notas = fatos.filter((f) => f.tipo === 'nota');
  const abertos = fatos.filter((f) => f.tipo === 'pendencia' && !f.resolvido_em);

  return html`
    <h2 class="tela">${pessoa.tratamento || pessoa.nome}</h2>
    <p class="legenda">${pessoa.contexto || ''}</p>

    <${Card} classe="encontro">
      ${pessoa.onde_conheci && html`
        <div class="bloco">
          <div class="rotulo">Como nos conhecemos</div>
          <div>${pessoa.onde_conheci}</div>
        </div>
      `}

      <div class="bloco">
        <div class="rotulo">Da última vez — ${tempoRelativo(pessoa.dias_desde)}</div>
        <div>${ultima?.resumo || 'Sem resumo registrado.'}</div>
      </div>

      ${(datas.length > 0 || pessoa.nascimento) && html`
        <div class="bloco">
          <div class="rotulo">Gente e datas</div>
          ${pessoa.nascimento && html`
            <div>${pessoa.idade} anos · aniversário ${dCurto(pessoa.nascimento)}</div>
          `}
          ${datas.map((f) => html`
            <div key=${f.id}>${f.texto}${idadeRotulo(f.quando) ? ` — ${idadeRotulo(f.quando)}` : ''}</div>
          `)}
        </div>
      `}

      ${notas.length > 0 && html`
        <div class="bloco">
          <div class="rotulo">O que eu sei</div>
          ${notas.map((f) => html`<div key=${f.id}>• ${f.texto}</div>`)}
        </div>
      `}

      ${abertos.length > 0 && html`
        <div class="bloco">
          <div class="rotulo">Não esquecer</div>
          ${abertos.map((f) => html`
            <div key=${f.id}>${ICONES_TIPO[f.tipo]} ${f.texto}</div>
          `)}
        </div>
      `}
    <//>

    <div class="acoes">
      <button class="btn cheio" onClick=${() => ir(`#/registrar?p=${id}`)}>registrar o que rolou</button>
      <button class="btn" onClick=${() => ir(`#/pessoa/${id}`)}>ficha completa</button>
    </div>
  `;
}
