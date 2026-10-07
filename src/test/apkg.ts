import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { strFromU8, unzipSync } from 'fflate';

// Abre um .apkg como o Anki abriria: descompacta com uma implementação de zip
// independente da do app e lê a coleção. Devolve os baralhos e as cartas de
// cada um, com os campos como o Anki os guarda (HTML).
export function lerApkg(apkg: Uint8Array) {
  const arquivos = unzipSync(apkg);
  const pasta = mkdtempSync(join(tmpdir(), 'apkg-'));
  const caminho = join(pasta, 'collection.anki2');
  writeFileSync(caminho, arquivos['collection.anki2']);
  const db = new DatabaseSync(caminho, { readOnly: true });
  try {
    const col = db.prepare('select ver, decks, models from col').get() as {
      ver: number;
      decks: string;
      models: string;
    };
    const decks = JSON.parse(col.decks) as Record<string, { id: number; name: string }>;
    const models = JSON.parse(col.models) as Record<
      string,
      { name: string; flds: { name: string }[] }
    >;
    const linhas = db
      .prepare(
        `select c.did, n.flds, n.sfld, n.mid
         from cards c join notes n on n.id = c.nid
         order by c.due`,
      )
      .all() as { did: number; flds: string; sfld: string; mid: number }[];
    return {
      arquivos: Object.keys(arquivos).sort(),
      media: strFromU8(arquivos.media),
      versao: col.ver,
      baralhos: Object.values(decks)
        .filter((d) => d.id !== 1)
        .map((d) => d.name),
      cartas: linhas.map((l) => {
        const [frente, verso] = l.flds.split('\x1f');
        return {
          baralho: decks[String(l.did)]?.name,
          tipoDeNota: models[String(l.mid)]?.flds.map((f) => f.name),
          frente,
          verso,
          ordenacao: l.sfld,
        };
      }),
    };
  } finally {
    db.close();
    rmSync(pasta, { recursive: true, force: true });
  }
}
