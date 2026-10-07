# 0002 — Claude acessa o app por um conector MCP, via tarefa agendada na conta Pro

**Status:** aceito (2026-10-05)

## Contexto
O Resumo semanal precisa ler Sessões, Objetivos e Decisões e gravar o resultado de volta no app (ver ADR 0001). As alternativas eram:
- (a) o backend do app chama a API da Anthropic num cron, o que é autônomo, mas cobrado por uso numa conta de API separada;
- (b) uma tarefa agendada no claude.ai, na conta Pro pessoal do usuário, acessa o app por um conector MCP próprio.

## Decisão
(b). O app expõe um servidor MCP remoto, adicionado como conector personalizado na conta Pro. Uma tarefa agendada semanal usa esse conector para ler os dados e gravar o Resumo e as Recomendações.

## Consequências
- Não há custo de API, porque o uso entra na assinatura Pro.
- O app precisa de um servidor MCP público, com autenticação compatível com conectores personalizados.
- A geração depende da conta e da tarefa agendada do usuário. Se a tarefa falhar, nenhum Resumo aparece, então o app precisa mostrar quando o último Resumo foi gerado.
- O "gerar agora" do app não dispara o Claude sozinho. Ele abre o claude.ai com um prompt pronto para a Trilha, e o usuário só confirma.
- Pelo conector, o Claude lê tudo, mas escreve apenas Resumos e Recomendações. Exceção: quando o usuário pede no chat, o Claude pode **criar** Sessões (com nota), definir um Objetivo numa Trilha sem Objetivo e registrar Decisões. Ele nunca edita nem apaga dados existentes.
- Uma skill no claude.ai cobre o uso pelo chat: registrar Sessão, consultar progresso, definir Objetivo e aceitar ou recusar Recomendações com Motivo. Criar Trilha fica só no app.
- Cada Recomendação nasce ligada a um Objetivo, o que alimenta a barra dos Objetivos abstratos.
- O Resumo sai toda segunda às 7h (America/Sao_Paulo) e cobre a semana anterior, de segunda a domingo.
- Todo texto que o Claude escreve no app passa pela skill "humanizer". Se ela não estiver instalada, deve ser instalada quando os requisitos do projeto estiverem fechados.
- Precisa ser verificado antes de construir: se a conta Pro permite tarefas agendadas que usam conectores personalizados.

## Atualização (2026-10-06, issue #10)

- Verificado na #2: uma tarefa agendada da conta usou o conector personalizado e gravou dados no app. A decisão se mantém.
- A tarefa agendada do Resumo é uma **routine do Claude Code**, na conta do usuário, que lê este repositório. Ela roda **segunda às 7:07** (America/Sao_Paulo) e segue `docs/rotinas/resumo-semanal.md`.
- A skill "humanizer" fica **versionada no repositório** (`.claude/skills/humanizer/`), por decisão do usuário. Por isso a routine, que lê o repo, tem acesso a ela. O "gerar agora" abre o chat do claude.ai, onde a skill só existe se estiver também na conta. O prompt dele pede a revisão do texto de qualquer forma.

## Atualização (2026-10-07, issue #13)

- **Exceção, decidida pelo usuário:** pelo chat, a pedido dele, o Claude pode registrar a Decisão de aceitar um *projeto* mesmo que isso crie um Objetivo numa Trilha que já tem Objetivo em andamento. O Objetivo nasce ligado ao projeto (`projeto_de`), serve ao Objetivo da Recomendação e não o substitui. Fora isso, a regra continua: o Claude só define Objetivo numa Trilha sem Objetivo em andamento.
- O conector ganhou `decidir_recomendacao` (aceitar, ou recusar com Motivo) e `definir_objetivo`. O `consultar_trilha` passou a trazer as Decisões passadas, que a routine do Resumo usa para acertar as Recomendações.
- Registrar uma Decisão é criação: o Claude continua sem editar nem apagar. Marcar um item da Biblioteca como feito muda o que existe e fica só no app.
