import type { Companheiro } from '../companheiro/companheiro';
import type { relogioFixo } from './usuarios';

const MINUTO = 60_000;

// Uma Sessão de `minutos` pelo timer, seguida de 1h sem estudo. Numa Sessão de
// 1h ou mais, a Inatividade pausa o timer e a pessoa responde, na volta, que
// estudou até agora (como quem lia um livro longe da tela).
export async function estudar(
  companheiro: Companheiro,
  relogio: ReturnType<typeof relogioFixo>,
  trilhaId: string,
  minutos: number,
) {
  await companheiro.iniciarTimer('usuario', { trilhaId });
  relogio.avancar(minutos * MINUTO);
  if (minutos >= 60) await companheiro.informarFimDoEstudo('usuario', { ate: relogio() });
  await companheiro.encerrarTimer('usuario');
  relogio.avancar(60 * MINUTO);
}
