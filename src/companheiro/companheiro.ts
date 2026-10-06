import type { SupabaseClient } from '@supabase/supabase-js';
import { dataDe, ehData, meiaNoite, mesDe, semanaDe, somarDias, type Data } from './fuso';

// Quem está agindo: o próprio usuário (app) ou o Claude (conector MCP).
export type Ator = 'usuario' | 'claude';

export type Relogio = () => Date;

export interface Trilha {
  id: string;
  nome: string;
  criadaEm: Date;
  // Arquivada, a Trilha sai das abas e fica só para consulta.
  arquivadaEm: Date | null;
}

export interface Sessao {
  id: string;
  trilhaId: string;
  inicio: Date;
  fim: Date;
  duracaoSegundos: number;
  nota: string | null;
  // Do timer do app, ou registrada pelo chat do Claude (estudo longe do app).
  origem: OrigemSessao;
}

export type OrigemSessao = 'timer' | 'chat';

// O timer em andamento, como o servidor o vê agora.
export interface TimerLigado {
  trilhaId: string;
  iniciadoEm: Date;
  pausado: boolean;
  // Pausado sozinho por Inatividade; o app pergunta até quando houve estudo.
  pausadoPorInatividade: boolean;
  ultimaInteracaoEm: Date;
  // Tempo estudado até agora, já sem as pausas.
  estudadoMs: number;
}

// Como o Objetivo está: batido, ainda correndo, ou com o período acabado sem
// bater a meta.
export type SituacaoObjetivo = 'em-andamento' | 'concluido' | 'encerrado';

// Objetivo mensurável: horas de estudo num período, com o progresso calculado
// pelas Sessões que começaram dentro dele.
export interface ObjetivoMensuravel {
  id: string;
  tipo: 'mensuravel';
  trilhaId: string;
  metaHoras: number;
  // Primeiro e último dia, inclusive, no fuso America/Sao_Paulo.
  periodo: { de: Data; ate: Data };
  criadoEm: Date;
  concluidoEm: Date | null;
  estudadoSegundos: number;
  situacao: SituacaoObjetivo;
}

// Objetivo abstrato: concluído por julgamento do usuário. A barra mede os itens
// ligados a ele que já foram concluídos (projetos e itens da Biblioteca).
export interface ObjetivoAbstrato {
  id: string;
  tipo: 'abstrato';
  trilhaId: string;
  descricao: string;
  criadoEm: Date;
  concluidoEm: Date | null;
  itens: { concluidos: number; total: number };
  // Sem período, não há como ficar encerrado.
  situacao: Exclude<SituacaoObjetivo, 'encerrado'>;
}

export type Objetivo = ObjetivoMensuravel | ObjetivoAbstrato;

// O mês ou a semana (segunda a domingo) de hoje, ou datas escolhidas.
export type Periodo = 'mes' | 'semana' | { de: Data; ate: Data };

// A Trilha está sem direção e o app pede um Objetivo: nenhum está em andamento
// (todos batidos ou com o período acabado, ou nenhum criado ainda).
export function semObjetivoEmAndamento(objetivos: Objetivo[]): boolean {
  return !objetivos.some((o) => o.situacao === 'em-andamento');
}

// Quando um Objetivo acabou: na conclusão, ou na meia-noite depois do último
// dia do período, se ficou encerrado.
function acabouEm(objetivo: Objetivo): Date {
  if (objetivo.tipo === 'mensuravel' && !objetivo.concluidoEm)
    return meiaNoite(somarDias(objetivo.periodo.ate, 1));
  // Só chega aqui sem conclusão um abstrato em andamento, que não acabou.
  return objetivo.concluidoEm ?? objetivo.criadoEm;
}

// Ao concluir um Objetivo há celebração, e o usuário escolhe entre arquivar a
// Trilha ou definir um novo Objetivo. A escolha é o que encerra a celebração:
// ela vale enquanto nada estiver em andamento e o último Objetivo a acabar for
// um concluído (não um encerrado sem bater a meta).
export function objetivoParaCelebrar(objetivos: Objetivo[]): Objetivo | null {
  if (!semObjetivoEmAndamento(objetivos) || objetivos.length === 0) return null;
  const ultimo = objetivos.reduce((a, b) => (acabouEm(b) >= acabouEm(a) ? b : a));
  return ultimo.situacao === 'concluido' ? ultimo : null;
}

// Horas acumuladas e a barra até o próximo Marco de uma Trilha.
export interface ProgressoDaTrilha {
  trilhaId: string;
  totalSegundos: number;
  // Em horas. `anterior` é 0 antes do primeiro Marco.
  marco: { anterior: number; proximo: number };
  // O Marco batido que o usuário ainda não viu celebrado.
  marcoParaCelebrar: number | null;
}

// A tela Início: tudo o que consolida as Trilhas. Os totais contam também as
// Trilhas arquivadas (o estudo aconteceu); a lista traz só as das abas.
export interface Inicio {
  totalSegundos: number;
  // Dias distintos com Sessão no mês de hoje, em São Paulo. Só cresce no mês.
  diasEstudadosNoMes: number;
  trilhas: {
    trilha: Trilha;
    progresso: ProgressoDaTrilha;
    objetivosEmAndamento: Objetivo[];
  }[];
}

const PRIMEIROS_MARCOS = [10, 25, 50, 100];

const MINUTOS_NUM_DIA = 24 * 60;

// Os Marcos são 10, 25, 50 e 100h e, dali em diante, a cada 100h. Devolve o
// maior Marco já alcançado com `totalSegundos` (0 se nenhum) e o próximo.
function marcosEm(totalSegundos: number): { anterior: number; proximo: number } {
  const horasCheias = Math.floor(totalSegundos / 3600);
  if (horasCheias >= 100) {
    const anterior = Math.floor(horasCheias / 100) * 100;
    return { anterior, proximo: anterior + 100 };
  }
  const proximo = PRIMEIROS_MARCOS.find((m) => m > horasCheias)!;
  const anterior = PRIMEIROS_MARCOS.findLast((m) => m <= horasCheias) ?? 0;
  return { anterior, proximo };
}

function comMarcos(
  trilhaId: string,
  totalSegundos: number,
  marcoCelebrado: number,
): ProgressoDaTrilha {
  const marco = marcosEm(totalSegundos);
  return {
    trilhaId,
    totalSegundos,
    marco,
    marcoParaCelebrar: marco.anterior > marcoCelebrado ? marco.anterior : null,
  };
}

// O Ator não tem permissão para a operação (ex.: o Claude criando Trilha).
export class PermissaoNegada extends Error {
  constructor(ator: Ator, operacao: string) {
    super(`O ator "${ator}" não pode ${operacao}.`);
    this.name = 'PermissaoNegada';
  }
}

// A entrada não respeita uma regra do domínio (ex.: Trilha sem nome).
export class EntradaInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'EntradaInvalida';
  }
}

// Já existe um timer ligado (em qualquer Trilha); só pode haver um por vez.
export class TimerJaLigado extends Error {
  constructor() {
    super('Já há um timer ligado. Encerre-o antes de iniciar outro.');
    this.name = 'TimerJaLigado';
  }
}

// Não há timer ligado para pausar, retomar ou encerrar.
export class SemTimerLigado extends Error {
  constructor() {
    super('Não há timer ligado.');
    this.name = 'SemTimerLigado';
  }
}

// Códigos do Postgres: violação de unicidade e "timer já encerrado" (encerrar_timer).
const VIOLACAO_UNICA = '23505';
const TIMER_JA_ENCERRADO = 'P0002';

interface Dependencias {
  // Cliente autenticado como o usuário; o RLS restringe tudo ao dono.
  supabase: SupabaseClient;
  relogio?: Relogio;
}

interface LinhaTrilha {
  id: string;
  nome: string;
  criada_em: string;
  arquivada_em: string | null;
}

const COLUNAS_TRILHA = 'id, nome, criada_em, arquivada_em';

const paraTrilha = (linha: LinhaTrilha): Trilha => ({
  id: linha.id,
  nome: linha.nome,
  criadaEm: new Date(linha.criada_em),
  arquivadaEm: linha.arquivada_em ? new Date(linha.arquivada_em) : null,
});

interface LinhaTimer {
  id: string;
  trilha_id: string;
  iniciado_em: string;
  pausado_em: string | null;
  tempo_pausado_ms: number;
  ultima_interacao_em: string;
  pausado_por_inatividade: boolean;
}

const COLUNAS_TIMER =
  'id, trilha_id, iniciado_em, pausado_em, tempo_pausado_ms, ultima_interacao_em, pausado_por_inatividade';

export const INATIVIDADE_MS = 60 * 60_000;

// O timer como ele está em `agora`: ligado e sem interação há 1h, já conta
// como pausado por Inatividade no instante em que a hora se completou.
function comInatividade(timer: LinhaTimer, agora: Date): LinhaTimer {
  if (timer.pausado_em) return timer;
  const pausaEm = new Date(timer.ultima_interacao_em).getTime() + INATIVIDADE_MS;
  if (agora.getTime() < pausaEm) return timer;
  return {
    ...timer,
    pausado_em: new Date(pausaEm).toISOString(),
    pausado_por_inatividade: true,
  };
}

// Tempo estudado até `agora`, descontando as pausas. Pausado, o relógio para
// no momento da pausa.
function tempoEstudadoMs(timer: LinhaTimer, agora: Date): number {
  const ate = timer.pausado_em ? new Date(timer.pausado_em) : agora;
  return ate.getTime() - new Date(timer.iniciado_em).getTime() - timer.tempo_pausado_ms;
}

interface LinhaSessao {
  id: string;
  trilha_id: string;
  inicio: string;
  fim: string;
  duracao_segundos: number;
  nota: string | null;
  origem: OrigemSessao;
}

const COLUNAS_SESSAO = 'id, trilha_id, inicio, fim, duracao_segundos, nota, origem';

const paraSessao = (linha: LinhaSessao): Sessao => ({
  id: linha.id,
  trilhaId: linha.trilha_id,
  inicio: new Date(linha.inicio),
  fim: new Date(linha.fim),
  duracaoSegundos: linha.duracao_segundos,
  nota: linha.nota,
  origem: linha.origem,
});

interface LinhaMensuravel {
  id: string;
  tipo: 'mensuravel';
  trilha_id: string;
  meta_segundos: number;
  periodo_inicio: string;
  periodo_fim: string;
  descricao: null;
  criado_em: string;
  concluido_em: string | null;
}

interface LinhaAbstrato {
  id: string;
  tipo: 'abstrato';
  trilha_id: string;
  meta_segundos: null;
  periodo_inicio: null;
  periodo_fim: null;
  descricao: string;
  criado_em: string;
  concluido_em: string | null;
}

type LinhaObjetivo = LinhaMensuravel | LinhaAbstrato;

const COLUNAS_OBJETIVO =
  'id, tipo, trilha_id, meta_segundos, periodo_inicio, periodo_fim, descricao, criado_em, concluido_em';

const paraAbstrato = (linha: LinhaAbstrato): ObjetivoAbstrato => ({
  id: linha.id,
  tipo: 'abstrato',
  trilhaId: linha.trilha_id,
  descricao: linha.descricao,
  criadoEm: new Date(linha.criado_em),
  concluidoEm: linha.concluido_em ? new Date(linha.concluido_em) : null,
  // Projetos e itens da Biblioteca ainda não existem (#11): nada ligado.
  itens: { concluidos: 0, total: 0 },
  situacao: linha.concluido_em ? 'concluido' : 'em-andamento',
});

const HORA_S = 3600;

export function criarCompanheiro({ supabase, relogio = () => new Date() }: Dependencias) {
  // Lê o timer já com a Inatividade aplicada, sem gravar nada (serve a qualquer Ator).
  async function buscarTimer(): Promise<LinhaTimer | null> {
    const { data, error } = await supabase
      .from('timers')
      .select(COLUNAS_TIMER)
      .maybeSingle<LinhaTimer>();
    if (error) throw error;
    return data && comInatividade(data, relogio());
  }

  async function timerObrigatorio(): Promise<LinhaTimer> {
    const timer = await timerParaAcao();
    if (!timer) throw new SemTimerLigado();
    return timer;
  }

  // Para as ações do usuário: se a Inatividade pausou o timer, a pausa é
  // gravada antes, para a ação partir do estado real.
  async function timerParaAcao(): Promise<LinhaTimer | null> {
    const { data: gravado, error } = await supabase
      .from('timers')
      .select(COLUNAS_TIMER)
      .maybeSingle<LinhaTimer>();
    if (error) throw error;
    if (!gravado) return null;

    const timer = comInatividade(gravado, relogio());
    if (timer.pausado_em !== gravado.pausado_em) {
      const { error: erroPausa } = await supabase
        .from('timers')
        .update({ pausado_em: timer.pausado_em, pausado_por_inatividade: true })
        .eq('id', timer.id)
        .is('pausado_em', null)
        .eq('ultima_interacao_em', gravado.ultima_interacao_em);
      if (erroPausa) throw erroPausa;
    }
    return timer;
  }

  // Trilha arquivada é só consulta: não recebe timer nem Objetivo novo.
  async function garantirTrilhaAtiva(trilhaId: string): Promise<void> {
    const { data, error } = await supabase
      .from('trilhas')
      .select('arquivada_em')
      .eq('id', trilhaId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new EntradaInvalida('Trilha não encontrada.');
    if (data.arquivada_em) throw new EntradaInvalida('Esta Trilha está arquivada.');
  }

  async function objetivosDaTrilha(trilhaId: string): Promise<Objetivo[]> {
    const { data, error } = await supabase
      .from('objetivos')
      .select(COLUNAS_OBJETIVO)
      .eq('trilha_id', trilhaId)
      .order('criado_em')
      .overrideTypes<LinhaObjetivo[], { merge: false }>();
    if (error) throw error;
    return Promise.all(data.map(paraObjetivo));
  }

  function paraObjetivo(linha: LinhaObjetivo): Promise<Objetivo> | Objetivo {
    return linha.tipo === 'abstrato' ? paraAbstrato(linha) : paraMensuravel(linha);
  }

  async function estudadoNoPeriodo(
    objetivo: Pick<LinhaMensuravel, 'trilha_id' | 'periodo_inicio' | 'periodo_fim'>,
  ): Promise<number> {
    const { data, error } = await supabase
      .from('sessoes')
      .select('duracao_segundos')
      .eq('trilha_id', objetivo.trilha_id)
      .gte('inicio', objetivo.periodo_inicio)
      .lt('inicio', objetivo.periodo_fim);
    if (error) throw error;
    return data.reduce((soma, s) => soma + s.duracao_segundos, 0);
  }

  async function paraMensuravel(linha: LinhaMensuravel): Promise<ObjetivoMensuravel> {
    const fim = new Date(linha.periodo_fim);
    const concluidoEm = linha.concluido_em ? new Date(linha.concluido_em) : null;
    return {
      id: linha.id,
      tipo: 'mensuravel',
      trilhaId: linha.trilha_id,
      metaHoras: linha.meta_segundos / HORA_S,
      periodo: {
        de: dataDe(new Date(linha.periodo_inicio)),
        ate: dataDe(new Date(fim.getTime() - 1)),
      },
      criadoEm: new Date(linha.criado_em),
      concluidoEm,
      estudadoSegundos: await estudadoNoPeriodo(linha),
      situacao: concluidoEm ? 'concluido' : relogio() >= fim ? 'encerrado' : 'em-andamento',
    };
  }

  // Uma Sessão nova pode bater a meta dos Objetivos em andamento cujo período
  // a contém. O Objetivo se conclui no fim da Sessão que bateu a meta.
  async function concluirObjetivosBatidos(sessao: Sessao): Promise<void> {
    const inicio = sessao.inicio.toISOString();
    const { data, error } = await supabase
      .from('objetivos')
      .select(COLUNAS_OBJETIVO)
      .eq('trilha_id', sessao.trilhaId)
      .is('concluido_em', null)
      .lte('periodo_inicio', inicio)
      .gt('periodo_fim', inicio)
      .overrideTypes<LinhaMensuravel[], { merge: false }>();
    if (error) throw error;
    for (const objetivo of data) {
      if ((await estudadoNoPeriodo(objetivo)) < objetivo.meta_segundos) continue;
      const { error: erroConcluir } = await supabase
        .from('objetivos')
        .update({ concluido_em: sessao.fim.toISOString() })
        .eq('id', objetivo.id)
        .is('concluido_em', null);
      if (erroConcluir) throw erroConcluir;
    }
  }

  async function progressoDe(trilhaId: string): Promise<ProgressoDaTrilha> {
    const [sessoes, trilha] = await Promise.all([
      supabase.from('sessoes').select('duracao_segundos').eq('trilha_id', trilhaId),
      supabase
        .from('trilhas')
        .select('marco_celebrado_horas')
        .eq('id', trilhaId)
        .maybeSingle<{ marco_celebrado_horas: number }>(),
    ]);
    if (sessoes.error) throw sessoes.error;
    if (trilha.error) throw trilha.error;
    const totalSegundos = sessoes.data.reduce((soma, s) => soma + s.duracao_segundos, 0);
    return comMarcos(trilhaId, totalSegundos, trilha.data?.marco_celebrado_horas ?? 0);
  }

  return {
    async criarTrilha(ator: Ator, { nome }: { nome: string }): Promise<Trilha> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'criar Trilha');
      nome = nome.trim();
      if (!nome) throw new EntradaInvalida('A Trilha precisa de um nome.');

      const { data, error } = await supabase
        .from('trilhas')
        .insert({ nome, criada_em: relogio().toISOString() })
        .select(COLUNAS_TRILHA)
        .single<LinhaTrilha>();
      if (error) throw error;
      return paraTrilha(data);
    },

    // Todo Ator lê tudo. As abas: só as Trilhas não arquivadas.
    async listarTrilhas(_ator: Ator): Promise<Trilha[]> {
      const { data, error } = await supabase
        .from('trilhas')
        .select(COLUNAS_TRILHA)
        .is('arquivada_em', null)
        .order('criada_em')
        .overrideTypes<LinhaTrilha[], { merge: false }>();
      if (error) throw error;
      return data.map(paraTrilha);
    },

    // As arquivadas, das mais recentes para as mais antigas.
    async listarTrilhasArquivadas(_ator: Ator): Promise<Trilha[]> {
      const { data, error } = await supabase
        .from('trilhas')
        .select(COLUNAS_TRILHA)
        .not('arquivada_em', 'is', null)
        .order('arquivada_em', { ascending: false })
        .overrideTypes<LinhaTrilha[], { merge: false }>();
      if (error) throw error;
      return data.map(paraTrilha);
    },

    // Arquivar é escolha do usuário (em geral depois de concluir um Objetivo).
    // Arquivar de novo não muda a data.
    async arquivarTrilha(ator: Ator, { trilhaId }: { trilhaId: string }): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'arquivar Trilha');
      const timer = await buscarTimer();
      if (timer?.trilha_id === trilhaId)
        throw new EntradaInvalida('Encerre o timer desta Trilha antes de arquivá-la.');
      const { error } = await supabase
        .from('trilhas')
        .update({ arquivada_em: relogio().toISOString() })
        .eq('id', trilhaId)
        .is('arquivada_em', null);
      if (error) throw error;
    },

    async timerLigado(_ator: Ator): Promise<TimerLigado | null> {
      const timer = await buscarTimer();
      if (!timer) return null;
      return {
        trilhaId: timer.trilha_id,
        iniciadoEm: new Date(timer.iniciado_em),
        pausado: timer.pausado_em !== null,
        pausadoPorInatividade: timer.pausado_por_inatividade,
        ultimaInteracaoEm: new Date(timer.ultima_interacao_em),
        estudadoMs: tempoEstudadoMs(timer, relogio()),
      };
    },

    // O usuário mexeu no app: com o timer contando, a contagem de Inatividade
    // recomeça. Sem timer, ou já pausado, não há o que fazer.
    async registrarInteracao(ator: Ator): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'interagir com o timer');
      const timer = await timerParaAcao();
      if (!timer || timer.pausado_em) return;
      const { error } = await supabase
        .from('timers')
        .update({ ultima_interacao_em: relogio().toISOString() })
        .eq('id', timer.id)
        .is('pausado_em', null);
      if (error) throw error;
    },

    // Resposta à pergunta da volta: até quando houve estudo. A pausa passa a
    // começar nesse instante, que pode ser antes ou depois da pausa automática
    // (quem lia um livro longe da tela estudou além dela).
    async informarFimDoEstudo(ator: Ator, { ate }: { ate: Date }): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'informar até quando estudou');
      const timer = await timerObrigatorio();
      if (!timer.pausado_por_inatividade) {
        throw new EntradaInvalida('O timer não foi pausado por Inatividade.');
      }
      const ultimaInteracao = new Date(timer.ultima_interacao_em);
      const agora = relogio();
      if (ate < ultimaInteracao || ate > agora) {
        throw new EntradaInvalida('O fim do estudo fica entre a última interação e agora.');
      }
      const { error } = await supabase
        .from('timers')
        .update({ pausado_em: ate.toISOString(), pausado_por_inatividade: false })
        .eq('id', timer.id)
        .eq('pausado_por_inatividade', true);
      if (error) throw error;
    },

    // O timer é só do usuário. O Claude registra estudo de outro jeito (pelo chat).
    async iniciarTimer(ator: Ator, { trilhaId }: { trilhaId: string }): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'ligar o timer');
      await garantirTrilhaAtiva(trilhaId);
      const agora = relogio().toISOString();
      const { error } = await supabase
        .from('timers')
        .insert({ trilha_id: trilhaId, iniciado_em: agora, ultima_interacao_em: agora });
      if (error?.code === VIOLACAO_UNICA) throw new TimerJaLigado();
      if (error) throw error;
    },

    // Pausar ou retomar de novo não faz nada: o mesmo clique pode chegar de dois
    // aparelhos. Os filtros no update evitam que um sobrescreva o outro.
    async pausarTimer(ator: Ator): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'pausar o timer');
      const timer = await timerObrigatorio();
      if (timer.pausado_em) return;
      const { error } = await supabase
        .from('timers')
        .update({ pausado_em: relogio().toISOString() })
        .eq('id', timer.id)
        .is('pausado_em', null);
      if (error) throw error;
    },

    async retomarTimer(ator: Ator): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'retomar o timer');
      const timer = await timerObrigatorio();
      if (!timer.pausado_em) return;
      const agora = relogio();
      const pausaMs = agora.getTime() - new Date(timer.pausado_em).getTime();
      const { error } = await supabase
        .from('timers')
        .update({
          pausado_em: null,
          tempo_pausado_ms: timer.tempo_pausado_ms + pausaMs,
          ultima_interacao_em: agora.toISOString(),
          pausado_por_inatividade: false,
        })
        .eq('id', timer.id)
        .eq('pausado_em', timer.pausado_em);
      if (error) throw error;
    },

    async encerrarTimer(ator: Ator, { nota }: { nota?: string } = {}): Promise<Sessao> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'encerrar o timer');
      const timer = await timerObrigatorio();
      const agora = relogio();
      // Encerrado durante uma pausa, o estudo acabou quando a pausa começou.
      const fim = timer.pausado_em ? new Date(timer.pausado_em) : agora;
      const { data, error: erroEncerrar } = await supabase
        .rpc('encerrar_timer', {
          p_timer: timer.id,
          p_fim: fim.toISOString(),
          p_duracao_segundos: Math.round(tempoEstudadoMs(timer, agora) / 1000),
          p_nota: nota?.trim() || null,
        })
        .single<LinhaSessao>();
      // Outro aparelho encerrou entre a leitura e o encerramento.
      if (erroEncerrar?.code === TIMER_JA_ENCERRADO) throw new SemTimerLigado();
      if (erroEncerrar) throw erroEncerrar;
      const sessao = paraSessao(data);
      await concluirObjetivosBatidos(sessao);
      return sessao;
    },

    // Estudo feito longe do app, contado pelo chat: "estudei 1h30 de MCP hoje".
    // A Sessão termina em `fim` (agora, se não vier) e dura `minutos`. Como no
    // timer, pode bater a meta de Objetivos (ADR 0002: o Claude cria Sessões).
    async registrarSessao(
      _ator: Ator,
      { trilhaId, minutos, nota, fim }: { trilhaId: string; minutos: number; nota: string; fim?: Date },
    ): Promise<Sessao> {
      nota = nota.trim();
      if (!nota) throw new EntradaInvalida('Diga o que foi estudado: a nota é obrigatória.');
      if (!Number.isFinite(minutos) || minutos <= 0 || minutos > MINUTOS_NUM_DIA)
        throw new EntradaInvalida('A duração vai de 1 minuto a 24 horas.');
      const agora = relogio();
      const termino = fim ?? agora;
      if (termino > agora) throw new EntradaInvalida('Só dá para registrar estudo que já aconteceu.');
      const inicio = new Date(termino.getTime() - minutos * 60_000);
      await garantirTrilhaAtiva(trilhaId);

      // Nada conta duas vezes: o período não pode cruzar outra Sessão, de
      // nenhuma Trilha (encostar, sim).
      const { count, error: erroSobreposicao } = await supabase
        .from('sessoes')
        .select('id', { count: 'exact', head: true })
        .lt('inicio', termino.toISOString())
        .gt('fim', inicio.toISOString());
      if (erroSobreposicao) throw erroSobreposicao;
      if (count) throw new EntradaInvalida('Já há estudo registrado nesse horário.');

      const { data, error } = await supabase
        .from('sessoes')
        .insert({
          trilha_id: trilhaId,
          inicio: inicio.toISOString(),
          fim: termino.toISOString(),
          duracao_segundos: Math.round(minutos * 60),
          nota,
          origem: 'chat',
        })
        .select(COLUNAS_SESSAO)
        .single<LinhaSessao>();
      if (error) throw error;
      const sessao = paraSessao(data);
      await concluirObjetivosBatidos(sessao);
      return sessao;
    },

    // Todo Ator lê tudo. Mais recentes primeiro.
    async listarSessoes(
      _ator: Ator,
      { trilhaId, limite }: { trilhaId: string; limite?: number },
    ): Promise<Sessao[]> {
      let consulta = supabase
        .from('sessoes')
        .select(COLUNAS_SESSAO)
        .eq('trilha_id', trilhaId)
        .order('inicio', { ascending: false });
      if (limite !== undefined) consulta = consulta.limit(limite);
      const { data, error } = await consulta;
      if (error) throw error;
      return data.map(paraSessao);
    },

    // O Claude só define Objetivo, a pedido do usuário pelo chat, numa Trilha
    // sem Objetivo em andamento (ADR 0002).
    async criarObjetivoMensuravel(
      ator: Ator,
      { trilhaId, metaHoras, periodo }: { trilhaId: string; metaHoras: number; periodo: Periodo },
    ): Promise<ObjetivoMensuravel> {
      const agora = relogio();
      const hoje = dataDe(agora);
      const { de, ate } =
        periodo === 'mes' ? mesDe(hoje) : periodo === 'semana' ? semanaDe(hoje) : periodo;
      const metaSegundos = Math.round(metaHoras * HORA_S);
      if (!Number.isFinite(metaSegundos) || metaSegundos <= 0)
        throw new EntradaInvalida('Diga quantas horas quer estudar.');
      if (!ehData(de) || !ehData(ate))
        throw new EntradaInvalida('Escolha o primeiro e o último dia do período.');
      if (de > ate) throw new EntradaInvalida('O último dia vem antes do primeiro.');
      const inicio = meiaNoite(de).toISOString();
      const fim = meiaNoite(somarDias(ate, 1));
      if (fim <= agora)
        throw new EntradaInvalida('Esse período já acabou. Escolha um que vá até hoje ou depois.');
      await garantirTrilhaAtiva(trilhaId);

      if (ator === 'claude') {
        if (!semObjetivoEmAndamento(await objetivosDaTrilha(trilhaId)))
          throw new PermissaoNegada(ator, 'definir Objetivo numa Trilha que já tem um');
      }

      const linha = {
        trilha_id: trilhaId,
        meta_segundos: metaSegundos,
        periodo_inicio: inicio,
        periodo_fim: fim.toISOString(),
      };
      // Com a meta já batida no período, o Objetivo nasce concluído.
      const batido = (await estudadoNoPeriodo(linha)) >= metaSegundos;
      const { data, error } = await supabase
        .from('objetivos')
        .insert({
          ...linha,
          tipo: 'mensuravel',
          criado_em: agora.toISOString(),
          concluido_em: batido ? agora.toISOString() : null,
        })
        .select(COLUNAS_OBJETIVO)
        .single<LinhaMensuravel>();
      if (error) throw error;
      return paraMensuravel(data);
    },

    // Mesma regra do mensurável para o Claude: só numa Trilha sem Objetivo em andamento.
    async criarObjetivoAbstrato(
      ator: Ator,
      { trilhaId, descricao }: { trilhaId: string; descricao: string },
    ): Promise<ObjetivoAbstrato> {
      descricao = descricao.trim();
      if (!descricao) throw new EntradaInvalida('Diga o que você quer alcançar.');
      await garantirTrilhaAtiva(trilhaId);
      if (ator === 'claude') {
        if (!semObjetivoEmAndamento(await objetivosDaTrilha(trilhaId)))
          throw new PermissaoNegada(ator, 'definir Objetivo numa Trilha que já tem um');
      }
      const { data, error } = await supabase
        .from('objetivos')
        .insert({
          trilha_id: trilhaId,
          tipo: 'abstrato',
          descricao,
          criado_em: relogio().toISOString(),
        })
        .select(COLUNAS_OBJETIVO)
        .single<LinhaAbstrato>();
      if (error) throw error;
      return paraAbstrato(data);
    },

    // Concluir é julgamento do usuário, por isso só vale para o abstrato. Concluir
    // de novo não muda a data (o mesmo clique pode chegar duas vezes).
    async concluirObjetivo(
      ator: Ator,
      { objetivoId }: { objetivoId: string },
    ): Promise<ObjetivoAbstrato> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'concluir Objetivo');
      const buscar = async () => {
        const { data, error } = await supabase
          .from('objetivos')
          .select(COLUNAS_OBJETIVO)
          .eq('id', objetivoId)
          .maybeSingle<LinhaObjetivo>();
        if (error) throw error;
        if (!data) throw new EntradaInvalida('Objetivo não encontrado.');
        if (data.tipo !== 'abstrato')
          throw new EntradaInvalida('Um Objetivo mensurável se conclui sozinho, ao bater a meta.');
        return data;
      };

      const antes = await buscar();
      if (antes.concluido_em) return paraAbstrato(antes);
      const { error } = await supabase
        .from('objetivos')
        .update({ concluido_em: relogio().toISOString() })
        .eq('id', objetivoId)
        .is('concluido_em', null);
      if (error) throw error;
      return paraAbstrato(await buscar());
    },

    // Todo Ator lê tudo. Na ordem em que foram criados.
    async listarObjetivos(_ator: Ator, { trilhaId }: { trilhaId: string }): Promise<Objetivo[]> {
      return objetivosDaTrilha(trilhaId);
    },

    // Todo Ator lê tudo.
    async progressoDaTrilha(
      _ator: Ator,
      { trilhaId }: { trilhaId: string },
    ): Promise<ProgressoDaTrilha> {
      return progressoDe(trilhaId);
    },

    // Todo Ator lê tudo. As Trilhas vêm como as abas: só as não arquivadas.
    async inicio(_ator: Ator): Promise<Inicio> {
      const [sessoes, trilhas] = await Promise.all([
        supabase.from('sessoes').select('trilha_id, inicio, duracao_segundos'),
        supabase
          .from('trilhas')
          .select(`${COLUNAS_TRILHA}, marco_celebrado_horas`)
          .is('arquivada_em', null)
          .order('criada_em')
          .overrideTypes<(LinhaTrilha & { marco_celebrado_horas: number })[], { merge: false }>(),
      ]);
      if (sessoes.error) throw sessoes.error;
      if (trilhas.error) throw trilhas.error;

      const mes = mesDe(dataDe(relogio()));
      const diasNoMes = new Set<Data>();
      const porTrilha = new Map<string, number>();
      let totalSegundos = 0;
      for (const s of sessoes.data) {
        totalSegundos += s.duracao_segundos;
        porTrilha.set(s.trilha_id, (porTrilha.get(s.trilha_id) ?? 0) + s.duracao_segundos);
        const dia = dataDe(new Date(s.inicio));
        if (dia >= mes.de && dia <= mes.ate) diasNoMes.add(dia);
      }

      return {
        totalSegundos,
        diasEstudadosNoMes: diasNoMes.size,
        trilhas: await Promise.all(
          trilhas.data.map(async (linha) => ({
            trilha: paraTrilha(linha),
            progresso: comMarcos(linha.id, porTrilha.get(linha.id) ?? 0, linha.marco_celebrado_horas),
            objetivosEmAndamento: (await objetivosDaTrilha(linha.id)).filter(
              (o) => o.situacao === 'em-andamento',
            ),
          })),
        ),
      };
    },

    // Marca que o usuário viu a celebração do Marco. Só o usuário: para o
    // Claude, isso seria editar a Trilha.
    async celebrarMarco(
      ator: Ator,
      { trilhaId, marco }: { trilhaId: string; marco: number },
    ): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'celebrar Marco');
      const { marco: alcancado } = await progressoDe(trilhaId);
      if (marco === 0 || marco !== alcancado.anterior)
        throw new EntradaInvalida('Esse Marco não é o último batido na Trilha.');
      // Celebrar de novo não muda nada (ex.: o mesmo toque em dois aparelhos).
      const { error } = await supabase
        .from('trilhas')
        .update({ marco_celebrado_horas: marco })
        .eq('id', trilhaId)
        .lt('marco_celebrado_horas', marco);
      if (error) throw error;
    },
  };
}

export type Companheiro = ReturnType<typeof criarCompanheiro>;
