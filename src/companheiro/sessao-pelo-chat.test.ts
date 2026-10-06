import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function companheiroComTrilha(agora = '2026-10-09T21:00:00Z', nome = 'MCP') {
  const relogio = relogioFixo(agora);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome });
  return { companheiro, relogio, trilha };
}

describe('Sessão pelo chat', () => {
  it('"estudei 1h30 de MCP hoje": o Claude cria a Sessão com nota, terminando agora', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    const sessao = await companheiro.registrarSessao('claude', {
      trilhaId: trilha.id,
      minutos: 90,
      nota: '  Li a spec de autorização do MCP  ',
    });

    expect(sessao).toMatchObject({
      trilhaId: trilha.id,
      inicio: new Date('2026-10-09T19:30:00Z'),
      fim: new Date('2026-10-09T21:00:00Z'),
      duracaoSegundos: 90 * 60,
      nota: 'Li a spec de autorização do MCP',
      origem: 'chat',
    });
    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toEqual([sessao]);
  });

  it('dá para dizer quando o estudo terminou ("ontem à noite")', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    const sessao = await companheiro.registrarSessao('claude', {
      trilhaId: trilha.id,
      minutos: 45,
      nota: 'Exemplos do SDK',
      fim: new Date('2026-10-09T01:30:00Z'),
    });

    expect(sessao).toMatchObject({
      inicio: new Date('2026-10-09T00:45:00Z'),
      fim: new Date('2026-10-09T01:30:00Z'),
    });
  });

  it('pelo chat, a nota é obrigatória e a duração precisa fazer sentido', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();
    const registrar = (minutos: number, nota = 'Estudei', fim?: Date) =>
      companheiro.registrarSessao('claude', { trilhaId: trilha.id, minutos, nota, fim });

    await expect(registrar(30, '   ')).rejects.toThrow(EntradaInvalida);
    await expect(registrar(0)).rejects.toThrow(EntradaInvalida);
    await expect(registrar(-10)).rejects.toThrow(EntradaInvalida);
    await expect(registrar(Number.NaN)).rejects.toThrow(EntradaInvalida);
    await expect(registrar(24 * 60 + 1)).rejects.toThrow(EntradaInvalida);
    await expect(registrar(30, 'Do futuro', new Date('2026-10-09T22:00:00Z'))).rejects.toThrow(
      EntradaInvalida,
    );
    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toEqual([]);
  });

  it('não sobrepõe estudo já registrado, em nenhuma Trilha (nada conta duas vezes)', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-09T20:00:00Z');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    // Pelo timer: das 20:00 às 20:40.
    await companheiro.iniciarTimer('usuario', { trilhaId: violao.id });
    relogio.avancar(40 * MINUTO);
    await companheiro.encerrarTimer('usuario');
    relogio.avancarAte('2026-10-09T21:00:00Z');

    // 20:30 às 21:00 bate nos últimos 10 minutos do timer.
    await expect(
      companheiro.registrarSessao('claude', { trilhaId: trilha.id, minutos: 30, nota: 'Spec' }),
    ).rejects.toThrow(EntradaInvalida);
    // 20:40 às 21:00 encosta, mas não sobrepõe.
    await companheiro.registrarSessao('claude', { trilhaId: trilha.id, minutos: 20, nota: 'Spec' });

    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toMatchObject([
      { duracaoSegundos: 20 * 60 },
    ]);
  });

  it('não cruza o timer que ainda está correndo, do início dele até agora', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-09T20:00:00Z');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    // Timer ligado às 20:00 no Violão e ainda correndo às 21:00.
    await companheiro.iniciarTimer('usuario', { trilhaId: violao.id });
    relogio.avancarAte('2026-10-09T21:00:00Z');

    // 19:50 às 20:10 cruza o começo do timer.
    await expect(
      companheiro.registrarSessao('claude', {
        trilhaId: trilha.id,
        minutos: 20,
        nota: 'Spec',
        fim: new Date('2026-10-09T20:10:00Z'),
      }),
    ).rejects.toThrow(EntradaInvalida);
    // 19:30 às 20:00 encosta no começo do timer.
    await companheiro.registrarSessao('claude', {
      trilhaId: trilha.id,
      minutos: 30,
      nota: 'Spec',
      fim: new Date('2026-10-09T20:00:00Z'),
    });

    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });

  it('o timer pausado por Inatividade só ocupa o tempo até a pausa', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-09T18:00:00Z');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    // Ligado às 18:00 e sem interação: a Inatividade o pausa às 19:00.
    await companheiro.iniciarTimer('usuario', { trilhaId: violao.id });
    relogio.avancarAte('2026-10-09T21:00:00Z');

    await expect(
      companheiro.registrarSessao('claude', {
        trilhaId: trilha.id,
        minutos: 30,
        nota: 'Spec',
        fim: new Date('2026-10-09T19:10:00Z'),
      }),
    ).rejects.toThrow(EntradaInvalida);
    // Das 20:00 às 21:00 o timer estava parado: não cruza.
    await companheiro.registrarSessao('claude', { trilhaId: trilha.id, minutos: 60, nota: 'Spec' });

    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });

  it('a Sessão do chat bate a meta de um Objetivo como a do timer', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 1,
      periodo: 'semana',
    });

    const sessao = await companheiro.registrarSessao('claude', {
      trilhaId: trilha.id,
      minutos: 60,
      nota: 'Construí um servidor MCP de exemplo',
    });

    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { situacao: 'concluido', concluidoEm: sessao.fim },
    ]);
  });

  it('numa Trilha arquivada não se registra Sessão', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();
    await companheiro.arquivarTrilha('usuario', { trilhaId: trilha.id });

    await expect(
      companheiro.registrarSessao('claude', { trilhaId: trilha.id, minutos: 30, nota: 'Spec' }),
    ).rejects.toThrow(EntradaInvalida);
  });
});
