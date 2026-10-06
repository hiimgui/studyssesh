import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ConfigSupabase {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// O único ponto que decide quem chama o /mcp. Aceita um access token do
// Supabase Auth no header Authorization (Bearer), que é o que o servidor
// OAuth 2.1 do Supabase emite para o conector. Devolve um cliente agindo
// como o dono do token (o RLS restringe tudo a ele), ou null.
//
// Pendente (decisão do usuário sobre a autenticação do conector): conferir
// o cliente OAuth e a audiência do token, e publicar os metadados do recurso
// protegido (RFC 9728) para o claude.ai descobrir onde autorizar.
export async function autenticarMcp(
  request: Request,
  { supabaseUrl, supabaseAnonKey }: ConfigSupabase,
): Promise<SupabaseClient | null> {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return supabase;
}
