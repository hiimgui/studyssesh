import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { crc32, deflateRawSync } from 'node:zlib';

// Gera o arquivo .apkg que o Anki importa: um zip com a coleção (SQLite no
// esquema 11, o mesmo do genanki, que as versões atuais do Anki importam) e um
// índice de mídia vazio. Sem dependências: o SQLite é o embutido do Node
// (node:sqlite) e o zip sai do node:zlib. O banco é escrito em /tmp, o único
// lugar gravável numa função da Vercel.

export interface CartaDoDeck {
  frente: string;
  verso: string;
}

export function gerarApkg({
  id,
  nome,
  cartas,
  agora,
}: {
  // Identidade estável do Deck (o id da Recomendação). Baixar de novo e
  // reimportar atualiza as mesmas cartas no Anki, sem duplicar.
  id: string;
  nome: string;
  cartas: CartaDoDeck[];
  agora: Date;
}): Uint8Array<ArrayBuffer> {
  const pasta = mkdtempSync(join(tmpdir(), 'aibou-apkg-'));
  try {
    const caminho = join(pasta, 'collection.anki2');
    const db = new DatabaseSync(caminho);
    try {
      escreverColecao(db, { id, nome, cartas, agora });
    } finally {
      db.close();
    }
    return zip(
      [
        { nome: 'collection.anki2', dados: readFileSync(caminho) },
        { nome: 'media', dados: Buffer.from('{}') },
      ],
      agora,
    );
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
}

// O tipo de nota do Aibou: Frente e Verso. Id fixo, para o Anki reconhecer o
// mesmo tipo em todos os Decks baixados.
const ID_DO_TIPO_DE_NOTA = 1_760_000_000_001;

function escreverColecao(
  db: DatabaseSync,
  { id, nome, cartas, agora }: { id: string; nome: string; cartas: CartaDoDeck[]; agora: Date },
) {
  const ms = agora.getTime();
  const s = Math.floor(ms / 1000);
  // Do uuid da Recomendação: estável, positivo e dentro de 2^48.
  const idDoBaralho = parseInt(id.replace(/-/g, '').slice(0, 12), 16) || 2;

  db.exec(ESQUEMA);
  db.prepare(
    `insert into col values (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')`,
  ).run(
    s,
    ms,
    ms,
    JSON.stringify({ ...CONF, curModel: String(ID_DO_TIPO_DE_NOTA) }),
    JSON.stringify({ [ID_DO_TIPO_DE_NOTA]: tipoDeNota(idDoBaralho, s) }),
    JSON.stringify({
      1: baralho(1, 'Default', s),
      [idDoBaralho]: baralho(idDoBaralho, nome, s),
    }),
    JSON.stringify({ 1: DCONF }),
  );

  const nota = db.prepare(`insert into notes values (?, ?, ?, ?, -1, '', ?, ?, ?, 0, '')`);
  const carta = db.prepare(
    `insert into cards values (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, '')`,
  );
  cartas.forEach((c, i) => {
    const idDaNota = ms + i;
    nota.run(
      idDaNota,
      guid(`${id}:${i}`),
      ID_DO_TIPO_DE_NOTA,
      s,
      [html(c.frente), html(c.verso)].join('\x1f'),
      c.frente,
      checksum(c.frente),
    );
    // Cartas novas, na ordem em que o Claude as escreveu.
    carta.run(ms + cartas.length + i, idDaNota, idDoBaralho, s, i + 1);
  });
}

// Os campos do Anki são HTML: o texto do Claude entra escapado, com as quebras
// de linha visíveis.
function html(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r?\n/g, '<br>');
}

const sha1 = (texto: string) => createHash('sha1').update(texto, 'utf8').digest();

// O Anki usa o checksum do primeiro campo para achar notas repetidas.
const checksum = (texto: string) => sha1(texto).readUInt32BE(0);

const guid = (semente: string) => sha1(semente).toString('base64url').slice(0, 10);

const baralho = (id: number, name: string, mod: number) => ({
  id,
  name,
  mod,
  usn: -1,
  desc: '',
  dyn: 0,
  conf: 1,
  collapsed: false,
  extendNew: 10,
  extendRev: 50,
  newToday: [0, 0],
  revToday: [0, 0],
  lrnToday: [0, 0],
  timeToday: [0, 0],
});

const campo = (name: string, ord: number) => ({
  name,
  ord,
  font: 'Arial',
  size: 20,
  media: [],
  rtl: false,
  sticky: false,
});

const tipoDeNota = (did: number, mod: number) => ({
  id: ID_DO_TIPO_DE_NOTA,
  name: 'Aibou (frente e verso)',
  type: 0,
  mod,
  usn: -1,
  sortf: 0,
  did,
  tags: [],
  vers: [],
  flds: [campo('Frente', 0), campo('Verso', 1)],
  tmpls: [
    {
      name: 'Cartão 1',
      ord: 0,
      qfmt: '{{Frente}}',
      afmt: '{{FrontSide}}\n\n<hr id=answer>\n\n{{Verso}}',
      bqfmt: '',
      bafmt: '',
      did: null,
    },
  ],
  req: [[0, 'all', [0]]],
  css: '.card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }',
  latexPre:
    '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n' +
    '\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
  latexPost: '\\end{document}',
});

const CONF = {
  activeDecks: [1],
  curDeck: 1,
  newSpread: 0,
  collapseTime: 1200,
  timeLim: 0,
  estTimes: true,
  dueCounts: true,
  nextPos: 1,
  sortType: 'noteFld',
  sortBackwards: false,
  addToCur: true,
  newBury: true,
};

const DCONF = {
  id: 1,
  name: 'Default',
  mod: 0,
  usn: 0,
  maxTaken: 60,
  autoplay: true,
  timer: 0,
  replayq: true,
  new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
  lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
  rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
};

const ESQUEMA = `
create table col (
  id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null,
  conf text not null, models text not null, decks text not null, dconf text not null, tags text not null
);
create table notes (
  id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null,
  csum integer not null, flags integer not null, data text not null
);
create table cards (
  id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null,
  due integer not null, ivl integer not null, factor integer not null, reps integer not null,
  lapses integer not null, left integer not null, odue integer not null, odid integer not null,
  flags integer not null, data text not null
);
create table revlog (
  id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null,
  type integer not null
);
create table graves (usn integer not null, oid integer not null, type integer not null);
create index ix_notes_usn on notes (usn);
create index ix_cards_usn on cards (usn);
create index ix_revlog_usn on revlog (usn);
create index ix_cards_nid on cards (nid);
create index ix_cards_sched on cards (did, queue, due);
create index ix_revlog_cid on revlog (cid);
create index ix_notes_csum on notes (csum);
`;

// Zip mínimo (deflate, sem zip64): basta para dois arquivos pequenos.
function zip(arquivos: { nome: string; dados: Buffer }[], agora: Date): Uint8Array<ArrayBuffer> {
  const hora =
    (agora.getUTCHours() << 11) | (agora.getUTCMinutes() << 5) | Math.floor(agora.getUTCSeconds() / 2);
  const data =
    ((agora.getUTCFullYear() - 1980) << 9) | ((agora.getUTCMonth() + 1) << 5) | agora.getUTCDate();
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;

  for (const { nome, dados } of arquivos) {
    const nomeB = Buffer.from(nome, 'utf8');
    const comprimido = deflateRawSync(dados);
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeB.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(data, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nomeB.length, 28);
    central.writeUInt32LE(deslocamento, 42);

    locais.push(local, nomeB, comprimido);
    centrais.push(central, nomeB);
    deslocamento += local.length + nomeB.length + comprimido.length;
  }

  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return new Uint8Array(Buffer.concat([...locais, diretorio, fim]));
}
