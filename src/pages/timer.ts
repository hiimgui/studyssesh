import type { APIRoute } from 'astro';
import {
  criarCompanheiro,
  EntradaInvalida,
  SemTimerLigado,
  TimerJaLigado,
} from '../companheiro/companheiro';
import { horarioMaisRecente } from '../lib/hora';

// Ações do timer vindas dos botões da aba. Depois de qualquer ação, volta para
// a Trilha: a página sempre mostra o estado que está no servidor.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });
  const form = await request.formData();
  const acao = String(form.get('acao') ?? '');
  const trilhaId = String(form.get('trilha') ?? '');
  const voltar = `/?trilha=${encodeURIComponent(trilhaId)}`;

  try {
    if (acao === 'iniciar') await companheiro.iniciarTimer('usuario', { trilhaId });
    else if (acao === 'pausar') await companheiro.pausarTimer('usuario');
    else if (acao === 'retomar') await companheiro.retomarTimer('usuario');
    else if (acao === 'encerrar')
      await companheiro.encerrarTimer('usuario', { nota: String(form.get('nota') ?? '') });
    else if (acao === 'fim-do-estudo') {
      // Um toque manda o instante pronto; o campo de hora manda "HH:MM".
      const ate = form.get('ate')
        ? new Date(String(form.get('ate')))
        : horarioMaisRecente(String(form.get('hora') ?? ''), new Date());
      if (!ate || Number.isNaN(ate.getTime())) return redirect(`${voltar}&erro=fim`, 303);
      await companheiro.informarFimDoEstudo('usuario', { ate });
    } else return new Response('Ação desconhecida.', { status: 400 });
  } catch (e) {
    if (e instanceof EntradaInvalida && acao === 'fim-do-estudo') {
      return redirect(`${voltar}&erro=fim`, 303);
    }
    // Outro aparelho chegou antes; a página recarregada mostra como ficou.
    if (!(e instanceof TimerJaLigado || e instanceof SemTimerLigado)) throw e;
  }

  return redirect(voltar, 303);
};
