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
