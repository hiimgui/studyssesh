-- Objetivo abstrato: concluído por julgamento ("conseguir a certificação X").
-- Tem descrição e não tem meta de horas nem período.
alter table public.objetivos drop constraint objetivos_tipo_check;
alter table public.objetivos
  alter column meta_segundos drop not null,
  alter column periodo_inicio drop not null,
  alter column periodo_fim drop not null,
  add column descricao text,
  add constraint objetivos_tipo_check check (
    (tipo = 'mensuravel'
      and meta_segundos is not null and periodo_inicio is not null and periodo_fim is not null
      and descricao is null)
    or (tipo = 'abstrato'
      and descricao is not null and length(btrim(descricao)) > 0
      and meta_segundos is null and periodo_inicio is null and periodo_fim is null)
  );

-- Índice para a FK de dono (aviso de performance do advisor).
create index objetivos_dono_idx on public.objetivos (dono);

-- Trilha arquivada: sai das abas, mas continua consultável com todo o histórico.
alter table public.trilhas add column arquivada_em timestamptz;

create policy "dono arquiva as próprias Trilhas" on public.trilhas
  for update to authenticated
  using (dono = (select auth.uid()))
  with check (dono = (select auth.uid()));

grant update (arquivada_em) on public.trilhas to authenticated;
