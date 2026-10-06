import { defineMiddleware } from 'astro:middleware';
import { COOKIE_VOLTA, supabaseDaRequisicao } from './lib/supabase';
import { podeEntrar } from './lib/permissao';

const ROTAS_PUBLICAS = ['/entrar', '/auth/callback'];
// Rotas que se autenticam sozinhas (por token, com a mesma lista de e-mails,
// em src/mcp/autenticacao.ts) ou são públicas por natureza (metadados OAuth),
// e não usam a sessão do app.
const ROTAS_SEM_SESSAO = ['/mcp', '/.well-known/'];

export const onRequest = defineMiddleware(async ({ request, cookies, locals, url, redirect }, next) => {
  if (ROTAS_SEM_SESSAO.some((r) => url.pathname === r || url.pathname.startsWith(r))) return next();

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
    // Depois do login, volta para onde ia (ex.: o consentimento do conector).
    if (request.method === 'GET' && url.pathname !== '/') {
      cookies.set(COOKIE_VOLTA, url.pathname + url.search, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: url.protocol === 'https:',
        maxAge: 30 * 60,
      });
    }
    return redirect('/entrar');
  }
  return next();
});
