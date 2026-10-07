import { describe, expect, it } from 'vitest';
import {
  criarCompanheiro,
  EntradaInvalida,
  MOTIVOS,
  type Motivo,
  type NovaRecomendacao,
} from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

// Segunda, 12/10/2026, 07:07 em São Paulo: o Resumo acabou de sair.
const SEGUNDA_7H07 = '2026-10-12T10:07:00Z';
const HORA = 60 * 60_000;

// Uma Trilha com um Objetivo abstrato e um Resumo com uma Recomendação de cada tipo.
async function resumoComRecomendacoes() {
  const relogio = relogioFixo(SEGUNDA_7H07);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Conseguir a certificação',
  });
  const nova = (tipo: NovaRecomendacao['tipo'], titulo: string, url?: string) => ({
    objetivoId: objetivo.id,
    tipo,
    titulo,
    descricao: `Sobre ${titulo}.`,
    url,
    cartas: tipo === 'deck' ? [{ frente: 'O que é MCP?', verso: 'Um protocolo.' }] : undefined,
  });
  const resumo = await companheiro.criarResumo('claude', {
    trilhaId: trilha.id,
    semanaDe: '2026-10-05',
    texto: 'Semana boa.',
    fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
    recomendacoes: [
      nova('projeto', 'Um servidor MCP de brinquedo'),
      nova('roteiro', 'Roteiro de revisão'),
      nova('deck', 'Deck de MCP'),
      nova('material', 'Especificação do MCP', 'https://modelcontextprotocol.io/specification'),
    ],
  });
  const [projeto, roteiro, deck, material] = resumo.recomendacoes;
  relogio.avancar(HORA);
  return { companheiro, relogio, trilha, objetivo, resumo, projeto, roteiro, deck, material };
}

describe('Aceitar ou recusar uma Recomendação', () => {
  it('aceitar um Material Extra registra a Decisão e põe o item na Biblioteca da Trilha', async () => {
    const { companheiro, trilha, objetivo, material } = await resumoComRecomendacoes();

    const decisao = await companheiro.decidirRecomendacao('usuario', {
      recomendacaoId: material.id,
      resposta: 'aceita',
    });

    expect(decisao).toEqual({
      recomendacaoId: material.id,
      resposta: 'aceita',
      motivo: null,
      decididaEm: new Date('2026-10-12T11:07:00Z'),
    });
    const [resumo] = await companheiro.listarResumos('usuario', { trilhaId: trilha.id });
    expect(resumo.recomendacoes.find((r) => r.id === material.id)?.decisao).toEqual(decisao);
    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toEqual([
      {
        id: expect.any(String),
        trilhaId: trilha.id,
        recomendacaoId: material.id,
        objetivoId: objetivo.id,
        tipo: 'material',
        titulo: 'Especificação do MCP',
        descricao: 'Sobre Especificação do MCP.',
        url: 'https://modelcontextprotocol.io/specification',
        cartas: 0,
        adicionadoEm: new Date('2026-10-12T11:07:00Z'),
        feitoEm: null,
      },
    ]);
  });

  it('aceitar um projeto cria um Objetivo abstrato ligado ao Objetivo da Recomendação', async () => {
    const { companheiro, trilha, objetivo, projeto } = await resumoComRecomendacoes();

    await companheiro.decidirRecomendacao('usuario', {
      recomendacaoId: projeto.id,
      resposta: 'aceita',
    });

    const [original, novo] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(novo).toMatchObject({
      tipo: 'abstrato',
      trilhaId: trilha.id,
      descricao: 'Um servidor MCP de brinquedo',
      projetoDe: objetivo.id,
      criadoEm: new Date('2026-10-12T11:07:00Z'),
      situacao: 'em-andamento',
      itens: { concluidos: 0, total: 0 },
    });
    // O projeto é um item do Objetivo da Recomendação, ainda não concluído.
    expect(original).toMatchObject({ id: objetivo.id, projetoDe: null, itens: { concluidos: 0, total: 1 } });
    // Projeto não entra na Biblioteca.
    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toEqual([]);
  });

  it('recusar exige um Motivo, e a recusa vira Decisão sem criar nada', async () => {
    const { companheiro, trilha, deck } = await resumoComRecomendacoes();

    for (const motivo of [undefined, '', 'preguiça'])
      await expect(
        companheiro.decidirRecomendacao('usuario', {
          recomendacaoId: deck.id,
          resposta: 'recusada',
          motivo: motivo as Motivo,
        }),
      ).rejects.toThrow(EntradaInvalida);

    const decisao = await companheiro.decidirRecomendacao('usuario', {
      recomendacaoId: deck.id,
      resposta: 'recusada',
      motivo: 'formato-nao-serve',
    });

    expect(decisao).toEqual({
      recomendacaoId: deck.id,
      resposta: 'recusada',
      motivo: 'formato-nao-serve',
      decididaEm: new Date('2026-10-12T11:07:00Z'),
    });
    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toEqual([]);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });

  it('os quatro Motivos valem', async () => {
    const { companheiro, projeto, roteiro, deck, material } = await resumoComRecomendacoes();
    const recomendacoes = [projeto, roteiro, deck, material];

    for (const [i, motivo] of MOTIVOS.entries()) {
      const decisao = await companheiro.decidirRecomendacao('usuario', {
        recomendacaoId: recomendacoes[i].id,
        resposta: 'recusada',
        motivo,
      });
      expect(decisao.motivo).toBe(motivo);
    }
    expect(MOTIVOS).toEqual(['ja-sei', 'formato-nao-serve', 'agora-nao', 'fora-do-foco']);
  });

  it('aceitar um roteiro só registra a Decisão', async () => {
    const { companheiro, trilha, objetivo, roteiro } = await resumoComRecomendacoes();

    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: roteiro.id, resposta: 'aceita' });

    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toEqual([]);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { id: objetivo.id, itens: { concluidos: 0, total: 0 } },
    ]);
  });

  it('uma Recomendação se responde uma vez só', async () => {
    const { companheiro, trilha, material } = await resumoComRecomendacoes();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });

    await expect(
      companheiro.decidirRecomendacao('usuario', {
        recomendacaoId: material.id,
        resposta: 'recusada',
        motivo: 'agora-nao',
      }),
    ).rejects.toThrow(EntradaInvalida);
    await expect(
      companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' }),
    ).rejects.toThrow(EntradaInvalida);

    const [resumo] = await companheiro.listarResumos('usuario', { trilhaId: trilha.id });
    expect(resumo.recomendacoes.find((r) => r.id === material.id)?.decisao?.resposta).toBe('aceita');
    expect(await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });

  it('a Recomendação de outra pessoa não existe para quem responde', async () => {
    const { material } = await resumoComRecomendacoes();
    const outro = criarCompanheiro({ supabase: await novoUsuario() });

    await expect(
      outro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' }),
    ).rejects.toThrow(EntradaInvalida);
  });

  it('numa Trilha arquivada, só consulta: não se responde Recomendação', async () => {
    const { companheiro, trilha, material } = await resumoComRecomendacoes();
    await companheiro.arquivarTrilha('usuario', { trilhaId: trilha.id });

    await expect(
      companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' }),
    ).rejects.toThrow(EntradaInvalida);
  });
});

describe('Biblioteca', () => {
  it('marcar um item como feito avança a barra do Objetivo abstrato ligado', async () => {
    const { companheiro, relogio, trilha, objetivo, deck, material } =
      await resumoComRecomendacoes();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: deck.id, resposta: 'aceita' });
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    const [itemDoDeck] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });

    relogio.avancar(HORA);
    const feito = await companheiro.marcarItemFeito('usuario', { itemId: itemDoDeck.id, feito: true });

    expect(feito).toMatchObject({ id: itemDoDeck.id, feitoEm: new Date('2026-10-12T12:07:00Z') });
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { id: objetivo.id, itens: { concluidos: 1, total: 2 } },
    ]);
  });

  it('marcar de novo não muda a data, e desmarcar devolve o item à barra', async () => {
    const { companheiro, relogio, trilha, objetivo, material } = await resumoComRecomendacoes();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    const [item] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });

    await companheiro.marcarItemFeito('usuario', { itemId: item.id, feito: true });
    relogio.avancar(HORA);
    const deNovo = await companheiro.marcarItemFeito('usuario', { itemId: item.id, feito: true });
    expect(deNovo.feitoEm).toEqual(new Date('2026-10-12T11:07:00Z'));

    const desfeito = await companheiro.marcarItemFeito('usuario', { itemId: item.id, feito: false });
    expect(desfeito.feitoEm).toBeNull();
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { id: objetivo.id, itens: { concluidos: 0, total: 1 } },
    ]);
  });

  it('concluir o Objetivo de um projeto avança a barra do Objetivo a que ele serve', async () => {
    const { companheiro, trilha, objetivo, projeto, material } = await resumoComRecomendacoes();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: projeto.id, resposta: 'aceita' });
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    const [, doProjeto] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });

    await companheiro.concluirObjetivo('usuario', { objetivoId: doProjeto.id });

    const [original] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(original).toMatchObject({ id: objetivo.id, itens: { concluidos: 1, total: 2 } });
  });

  it('o item de outra pessoa não existe para quem marca', async () => {
    const { companheiro, trilha, material } = await resumoComRecomendacoes();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    const [item] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });
    const outro = criarCompanheiro({ supabase: await novoUsuario() });

    await expect(
      outro.marcarItemFeito('usuario', { itemId: item.id, feito: true }),
    ).rejects.toThrow(EntradaInvalida);
    expect((await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id }))[0].feitoEm).toBeNull();
  });
});
