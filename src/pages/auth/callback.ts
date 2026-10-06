import type { APIRoute } from 'astro';
import { caminhoDeVolta, COOKIE_VOLTA } from '../../lib/supabase';

// Destino do magic link: troca o código pela sessão e volta para o app, ou
// para onde a pessoa ia antes de entrar (ex.: o consentimento do conector).
export const GET: APIRoute = async ({ url, locals, cookies, redirect }) => {
  const codigo = url.searchParams.get('code');
  if (codigo) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(codigo);
    if (!error) {
      const volta = caminhoDeVolta(cookies.get(COOKIE_VOLTA)?.value);
      cookies.delete(COOKIE_VOLTA, { path: '/' });
      return redirect(volta);
    }
  }
  return redirect('/entrar?erro=link');
};
