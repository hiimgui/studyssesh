import { EMAILS_PERMITIDOS } from 'astro:env/server';
import { emailPermitido } from './acesso';

// A regra de acesso com a configuração do servidor (ver acesso.ts).
export const podeEntrar = (email: string | null | undefined) =>
  emailPermitido(email, EMAILS_PERMITIDOS, { producao: import.meta.env.PROD });
