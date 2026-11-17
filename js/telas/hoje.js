// Hoje — razões para procurar alguém. Não é uma lista de cobranças:
// é o que mudou na vida das pessoas e o que eu deixei em aberto.

import { useState } from 'preact/hooks';
import { html, Card, Chip, Vazio, Carregando, Erro, useDados, ir } from '../ui.js';
import { store } from '../store.js';
import { emDias, tempoRelativo, dCurto, hojeISO } from '../util.js';

export function Hoje() {
  const [frioAberto, setFrioAberto] = useState(false);

  const { dados, carregando, erro, recarregar } = useDados(async () => {
    const [agenda, abertos, frios, cfg] = await Promise.all([
      store.agenda(),
      store.abertos(),
      store.frios(),
      store.obterConfig(),
    ]);
    return { agenda, abertos, frios, cfg };
  });

  if (carregando) return html`<${Carregando} />`;
  if (erro) return html`<${Erro}>${erro}<//>`;

  const { agenda, abertos, frios, cfg } = dados;
  const pendencias = abertos.filter((f) => f.tipo === 'pendencia');
  const ganchos = abertos.filter((f) => f.tipo === 'gancho');
  const nada = !agenda.length && !abertos.length;

  const falei = async (pessoaId) => {
    await store.registrarInteracao({
      quando: hojeISO(), canal: 'conversa', resumo: null, pessoaIds: [pessoaId],
    });
    recarregar();
  };

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return html`
    <h2 class="tela">Hoje</h2>
    <p class="legenda">${hoje}</p>

    ${nada && html`
      <${Card}>
        <${Vazio}>
          Nada chamando por você hoje. Isso é bom — procurar alguém sem motivo
          é o jeito mais rápido de virar chato.
        <//>
      <//>
    `}

    ${agenda.length > 0 && html`
      <${Card} titulo="Datas chegando">
        ${agenda.map((a) => html`
          <div class="razao" key=${a.pessoa_id + a.rotulo}>
            <div class="selo">🎂</div>
            <div class="corpo">
              <a class="nome" href=${`#/pessoa/${a.pessoa_id}`}>${a.pessoa}</a>
              <p>
                ${a.rotulo} · ${dCurto(a.proxima)} · <strong>${emDias(a.dias)}</strong>
                ${a.faz_anos !== null && a.faz_anos !== undefined
                  ? html` · faz ${a.faz_anos} anos`
                  : null}
              </p>
            </div>
          </div>
        `)}
      <//>
    `}

    ${pendencias.length > 0 && html`
      <${Card} titulo="Eu devo">
        ${pendencias.map((f) => html`
          <div class="razao" key=${f.id}>
            <div class="selo">↩</div>
            <div class="corpo">
              <a class="nome" href=${`#/pessoa/${f.pessoa.id}`}>${f.pessoa.nome}</a>
              <p>${f.texto}</p>
              <div class="acoes">
                <button class="btn pequeno" onClick=${async () => { await store.alternarFato(f.id); recarregar(); }}>
                  resolvi
                </button>
              </div>
            </div>
          </div>
        `)}
      <//>
    `}

    ${ganchos.length > 0 && html`
      <${Card} titulo="Ganchos de conversa">
        ${ganchos.map((f) => html`
          <div class="razao" key=${f.id}>
            <div class="selo">💡</div>
            <div class="corpo">
              <a class="nome" href=${`#/pessoa/${f.pessoa.id}`}>${f.pessoa.nome}</a>
              <p>${f.texto}</p>
              <div class="acoes">
                <button class="btn pequeno" onClick=${() => ir(`#/registrar?p=${f.pessoa.id}`)}>
                  registrar conversa
                </button>
                <button class="btn pequeno" onClick=${async () => { await store.alternarFato(f.id); recarregar(); }}>
                  já usei
                </button>
              </div>
            </div>
          </div>
        `)}
      <//>
    `}

    ${frios.length > 0 && html`
      <${Card} titulo=${`Faz muito tempo (${frios.length})`}>
        <p class="sub" style="margin:-4px 0 10px">
          Mais de ${cfg.cadencia_padrao_dias} dias sem conversa. Sem pressa: só procure
          quem você tem um motivo de verdade para procurar.
        </p>
        ${(frioAberto ? frios : frios.slice(0, 3)).map((p) => html`
          <div class="razao" key=${p.id}>
            <div class="selo" style="background:var(--cinza-bg)">⏳</div>
            <div class="corpo">
              <a class="nome" href=${`#/pessoa/${p.id}`}>${p.nome}</a>
              <p>
                ${p.contexto ? `${p.contexto} · ` : ''}
                última conversa ${tempoRelativo(p.dias_desde)}
              </p>
              <div class="acoes">
                <button class="btn pequeno" onClick=${() => falei(p.id)}>falei hoje</button>
                <button class="btn pequeno" onClick=${() => ir(`#/encontro/${p.id}`)}>relembrar</button>
              </div>
            </div>
          </div>
        `)}
        ${frios.length > 3 && html`
          <div class="acoes">
            <button class="btn pequeno" onClick=${() => setFrioAberto(!frioAberto)}>
              ${frioAberto ? 'mostrar menos' : `ver os outros ${frios.length - 3}`}
            </button>
          </div>
        `}
      <//>
    `}
  `;
}
