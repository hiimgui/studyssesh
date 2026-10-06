// O /mcp de ponta a ponta, sem o servidor do Astro: requisição HTTP de
// verdade, token OAuth de verdade (fluxo completo no Supabase local) e
// Postgres de verdade.
import { describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { criarCompanheiro } from '../companheiro/companheiro';
import { emailPermitido } from '../lib/acesso';
import { tokenDoConector } from '../test/oauth';
import { novoUsuario } from '../test/usuarios';
import { atenderMcp, metadadosDoRecurso } from './http';

// A regra de acesso do app (src/lib/acesso.ts): sem lista, aberta fora de
// produção, como nos testes; com lista, só os e-mails dela.
const acesso =
  (lista: string | undefined, producao = false) =>
  (email: string) =>
    emailPermitido(email, lista, { producao });

const config = (extra = {}) => {
  const { url, anonKey } = inject('supabase');
  return { supabaseUrl: url, supabaseAnonKey: anonKey, emailPermitido: acesso(undefined), ...extra };
};

const chamada = (corpo: unknown, token?: string) =>
  new Request('https://aibou.test/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });

const LISTA = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const INICIALIZAR = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'teste', version: '1.0.0' },
  },
};

describe('/mcp', () => {
  it('sem token, ou com token inválido, responde 401 apontando os metadados do recurso', async () => {
    for (const token of [undefined, 'nao-e-um-token']) {
      const resposta = await atenderMcp(chamada(LISTA, token), config());
      expect(resposta.status).toBe(401);
      expect(resposta.headers.get('WWW-Authenticate')).toBe(
        'Bearer resource_metadata="https://aibou.test/.well-known/oauth-protected-resource/mcp"',
      );
    }
  });

  it('o token da sessão do app não serve: só o emitido para o conector, pelo OAuth', async () => {
    const supabase = await novoUsuario();
    const { data } = await supabase.auth.getSession();

    const resposta = await atenderMcp(chamada(LISTA, data.session!.access_token), config());

    expect(resposta.status).toBe(401);
  });

  it('com o token do conector, a ferramenta chega ao Companheiro do usuário', async () => {
    const supabase = await novoUsuario();
    const token = await tokenDoConector(supabase);
    const companheiro = criarCompanheiro({ supabase });
    const trilha = await companheiro.criarTrilha('usuario', { nome: 'MCP' });

    expect((await atenderMcp(chamada(INICIALIZAR, token), config())).status).toBe(200);
    const registro = await atenderMcp(
      chamada(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'registrar_sessao',
            arguments: { trilha_id: trilha.id, minutos: 25, nota: 'Transporte HTTP do MCP' },
          },
        },
        token,
      ),
      config(),
    );

    expect(registro.status).toBe(200);
    expect(await registro.json()).toMatchObject({
      id: 2,
      result: { structuredContent: { minutos: 25, nota: 'Transporte HTTP do MCP' } },
    });
    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toMatchObject([
      { duracaoSegundos: 25 * 60, nota: 'Transporte HTTP do MCP', origem: 'chat' },
    ]);
  });

  it('um token de e-mail fora da lista de acesso é recusado', async () => {
    const token = await tokenDoConector(await novoUsuario());

    const resposta = await atenderMcp(
      chamada(LISTA, token),
      config({ emailPermitido: acesso('guiproc@gmail.com', true) }),
    );

    expect(resposta.status).toBe(401);
  });

  it('em produção sem lista de e-mails, o /mcp fica fechado (fail closed)', async () => {
    const token = await tokenDoConector(await novoUsuario());

    const resposta = await atenderMcp(
      chamada(LISTA, token),
      config({ emailPermitido: acesso(undefined, true) }),
    );

    expect(resposta.status).toBe(401);
  });

  it('os metadados do recurso (RFC 9728) apontam o servidor OAuth do Supabase', async () => {
    const resposta = metadadosDoRecurso(
      new Request('https://aibou.test/.well-known/oauth-protected-resource/mcp'),
      config(),
    );

    expect(await resposta.json()).toEqual({
      resource: 'https://aibou.test/mcp',
      authorization_servers: [`${inject('supabase').url}/auth/v1`],
      bearer_methods_supported: ['header'],
      resource_name: 'Aibou',
    });
  });
});
