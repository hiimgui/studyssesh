// Datas de calendário no fuso do usuário. Dia, semana e mês sempre começam à
// meia-noite de America/Sao_Paulo, nunca à de UTC.
export const FUSO = 'America/Sao_Paulo';

// Uma data de calendário, como '2026-10-31'.
export type Data = string;

const partes = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function relogioDeParede(instante: Date) {
  const p = Object.fromEntries(partes.formatToParts(instante).map((x) => [x.type, x.value]));
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    // O mesmo horário de parede lido como se fosse UTC.
    comoUtc: Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!),
  };
}

// A data de calendário de um instante, em São Paulo.
export function dataDe(instante: Date): Data {
  return relogioDeParede(instante).data;
}

// O instante da meia-noite que abre a data, em São Paulo.
export function meiaNoite(data: Data): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  const palpite = Date.UTC(ano!, mes! - 1, dia!);
  // Desconta a diferença do fuso naquele momento (-3h hoje, mas a conta não
  // supõe isso, caso o horário de verão volte).
  const desvio = relogioDeParede(new Date(palpite)).comoUtc - palpite;
  return new Date(palpite - desvio);
}

// Soma dias a uma data de calendário.
export function somarDias(data: Data, dias: number): Data {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano!, mes! - 1, dia! + dias)).toISOString().slice(0, 10);
}

export function ehData(texto: string): texto is Data {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && somarDias(texto, 0) === texto;
}

// Primeiro e último dia do mês da data.
export function mesDe(data: Data): { de: Data; ate: Data } {
  const de = `${data.slice(0, 8)}01`;
  const [ano, mes] = data.split('-').map(Number);
  const ate = new Date(Date.UTC(ano!, mes!, 0)).toISOString().slice(0, 10);
  return { de, ate };
}

// Segunda a domingo da semana da data (a mesma semana do Resumo).
export function semanaDe(data: Data): { de: Data; ate: Data } {
  const [ano, mes, dia] = data.split('-').map(Number);
  const diaDaSemana = new Date(Date.UTC(ano!, mes! - 1, dia!)).getUTCDay();
  const de = somarDias(data, -((diaDaSemana + 6) % 7));
  return { de, ate: somarDias(de, 6) };
}
