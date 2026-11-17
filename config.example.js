// Copie para config.js e preencha com os dados do SEU projeto.
// Supabase → Settings:
//   Integrations → Data API ....... Project URL
//   Configuration → API Keys ...... Publishable key (sb_publishable_...)
//
// A publishable key é a sucessora da anon key: pública de propósito, ela só
// identifica o projeto. Quem decide o que pode ser lido ou escrito é o RLS, no
// banco. NUNCA ponha aqui a secret key (sb_secret_...): ela ignora o RLS.

export default {
  url: 'https://SEU-PROJETO.supabase.co',
  chave: 'sb_publishable_COLE_AQUI',
};
