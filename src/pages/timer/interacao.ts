import type { APIRoute } from 'astro';
import { criarCompanheiro } from '../../companheiro/companheiro';

// Sinal de vida da página: o usuário mexeu no app. Responde como o timer
// ficou, para a página recarregar se a Inatividade já o tiver pausado.
export const POST: APIRoute = async ({ locals }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  await companheiro.registrarInteracao('usuario');
  const timer = await companheiro.timerLigado('usuario');
  return Response.json({
    ligado: timer !== null,
    pausado: timer?.pausado ?? false,
    pausadoPorInatividade: timer?.pausadoPorInatividade ?? false,
  });
};
