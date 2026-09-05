import { describe, expect, it } from "vitest";

import { ROTEIROS } from "../../scripts/confronto.roteiros.mjs";
import { DE_CANAL, DE_SERVIDOR, NOME_DA_SECAO } from "../store/config";

/**
 * Toda categoria de configuração é CONFRONTADA com o design.
 *
 * ⚠ **Este teste existe por causa de uma pergunta de quem usa: "como podemos
 * garantir que fiquem 1:1 com a referência?"** A resposta honesta era: não
 * garantimos. O `pnpm confronto` — que renderiza o design e o app lado a lado e
 * compara propriedade por propriedade — existe desde a rodada do canal, e o
 * cabeçalho dele já dizia a regra por extenso: *"tela que não está aqui não é
 * conferida"*. Nenhuma das treze categorias de servidor estava lá. Elas foram
 * construídas, revisadas e corrigidas três vezes com a comparação sendo feita
 * por mim, a olho, e derivaram exatamente onde eu não olhei.
 *
 * O que este arquivo faz é tirar isso da minha memória e pôr no build. É a
 * mesma mecânica de `ModalId` e `PainelId`: seção nova não passa sem roteiro,
 * do mesmo jeito que modal novo não compila sem entrada no registro.
 *
 * ⚠ **Nos DOIS sentidos, como as `EXCECOES` de contraste.** Seção sem roteiro
 * reprova — é o caso que motivou o arquivo. E roteiro apontando para uma seção
 * que não existe mais também reprova, senão a lista vira depósito de entradas
 * mortas que mentem sobre cobertura: um relatório de confronto "sem
 * diferenças" numa tela que ninguém abre mais é pior que nenhum relatório.
 *
 * O que ele NÃO faz é rodar o confronto. Aquilo precisa de Chrome, do build
 * servido em `4174` e de uns dois minutos — é comando de rodada, não de suíte.
 * Este teste guarda a única coisa que dá para guardar de graça: a COBERTURA.
 */

const comSecao = ROTEIROS.filter((r) => r.secao !== undefined);

describe("cobertura do pnpm confronto", () => {
  it.each(DE_SERVIDOR)("a seção %s tem roteiro", (secao) => {
    const achado = comSecao.find((r) => r.secao === secao);
    expect(
      achado,
      `A categoria “${NOME_DA_SECAO[secao]}” não tem entrada em ` +
        `scripts/confronto.roteiros.mjs. Sem roteiro, ela não é comparada com ` +
        `o design por máquina nenhuma — e é assim que uma tela deriva sem que ` +
        `nada falhe. Acrescente a entrada com o \`secao: "${secao}"\`.`,
    ).toBeDefined();
  });

  it("nenhum roteiro aponta para uma seção que não existe", () => {
    const conhecidas = new Set<string>([...DE_SERVIDOR, ...DE_CANAL]);
    const orfaos = comSecao
      .filter((r) => !conhecidas.has(r.secao ?? ""))
      .map((r) => `${r.nome} → ${r.secao ?? "?"}`);

    expect(
      orfaos,
      "Roteiro apontando para seção inexistente. Ou a seção foi renomeada e o " +
        "roteiro ficou para trás, ou ela sumiu e o roteiro virou entrada morta " +
        "— nos dois casos o relatório de confronto passa a mentir sobre o que " +
        "está coberto.",
    ).toEqual([]);
  });

  it("cada seção tem no máximo UM roteiro", () => {
    /*
      Dois roteiros para a mesma categoria é a divergência de propósito que
      este projeto já pagou seis vezes (as cópias do `Avatar`, as cinco do
      badge): o que alguém consertar num deles some no outro, e o que sobra é
      um relatório verde sobre a versão que ninguém abre.
    */
    const vistos = new Map<string, number>();
    for (const r of comSecao) {
      vistos.set(r.secao ?? "", (vistos.get(r.secao ?? "") ?? 0) + 1);
    }
    const repetidos = [...vistos].filter(([, n]) => n > 1).map(([s]) => s);
    expect(repetidos).toEqual([]);
  });
});
