-- Timer: o estudo em andamento numa Trilha. Vive no servidor para sobreviver a
-- recarregamentos e trocas de aparelho. Um por usuário, em todas as Trilhas.
create table public.timers (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  trilha_id uuid not null references public.trilhas (id) on delete cascade,
  iniciado_em timestamptz not null,
  -- Preenchido enquanto o timer está pausado.
  pausado_em timestamptz,
  -- Soma das pausas já retomadas, descontada da duração da Sessão.
  tempo_pausado_ms bigint not null default 0 check (tempo_pausado_ms >= 0)
);

-- Sessão: um período de estudo encerrado numa Trilha.
create table public.sessoes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trilha_id uuid not null references public.trilhas (id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null check (fim >= inicio),
  duracao_segundos integer not null check (duracao_segundos >= 0),
  nota text
);

create index sessoes_trilha_idx on public.sessoes (trilha_id, inicio desc);

alter table public.timers enable row level security;
alter table public.sessoes enable row level security;

create policy "dono lê o próprio timer" on public.timers
  for select to authenticated
  using (dono = (select auth.uid()));

-- A FK não passa pelo RLS: sem esta checagem, daria para ligar um timer na
-- Trilha de outra pessoa sabendo o id.
create policy "dono liga timer nas próprias Trilhas" on public.timers
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (select 1 from public.trilhas t where t.id = trilha_id and t.dono = (select auth.uid()))
  );

create policy "dono pausa e retoma o próprio timer" on public.timers
  for update to authenticated
  using (dono = (select auth.uid()))
  with check (dono = (select auth.uid()));

create policy "dono desliga o próprio timer" on public.timers
  for delete to authenticated
  using (dono = (select auth.uid()));

create policy "dono lê as próprias Sessões" on public.sessoes
  for select to authenticated
  using (dono = (select auth.uid()));

create policy "dono cria Sessões nas próprias Trilhas" on public.sessoes
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (select 1 from public.trilhas t where t.id = trilha_id and t.dono = (select auth.uid()))
  );

revoke all on public.timers from anon, authenticated;
revoke all on public.sessoes from anon, authenticated;
grant select, insert, delete on public.timers to authenticated;
grant update (pausado_em, tempo_pausado_ms) on public.timers to authenticated;
grant select, insert on public.sessoes to authenticated;

-- Desliga o timer e grava a Sessão numa transação só, para que um encerramento
-- não perca a Sessão nem a grave duas vezes. As contas ficam no Companheiro;
-- aqui é só persistência. Roda com as permissões de quem chama (RLS vale).
create function public.encerrar_timer(
  p_timer uuid,
  p_fim timestamptz,
  p_duracao_segundos integer,
  p_nota text
) returns public.sessoes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_timer public.timers;
  v_sessao public.sessoes;
begin
  delete from public.timers where id = p_timer returning * into v_timer;
  if v_timer.id is null then
    raise exception 'timer já encerrado' using errcode = 'P0002';
  end if;

  insert into public.sessoes (trilha_id, inicio, fim, duracao_segundos, nota)
  values (v_timer.trilha_id, v_timer.iniciado_em, p_fim, p_duracao_segundos, p_nota)
  returning * into v_sessao;
  return v_sessao;
end;
$$;

revoke execute on function public.encerrar_timer from public, anon;
grant execute on function public.encerrar_timer to authenticated;
