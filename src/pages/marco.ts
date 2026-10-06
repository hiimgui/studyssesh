import type { APIRoute } from 'astro';
import { criarCompanheiro, EntradaInvalida } from '../companheiro/companheiro';

// Dispensar a celebração de um Marco. Volta para onde a celebração apareceu.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  const form = await request.formData();
  const trilhaId = String(form.get('trilha') ?? '');
  const marco = Number(form.get('marco'));
  // Só caminhos do próprio app, para o campo não virar um redirecionamento aberto.
  const pedido = String(form.get('voltar') ?? '/');
  const voltar = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/';

  try {
    await companheiro.celebrarMarco('usuario', { trilhaId, marco });
  } catch (e) {
    // Outro aparelho já seguiu para o próximo Marco; a página mostra como ficou.
    if (!(e instanceof EntradaInvalida)) throw e;
  }
  return redirect(voltar, 303);
};
