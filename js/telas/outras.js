// Registrar conversa, ajustes e login.

import { useState } from 'preact/hooks';
import {
  html, Card, Chip, Vazio, Carregando, Erro, Campo, Texto, Area, useDados, ir,
} from '../ui.js';
import { store } from '../store.js';
import { hojeISO, CANAIS, semAcento } from '../util.js';

export function Registrar({ pessoaId }) {
  const { dados, carregando } = useDados(() => store.listarPessoas({}), []);
  const [sel, setSel] = useState(pessoaId ? [pessoaId] : []);
  const [quando, setQuando] = useState(hojeISO());
  const [canal, setCanal] = useState('conversa');
  const [resumo, setResumo] = useState('');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (carregando) return html`<${Carregando} />`;
  const pessoas = dados || [];

  const alternar = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);

  const salvar = async (e) => {
    e.preventDefault();
    if (!sel.length) return;
    setSalvando(true);
    try {
      await store.registrarInteracao({ quando, canal, resumo: resumo.trim() || null, pessoaIds: sel });
      ir(sel.length === 1 ? `#/pessoa/${sel[0]}` : '#/hoje');
    } catch (err) {
      alert(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const filtradas = busca
    ? pessoas.filter((p) => semAcento(p.nome).includes(semAcento(busca)))
    : pessoas;

  return html`
    <h2 class="tela">Registrar conversa</h2>
    <p class="legenda">O que ficou dessa conversa? É isso que você vai ler da próxima vez.</p>

    <form onSubmit=${salvar}>
      <${Card} titulo="Com quem">
        ${sel.length > 0 && html`
          <div class="chips" style="margin-bottom:10px">
            ${sel.map((id) => {
              const p = pessoas.find((x) => x.id === id);
              return html`<${Chip} key=${id} cor="verde">${p?.nome || '?'}<//>`;
            })}
          </div>
        `}
        <${Texto} valor=${busca} aoMudar=${setBusca} placeholder="buscar pessoa…" />
        <div style="max-height:220px;overflow:auto;margin-top:10px">
          ${filtradas.map((p) => html`
            <label class="switch" key=${p.id} style="cursor:pointer">
              <input type="checkbox" checked=${sel.includes(p.id)} onChange=${() => alternar(p.id)} />
              <span>${p.nome}<span class="sub"> · ${p.contexto || ''}</span></span>
            </label>
          `)}
          ${!filtradas.length && html`<${Vazio}>Ninguém encontrado.<//>`}
        </div>
      <//>

      <${Card}>
        <div class="linha2">
          <${Campo} rotulo="Quando">
            <input type="date" value=${quando} onInput=${(e) => setQuando(e.target.value)} />
          <//>
          <${Campo} rotulo="Como">
            <select value=${canal} onChange=${(e) => setCanal(e.target.value)}>
              ${CANAIS.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          <//>
        </div>
        <${Campo} rotulo="O que rolou" dica="Duas linhas bastam. O que ela contou, o que ficou no ar.">
          <${Area} valor=${resumo} aoMudar=${setResumo}
                   placeholder="Contou que mudou de área. Perguntou se eu conhecia alguém de dados." />
        <//>
      <//>

      <div class="acoes">
        <button class="btn cheio" type="submit" disabled=${salvando || !sel.length}>
          ${salvando ? 'salvando…' : 'registrar'}
        </button>
        <button class="btn" type="button" onClick=${() => history.back()}>cancelar</button>
      </div>
    </form>
  `;
}

export function Ajustes({ usuario, aoSair }) {
  const { dados, carregando, recarregar } = useDados(
    async () => ({ cfg: await store.obterConfig(), tags: await store.listarTags() }),
    []
  );
  const [cfg, setCfg] = useState(null);

  if (carregando) return html`<${Carregando} />`;
  const atual = cfg ?? dados.cfg;

  const salvar = async () => {
    await store.salvarConfig({
      cadencia_padrao_dias: Number(atual.cadencia_padrao_dias) || 180,
      janela_dias: Number(atual.janela_dias) || 30,
    });
    recarregar();
    setCfg(null);
  };

  return html`
    <h2 class="tela">Ajustes</h2>
    <p class="legenda">Poucos botões, de propósito.</p>

    <${Card} titulo="Ritmo">
      <${Campo} rotulo="Faz muito tempo depois de (dias)"
                dica="Isso não é uma meta. É só o ponto em que a pessoa reaparece na lista.">
        <input type="number" min="30" max="1095" value=${atual.cadencia_padrao_dias}
               onInput=${(e) => setCfg({ ...atual, cadencia_padrao_dias: e.target.value })} />
      <//>
      <${Campo} rotulo="Mostrar datas com quantos dias de antecedência">
        <input type="number" min="7" max="120" value=${atual.janela_dias}
               onInput=${(e) => setCfg({ ...atual, janela_dias: e.target.value })} />
      <//>
      <div class="acoes">
        <button class="btn cheio" onClick=${salvar} disabled=${!cfg}>salvar</button>
      </div>
    <//>

    <${Card} titulo=${`Tags (${dados.tags.length})`}>
      ${!dados.tags.length && html`<${Vazio}>Nenhuma tag ainda.<//>`}
      ${dados.tags.map((t) => html`
        <div class="fato" key=${t.id}>
          <span class="texto">${t.nome} <span class="sub">· ${t.uso}</span></span>
          <button class="btn pequeno" onClick=${async () => {
            const novo = prompt('Novo nome da tag:', t.nome);
            if (novo && novo.trim()) { await store.renomearTag(t.id, novo.trim()); recarregar(); }
          }}>renomear</button>
          <button class="btn pequeno perigo" onClick=${async () => {
            if (confirm(`Apagar a tag "${t.nome}"? As pessoas continuam, só perdem a marca.`)) {
              await store.excluirTag(t.id); recarregar();
            }
          }}>×</button>
        </div>
      `)}
    <//>

    <${Card} titulo="Conta">
      <p style="margin:0 0 4px">
        Modo: <strong>${store.modo === 'supabase' ? 'Supabase (na nuvem)' : 'local (só neste navegador)'}</strong>
      </p>
      ${usuario?.email && html`<p class="sub" style="margin:0">${usuario.email}</p>`}
      ${store.modo === 'local' && html`
        <p class="sub" style="margin:8px 0 0">
          Os dados vivem no localStorage deste navegador. Nada sai daqui — e nada chega
          de outro aparelho. Configure o config.js para sincronizar.
        </p>
      `}
      <div class="acoes">
        ${store.modo === 'supabase' && html`<button class="btn" onClick=${aoSair}>sair</button>`}
        ${store.modo === 'local' && html`
          <button class="btn perigo" onClick=${async () => {
            if (confirm('Recriar os dados de exemplo? O que você digitou neste navegador se perde.')) {
              await store.zerar(); location.reload();
            }
          }}>recomeçar com dados de exemplo</button>
        `}
      </div>
    <//>
  `;
}

export function Login({ aoEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [indo, setIndo] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setIndo(true);
    setErro(null);
    try {
      await store.entrar(email.trim(), senha);
      aoEntrar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setIndo(false);
    }
  };

  return html`
    <div class="login">
      <h2 class="tela">Caderninho</h2>
      <p class="legenda">A memória das pessoas que importam.</p>
      <form onSubmit=${enviar}>
        <${Card}>
          ${erro && html`<div class="aviso">${erro}</div>`}
          <${Campo} rotulo="E-mail">
            <input type="email" value=${email} autocomplete="username"
                   onInput=${(e) => setEmail(e.target.value)} />
          <//>
          <${Campo} rotulo="Senha">
            <input type="password" value=${senha} autocomplete="current-password"
                   onInput=${(e) => setSenha(e.target.value)} />
          <//>
          <div class="acoes">
            <button class="btn cheio" type="submit" disabled=${indo || !email || !senha}>
              ${indo ? 'entrando…' : 'entrar'}
            </button>
          </div>
        <//>
      </form>
    </div>
  `;
}
