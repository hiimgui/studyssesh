import { describe, expect, it } from 'vitest';
import {
  criarCompanheiro,
  EntradaInvalida,
  PermissaoNegada,
  type Periodo,
} from './companheiro';
import { estudar } from '../test/estudar';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function companheiroComTrilha(agora: string, nome = 'Japonês') {
  const relogio = relogioFixo(agora);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome });
  return { companheiro, relogio, trilha };
}

describe('Objetivo mensurável', () => {
  it('cria um Objetivo de horas no mês e começa sem progresso', async () => {
    const { companheiro, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');

    const objetivo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });

    expect(objetivo).toMatchObject({
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: { de: '2026-10-01', ate: '2026-10-31' },
      estudadoSegundos: 0,
      concluidoEm: null,
      situacao: 'em-andamento',
    });
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toEqual([
      objetivo,
    ]);
  });

  it('a barra soma as Sessões da Trilha encerradas no período', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });

    await estudar(companheiro, relogio, trilha.id, 90);
    await estudar(companheiro, relogio, violao.id, 60);
    await estudar(companheiro, relogio, trilha.id, 45);

    const [objetivo] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(objetivo).toMatchObject({ estudadoSegundos: 135 * 60, situacao: 'em-andamento' });
  });

  it('o Objetivo se conclui sozinho quando uma Sessão bate a meta', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 2,
      periodo: 'mes',
    });

    await estudar(companheiro, relogio, trilha.id, 80);
    const [antes] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(antes).toMatchObject({ concluidoEm: null, situacao: 'em-andamento' });

    // A Sessão que passa das 2h vai das 14:20 às 15:10; o Objetivo se conclui no fim dela.
    await estudar(companheiro, relogio, trilha.id, 50);
    const [depois] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(depois).toMatchObject({
      estudadoSegundos: 130 * 60,
      concluidoEm: new Date('2026-10-05T15:10:00Z'),
      situacao: 'concluido',
    });
  });
  it('o período acaba sem bater a meta: o Objetivo fica encerrado', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-30T12:00:00Z');
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });
    await estudar(companheiro, relogio, trilha.id, 60);

    relogio.avancarAte('2026-11-01T02:59:59Z'); // 31/10, 23:59:59 em São Paulo
    const [noUltimoSegundo] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(noUltimoSegundo!.situacao).toBe('em-andamento');

    relogio.avancarAte('2026-11-01T03:00:00Z'); // 1º/11, meia-noite em São Paulo
    const [virado] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(virado).toMatchObject({
      estudadoSegundos: 60 * 60,
      concluidoEm: null,
      situacao: 'encerrado',
    });
  });
});

describe('Objetivo mensurável: regras de criação', () => {
  it('um Objetivo criado com a meta já batida no período nasce concluído', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');
    await estudar(companheiro, relogio, trilha.id, 90);

    const objetivo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 1,
      periodo: 'mes',
    });

    expect(objetivo).toMatchObject({
      estudadoSegundos: 90 * 60,
      concluidoEm: new Date('2026-10-05T14:30:00Z'),
      situacao: 'concluido',
    });
  });

  it('a meta aceita frações de hora', async () => {
    const { companheiro, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');

    const objetivo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 1.5,
      periodo: 'semana',
    });

    expect(objetivo.metaHoras).toBe(1.5);
  });

  it('recusa meta sem horas e período invertido, inválido ou que já acabou', async () => {
    const { companheiro, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');
    const criar = (metaHoras: number, periodo: Periodo) =>
      companheiro.criarObjetivoMensuravel('usuario', { trilhaId: trilha.id, metaHoras, periodo });

    await expect(criar(0, 'mes')).rejects.toThrow(EntradaInvalida);
    await expect(criar(-2, 'mes')).rejects.toThrow(EntradaInvalida);
    await expect(criar(Number.NaN, 'mes')).rejects.toThrow(EntradaInvalida);
    await expect(criar(10, { de: '2026-10-20', ate: '2026-10-10' })).rejects.toThrow(
      EntradaInvalida,
    );
    await expect(criar(10, { de: '2026-10-01', ate: '2026-10-32' })).rejects.toThrow(
      EntradaInvalida,
    );
    await expect(criar(10, { de: '2026-09-01', ate: '2026-10-04' })).rejects.toThrow(
      EntradaInvalida,
    );
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toEqual([]);
  });

  it('o Claude só define Objetivo numa Trilha sem Objetivo em andamento', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-05T12:00:00Z');

    const doClaude = await companheiro.criarObjetivoMensuravel('claude', {
      trilhaId: trilha.id,
      metaHoras: 1,
      periodo: 'semana',
    });
    await expect(
      companheiro.criarObjetivoMensuravel('claude', {
        trilhaId: trilha.id,
        metaHoras: 20,
        periodo: 'mes',
      }),
    ).rejects.toThrow(PermissaoNegada);

    // Batido o Objetivo, a Trilha volta a não ter nenhum em andamento.
    await estudar(companheiro, relogio, trilha.id, 60);
    await companheiro.criarObjetivoMensuravel('claude', {
      trilhaId: trilha.id,
      metaHoras: 20,
      periodo: 'mes',
    });

    const objetivos = await companheiro.listarObjetivos('claude', { trilhaId: trilha.id });
    expect(objetivos.map((o) => [o.id === doClaude.id, o.situacao])).toEqual([
      [true, 'concluido'],
      [false, 'em-andamento'],
    ]);
  });

  it('os Objetivos de um usuário são invisíveis para outro', async () => {
    const ana = await companheiroComTrilha('2026-10-05T12:00:00Z', 'Japonês');
    const bruno = await companheiroComTrilha('2026-10-05T12:00:00Z', 'Violão');
    await ana.companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: ana.trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });

    await expect(
      bruno.companheiro.criarObjetivoMensuravel('usuario', {
        trilhaId: ana.trilha.id,
        metaHoras: 10,
        periodo: 'mes',
      }),
    ).rejects.toThrow();
    expect(
      await bruno.companheiro.listarObjetivos('usuario', { trilhaId: ana.trilha.id }),
    ).toEqual([]);
  });
});

describe('Objetivo mensurável: bordas de período em America/Sao_Paulo', () => {
  it('"no mês" é o mês de São Paulo, mesmo quando em UTC já virou', async () => {
    // 1º/11 em UTC, mas ainda 31/10, 23:00 em São Paulo.
    const { companheiro, trilha } = await companheiroComTrilha('2026-11-01T02:00:00Z');

    const objetivo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });

    expect(objetivo.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
  });

  it('a Sessão conta no mês em que começou, pela hora de São Paulo', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-20T12:00:00Z');
    const outubro = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });
    // Os Objetivos seguem a ordem de criação; no mesmo instante, ela empataria.
    relogio.avancar(MINUTO);
    const novembro = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: { de: '2026-11-01', ate: '2026-11-30' },
    });

    relogio.avancarAte('2026-11-01T02:30:00Z'); // 31/10, 23:30 em São Paulo
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(20 * MINUTO);
    await companheiro.encerrarTimer('usuario');
    relogio.avancarAte('2026-11-01T03:10:00Z'); // 1º/11, 00:10 em São Paulo
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(30 * MINUTO);
    await companheiro.encerrarTimer('usuario');

    const progresso = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(progresso.map((o) => [o.id, o.tipo === 'mensuravel' && o.estudadoSegundos])).toEqual([
      [outubro.id, 20 * 60],
      [novembro.id, 30 * 60],
    ]);
  });

  it('"na semana" vai de segunda a domingo de São Paulo', async () => {
    // Domingo, 11/10, 23:59 em São Paulo; em UTC já é segunda.
    const { companheiro, trilha } = await companheiroComTrilha('2026-10-12T02:59:00Z');

    const domingo = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 5,
      periodo: 'semana',
    });

    expect(domingo.periodo).toEqual({ de: '2026-10-05', ate: '2026-10-11' });
  });

  it('um período escolhido inclui o último dia inteiro, até a meia-noite de São Paulo', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha('2026-10-01T12:00:00Z');
    const quinzena = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: { de: '2026-10-01', ate: '2026-10-15' },
    });
    expect(quinzena.periodo).toEqual({ de: '2026-10-01', ate: '2026-10-15' });

    relogio.avancarAte('2026-10-16T02:50:00Z'); // 15/10, 23:50 em São Paulo
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(5 * MINUTO);
    await companheiro.encerrarTimer('usuario');
    relogio.avancarAte('2026-10-16T03:00:00Z'); // 16/10, meia-noite em São Paulo
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(40 * MINUTO);
    await companheiro.encerrarTimer('usuario');

    const [objetivo] = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(objetivo).toMatchObject({ estudadoSegundos: 5 * 60, situacao: 'encerrado' });
  });
});
