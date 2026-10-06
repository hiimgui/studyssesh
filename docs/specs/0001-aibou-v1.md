# Aibou v1: companheiro de estudos

## Problem Statement

Estudo vários assuntos ao mesmo tempo, como a certificação Claude Certified Architect, e não tenho uma visão clara de quanto estudei, se estou perto dos meus objetivos nem do que fazer em seguida. Planilhas exigem entrada manual demais e não me dão orientação. Quando a semana é fraca, não tenho um plano para voltar ao ritmo. Também não sei quais materiais confiáveis valem o meu tempo.

## Solution

Um app web pessoal (SPA), em que cada assunto é uma **Trilha** numa aba própria. Eu estudo com um timer que registra **Sessões** sozinho, e acompanho **Objetivos** por barras de progresso e **Marcos** de horas. Toda segunda, o Claude lê os meus dados por um conector MCP e escreve um **Resumo** opinativo por Trilha, com **Recomendações** concretas (projetos, roteiros, **Decks** de Anki, **Material Extra**). Eu aceito ou recuso cada uma com um clique, e o Claude aprende com as minhas **Decisões**. Pelo chat do Claude, também consigo registrar estudo, consultar o progresso e responder Recomendações, sem abrir o app.

## User Stories

### Acesso
1. Como usuário, quero entrar com um magic link no meu e-mail, para não precisar de senha.
2. Como usuário, quero continuar logado no celular e no computador, para usar o app nos dois sem fricção.
3. Como usuário, quero que só eu tenha acesso aos meus dados, para manter meu histórico privado.

### Trilhas
4. Como usuário, quero criar uma Trilha com um nome, para separar cada assunto que estudo.
5. Como usuário, quero ver cada Trilha como uma aba, para alternar rapidamente entre assuntos.
6. Como usuário, quero que todas as Trilhas tenham a mesma estrutura, para não precisar reaprender a interface.
7. Como usuário, quero arquivar uma Trilha, para tirá-la das abas sem perder o histórico.
8. Como usuário, quero consultar Trilhas arquivadas, para rever o que já conquistei.

### Sessões e timer
9. Como usuário, quero iniciar um timer numa Trilha com um toque, para registrar estudo sem digitar nada.
10. Como usuário, quero pausar e retomar o timer, para cobrir interrupções curtas.
11. Como usuário, quero encerrar o timer e ter a Sessão salva sozinha, com início, fim e duração.
12. Como usuário, quero que só exista um timer ativo por vez, para não contar horas em dobro.
13. Como usuário, quero que o timer continue contando se eu fechar ou recarregar a página, para não perder a Sessão.
14. Como usuário, quero que, depois de 1 hora sem interação, o timer pause sozinho (Inatividade), para não registrar horas falsas.
15. Como usuário, quero que, ao voltar de uma Inatividade, o app pergunte até quando estudei, para corrigir a Sessão com um toque.
16. Como usuário, quero adicionar uma nota opcional à Sessão, para lembrar o que estudei.
17. Como usuário, quero ver as Sessões recentes de uma Trilha, para conferir o histórico.

### Objetivos
18. Como usuário, quero criar um Objetivo mensurável (ex.: "10 horas de estudo no mês"), com a barra de progresso calculada a partir das minhas Sessões.
19. Como usuário, quero criar um Objetivo abstrato (ex.: "conseguir a certificação"), para registrar metas que não são horas.
20. Como usuário, quero que um Objetivo abstrato mostre uma barra da proporção de itens concluídos ligados a ele, para ver progresso concreto.
21. Como usuário, quero que a Trilha sem Objetivo me peça um, para nunca estudar sem direção.
22. Como usuário, quero marcar um Objetivo abstrato como concluído, já que só eu sei quando ele foi alcançado.
23. Como usuário, quero que um Objetivo mensurável se conclua sozinho ao bater a meta.
24. Como usuário, quero uma celebração ao concluir um Objetivo, para sentir a vitória.
25. Como usuário, quero, depois de concluir um Objetivo, escolher entre arquivar a Trilha ou definir um novo Objetivo.

### Incentivo e progresso
26. Como usuário, quero ver uma barra até o próximo Marco de horas da Trilha (10h, 25h, 50h, 100h…), para que toda Sessão avance algo visível.
27. Como usuário, quero uma celebração ao bater um Marco.
28. Como usuário, quero ver quantos dias estudei no mês, num contador que nunca zera, para ver constância sem ser punido por atrasos.
29. Como usuário, quero ver o total de horas por Trilha e no geral.
30. Como usuário, quero uma tela Início com o timer rápido, o total de horas, os dias estudados no mês, as barras de todas as Trilhas e o último Resumo de cada uma.

### Resumos
31. Como usuário, quero receber um Resumo por Trilha toda segunda às 7h (America/Sao_Paulo), cobrindo a semana de segunda a domingo anterior.
32. Como usuário, quero que o Resumo seja opinativo e baseado em fontes confiáveis, com links.
33. Como usuário, quero que uma semana fraca gere um plano de recuperação, nunca uma bronca.
34. Como usuário, quero que todo Resumo traga Material Extra (documentação, vídeos) em português ou inglês, para quando o plano parecer pouco.
35. Como usuário, quero ver todos os Resumos de uma Trilha numa linha do tempo, para acompanhar a evolução.
36. Como usuário, quero ver quando o último Resumo foi gerado, para perceber se a tarefa agendada falhou.
37. Como usuário, quero um botão "gerar agora" que abra o claude.ai com um prompt pronto para a Trilha, para pedir um Resumo fora do ciclo.
38. Como usuário, quero que os textos do Claude soem naturais, escritos com a skill "humanizer".

### Recomendações, Decisões e Biblioteca
39. Como usuário, quero que cada Recomendação venha ligada a um Objetivo, para entender por que ela importa.
40. Como usuário, quero aceitar uma Recomendação com um clique.
41. Como usuário, quero que um projeto aceito vire um Objetivo da Trilha.
42. Como usuário, quero que um Deck ou Material Extra aceito vá para a Biblioteca da Trilha.
43. Como usuário, quero recusar uma Recomendação escolhendo um Motivo (*já sei*, *formato não me serve*, *agora não*, *fora do foco*), para o Claude entender o porquê.
44. Como usuário, quero que o Claude leve em conta as minhas Decisões passadas, para não repetir sugestões recusadas e acertar mais.
45. Como usuário, quero baixar um Deck como arquivo `.apkg` pronto para importar no Anki.
46. Como usuário, quero abrir ou baixar cada item da Biblioteca e marcá-lo como feito.
47. Como usuário, quero que concluir itens da Biblioteca avance a barra do Objetivo ligado a eles.

### Pelo chat do Claude
48. Como usuário, quero dizer ao Claude "estudei 1h30 de MCP hoje" e ter a Sessão criada com nota, para registrar estudo feito longe do app.
49. Como usuário, quero perguntar ao Claude "como estou na certificação?" e receber o progresso real.
50. Como usuário, quero definir um Objetivo pelo chat numa Trilha que não tem nenhum.
51. Como usuário, quero aceitar ou recusar Recomendações pelo chat, com Motivo.
52. Como usuário, quero ter a garantia de que o Claude nunca edita nem apaga os meus dados, só cria o que eu peço e escreve Resumos e Recomendações.

### Visual
53. Como usuário, quero um visual minimalista com JetBrains Mono no corpo e Unbounded nos títulos.
54. Como usuário, quero que o tema escuro ou claro siga o sistema.
55. Como usuário, quero usar o app confortavelmente no celular.

## Implementation Decisions

- **Stack** (ADR 0003): Astro com ilhas Svelte, saída de servidor via adaptador Vercel; Supabase para Postgres e auth por magic link; hospedagem na Vercel.
- **Módulo central, o Companheiro**: um serviço de domínio profundo, com toda a regra de negócio. Interface única com operações por intenção: criar/arquivar Trilha; iniciar/pausar/retomar/encerrar timer; registrar Sessão; resolver Inatividade; criar/concluir Objetivo; consultar progresso (por Trilha e geral); gravar Resumo com Recomendações; aceitar/recusar Recomendação; marcar item da Biblioteca como feito. Cada chamada recebe o **Ator** (`usuario` ou `claude`), e o próprio Companheiro aplica as permissões.
- **Adaptadores finos sobre o Companheiro**: (1) rotas de servidor do Astro, usadas pelas ilhas Svelte; (2) servidor MCP remoto como rota do próprio app, exposto como conector personalizado na conta Claude Pro (ADR 0002). Nenhum dos dois tem regra de negócio.
- **Permissões do Ator `claude`**: lê tudo; cria Resumos e Recomendações; quando o usuário pede pelo chat, cria Sessões, define Objetivo numa Trilha sem Objetivo e registra Decisões. Nunca edita nem apaga. Criar Trilha é só do usuário.
- **Relógio injetável** no Companheiro, para que Inatividade, semanas e meses sejam determinísticos em teste.
- **Timer no servidor**: o estado do timer ativo fica no banco (início, pausas, última interação), e não no navegador, para sobreviver a recarregamentos e trocas de aparelho. A Inatividade é avaliada a partir da última interação registrada.
- **Esquema (entidades)**: Trilha (nome, arquivada); Sessão (Trilha, início, fim, duração, nota, origem: timer/chat); Timer ativo (único); Objetivo (Trilha, tipo abstrato/mensurável, meta de horas e período quando mensurável, concluído em); Resumo (Trilha, semana coberta, texto, gerado em); Recomendação (Resumo, Objetivo, tipo projeto/roteiro/deck/material, conteúdo, fontes); Decisão (Recomendação, aceita/recusada, Motivo); item da Biblioteca (Trilha, Objetivo, Recomendação de origem, link ou arquivo, feito em). Row Level Security no Supabase, restrito ao dono.
- **Progresso**: o Objetivo mensurável soma as durações das Sessões no período. O Objetivo abstrato é a razão entre itens ligados concluídos e itens ligados no total (projetos aceitos que viraram sub-Objetivos e itens da Biblioteca). Marcos fixos: 10, 25, 50, 100h e depois a cada 100h. "Dias estudados no mês" conta dias distintos com Sessão no fuso America/Sao_Paulo.
- **Resumo semanal**: uma tarefa agendada na conta Pro do usuário roda segunda às 7h, lê pelo conector e grava o Resumo e as Recomendações. O "gerar agora" é um link para o claude.ai com prompt pré-preenchido.
- **Decks**: o conteúdo do Deck (cartas) é gravado pelo Claude na Recomendação. O arquivo `.apkg` é gerado pelo app no download.
- **Front**: escrito com a skill "impeccable". Minimalista, JetBrains Mono e Unbounded (licença OFL; substituiu a Bonta, decidido na issue #2), tema seguindo o sistema. Sem notificações.

## Testing Decisions

- **Um único ponto de teste: a interface do Companheiro.** Os testes só exercitam comportamento externo (o que entra e o que sai da interface), nunca tabelas ou funções internas.
- **Postgres real**: os testes rodam contra o Supabase local (`supabase start`), sem mocks de banco. O CI sobe o Supabase antes do `npm test`.
- **Relógio injetado** em cada teste, para simular a passagem de tempo (1h de Inatividade, virada de semana e de mês) sem esperar.
- **Cobertura prioritária**:
  - ciclo do timer, timer único e Inatividade com a resposta "até quando";
  - progresso dos dois tipos de Objetivo, Marcos e dias estudados no mês (incluindo bordas de fuso horário);
  - aceitar (projeto → Objetivo; Deck/Material → Biblioteca) e recusar com Motivo obrigatório;
  - **permissões do Ator `claude`**: toda tentativa de editar ou apagar é recusada (o teste mais importante do projeto);
  - Trilha sem Objetivo, conclusão de Objetivo e a escolha entre arquivar ou criar um novo.
- **Fora do ponto de teste**: a interface Svelte (verificação visual) e o transporte MCP, que ganha só um teste de fumaça para checar que cada ferramenta chega ao Companheiro.
- **Arte prévia**: nenhuma, o repositório está começando. Estes testes viram o padrão.

## Out of Scope

- Notificações push e de e-mail.
- Objetivos recorrentes (cada Objetivo é único).
- Sequência de dias que zera ao falhar.
- Importação automática do Anki.
- Criar Trilhas pelo chat.
- Chamadas diretas à API da Anthropic pelo backend (ADR 0002).
- Múltiplos usuários e compartilhamento.

## Further Notes

- **Riscos a verificar antes de construir o Resumo**: se a conta Pro permite tarefas agendadas usando conectores personalizados (se não permitir, o ADR 0002 é reaberto); a instalação das skills "impeccable" e "humanizer".
- Glossário completo em `CONTEXT.md`; decisões em `docs/adr/0001` a `0003`.
