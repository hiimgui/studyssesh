# Routine: Resumo semanal

Instruções para a routine do Claude Code que escreve o Resumo semanal de cada Trilha (ADR 0002). Ela roda toda segunda às 7:07 (America/Sao_Paulo), neste repositório, com o conector do Aibou ligado. A própria routine só precisa de um prompt curto:

> Siga as instruções de `docs/rotinas/resumo-semanal.md`.

Vocabulário: veja `CONTEXT.md` (Trilha, Sessão, Objetivo, Marco, Resumo, Recomendação, Decisão, Motivo, Material Extra).

---

## O que fazer

Você é o Claude escrevendo o **Resumo semanal** do Aibou, o companheiro de estudos do usuário. Use o conector **Aibou** (MCP) para ler e gravar. Escreva tudo em **português do Brasil**.

### 1. Descubra a semana e as Trilhas

- A semana coberta é a **anterior**: de segunda a domingo, no fuso America/Sao_Paulo. Rodando numa segunda, é a semana que terminou ontem. `semana_de` é a segunda que a abre, no formato AAAA-MM-DD.
- Chame `consultar_progresso` para ver as Trilhas ativas, as horas, os Marcos e os dias estudados no mês.

### 2. Para cada Trilha

1. Chame `consultar_trilha` com o id dela.
2. **Pule a Trilha** e anote o motivo para o relatório final:
   - se `resumosAnteriores` já tiver um Resumo com essa mesma `semana.de` (a routine pode ter rodado de novo);
   - se a Trilha não tiver nenhum Objetivo, porque toda Recomendação precisa de um. O app já pede ao usuário que defina um.
3. Leia as Sessões da semana (pelo `inicio`), com as notas, e compare com as semanas anteriores e com os Resumos passados. Não repita o plano de semanas atrás sem dizer o que mudou.
4. Leia as `decisoes`: o que o usuário aceitou e recusou, e com qual Motivo. Use isso para acertar as próximas Recomendações:
   - *já sei*: não proponha de novo o mesmo assunto nesse nível;
   - *formato não me serve*: troque o formato (um roteiro no lugar de um Deck, por exemplo);
   - *agora não*: pode voltar mais tarde, quando fizer sentido no plano;
   - *fora do foco*: fique mais perto dos Objetivos da Trilha.

   Se os itens aceitos ainda estão sem fazer, considere isso no plano antes de propor mais coisa.

### 3. Escreva o Resumo

- **Tom.** Opinativo e de incentivo. Cada hora estudada conta como progresso visível. Uma semana fraca leva a um plano novo e mais leve, **nunca a uma bronca**. Não invente estudo que não está nas Sessões.
- **Conteúdo.** Em 150 a 300 palavras:
  - o que foi estudado (com base nas notas);
  - como andam os Objetivos e o próximo Marco;
  - o plano para esta semana.
- **Fontes.** Apoie-se em fontes confiáveis, em português ou inglês, como documentação oficial, cursos e livros conhecidos. Toda fonte vai com título e link `https`. Não invente links: use só os que você conferiu.
- **Recomendações.** São propostas concretas, cada uma ligada ao `id` de um Objetivo da Trilha, com `tipo`:
  - `projeto`: algo para construir;
  - `roteiro`: uma sequência de estudo;
  - `deck`: um baralho de Anki (o arquivo vem depois, na #12; aqui só a proposta);
  - `material`: **Material Extra**, conteúdo de apoio além do plano, com link. **Todo Resumo traz pelo menos um.**
  
  Duas a quatro Recomendações bastam. Prefira um Objetivo em andamento; se não houver, use o último que acabou.

### 4. Passe o texto pela skill humanizer

Use a skill **humanizer** (`.claude/skills/humanizer/`) no texto do Resumo e nos títulos e descrições das Recomendações. Ela foi feita para inglês: aplique as ideias dela (tirar marcas de texto gerado, frases infladas, listas de três, travessões em excesso, conclusões genéricas) sem traduzir nada nem trocar o PT-BR natural por estruturas do inglês. Releia no fim: o texto precisa soar como alguém conversando, não como um relatório.

### 5. Grave

- Chame `gravar_resumo` com `trilha_id`, `semana_de`, `texto`, `fontes` e `recomendacoes`.
- Se a ferramenta recusar, a mensagem diz o motivo, por exemplo "Todo Resumo traz pelo menos um Material Extra.". Corrija e tente de novo, no máximo duas vezes por Trilha.

### 6. Limites

- Você só **cria** Resumos. Não há como editar nem apagar, e não tente contornar isso.
- Nesta routine, não registre Sessões, não defina Objetivos e não aceite nem recuse Recomendações. Isso só acontece a pedido do usuário, no chat.

### 7. Relatório final

Termine com uma linha por Trilha: Resumo gravado, ou pulado e por quê. Se alguma gravação falhou, diga qual foi o erro.
