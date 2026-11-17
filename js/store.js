// Escolhe o adaptador: Supabase se houver config.js, senão o modo local.
// O resto do app nunca sabe qual dos dois está rodando.

import { adaptadorLocal } from './local.js';

let loja = adaptadorLocal;
let motivoLocal = 'config.js ausente';

export async function iniciarLoja() {
  let cfg = null;
  try {
    cfg = (await import('../config.js')).default;
  } catch {
    return loja; // sem config.js → modo local, sem drama
  }

  if (!cfg?.url || !cfg?.chave) {
    motivoLocal = 'config.js incompleto';
    return loja;
  }

  try {
    const { criarAdaptadorSupabase } = await import('./supa.js');
    loja = criarAdaptadorSupabase(cfg);
  } catch (e) {
    motivoLocal = `falha ao carregar o Supabase: ${e.message}`;
  }
  return loja;
}

export const store = new Proxy(
  {},
  {
    get(_alvo, prop) {
      if (prop === 'modo') return loja.modo;
      if (prop === 'motivoLocal') return motivoLocal;
      const v = loja[prop];
      return typeof v === 'function' ? v.bind(loja) : v;
    },
  }
);
