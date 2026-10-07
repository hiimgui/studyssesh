import type { APIRoute } from 'astro';
import { criarCompanheiro, EntradaInvalida } from '../companheiro/companheiro';

// Baixar um Deck da Biblioteca como .apkg, pronto para importar no Anki.
export const GET: APIRoute = async ({ url, locals }) => {
  const companheiro = criarCompanheiro({ supabase: locals.supabase });

  try {
    const { nomeDoArquivo, apkg } = await companheiro.baixarDeck('usuario', {
      itemId: url.searchParams.get('item') ?? '',
    });
    // filename* leva o nome com acentos; filename é a versão ASCII para quem não lê o outro.
    const ascii = nomeDoArquivo.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '');
    return new Response(apkg, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition':
          `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nomeDoArquivo)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    if (!(e instanceof EntradaInvalida)) throw e;
    return new Response(e.message, { status: 404 });
  }
};
