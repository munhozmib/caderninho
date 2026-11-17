// Stub do Buffer do Node.
//
// O bundle do supabase-js traz uma única importáção externa: o Buffer do Node,
// usado em UM lugar só — o toBase64 do Storage, que não usamos. O próprio
// código já testa `typeof Buffer` e cai no btoa() do navegador quando não
// existe. Exportar undefined faz exatamente isso acontecer, e nos livra de
// carregar um polyfill inteiro de Node num app que roda só no navegador.
//
// Se um dia você trocar o vendor/supabase.js por uma versão nova, confira se
// ela ainda importa "/node/buffer.mjs" e reaponte para cá.

export const Buffer = undefined;
