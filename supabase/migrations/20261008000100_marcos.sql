-- Marco: patamar de horas acumuladas numa Trilha (10, 25, 50, 100h e depois a
-- cada 100h). Os Marcos saem das Sessões; aqui só fica guardado o último que o
-- usuário já viu celebrado, para a celebração aparecer uma vez só, em qualquer
-- aparelho, mesmo quando a Sessão vier do chat.
alter table public.trilhas
  add column marco_celebrado_horas integer not null default 0
    check (marco_celebrado_horas >= 0);

-- A política de update do dono veio com o arquivamento (20261008000000) e vale
-- para a Trilha inteira; o que cada coluna permite fica nos grants. Uma segunda
-- política igual só dispararia o aviso de políticas permissivas repetidas, então
-- ela ganha um nome que serve às duas colunas.
alter policy "dono arquiva as próprias Trilhas" on public.trilhas
  rename to "dono atualiza as próprias Trilhas";

grant update (marco_celebrado_horas) on public.trilhas to authenticated;

-- Dias estudados no mês e totais leem as Sessões do dono por início.
create index sessoes_dono_inicio_idx on public.sessoes (dono, inicio);
