import type { SupabaseClient } from '@supabase/supabase-js';

// Quem está agindo: o próprio usuário (app) ou o Claude (conector MCP).
export type Ator = 'usuario' | 'claude';

export type Relogio = () => Date;

export interface Trilha {
  id: string;
  nome: string;
  criadaEm: Date;
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

export function criarCompanheiro({ supabase, relogio = () => new Date() }: Dependencias) {
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
  };
}

export type Companheiro = ReturnType<typeof criarCompanheiro>;
