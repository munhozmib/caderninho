# Caderninho

A memória das pessoas que importam. Sem telefone, sem e-mail, sem LinkedIn,
sem organograma — só quem é a pessoa, o que eu sei sobre ela e quando falamos.

Roda como site estático: sem build, sem `node_modules`, sem pipeline. Publicar
é dar `git push`. O banco é o Supabase (Postgres), e quem protege os dados é o
RLS, não a interface.

---

## Como está agora

O `config.js` já aponta para o projeto do Supabase, então o app abre pedindo
login. Se você apagar os dois valores de lá, ele volta ao modo local
(`localStorage`, quatro pessoas de exemplo, nada sai da máquina) — útil para
mexer no layout sem tocar nos dados de verdade.

Não existe meio-termo silencioso: se o `config.js` estiver preenchido e o
Supabase não subir, o app pára e diz isso, em vez de mostrar dados locais
fingindo que está na nuvem.

Para abrir aqui no PC:

```bash
python -m http.server 8123 --directory C:\Projetos\caderninho
```

E acessar `http://localhost:8123`.

---

## Ligando no Supabase — os cinco passos de amanhã

**1. Criar o schema.** No painel do Supabase: *SQL Editor* → *New query* → cole
o conteúdo de `schema.sql` → *Run*. No fim deve aparecer, nas mensagens:

```
RLS conferido: todas as tabelas de public estao protegidas.
Views conferidas: todas respeitam o RLS de quem consulta.
```

Se qualquer uma dessas linhas virar erro, **pare**: significa que alguma coisa
ficou aberta. O script falha de propósito em vez de deixar passar.

**2. Fechar o cadastro.** *Authentication* → *Sign In / Providers* → Email:
desligue **"Allow new users to sign up"**. Com isso, ninguém no mundo consegue
criar conta no seu projeto.

**3. Criar o seu usuário.** *Authentication* → *Users* → *Add user* → e-mail e
senha, marcando "Auto Confirm User". Esse é o único login que vai existir.

**4. Apontar o app.** Duas coisas, em duas páginas diferentes do *Settings*:

- *Integrations* → *Data API* → **Project URL**
  (é sempre `https://<ref>.supabase.co`, onde `<ref>` é aquele pedaço da URL do
  painel: `supabase.com/dashboard/project/<ref>/...`)
- *Configuration* → *API Keys* → **Publishable key**, a que começa com
  `sb_publishable_`

```js
export default {
  url: 'https://xxxxxxxx.supabase.co',
  chave: 'sb_publishable_...',
};
```

A publishable key é a sucessora da anon key — mesmo papel, mesmo nível de
privilégio. Ela é pública de propósito e **deve** ser commitada: sem ela o site
no Pages não funciona. Não dá acesso a nada sozinha — quem decide é o RLS.
A que nunca pode sair do painel é a **secret key** (`sb_secret_...`), que
ignora o RLS inteiro.

**5. Conferir que está fechado.**

```bash
python -I ferramentas/testar_rls.py
```

O script usa só a chave pública, sem login, e faz duas coisas: tenta ler as dez
tabelas e views, e tenta **inserir** uma pessoa. Tem que ser recusado nas duas
pontas. A escrita importa: ler zero linhas de uma tabela vazia não prova nada,
mas um insert recusado prova que o RLS está de pé mesmo sem dados para
esconder.

---

## Publicar no GitHub Pages

```bash
cd C:\Projetos\caderninho
git init && git add . && git commit -m "primeiro caderninho"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/caderninho.git
git push -u origin main
```

Depois, no GitHub: *Settings* → *Pages* → Source: `Deploy from a branch`,
branch `main`, pasta `/ (root)`. Em um ou dois minutos o app está em
`https://SEU-USUARIO.github.io/caderninho/`.

**No celular:** abra essa URL no Chrome → menu (⋮) → *Adicionar à tela inicial*.
Ele instala como app, abre em tela cheia e o login fica guardado — você entra
uma vez e pronto.

---

## O modelo de dados, em três ideias

**`pessoa`** é magra de propósito: nome, como você a chama, um `contexto` de
texto livre ("GECRM, CAIXA"), onde se conheceram, aniversário. Nada de
hierarquia: área e empresa mudam o tempo todo, e quem organiza isso são as
**tags**, que são planas, renomeáveis e funcionam igual para quem é de fora.

**`fato`** é o coração. Tudo que você sabe sobre alguém entra num fluxo só, com
três tipos:

| tipo | o que é | exemplo |
|---|---|---|
| `nota` | fato sem data | "casada com o Rafael, professor de história" |
| `data` | data que importa, repete todo ano | "Pedro, filho" + 05/12/2020 |
| `pendencia` | algo em aberto da minha parte | "prometi mandar o artigo", "perguntar do MBA" |

Datas guardam **a data**, nunca a idade — o app calcula "5 anos" na hora em que
você abre a ficha. Idade anotada à mão apodrece em doze meses e vira gafe.

**`interacao`** é a conversa, e ela é N:N: um almoço com três pessoas é um
registro só, ligado aos três.

---

## A tela que justifica o app

**Hoje** não é uma lista de cobranças. Ela mostra *razões* para procurar
alguém — uma data chegando, algo que ficou em aberto da última conversa.
Só no fim, discreto, vem o "faz muito tempo", com padrão de
**180 dias**: fraco de propósito, porque procurar gente sem motivo é o jeito
mais rápido de virar chato.

**Vou encontrar** é o cartão do Bush: antes do almoço, numa tela só, como vocês
se conheceram, o que ela contou da última vez, a família com as idades certas
de hoje, e o que você não pode esquecer.

---

## Estrutura

```
index.html          importmap + a casca
app.css             o design system inteiro (verde pastel)
config.js           url e anon key do Supabase (commitar)
schema.sql          Postgres: tabelas, views, auditoria, RLS, autotestes
sw.js               service worker: cacheia a casca, nunca os dados
js/
  main.js           rotas e navegação
  store.js          escolhe o adaptador
  supa.js           implementação Supabase
  local.js          implementação localStorage (com dados de exemplo)
  util.js           datas, idades, formatação
  ui.js             peças de interface
  telas/            hoje, pessoas, ficha, outras
vendor/             preact, htm e supabase-js como arquivos locais
  node-buffer.js    stub: o bundle do supabase pede o Buffer do Node
ferramentas/
  testar_rls.py     tenta vazar os dados e falha se conseguir
  gerar_icones.py   gera os PNGs do PWA
```

## Segurança, em uma linha cada

- Toda tabela tem `owner_id` e uma policy `owner_id = auth.uid()`.
- Toda view tem `security_invoker = true` — sem isso a view fura o RLS.
- O `schema.sql` se recusa a terminar se alguma tabela ou view escapar.
- O `audit_log` registra tudo e não tem policy de escrita: ninguém o edita.
- A anon key é pública. A service_role nunca entra no repositório.
