import type { APIRoute } from 'astro';
import { criarCompanheiro, EntradaInvalida, type Motivo } from '../companheiro/companheiro';
import { caminhoDeVolta } from '../lib/supabase';

// Aceitar ou recusar (com Motivo) uma Recomendação de um Resumo. Volta para a
// Recomendação respondida.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  const form = await request.formData();
  const recomendacaoId = String(form.get('recomendacao') ?? '');
  const motivo = String(form.get('motivo') ?? '');

  try {
    await companheiro.decidirRecomendacao(
      'usuario',
      form.get('resposta') === 'aceita'
        ? { recomendacaoId, resposta: 'aceita' }
        : { recomendacaoId, resposta: 'recusada', motivo: motivo as Motivo },
    );
  } catch (e) {
    // Já respondida noutro aparelho: a página mostra a resposta que valeu.
    if (!(e instanceof EntradaInvalida)) throw e;
  }
  return redirect(caminhoDeVolta(String(form.get('voltar') ?? '')), 303);
};
