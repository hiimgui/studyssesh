import { describe, expect, it } from 'vitest';
import { criarCompanheiro, PermissaoNegada, SemTimerLigado, TimerJaLigado } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function companheiroComTrilha(nome = 'Japonês') {
  const relogio = relogioFixo('2026-10-05T12:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome });
  return { companheiro, relogio, trilha };
}

describe('Timer → Sessão', () => {
  it('iniciar e encerrar o timer gera uma Sessão com início, fim e duração', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(25 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');

    expect(sessao).toMatchObject({
      trilhaId: trilha.id,
      inicio: new Date('2026-10-05T12:00:00Z'),
      fim: new Date('2026-10-05T12:25:00Z'),
      duracaoSegundos: 25 * 60,
      nota: null,
    });
    expect(await companheiro.listarSessoes('usuario', { trilhaId: trilha.id })).toEqual([sessao]);
  });

  it('as pausas são descontadas da duração', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(20 * MINUTO);
    await companheiro.pausarTimer('usuario');
    relogio.avancar(10 * MINUTO);
    await companheiro.retomarTimer('usuario');
    relogio.avancar(15 * MINUTO);
    await companheiro.pausarTimer('usuario');
    relogio.avancar(5 * MINUTO);
    await companheiro.retomarTimer('usuario');
    relogio.avancar(5 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');

    expect(sessao).toMatchObject({
      inicio: new Date('2026-10-05T12:00:00Z'),
      fim: new Date('2026-10-05T12:55:00Z'),
      duracaoSegundos: 40 * 60,
    });
  });

  it('encerrar um timer pausado fecha a Sessão no momento da pausa', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(30 * MINUTO);
    await companheiro.pausarTimer('usuario');
    relogio.avancar(2 * 60 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');

    expect(sessao).toMatchObject({
      fim: new Date('2026-10-05T12:30:00Z'),
      duracaoSegundos: 30 * 60,
    });
  });

  it('só há um timer ligado por vez, em todas as Trilhas', async () => {
    const { companheiro, relogio, trilha: japones } = await companheiroComTrilha('Japonês');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });

    await companheiro.iniciarTimer('usuario', { trilhaId: japones.id });
    await expect(
      companheiro.iniciarTimer('usuario', { trilhaId: violao.id }),
    ).rejects.toThrow(TimerJaLigado);
    await expect(
      companheiro.iniciarTimer('usuario', { trilhaId: japones.id }),
    ).rejects.toThrow(TimerJaLigado);

    relogio.avancar(10 * MINUTO);
    await companheiro.encerrarTimer('usuario');
    await companheiro.iniciarTimer('usuario', { trilhaId: violao.id });
    relogio.avancar(10 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');

    expect(sessao.trilhaId).toBe(violao.id);
  });

  it('a Sessão pode levar uma nota opcional; nota em branco vira nenhuma nota', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(30 * MINUTO);
    const comNota = await companheiro.encerrarTimer('usuario', {
      nota: '  Kanji da lição 4 e revisão no Anki ',
    });
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(30 * MINUTO);
    const emBranco = await companheiro.encerrarTimer('usuario', { nota: '   ' });

    expect(comNota.nota).toBe('Kanji da lição 4 e revisão no Anki');
    expect(emBranco.nota).toBeNull();
  });

  it('a Trilha lista só as próprias Sessões, das mais recentes para as mais antigas', async () => {
    const { companheiro, relogio, trilha: japones } = await companheiroComTrilha('Japonês');
    const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
    const estudar = async (trilhaId: string, nota: string) => {
      await companheiro.iniciarTimer('usuario', { trilhaId });
      relogio.avancar(20 * MINUTO);
      await companheiro.encerrarTimer('usuario', { nota });
      relogio.avancar(60 * MINUTO);
    };

    await estudar(japones.id, 'hiragana');
    await estudar(violao.id, 'escalas');
    await estudar(japones.id, 'katakana');
    await estudar(japones.id, 'kanji');

    const doJapones = await companheiro.listarSessoes('usuario', { trilhaId: japones.id });
    expect(doJapones.map((s) => s.nota)).toEqual(['kanji', 'katakana', 'hiragana']);

    const recentes = await companheiro.listarSessoes('usuario', { trilhaId: japones.id, limite: 2 });
    expect(recentes.map((s) => s.nota)).toEqual(['kanji', 'katakana']);
  });

  it('sem timer ligado não há o que pausar, retomar ou encerrar', async () => {
    const { companheiro } = await companheiroComTrilha();

    await expect(companheiro.pausarTimer('usuario')).rejects.toThrow(SemTimerLigado);
    await expect(companheiro.retomarTimer('usuario')).rejects.toThrow(SemTimerLigado);
    await expect(companheiro.encerrarTimer('usuario')).rejects.toThrow(SemTimerLigado);
  });

  it('pausar ou retomar de novo não muda nada (ex.: o mesmo clique em dois aparelhos)', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(10 * MINUTO);
    await companheiro.retomarTimer('usuario');
    await companheiro.pausarTimer('usuario');
    relogio.avancar(5 * MINUTO);
    await companheiro.pausarTimer('usuario');
    relogio.avancar(5 * MINUTO);
    await companheiro.retomarTimer('usuario');
    await companheiro.retomarTimer('usuario');
    relogio.avancar(10 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');

    expect(sessao.duracaoSegundos).toBe(20 * 60);
    await expect(companheiro.encerrarTimer('usuario')).rejects.toThrow(SemTimerLigado);
  });

  it('o Claude lê o timer e as Sessões, mas não liga, pausa, retoma nem encerra o timer', async () => {
    const { companheiro, relogio, trilha } = await companheiroComTrilha();

    await expect(
      companheiro.iniciarTimer('claude', { trilhaId: trilha.id }),
    ).rejects.toThrow(PermissaoNegada);
    await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(10 * MINUTO);
    await expect(companheiro.pausarTimer('claude')).rejects.toThrow(PermissaoNegada);
    await companheiro.pausarTimer('usuario');
    await expect(companheiro.retomarTimer('claude')).rejects.toThrow(PermissaoNegada);
    await expect(companheiro.encerrarTimer('claude')).rejects.toThrow(PermissaoNegada);

    expect(await companheiro.timerLigado('claude')).toMatchObject({ pausado: true });
    const sessao = await companheiro.encerrarTimer('usuario');
    expect(await companheiro.listarSessoes('claude', { trilhaId: trilha.id })).toEqual([sessao]);
  });

  it('o timer e as Sessões de um usuário são invisíveis para outro', async () => {
    const ana = await companheiroComTrilha('Japonês');
    const bruno = await companheiroComTrilha('Violão');

    await ana.companheiro.iniciarTimer('usuario', { trilhaId: ana.trilha.id });
    expect(await bruno.companheiro.timerLigado('usuario')).toBeNull();
    await expect(
      bruno.companheiro.iniciarTimer('usuario', { trilhaId: ana.trilha.id }),
    ).rejects.toThrow();
    expect(await bruno.companheiro.timerLigado('usuario')).toBeNull();

    ana.relogio.avancar(10 * MINUTO);
    await ana.companheiro.encerrarTimer('usuario');
    expect(await bruno.companheiro.listarSessoes('usuario', { trilhaId: ana.trilha.id })).toEqual(
      [],
    );
  });

  it('o timer vive no servidor: outra instância vê o timer ligado e o tempo estudado', async () => {
    const supabase = await novoUsuario();
    const relogio = relogioFixo('2026-10-05T12:00:00Z');
    const notebook = criarCompanheiro({ supabase, relogio });
    const trilha = await notebook.criarTrilha('usuario', { nome: 'Japonês' });

    expect(await notebook.timerLigado('usuario')).toBeNull();
    await notebook.iniciarTimer('usuario', { trilhaId: trilha.id });
    relogio.avancar(10 * MINUTO);
    await notebook.pausarTimer('usuario');
    relogio.avancar(5 * MINUTO);
    await notebook.retomarTimer('usuario');
    relogio.avancar(7 * MINUTO);

    const celular = criarCompanheiro({ supabase, relogio });
    expect(await celular.timerLigado('usuario')).toEqual({
      trilhaId: trilha.id,
      iniciadoEm: new Date('2026-10-05T12:00:00Z'),
      pausado: false,
      estudadoMs: 17 * MINUTO,
    });

    await celular.pausarTimer('usuario');
    relogio.avancar(30 * MINUTO);
    expect(await notebook.timerLigado('usuario')).toMatchObject({
      pausado: true,
      estudadoMs: 17 * MINUTO,
    });
  });
});
