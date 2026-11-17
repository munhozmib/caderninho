// Escolhe o adaptador: Supabase se houver config.js, senão o modo local.
// O resto do app nunca sabe qual dos dois está rodando.

import { adaptadorLocal } from './local.js';

let loja = adaptadorLocal;
let motivoLocal = 'config.js ausente';
let falhaGrave = null; // config.js preenchido + Supabase que não sobe

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
    // Config apontando para o Supabase e o Supabase sem subir: cair no modo
    // local aqui seria mentir. O app pára e diz o que houve.
    falhaGrave = e.message || String(e);
    motivoLocal = `falha ao carregar o Supabase: ${falhaGrave}`;
  }
  return loja;
}

export const store = new Proxy(
  {},
  {
    get(_alvo, prop) {
      if (prop === 'modo') return loja.modo;
      if (prop === 'motivoLocal') return motivoLocal;
      if (prop === 'falhaGrave') return falhaGrave;
      const v = loja[prop];
      return typeof v === 'function' ? v.bind(loja) : v;
    },
  }
);
