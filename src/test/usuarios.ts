import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inject } from 'vitest';

// Cria um usuário novo no Supabase local e devolve um cliente logado como ele.
// Cada teste usa usuários próprios, então não há limpeza entre testes.
export async function novoUsuario(): Promise<SupabaseClient> {
  const { url, anonKey, serviceRoleKey } = inject('supabase');
  const email = `teste-${randomUUID()}@aibou.test`;
  const password = randomUUID();

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { error: erroCriacao } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (erroCriacao) throw erroCriacao;

  const cliente = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password });
  if (erroLogin) throw erroLogin;
  return cliente;
}

// Relógio controlado pelo teste.
export function relogioFixo(inicio: string) {
  let agora = new Date(inicio);
  const relogio = () => new Date(agora);
  relogio.avancar = (ms: number) => {
    agora = new Date(agora.getTime() + ms);
  };
  // O tempo só anda para a frente, como no relógio de verdade.
  relogio.avancarAte = (instante: string) => {
    const alvo = new Date(instante);
    if (alvo < agora) throw new Error(`O relógio não volta: ${instante} é antes de agora.`);
    agora = alvo;
  };
  return relogio;
}
