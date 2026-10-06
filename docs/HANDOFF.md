# Handoff: Aibou (2026-10-05)

Continuação no Claude Code (CLI). Leia isto primeiro, depois `CLAUDE.md`, `CONTEXT.md` e `docs/adr/`.

## Onde paramos

- Design fechado numa sessão de grilling. Glossário em `CONTEXT.md` e decisões nos ADRs 0001–0003.
- Spec publicada na [issue #1](https://github.com/hiimgui/studyssesh/issues/1) (cópia em `docs/specs/0001-aibou-v1.md`).
- 13 tickets publicados como sub-issues da #1, com dependências nativas do GitHub: issues **#2–#14**.
- O esqueleto (Astro + Svelte + adaptador Vercel + Supabase local + Vitest) compila e o CI está verde. Ainda não há código de domínio.

## Mapa de tickets

| # | Ticket | Bloqueado por | Rótulo |
| --- | --- | --- | --- |
| #2 | Verificar riscos do Claude | — | ready-for-human |
| #3 | Login e primeira Trilha | — | ready-for-agent |
| #4 | Timer → Sessão | #3 | ready-for-agent |
| #5 | Inatividade | #4 | ready-for-agent |
| #6 | Objetivo mensurável | #4 | ready-for-agent |
| #7 | Objetivo abstrato e ciclo de vida | #6 | ready-for-agent |
| #8 | Marcos, dias estudados e Início | #6 | ready-for-agent |
| #9 | Conector MCP: leitura e registro pelo chat | #6 | ready-for-agent |
| #10 | Resumo semanal | #2, #9 | ready-for-agent |
| #11 | Aceitar/recusar e Biblioteca | #7, #10 | ready-for-agent |
| #12 | Download de Deck .apkg | #11 | ready-for-agent |
| #13 | Decisões e Objetivo pelo chat | #11 | ready-for-agent |
| #14 | Ligar o Claude de verdade | #10, #13 | ready-for-human |

**Fronteira atual:** #2 (você) e #3 (agente), em paralelo.

## Como continuar no CLI

```bash
git clone https://github.com/hiimgui/studyssesh Aibou
cd Aibou
npm install
npx supabase start      # precisa do Docker rodando
claude
```

Dentro do Claude Code:

1. `/plugin install mattpocock-skills`, se ainda não estiver instalado.
2. Instale as skills **impeccable** (front) e **humanizer** (textos do Claude). Isso faz parte do ticket #2.
3. Peça: *"implemente a issue #3 com /tdd"*. Depois disso, siga a fronteira da tabela, sempre um ticket por branch e por PR.

## Regras que não podem se perder

- **Um único ponto de teste:** a interface do **Companheiro**. Os testes usam Postgres real (Supabase local) e relógio injetado, sem mocks de banco.
- **Ator `claude`:** lê tudo e cria Resumos e Recomendações. Quando o usuário pede, também cria Sessões, define Objetivo em Trilha vazia e registra Decisões. **Nunca edita nem apaga.** Isso é imposto no Companheiro e coberto por testes.
- Rotas do Astro e servidor MCP são **adaptadores finos**, sem regra de negócio.
- Front com a skill "impeccable", minimalista, JetBrains Mono e Unbounded, tema seguindo o sistema, sem notificações.
- Textos do Claude no app com a skill "humanizer", em PT-BR, com fontes em PT ou EN.
- Use o vocabulário do `CONTEXT.md` em código, testes e issues. Se algo contradiz um ADR, diga isso explicitamente.

## Pendências fora do código

- **Vercel:** importar o repositório e cadastrar as variáveis do `.env.example`.
- **Secrets do Supabase no GitHub:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` e `SUPABASE_PROJECT_ID`.
- **Proteção do `main`:** exigir o check `verify`.
- **Maior risco (#2):** se a conta Pro não rodar uma tarefa agendada com conector personalizado, o ADR 0002 é reaberto antes do #10.
