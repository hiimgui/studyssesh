import { describe, expect, it } from 'vitest';
import { linkGerarAgora, resumoAtrasado } from './resumo';

describe('"Gerar agora" do Resumo', () => {
  const trilha = { id: '7f1c0a52-0000-4000-8000-000000000001', nome: 'Claude Certified Architect' };

  it('abre o claude.ai com o prompt da Trilha, cobrindo a semana anterior', () => {
    const link = new URL(linkGerarAgora(trilha, '2026-10-15')); // quinta

    expect(link.origin + link.pathname).toBe('https://claude.ai/new');
    const prompt = link.searchParams.get('q')!;
    expect(prompt).toContain('Claude Certified Architect');
    expect(prompt).toContain(trilha.id);
    expect(prompt).toContain('semana_de 2026-10-05');
    expect(prompt).toContain('5 a 11 de outubro');
    expect(prompt).toContain('gravar_resumo');
  });

  it('numa segunda, a semana anterior é a que acabou ontem', () => {
    const prompt = new URL(linkGerarAgora(trilha, '2026-10-12')).searchParams.get('q')!;

    expect(prompt).toContain('semana_de 2026-10-05');
  });

  it('semana que cruza o mês leva os dois meses', () => {
    const prompt = new URL(linkGerarAgora(trilha, '2026-10-06')).searchParams.get('q')!;

    expect(prompt).toContain('semana de 28 de setembro a 4 de outubro (semana_de 2026-09-28)');
  });

  it('cabe numa URL (menos de 2000 caracteres de prompt)', () => {
    const prompt = new URL(linkGerarAgora(trilha, '2026-10-12')).searchParams.get('q')!;

    expect(prompt.length).toBeLessThan(2000);
  });
});

describe('Resumo atrasado', () => {
  const criadaEm = new Date('2026-09-01T12:00:00Z');
  const semana = (de: string) => ({ semana: { de } });

  it('a partir de terça, falta o Resumo da semana anterior', () => {
    const terca = new Date('2026-10-13T12:00:00Z');
    expect(resumoAtrasado(semana('2026-09-28'), criadaEm, terca)).toBe(true);
    expect(resumoAtrasado(null, criadaEm, terca)).toBe(true);
    expect(resumoAtrasado(semana('2026-10-05'), criadaEm, terca)).toBe(false);
  });

  it('na segunda ainda não: a routine roda nesse dia', () => {
    const segunda = new Date('2026-10-12T20:00:00Z');
    expect(resumoAtrasado(semana('2026-09-28'), criadaEm, segunda)).toBe(false);
  });

  it('Trilha criada depois do começo da semana anterior não cobra Resumo dela', () => {
    const terca = new Date('2026-10-13T12:00:00Z');
    expect(resumoAtrasado(null, new Date('2026-10-07T12:00:00Z'), terca)).toBe(false);
  });
});
