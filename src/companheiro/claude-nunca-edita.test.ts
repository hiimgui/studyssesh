// O teste mais importante do projeto (ADR 0002): pelo conector, o Claude lê
// tudo e só cria Sessões e Objetivos. Ele nunca edita nem apaga.
import { describe, expect, it } from 'vitest';
import { criarCompanheiro, PermissaoNegada, type Companheiro } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const MINUTO = 60_000;

type Operacao = keyof Companheiro;

// Toda operação do Companheiro está em exatamente um destes grupos. Uma
// operação nova que não for classificada aqui quebra o primeiro teste.
const LEITURAS: Operacao[] = [
  'listarTrilhas',
  'listarTrilhasArquivadas',
  'timerLigado',
  'listarSessoes',
  'listarObjetivos',
  'progressoDaTrilha',
  'inicio',
  'listarResumos',
  'historicoDeResumos',
  'listarBiblioteca',
  'listarDecisoes',
  'baixarDeck',
];
// O Claude cria: Resumos (com Recomendações), toda semana; e, a pedido do
// usuário pelo chat, Sessões com nota, Objetivo numa Trilha sem Objetivo em
// andamento e Decisões (aceitar ou recusar Recomendação).
const CRIACOES_DO_CLAUDE: Operacao[] = [
  'criarResumo',
  'registrarSessao',
  'criarObjetivoMensuravel',
  'criarObjetivoAbstrato',
  'decidirRecomendacao',
];
// Todo o resto muda o que já existe (ou é gesto do usuário no app).
const SO_DO_USUARIO: Operacao[] = [
  'criarTrilha',
  'arquivarTrilha',
  'registrarInteracao',
  'informarFimDoEstudo',
  'iniciarTimer',
  'pausarTimer',
  'retomarTimer',
  'encerrarTimer',
  'concluirObjetivo',
  'celebrarMarco',
  'marcarItemFeito',
];

// Uma conta com de tudo: Trilha ativa e arquivada, Sessões, Objetivos dos dois
// tipos, um Resumo com uma Recomendação aceita (na Biblioteca) e outra em
// aberto, um Marco batido e o timer ligado (pausado por Inatividade).
async function contaCheia() {
  const relogio = relogioFixo('2026-10-09T12:00:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const japones = await companheiro.criarTrilha('usuario', { nome: 'Japonês' });
  const violao = await companheiro.criarTrilha('usuario', { nome: 'Violão' });
  const abstrato = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: japones.id,
    descricao: 'Passar no JLPT N5',
  });
  await companheiro.criarObjetivoMensuravel('usuario', {
    trilhaId: japones.id,
    metaHoras: 40,
    periodo: 'mes',
  });
  const resumoDa = (semanaDe: string, texto: string) =>
    companheiro.criarResumo('claude', {
      trilhaId: japones.id,
      semanaDe,
      texto,
      fontes: [{ titulo: 'JLPT', url: 'https://www.jlpt.jp' }],
      recomendacoes: [
        {
          objetivoId: abstrato.id,
          tipo: 'material',
          titulo: 'Simulado oficial',
          descricao: 'Para medir o ritmo.',
          url: 'https://www.jlpt.jp/e/samples',
        },
        {
          objetivoId: abstrato.id,
          tipo: 'deck',
          titulo: 'Kana em 2 semanas',
          descricao: 'Revisão diária.',
          cartas: [{ frente: 'あ', verso: 'a' }],
        },
        {
          objetivoId: abstrato.id,
          tipo: 'deck',
          titulo: 'Vocabulário N5',
          descricao: 'As palavras do simulado.',
          cartas: [{ frente: '水', verso: 'água' }],
        },
      ],
    });
  const primeiro = await resumoDa('2026-09-28', 'Semana de kana.');
  const [simulado, deckEmAberto, vocabulario] = primeiro.recomendacoes;
  await companheiro.decidirRecomendacao('usuario', { recomendacaoId: simulado.id, resposta: 'aceita' });
  // Um depois do outro: a Biblioteca fica na ordem em que os itens entraram.
  relogio.avancar(MINUTO);
  await companheiro.decidirRecomendacao('usuario', { recomendacaoId: vocabulario.id, resposta: 'aceita' });
  const [itemDaBiblioteca, deckNaBiblioteca] = await companheiro.listarBiblioteca('usuario', {
    trilhaId: japones.id,
  });
  await companheiro.registrarSessao('usuario', {
    trilhaId: japones.id,
    minutos: 11 * 60,
    nota: 'Maratona de kana',
    fim: new Date('2026-10-09T11:00:00Z'),
  });
  await companheiro.registrarSessao('usuario', {
    trilhaId: violao.id,
    minutos: 30,
    nota: 'Escalas',
    fim: new Date('2026-10-09T11:30:00Z'),
  });
  await companheiro.arquivarTrilha('usuario', { trilhaId: violao.id });
  await companheiro.iniciarTimer('usuario', { trilhaId: japones.id });
  relogio.avancar(90 * MINUTO);

  // Tudo o que o usuário veria, pelos olhos do Claude.
  const retrato = async () => ({
    trilhas: await companheiro.listarTrilhas('claude'),
    arquivadas: await companheiro.listarTrilhasArquivadas('claude'),
    timer: await companheiro.timerLigado('claude'),
    sessoes: [
      ...(await companheiro.listarSessoes('claude', { trilhaId: japones.id })),
      ...(await companheiro.listarSessoes('claude', { trilhaId: violao.id })),
    ],
    objetivos: await companheiro.listarObjetivos('claude', { trilhaId: japones.id }),
    progresso: await companheiro.progressoDaTrilha('claude', { trilhaId: japones.id }),
    inicio: await companheiro.inicio('claude'),
    resumos: await companheiro.listarResumos('claude', { trilhaId: japones.id }),
    biblioteca: await companheiro.listarBiblioteca('claude', { trilhaId: japones.id }),
    decisoes: await companheiro.listarDecisoes('claude', { trilhaId: japones.id }),
  });

  // Uma chamada plausível de cada operação, com dados de verdade da conta.
  const chamar: Record<Operacao, () => Promise<unknown>> = {
    listarTrilhas: () => companheiro.listarTrilhas('claude'),
    listarTrilhasArquivadas: () => companheiro.listarTrilhasArquivadas('claude'),
    timerLigado: () => companheiro.timerLigado('claude'),
    listarSessoes: () => companheiro.listarSessoes('claude', { trilhaId: japones.id }),
    listarObjetivos: () => companheiro.listarObjetivos('claude', { trilhaId: japones.id }),
    progressoDaTrilha: () => companheiro.progressoDaTrilha('claude', { trilhaId: japones.id }),
    inicio: () => companheiro.inicio('claude'),
    listarResumos: () => companheiro.listarResumos('claude', { trilhaId: japones.id }),
    historicoDeResumos: () => companheiro.historicoDeResumos('claude', { trilhaId: japones.id }),
    listarBiblioteca: () => companheiro.listarBiblioteca('claude', { trilhaId: japones.id }),
    listarDecisoes: () => companheiro.listarDecisoes('claude', { trilhaId: japones.id }),
    baixarDeck: () => companheiro.baixarDeck('claude', { itemId: deckNaBiblioteca.id }),
    criarResumo: () => resumoDa('2026-10-05', 'Semana de kanji.'),
    registrarSessao: () =>
      companheiro.registrarSessao('claude', { trilhaId: japones.id, minutos: 5, nota: 'x' }),
    criarObjetivoMensuravel: () =>
      companheiro.criarObjetivoMensuravel('claude', {
        trilhaId: japones.id,
        metaHoras: 1,
        periodo: 'semana',
      }),
    criarObjetivoAbstrato: () =>
      companheiro.criarObjetivoAbstrato('claude', { trilhaId: japones.id, descricao: 'x' }),
    criarTrilha: () => companheiro.criarTrilha('claude', { nome: 'Inventada' }),
    arquivarTrilha: () => companheiro.arquivarTrilha('claude', { trilhaId: japones.id }),
    registrarInteracao: () => companheiro.registrarInteracao('claude'),
    informarFimDoEstudo: () =>
      companheiro.informarFimDoEstudo('claude', { ate: new Date('2026-10-09T12:30:00Z') }),
    iniciarTimer: () => companheiro.iniciarTimer('claude', { trilhaId: japones.id }),
    pausarTimer: () => companheiro.pausarTimer('claude'),
    retomarTimer: () => companheiro.retomarTimer('claude'),
    encerrarTimer: () => companheiro.encerrarTimer('claude', { nota: 'x' }),
    concluirObjetivo: () => companheiro.concluirObjetivo('claude', { objetivoId: abstrato.id }),
    celebrarMarco: () => companheiro.celebrarMarco('claude', { trilhaId: japones.id, marco: 10 }),
    decidirRecomendacao: () =>
      companheiro.decidirRecomendacao('claude', { recomendacaoId: deckEmAberto.id, resposta: 'aceita' }),
    marcarItemFeito: () =>
      companheiro.marcarItemFeito('claude', { itemId: itemDaBiblioteca.id, feito: true }),
  };

  return { companheiro, relogio, japones, violao, retrato, chamar, resumoDa, deckEmAberto };
}

describe('O Claude nunca edita nem apaga (ADR 0002)', () => {
  it('toda operação do Companheiro está classificada: leitura, criação do Claude ou só do usuário', async () => {
    const companheiro = criarCompanheiro({ supabase: await novoUsuario() });
    const classificadas = [...LEITURAS, ...CRIACOES_DO_CLAUDE, ...SO_DO_USUARIO];

    expect(new Set(classificadas).size).toBe(classificadas.length);
    expect([...classificadas].sort()).toEqual(Object.keys(companheiro).sort());
  });

  it('nada que muda o que já existe passa com o Ator claude, e a conta fica intacta', async () => {
    const { retrato, chamar } = await contaCheia();
    const antes = await retrato();

    for (const operacao of SO_DO_USUARIO) {
      await expect(chamar[operacao](), operacao).rejects.toThrow(PermissaoNegada);
    }

    expect(await retrato()).toEqual(antes);
  });

  it('as leituras do Claude não mudam nada, nem gravam a pausa por Inatividade', async () => {
    const { retrato, chamar } = await contaCheia();
    const antes = await retrato();

    for (const operacao of LEITURAS) await chamar[operacao]();

    expect(await retrato()).toEqual(antes);
  });

  it('o que o Claude cria só acrescenta: o que já existia continua igual', async () => {
    const { companheiro, japones, retrato, resumoDa, deckEmAberto } = await contaCheia();
    const antes = await retrato();

    // Na Trilha com Objetivo em andamento, o Claude não define outro.
    await expect(
      companheiro.criarObjetivoAbstrato('claude', { trilhaId: japones.id, descricao: 'Outro' }),
    ).rejects.toThrow(PermissaoNegada);
    const nova = await companheiro.registrarSessao('claude', {
      trilhaId: japones.id,
      minutos: 20,
      nota: 'Revisão no Anki',
      fim: new Date('2026-10-09T11:50:00Z'),
    });

    const resumo = await resumoDa('2026-10-05', 'Semana de kanji.');
    // A pedido do usuário pelo chat, o Claude aceita o Deck em aberto.
    const decisao = await companheiro.decidirRecomendacao('claude', {
      recomendacaoId: deckEmAberto.id,
      resposta: 'aceita',
    });

    const depois = await retrato();
    expect(depois.sessoes).toEqual([nova, ...antes.sessoes]);
    // O Resumo novo entra; os de antes continuam iguais, só o Deck ganha a Decisão.
    const semDecisao = (r: (typeof antes.resumos)[number]) => ({
      ...r,
      recomendacoes: r.recomendacoes.map((rec) => ({ ...rec, decisao: null })),
    });
    expect(depois.resumos.map(semDecisao)).toEqual([resumo, ...antes.resumos].map(semDecisao));
    expect(depois.resumos.at(-1)?.recomendacoes.map((r) => r.decisao)).toEqual([
      antes.resumos.at(-1)?.recomendacoes[0].decisao,
      decisao,
      antes.resumos.at(-1)?.recomendacoes[2].decisao,
    ]);
    expect(depois.decisoes.slice(1)).toEqual(antes.decisoes);
    // O Deck aceito entra na Biblioteca; o item que já estava fica como estava.
    expect(depois.biblioteca.slice(0, -1)).toEqual(antes.biblioteca);
    expect(depois.biblioteca).toHaveLength(antes.biblioteca.length + 1);
    expect(depois.trilhas).toEqual(antes.trilhas);
    expect(depois.arquivadas).toEqual(antes.arquivadas);
    expect(depois.timer).toEqual(antes.timer);
    // Os Objetivos são os mesmos; só o progresso do mensurável anda com a Sessão nova.
    expect(depois.objetivos.map(({ id, situacao }) => ({ id, situacao }))).toEqual(
      antes.objetivos.map(({ id, situacao }) => ({ id, situacao })),
    );
  });
});
