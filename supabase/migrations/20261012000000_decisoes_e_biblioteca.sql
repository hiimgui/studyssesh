-- Decisão: a resposta a uma Recomendação, aceita ou recusada com um Motivo.
-- Uma por Recomendação, guardada para o Claude aprender as preferências; nunca
-- é editada nem apagada.
create table public.decisoes (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recomendacao_id uuid not null unique references public.recomendacoes (id) on delete cascade,
  resposta text not null check (resposta in ('aceita', 'recusada')),
  motivo text check (motivo in ('ja-sei', 'formato-nao-serve', 'agora-nao', 'fora-do-foco')),
  decidida_em timestamptz not null,
  -- Toda recusa tem Motivo; aceitar, não.
  check ((resposta = 'aceita') = (motivo is null))
);

create index decisoes_dono_idx on public.decisoes (dono);

-- Projeto aceito vira Objetivo abstrato, ligado ao Objetivo da Recomendação:
-- concluído, ele conta como item na barra daquele Objetivo.
alter table public.objetivos
  add column recomendacao_id uuid unique references public.recomendacoes (id) on delete cascade,
  add column projeto_de uuid references public.objetivos (id) on delete cascade,
  add constraint objetivos_projeto_check check ((recomendacao_id is null) = (projeto_de is null));

create index objetivos_projeto_de_idx on public.objetivos (projeto_de);

-- Biblioteca: os Decks e Materiais Extras aceitos numa Trilha. Título, tipo e
-- link vêm da Recomendação; aqui ficam a Trilha, o Objetivo ligado e o "feito".
create table public.itens_biblioteca (
  id uuid primary key default gen_random_uuid(),
  dono uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trilha_id uuid not null references public.trilhas (id) on delete cascade,
  recomendacao_id uuid not null unique references public.recomendacoes (id) on delete cascade,
  objetivo_id uuid not null references public.objetivos (id) on delete cascade,
  adicionado_em timestamptz not null,
  feito_em timestamptz
);

create index itens_biblioteca_trilha_idx on public.itens_biblioteca (trilha_id, adicionado_em);
create index itens_biblioteca_objetivo_idx on public.itens_biblioteca (objetivo_id);
create index itens_biblioteca_dono_idx on public.itens_biblioteca (dono);

alter table public.decisoes enable row level security;
alter table public.itens_biblioteca enable row level security;

create policy "dono lê as próprias Decisões" on public.decisoes
  for select to authenticated
  using (dono = (select auth.uid()));

-- A FK não passa pelo RLS: a Recomendação precisa ser do dono.
create policy "dono decide as próprias Recomendações" on public.decisoes
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (
      select 1 from public.recomendacoes r
      where r.id = recomendacao_id and r.dono = (select auth.uid())
    )
  );

create policy "dono lê a própria Biblioteca" on public.itens_biblioteca
  for select to authenticated
  using (dono = (select auth.uid()));

-- A Recomendação, a Trilha e o Objetivo precisam ser do dono e combinar entre si.
create policy "dono põe na própria Biblioteca" on public.itens_biblioteca
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (
      select 1
      from public.recomendacoes r
      join public.resumos s on s.id = r.resumo_id
      where r.id = recomendacao_id
        and r.objetivo_id = itens_biblioteca.objetivo_id
        and s.trilha_id = itens_biblioteca.trilha_id
        and r.dono = (select auth.uid())
    )
  );

create policy "dono marca itens da própria Biblioteca" on public.itens_biblioteca
  for update to authenticated
  using (dono = (select auth.uid()))
  with check (dono = (select auth.uid()));

revoke all on public.decisoes from anon, authenticated;
revoke all on public.itens_biblioteca from anon, authenticated;
grant select, insert on public.decisoes to authenticated;
grant select, insert on public.itens_biblioteca to authenticated;
grant update (feito_em) on public.itens_biblioteca to authenticated;

-- O Objetivo de um projeto precisa vir de uma Recomendação do dono, da mesma
-- Trilha, e apontar o Objetivo dela.
drop policy "dono cria Objetivos nas próprias Trilhas" on public.objetivos;
create policy "dono cria Objetivos nas próprias Trilhas" on public.objetivos
  for insert to authenticated
  with check (
    dono = (select auth.uid())
    and exists (select 1 from public.trilhas t where t.id = trilha_id and t.dono = (select auth.uid()))
    and (
      recomendacao_id is null
      or exists (
        select 1
        from public.recomendacoes r
        join public.resumos s on s.id = r.resumo_id
        where r.id = recomendacao_id
          and r.objetivo_id = projeto_de
          and s.trilha_id = objetivos.trilha_id
          and r.dono = (select auth.uid())
      )
    )
  );

-- Grava a Decisão e o que ela cria (o Objetivo do projeto ou o item da
-- Biblioteca) numa transação só. As regras ficam no Companheiro: aqui é só
-- persistência. Roda com as permissões de quem chama.
create function public.decidir_recomendacao(
  p_recomendacao uuid,
  p_resposta text,
  p_motivo text,
  p_decidida_em timestamptz,
  p_novo_objetivo text,
  p_para_biblioteca boolean
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trilha uuid;
  v_objetivo uuid;
begin
  select s.trilha_id, r.objetivo_id into v_trilha, v_objetivo
  from public.recomendacoes r
  join public.resumos s on s.id = r.resumo_id
  where r.id = p_recomendacao;

  insert into public.decisoes (recomendacao_id, resposta, motivo, decidida_em)
  values (p_recomendacao, p_resposta, p_motivo, p_decidida_em);

  if p_novo_objetivo is not null then
    insert into public.objetivos (trilha_id, tipo, descricao, criado_em, recomendacao_id, projeto_de)
    values (v_trilha, 'abstrato', p_novo_objetivo, p_decidida_em, p_recomendacao, v_objetivo);
  end if;

  if p_para_biblioteca then
    insert into public.itens_biblioteca (trilha_id, recomendacao_id, objetivo_id, adicionado_em)
    values (v_trilha, p_recomendacao, v_objetivo, p_decidida_em);
  end if;
end;
$$;

revoke execute on function public.decidir_recomendacao from public, anon;
grant execute on function public.decidir_recomendacao to authenticated;
