-- De onde veio a Sessão: do timer do app ou do chat do Claude (estudo feito
-- longe do app, registrado com nota). As que já existem vieram do timer.
alter table public.sessoes
  add column origem text not null default 'timer' check (origem in ('timer', 'chat'));
