-- Objetivo: algo que se quer alcançar numa Trilha. Por enquanto só o mensurável
-- (horas de estudo num período); o abstrato chega na issue #7.
create table public.objetivos (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trilha_id uuid not null references public.trilhas (id) on delete cascade,
  tipo text not null check (tipo = 'mensuravel'),
  meta_segundos integer not null check (meta_segundos > 0),
  -- Período em instantes, meio aberto: [periodo_inicio, periodo_fim). As
  -- meias-noites são as de America/Sao_Paulo, calculadas no Companheiro.
  periodo_inicio timestamptz not null,
  periodo_fim timestamptz not null check (periodo_fim > periodo_inicio),
  criado_em timestamptz not null,
  -- Preenchido quando a meta é batida.
  concluido_em timestamptz
);

create index objetivos_trilha_idx on public.objetivos (trilha_id, criado_em);

alter table public.objetivos enable row level security;

create policy "dono lê os próprios Objetivos" on public.objetivos
  for select to authenticated
  using (dono = (select auth.uid()));

-- A FK não passa pelo RLS: sem esta checagem, daria para criar Objetivo na
-- Trilha de outra pessoa sabendo o id.
create policy "dono cria Objetivos nas próprias Trilhas" on public.objetivos
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (select 1 from public.trilhas t where t.id = trilha_id and t.dono = (select auth.uid()))
  );

create policy "dono conclui os próprios Objetivos" on public.objetivos
  for update to authenticated
  using (dono = (select auth.uid()))
  with check (dono = (select auth.uid()));

revoke all on public.objetivos from anon, authenticated;
grant select, insert on public.objetivos to authenticated;
grant update (concluido_em) on public.objetivos to authenticated;
