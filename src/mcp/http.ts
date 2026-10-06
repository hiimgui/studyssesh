import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { criarCompanheiro } from '../companheiro/companheiro';
import { autenticarMcp, type ConfigSupabase } from './autenticacao';
import { criarServidorMcp } from './servidor';

// Atende uma requisição ao /mcp (Streamable HTTP, sem sessão: cada requisição
// monta seu servidor, o que combina com funções serverless na Vercel).
export async function atenderMcp(request: Request, config: ConfigSupabase): Promise<Response> {
  const supabase = await autenticarMcp(request, config);
  if (!supabase) {
    return new Response('Autenticação necessária.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
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
