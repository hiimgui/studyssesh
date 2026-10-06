// Teste de fumaça do conector: cada ferramenta MCP chega ao Companheiro, como
// Ator claude. As regras ficam nos testes do Companheiro; aqui só o caminho.
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarCompanheiro } from '../companheiro/companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';
import { criarServidorMcp } from './servidor';

async function conectado() {
  const relogio = relogioFixo('2026-10-09T21:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'MCP' });

  const [doCliente, doServidor] = InMemoryTransport.createLinkedPair();
  await criarServidorMcp(companheiro).connect(doServidor);
  const cliente = new Client({ name: 'teste', version: '1.0.0' });
  await cliente.connect(doCliente);
  return { cliente, companheiro, trilha };
}

describe('Servidor MCP', () => {
  it('oferece as ferramentas de consulta e de registro', async () => {
    const { cliente } = await conectado();

    const { tools } = await cliente.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(['consultar_progresso', 'registrar_sessao']);
  });

  it('registrar_sessao cria a Sessão pelo chat no Companheiro', async () => {
    const { cliente, companheiro, trilha } = await conectado();

    const resposta = await cliente.callTool({
      name: 'registrar_sessao',
      arguments: { trilha_id: trilha.id, minutos: 90, nota: 'Li a spec de autorização' },
    });

    expect(resposta.isError).toBeFalsy();
    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toMatchObject([
      { duracaoSegundos: 90 * 60, nota: 'Li a spec de autorização', origem: 'chat' },
    ]);
  });

  it('consultar_progresso devolve o Início do Companheiro', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    await companheiro.registrarSessao('usuario', { trilhaId: trilha.id, minutos: 30, nota: 'x' });

    const resposta = await cliente.callTool({ name: 'consultar_progresso', arguments: {} });

    expect(resposta.structuredContent).toMatchObject({
      horasNoTotal: 0.5,
      diasEstudadosNoMes: 1,
      trilhas: [{ id: trilha.id, nome: 'MCP', horas: 0.5, marco: { anterior: 0, proximo: 10 } }],
    });
  });

  it('uma recusa do Companheiro volta como erro da ferramenta, com a mensagem', async () => {
    const { cliente, trilha } = await conectado();

    const resposta = await cliente.callTool({
      name: 'registrar_sessao',
      arguments: { trilha_id: trilha.id, minutos: 30, nota: '   ' },
    });

    expect(resposta).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Diga o que foi estudado: a nota é obrigatória.' }],
    });
  });
});
