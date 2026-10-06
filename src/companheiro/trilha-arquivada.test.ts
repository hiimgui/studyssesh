import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida, PermissaoNegada } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function japonesComHistorico() {
  const relogio = relogioFixo('2026-10-08T12:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
  // As abas seguem a ordem de criação; no mesmo instante, a ordem empataria.
  relogio.avancar(MINUTO);
  const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: japones.id,
    descricao: 'Passar no JLPT N5',
  });
  await companheiro.iniciarTimer('usuario', { trilhaId: japones.id });
  relogio.avancar(40 * MINUTO);
  const sessao = await companheiro.encerrarTimer('usuario', { nota: 'simulado' });
  await companheiro.concluirObjetivo('usuario', { objetivoId: objetivo.id });
  return { companheiro, relogio, japones, violao, sessao };
}

describe('Trilha arquivada', () => {
  it('sai das abas e vai para as arquivadas, com o histórico intacto', async () => {
    const { companheiro, relogio, japones, violao, sessao } = await japonesComHistorico();
    const objetivos = await companheiro.listarObjetivos('usuario', { trilhaId: japones.id });

    relogio.avancar(MINUTO);
    await companheiro.arquivarTrilha('usuario', { trilhaId: japones.id });

    expect(await companheiro.listarTrilhas('usuario')).toEqual([violao]);
    expect(await companheiro.listarTrilhasArquivadas('usuario')).toEqual([
      { ...japones, arquivadaEm: new Date('2026-10-08T12:42:00Z') },
    ]);
    expect(await companheiro.listarSessoes('usuario', { trilhaId: japones.id })).toEqual([sessao]);
    expect(await companheiro.listarObjetivos('usuario', { trilhaId: japones.id })).toEqual(
      objetivos,
    );
  });

  it('numa Trilha arquivada não se liga timer nem se define Objetivo', async () => {
    const { companheiro, japones } = await japonesComHistorico();
    await companheiro.arquivarTrilha('usuario', { trilhaId: japones.id });

    await expect(companheiro.iniciarTimer('usuario', { trilhaId: japones.id })).rejects.toThrow(
      EntradaInvalida,
    );
    await expect(
      companheiro.criarObjetivoAbstrato('usuario', { trilhaId: japones.id, descricao: 'N4' }),
    ).rejects.toThrow(EntradaInvalida);
    await expect(
      companheiro.criarObjetivoMensuravel('usuario', {
        trilhaId: japones.id,
        metaHoras: 5,
        periodo: 'mes',
      }),
    ).rejects.toThrow(EntradaInvalida);
    expect(await companheiro.timerLigado('usuario')).toBeNull();
  });

  it('não se arquiva a Trilha com o timer ligado nela', async () => {
    const { companheiro, japones } = await japonesComHistorico();
    await companheiro.iniciarTimer('usuario', { trilhaId: japones.id });

    await expect(companheiro.arquivarTrilha('usuario', { trilhaId: japones.id })).rejects.toThrow(
      EntradaInvalida,
    );
    expect((await companheiro.listarTrilhas('usuario')).map((t) => t.nome)).toEqual([
      'Japonês',
      'Violão',
    ]);
  });

  it('o Claude não arquiva Trilhas, mas lê as arquivadas', async () => {
    const { companheiro, japones } = await japonesComHistorico();

    await expect(companheiro.arquivarTrilha('claude', { trilhaId: japones.id })).rejects.toThrow(
      PermissaoNegada,
    );
    await companheiro.arquivarTrilha('usuario', { trilhaId: japones.id });
    expect((await companheiro.listarTrilhasArquivadas('claude')).map((t) => t.nome)).toEqual([
      'Japonês',
    ]);
  });
});
