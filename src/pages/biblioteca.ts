import type { APIRoute } from 'astro';
import { criarCompanheiro, EntradaInvalida } from '../companheiro/companheiro';
import { caminhoDeVolta } from '../lib/supabase';

// Marcar ou desmarcar um item da Biblioteca como feito. Volta para o item.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  const form = await request.formData();

  try {
    await companheiro.marcarItemFeito('usuario', {
      itemId: String(form.get('item') ?? ''),
      feito: form.get('feito') === 'sim',
    });
  } catch (e) {
    if (!(e instanceof EntradaInvalida)) throw e;
  }
  return redirect(caminhoDeVolta(String(form.get('voltar') ?? '')), 303);
};
