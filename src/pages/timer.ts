import type { APIRoute } from 'astro';
import { criarCompanheiro, SemTimerLigado, TimerJaLigado } from '../companheiro/companheiro';

// Ações do timer vindas dos botões da aba. Depois de qualquer ação, volta para
// a Trilha: a página sempre mostra o estado que está no servidor.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  const form = await request.formData();
  const acao = String(form.get('acao') ?? '');
  const trilhaId = String(form.get('trilha') ?? '');

  try {
    if (acao === 'iniciar') await companheiro.iniciarTimer('usuario', { trilhaId });
    else if (acao === 'pausar') await companheiro.pausarTimer('usuario');
    else if (acao === 'retomar') await companheiro.retomarTimer('usuario');
    else if (acao === 'encerrar')
      await companheiro.encerrarTimer('usuario', { nota: String(form.get('nota') ?? '') });
    else return new Response('Ação desconhecida.', { status: 400 });
  } catch (e) {
    // Outro aparelho chegou antes; a página recarregada mostra como ficou.
    if (!(e instanceof TimerJaLigado || e instanceof SemTimerLigado)) throw e;
  }

  return redirect(`/?trilha=${encodeURIComponent(trilhaId)}`, 303);
};
