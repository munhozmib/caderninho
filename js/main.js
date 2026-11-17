// Bootstrap, rotas e a casca do app.

import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { html, ir, Card } from './ui.js';
import { store, iniciarLoja } from './store.js';
import { Hoje } from './telas/hoje.js';
import { Pessoas, FormPessoa } from './telas/pessoas.js';
import { Ficha, Encontro } from './telas/ficha.js';
import { Registrar, Ajustes, Login } from './telas/outras.js';

function lerRota() {
  const bruto = location.hash.replace(/^#\/?/, '') || 'hoje';
  const [caminho, query] = bruto.split('?');
  const partes = caminho.split('/').filter(Boolean);
  const params = new URLSearchParams(query || '');
  return { tela: partes[0] || 'hoje', id: partes[1] || null, params };
}

function App() {
  const [rota, setRota] = useState(lerRota());
  const [busca, setBusca] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const aoMudar = () => {
      setRota(lerRota());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', aoMudar);
    return () => removeEventListener('hashchange', aoMudar);
  }, []);

  useEffect(() => {
    (async () => {
      await iniciarLoja();
      const s = await store.sessao();
      setUsuario(s.usuario);
      setPronto(true);
      if (store.aoMudarSessao) store.aoMudarSessao((u) => setUsuario(u));
    })();
  }, []);

  if (!pronto) return html`<p class="carregando">abrindo o caderninho…</p>`;

  if (store.falhaGrave) {
    return html`
      <div class="tela-erro">
        <h2 class="tela">Não consegui falar com o Supabase</h2>
        <${Card}>
          <p>
            O <code>config.js</code> aponta para um projeto, mas a biblioteca do
            Supabase não carregou. <strong>Nada foi lido nem salvo.</strong>
          </p>
          <p class="sub">${store.falhaGrave}</p>
          <p class="sub">
            Para voltar ao modo local de propósito, apague os valores do
            <code>config.js</code>. Assim você sabe em qual dos dois está.
          </p>
        <//>
      </div>
    `;
  }

  if (store.modo === 'supabase' && !usuario) {
    return html`<${Login} aoEntrar=${async () => setUsuario((await store.sessao()).usuario)} />`;
  }

  const { tela, id, params } = rota;

  const conteudo = (() => {
    switch (tela) {
      case 'pessoas':   return html`<${Pessoas} busca=${busca} />`;
      case 'pessoa':    return html`<${Ficha} id=${id} />`;
      case 'nova':      return html`<${FormPessoa} />`;
      case 'editar':    return html`<${FormPessoa} id=${id} />`;
      case 'encontro':  return html`<${Encontro} id=${id} />`;
      case 'registrar': return html`<${Registrar} pessoaId=${params.get('p')} />`;
      case 'ajustes':   return html`<${Ajustes} usuario=${usuario} aoSair=${async () => {
                          await store.sair(); setUsuario(null);
                        }} />`;
      default:          return html`<${Hoje} />`;
    }
  })();

  const abas = [
    { id: 'hoje', icone: '◉', texto: 'Hoje', destino: '#/hoje' },
    { id: 'pessoas', icone: '☰', texto: 'Pessoas', destino: '#/pessoas' },
    { id: 'registrar', icone: '✎', texto: 'Registrar', destino: '#/registrar' },
    { id: 'ajustes', icone: '⚙', texto: 'Ajustes', destino: '#/ajustes' },
  ];

  const mostrarBusca = ['pessoas'].includes(tela);
  const fab = tela === 'pessoas' || tela === 'hoje';

  return html`
    <header class="topo">
      <h1><span class="marca">✦</span> Caderninho</h1>
      ${mostrarBusca && html`
        <input class="busca" value=${busca} placeholder="Buscar pessoa, contexto…"
               onInput=${(e) => setBusca(e.target.value)} />
      `}
    </header>

    <main>${conteudo}</main>

    ${fab && html`
      <button class="flutuante" title="nova pessoa" onClick=${() => ir('#/nova')}>+</button>
    `}

    <nav class="rodape">
      ${abas.map((a) => html`
        <button key=${a.id} class=${tela === a.id ? 'ativo' : ''} onClick=${() => ir(a.destino)}>
          <span class="icone">${a.icone}</span>
          <span>${a.texto}</span>
        </button>
      `)}
    </nav>
  `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
