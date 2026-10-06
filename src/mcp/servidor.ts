// Servidor MCP do Aibou: o conector que o Claude usa pelo chat e pela tarefa
// agendada (ADR 0002). É um adaptador fino sobre o Companheiro: traduz
// argumentos e respostas, sempre como Ator `claude`, e não tem regra própria.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  EntradaInvalida,
  PermissaoNegada,
  type Companheiro,
  type Objetivo,
} from '../companheiro/companheiro';

const horas = (segundos: number) => Math.round((segundos / 3600) * 100) / 100;

const paraOChat = (objetivo: Objetivo) =>
  objetivo.tipo === 'mensuravel'
    ? {
        tipo: objetivo.tipo,
        metaHoras: objetivo.metaHoras,
        periodo: objetivo.periodo,
        horasEstudadas: horas(objetivo.estudadoSegundos),
        situacao: objetivo.situacao,
      }
    : {
        tipo: objetivo.tipo,
        descricao: objetivo.descricao,
        itens: objetivo.itens,
        situacao: objetivo.situacao,
      };

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
        'do app, sempre com uma nota do que foi estudado. Horários no fuso America/Sao_Paulo.',
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

  return servidor;
}
