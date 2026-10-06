// O /mcp de ponta a ponta, sem o servidor do Astro: requisição HTTP de
// verdade, token de verdade de um usuário de teste, Postgres de verdade.
import { describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { criarCompanheiro } from '../companheiro/companheiro';
import { novoUsuario } from '../test/usuarios';
import { atenderMcp } from './http';

const config = () => {
  const { url, anonKey } = inject('supabase');
  return { supabaseUrl: url, supabaseAnonKey: anonKey };
};

const chamada = (corpo: unknown, token?: string) =>
  new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });

describe('/mcp', () => {
  it('sem token, ou com token inválido, responde 401 pedindo Bearer', async () => {
    const lista = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

    for (const token of [undefined, 'nao-e-um-token']) {
      const resposta = await atenderMcp(chamada(lista, token), config());
      expect(resposta.status).toBe(401);
      expect(resposta.headers.get('WWW-Authenticate')).toMatch(/^Bearer/);
    }
  });

  it('com o token do usuário, a ferramenta chega ao Companheiro dele', async () => {
    const supabase = await novoUsuario();
    const { data } = await supabase.auth.getSession();
    const token = data.session!.access_token;
    const companheiro = criarCompanheiro({ supabase });
    const trilha = await companheiro.criarTrilha('usuario', { nome: 'MCP' });

    const inicio = await atenderMcp(
      chamada(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: { name: 'teste', version: '1.0.0' },
          },
        },
        token,
      ),
      config(),
    );
    expect(inicio.status).toBe(200);

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
});
