import { defineMiddleware } from 'astro:middleware';
import { supabaseDaRequisicao } from './lib/supabase';

const ROTAS_PUBLICAS = ['/entrar', '/auth/callback'];

export const onRequest = defineMiddleware(async ({ request, cookies, locals, url, redirect }, next) => {
  locals.supabase = supabaseDaRequisicao(request, cookies);
  const { data } = await locals.supabase.auth.getUser();
  locals.usuario = data.user;

  if (!locals.usuario && !ROTAS_PUBLICAS.includes(url.pathname)) {
    return redirect('/entrar');
  }
  return next();
});
