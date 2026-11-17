-- ============================================================
-- Caderninho — schema Postgres / Supabase
-- Princípio: menos é mais. Pessoa, fatos sobre ela, e conversas.
-- Sem telefone, sem e-mail, sem LinkedIn, sem hierarquia de unidades.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelas
-- ------------------------------------------------------------

create table if not exists pessoa (
    id            uuid primary key default gen_random_uuid(),
    owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
    nome          text not null,
    tratamento    text,                                   -- como ela gosta de ser chamada
    contexto      text,                                   -- "GECRM, CAIXA" / "Nubank, produto" — texto livre
    onde_conheci  text,
    nascimento    date,
    cultivo       boolean not null default true,          -- entra na roda de "faz tempo que não falo"
    cadencia_dias int,                                    -- null = usa o padrão global
    arquivado     boolean not null default false,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

-- O coração do caderninho: tudo que eu sei sobre a pessoa, num fluxo só.
-- 'nota'      — fato sem data ("torce pro Palmeiras", "esposa Carla")
-- 'data'      — data que importa ("Helena, filha" + 12/03/2019 → o app calcula a idade)
-- 'pendencia' — eu devo algo ("prometi mandar o artigo")
-- 'gancho'    — razão para procurar ("ia prestar concurso em março")
create table if not exists fato (
    id           uuid primary key default gen_random_uuid(),
    owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    pessoa_id    uuid not null references pessoa(id) on delete cascade,
    tipo         text not null check (tipo in ('nota','data','pendencia','gancho')),
    texto        text not null,
    quando       date,                                    -- data do fato / prazo da pendência
    anual        boolean not null default false,          -- repete todo ano (aniversários)
    resolvido_em date,                                    -- pendência ou gancho já resolvido
    criado_em    timestamptz not null default now()
);

create table if not exists interacao (
    id        uuid primary key default gen_random_uuid(),
    owner_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
    quando    date not null default current_date,
    canal     text,                                       -- almoço, café, ligação, mensagem, evento
    resumo    text,
    criado_em timestamptz not null default now()
);

-- Uma conversa pode envolver várias pessoas (um almoço com três).
create table if not exists interacao_pessoa (
    interacao_id uuid not null references interacao(id) on delete cascade,
    pessoa_id    uuid not null references pessoa(id) on delete cascade,
    owner_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    primary key (interacao_id, pessoa_id)
);

create table if not exists tag (
    id       uuid primary key default gen_random_uuid(),
    owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    nome     text not null,
    unique (owner_id, nome)
);

create table if not exists pessoa_tag (
    pessoa_id uuid not null references pessoa(id) on delete cascade,
    tag_id    uuid not null references tag(id) on delete cascade,
    owner_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
    primary key (pessoa_id, tag_id)
);

create table if not exists config (
    owner_id             uuid primary key default auth.uid() references auth.users(id) on delete cascade,
    cadencia_padrao_dias int not null default 180,        -- o "faz muito tempo" é fraco de propósito
    janela_dias          int not null default 30          -- horizonte da agenda de datas
);

create table if not exists audit_log (
    id          bigint generated always as identity primary key,
    owner_id    uuid not null,
    tabela      text not null,
    registro_id uuid,
    acao        text not null check (acao in ('INSERT','UPDATE','DELETE')),
    antes       jsonb,
    depois      jsonb,
    origem      text not null default 'ui',
    quando      timestamptz not null default now()
);

create index if not exists idx_pessoa_owner     on pessoa(owner_id) where not arquivado;
create index if not exists idx_fato_pessoa      on fato(pessoa_id);
create index if not exists idx_fato_abertos     on fato(owner_id, tipo) where resolvido_em is null;
create index if not exists idx_ip_pessoa        on interacao_pessoa(pessoa_id);
create index if not exists idx_interacao_quando on interacao(owner_id, quando desc);
create index if not exists idx_audit_registro   on audit_log(tabela, registro_id);

-- ------------------------------------------------------------
-- 2. Funções de data
-- ------------------------------------------------------------

-- Próxima vez que essa data "acontece" (aniversários), tolerando 29/02.
create or replace function proxima_ocorrencia(d date, ref date default current_date)
returns date language plpgsql stable as $fn$
declare y int; cand date;
begin
    if d is null then return null; end if;
    y := extract(year from ref)::int;
    begin
        cand := make_date(y, extract(month from d)::int, extract(day from d)::int);
    exception when others then cand := make_date(y, 2, 28);
    end;
    if cand < ref then
        begin
            cand := make_date(y + 1, extract(month from d)::int, extract(day from d)::int);
        exception when others then cand := make_date(y + 1, 2, 28);
        end;
    end if;
    return cand;
end $fn$;

-- Idade em anos completos na data de referência.
create or replace function idade_em(d date, ref date default current_date)
returns int language sql stable as $fn$
    select case when d is null then null
                else extract(year from age(ref, d))::int end
$fn$;

-- ------------------------------------------------------------
-- 3. Views
-- ------------------------------------------------------------

-- ATENÇÃO: security_invoker é obrigatório. Sem isso a view roda com os
-- privilégios de quem a criou (postgres) e passa por cima do RLS — a armadilha
-- clássica do Supabase: tabelas protegidas, views abertas ao mundo.
drop view if exists v_pessoa;
drop view if exists v_agenda;

-- Pessoa + última conversa + quanto tempo faz + tags.
create view v_pessoa with (security_invoker = true) as
select
    p.*,
    u.ultima,
    case when u.ultima is null then null
         else (current_date - u.ultima) end                as dias_desde,
    coalesce(p.cadencia_dias, c.cadencia_padrao_dias, 180) as cadencia_efetiva,
    idade_em(p.nascimento)                                 as idade,
    coalesce(t.tags, array[]::text[])                      as tags,
    coalesce(a.abertos, 0)                                 as pendencias_abertas
from pessoa p
left join config c on c.owner_id = p.owner_id
left join lateral (
    select max(i.quando) as ultima
    from interacao_pessoa ip
    join interacao i on i.id = ip.interacao_id
    where ip.pessoa_id = p.id
) u on true
left join lateral (
    select array_agg(tg.nome order by tg.nome) as tags
    from pessoa_tag pt join tag tg on tg.id = pt.tag_id
    where pt.pessoa_id = p.id
) t on true
left join lateral (
    select count(*) as abertos
    from fato f
    where f.pessoa_id = p.id and f.tipo in ('pendencia','gancho') and f.resolvido_em is null
) a on true;

-- Toda data que vem aí: aniversário da pessoa + datas anuais dos fatos.
create view v_agenda with (security_invoker = true) as
select
    p.id                             as pessoa_id,
    p.owner_id,
    p.nome                           as pessoa,
    'Aniversário'                    as rotulo,
    p.nascimento                     as data_original,
    proxima_ocorrencia(p.nascimento) as proxima,
    (proxima_ocorrencia(p.nascimento) - current_date)        as dias,
    idade_em(p.nascimento, proxima_ocorrencia(p.nascimento)) as faz_anos
from pessoa p
where p.nascimento is not null and not p.arquivado
union all
select
    f.pessoa_id,
    f.owner_id,
    p.nome,
    f.texto,
    f.quando,
    proxima_ocorrencia(f.quando),
    (proxima_ocorrencia(f.quando) - current_date),
    idade_em(f.quando, proxima_ocorrencia(f.quando))
from fato f
join pessoa p on p.id = f.pessoa_id
where f.tipo = 'data' and f.anual and f.quando is not null and not p.arquivado;

-- ------------------------------------------------------------
-- 4. Auditoria — uma função genérica, nada de trigger por coluna
-- ------------------------------------------------------------

create or replace function registrar_auditoria()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
    linha jsonb;
    dono  uuid;
    reg   uuid;
begin
    linha := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    dono  := coalesce((linha ->> 'owner_id')::uuid, auth.uid());
    reg   := nullif(linha ->> 'id', '')::uuid;

    insert into audit_log (owner_id, tabela, registro_id, acao, antes, depois, origem)
    values (
        dono,
        tg_table_name,
        reg,
        tg_op,
        case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        case when tg_op = 'DELETE' then null else to_jsonb(new) end,
        coalesce(current_setting('app.origem', true), 'ui')
    );

    return case when tg_op = 'DELETE' then old else new end;
end $fn$;

do $blk$
declare t text;
begin
    foreach t in array array['pessoa','fato','interacao','interacao_pessoa','tag','pessoa_tag'] loop
        execute format('drop trigger if exists trg_audit_%1$s on %1$I', t);
        execute format(
            'create trigger trg_audit_%1$s after insert or update or delete on %1$I
             for each row execute function registrar_auditoria()', t);
    end loop;
end $blk$;

-- atualizado_em da pessoa
create or replace function tocar_atualizado_em()
returns trigger language plpgsql as $fn$
begin new.atualizado_em := now(); return new; end $fn$;

drop trigger if exists trg_pessoa_touch on pessoa;
create trigger trg_pessoa_touch before update on pessoa
for each row execute function tocar_atualizado_em();

-- ------------------------------------------------------------
-- 5. RLS — tudo fechado por padrão, dono só enxerga o que é dele
-- ------------------------------------------------------------

do $blk$
declare t text;
begin
    foreach t in array array['pessoa','fato','interacao','interacao_pessoa','tag','pessoa_tag','config'] loop
        execute format('alter table %I enable row level security', t);
        execute format('alter table %I force row level security', t);
        execute format('drop policy if exists dono_total on %I', t);
        execute format(
            'create policy dono_total on %I for all to authenticated
             using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
    end loop;
end $blk$;

alter table audit_log enable row level security;
alter table audit_log force row level security;
drop policy if exists dono_le on audit_log;
create policy dono_le on audit_log for select to authenticated
    using (owner_id = auth.uid());

-- O log não se edita: sem policy de insert/update/delete para o usuário.
-- Quem escreve nele é a função de auditoria, que roda como security definer.

-- ------------------------------------------------------------
-- 6. Teste de fumaça: nenhuma tabela pode ficar sem RLS
-- ------------------------------------------------------------

do $blk$
declare aberta text;
begin
    select string_agg(c.relname, ', ') into aberta
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

    if aberta is not null then
        raise exception 'TABELAS SEM RLS: %', aberta;
    end if;
    raise notice 'RLS conferido: todas as tabelas de public estao protegidas.';
end $blk$;

-- ... e nenhuma view pode esquecer o security_invoker
do $blk$
declare furada text;
begin
    select string_agg(c.relname, ', ') into furada
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and coalesce(
            (select option_value from pg_options_to_table(c.reloptions)
             where option_name = 'security_invoker'), 'false') <> 'true';

    if furada is not null then
        raise exception 'VIEWS SEM security_invoker (furam o RLS): %', furada;
    end if;
    raise notice 'Views conferidas: todas respeitam o RLS de quem consulta.';
end $blk$;
