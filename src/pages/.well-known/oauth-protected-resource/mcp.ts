import type { APIRoute } from 'astro';
import { metadadosDoRecurso } from '../../../mcp/http';

// Metadados do recurso /mcp (RFC 9728), no caminho com o recurso inserido.
export const GET: APIRoute = ({ request }) =>
  metadadosDoRecurso(request, {
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  });
