export const FUSO = 'America/Sao_Paulo';

const formatoParede = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
});

// Data e hora "de parede" no fuso do app.
function parede(instante: Date) {
  const p = Object.fromEntries(
    formatoParede.formatToParts(instante).map(({ type, value }) => [type, Number(value)]),
  );
  return { ano: p.year, mes: p.month, dia: p.day, hora: p.hour, minuto: p.minute };
}

// "HH:MM" no fuso do app, no dia mais recente em que esse horário já passou
// em relação a `agora`. Serve para a pergunta "até quando você estudou?".
export function horarioMaisRecente(hhmm: string, agora: Date): Date | null {
  const casamento = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!casamento) return null;
  const [h, m] = [Number(casamento[1]), Number(casamento[2])];
  if (h > 23 || m > 59) return null;

  const p = parede(agora);
  const deslocamentoMs =
    Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto) -
    Math.floor(agora.getTime() / 60_000) * 60_000;

  let instante = Date.UTC(p.ano, p.mes - 1, p.dia, h, m) - deslocamentoMs;
  if (instante > agora.getTime()) instante -= 24 * 60 * 60_000;
  return new Date(instante);
}
