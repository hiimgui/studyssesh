import type { APIRoute } from 'astro';
import { atenderMcp } from '../mcp/http';

// Conector MCP do claude.ai (ADR 0002). Autentica pelo token Bearer, não pelo
// cookie do app; o middleware deixa esta rota passar.
const atender: APIRoute = ({ request }) =>
  atenderMcp(request, {
    supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  });

export const POST = atender;
export const GET = atender;
export const DELETE = atender;
