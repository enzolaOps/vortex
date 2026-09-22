import { describe, expect, it } from "vitest";

import { rodapeDaEnquete } from "./enquetes";

describe("rodapeDaEnquete", () => {
  it("diz 'você votou' depois do voto — o que faltava no rodapé", () => {
    expect(rodapeDaEnquete(18, false, true)).toBe("18 votos · você votou");
  });

  it("sem voto, só a contagem", () => {
    expect(rodapeDaEnquete(18, false, false)).toBe("18 votos");
  });

  it("com o resultado escondido, a CONTAGEM continua", () => {
    /*
      O que "resultado no fim" esconde é a porcentagem por resposta. Trocar a
      contagem por um aviso — como a versão anterior fazia — tirava da tela a
      única pista de que a enquete está viva.
    */
    expect(rodapeDaEnquete(18, true, false)).toBe("18 votos · resultado no fim");
  });

  it("escondido ganha de votou, e não se somam", () => {
    /*
      A precedência importa porque os dois podem ser verdadeiros ao mesmo
      tempo enquanto o snapshot da linha não atualiza: o rodapé com os dois
      sufixos seria "18 votos · resultado no fim · você votou", que é a frase
      se contradizendo.
    */
    expect(rodapeDaEnquete(18, true, true)).toBe("18 votos · resultado no fim");
  });

  it("a concordância é a do projeto, e zero cai no singular", () => {
    expect(rodapeDaEnquete(1, false, false)).toBe("1 voto");
    /*
      ⚠ **"0 voto", e não é descuido — é o `Intl.PluralRules` de pt-BR.** No
      CLDR a forma `one` do português cobre `i = 0..1`, então zero concorda no
      singular. Anotado aqui porque a enquete recém-criada é o caso mais comum
      que existe e a linha parece errada de relance; o dia em que a regra for
      revista, é `lib/plural.ts` que muda, e este teste acusa.
    */
    expect(rodapeDaEnquete(0, false, false)).toBe("0 voto");
  });
});
