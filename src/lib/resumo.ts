import { FUSO, meiaNoite, semanaDe, somarDias, type Data } from '../companheiro/fuso';

const diaMes = (d: Data) =>
  meiaNoite(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: FUSO });

// O "gerar agora" da Trilha (ADR 0002): não dispara o Claude sozinho; abre o
// claude.ai com o prompt pronto, e o usuário confirma. Cobre a semana anterior
// (segunda a domingo), a mesma da routine. As regras completas do Resumo
// estão em docs/rotinas/resumo-semanal.md; aqui vai o essencial, que cabe
// numa URL.
export function linkGerarAgora(trilha: { id: string; nome: string }, hoje: Data): string {
  const semana = semanaDe(somarDias(hoje, -7));
  const periodo = `${Number(semana.de.slice(8))} a ${diaMes(semana.ate)}`;
  const prompt = [
    `Use o conector do Aibou para escrever o Resumo semanal da Trilha "${trilha.nome}" ` +
      `(id ${trilha.id}), cobrindo a semana de ${periodo} (semana_de ${semana.de}).`,
    'Leia com consultar_trilha. Se já houver Resumo dessa semana, me avise e não grave outro.',
    'Escreva em português do Brasil, de 150 a 300 palavras: o que estudei (pelas notas), ' +
      'como vão os Objetivos e o próximo Marco, e o plano desta semana. Tom de incentivo: ' +
      'semana fraca vira plano novo, nunca bronca.',
    'Apoie-se em fontes confiáveis (PT ou EN) com link https que você conferiu. Inclua de 2 a 4 ' +
      'Recomendações ligadas ao id de um Objetivo da Trilha, com pelo menos um Material Extra ' +
      '(tipo "material", com link).',
    'Antes de gravar, revise o texto para soar natural, sem cara de texto gerado (use a skill ' +
      'humanizer, se estiver disponível). Grave com gravar_resumo.',
  ].join('\n\n');
  return `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`;
}
