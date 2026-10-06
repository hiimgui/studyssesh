import { describe, expect, it } from 'vitest';
import { linkGerarAgora } from './resumo';

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

  it('cabe numa URL (menos de 2000 caracteres de prompt)', () => {
    const prompt = new URL(linkGerarAgora(trilha, '2026-10-12')).searchParams.get('q')!;

    expect(prompt.length).toBeLessThan(2000);
  });
});
