-- Inatividade: 1h sem interação com o timer ligado pausa o timer sozinho.
-- A pausa é calculada pelo Companheiro a partir da última interação e gravada
-- na próxima ação do usuário; até a pessoa dizer até quando estudou, o timer
-- fica marcado como pausado por Inatividade.
alter table public.timers
  add column ultima_interacao_em timestamptz,
  add column pausado_por_inatividade boolean not null default false;

update public.timers set ultima_interacao_em = coalesce(pausado_em, iniciado_em);
alter table public.timers alter column ultima_interacao_em set not null;

grant update (ultima_interacao_em, pausado_por_inatividade) on public.timers to authenticated;
