# Aibou

Companheiro de estudos pessoal e opinativo, alimentado pelo Claude. O vocabulário do domínio está em `CONTEXT.md` e as decisões de arquitetura em `docs/adr/`.

**Stack:** Astro + Svelte, Supabase (Postgres + magic link), Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env        # preencha com as chaves do Supabase
npx supabase start          # Postgres local (precisa de Docker)
npm run dev
```

| Comando | O que faz |
| --- | --- |
| `npm run check` | Typecheck do Astro + TypeScript |
| `npm test` | Testes (Vitest) contra o Postgres local |
| `npm run build` | Build de produção para a Vercel |

## CI/CD

- **CI** (`.github/workflows/ci.yml`): roda em todo PR e push no `main`. Faz typecheck, sobe o Supabase local, roda os testes e o build.
- **Deploy do app**: feito pela integração Git da Vercel. PRs ganham preview e o `main` vai para produção.
- **Migrações** (`.github/workflows/migrations.yml`): a cada push no `main` que altere `supabase/migrations/`, aplica as migrações no projeto Supabase de produção.

### Configuração única (manual)

1. **Vercel:** importe este repositório em vercel.com/new (o framework Astro é detectado sozinho). Cadastre as variáveis de `.env.example` em Settings → Environment Variables.
2. **Supabase:** crie o projeto em supabase.com. Em GitHub → Settings → Secrets and variables → Actions, adicione:
   - `SUPABASE_ACCESS_TOKEN`: token pessoal (supabase.com/dashboard/account/tokens)
   - `SUPABASE_DB_PASSWORD`: a senha do banco do projeto
   - `SUPABASE_PROJECT_ID`: a referência do projeto (aparece na URL do dashboard)
3. **Proteção do `main`:** em Settings → Branches, exija que o check `verify` passe antes do merge.
