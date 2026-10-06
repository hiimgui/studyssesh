import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

// Cliente do Supabase por requisição, com a sessão guardada em cookies.
// É isso que mantém o login entre recarregamentos e aparelhos.
export function supabaseDaRequisicao(request: Request, cookies: AstroCookies) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get('Cookie') ?? '').map(({ name, value }) => ({
            name,
            value: value ?? '',
          })),
        setAll: (lista) =>
          lista.forEach(({ name, value, options }) => cookies.set(name, value, options)),
      },
    },
  );
}

// Para onde voltar depois do login por magic link (só caminhos do próprio app).
export const COOKIE_VOLTA = 'aibou_volta';

export function caminhoDeVolta(valor: string | undefined): string {
  if (!valor || !valor.startsWith('/')) return '/';
  // "//host" e "/\host" levariam para fora do app.
  if (valor.startsWith('//') || valor.startsWith('/\\')) return '/';
  return valor;
}
