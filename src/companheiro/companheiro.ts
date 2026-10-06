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
}

const COLUNAS_TIMER = 'id, trilha_id, iniciado_em, pausado_em, tempo_pausado_ms';

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
  async function buscarTimer(): Promise<LinhaTimer | null> {
    const { data, error } = await supabase
      .from('timers')
      .select(COLUNAS_TIMER)
      .maybeSingle<LinhaTimer>();
    if (error) throw error;
    return data;
  }

  async function timerObrigatorio(): Promise<LinhaTimer> {
    const timer = await buscarTimer();
    if (!timer) throw new SemTimerLigado();
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
        estudadoMs: tempoEstudadoMs(timer, relogio()),
      };
    },

    // O timer é só do usuário. O Claude registra estudo de outro jeito (pelo chat).
    async iniciarTimer(ator: Ator, { trilhaId }: { trilhaId: string }): Promise<void> {
      if (ator !== 'usuario') throw new PermissaoNegada(ator, 'ligar o timer');
      const { error } = await supabase
        .from('timers')
        .insert({ trilha_id: trilhaId, iniciado_em: relogio().toISOString() });
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
      const pausaMs = relogio().getTime() - new Date(timer.pausado_em).getTime();
      const { error } = await supabase
        .from('timers')
        .update({ pausado_em: null, tempo_pausado_ms: timer.tempo_pausado_ms + pausaMs })
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
