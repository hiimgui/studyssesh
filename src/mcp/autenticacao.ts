import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ConfigSupabase {
  supabaseUrl: string;
  supabaseAnonKey: string;
  // Quem pode usar o app (acesso restrito): a mesma regra do middleware, que o
  // /mcp não atravessa. Obrigatória, sem padrão que deixe passar. No app, é o
  // `podeEntrar` de src/lib/permissao.ts (lê EMAILS_PERMITIDOS do servidor).
  emailPermitido: (email: string) => boolean;
}

// Lê as claims de um JWT já validado pelo Supabase (getUser confere a
// assinatura e a sessão no servidor de Auth).
function claimsDe(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

// O único ponto que decide quem chama o /mcp. Só aceita o access token que o
// servidor OAuth 2.1 do Supabase emite para um conector (claim `client_id`),
// com a audiência de usuário logado. O token da sessão do app não serve. O
// client_id não é fixo: o claude.ai se registra sozinho (registro dinâmico),
// e o consentimento do usuário é o que autoriza cada conector. Devolve um
// cliente agindo como o dono do token (o RLS restringe tudo a ele), ou null.
export async function autenticarMcp(
  request: Request,
  { supabaseUrl, supabaseAnonKey, emailPermitido }: ConfigSupabase,
): Promise<SupabaseClient | null> {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const claims = claimsDe(token);
  if (typeof claims.client_id !== 'string' || claims.aud !== 'authenticated') return null;
  if (!emailPermitido(data.user.email)) return null;
  return supabase;
}
