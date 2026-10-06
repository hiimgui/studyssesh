import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida, PermissaoNegada } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

// Segunda, 12/10/2026, 07:07 em São Paulo: hora da routine do Resumo.
const SEGUNDA_7H07 = '2026-10-12T10:07:00Z';

async function trilhaComObjetivo(agora = SEGUNDA_7H07) {
  const relogio = relogioFixo(agora);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Conseguir a certificação',
  });
  return { companheiro, relogio, trilha, objetivo };
}

const materialExtra = (objetivoId: string) => ({
  objetivoId,
  tipo: 'material' as const,
  titulo: 'Model Context Protocol: especificação',
  descricao: 'A parte de autorização, para fechar o que ficou aberto na semana.',
  url: 'https://modelcontextprotocol.io/specification',
});

describe('Resumo semanal', () => {
  it('o Claude grava o Resumo da semana anterior, com fontes e Recomendações ligadas a Objetivos', async () => {
    const { companheiro, trilha, objetivo } = await trilhaComObjetivo();

    const resumo = await companheiro.criarResumo('claude', {
      trilhaId: trilha.id,
      semanaDe: '2026-10-05',
      texto: '  Semana boa: 4h em três dias. Para esta, um projeto pequeno.  ',
      fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
      recomendacoes: [
        {
          objetivoId: objetivo.id,
          tipo: 'projeto',
          titulo: 'Um servidor MCP de brinquedo',
          descricao: 'Duas ferramentas e OAuth, em uma tarde.',
        },
        materialExtra(objetivo.id),
      ],
    });

    expect(resumo).toMatchObject({
      trilhaId: trilha.id,
      semana: { de: '2026-10-05', ate: '2026-10-11' },
      texto: 'Semana boa: 4h em três dias. Para esta, um projeto pequeno.',
      fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
      geradoEm: new Date(SEGUNDA_7H07),
      recomendacoes: [
        { objetivoId: objetivo.id, tipo: 'projeto', titulo: 'Um servidor MCP de brinquedo', url: null },
        { objetivoId: objetivo.id, tipo: 'material', url: 'https://modelcontextprotocol.io/specification' },
      ],
    });
    expect(await companheiro.listarResumos('usuario', { trilhaId: trilha.id })).toEqual([resumo]);
  });

  it('o Resumo é do Claude: o usuário não escreve Resumo', async () => {
    const { companheiro, trilha, objetivo } = await trilhaComObjetivo();

    await expect(
      companheiro.criarResumo('usuario', {
        trilhaId: trilha.id,
        semanaDe: '2026-10-05',
        texto: 'Eu mesmo',
        fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
        recomendacoes: [materialExtra(objetivo.id)],
      }),
    ).rejects.toThrow(PermissaoNegada);
  });

  it('cobre uma semana de segunda a domingo que já começou', async () => {
    const { companheiro, trilha, objetivo } = await trilhaComObjetivo();
    const resumoDa = (semanaDe: string) =>
      companheiro.criarResumo('claude', {
        trilhaId: trilha.id,
        semanaDe,
        texto: 'Semana',
        fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
        recomendacoes: [materialExtra(objetivo.id)],
      });

    await expect(resumoDa('2026-10-06')).rejects.toThrow(EntradaInvalida); // terça
    await expect(resumoDa('2026-10-19')).rejects.toThrow(EntradaInvalida); // semana que vem
    await expect(resumoDa('2026-02-30')).rejects.toThrow(EntradaInvalida);
    await expect(resumoDa('ontem')).rejects.toThrow(EntradaInvalida);
    // A semana de hoje já começou: dá para resumir até aqui ("gerar agora").
    expect((await resumoDa('2026-10-12')).semana).toEqual({ de: '2026-10-12', ate: '2026-10-18' });
  });

  it('precisa de texto, de fontes com link e de pelo menos um Material Extra', async () => {
    const { companheiro, trilha, objetivo } = await trilhaComObjetivo();
    const base = {
      trilhaId: trilha.id,
      semanaDe: '2026-10-05',
      texto: 'Semana',
      fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
      recomendacoes: [materialExtra(objetivo.id)],
    };
    const projeto = {
      objetivoId: objetivo.id,
      tipo: 'projeto' as const,
      titulo: 'Projeto',
      descricao: 'Um projeto',
    };

    for (const errado of [
      { texto: '   ' },
      { fontes: [] },
      { fontes: [{ titulo: 'Sem link', url: 'nao-e-link' }] },
      { fontes: [{ titulo: '  ', url: 'https://example.com' }] },
      { fontes: [{ titulo: 'Arquivo', url: 'javascript:alert(1)' }] },
      { recomendacoes: [projeto] },
      { recomendacoes: [{ ...materialExtra(objetivo.id), titulo: ' ' }] },
      { recomendacoes: [{ ...materialExtra(objetivo.id), url: 'ftp://example.com' }] },
      { recomendacoes: [{ ...materialExtra(objetivo.id), tipo: 'video' as never }] },
    ]) {
      await expect(companheiro.criarResumo('claude', { ...base, ...errado })).rejects.toThrow(
        EntradaInvalida,
      );
    }
    expect(await companheiro.listarResumos('usuario', { trilhaId: trilha.id })).toEqual([]);
  });

  it('toda Recomendação aponta um Objetivo da própria Trilha', async () => {
    const { companheiro, trilha } = await trilhaComObjetivo();
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    const deOutraTrilha = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: violao.id,
      descricao: 'Tocar uma música inteira',
    });

    for (const objetivoId of [deOutraTrilha.id, '00000000-0000-0000-0000-000000000000']) {
      await expect(
        companheiro.criarResumo('claude', {
          trilhaId: trilha.id,
          semanaDe: '2026-10-05',
          texto: 'Semana',
          fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
          recomendacoes: [materialExtra(objetivoId)],
        }),
      ).rejects.toThrow(EntradaInvalida);
    }
  });

  it('o Início traz o último Resumo de cada Trilha e quando saiu o último de todos', async () => {
    const { companheiro, relogio, trilha, objetivo } = await trilhaComObjetivo();
    relogio.avancar(60_000);
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    const resumir = (trilhaId: string, objetivoId: string, semanaDe: string) =>
      companheiro.criarResumo('claude', {
        trilhaId,
        semanaDe,
        texto: `Semana de ${semanaDe}`,
        fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
        recomendacoes: [materialExtra(objetivoId)],
      });

    expect(await companheiro.inicio('usuario')).toMatchObject({
      ultimoResumoEm: null,
      trilhas: [{ ultimoResumo: null }, { ultimoResumo: null }],
    });

    await resumir(trilha.id, objetivo.id, '2026-09-28');
    relogio.avancar(60_000);
    const ultimo = await resumir(trilha.id, objetivo.id, '2026-10-05');

    expect(await companheiro.inicio('usuario')).toMatchObject({
      ultimoResumoEm: ultimo.geradoEm,
      trilhas: [
        { trilha: { id: trilha.id }, ultimoResumo: ultimo },
        { trilha: { id: violao.id }, ultimoResumo: null },
      ],
    });
  });

  it('numa Trilha arquivada não entra Resumo novo', async () => {
    const { companheiro, trilha, objetivo } = await trilhaComObjetivo();
    await companheiro.arquivarTrilha('usuario', { trilhaId: trilha.id });

    await expect(
      companheiro.criarResumo('claude', {
        trilhaId: trilha.id,
        semanaDe: '2026-10-05',
        texto: 'Semana',
        fontes: [{ titulo: 'Guia', url: 'https://example.com' }],
        recomendacoes: [materialExtra(objetivo.id)],
      }),
    ).rejects.toThrow(EntradaInvalida);
  });
});
