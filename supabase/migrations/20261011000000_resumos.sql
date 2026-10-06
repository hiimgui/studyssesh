-- Resumo: a análise semanal do Claude por Trilha, cobrindo uma semana de
-- segunda a domingo (America/Sao_Paulo). Fica guardado numa linha do tempo e
-- nunca é editado nem apagado (ADR 0002): só há leitura e criação.
create table public.resumos (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trilha_id uuid not null references public.trilhas (id) on delete cascade,
  semana_de date not null,
  semana_ate date not null check (semana_ate = semana_de + 6),
  texto text not null check (length(btrim(texto)) > 0),
  -- Fontes confiáveis em que o Resumo se apoia: [{ "titulo": ..., "url": ... }].
  fontes jsonb not null check (jsonb_typeof(fontes) = 'array'),
  gerado_em timestamptz not null
);

create index resumos_trilha_idx on public.resumos (trilha_id, gerado_em desc);
create index resumos_dono_idx on public.resumos (dono);

-- Recomendação: proposta concreta dentro de um Resumo, sempre ligada a um
-- Objetivo da mesma Trilha. Aceitar ou recusar (Decisão) chega na #11.
create table public.recomendacoes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resumo_id uuid not null references public.resumos (id) on delete cascade,
  objetivo_id uuid not null references public.objetivos (id) on delete cascade,
  posicao smallint not null,
  tipo text not null check (tipo in ('projeto', 'roteiro', 'deck', 'material')),
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text not null,
  url text,
  unique (resumo_id, posicao)
);

create index recomendacoes_dono_idx on public.recomendacoes (dono);
create index recomendacoes_objetivo_idx on public.recomendacoes (objetivo_id);

alter table public.resumos enable row level security;
alter table public.recomendacoes enable row level security;

create policy "dono lê os próprios Resumos" on public.resumos
  for select to authenticated
  using (dono = (select auth.uid()));

-- A FK não passa pelo RLS: a Trilha precisa ser do dono.
create policy "dono cria Resumos nas próprias Trilhas" on public.resumos
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (select 1 from public.trilhas t where t.id = trilha_id and t.dono = (select auth.uid()))
  );

create policy "dono lê as próprias Recomendações" on public.recomendacoes
  for select to authenticated
  using (dono = (select auth.uid()));

-- O Resumo e o Objetivo precisam ser do dono e da mesma Trilha.
create policy "dono cria Recomendações nos próprios Resumos" on public.recomendacoes
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (
      select 1
      from public.resumos r
      join public.objetivos o on o.trilha_id = r.trilha_id
      where r.id = resumo_id
        and o.id = objetivo_id
        and r.dono = (select auth.uid())
        and o.dono = (select auth.uid())
    )
  );

revoke all on public.resumos from anon, authenticated;
revoke all on public.recomendacoes from anon, authenticated;
grant select, insert on public.resumos to authenticated;
grant select, insert on public.recomendacoes to authenticated;

-- Grava o Resumo e as Recomendações numa transação só. As regras ficam no
-- Companheiro; aqui é só persistência. Roda com as permissões de quem chama.
create function public.criar_resumo(
  p_trilha uuid,
  p_semana_de date,
  p_texto text,
  p_fontes jsonb,
  p_gerado_em timestamptz,
  p_recomendacoes jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resumo uuid;
begin
  insert into public.resumos (trilha_id, semana_de, semana_ate, texto, fontes, gerado_em)
  values (p_trilha, p_semana_de, p_semana_de + 6, p_texto, p_fontes, p_gerado_em)
  returning id into v_resumo;

  insert into public.recomendacoes (resumo_id, objetivo_id, posicao, tipo, titulo, descricao, url)
  select v_resumo, (r ->> 'objetivo_id')::uuid, (n - 1)::smallint, r ->> 'tipo', r ->> 'titulo',
         r ->> 'descricao', r ->> 'url'
  from jsonb_array_elements(p_recomendacoes) with ordinality as e (r, n);

  return v_resumo;
end;
$$;

revoke execute on function public.criar_resumo from public, anon;
grant execute on function public.criar_resumo to authenticated;
