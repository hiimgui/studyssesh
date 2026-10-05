# Aibou

Companheiro de estudos pessoal. Vocabulário do domínio em `CONTEXT.md`; decisões em `docs/adr/`.

## Regras do projeto

- Código do front (Astro + Svelte): use a skill "impeccable".
- Todo texto que o Claude escreve no app (Resumos, Recomendações): use a skill "humanizer".

## Comandos

`npm run check` (typecheck), `npm test` (Vitest; precisa de `npx supabase start`), `npm run build`. O CI roda os três em todo PR.

## Agent skills

### Issue tracker

Issues e specs ficam nas GitHub Issues de `hiimgui/studyssesh` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Rótulos padrão: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: um `CONTEXT.md` e `docs/adr/` na raiz. See `docs/agents/domain.md`.
