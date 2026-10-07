import { beforeEach, describe, expect, it } from "vitest";

import {
  assinarExibeTag,
  definirQuemExibeTag,
  exibeTag,
  limparPerfisDeServidor,
  lerPerfilDoServidor,
} from "../store/perfilDoServidor";
import { aplicarEventoDePerfil } from "./perfilDoServidor";

/**
 * A tradução do evento cru para o store da tag.
 *
 * O `stoat.js` descarta os campos do fork na hidratação, então ESTA função é o
 * único caminho por onde tag, emblema, características e `show_tag` chegam à
 * tela. Ela quebra em silêncio — um nome de campo trocado deixa a tag
 * invisível para sempre, sem erro —, e é por isso que é ela a testada.
 */

const url = (a: { _id: string }) => `https://midia/icons/${a._id}`;
const S = "01SERVIDOR0000000000000000";

beforeEach(() => {
  limparPerfisDeServidor();
});

describe("aplicarEventoDePerfil", () => {
  it("Ready semeia tag, emblema, características e a MINHA escolha", () => {
    const buscar = aplicarEventoDePerfil(
      {
        type: "Ready",
        servers: [
          {
            _id: S,
            tag: "VTX",
            tag_badge: { _id: "emb", tag: "icons" },
            characteristics: ["🛠 produto", "🎨 design"],
          },
        ],
        members: [{ _id: { server: S, user: "eu" }, show_tag: true }],
      },
      url,
    );

    expect(lerPerfilDoServidor(S)).toEqual({
      tag: "VTX",
      emblemaUrl: "https://midia/icons/emb",
      caracteristicas: ["🛠 produto", "🎨 design"],
    });
    expect(exibeTag(S, "eu")).toBe(true);
    // Com tag, a lista dos OUTROS vem da rota.
    expect(buscar).toEqual([S]);
  });

  it("servidor sem tag não pede a lista de quem exibe", () => {
    expect(
      aplicarEventoDePerfil({ type: "Ready", servers: [{ _id: S }] }, url),
    ).toEqual([]);
  });

  it("tag fora da forma do protocolo é ignorada, não exibida", () => {
    aplicarEventoDePerfil({ type: "Ready", servers: [{ _id: S, tag: "vtx!" }] }, url);
    expect(lerPerfilDoServidor(S).tag).toBeUndefined();
  });

  it("ServerUpdate com clear apaga a tag e o emblema", () => {
    aplicarEventoDePerfil(
      { type: "Ready", servers: [{ _id: S, tag: "VTX", tag_badge: { _id: "e", tag: "icons" } }] },
      url,
    );
    aplicarEventoDePerfil(
      { type: "ServerUpdate", id: S, data: {}, clear: ["Tag", "TagBadge"] },
      url,
    );
    expect(lerPerfilDoServidor(S).tag).toBeUndefined();
    expect(lerPerfilDoServidor(S).emblemaUrl).toBeUndefined();
  });

  it("ServerUpdate de NOME não troca a referência do perfil", () => {
    aplicarEventoDePerfil(
      { type: "Ready", servers: [{ _id: S, tag: "VTX", characteristics: ["a"] }] },
      url,
    );
    const antes = lerPerfilDoServidor(S);
    aplicarEventoDePerfil({ type: "ServerUpdate", id: S, data: { name: "x" } as never }, url);
    expect(lerPerfilDoServidor(S)).toBe(antes);
  });

  it("tag nova num servidor que não tinha pede a lista de quem exibe", () => {
    expect(
      aplicarEventoDePerfil({ type: "ServerUpdate", id: S, data: { tag: "VX" } }, url),
    ).toEqual([S]);
  });

  it("ServerMemberUpdate liga e desliga a tag de alguém", () => {
    aplicarEventoDePerfil(
      { type: "ServerMemberUpdate", id: { server: S, user: "ana" }, data: { show_tag: true } },
      url,
    );
    expect(exibeTag(S, "ana")).toBe(true);
    aplicarEventoDePerfil(
      { type: "ServerMemberUpdate", id: { server: S, user: "ana" }, data: { show_tag: false } },
      url,
    );
    expect(exibeTag(S, "ana")).toBe(false);
  });

  it("ServerMemberUpdate sem show_tag não mexe na escolha", () => {
    definirQuemExibeTag(S, ["ana"]);
    aplicarEventoDePerfil(
      { type: "ServerMemberUpdate", id: { server: S, user: "ana" }, data: { nickname: "A" } as never },
      url,
    );
    expect(exibeTag(S, "ana")).toBe(true);
  });

  it("quem sai deixa de exibir", () => {
    definirQuemExibeTag(S, ["ana"]);
    aplicarEventoDePerfil({ type: "ServerMemberLeave", id: S, user: "ana" }, url);
    expect(exibeTag(S, "ana")).toBe(false);
  });

  it("características passam do teto de cinco cortadas", () => {
    aplicarEventoDePerfil(
      { type: "Ready", servers: [{ _id: S, characteristics: ["1", "2", "3", "4", "5", "6"] }] },
      url,
    );
    expect(lerPerfilDoServidor(S).caracteristicas).toHaveLength(5);
  });
});

describe("definirQuemExibeTag", () => {
  it("troca a lista inteira: quem saiu da resposta deixa de exibir", () => {
    definirQuemExibeTag(S, ["ana", "bia"]);
    expect(exibeTag(S, "ana")).toBe(true);
    definirQuemExibeTag(S, ["bia"]);
    expect(exibeTag(S, "ana")).toBe(false);
    expect(exibeTag(S, "bia")).toBe(true);
  });

  it("avisa SÓ quem mudou — a resposta inteira não acorda cada autor na tela", () => {
    definirQuemExibeTag(S, ["ana", "bia"]);
    const avisos = { ana: 0, bia: 0, caio: 0 };
    const soltar = (["ana", "bia", "caio"] as const).map((u) =>
      assinarExibeTag(S, u, () => (avisos[u] += 1)),
    );
    definirQuemExibeTag(S, ["bia", "caio"]);
    expect(avisos).toEqual({ ana: 1, bia: 0, caio: 1 });
    for (const s of soltar) s();
  });
});
