import { describe, expect, it } from 'vitest';
import { criarCompanheiro } from './companheiro';
import { estudar } from '../test/estudar';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function companheiroNovo(agora: string) {
  const relogio = relogioFixo(agora);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  return { companheiro, relogio };
}

describe('Início', () => {
  it('sem Trilhas, o Início começa zerado', async () => {
    const { companheiro } = await companheiroNovo('2026-10-08T12:00:00Z');

    expect(await companheiro.inicio('usuario')).toEqual({
      totalSegundos: 0,
      diasEstudadosNoMes: 0,
      trilhas: [],
    });
  });

  it('consolida o total geral e, por Trilha, as horas, o Marco e os Objetivos em andamento', async () => {
    const { companheiro, relogio } = await companheiroNovo('2026-10-08T12:00:00Z');
    const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    const objetivo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: japones.id,
      metaHoras: 20,
      periodo: 'mes',
    });

    await estudar(companheiro, relogio, japones.id, 11 * 60);
    await estudar(companheiro, relogio, violao.id, 45);

    const inicio = await companheiro.inicio('usuario');
    expect(inicio.totalSegundos).toBe((11 * 60 + 45) * 60);
    expect(inicio.trilhas).toEqual([
      {
        trilha: japones,
        progresso: {
          trilhaId: japones.id,
          totalSegundos: 11 * 3600,
          marco: { anterior: 10, proximo: 25 },
          marcoParaCelebrar: 10,
        },
        objetivosEmAndamento: [{ ...objetivo, estudadoSegundos: 11 * 3600 }],
      },
      {
        trilha: violao,
        progresso: {
          trilhaId: violao.id,
          totalSegundos: 45 * 60,
          marco: { anterior: 0, proximo: 10 },
          marcoParaCelebrar: null,
        },
        objetivosEmAndamento: [],
      },
    ]);
  });

  it('a Trilha arquivada sai da lista, mas as horas dela continuam no total e nos dias', async () => {
    const { companheiro, relogio } = await companheiroNovo('2026-10-08T12:00:00Z');
    const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    await estudar(companheiro, relogio, japones.id, 90);
    relogio.avancarAte('2026-10-09T12:00:00Z');
    await estudar(companheiro, relogio, violao.id, 30);

    await companheiro.arquivarTrilha('usuario', { trilhaId: japones.id });

    const inicio = await companheiro.inicio('usuario');
    expect(inicio.trilhas.map((t) => t.trilha.nome)).toEqual(['Violão']);
    expect(inicio).toMatchObject({ totalSegundos: 120 * 60, diasEstudadosNoMes: 2 });
  });

  it('o Claude lê o Início', async () => {
    const { companheiro, relogio } = await companheiroNovo('2026-10-08T12:00:00Z');
    const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    await estudar(companheiro, relogio, japones.id, 30);

    expect(await companheiro.inicio('claude')).toMatchObject({
      totalSegundos: 30 * 60,
      diasEstudadosNoMes: 1,
    });
  });
});

describe('Dias estudados no mês', () => {
  it('conta dias distintos com Sessão, em todas as Trilhas; dia sem estudo não zera nada', async () => {
    const { companheiro, relogio } = await companheiroNovo('2026-10-01T12:00:00Z');
    const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });

    await estudar(companheiro, relogio, japones.id, 30); // 1º/10
    await estudar(companheiro, relogio, violao.id, 30); // 1º/10 de novo
    relogio.avancarAte('2026-10-03T12:00:00Z'); // 2/10 sem estudo
    await estudar(companheiro, relogio, violao.id, 30); // 3/10
    relogio.avancarAte('2026-10-20T12:00:00Z');

    expect((await companheiro.inicio('usuario')).diasEstudadosNoMes).toBe(2);
  });

  it('o dia é o de São Paulo, e cada mês começa a contar do zero', async () => {
    const { companheiro, relogio } = await companheiroNovo('2026-10-31T12:00:00Z');
    const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    await estudar(companheiro, relogio, japones.id, 30); // 31/10, 09:00 em São Paulo

    relogio.avancarAte('2026-11-01T02:30:00Z'); // 31/10, 23:30 em São Paulo
    await companheiro.iniciarTimer('usuario', { trilhaId: japones.id });
    relogio.avancar(20 * MINUTO);
    await companheiro.encerrarTimer('usuario');
    expect((await companheiro.inicio('usuario')).diasEstudadosNoMes).toBe(1);

    relogio.avancarAte('2026-11-01T03:00:00Z'); // 1º/11, meia-noite em São Paulo
    expect((await companheiro.inicio('usuario')).diasEstudadosNoMes).toBe(0);

    relogio.avancarAte('2026-11-01T03:10:00Z');
    await estudar(companheiro, relogio, japones.id, 15);
    expect((await companheiro.inicio('usuario')).diasEstudadosNoMes).toBe(1);
  });
});
