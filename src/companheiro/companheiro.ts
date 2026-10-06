import type { SupabaseClient } from '@supabase/supabase-js';

// Quem está agindo: o próprio usuário (app) ou o Claude (conector MCP).
export type Ator = 'usuario' | 'claude';

export type Relogio = () => Date;

export interface Trilha {
  id: string;
  nome: string;
  criadaEm: Date;
}

export interface Sessao {
  id: string;
  trilhaId: string;
  inicio: Date;
  fim: Date;
  duracaoSegundos: number;
  nota: string | null;
}

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
}

const paraTrilha = (linha: LinhaTrilha): Trilha => ({
  id: linha.id,
  nome: linha.nome,
  criadaEm: new Date(linha.criada_em),
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
}

const paraSessao = (linha: LinhaSessao): Sessao => ({
  id: linha.id,
  trilhaId: linha.trilha_id,
  inicio: new Date(linha.inicio),
  fim: new Date(linha.fim),
  duracaoSegundos: linha.duracao_segundos,
  nota: linha.nota,
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

  return {
    async criarTrilha(ator: Ator, { nome }: { nome: string }): Promise<Trilha> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'criar Trilha');
      nome = nome.trim();
      if (!nome) throw new EntradaInvalida('A Trilha precisa de um nome.');

      const { data, error } = await supabase
        .from('trilhas')
        .insert({ nome, criada_em: relogio().toISOString() })
        .select('id, nome, criada_em')
        .single();
      if (error) throw error;
      return paraTrilha(data);
    },

    // Todo Ator lê tudo.
    async listarTrilhas(_ator: Ator): Promise<Trilha[]> {
      const { data, error } = await supabase
        .from('trilhas')
        .select('id, nome, criada_em')
        .order('criada_em');
      if (error) throw error;
      return data.map(paraTrilha);
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
      return paraSessao(data);
    },

    // Todo Ator lê tudo. Mais recentes primeiro.
    async listarSessoes(
      _ator: Ator,
      { trilhaId, limite }: { trilhaId: string; limite?: number },
    ): Promise<Sessao[]> {
      let consulta = supabase
        .from('sessoes')
        .select('id, trilha_id, inicio, fim, duracao_segundos, nota')
        .eq('trilha_id', trilhaId)
        .order('inicio', { ascending: false });
      if (limite !== undefined) consulta = consulta.limit(limite);
      const { data, error } = await consulta;
      if (error) throw error;
      return data.map(paraSessao);
    },
  };
}

export type Companheiro = ReturnType<typeof criarCompanheiro>;
