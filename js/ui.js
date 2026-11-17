// Peças compartilhadas da interface.

import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import htm from 'htm';
import { iniciais } from './util.js';

export const html = htm.bind(h);

export function ir(rota) {
  location.hash = rota;
}

// Carrega dados assíncronos com estado de carregando/erro e um recarregar().
export function useDados(fn, deps = []) {
  const [estado, setEstado] = useState({ carregando: true, dados: null, erro: null });
  const [tique, setTique] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, carregando: true }));
    Promise.resolve(fn())
      .then((dados) => vivo && setEstado({ carregando: false, dados, erro: null }))
      .catch((erro) => vivo && setEstado({ carregando: false, dados: null, erro: erro.message }));
    return () => { vivo = false; };
    // eslint-disable-next-line
  }, [...deps, tique]);

  const recarregar = useCallback(() => setTique((t) => t + 1), []);
  return { ...estado, recarregar };
}

export const Card = ({ titulo, children, classe = '' }) => html`
  <section class="card ${classe}">
    ${titulo && html`<h3>${titulo}</h3>`}
    ${children}
  </section>
`;

export const Chip = ({ cor = '', children }) => html`<span class="chip ${cor}">${children}</span>`;

export const Avatar = ({ nome }) => html`<div class="avatar">${iniciais(nome)}</div>`;

export const Vazio = ({ children }) => html`<p class="vazio">${children}</p>`;

export const Carregando = () => html`<p class="carregando">carregando…</p>`;

export const Erro = ({ children }) => html`<div class="aviso">${children}</div>`;

export const Campo = ({ rotulo, dica, children }) => html`
  <div class="campo">
    ${rotulo && html`<label>${rotulo}</label>`}
    ${children}
    ${dica && html`<p class="dica">${dica}</p>`}
  </div>
`;

export const Texto = ({ valor, aoMudar, ...resto }) => html`
  <input value=${valor ?? ''} onInput=${(e) => aoMudar(e.target.value)} ...${resto} />
`;

export const Area = ({ valor, aoMudar, ...resto }) => html`
  <textarea onInput=${(e) => aoMudar(e.target.value)} ...${resto}>${valor ?? ''}</textarea>
`;

export const Interruptor = ({ marcado, aoMudar, children }) => html`
  <label class="switch">
    <input type="checkbox" checked=${!!marcado} onChange=${(e) => aoMudar(e.target.checked)} />
    <span>${children}</span>
  </label>
`;

export const CORES_TIPO = {
  nota: '',
  data: 'azul',
  pendencia: 'rosa',
  gancho: 'ambar',
};

export const ICONES_TIPO = {
  nota: '•',
  data: '🎂',
  pendencia: '↩',
  gancho: '💡',
};
