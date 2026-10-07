// Teste de fumaça do conector: cada ferramenta MCP chega ao Companheiro, como
// Ator claude. As regras ficam nos testes do Companheiro; aqui só o caminho.
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarCompanheiro, type Companheiro } from '../companheiro/companheiro';
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

// Um Objetivo abstrato e um Resumo com um Material Extra e um Deck, na semana anterior.
async function resumoComRecomendacoes(companheiro: Companheiro, trilhaId: string) {
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId,
    descricao: 'Conseguir a certificação',
  });
  const resumo = await companheiro.criarResumo('claude', {
    trilhaId,
    semanaDe: '2026-09-28',
    texto: 'Semana boa.',
    fontes: [{ titulo: 'Guia', url: 'https://example.com/guia' }],
    recomendacoes: [
      { objetivoId: objetivo.id, tipo: 'material', titulo: 'Especificação do MCP', descricao: 'A spec.' },
      { objetivoId: objetivo.id, tipo: 'deck', titulo: 'Deck de MCP', descricao: 'Termos.' },
    ],
  });
  const [material, deck] = resumo.recomendacoes;
  return { objetivo, material, deck };
}

describe('Servidor MCP', () => {
  it('oferece as ferramentas de consulta, de registro, do Resumo e das Decisões', async () => {
    const { cliente } = await conectado();

    const { tools } = await cliente.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual([
      'consultar_progresso',
      'consultar_trilha',
      'decidir_recomendacao',
      'definir_objetivo',
      'gravar_resumo',
      'registrar_sessao',
    ]);
  });

  it('consultar_trilha devolve Objetivos (com ids), Sessões com nota e Resumos anteriores', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });
    await companheiro.registrarSessao('usuario', { trilhaId: trilha.id, minutos: 40, nota: 'OAuth' });

    const resposta = await cliente.callTool({
      name: 'consultar_trilha',
      arguments: { trilha_id: trilha.id },
    });

    expect(resposta.structuredContent).toMatchObject({
      trilha: { id: trilha.id, nome: 'MCP' },
      objetivos: [{ id: objetivo.id, tipo: 'abstrato', descricao: 'Conseguir a certificação' }],
      sessoes: [{ minutos: 40, nota: 'OAuth', origem: 'chat' }],
      resumosAnteriores: [],
    });
  });

  it('gravar_resumo cria o Resumo, com as Recomendações, no Companheiro', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });

    const resposta = await cliente.callTool({
      name: 'gravar_resumo',
      arguments: {
        trilha_id: trilha.id,
        semana_de: '2026-09-28',
        texto: 'Semana curta, mas com foco.',
        fontes: [{ titulo: 'Especificação do MCP', url: 'https://modelcontextprotocol.io' }],
        recomendacoes: [
          {
            objetivo_id: objetivo.id,
            tipo: 'material',
            titulo: 'Autorização no MCP',
            descricao: 'O capítulo de OAuth.',
            url: 'https://modelcontextprotocol.io/specification',
          },
        ],
      },
    });

    expect(resposta.isError).toBeFalsy();
    expect(await companheiro.listarResumos('usuario', { trilhaId: trilha.id })).toMatchObject([
      {
        semana: { de: '2026-09-28', ate: '2026-10-04' },
        texto: 'Semana curta, mas com foco.',
        recomendacoes: [{ objetivoId: objetivo.id, tipo: 'material' }],
      },
    ]);
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

  it('consultar_trilha traz as Recomendações com id e Decisão, e as Decisões passadas', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    const { material, deck } = await resumoComRecomendacoes(companheiro, trilha.id);
    await companheiro.decidirRecomendacao('usuario', {
      recomendacaoId: deck.id,
      resposta: 'recusada',
      motivo: 'agora-nao',
    });

    const resposta = await cliente.callTool({
      name: 'consultar_trilha',
      arguments: { trilha_id: trilha.id },
    });

    expect(resposta.structuredContent).toMatchObject({
      resumosAnteriores: [
        {
          recomendacoes: [
            { id: material.id, tipo: 'material', titulo: 'Especificação do MCP', decisao: null },
            { id: deck.id, tipo: 'deck', decisao: { resposta: 'recusada', motivo: 'agora-nao' } },
          ],
        },
      ],
      decisoes: [
        {
          recomendacaoId: deck.id,
          resposta: 'recusada',
          motivo: 'agora-nao',
          decididaEm: '2026-10-09T21:00:00.000Z',
          tipo: 'deck',
          titulo: 'Deck de MCP',
        },
      ],
    });
  });

  it('decidir_recomendacao registra a Decisão do usuário no Companheiro', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    const { material, deck } = await resumoComRecomendacoes(companheiro, trilha.id);

    const aceita = await cliente.callTool({
      name: 'decidir_recomendacao',
      arguments: { recomendacao_id: material.id, resposta: 'aceita' },
    });
    const recusada = await cliente.callTool({
      name: 'decidir_recomendacao',
      arguments: { recomendacao_id: deck.id, resposta: 'recusada', motivo: 'ja-sei' },
    });

    expect(aceita.isError).toBeFalsy();
    expect(recusada.structuredContent).toMatchObject({ resposta: 'recusada', motivo: 'ja-sei' });
    expect(await companheiro.listarDecisoes('usuario', { trilhaId: trilha.id })).toMatchObject([
      { recomendacaoId: material.id, resposta: 'aceita' },
      { recomendacaoId: deck.id, resposta: 'recusada', motivo: 'ja-sei' },
    ]);
    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toMatchObject([
      { recomendacaoId: material.id },
    ]);
  });

  it('definir_objetivo define o Objetivo de uma Trilha sem Objetivo, dos dois tipos', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    const outra = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });

    const abstrato = await cliente.callTool({
      name: 'definir_objetivo',
      arguments: { trilha_id: trilha.id, tipo: 'abstrato', descricao: 'Conseguir a certificação' },
    });
    const mensuravel = await cliente.callTool({
      name: 'definir_objetivo',
      arguments: { trilha_id: outra.id, tipo: 'mensuravel', meta_horas: 10, periodo: 'mes' },
    });

    expect(abstrato.structuredContent).toMatchObject({ tipo: 'abstrato', descricao: 'Conseguir a certificação' });
    expect(mensuravel.structuredContent).toMatchObject({
      tipo: 'mensuravel',
      metaHoras: 10,
      periodo: { de: '2026-10-01', ate: '2026-10-31' },
    });
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });

  it('definir_objetivo numa Trilha que já tem Objetivo volta como erro da ferramenta', async () => {
    const { cliente, companheiro, trilha } = await conectado();
    await companheiro.criarObjetivoAbstrato('usuario', { trilhaId: trilha.id, descricao: 'Já tem' });

    const resposta = await cliente.callTool({
      name: 'definir_objetivo',
      arguments: { trilha_id: trilha.id, tipo: 'mensuravel', meta_horas: 5, periodo: 'semana' },
    });

    expect(resposta.isError).toBe(true);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toHaveLength(1);
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
