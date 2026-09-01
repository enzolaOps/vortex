import { beforeEach, describe, expect, it } from "vitest";

import {
  alternarSilencio,
  definirNivelDoCanal,
  estaSilenciado,
  limparSilencio,
  nivelDoCanal,
} from "./silencio";

/**
 * O nível por canal e o silêncio são o MESMO eixo.
 *
 * ⚠ **É a razão de os dois morarem num store só**, e o que estes testes
 * guardam é a consequência: "Nada" e silenciar não podem discordar. Um canal
 * com nível "nada" e sino aceso é a interface contradizendo o próprio
 * comportamento — passa por typecheck, por lint e por olho, e só aparece para
 * quem repara que não recebe aviso de um canal que diz que avisa.
 *
 * Não é observável na tela de hoje: o modal de grupo mostra o nível e a coluna
 * mostra o silêncio, e nenhum dos dois mostra os dois. Por isso vem como teste
 * e não como verificação em navegador.
 */

const CANAL = "01JQCANAL0000000000000001";

beforeEach(() => {
  limparSilencio();
});

describe("nível de notificação por canal", () => {
  it("nasce ausente, e ausente NÃO é 'todas'", () => {
    /* A distinção é o que permite acompanhar a mudança do padrão global. */
    expect(nivelDoCanal(CANAL)).toBeUndefined();
    expect(estaSilenciado(CANAL)).toBe(false);
  });

  it('"nada" SILENCIA o canal', () => {
    definirNivelDoCanal(CANAL, "nada");
    expect(nivelDoCanal(CANAL)).toBe("nada");
    expect(estaSilenciado(CANAL)).toBe(true);
  });

  it("sair de \"nada\" REATIVA o canal", () => {
    definirNivelDoCanal(CANAL, "nada");
    definirNivelDoCanal(CANAL, "mencoes");
    expect(estaSilenciado(CANAL)).toBe(false);
  });

  /*
    ⚠ **Voltar ao padrão NÃO reativa**, e a assimetria é deliberada. Quem
    silenciou pelo menu de silêncio e depois marcou "usar o padrão" não pediu
    para voltar a receber — pediu para o NÍVEL seguir o global. Reativar aqui
    desfaria em silêncio uma escolha que a pessoa fez noutro lugar.
  */
  it('"usar o padrão" não mexe num silêncio que veio de fora', () => {
    /*
      ⚠ **Precisa de um nível ANTES, e a mutação foi quem mostrou.** A primeira
      versão silenciava e ia direto para `undefined` — mas o nível já era
      `undefined`, então a função retornava cedo e o teste passava sem nunca
      tocar o ramo que ele diz guardar. Passou até com `nivel !== undefined`
      removido da condição.
    */
    definirNivelDoCanal(CANAL, "mencoes");
    alternarSilencio(CANAL);
    expect(estaSilenciado(CANAL)).toBe(true);

    definirNivelDoCanal(CANAL, undefined);
    expect(nivelDoCanal(CANAL)).toBeUndefined();
    expect(estaSilenciado(CANAL)).toBe(true);
  });

  /*
    ⚠ **O teste que a mutação exigiu.** A primeira versão chamava
    `definirNivelDoCanal(CANAL, "nada")` duas vezes e passava com a guarda
    REMOVIDA — porque a função retorna cedo quando o nível não muda, e a
    segunda chamada nunca chegava ao alternador. Guarda não testada é
    decoração com custo de manutenção; foi assim que o `pnpm utilities`
    aprovou uma lista vazia duas versões seguidas.

    O caso que a condição `!mudo` realmente protege é este: o canal já estava
    mudo por OUTRO caminho (o menu de silêncio), e escolher "nada" chamaria um
    ALTERNADOR, que o reativaria — o oposto exato do que a escolha pede.
  */
  it('canal já mudo por fora que vira "nada" CONTINUA mudo', () => {
    alternarSilencio(CANAL);
    expect(estaSilenciado(CANAL)).toBe(true);

    definirNivelDoCanal(CANAL, "nada");
    expect(estaSilenciado(CANAL)).toBe(true);
  });

  /* O espelho do de cima, do outro lado da condição: canal AUDÍVEL que vira
     "todas" não deve ser silenciado por um alternador cego. */
  it('canal audível que vira "todas" continua audível', () => {
    definirNivelDoCanal(CANAL, "todas");
    expect(estaSilenciado(CANAL)).toBe(false);
  });
});
