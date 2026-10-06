import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida, PermissaoNegada } from './companheiro';
import { estudar } from '../test/estudar';
import { novoUsuario, relogioFixo } from '../test/usuarios';

async function companheiroComTrilha(agora = '2026-10-08T12:00:00Z', nome = 'Japonês') {
  const relogio = relogioFixo(agora);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome });
  return { companheiro, relogio, trilha };
}

describe('Marcos', () => {
  it('a Trilha nova mira o primeiro Marco, de 10h', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    expect(await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id })).toEqual({
      trilhaId: trilha.id,
      totalSegundos: 0,
      marco: { anterior: 0, proximo: 10 },
      marcoParaCelebrar: null,
    });
  });

  it('os Marcos são 10, 25, 50 e 100h, e depois a cada 100h', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    const marcoCom = async (horasNoTotal: number) => {
      const { totalSegundos } = await companheiro.progressoDaTrilha('usuario', {
        trilhaId: trilha.id,
      });
      await estudar(companheiro, relogio, trilha.id, horasNoTotal * 60 - totalSegundos / 60);
      return (await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id })).marco;
    };

    expect(await marcoCom(9.5)).toEqual({ anterior: 0, proximo: 10 });
    expect(await marcoCom(10)).toEqual({ anterior: 10, proximo: 25 });
    expect(await marcoCom(30)).toEqual({ anterior: 25, proximo: 50 });
    expect(await marcoCom(99)).toEqual({ anterior: 50, proximo: 100 });
    expect(await marcoCom(100)).toEqual({ anterior: 100, proximo: 200 });
    expect(await marcoCom(250)).toEqual({ anterior: 200, proximo: 300 });
  });
});

describe('Celebração de Marco', () => {
  it('bater um Marco pede celebração uma vez só, em qualquer aparelho', async () => {
    const supabase = await novoUsuario();
    const relogio = relogioFixo('2026-10-08T12:00:00Z');
    const notebook = criarCompanheiro({ supabase, relogio });
    const trilha = await notebook.criarTrilha('usuario', { nome: 'Japonês' });
    const paraCelebrar = async (companheiro = notebook) =>
      (await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id })).marcoParaCelebrar;

    await estudar(notebook, relogio, trilha.id, 9 * 60 + 59);
    expect(await paraCelebrar()).toBeNull();
    await estudar(notebook, relogio, trilha.id, 1);
    expect(await paraCelebrar()).toBe(10);

    const celular = criarCompanheiro({ supabase, relogio });
    await celular.celebrarMarco('usuario', { trilhaId: trilha.id, marco: 10 });
    expect(await paraCelebrar()).toBeNull();
    expect(await paraCelebrar(celular)).toBeNull();

    await estudar(notebook, relogio, trilha.id, 14 * 60);
    expect(await paraCelebrar()).toBeNull();
    await estudar(notebook, relogio, trilha.id, 60);
    expect(await paraCelebrar()).toBe(25);
  });

  it('uma Sessão que passa por dois Marcos celebra só o maior', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await estudar(companheiro, relogio, trilha.id, 30 * 60);
    const progresso = await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id });
    expect(progresso.marcoParaCelebrar).toBe(25);

    await companheiro.celebrarMarco('usuario', { trilhaId: trilha.id, marco: 25 });
    expect(
      (await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id })).marcoParaCelebrar,
    ).toBeNull();
  });

  it('só se celebra um Marco já batido', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    await estudar(companheiro, relogio, trilha.id, 12 * 60);

    await expect(
      companheiro.celebrarMarco('usuario', { trilhaId: trilha.id, marco: 25 }),
    ).rejects.toThrow(EntradaInvalida);
    await expect(
      companheiro.celebrarMarco('usuario', { trilhaId: trilha.id, marco: 7 }),
    ).rejects.toThrow(EntradaInvalida);
    expect(
      (await companheiro.progressoDaTrilha('usuario', { trilhaId: trilha.id })).marcoParaCelebrar,
    ).toBe(10);
  });

  it('o Claude vê o Marco a celebrar, mas não o marca como celebrado', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    await estudar(companheiro, relogio, trilha.id, 10 * 60);

    await expect(
      companheiro.celebrarMarco('claude', { trilhaId: trilha.id, marco: 10 }),
    ).rejects.toThrow(PermissaoNegada);
    expect(await companheiro.progressoDaTrilha('claude', { trilhaId: trilha.id })).toMatchObject({
      totalSegundos: 10 * 3600,
      marcoParaCelebrar: 10,
    });
  });

  it('o progresso e as celebrações de um usuário são invisíveis para outro', async () => {
    const ana = await companheiroComTrilha();
    const bruno = await companheiroComTrilha();
    await estudar(ana.companheiro, ana.relogio, ana.trilha.id, 10 * 60);

    expect(
      await bruno.companheiro.progressoDaTrilha('usuario', { trilhaId: ana.trilha.id }),
    ).toMatchObject({ totalSegundos: 0, marcoParaCelebrar: null });
    await expect(
      bruno.companheiro.celebrarMarco('usuario', { trilhaId: ana.trilha.id, marco: 10 }),
    ).rejects.toThrow();
    expect(
      (await ana.companheiro.progressoDaTrilha('usuario', { trilhaId: ana.trilha.id }))
        .marcoParaCelebrar,
    ).toBe(10);
  });
});
