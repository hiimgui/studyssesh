import type { SupabaseClient } from '@supabase/supabase-js';
import { gerarApkg, type CartaDoDeck } from '../lib/apkg';
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
  // Nascido de um projeto aceito: o Objetivo a que esse projeto serve.
  projetoDe: string | null;
  criadoEm: Date;
  concluidoEm: Date | null;
  itens: Itens;
  // Sem período, não há como ficar encerrado.
  situacao: Exclude<SituacaoObjetivo, 'encerrado'>;
}

export type Objetivo = ObjetivoMensuravel | ObjetivoAbstrato;

// Os itens ligados a um Objetivo: projetos aceitos e itens da Biblioteca.
export interface Itens {
  concluidos: number;
  total: number;
}

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

// Proposta concreta do Claude num Resumo, sempre ligada a um Objetivo da
// Trilha. `material` é o Material Extra, que todo Resumo traz.
export type TipoRecomendacao = 'projeto' | 'roteiro' | 'deck' | 'material';

export interface Recomendacao {
  id: string;
  objetivoId: string;
  tipo: TipoRecomendacao;
  titulo: string;
  descricao: string;
  url: string | null;
  // As cartas de um Deck; null nos outros tipos.
  cartas: Carta[] | null;
  // A resposta do usuário, ou null enquanto ninguém respondeu.
  decisao: Decisao | null;
}

// Por que uma Recomendação foi recusada, escolhido com um toque.
export type Motivo = 'ja-sei' | 'formato-nao-serve' | 'agora-nao' | 'fora-do-foco';

export const MOTIVOS: Motivo[] = ['ja-sei', 'formato-nao-serve', 'agora-nao', 'fora-do-foco'];

// O registro de que uma Recomendação foi aceita ou recusada. Toda recusa tem Motivo.
export type Decisao = {
  recomendacaoId: string;
  decididaEm: Date;
} & ({ resposta: 'aceita'; motivo: null } | { resposta: 'recusada'; motivo: Motivo });

// Uma Decisão passada com o que foi recomendado, para o Claude aprender as
// preferências do usuário.
export type DecisaoPassada = Decisao & {
  recomendacao: Pick<Recomendacao, 'objetivoId' | 'tipo' | 'titulo' | 'descricao'>;
};

export type Resposta =
  | { recomendacaoId: string; resposta: 'aceita' }
  | { recomendacaoId: string; resposta: 'recusada'; motivo: Motivo };

// Um Deck ou Material Extra aceito. Marcado como feito, avança a barra do
// Objetivo abstrato ligado.
export interface ItemDaBiblioteca {
  id: string;
  trilhaId: string;
  recomendacaoId: string;
  objetivoId: string;
  tipo: 'deck' | 'material';
  titulo: string;
  descricao: string;
  url: string | null;
  // Quantas cartas o Deck tem para baixar; 0 num Material Extra.
  cartas: number;
  adicionadoEm: Date;
  feitoEm: Date | null;
}

export interface Fonte {
  titulo: string;
  url: string;
}

// Análise semanal do Claude por Trilha, de segunda a domingo em São Paulo.
export interface Resumo {
  id: string;
  trilhaId: string;
  semana: { de: Data; ate: Data };
  texto: string;
  fontes: Fonte[];
  geradoEm: Date;
  recomendacoes: Recomendacao[];
}

// Em que pé está uma Recomendação: ninguém respondeu, ou a Decisão tomada.
export type SituacaoDaRecomendacao = 'aberta' | 'aceita' | 'recusada';

export const SITUACOES: SituacaoDaRecomendacao[] = ['aberta', 'aceita', 'recusada'];

export const situacaoDe = (r: Recomendacao): SituacaoDaRecomendacao => r.decisao?.resposta ?? 'aberta';

// Um Resumo no histórico, com quantas Recomendações há em cada situação.
export type ResumoNoHistorico = Resumo & { contagem: Record<SituacaoDaRecomendacao, number> };

export interface HistoricoDeResumos {
  trilha: Trilha;
  resumos: ResumoNoHistorico[];
}

export interface NovaRecomendacao {
  objetivoId: string;
  tipo: TipoRecomendacao;
  titulo: string;
  descricao: string;
  url?: string;
  // Só num Deck, e obrigatórias nele: o app gera o .apkg a partir delas.
  cartas?: Carta[];
}

// Uma carta de Anki de um Deck: a pergunta na frente, a resposta no verso.
export type Carta = CartaDoDeck;

// Um Deck pronto para importar no Anki.
export interface DeckBaixado {
  nomeDoArquivo: string;
  apkg: Uint8Array<ArrayBuffer>;
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
  // Quando saiu o último Resumo, de qualquer Trilha. Se a routine semanal
  // falhar, é aqui que se vê (ADR 0002).
  ultimoResumoEm: Date | null;
  trilhas: {
    trilha: Trilha;
    progresso: ProgressoDaTrilha;
    objetivosEmAndamento: Objetivo[];
    ultimoResumo: Resumo | null;
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
  projeto_de: null;
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
  projeto_de: string | null;
}

type LinhaObjetivo = LinhaMensuravel | LinhaAbstrato;

const COLUNAS_OBJETIVO =
  'id, tipo, trilha_id, meta_segundos, periodo_inicio, periodo_fim, descricao, criado_em, concluido_em, ' +
  'projeto_de';

const SEM_ITENS: Itens = { concluidos: 0, total: 0 };

const paraAbstrato = (linha: LinhaAbstrato, itens: Itens = SEM_ITENS): ObjetivoAbstrato => ({
  id: linha.id,
  tipo: 'abstrato',
  trilhaId: linha.trilha_id,
  descricao: linha.descricao,
  projetoDe: linha.projeto_de,
  criadoEm: new Date(linha.criado_em),
  concluidoEm: linha.concluido_em ? new Date(linha.concluido_em) : null,
  itens,
  situacao: linha.concluido_em ? 'concluido' : 'em-andamento',
});

const HORA_S = 3600;

const TIPOS_DE_RECOMENDACAO: TipoRecomendacao[] = ['projeto', 'roteiro', 'deck', 'material'];

// Só links web: nada de javascript:, data: ou caminhos soltos na página.
function ehLink(texto: string | undefined): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(texto ?? '').protocol);
  } catch {
    return false;
  }
}

interface LinhaResumo {
  id: string;
  trilha_id: string;
  semana_de: string;
  semana_ate: string;
  texto: string;
  fontes: Fonte[];
  gerado_em: string;
  recomendacoes: {
    id: string;
    objetivo_id: string;
    posicao: number;
    tipo: TipoRecomendacao;
    titulo: string;
    descricao: string;
    url: string | null;
    cartas: Carta[] | null;
    decisoes: LinhaDecisao | null;
  }[];
}

interface LinhaDecisao {
  recomendacao_id: string;
  resposta: 'aceita' | 'recusada';
  motivo: Motivo | null;
  decidida_em: string;
}

const COLUNAS_DECISAO = 'recomendacao_id, resposta, motivo, decidida_em';

const paraDecisao = (linha: LinhaDecisao): Decisao =>
  ({
    recomendacaoId: linha.recomendacao_id,
    resposta: linha.resposta,
    motivo: linha.motivo,
    decididaEm: new Date(linha.decidida_em),
  }) as Decisao;

const COLUNAS_RESUMO =
  'id, trilha_id, semana_de, semana_ate, texto, fontes, gerado_em, ' +
  `recomendacoes (id, objetivo_id, posicao, tipo, titulo, descricao, url, cartas, decisoes (${COLUNAS_DECISAO}))`;

interface LinhaItem {
  id: string;
  trilha_id: string;
  recomendacao_id: string;
  objetivo_id: string;
  adicionado_em: string;
  feito_em: string | null;
  recomendacoes: {
    tipo: 'deck' | 'material';
    titulo: string;
    descricao: string;
    url: string | null;
    cartas: Carta[] | null;
  };
}

const COLUNAS_ITEM =
  'id, trilha_id, recomendacao_id, objetivo_id, adicionado_em, feito_em, ' +
  'recomendacoes (tipo, titulo, descricao, url, cartas)';

const paraItem = (linha: LinhaItem): ItemDaBiblioteca => ({
  id: linha.id,
  trilhaId: linha.trilha_id,
  recomendacaoId: linha.recomendacao_id,
  objetivoId: linha.objetivo_id,
  tipo: linha.recomendacoes.tipo,
  titulo: linha.recomendacoes.titulo,
  descricao: linha.recomendacoes.descricao,
  url: linha.recomendacoes.url,
  cartas: linha.recomendacoes.cartas?.length ?? 0,
  adicionadoEm: new Date(linha.adicionado_em),
  feitoEm: linha.feito_em ? new Date(linha.feito_em) : null,
});

const paraResumo = (linha: LinhaResumo): Resumo => ({
  id: linha.id,
  trilhaId: linha.trilha_id,
  semana: { de: linha.semana_de, ate: linha.semana_ate },
  texto: linha.texto,
  fontes: linha.fontes,
  geradoEm: new Date(linha.gerado_em),
  recomendacoes: [...linha.recomendacoes]
    .sort((a, b) => a.posicao - b.posicao)
    .map((r) => ({
      id: r.id,
      objetivoId: r.objetivo_id,
      tipo: r.tipo,
      titulo: r.titulo,
      descricao: r.descricao,
      url: r.url,
      cartas: r.cartas,
      decisao: r.decisoes ? paraDecisao(r.decisoes) : null,
    })),
});

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

  async function resumosDaTrilha(trilhaId: string, limite?: number): Promise<Resumo[]> {
    let consulta = supabase
      .from('resumos')
      .select(COLUNAS_RESUMO)
      .eq('trilha_id', trilhaId)
      .order('gerado_em', { ascending: false });
    if (limite !== undefined) consulta = consulta.limit(limite);
    const { data, error } = await consulta.overrideTypes<LinhaResumo[], { merge: false }>();
    if (error) throw error;
    return data.map(paraResumo);
  }

  async function objetivosDaTrilha(trilhaId: string): Promise<Objetivo[]> {
    const [objetivos, itens] = await Promise.all([
      supabase
        .from('objetivos')
        .select(COLUNAS_OBJETIVO)
        .eq('trilha_id', trilhaId)
        .order('criado_em')
        .overrideTypes<LinhaObjetivo[], { merge: false }>(),
      supabase.from('itens_biblioteca').select('objetivo_id, feito_em').eq('trilha_id', trilhaId),
    ]);
    if (objetivos.error) throw objetivos.error;
    if (itens.error) throw itens.error;

    // Cada projeto aceito e cada item da Biblioteca conta para o seu Objetivo:
    // concluído quando o projeto foi concluído ou o item, marcado como feito.
    const ligados = new Map<string, Itens>();
    const contar = (objetivoId: string, concluido: boolean) => {
      const atual = ligados.get(objetivoId) ?? SEM_ITENS;
      ligados.set(objetivoId, {
        concluidos: atual.concluidos + (concluido ? 1 : 0),
        total: atual.total + 1,
      });
    };
    for (const o of objetivos.data) if (o.projeto_de) contar(o.projeto_de, !!o.concluido_em);
    for (const i of itens.data) contar(i.objetivo_id, !!i.feito_em);

    return Promise.all(
      objetivos.data.map((linha) =>
        linha.tipo === 'abstrato' ? paraAbstrato(linha, ligados.get(linha.id)) : paraMensuravel(linha),
      ),
    );
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
      // O timer ligado ainda vai virar Sessão: ele ocupa do início até agora,
      // ou só até a pausa, se a Inatividade o pausou.
      const timer = await buscarTimer();
      if (timer) {
        const ocupadoAte =
          timer.pausado_por_inatividade && timer.pausado_em ? new Date(timer.pausado_em) : agora;
        if (inicio < ocupadoAte && termino > new Date(timer.iniciado_em))
          throw new EntradaInvalida('O timer está contando estudo nesse horário.');
      }

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
      if (!antes.concluido_em) {
        const { error } = await supabase
          .from('objetivos')
          .update({ concluido_em: relogio().toISOString() })
          .eq('id', objetivoId)
          .is('concluido_em', null);
        if (error) throw error;
      }
      // Relido com a Trilha, para vir com os itens ligados.
      return (await objetivosDaTrilha(antes.trilha_id)).find(
        (o): o is ObjetivoAbstrato => o.id === objetivoId && o.tipo === 'abstrato',
      )!;
    },

    // O Resumo é do Claude (ADR 0002): ele cria, e ninguém edita nem apaga.
    async criarResumo(
      ator: Ator,
      {
        trilhaId,
        semanaDe: segunda,
        texto,
        fontes,
        recomendacoes,
      }: {
        trilhaId: string;
        // A segunda-feira que abre a semana coberta.
        semanaDe: Data;
        texto: string;
        fontes: Fonte[];
        recomendacoes: NovaRecomendacao[];
      },
    ): Promise<Resumo> {
      if (ator !== 'claude') throw new PermissaoNegada(ator, 'escrever Resumo');
      if (!ehData(segunda) || semanaDe(segunda).de !== segunda)
        throw new EntradaInvalida('A semana começa numa segunda (AAAA-MM-DD).');
      if (segunda > dataDe(relogio())) throw new EntradaInvalida('Essa semana ainda não começou.');
      texto = texto.trim();
      if (!texto) throw new EntradaInvalida('O Resumo precisa de texto.');
      if (fontes.length === 0) throw new EntradaInvalida('O Resumo se apoia em pelo menos uma fonte.');
      for (const fonte of fontes) {
        if (!fonte.titulo?.trim() || !ehLink(fonte.url))
          throw new EntradaInvalida('Cada fonte precisa de título e de um link http(s).');
      }
      for (const r of recomendacoes) {
        if (!TIPOS_DE_RECOMENDACAO.includes(r.tipo))
          throw new EntradaInvalida('Recomendação é projeto, roteiro, deck ou material.');
        if (!r.titulo?.trim()) throw new EntradaInvalida('Toda Recomendação precisa de título.');
        if (r.url !== undefined && r.url !== null && !ehLink(r.url))
          throw new EntradaInvalida('O link da Recomendação precisa ser http(s).');
        if (r.tipo !== 'deck' && r.cartas !== undefined && r.cartas !== null)
          throw new EntradaInvalida('Só um Deck tem cartas.');
        if (
          r.tipo === 'deck' &&
          !(r.cartas?.length && r.cartas.every((c) => c.frente?.trim() && c.verso?.trim()))
        )
          throw new EntradaInvalida('Um Deck traz cartas, cada uma com frente e verso.');
      }
      if (!recomendacoes.some((r) => r.tipo === 'material'))
        throw new EntradaInvalida('Todo Resumo traz pelo menos um Material Extra.');
      await garantirTrilhaAtiva(trilhaId);
      const daTrilha = new Set((await objetivosDaTrilha(trilhaId)).map((o) => o.id));
      if (!recomendacoes.every((r) => daTrilha.has(r.objetivoId)))
        throw new EntradaInvalida('Toda Recomendação aponta um Objetivo desta Trilha.');

      const { data: id, error } = await supabase.rpc('criar_resumo', {
        p_trilha: trilhaId,
        p_semana_de: segunda,
        p_texto: texto,
        p_fontes: fontes.map((f) => ({ titulo: f.titulo.trim(), url: f.url })),
        p_gerado_em: relogio().toISOString(),
        p_recomendacoes: recomendacoes.map((r) => ({
          objetivo_id: r.objetivoId,
          tipo: r.tipo,
          titulo: r.titulo.trim(),
          descricao: r.descricao?.trim() ?? '',
          url: r.url ?? null,
          cartas:
            r.tipo === 'deck'
              ? r.cartas!.map((c) => ({ frente: c.frente.trim(), verso: c.verso.trim() }))
              : null,
        })),
      });
      if (error) throw error;
      const { data, error: erroLeitura } = await supabase
        .from('resumos')
        .select(COLUNAS_RESUMO)
        .eq('id', id)
        .single<LinhaResumo>();
      if (erroLeitura) throw erroLeitura;
      return paraResumo(data);
    },

    // Todo Ator lê tudo. A linha do tempo da Trilha: mais recentes primeiro.
    async listarResumos(
      _ator: Ator,
      { trilhaId, limite }: { trilhaId: string; limite?: number },
    ): Promise<Resumo[]> {
      return resumosDaTrilha(trilhaId, limite);
    },

    // Todo Ator lê tudo. O histórico de Resumos de uma Trilha, ativa ou
    // arquivada, mais recentes primeiro. Com filtro, só os Resumos com alguma
    // Recomendação para o Objetivo e na situação pedidos (a mesma Recomendação
    // atende aos dois filtros juntos).
    async historicoDeResumos(
      _ator: Ator,
      {
        trilhaId,
        objetivoId,
        situacao,
      }: { trilhaId: string; objetivoId?: string; situacao?: SituacaoDaRecomendacao },
    ): Promise<HistoricoDeResumos | null> {
      const { data, error } = await supabase
        .from('trilhas')
        .select(COLUNAS_TRILHA)
        .eq('id', trilhaId)
        .maybeSingle<LinhaTrilha>();
      if (error) throw error;
      if (!data) return null;
      const bate = (rec: Recomendacao) =>
        (!objetivoId || rec.objetivoId === objetivoId) && (!situacao || situacaoDe(rec) === situacao);
      const resumos = (await resumosDaTrilha(trilhaId)).filter((r) => r.recomendacoes.some(bate));
      return {
        trilha: paraTrilha(data),
        resumos: resumos.map((r) => {
          const contagem = { aberta: 0, aceita: 0, recusada: 0 };
          for (const rec of r.recomendacoes) contagem[situacaoDe(rec)]++;
          return { ...r, contagem };
        }),
      };
    },

    // Aceitar ou recusar é escolha do usuário, no app ou pelo chat (aí o Claude
    // registra a Decisão a pedido dele). Aceito, o projeto vira Objetivo e o
    // Deck ou Material Extra entra na Biblioteca da Trilha; o roteiro fica só
    // com a Decisão. O Objetivo do projeto nasce mesmo com outro em andamento,
    // porque é ligado a ele e não o substitui (ADR 0002, atualização da #13).
    async decidirRecomendacao(_ator: Ator, resposta: Resposta): Promise<Decisao> {
      if (resposta.resposta !== 'aceita' && resposta.resposta !== 'recusada')
        throw new EntradaInvalida('Uma Recomendação é aceita ou recusada.');
      if (resposta.resposta === 'recusada' && !MOTIVOS.includes(resposta.motivo))
        throw new EntradaInvalida(
          'Para recusar, diga o Motivo: já sei, formato não me serve, agora não ou fora do foco.',
        );
      const { data: rec, error } = await supabase
        .from('recomendacoes')
        .select('tipo, titulo, resumos (trilha_id)')
        .eq('id', resposta.recomendacaoId)
        .maybeSingle<{ tipo: TipoRecomendacao; titulo: string; resumos: { trilha_id: string } }>();
      if (error) throw error;
      if (!rec) throw new EntradaInvalida('Recomendação não encontrada.');
      await garantirTrilhaAtiva(rec.resumos.trilha_id);

      const aceita = resposta.resposta === 'aceita';
      const { error: erroDecisao } = await supabase.rpc('decidir_recomendacao', {
        p_recomendacao: resposta.recomendacaoId,
        p_resposta: resposta.resposta,
        p_motivo: aceita ? null : resposta.motivo,
        p_decidida_em: relogio().toISOString(),
        // O projeto aceito vira Objetivo com o título do projeto.
        p_novo_objetivo: aceita && rec.tipo === 'projeto' ? rec.titulo : null,
        p_para_biblioteca: aceita && (rec.tipo === 'deck' || rec.tipo === 'material'),
      });
      // Já respondida, talvez noutro aparelho: a primeira resposta é a que vale.
      if (erroDecisao?.code === VIOLACAO_UNICA)
        throw new EntradaInvalida('Esta Recomendação já foi respondida.');
      if (erroDecisao) throw erroDecisao;
      const { data, error: erroLeitura } = await supabase
        .from('decisoes')
        .select(COLUNAS_DECISAO)
        .eq('recomendacao_id', resposta.recomendacaoId)
        .single<LinhaDecisao>();
      if (erroLeitura) throw erroLeitura;
      return paraDecisao(data);
    },

    // Marcar como feito é do usuário; desmarcar corrige um toque errado.
    // Marcar de novo não muda a data (o mesmo toque pode vir de dois aparelhos).
    async marcarItemFeito(
      ator: Ator,
      { itemId, feito }: { itemId: string; feito: boolean },
    ): Promise<ItemDaBiblioteca> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'marcar item da Biblioteca');
      const buscar = async () => {
        const { data, error } = await supabase
          .from('itens_biblioteca')
          .select(COLUNAS_ITEM)
          .eq('id', itemId)
          .maybeSingle<LinhaItem>();
        if (error) throw error;
        if (!data) throw new EntradaInvalida('Item da Biblioteca não encontrado.');
        return data;
      };
      const antes = await buscar();
      if (!!antes.feito_em === feito) return paraItem(antes);
      await garantirTrilhaAtiva(antes.trilha_id);
      const atualizacao = supabase
        .from('itens_biblioteca')
        .update({ feito_em: feito ? relogio().toISOString() : null })
        .eq('id', itemId);
      const { error } = await (feito
        ? atualizacao.is('feito_em', null)
        : atualizacao.not('feito_em', 'is', null));
      if (error) throw error;
      return paraItem(await buscar());
    },

    // Todo Ator lê tudo. As Decisões da Trilha, mais recentes primeiro.
    async listarDecisoes(
      _ator: Ator,
      { trilhaId }: { trilhaId: string },
    ): Promise<DecisaoPassada[]> {
      const { data, error } = await supabase
        .from('decisoes')
        .select(
          `${COLUNAS_DECISAO}, ` +
            'recomendacoes!inner (objetivo_id, tipo, titulo, descricao, resumos!inner (trilha_id))',
        )
        .eq('recomendacoes.resumos.trilha_id', trilhaId)
        .order('decidida_em', { ascending: false })
        .overrideTypes<
          (LinhaDecisao & {
            recomendacoes: {
              objetivo_id: string;
              tipo: TipoRecomendacao;
              titulo: string;
              descricao: string;
            };
          })[],
          { merge: false }
        >();
      if (error) throw error;
      return data.map((linha) => ({
        ...paraDecisao(linha),
        recomendacao: {
          objetivoId: linha.recomendacoes.objetivo_id,
          tipo: linha.recomendacoes.tipo,
          titulo: linha.recomendacoes.titulo,
          descricao: linha.recomendacoes.descricao,
        },
      }));
    },

    // Todo Ator lê tudo. Na ordem em que entraram.
    async listarBiblioteca(
      _ator: Ator,
      { trilhaId }: { trilhaId: string },
    ): Promise<ItemDaBiblioteca[]> {
      const { data, error } = await supabase
        .from('itens_biblioteca')
        .select(COLUNAS_ITEM)
        .eq('trilha_id', trilhaId)
        .order('adicionado_em')
        .overrideTypes<LinhaItem[], { merge: false }>();
      if (error) throw error;
      return data.map(paraItem);
    },

    // Todo Ator lê tudo, e baixar é ler. O baralho leva o nome da Trilha e do
    // Deck ("Trilha::Deck"), que o Anki mostra como um baralho dentro do outro.
    async baixarDeck(_ator: Ator, { itemId }: { itemId: string }): Promise<DeckBaixado> {
      const { data, error } = await supabase
        .from('itens_biblioteca')
        .select('recomendacao_id, trilhas (nome), recomendacoes (tipo, titulo, cartas)')
        .eq('id', itemId)
        .maybeSingle<{
          recomendacao_id: string;
          trilhas: { nome: string };
          recomendacoes: { tipo: TipoRecomendacao; titulo: string; cartas: Carta[] | null };
        }>();
      if (error) throw error;
      if (!data) throw new EntradaInvalida('Item da Biblioteca não encontrado.');
      const { tipo, titulo, cartas } = data.recomendacoes;
      // Um Deck gravado antes das cartas existirem também não tem o que baixar.
      if (tipo !== 'deck' || !cartas?.length)
        throw new EntradaInvalida('Só um Deck se baixa para o Anki.');
      return {
        // Sem os caracteres que Windows, macOS ou Linux recusam num nome de arquivo.
        nomeDoArquivo: `${titulo.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')}.apkg`,
        apkg: gerarApkg({
          id: data.recomendacao_id,
          nome: `${data.trilhas.nome}::${titulo}`,
          cartas,
          agora: relogio(),
        }),
      };
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
      const [sessoes, ultimoResumo, trilhas] = await Promise.all([
        supabase.from('sessoes').select('trilha_id, inicio, duracao_segundos'),
        supabase
          .from('resumos')
          .select('gerado_em')
          .order('gerado_em', { ascending: false })
          .limit(1)
          .maybeSingle<{ gerado_em: string }>(),
        supabase
          .from('trilhas')
          .select(`${COLUNAS_TRILHA}, marco_celebrado_horas`)
          .is('arquivada_em', null)
          .order('criada_em')
          .overrideTypes<(LinhaTrilha & { marco_celebrado_horas: number })[], { merge: false }>(),
      ]);
      if (sessoes.error) throw sessoes.error;
      if (trilhas.error) throw trilhas.error;
      if (ultimoResumo.error) throw ultimoResumo.error;

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
        ultimoResumoEm: ultimoResumo.data ? new Date(ultimoResumo.data.gerado_em) : null,
        trilhas: await Promise.all(
          trilhas.data.map(async (linha) => ({
            trilha: paraTrilha(linha),
            progresso: comMarcos(linha.id, porTrilha.get(linha.id) ?? 0, linha.marco_celebrado_horas),
            objetivosEmAndamento: (await objetivosDaTrilha(linha.id)).filter(
              (o) => o.situacao === 'em-andamento',
            ),
            ultimoResumo: (await resumosDaTrilha(linha.id, 1))[0] ?? null,
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
