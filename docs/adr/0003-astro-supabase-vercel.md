# 0003 — Astro no front, Supabase no back, hospedado na Vercel

**Status:** aceito (2026-10-05)

## Contexto
O ADR 0001 decidiu que o app é auto-hospedado. O usuário quer experimentar o Astro no front. A alternativa padrão seria o Next.js. Vercel suporta Astro oficialmente, com adaptador que permite rotas de servidor.

## Decisão
- Front: Astro, com ilhas interativas em Svelte para timer, barras e aceite de Recomendações. O código do front é escrito com a skill "impeccable", que deve ser instalada antes da implementação se ainda não estiver disponível.
- Back e banco: Supabase (Postgres e login por magic link).
- Hospedagem: Vercel, usando o adaptador oficial do Astro.
- Servidor MCP (ADR 0002): rota de servidor do próprio app Astro.
- Se o Astro travar algo essencial (como o servidor MCP), o plano B é o Next.js, mantendo Supabase e Vercel.

## Consequências
- O app é majoritariamente interativo. O ganho do Astro aqui é aprendizado e não desempenho, o que é uma escolha consciente.
- Tema: escuro e claro, seguindo o sistema. Sem notificações.
- Tipografia: JetBrains Mono como fonte principal e Unbounded nos títulos, num visual minimalista. As duas vêm do Google Fonts, com licença OFL. A Unbounded substituiu a Bonta, decisão tomada na issue #2.
