import { beforeEach, expect, test } from "vitest";

import {
  assinarLongeDoFim,
  definirLongeDoFim,
  esquecerLongeDoFim,
  lerLongeDoFim,
} from "./comandos";

const CANAL = "01CANAL";

beforeEach(() => {
  esquecerLongeDoFim(CANAL);
});

test("a ausência de resposta é 'perto do fim', não indefinido", () => {
  expect(lerLongeDoFim(CANAL)).toBe(false);
});

test("publica só quando o booleano MUDA", () => {
  let avisos = 0;
  const cancelar = assinarLongeDoFim(CANAL, () => {
    avisos += 1;
  });

  definirLongeDoFim(CANAL, true);
  expect(avisos).toBe(1);

  // A lista consulta a distância a cada evento de rolagem — dezenas por
  // segundo. Reescrever o mesmo valor não pode acordar o composer, que é onde
  // alguém está digitando.
  definirLongeDoFim(CANAL, true);
  definirLongeDoFim(CANAL, true);
  expect(avisos).toBe(1);

  definirLongeDoFim(CANAL, false);
  expect(avisos).toBe(2);

  cancelar();
});

/**
 * ⚠ **O defeito que este teste guarda deixou o botão "Ir para o presente"
 * invisível para sempre, e não deu erro nenhum.**
 *
 * `useSyncExternalStore` re-assina sempre que a função de assinatura muda de
 * identidade — o que, com uma closure inline, é a cada render. A primeira
 * versão de `assinarLongeDoFim` APAGAVA o valor quando o último ouvinte saía,
 * com o argumento de que "sem ouvinte a resposta não vale". O ciclo normal de
 * re-assinatura esvazia o conjunto por um instante, e o valor morria ali.
 *
 * Ler um `Map` vazio é uma resposta perfeitamente válida — `false` —, então
 * nada falhava. O botão simplesmente nunca aparecia, medido a 5.130px do fim.
 */
test("o valor SOBREVIVE ao ciclo de re-assinatura do useSyncExternalStore", () => {
  const cancelar = assinarLongeDoFim(CANAL, () => {});
  definirLongeDoFim(CANAL, true);
  expect(lerLongeDoFim(CANAL)).toBe(true);

  // Exatamente o que o React faz quando `subscribe` troca de identidade:
  // cancela a antiga e assina de novo, com o conjunto vazio no meio.
  cancelar();
  const denovo = assinarLongeDoFim(CANAL, () => {});

  expect(lerLongeDoFim(CANAL)).toBe(true);
  denovo();
});

test("quem ESCREVE é quem esquece: a lista desmontou", () => {
  definirLongeDoFim(CANAL, true);
  expect(lerLongeDoFim(CANAL)).toBe(true);

  esquecerLongeDoFim(CANAL);
  expect(lerLongeDoFim(CANAL)).toBe(false);
});

test("canais não se contaminam", () => {
  definirLongeDoFim(CANAL, true);
  expect(lerLongeDoFim("01OUTRO")).toBe(false);
  esquecerLongeDoFim("01OUTRO");
  expect(lerLongeDoFim(CANAL)).toBe(true);
});
