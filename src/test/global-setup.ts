import { execSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

// Lê URL e chaves do Supabase local (`supabase start`), para os testes rodarem
// contra o Postgres real sem depender de um .env.
export default function setup(project: TestProject) {
  const saida = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const env = Object.fromEntries(
    [...saida.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(([, chave, valor]) => [chave, valor]),
  );
  if (!env.API_URL || !env.ANON_KEY || !env.SERVICE_ROLE_KEY) {
    throw new Error('Supabase local não está rodando. Rode `npx supabase start`.');
  }
  project.provide('supabase', {
    url: env.API_URL,
    anonKey: env.ANON_KEY,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
  });
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: { url: string; anonKey: string; serviceRoleKey: string };
  }
}
