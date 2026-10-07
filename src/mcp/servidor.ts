// Servidor MCP do Aibou: o conector que o Claude usa pelo chat e pela tarefa
// agendada (ADR 0002). É um adaptador fino sobre o Companheiro: traduz
// argumentos e respostas, sempre como Ator `claude`, e não tem regra própria.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  EntradaInvalida,
  MOTIVOS,
  PermissaoNegada,
  type Companheiro,
  type Decisao,
  type Motivo,
  type Objetivo,
  type Periodo,
  type Resumo,
} from '../companheiro/companheiro';

const horas = (segundos: number) => Math.round((segundos / 3600) * 100) / 100;

const paraOChat = (objetivo: Objetivo) =>
  objetivo.tipo === 'mensuravel'
    ? {
        id: objetivo.id,
        tipo: objetivo.tipo,
        metaHoras: objetivo.metaHoras,
        periodo: objetivo.periodo,
        horasEstudadas: horas(objetivo.estudadoSegundos),
        situacao: objetivo.situacao,
      }
    : {
        id: objetivo.id,
        tipo: objetivo.tipo,
        descricao: objetivo.descricao,
        itens: objetivo.itens,
        situacao: objetivo.situacao,
      };

const decisaoParaOChat = (decisao: Decisao) => ({
  recomendacaoId: decisao.recomendacaoId,
  resposta: decisao.resposta,
  motivo: decisao.motivo,
  decididaEm: decisao.decididaEm.toISOString(),
});

const resumoParaOChat = (resumo: Resumo) => ({
  semana: resumo.semana,
  geradoEm: resumo.geradoEm.toISOString(),
  texto: resumo.texto,
  recomendacoes: resumo.recomendacoes.map(({ id, objetivoId, tipo, titulo, decisao }) => ({
    id,
    objetivoId,
    tipo,
    titulo,
    decisao: decisao && { resposta: decisao.resposta, motivo: decisao.motivo },
  })),
});

// As recusas do Companheiro voltam como erro da ferramenta, com a mensagem
// dele, para o Claude explicar ao usuário. O resto é falha de verdade.
async function responder<T extends Record<string, unknown>>(fazer: () => Promise<T>) {
  try {
    const resultado = await fazer();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(resultado) }],
      structuredContent: resultado,
    };
  } catch (e) {
    if (!(e instanceof EntradaInvalida || e instanceof PermissaoNegada)) throw e;
    return { content: [{ type: 'text' as const, text: e.message }], isError: true };
  }
}

export function criarServidorMcp(companheiro: Companheiro) {
  const servidor = new McpServer(
    { name: 'aibou', version: '1.0.0' },
    {
      instructions:
        'Aibou é o companheiro de estudos do usuário. Cada assunto é uma Trilha. ' +
        'Use consultar_progresso para ver Trilhas, horas, Marcos, Objetivos e dias estudados no mês ' +
        '(e os ids das Trilhas). Use registrar_sessao quando o usuário contar um estudo feito longe ' +
        'do app, sempre com uma nota do que foi estudado. Para o Resumo semanal de uma Trilha, ' +
        'leia com consultar_trilha e grave com gravar_resumo; as Decisões passadas mostram o que o ' +
        'usuário aceitou e recusou, e por quê. Quando o usuário pedir no chat, use decidir_recomendacao ' +
        'para aceitar ou recusar uma Recomendação (recusa sempre com Motivo) e definir_objetivo para ' +
        'definir o Objetivo de uma Trilha sem Objetivo em andamento. Horários no fuso America/Sao_Paulo.',
    },
  );

  servidor.registerTool(
    'consultar_progresso',
    {
      title: 'Consultar progresso',
      description:
        'Progresso de estudo do usuário: horas no total, dias estudados no mês e, por Trilha ' +
        'ativa, as horas, o Marco anterior e o próximo, e os Objetivos em andamento.',
      inputSchema: {},
    },
    () =>
      responder(async () => {
        const inicio = await companheiro.inicio('claude');
        return {
          horasNoTotal: horas(inicio.totalSegundos),
          diasEstudadosNoMes: inicio.diasEstudadosNoMes,
          trilhas: inicio.trilhas.map(({ trilha, progresso, objetivosEmAndamento }) => ({
            id: trilha.id,
            nome: trilha.nome,
            horas: horas(progresso.totalSegundos),
            marco: progresso.marco,
            objetivosEmAndamento: objetivosEmAndamento.map(paraOChat),
          })),
        };
      }),
  );

  servidor.registerTool(
    'registrar_sessao',
    {
      title: 'Registrar Sessão',
      description:
        'Registra estudo feito longe do app ("estudei 1h30 de MCP hoje") numa Trilha, com nota. ' +
        'A Sessão termina em `fim` (ISO 8601; agora, se omitido) e dura `minutos`. Não pode ' +
        'cruzar estudo já registrado.',
      inputSchema: {
        trilha_id: z.string().describe('Id da Trilha, de consultar_progresso.'),
        minutos: z.number().describe('Duração do estudo, em minutos.'),
        nota: z.string().describe('O que foi estudado.'),
        fim: z.iso.datetime({ offset: true }).optional().describe('Quando o estudo terminou.'),
      },
    },
    ({ trilha_id, minutos, nota, fim }) =>
      responder(async () => {
        const sessao = await companheiro.registrarSessao('claude', {
          trilhaId: trilha_id,
          minutos,
          nota,
          fim: fim ? new Date(fim) : undefined,
        });
        return {
          id: sessao.id,
          trilhaId: sessao.trilhaId,
          inicio: sessao.inicio.toISOString(),
          fim: sessao.fim.toISOString(),
          minutos: sessao.duracaoSegundos / 60,
          nota: sessao.nota,
        };
      }),
  );

  servidor.registerTool(
    'consultar_trilha',
    {
      title: 'Consultar Trilha',
      description:
        'Tudo o que o Resumo semanal de uma Trilha precisa: os Objetivos (todos, com id e ' +
        'situação), as Sessões mais recentes com nota e origem, os últimos Resumos (com as ' +
        'Recomendações, seus ids e a Decisão de cada uma) e todas as Decisões passadas, mais ' +
        'recentes primeiro.',
      inputSchema: {
        trilha_id: z.string().describe('Id da Trilha, de consultar_progresso.'),
      },
    },
    ({ trilha_id }) =>
      responder(async () => {
        const trilha = (await companheiro.listarTrilhas('claude')).find((t) => t.id === trilha_id);
        if (!trilha) throw new EntradaInvalida('Trilha não encontrada entre as ativas.');
        const [objetivos, sessoes, resumos, decisoes] = await Promise.all([
          companheiro.listarObjetivos('claude', { trilhaId: trilha_id }),
          companheiro.listarSessoes('claude', { trilhaId: trilha_id, limite: 50 }),
          companheiro.listarResumos('claude', { trilhaId: trilha_id, limite: 3 }),
          companheiro.listarDecisoes('claude', { trilhaId: trilha_id }),
        ]);
        return {
          trilha: { id: trilha.id, nome: trilha.nome },
          objetivos: objetivos.map(paraOChat),
          sessoes: sessoes.map((s) => ({
            inicio: s.inicio.toISOString(),
            fim: s.fim.toISOString(),
            minutos: Math.round(s.duracaoSegundos / 60),
            nota: s.nota,
            origem: s.origem,
          })),
          resumosAnteriores: resumos.map(resumoParaOChat),
          decisoes: decisoes.map((d) => ({
            ...decisaoParaOChat(d),
            objetivoId: d.recomendacao.objetivoId,
            tipo: d.recomendacao.tipo,
            titulo: d.recomendacao.titulo,
            descricao: d.recomendacao.descricao,
          })),
        };
      }),
  );

  servidor.registerTool(
    'gravar_resumo',
    {
      title: 'Gravar Resumo',
      description:
        'Grava o Resumo semanal de uma Trilha (só cria; nunca edita). A semana começa na ' +
        'segunda (semana_de). Precisa de fontes com link e de Recomendações ligadas a Objetivos ' +
        'da Trilha, com pelo menos um Material Extra (tipo "material").',
      inputSchema: {
        trilha_id: z.string().describe('Id da Trilha.'),
        semana_de: z.string().describe('A segunda-feira que abre a semana, AAAA-MM-DD.'),
        texto: z.string().describe('O Resumo, em PT-BR.'),
        fontes: z
          .array(z.object({ titulo: z.string(), url: z.string() }))
          .describe('Fontes confiáveis em que o Resumo se apoia.'),
        recomendacoes: z
          .array(
            z.object({
              objetivo_id: z.string().describe('Id de um Objetivo desta Trilha.'),
              tipo: z.enum(['projeto', 'roteiro', 'deck', 'material']),
              titulo: z.string(),
              descricao: z.string(),
              url: z.string().optional(),
            }),
          )
          .describe('Propostas concretas; ao menos um Material Extra.'),
      },
    },
    ({ trilha_id, semana_de, texto, fontes, recomendacoes }) =>
      responder(async () => {
        const resumo = await companheiro.criarResumo('claude', {
          trilhaId: trilha_id,
          semanaDe: semana_de,
          texto,
          fontes,
          recomendacoes: recomendacoes.map((r) => ({
            objetivoId: r.objetivo_id,
            tipo: r.tipo,
            titulo: r.titulo,
            descricao: r.descricao,
            url: r.url,
          })),
        });
        return { id: resumo.id, ...resumoParaOChat(resumo) };
      }),
  );

  servidor.registerTool(
    'decidir_recomendacao',
    {
      title: 'Decidir Recomendação',
      description:
        'Registra a Decisão do usuário sobre uma Recomendação, só quando ele pedir no chat. ' +
        'Aceita: um projeto vira Objetivo ligado ao Objetivo da Recomendação; Deck e Material ' +
        'Extra vão para a Biblioteca. Recusada: exige o Motivo (ja-sei, formato-nao-serve, ' +
        'agora-nao ou fora-do-foco). Cada Recomendação se responde uma vez só.',
      inputSchema: {
        recomendacao_id: z.string().describe('Id da Recomendação, de consultar_trilha.'),
        resposta: z.enum(['aceita', 'recusada']),
        motivo: z
          .enum(MOTIVOS as [Motivo, ...Motivo[]])
          .optional()
          .describe('Obrigatório para recusar.'),
      },
    },
    ({ recomendacao_id, resposta, motivo }) =>
      responder(async () =>
        decisaoParaOChat(
          await companheiro.decidirRecomendacao(
            'claude',
            resposta === 'aceita'
              ? { recomendacaoId: recomendacao_id, resposta }
              : { recomendacaoId: recomendacao_id, resposta, motivo: motivo as Motivo },
          ),
        ),
      ),
  );

  servidor.registerTool(
    'definir_objetivo',
    {
      title: 'Definir Objetivo',
      description:
        'Define o Objetivo de uma Trilha sem Objetivo em andamento, só quando o usuário pedir. ' +
        'Abstrato: algo a alcançar (descricao). Mensurável: horas de estudo (meta_horas) num ' +
        'período: "mes" (o padrão), "semana" (segunda a domingo) ou datas { de, ate } em AAAA-MM-DD.',
      inputSchema: {
        trilha_id: z.string().describe('Id da Trilha, de consultar_progresso.'),
        tipo: z.enum(['abstrato', 'mensuravel']),
        descricao: z.string().optional().describe('Para o abstrato: o que se quer alcançar.'),
        meta_horas: z.number().optional().describe('Para o mensurável: horas de estudo.'),
        periodo: z
          .union([z.enum(['mes', 'semana']), z.object({ de: z.string(), ate: z.string() })])
          .optional()
          .describe('Para o mensurável: o mês ou a semana de hoje, ou datas escolhidas.'),
      },
    },
    ({ trilha_id, tipo, descricao, meta_horas, periodo }) =>
      responder(async () => {
        const objetivo =
          tipo === 'abstrato'
            ? await companheiro.criarObjetivoAbstrato('claude', {
                trilhaId: trilha_id,
                descricao: descricao ?? '',
              })
            : await companheiro.criarObjetivoMensuravel('claude', {
                trilhaId: trilha_id,
                metaHoras: meta_horas ?? NaN,
                periodo: (periodo ?? 'mes') as Periodo,
              });
        return paraOChat(objetivo);
      }),
  );

  return servidor;
}
