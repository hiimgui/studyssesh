import type { APIRoute } from 'astro';
import { metadadosDoRecurso } from '../../mcp/http';

// Os mesmos metadados no caminho sem o recurso, para clientes que procuram aqui.
export const GET: APIRoute = ({ request }) =>
  metadadosDoRecurso(request, {
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  });
