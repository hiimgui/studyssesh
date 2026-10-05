# 0001 — App auto-hospedado, em vez de artifact do claude.ai

**Status:** aceito (2026-10-05)

## Contexto
O SPA precisa de um banco persistente. Esse banco tem de ser lido periodicamente pelo Claude para gerar Resumos. As alternativas avaliadas foram:
- (a) artifact do claude.ai com banco embutido, que o Claude lê de forma nativa;
- (b) app próprio hospedado (frontend + banco gerenciado);
- (c) app só local.

## Decisão
(b) App próprio hospedado.

## Consequências
- Controle total sobre stack, dados, UI e evolução, sem depender dos limites de um artifact.
- Ponto em aberto: como o Claude acessa os dados. O ambiente dele não alcança URLs arbitrárias, então a integração precisa de um caminho explícito (ver próxima decisão).
- Há custo de manutenção: deploy, banco e autenticação.
