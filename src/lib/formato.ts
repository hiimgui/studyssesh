import { FUSO, meiaNoite, mesDe, type Data } from '../companheiro/fuso';
import type { ObjetivoMensuravel } from '../companheiro/companheiro';

// Horas de estudo em texto curto: "45 min", "3h", "4h 30min".
export const horas = (segundos: number) => {
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const resto = minutos % 60;
  return `${Math.floor(minutos / 60)}h${resto ? ` ${String(resto).padStart(2, '0')}min` : ''}`;
};

// Datas de calendário viram texto pela meia-noite delas em São Paulo.
const emData = (d: Data, opcoes: Intl.DateTimeFormatOptions) =>
  meiaNoite(d).toLocaleDateString('pt-BR', { ...opcoes, timeZone: FUSO });
export const diaMes = (d: Data) => emData(d, { day: 'numeric', month: 'long' });
export const nomeDoMes = (d: Data) => emData(d, { month: 'long' });

export const descreverPeriodo = ({ de, ate }: ObjetivoMensuravel['periodo']) => {
  const mes = mesDe(de);
  if (mes.de === de && mes.ate === ate) return `em ${nomeDoMes(de)}`;
  if (de === ate) return `em ${diaMes(de)}`;
  if (de.slice(0, 7) === ate.slice(0, 7)) return `de ${Number(de.slice(8))} a ${diaMes(ate)}`;
  return `de ${diaMes(de)} a ${diaMes(ate)}`;
};

// "10h de estudo em outubro".
export const tituloDoObjetivo = (o: ObjetivoMensuravel) =>
  `${horas(o.metaHoras * 3600)} de estudo ${descreverPeriodo(o.periodo)}`;

export const progresso = (o: ObjetivoMensuravel) =>
  `${horas(o.estudadoSegundos)} de ${horas(o.metaHoras * 3600)}`;

// O que falta arredonda o minuto para cima: com 9h 59min feitas de 10h, falta 1 min.
export const faltam = (o: ObjetivoMensuravel) =>
  horas(Math.ceil(Math.max(0, o.metaHoras * 3600 - o.estudadoSegundos) / 60) * 60);

// "Semana de 5 a 11 de outubro", ou "de 28 de setembro a 4 de outubro".
export const semanaPorExtenso = ({ de, ate }: { de: Data; ate: Data }) =>
  de.slice(0, 7) === ate.slice(0, 7)
    ? `Semana de ${Number(de.slice(8))} a ${diaMes(ate)}`
    : `Semana de ${diaMes(de)} a ${diaMes(ate)}`;
