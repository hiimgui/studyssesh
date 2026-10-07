-- Cartas de um Deck: o Claude as grava na Recomendação, e o app gera o .apkg
-- no download. [{ "frente": ..., "verso": ... }], na ordem de estudo. Só Deck
-- tem cartas; Decks gravados antes desta migration ficam sem (null).
alter table public.recomendacoes
  add column cartas jsonb,
  add constraint recomendacoes_cartas_check check (
    cartas is null
    or (tipo = 'deck' and jsonb_typeof(cartas) = 'array' and jsonb_array_length(cartas) > 0)
  );

-- Mesma função, agora gravando as cartas. As regras ficam no Companheiro.
create or replace function public.criar_resumo(
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

  insert into public.recomendacoes (resumo_id, objetivo_id, posicao, tipo, titulo, descricao, url, cartas)
  select v_resumo, (r ->> 'objetivo_id')::uuid, (n - 1)::smallint, r ->> 'tipo', r ->> 'titulo',
         r ->> 'descricao', r ->> 'url', nullif(r -> 'cartas', 'null'::jsonb)
  from jsonb_array_elements(p_recomendacoes) with ordinality as e (r, n);

  return v_resumo;
end;
$$;
