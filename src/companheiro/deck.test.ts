import { describe, expect, it } from 'vitest';
import { criarCompanheiro, type NovaRecomendacao } from './companheiro';
import { lerApkg } from '../test/apkg';
import { novoUsuario, relogioFixo } from '../test/usuarios';

// Segunda, 12/10/2026, 07:07 em São Paulo: o Resumo acabou de sair.
const SEGUNDA_7H07 = '2026-10-12T10:07:00Z';
const HORA = 60 * 60_000;

const CARTAS = [
  { frente: 'O que é um servidor MCP?', verso: 'Um processo que expõe ferramentas e recursos ao Claude.' },
  { frente: 'Quais transportes o MCP usa?', verso: 'stdio e HTTP com streaming.' },
  { frente: 'Quem inicia a conexão?', verso: 'O cliente.' },
];

// Uma Trilha com um Resumo que traz um Deck (com cartas) e o Material Extra obrigatório.
async function resumoComDeck(cartas: NovaRecomendacao['cartas'] = CARTAS) {
  const relogio = relogioFixo(SEGUNDA_7H07);
  const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
  const trilha = await companheiro.criarTrilha('usuario', { nome: 'Claude Certified Architect' });
  const objetivo = await companheiro.criarObjetivoAbstrato('usuario', {
    trilhaId: trilha.id,
    descricao: 'Conseguir a certificação',
  });
  const resumo = await companheiro.criarResumo('claude', {
    trilhaId: trilha.id,
    semanaDe: '2026-10-05',
    texto: 'Semana boa.',
    fontes: [{ titulo: 'Guia do exame', url: 'https://example.com/guia' }],
    recomendacoes: [
      { objetivoId: objetivo.id, tipo: 'deck', titulo: 'Deck de MCP', descricao: 'Revisão diária.', cartas },
      {
        objetivoId: objetivo.id,
        tipo: 'material',
        titulo: 'Especificação do MCP',
        descricao: 'A fonte primária.',
        url: 'https://modelcontextprotocol.io/specification',
      },
    ],
  });
  const [deck, material] = resumo.recomendacoes;
  relogio.avancar(HORA);
  return { companheiro, relogio, trilha, objetivo, resumo, deck, material };
}

describe('Cartas de um Deck', () => {
  it('o Claude grava as cartas na Recomendação do Deck, sem espaços nas pontas', async () => {
    const { deck, material } = await resumoComDeck([{ frente: '  O que é MCP? ', verso: ' Um protocolo.\n' }]);

    expect(deck.cartas).toEqual([{ frente: 'O que é MCP?', verso: 'Um protocolo.' }]);
    expect(material.cartas).toBeNull();
  });

  it('todo Deck traz cartas com frente e verso, e só Deck tem cartas', async () => {
    const { companheiro, trilha, objetivo } = await resumoComDeck();
    const material = {
      objetivoId: objetivo.id,
      tipo: 'material' as const,
      titulo: 'Especificação do MCP',
      descricao: '',
      url: 'https://modelcontextprotocol.io/specification',
    };
    const deck = { objetivoId: objetivo.id, tipo: 'deck' as const, titulo: 'Deck de MCP', descricao: '' };
    const gravar = (recomendacao: NovaRecomendacao) =>
      companheiro.criarResumo('claude', {
        trilhaId: trilha.id,
        semanaDe: '2026-10-05',
        texto: 'Outra semana.',
        fontes: [{ titulo: 'Guia', url: 'https://example.com/guia' }],
        recomendacoes: [recomendacao, material],
      });

    await expect(gravar(deck)).rejects.toThrow('Um Deck traz cartas, cada uma com frente e verso.');
    await expect(gravar({ ...deck, cartas: [] })).rejects.toThrow(
      'Um Deck traz cartas, cada uma com frente e verso.',
    );
    await expect(gravar({ ...deck, cartas: [{ frente: 'O que é MCP?', verso: '  ' }] })).rejects.toThrow(
      'Um Deck traz cartas, cada uma com frente e verso.',
    );
    await expect(
      gravar({ ...material, titulo: 'Outro material', cartas: [{ frente: 'a', verso: 'b' }] }),
    ).rejects.toThrow('Só um Deck tem cartas.');
    expect(await companheiro.listarResumos('usuario', { trilhaId: trilha.id })).toHaveLength(1);
  });
});

describe('Download de Deck .apkg', () => {
  it('um Deck aceito baixa como .apkg com todas as cartas, num baralho com o nome da Trilha e do Deck', async () => {
    const { companheiro, trilha, deck } = await resumoComDeck();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: deck.id, resposta: 'aceita' });
    const [item] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });

    const baixado = await companheiro.baixarDeck('usuario', { itemId: item.id });

    expect(baixado.nomeDoArquivo).toBe('Deck de MCP.apkg');
    const apkg = lerApkg(baixado.apkg);
    expect(apkg.arquivos).toEqual(['collection.anki2', 'media']);
    expect(apkg.media).toBe('{}');
    expect(apkg.versao).toBe(11);
    expect(apkg.baralhos).toEqual(['Claude Certified Architect::Deck de MCP']);
    expect(apkg.cartas).toEqual(
      CARTAS.map((c) => ({
        baralho: 'Claude Certified Architect::Deck de MCP',
        tipoDeNota: ['Frente', 'Verso'],
        frente: c.frente,
        verso: c.verso,
        ordenacao: c.frente,
      })),
    );
  });

  it('o texto das cartas chega ao Anki como texto: sinais de HTML escapados e quebras de linha visíveis', async () => {
    const { companheiro, trilha, deck } = await resumoComDeck([
      { frente: 'Como o Claude pede uma ferramenta?', verso: 'Com um bloco <tool_use>\nque traz nome & entrada.' },
    ]);
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: deck.id, resposta: 'aceita' });
    const [item] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });

    const { cartas } = lerApkg((await companheiro.baixarDeck('usuario', { itemId: item.id })).apkg);

    expect(cartas.map((c) => c.verso)).toEqual(['Com um bloco &lt;tool_use&gt;<br>que traz nome &amp; entrada.']);
  });

  it('a Biblioteca diz quantas cartas cada Deck tem; Material Extra não tem', async () => {
    const { companheiro, relogio, trilha, deck, material } = await resumoComDeck();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: deck.id, resposta: 'aceita' });
    relogio.avancar(HORA);
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });

    const itens = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });

    expect(itens.map((i) => [i.tipo, i.cartas])).toEqual([
      ['deck', 3],
      ['material', 0],
    ]);
  });

  it('só Deck se baixa, e o item de outra pessoa não existe para quem baixa', async () => {
    const { companheiro, relogio, trilha, deck, material } = await resumoComDeck();
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: deck.id, resposta: 'aceita' });
    relogio.avancar(HORA);
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: material.id, resposta: 'aceita' });
    const [itemDoDeck, itemDoMaterial] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });
    const outraPessoa = criarCompanheiro({ supabase: await novoUsuario() });

    await expect(companheiro.baixarDeck('usuario', { itemId: itemDoMaterial.id })).rejects.toThrow(
      'Só um Deck se baixa para o Anki.',
    );
    await expect(outraPessoa.baixarDeck('usuario', { itemId: itemDoDeck.id })).rejects.toThrow(
      'Item da Biblioteca não encontrado.',
    );
  });

  it('numa Trilha arquivada o Deck continua baixando, e o nome do arquivo não leva caracteres proibidos', async () => {
    const relogio = relogioFixo(SEGUNDA_7H07);
    const companheiro = criarCompanheiro({ supabase: await novoUsuario(), relogio });
    const trilha = await companheiro.criarTrilha('usuario', { nome: 'Redes' });
    const objetivo = await companheiro.criarObjetivoAbstrato('usuario', { trilhaId: trilha.id, descricao: 'CCNA' });
    const resumo = await companheiro.criarResumo('claude', {
      trilhaId: trilha.id,
      semanaDe: '2026-10-05',
      texto: 'Semana de sub-redes.',
      fontes: [{ titulo: 'Cisco', url: 'https://www.cisco.com' }],
      recomendacoes: [
        {
          objetivoId: objetivo.id,
          tipo: 'deck',
          titulo: 'TCP/IP: camadas e "portas"?',
          descricao: '',
          cartas: [{ frente: 'Porta do HTTPS?', verso: '443' }],
        },
        { objetivoId: objetivo.id, tipo: 'material', titulo: 'RFC 791', descricao: '', url: 'https://www.rfc-editor.org/rfc/rfc791' },
      ],
    });
    await companheiro.decidirRecomendacao('usuario', { recomendacaoId: resumo.recomendacoes[0].id, resposta: 'aceita' });
    const [item] = await companheiro.listarBiblioteca('usuario', { trilhaId: trilha.id });
    await companheiro.arquivarTrilha('usuario', { trilhaId: trilha.id });

    const baixado = await companheiro.baixarDeck('usuario', { itemId: item.id });

    expect(baixado.nomeDoArquivo).toBe('TCP-IP- camadas e -portas--.apkg');
    expect(lerApkg(baixado.apkg).baralhos).toEqual(['Redes::TCP/IP: camadas e "portas"?']);
  });
});
