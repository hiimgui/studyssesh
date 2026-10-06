-- Índice para a FK timers.trilha_id (aviso INFO do advisor de performance):
-- sem ele, o "on delete cascade" de uma Trilha varre a tabela de timers.
create index timers_trilha_idx on public.timers (trilha_id);
