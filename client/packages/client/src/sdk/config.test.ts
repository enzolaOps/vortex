import { describe, expect, it } from "vitest";

import { API_URL } from "./config";

/**
 * Para qual servidor o app fala.
 *
 * ⚠ **Este arquivo existe por causa de um defeito que mandou senha para
 * terceiro.** A cadeia era `VITE_DEV_API_URL ?? VITE_API_URL ?? mesmaOrigem()`,
 * e o `Dockerfile` declarava `ARG VITE_API_URL=""`. O Vite substitui a
 * variável pelo literal `""`; `??` só cai para o próximo em `null` e
 * `undefined`, então a string vazia GANHOU. O `baseURL` do SDK virou `""`, ele
 * caiu no default dele — `https://api.stoat.chat` — e o app passou a mandar
 * login e criação de conta para a instância pública do Stoat.
 *
 * Nada disso deu erro. Na tela aparecia "E-mail ou senha incorretos", que é
 * verdade: a conta não existe lá. Só apareceu instrumentando `window.fetch` no
 * navegador e lendo a URL de verdade.
 *
 * ⚠ Duas medições minhas anteriores disseram "zero chamadas a stoat.chat" e
 * estavam certas pelo motivo errado: eu medi na tela de login, ANTES de
 * qualquer requisição de autenticação. O que não é exercitado não aparece.
 */
describe("API_URL", () => {
  it("nunca é vazia — é o caso que o `??` deixava passar", () => {
    expect(API_URL.trim()).not.toBe("");
  });

  it("nunca aponta para o Stoat público", () => {
    /*
      O Vortex é produto separado com backend próprio. Qualquer caminho que
      leve a `stoat.chat` é engano de configuração, nunca escolha — e o preço
      dele é credencial saindo para servidor de outra gente.
    */
    expect(API_URL).not.toMatch(/stoat\.chat/i);
  });

  it("é ABSOLUTA, porque o `stoat-api` faz `new URL(path)` sem base", () => {
    /*
      Caminho relativo lança `Invalid URL` antes de qualquer `fetch`. O cliente
      Solid usa `/api` e funciona porque nunca chega nesse caminho com valor
      relativo; aqui a suíte acusou com 18 rejeições não tratadas.
    */
    expect(() => new URL(API_URL)).not.toThrow();
  });
});
