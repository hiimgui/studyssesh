import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida, PermissaoNegada } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

describe('Trilhas', () => {
  it('o usuário cria uma Trilha e ela aparece entre as suas Trilhas', async () => {
    const companheiro = criarCompanheiro({
      supabase: await novoUsuario(),
      relogio: relogioFixo('2026-10-05T12:00:00Z'),
    });

    const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });

    expect(trilha).toMatchObject({
      nome: 'Claude Certified Architect',
      criadaEm: new Date('2026-10-05T12:00:00Z'),
    });
    expect(await companheiro.listarTrilhas('usuario')).toEqual([trilha]);
  });

  it('várias Trilhas aparecem na ordem em que foram criadas', async () => {
    const relogio = relogioFixo('2026-10-05T12:00:00Z');
    const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });

    await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
    relogio.avancar(60_000);
    await companheiro.criarTrilha('usuario', { nome: 'Álgebra linear' });
    relogio.avancar(60_000);
    await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });

    const trilhas = await companheiro.listarTrilhas('usuario');
    expect(trilhas.map((t) => t.nome)).toEqual([
      'Japonês',
      'Álgebra linear',
      'Claude Certified Architect',
    ]);
  });

  it('as Trilhas de um usuário são invisíveis para outro', async () => {
    const relogio = relogioFixo('2026-10-05T12:00:00Z');
    const ana = criarCompanheiro({ supabase: await novoUsuario(), relogio });
    const bruno = criarCompanheiro({ supabase: await novoUsuario(), relogio });

    await ana.criarTrilha('usuario', { nome: 'Japonês' });
    await bruno.criarTrilha('usuario', { nome: 'Violão' });

    expect((await ana.listarTrilhas('usuario')).map((t) => t.nome)).toEqual(['Japonês']);
    expect((await bruno.listarTrilhas('usuario')).map((t) => t.nome)).toEqual(['Violão']);
  });

  it('uma Trilha precisa de nome; espaços nas pontas são descartados', async () => {
    const companheiro = criarCompanheiro({
      supabase: await novoUsuario(),
      relogio: relogioFixo('2026-10-05T12:00:00Z'),
    });

    await expect(companheiro.criarTrilha('usuario', { nome: '   ' })).rejects.toThrow(
      EntradaInvalida,
    );
    const trilha = await companheiro.criarTrilha('usuario', { nome: '  Japonês  ' });

    expect(trilha.nome).toBe('Japonês');
    expect(await companheiro.listarTrilhas('usuario')).toEqual([trilha]);
  });

  it('o Claude não cria Trilhas: criar Trilha é só do usuário', async () => {
    const companheiro = criarCompanheiro({
      supabase: await novoUsuario(),
      relogio: relogioFixo('2026-10-05T12:00:00Z'),
    });

    await expect(companheiro.criarTrilha('claude', { nome: 'Inventada' })).rejects.toThrow(
      PermissaoNegada,
    );
    expect(await companheiro.listarTrilhas('claude')).toEqual([]);
  });
});
