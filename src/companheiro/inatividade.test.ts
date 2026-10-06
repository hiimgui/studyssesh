import { describe, expect, it } from 'vitest';
import { criarCompanheiro, EntradaInvalida, PermissaoNegada } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

async function estudandoJapones() {
  const relogio = relogioFixo('2026-10-07T12:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
  await companheiro.iniciarTimer('usuario', { trilhaId: trilha.id });
  return { companheiro, relogio, trilha };
}

describe('Inatividade', () => {
  it('1h sem interação pausa o timer sozinho, no momento em que a hora se completa', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(59 * MINUTO);
    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: false,
      pausadoPorInatividade: false,
    });

    relogio.avancar(2 * 60 * MINUTO);
    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: true,
      pausadoPorInatividade: true,
      estudadoMs: 60 * MINUTO,
    });
  });

  it('uma interação antes de 1h reinicia a contagem de Inatividade', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(50 * MINUTO);
    await companheiro.registrarInteracao('usuario');
    relogio.avancar(50 * MINUTO);

    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: false,
      estudadoMs: 100 * MINUTO,
    });

    relogio.avancar(10 * MINUTO);
    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: true,
      pausadoPorInatividade: true,
      estudadoMs: 110 * MINUTO,
    });
  });

  it('retomar o timer também conta como interação', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(10 * MINUTO);
    await companheiro.pausarTimer('usuario');
    relogio.avancar(10 * MINUTO);
    await companheiro.retomarTimer('usuario');
    relogio.avancar(59 * MINUTO);

    expect(await companheiro.timerLigado('usuario')).toMatchObject({ pausado: false });
  });

  it('na volta, o usuário diz até quando estudou e a Sessão termina ali', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(150 * MINUTO);
    await companheiro.informarFimDoEstudo('usuario', { ate: new Date('2026-10-07T12:40:00Z') });

    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: true,
      pausadoPorInatividade: false,
      estudadoMs: 40 * MINUTO,
    });
    const sessao = await companheiro.encerrarTimer('usuario');
    expect(sessao).toMatchObject({
      fim: new Date('2026-10-07T12:40:00Z'),
      duracaoSegundos: 40 * 60,
    });
  });

  it('quem estudou longe da tela pode dizer que foi além da pausa automática', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(150 * MINUTO);
    await companheiro.informarFimDoEstudo('usuario', { ate: new Date('2026-10-07T14:00:00Z') });
    relogio.avancar(5 * MINUTO);
    await companheiro.retomarTimer('usuario');
    relogio.avancar(20 * MINUTO);

    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: false,
      estudadoMs: 140 * MINUTO,
    });
  });

  it('o fim informado fica entre a última interação e agora', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(30 * MINUTO);
    await companheiro.registrarInteracao('usuario');
    relogio.avancar(120 * MINUTO);

    await expect(
      companheiro.informarFimDoEstudo('usuario', { ate: new Date('2026-10-07T12:20:00Z') }),
    ).rejects.toThrow(EntradaInvalida);
    await expect(
      companheiro.informarFimDoEstudo('usuario', { ate: new Date('2026-10-07T15:00:00Z') }),
    ).rejects.toThrow(EntradaInvalida);
    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausadoPorInatividade: true,
      estudadoMs: 90 * MINUTO,
    });
  });

  it('só se informa o fim do estudo depois de uma pausa por Inatividade', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(20 * MINUTO);
    const ate = new Date('2026-10-07T12:10:00Z');
    await expect(companheiro.informarFimDoEstudo('usuario', { ate })).rejects.toThrow(
      EntradaInvalida,
    );
    await companheiro.pausarTimer('usuario');
    await expect(companheiro.informarFimDoEstudo('usuario', { ate })).rejects.toThrow(
      EntradaInvalida,
    );
  });

  it('o Claude não responde pela pessoa nem conta como interação', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(50 * MINUTO);
    await expect(companheiro.registrarInteracao('claude')).rejects.toThrow(PermissaoNegada);
    relogio.avancar(30 * MINUTO);
    await expect(
      companheiro.informarFimDoEstudo('claude', { ate: new Date('2026-10-07T12:30:00Z') }),
    ).rejects.toThrow(PermissaoNegada);

    expect(await companheiro.timerLigado('claude')).toMatchObject({
      pausadoPorInatividade: true,
      estudadoMs: 60 * MINUTO,
    });
  });

  it('sem responder, retomar ou encerrar parte da pausa automática', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(90 * MINUTO);
    await companheiro.retomarTimer('usuario');
    relogio.avancar(20 * MINUTO);
    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: false,
      pausadoPorInatividade: false,
      estudadoMs: 80 * MINUTO,
    });

    // Retomado às 13:30 e sem nova interação: pausa de novo às 14:30.
    relogio.avancar(2 * 60 * MINUTO);
    const sessao = await companheiro.encerrarTimer('usuario');
    expect(sessao).toMatchObject({
      fim: new Date('2026-10-07T14:30:00Z'),
      duracaoSegundos: 120 * 60,
    });
  });

  it('interagir depois da hora completa não desfaz a pausa por Inatividade', async () => {
    const { companheiro, relogio } = await estudandoJapones();

    relogio.avancar(90 * MINUTO);
    await companheiro.registrarInteracao('usuario');

    expect(await companheiro.timerLigado('usuario')).toMatchObject({
      pausado: true,
      pausadoPorInatividade: true,
      estudadoMs: 60 * MINUTO,
    });
  });
});
