import type { APIRoute } from 'astro';
import { podeEntrar } from '../lib/permissao';
import { atenderMcp } from '../mcp/http';

// Conector MCP do claude.ai (ADR 0002). Autentica pelo token Bearer, não pelo
// cookie do app; o middleware deixa esta rota passar, então a lista de
// e-mails permitidos é aplicada aqui também.
const atender: APIRoute = ({ request }) =>
  atenderMcp(request, {
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    emailPermitido: podeEntrar,
  });

export const POST = atender;
export const GET = atender;
export const DELETE = atender;
