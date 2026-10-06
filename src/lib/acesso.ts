// Quem pode entrar no app: os e-mails de EMAILS_PERMITIDOS, uma lista separada
// por vírgula. Sem lista, a produção fica fechada para todo mundo (fail
// closed); em dev e nos testes, aberta, para não depender da variável.
export function emailPermitido(
  email: string | null | undefined,
  lista: string | undefined,
  { producao }: { producao: boolean },
): boolean {
  const permitidos = (lista ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (permitidos.length === 0) return !producao;
  const normalizado = email?.trim().toLowerCase();
  return !!normalizado && permitidos.includes(normalizado);
}
