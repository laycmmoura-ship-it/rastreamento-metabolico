-- Preparações cadastradas pela nutricionista (ex.: pizza de frango com catupiry, tapioca, receitas da clínica).
-- Rodar uma vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Todo mundo pode LER (o app das pacientes usa no cálculo); só quem está na tabela "admins" pode cadastrar.

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
drop policy if exists "admin vê o próprio registro" on public.admins;
create policy "admin vê o próprio registro" on public.admins
  for select to authenticated using (user_id = auth.uid());
grant select on public.admins to authenticated;

create table if not exists public.preparacoes (
  id bigint generated always as identity primary key,
  nome text not null,
  sinonimos text[] not null default '{}',
  modo text not null default 'ingredientes' check (modo in ('ingredientes', 'rotulo')),
  ingredientes jsonb not null default '[]',   -- [{taco_id, nome, gramas}]
  rendimento_g numeric,                       -- peso da preparação pronta (modo ingredientes)
  medidas jsonb not null default '[]',        -- [{medida: "fatia média", gramas: 120}]
  kcal numeric not null,                      -- valores por 100 g da preparação pronta
  prot numeric not null,
  carbo numeric not null,
  gord numeric not null,
  fibra numeric,
  fonte text,
  atualizado_em timestamptz not null default now()
);
alter table public.preparacoes enable row level security;

drop policy if exists "todos leem" on public.preparacoes;
create policy "todos leem" on public.preparacoes
  for select to anon, authenticated using (true);

drop policy if exists "admin cadastra" on public.preparacoes;
create policy "admin cadastra" on public.preparacoes
  for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

grant select on public.preparacoes to anon, authenticated;
grant insert, update, delete on public.preparacoes to authenticated;

-- Depois de criar o seu usuário (Authentication → Users → Add user), rode SEPARADO,
-- trocando pelo seu e-mail (não deixe o e-mail salvo no GitHub):
-- insert into public.admins (user_id) select id from auth.users where email = 'SEU-EMAIL-AQUI';
