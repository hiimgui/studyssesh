# Companheiro de Estudos

Um companheiro de estudos pessoal (de um usuário só). Ele registra quanto se estuda, acompanha objetivos e recebe orientação periódica e opinativa do Claude. Seu tom é de incentivo: cada hora estudada conta como progresso visível.

## Glossário

**Trilha**
Um assunto de estudo, como "Claude Certified Architect". Todas as Trilhas têm a mesma estrutura e só mudam de assunto. Na interface, cada Trilha é uma aba. Uma Trilha *arquivada* sai das abas e fica só para consulta, com Sessões e Objetivos intactos; ela não recebe timer nem Objetivo novo.

**Sessão**
Um período contínuo de estudo dentro de uma Trilha, com início, fim e duração. A forma principal de criar uma Sessão é pelo timer. Para estudos feitos longe do app, o registro é feito pelo chat do Claude, que guarda também uma nota do que foi estudado. A regra é exigir o mínimo de entrada manual.

**Inatividade**
Uma Sessão com timer ligado e sem interação por 1 hora. O timer pausa sozinho e, na volta, o app pergunta até quando houve estudo.

**Objetivo**
Algo que se quer alcançar dentro de uma Trilha. É único, não recorrente. Pode ser:
- *abstrato*: concluído por julgamento ("conseguir a certificação X");
- *mensurável*: o progresso é calculado a partir das Sessões ("10 horas de estudo no mês"). O período é o mês, a semana (segunda a domingo) ou datas escolhidas, sempre no fuso America/Sao_Paulo. Cada Sessão conta inteira no período em que começou. O Objetivo se conclui sozinho no fim da Sessão que bate a meta; se o período acaba antes, ele fica *encerrado*.

Se uma Trilha não tiver nenhum Objetivo em andamento (nenhum criado, ou todos concluídos ou encerrados), o app pede que um seja definido.

O progresso aparece sempre como barra. Num Objetivo mensurável, ela mede horas sobre a meta. Num Objetivo abstrato, mede a proporção de itens concluídos ligados a ele (projetos e itens da Biblioteca). Ao concluir um Objetivo, há uma celebração e o usuário escolhe se arquiva a Trilha ou define um novo Objetivo.

**Marco**
Um patamar de horas acumuladas numa Trilha: 10h, 25h, 50h, 100h e, dali em diante, a cada 100h. Sempre existe uma barra até o próximo Marco. Cada Marco batido é celebrado uma vez, até o usuário dispensar, em qualquer aparelho. Se uma Sessão passar por dois Marcos de uma vez, celebra-se só o maior.

**Início**
A tela que consolida todas as Trilhas: o timer rápido, o total de horas, os dias estudados no mês, as barras de progresso e o último Resumo de cada Trilha. Os *dias estudados no mês* são os dias distintos, no fuso America/Sao_Paulo, em que alguma Sessão começou. O contador só cresce dentro do mês; um dia sem estudo não zera nada.

**Resumo**
Análise semanal gerada pelo Claude, por Trilha, a partir das Sessões, dos Objetivos e das Decisões passadas. É opinativa e se apoia em fontes confiáveis. Tolera atrasos: uma semana fraca leva a um novo plano, nunca a uma bronca. Sempre traz Material Extra, de fontes confiáveis em português ou inglês. Todos os Resumos ficam guardados numa linha do tempo da Trilha.

**Recomendação**
Uma proposta concreta do Claude dentro de um Resumo, como um projeto, um roteiro, um deck de Anki ou um material. Sempre ligada a um Objetivo. Pode ser aceita ou recusada com um clique, no app ou pelo chat.

**Decisão**
O registro de que uma Recomendação foi aceita ou recusada. Toda recusa exige um Motivo. As Decisões ficam guardadas para o Claude aprender as preferências ao longo do tempo.

**Motivo**
Por que uma Recomendação foi recusada, escolhido com um toque: *já sei*, *formato não me serve*, *agora não*, *fora do foco*.

**Biblioteca**
A coleção de Decks e Materiais Extras aceitos dentro de uma Trilha. Cada item pode ser aberto ou baixado e marcado como feito. Um *projeto* aceito vira Objetivo e não entra na Biblioteca.

**Material Extra**
Conteúdo de apoio além do plano da semana, como documentação oficial ou vídeos, para quando o plano parecer pouco.

**Deck**
Um baralho de Anki gerado pelo Claude para uma Trilha, entregue como arquivo pronto para importar.
