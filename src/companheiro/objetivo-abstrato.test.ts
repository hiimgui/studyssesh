import { describe, expect, it } from 'vitest';
import {
  criarCompanheiro,
  EntradaInvalida,
  objetivoParaCelebrar,
  PermissaoNegada,
  semObjetivoEmAndamento,
} from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const DIA = 24 * 60 * 60_000;

async function companheiroComTrilha(nome = 'Claude Certified Architect') {
  const relogio = relogioFixo('2026-10-08T12:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome });
  return { companheiro, relogio, trilha };
}

describe('Objetivo abstrato', () => {
  it('cria um Objetivo abstrato, em andamento e sem itens ligados', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: '  Conseguir a certificação  ',
    });

    expect(objetivo).toMatchObject({
      tipo: 'abstrato',
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
      criadoEm: new Date('2026-10-08T12:00:00Z'),
      concluidoEm: null,
      itens: { concluidos: 0, total: 0 },
      situacao: 'em-andamento',
    });
    const objetivos = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(objetivos).toEqual([objetivo]);
    expect(semObjetivoEmAndamento(objetivos)).toBe(false);
  });

  it('um Objetivo abstrato precisa dizer o que se quer alcançar', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    await expect(
      companheiro.criarObjetivoAbstrato('usuario', { trilhaId: trilha.id, descricao: '   ' }),
    ).rejects.toThrow(EntradaInvalida);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toEqual([]);
  });

  it('o usuário conclui o Objetivo abstrato quando julga que chegou lá', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });

    relogio.avancar(30 * DIA);
    const concluido = await companheiro.concluirObjetivo('usuario', { objetivoId: objetivo.id });
    relogio.avancar(DIA);
    // Concluir de novo (ex.: clique duplo) não muda a data.
    await companheiro.concluirObjetivo('usuario', { objetivoId: objetivo.id });

    expect(concluido).toMatchObject({
      situacao: 'concluido',
      concluidoEm: new Date('2026-11-07T12:00:00Z'),
    });
    const objetivos = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(objetivos).toEqual([concluido]);
    expect(semObjetivoEmAndamento(objetivos)).toBe(true);
  });

  it('o Objetivo mensurável não se conclui na mão: ele se conclui ao bater a meta', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();
    const mensuravel = await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'mes',
    });

    await expect(
      companheiro.concluirObjetivo('usuario', { objetivoId: mensuravel.id }),
    ).rejects.toThrow(EntradaInvalida);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toMatchObject([
      { situacao: 'em-andamento' },
    ]);
  });

  it('o Objetivo concluído é celebrado até a Trilha ganhar um novo', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });
    const listar = () => companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });

    expect(objetivoParaCelebrar(await listar())).toBeNull();
    await companheiro.concluirObjetivo('usuario', { objetivoId: objetivo.id });
    expect(objetivoParaCelebrar(await listar())).toMatchObject({ id: objetivo.id });

    relogio.avancar(DIA);
    await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Passar no exame avançado',
    });
    expect(objetivoParaCelebrar(await listar())).toBeNull();
  });

  it('bater a meta de um Objetivo mensurável também é celebrado', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 1,
      periodo: 'semana',
    });

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(60 * 60_000);
    await companheiro.encerrarTimer('usuario');

    expect(
      objetivoParaCelebrar(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })),
    ).toMatchObject({ tipo: 'mensuravel', situacao: 'concluido' });
  });

  it('se o último Objetivo a acabar ficou encerrado, não há o que celebrar', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();
    const certificacao = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });
    await companheiro.concluirObjetivo('usuario', { objetivoId: certificacao.id });
    await companheiro.criarObjetivoMensuravel('usuario', {
      trilhaId: trilha.id,
      metaHoras: 10,
      periodo: 'semana',
    });

    relogio.avancar(7 * DIA);

    const objetivos = await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id });
    expect(objetivos.map((o) => o.situacao)).toEqual(['concluido', 'encerrado']);
    expect(objetivoParaCelebrar(objetivos)).toBeNull();
  });

  it('o Claude define um Objetivo abstrato só numa Trilha sem Objetivo em andamento', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();

    const doClaude = await companheiro.criarObjetivoAbstrato('claude', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });
    await expect(
      companheiro.criarObjetivoAbstrato('claude', { trilhaId: trilha.id, descricao: 'Outro' }),
    ).rejects.toThrow(PermissaoNegada);

    expect(await companheiro.listarObjetivos('usuario', { trilhaId: trilha.id })).toEqual([
      doClaude,
    ]);
  });

  it('o Claude não conclui Objetivos: ele nunca edita', async () => {
    const { companheiro, trilha } = await companheiroComTrilha();
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
      trilhaId: trilha.id,
      descricao: 'Conseguir a certificação',
    });

    await expect(
      companheiro.concluirObjetivo('claude', { objetivoId: objetivo.id }),
    ).rejects.toThrow(PermissaoNegada);
    expect(await companheiro.listarObjetivos('claude', { trilhaId: trilha.id })).toEqual([objetivo]);
  });
});
