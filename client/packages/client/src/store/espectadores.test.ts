import { afterEach, describe, expect, it } from "vitest";

import {
  contagemDisponivel,
  definirAnuncio,
  definirContagemDisponivel,
  esquecerAnuncio,
  lerAnuncio,
  lerEspectadores,
  limparEspectadores,
} from "./espectadores";

const ver = (dono: string, altura = 1080) => ({ dono, altura, rede: false, cheia: false });

afterEach(() => {
  limparEspectadores();
});

describe("store de espectadores", () => {
  it("deriva quem assiste cada tela a partir do anúncio de cada pessoa", () => {
    definirAnuncio("ana", [ver("dono")]);
    definirAnuncio("bia", [ver("dono"), ver("outro")]);
    expect(lerEspectadores("dono")).toEqual(["ana", "bia"]);
    expect(lerEspectadores("outro")).toEqual(["bia"]);
  });

  it("parar de assistir tira a pessoa só daquela tela", () => {
    definirAnuncio("bia", [ver("dono"), ver("outro")]);
    definirAnuncio("bia", [ver("outro")]);
    expect(lerEspectadores("dono")).toEqual([]);
    expect(lerEspectadores("outro")).toEqual(["bia"]);
  });

  it("o dono não é espectador da própria tela", () => {
    definirAnuncio("dono", [ver("dono")]);
    expect(lerEspectadores("dono")).toEqual([]);
  });

  /* `getSnapshot` estável é o erro nº 1 do briefing: mesma referência
     enquanto nada mudou, senão `useSyncExternalStore` entra em laço. */
  it("devolve a mesma referência enquanto nada muda", () => {
    definirAnuncio("ana", [ver("dono")]);
    const lista = lerEspectadores("dono");
    const anuncio = lerAnuncio("ana");
    definirAnuncio("ana", [ver("dono")]);
    definirAnuncio("bia", [ver("outro")]);
    expect(lerEspectadores("dono")).toBe(lista);
    expect(lerAnuncio("ana")).toBe(anuncio);
    expect(lerAnuncio("ninguem")).toBe(lerAnuncio("outra-pessoa"));
  });

  it("mudar só a qualidade atualiza o anúncio sem mexer na lista", () => {
    definirAnuncio("ana", [ver("dono", 1080)]);
    const lista = lerEspectadores("dono");
    definirAnuncio("ana", [ver("dono", 720)]);
    expect(lerAnuncio("ana")[0]?.altura).toBe(720);
    expect(lerEspectadores("dono")).toBe(lista);
  });

  it("quem sai da sala leva o anúncio junto", () => {
    definirAnuncio("ana", [ver("dono")]);
    esquecerAnuncio("ana");
    expect(lerAnuncio("ana")).toEqual([]);
    expect(lerEspectadores("dono")).toEqual([]);
  });

  it("o fim da chamada zera tudo, inclusive a disponibilidade", () => {
    definirContagemDisponivel(true);
    definirAnuncio("ana", [ver("dono")]);
    limparEspectadores();
    expect(lerEspectadores("dono")).toEqual([]);
    expect(contagemDisponivel()).toBe(false);
  });
});
