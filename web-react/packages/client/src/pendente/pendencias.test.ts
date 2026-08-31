import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PENDENCIAS } from "./pendencias";

/**
 * Toda pendência registrada tem um CONTROLE na tela.
 *
 * ⚠ **A guarda que faltava, e a ausência dela deixou seis entradas mortas
 * conviverem com as vivas sem nenhum sinal.** O registro promete, na própria
 * documentação, que "sai do bundle quando esvaziar" e que o `pnpm utilities`
 * acusa — e isso é verdade só para o MÓDULO. Entrada morta DENTRO do objeto
 * não é código morto: o objeto é usado, a chave compila, e o `pnpm utilities`
 * não tem como saber que ninguém a alcança.
 *
 * O custo disso não é bundle. É que o registro deixa de responder à pergunta
 * para a qual ele existe — "o que está desenhado e ainda não funciona?" —
 * porque parte da lista descreve coisas que já funcionam (`pastaDeServidor`,
 * com as pastas construídas) ou que nunca foram desenhadas
 * (`bannerDeSincronia`, cujo próprio arquivo diz "NÃO entra").
 *
 * É o mesmo par de asserções de `EXCECOES` no contraste, e pela mesma razão:
 * lista que só cresce vira depósito que mente sobre uma decisão que ninguém
 * tomou mais.
 *
 * ## A outra direção já é impossível
 *
 * Controle apontando para uma chave que não existe não precisa de teste:
 * `aindaNao(id: PendenciaId)` e as props tipadas `PendenciaId` fazem o build
 * quebrar. A asserção de simetria abaixo existe para pegar a deriva da
 * REGEX daqui, não a do código-fonte.
 */

/** A raiz varrida. Relativo a este arquivo, que mora em `src/pendente/`. */
const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function arquivosDeCodigo(dir: string, saida: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      arquivosDeCodigo(caminho, saida);
      continue;
    }
    if (!/\.tsx?$/.test(entrada.name)) continue;
    /*
      O próprio registro e os testes ficam de fora. Um teste que mencione a
      chave a manteria viva para sempre — que é exatamente o depósito que esta
      guarda existe para impedir.
    */
    if (entrada.name === "pendencias.ts") continue;
    if (/\.test\.tsx?$/.test(entrada.name)) continue;
    saida.push(caminho);
  }
  return saida;
}

/**
 * As chaves que algum controle de fato alcança.
 *
 * ⚠ **Casa a FORMA, e não a string — e a diferença não é preciosismo.**
 * `"topicos"` aparece em `CaixaDeEntrada.tsx` como valor de aba, sem nenhuma
 * relação com a pendência de mesmo nome. Uma varredura por literal aprovaria
 * `topicos` mesmo se o botão do cabeçalho fosse apagado, ou seja, aprovaria
 * justamente o caso que a guarda existe para reprovar.
 *
 * Duas formas contam, e a segunda é escopada:
 *
 * 1. `aindaNao("chave")` — direto.
 * 2. `id="chave"` num arquivo que encaminha um IDENTIFICADOR para `aindaNao`.
 *    Hoje são dois (`AcoesDoCanal`, `VisaoGeralDoCanal`), cada um com um
 *    componente local que recebe `id: PendenciaId` e o repassa. Sem o escopo,
 *    qualquer `id="x"` do app inteiro contaria.
 */
function chavesAlcancadas(arquivos: readonly string[]): Set<string> {
  const achadas = new Set<string>();
  for (const caminho of arquivos) {
    const fonte = readFileSync(caminho, "utf8");

    for (const m of fonte.matchAll(/aindaNao\(\s*"(\w+)"/g)) {
      if (m[1]) achadas.add(m[1]);
    }
    for (const m of fonte.matchAll(/PENDENCIAS\[\s*"(\w+)"/g)) {
      if (m[1]) achadas.add(m[1]);
    }

    const encaminha = /aindaNao\(\s*[A-Za-z_$][\w$]*\s*\)/.test(fonte);
    if (!encaminha) continue;
    for (const m of fonte.matchAll(/\bid=\{?"(\w+)"\}?/g)) {
      if (m[1]) achadas.add(m[1]);
    }
  }
  return achadas;
}

describe("o registro de pendências", () => {
  const arquivos = arquivosDeCodigo(RAIZ);

  /*
    ⚠ **O laço que roda zero vezes.** Este projeto já teve duas guardas que
    aprovaram tudo varrendo uma lista vazia — o `pnpm utilities` procurando
    `.module.css` numa lista só de `.tsx` foi uma delas. Uma varredura que não
    achou arquivo não é sucesso, é ausência de medição.
  */
  it("varre a árvore de verdade", () => {
    expect(arquivos.length).toBeGreaterThan(100);
  });

  it("não tem entrada sem controle na tela", () => {
    const alcancadas = chavesAlcancadas(arquivos);
    const orfas = Object.keys(PENDENCIAS).filter((k) => !alcancadas.has(k));

    expect(
      orfas,
      orfas.length === 0
        ? ""
        : `Pendência registrada e sem controle: ${orfas.join(", ")}.\n` +
          "Ou o controle foi removido — e a entrada sai junto —, ou ele já " +
          "funciona, ou ele nunca foi desenhado. Nos três casos o registro " +
          "está mentindo sobre o que falta.\n" +
          "Se não há o que clicar, o lugar da limitação é um comentário no " +
          "arquivo dela, como a etiqueta FÓRUM e a reação SUPER.",
    ).toEqual([]);
  });

  /*
    A simetria. O typechecker já garante isto no código-fonte; o que pode
    derivar é a regex acima — se ela passar a capturar `id="alguma-coisa"` que
    não é pendência, o conjunto incha e a asserção de cima afrouxa em silêncio.
  */
  it("não alcança chave que o registro não tem", () => {
    const alcancadas = [...chavesAlcancadas(arquivos)];
    const desconhecidas = alcancadas.filter((k) => !(k in PENDENCIAS));
    expect(desconhecidas).toEqual([]);
  });
});
