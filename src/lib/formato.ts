import { FUSO, meiaNoite, mesDe, type Data } from '../companheiro/fuso';
import type {
  Motivo,
  Objetivo,
  ObjetivoMensuravel,
  SituacaoDaRecomendacao,
  TipoRecomendacao,
} from '../companheiro/companheiro';

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

// O nome de qualquer Objetivo numa linha: a descrição ou a meta de horas.
export const nomeDoObjetivo = (o: Objetivo) =>
  o.tipo === 'abstrato' ? o.descricao : tituloDoObjetivo(o);

export const ROTULO_DO_TIPO: Record<TipoRecomendacao, string> = {
  projeto: 'Projeto',
  roteiro: 'Roteiro',
  deck: 'Deck',
  material: 'Material Extra',
};

export const ROTULO_DO_MOTIVO: Record<Motivo, string> = {
  'ja-sei': 'já sei',
  'formato-nao-serve': 'formato não me serve',
  'agora-nao': 'agora não',
  'fora-do-foco': 'fora do foco',
};

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

// Quando um Resumo saiu: "segunda-feira, 12 de outubro, 07:07".
export const quandoSaiu = (d: Date) =>
  d.toLocaleString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  });

// Para o filtro e a contagem: "em aberto", "aceitas", "recusadas".
export const ROTULO_DA_SITUACAO: Record<SituacaoDaRecomendacao, string> = {
  aberta: 'em aberto',
  aceita: 'aceitas',
  recusada: 'recusadas',
};

// "2 em aberto", "1 aceita", "3 recusadas".
export const quantasNaSituacao = (n: number, situacao: SituacaoDaRecomendacao) =>
  situacao === 'aberta'
    ? `${n} em aberto`
    : `${n} ${situacao}${n === 1 ? '' : 's'}`;
