// Caracterização das contas de fuso que as rotas usam direto (fora do
// Companheiro): "até quando você estudou?" na volta da Inatividade.
import { describe, expect, it } from 'vitest';
import { horarioMaisRecente } from './fuso';

describe('horarioMaisRecente: "HH:MM" de São Paulo no dia mais recente em que já passou', () => {
  const agora = new Date('2026-10-07T17:30:00Z'); // 14:30 em São Paulo

  it('um horário que já passou hoje fica hoje', () => {
    expect(horarioMaisRecente('14:00', agora)).toEqual(new Date('2026-10-07T17:00:00Z'));
    expect(horarioMaisRecente('14:30', agora)).toEqual(new Date('2026-10-07T17:30:00Z'));
  });

  it('um horário que ainda não chegou hoje é o de ontem', () => {
    expect(horarioMaisRecente('23:10', agora)).toEqual(new Date('2026-10-07T02:10:00Z'));
    expect(horarioMaisRecente('14:31', agora)).toEqual(new Date('2026-10-06T17:31:00Z'));
  });

  it('o dia é o de São Paulo, não o de UTC', () => {
    const tarde = new Date('2026-10-08T02:30:00Z'); // 7/10, 23:30 em São Paulo
    expect(horarioMaisRecente('22:00', tarde)).toEqual(new Date('2026-10-08T01:00:00Z'));
    expect(horarioMaisRecente('00:15', tarde)).toEqual(new Date('2026-10-07T03:15:00Z'));
  });

  it('entrada inválida não vira horário', () => {
    for (const texto of ['', '7:00', '24:00', '12:60', 'aa:bb', '12:00:00']) {
      expect(horarioMaisRecente(texto, agora)).toBeNull();
    }
  });
});
