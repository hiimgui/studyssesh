import { describe, expect, it } from 'vitest';
import { emailPermitido } from './acesso';

const emProducao = { producao: true };
const emDev = { producao: false };

describe('E-mails permitidos', () => {
  it('só entra quem está na lista, sem diferenciar maiúsculas nem espaços', () => {
    const lista = ' guiproc@gmail.com , Outra@Exemplo.com ';

    expect(emailPermitido('guiproc@gmail.com', lista, emProducao)).toBe(true);
    expect(emailPermitido('  GuiProc@Gmail.COM ', lista, emProducao)).toBe(true);
    expect(emailPermitido('outra@exemplo.com', lista, emProducao)).toBe(true);
    expect(emailPermitido('intruso@gmail.com', lista, emProducao)).toBe(false);
    expect(emailPermitido('guiproc@gmail.com.br', lista, emProducao)).toBe(false);
  });

  it('com a lista definida, vale também em dev', () => {
    expect(emailPermitido('intruso@gmail.com', 'guiproc@gmail.com', emDev)).toBe(false);
    expect(emailPermitido('guiproc@gmail.com', 'guiproc@gmail.com', emDev)).toBe(true);
  });

  it('sem e-mail, ninguém entra quando há lista', () => {
    expect(emailPermitido(undefined, 'guiproc@gmail.com', emProducao)).toBe(false);
    expect(emailPermitido('', 'guiproc@gmail.com', emDev)).toBe(false);
  });

  it('em produção, lista vazia fecha a porta para todo mundo', () => {
    for (const vazia of [undefined, '', '  ', ' , ,'])
      expect(emailPermitido('guiproc@gmail.com', vazia, emProducao)).toBe(false);
  });

  it('em dev e nos testes, sem lista, fica aberto', () => {
    for (const vazia of [undefined, '', ' , '])
      expect(emailPermitido('qualquer@exemplo.com', vazia, emDev)).toBe(true);
  });
});
