// Supabase → Settings:
//   Integrations → Data API ....... Project URL
//   Configuration → API Keys ...... Publishable key (sb_publishable_...)
//
// A publishable key é a sucessora da anon key: pública de propósito, ela só
// identifica o projeto. Quem decide o que pode ser lido ou escrito é o RLS, no
// banco. NUNCA ponha aqui a secret key (sb_secret_...): ela ignora o RLS.
//
// Enquanto estiver em branco, o app roda em modo local (localStorage).

export default {
  url: 'https://wdbkeznskbjulovcegun.supabase.co',
  chave: 'sb_publishable_UqVyFJ2KqZPfKiVXtOpDMg_hTdq26PO',
};
