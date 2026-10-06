import type { APIRoute } from 'astro';

// Destino do magic link: troca o código pela sessão e volta para o app.
export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const codigo = url.searchParams.get('code');
  if (codigo) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return redirect('/');
  }
  return redirect('/entrar?erro=link');
};
