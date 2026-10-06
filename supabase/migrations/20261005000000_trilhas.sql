-- Trilha: um assunto de estudo. Cada usuário só enxerga as próprias (RLS).
create table public.trilhas (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (length(btrim(nome)) > 0),
  criada_em timestamptz not null
);

create index trilhas_dono_idx on public.trilhas (dono, criada_em);

alter table public.trilhas enable row level security;

create policy "dono lê as próprias Trilhas" on public.trilhas
  for select to authenticated
  using (dono = (select auth.uid()));

create policy "dono cria Trilhas para si" on public.trilhas
  for insert to authenticated
  with check (dono = (select auth.uid()));

revoke all on public.trilhas from anon, authenticated;
grant select, insert on public.trilhas to authenticated;
