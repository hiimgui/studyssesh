import { describe, expect, it } from 'vitest';
import { criarCompanheiro, PermissaoNegada, type NovaRecomendacao } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

// Segunda, 12/10/2026, 07:07 em São Paulo: o Resumo acabou de sair.
const SEGUNDA_7H07 = '2026-10-12T10:07:00Z';
const HORA = 60 * 60_000;

// Uma Trilha com um Objetivo abstrato em andamento e um Resumo com um projeto,
// um Deck e um Material Extra.
async function resumoNaTrilha() {
  const relogio = relogioFixo(SEGUNDA_7H07);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Conseguir a certificação',
  });
  const nova = (tipo: NovaRecomendacao['tipo'], titulo: string) => ({
    objetivoId: objetivo.id,
    tipo,
    titulo,
    descricao: `Sobre ${titulo}.`,
  });
  const resumo = await companheiro.criarResumo('claude', {
    trilhaId: trilha.id,
    semanaDe: '2026-10-05',
    texto: 'Semana boa.',
    fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
    recomendacoes: [
      nova('projeto', 'Um servidor MCP de brinquedo'),
      nova('deck', 'Deck de MCP'),
      nova('material', 'Especificação do MCP'),
    ],
  });
  const [projeto, deck, material] = resumo.recomendacoes;
  relogio.avancar(HORA);
  return { companheiro, relogio, trilha, objetivo, projeto, deck, material };
}

describe('Decisões pelo chat', () => {
  it('a pedido do usuário, o Claude aceita um projeto: vira Objetivo mesmo com outro em andamento', async () => {
    const { companheiro, trilha, objetivo, projeto } = await resumoNaTrilha();

    const decisao = await companheiro.decidirRecomendacao('claude', {
      recomendacaoId: projeto.id,
      resposta: 'aceita',
    });

    expect(decisao).toMatchObject({ recomendacaoId: projeto.id, resposta: 'aceita' });
    // O Objetivo do projeto nasce ligado e não substitui o que já estava em andamento.
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { id: objetivo.id, situacao: 'em-andamento', itens: { concluidos: 0, total: 1 } },
      { descricao: 'Um servidor MCP de brinquedo', projetoDe: objetivo.id, situacao: 'em-andamento' },
    ]);
  });

  it('o Claude recusa com Motivo, como o usuário faria no app', async () => {
    const { companheiro, trilha, deck } = await resumoNaTrilha();

    await companheiro.decidirRecomendacao('claude', {
      recomendacaoId: deck.id,
      resposta: 'recusada',
      motivo: 'ja-sei',
    });

    const [resumo] = await companheiro.listarResumos('claude', { trilhaId: trilha.id });
    expect(resumo.recomendacoes.find((r) => r.id === deck.id)?.decisao).toMatchObject({
      resposta: 'recusada',
      motivo: 'ja-sei',
    });
  });

  it('fora do projeto aceito, o Claude continua sem definir Objetivo numa Trilha que já tem um', async () => {
    const { companheiro, trilha } = await resumoNaTrilha();

    await expect(
      companheiro.criarObjetivoAbstrato('claude', { trilhaId: trilha.id, descricao: 'Outro' }),
    ).rejects.toThrow(PermissaoNegada);
    await expect(
      companheiro.criarObjetivoMensuravel('claude', {
        trilhaId: trilha.id,
        metaHoras: 5,
        periodo: 'semana',
      }),
    ).rejects.toThrow(PermissaoNegada);
  });

  it('as Decisões passadas da Trilha, mais recentes primeiro, com o que foi recomendado', async () => {
    const { companheiro, relogio, trilha, objetivo, deck, material } = await resumoNaTrilha();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    relogio.avancar(HORA);
    await companheiro.decidirRecomendacao('claude', {
      recomendacaoId: deck.id,
      resposta: 'recusada',
      motivo: 'formato-nao-serve',
    });
    // Decisões de outra Trilha não entram.
    const outra = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });

    expect(await companheiro.listarDecisoes('claude', { trilhaId: trilha.id })).toEqual([
      {
        recomendacaoId: deck.id,
        resposta: 'recusada',
        motivo: 'formato-nao-serve',
        decididaEm: new Date('2026-10-12T12:07:00Z'),
        recomendacao: {
          objetivoId: objetivo.id,
          tipo: 'deck',
          titulo: 'Deck de MCP',
          descricao: 'Sobre Deck de MCP.',
        },
      },
      {
        recomendacaoId: material.id,
        resposta: 'aceita',
        motivo: null,
        decididaEm: new Date('2026-10-12T11:07:00Z'),
        recomendacao: {
          objetivoId: objetivo.id,
          tipo: 'material',
          titulo: 'Especificação do MCP',
          descricao: 'Sobre Especificação do MCP.',
        },
      },
    ]);
    expect(await companheiro.listarDecisoes('claude', { trilhaId: outra.id })).toEqual([]);
  });
});
