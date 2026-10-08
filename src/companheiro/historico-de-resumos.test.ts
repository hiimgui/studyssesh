import { describe, expect, it } from 'vitest';
import { criarCompanheiro, type NovaRecomendacao, type SituacaoDaRecomendacao } from './companheiro';
import { novoUsuario, relogioFixo } from '../test/usuarios';

const SEMANA = 7 * 24 * 60 * 60_000;

// Uma Trilha com dois Objetivos e três Resumos, um por segunda-feira:
// - 1º (semana de 21/09): roteiro e Material Extra para a documentação, os dois aceitos;
// - 2º (semana de 28/09): projeto para a certificação, recusado, e Material
//   Extra para a documentação, em aberto;
// - 3º (semana de 05/10): Deck e Material Extra para a certificação, em aberto.
async function trilhaComHistorico() {
  const relogio = relogioFixo('2026-09-28T10:07:00Z');
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });
  const certificacao = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Conseguir a certificação',
  });
  const documentacao = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Ler a documentação inteira',
  });
  const rec = (objetivoId: string, tipo: NovaRecomendacao['tipo'], titulo: string) => ({
    objetivoId,
    tipo,
    titulo,
    descricao: `Sobre ${titulo}.`,
    cartas: tipo === 'deck' ? [{ frente: 'O que é MCP?', verso: 'Um protocolo.' }] : undefined,
  });
  const resumo = (semanaDe: string, texto: string, recomendacoes: NovaRecomendacao[]) =>
    companheiro.criarResumo('claude', {
      trilhaId: trilha.id,
      semanaDe,
      texto,
      fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
      recomendacoes,
    });

  const primeiro = await resumo('2026-09-21', 'Primeira semana.', [
    rec(documentacao.id, 'roteiro', 'Roteiro de leitura'),
    rec(documentacao.id, 'material', 'Glossário'),
  ]);
  relogio.avancar(SEMANA);
  const segundo = await resumo('2026-09-28', 'Segunda semana.', [
    rec(certificacao.id, 'projeto', 'Um servidor MCP'),
    rec(documentacao.id, 'material', 'Especificação do MCP'),
  ]);
  relogio.avancar(SEMANA);
  const terceiro = await resumo('2026-10-05', 'Terceira semana.', [
    rec(certificacao.id, 'deck', 'Deck de MCP'),
    rec(certificacao.id, 'material', 'Simulado do exame'),
  ]);
  for (const r of primeiro.recomendacoes)
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: r.id, resposta: 'aceita' });
  await companheiro.decidirRecomendacao('usuario', {
    recomendacaoId: segundo.recomendacoes[0].id,
    resposta: 'recusada',
    motivo: 'agora-nao',
  });
  return { companheiro, trilha, certificacao, documentacao, primeiro, segundo, terceiro };
}

const ids = (h: { resumos: { id: string }[] } | null) => h?.resumos.map((r) => r.id);

describe('Histórico de Resumos', () => {
  it('lista os Resumos da Trilha, do mais novo ao mais antigo, com a contagem das Recomendações', async () => {
    const { companheiro, trilha, primeiro, segundo, terceiro } = await trilhaComHistorico();

    const historico = await companheiro.historicoDeResumos('usuario', { trilhaId: trilha.id });

    expect(historico?.trilha).toMatchObject({ id: trilha.id, nome: 'Claude Certified Architect' });
    expect(historico?.resumos.map((r) => [r.id, r.contagem])).toEqual([
      [terceiro.id, { aberta: 2, aceita: 0, recusada: 0 }],
      [segundo.id, { aberta: 1, aceita: 0, recusada: 1 }],
      [primeiro.id, { aberta: 0, aceita: 2, recusada: 0 }],
    ]);
    // Cada item traz o Resumo completo.
    expect(historico?.resumos[1]).toMatchObject({
      texto: 'Segunda semana.',
      semana: { de: '2026-09-28', ate: '2026-10-04' },
      fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
      recomendacoes: [
        { titulo: 'Um servidor MCP', decisao: { resposta: 'recusada', motivo: 'agora-nao' } },
        { titulo: 'Especificação do MCP', decisao: null },
      ],
    });
  });

  it('filtra pelo Objetivo: só os Resumos com alguma Recomendação para ele', async () => {
    const { companheiro, trilha, certificacao, documentacao, primeiro, segundo, terceiro } =
      await trilhaComHistorico();
    const filtrar = (objetivoId: string) =>
      companheiro.historicoDeResumos('usuario', { trilhaId: trilha.id, objetivoId });

    expect(ids(await filtrar(certificacao.id))).toEqual([terceiro.id, segundo.id]);
    expect(ids(await filtrar(documentacao.id))).toEqual([segundo.id, primeiro.id]);
    // A contagem continua sendo a do Resumo inteiro.
    expect((await filtrar(certificacao.id))?.resumos[0].contagem).toEqual({
      aberta: 2,
      aceita: 0,
      recusada: 0,
    });
  });

  it('filtra pela situação: só os Resumos com alguma Recomendação em aberto, aceita ou recusada', async () => {
    const { companheiro, trilha, primeiro, segundo, terceiro } = await trilhaComHistorico();
    const filtrar = (situacao: SituacaoDaRecomendacao) =>
      companheiro.historicoDeResumos('usuario', { trilhaId: trilha.id, situacao });

    expect(ids(await filtrar('aberta'))).toEqual([terceiro.id, segundo.id]);
    expect(ids(await filtrar('aceita'))).toEqual([primeiro.id]);
    expect(ids(await filtrar('recusada'))).toEqual([segundo.id]);
  });

  it('os dois filtros juntos pedem uma mesma Recomendação com o Objetivo e a situação', async () => {
    const { companheiro, trilha, certificacao, documentacao, segundo } = await trilhaComHistorico();
    const filtrar = (objetivoId: string, situacao: SituacaoDaRecomendacao) =>
      companheiro.historicoDeResumos('usuario', { trilhaId: trilha.id, objetivoId, situacao });

    expect(ids(await filtrar(documentacao.id, 'aberta'))).toEqual([segundo.id]);
    expect(ids(await filtrar(certificacao.id, 'recusada'))).toEqual([segundo.id]);
    // No 2º Resumo, a recusada é da certificação; a da documentação está em aberto.
    expect(ids(await filtrar(documentacao.id, 'recusada'))).toEqual([]);
    expect(ids(await filtrar(certificacao.id, 'aceita'))).toEqual([]);
  });

  it('Trilha de outro usuário ou inexistente não tem histórico', async () => {
    const { trilha } = await trilhaComHistorico();
    const outro = criarCompanheiro({ supabase: await novoUsuario() });

    expect(await outro.historicoDeResumos('usuario', { trilhaId: trilha.id })).toBeNull();
    expect(
      await outro.historicoDeResumos('usuario', { trilhaId: '00000000-0000-4000-8000-000000000000' }),
    ).toBeNull();
  });

  it('uma Trilha arquivada continua com o histórico, para consulta', async () => {
    const { companheiro, trilha, primeiro, segundo, terceiro } = await trilhaComHistorico();
    await companheiro.arquivarTrilha('usuario', { trilhaId: trilha.id });

    const historico = await companheiro.historicoDeResumos('claude', { trilhaId: trilha.id });

    expect(historico?.trilha.arquivadaEm).toEqual(new Date('2026-10-12T10:07:00Z'));
    expect(ids(historico)).toEqual([terceiro.id, segundo.id, primeiro.id]);
  });
});
