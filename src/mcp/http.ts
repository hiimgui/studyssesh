import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { criarCompanheiro } from '../companheiro/companheiro';
import { autenticarMcp, type ConfigSupabase } from './autenticacao';
import { criarServidorMcp } from './servidor';

export const CAMINHO_DOS_METADADOS = '/.well-known/oauth-protected-resource/mcp';

// Atende uma requisição ao /mcp (Streamable HTTP, sem sessão: cada requisição
// monta seu servidor, o que combina com funções serverless na Vercel).
export async function atenderMcp(request: Request, config: ConfigSupabase): Promise<Response> {
  const supabase = await autenticarMcp(request, config);
  if (!supabase) {
    // O claude.ai segue resource_metadata para descobrir onde autorizar.
    const metadados = new URL(CAMINHO_DOS_METADADOS, request.url);
    return new Response('Autenticação necessária.', {
      status: 401,
      headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadados}"` },
    });
  }

  const servidor = criarServidorMcp(criarCompanheiro({ supabase }));
  const transporte = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await servidor.connect(transporte);
  return transporte.handleRequest(request);
}

// Metadados do recurso protegido (RFC 9728): o /mcp é autorizado pelo servidor
// OAuth 2.1 do Supabase Auth do projeto.
export function metadadosDoRecurso(
  request: Request,
  { supabaseUrl }: Pick<ConfigSupabase, 'supabaseUrl'>,
): Response {
  return Response.json({
    resource: new URL('/mcp', request.url).toString(),
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'Aibou',
  });
}
