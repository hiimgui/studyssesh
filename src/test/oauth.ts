import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inject } from 'vitest';

const REDIRECT = 'http://localhost/callback';

// O fluxo OAuth do conector, como o claude.ai faz, contra o servidor OAuth do
// Supabase local: registro dinâmico do cliente, authorize com PKCE, o
// consentimento do usuário (o que a página /oauth/consentimento faz) e a
// troca do código pelo access token.
export async function tokenDoConector(usuario: SupabaseClient): Promise<string> {
  const auth = `${inject('supabase').url}/auth/v1`;

  const registro = await fetch(`${auth}/oauth/clients/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Claude',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
    }),
  });
  const { client_id: clientId } = await registro.json();

  const verificador = randomBytes(32).toString('base64url');
  const desafio = createHash('sha256').update(verificador).digest('base64url');
  const autorizar = await fetch(
    `${auth}/oauth/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT,
      code_challenge: desafio,
      code_challenge_method: 'S256',
      state: 'teste',
    })}`,
    { redirect: 'manual' },
  );
  const consentimento = new URL(autorizar.headers.get('Location')!);
  const autorizacaoId = consentimento.searchParams.get('authorization_id')!;

  const detalhes = await usuario.auth.oauth.getAuthorizationDetails(autorizacaoId);
  if (detalhes.error) throw detalhes.error;
  const aprovado = await usuario.auth.oauth.approveAuthorization(autorizacaoId, {
    skipBrowserRedirect: true,
  });
  if (aprovado.error) throw aprovado.error;
  const codigo = new URL(aprovado.data.redirect_url).searchParams.get('code')!;

  const troca = await fetch(`${auth}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: codigo,
      redirect_uri: REDIRECT,
      client_id: clientId,
      code_verifier: verificador,
    }),
  });
  const corpo = await troca.json();
  if (!corpo.access_token) throw new Error(`Troca do código falhou: ${JSON.stringify(corpo)}`);
  return corpo.access_token;
}
