import { defineMiddleware } from 'astro:middleware';
import { supabaseDaRequisicao } from './lib/supabase';
import { podeEntrar } from './lib/permissao';

const ROTAS_PUBLICAS = ['/entrar', '/auth/callback'];

export const onRequest = defineMiddleware(async ({ request, cookies, locals, url, redirect }, next) => {
  locals.supabase = supabaseDaRequisicao(request, cookies);
  const { data } = await locals.supabase.auth.getUser();
  locals.usuario = data.user;

  // Sessão de quem não está na lista de e-mails permitidos não vale: é
  // encerrada aqui, em qualquer rota (inclusive a de consentimento do conector).
  if (locals.usuario && !podeEntrar(locals.usuario.email)) {
    await locals.supabase.auth.signOut();
    locals.usuario = null;
  }

  if (!locals.usuario && !ROTAS_PUBLICAS.includes(url.pathname)) {
    return redirect('/entrar');
  }
  return next();
});
