import { describe, expect, it } from "vitest";

import { interpretar } from "../rota/rota";
import { linkDoResultado } from "./link";

const S = "01SERVIDOR0000000000000001";
const C = "01CANAL00000000000000000A";
const M = "01MENSAGEM000000000000001";

describe("link do resultado de busca", () => {
  it("monta o permalink com o servidor de verdade, e a rota o lê de volta", () => {
    const link = linkDoResultado("https://vortex.local", S, C, M);
    expect(link).toBe(`https://vortex.local/servidor/${S}/canal/${C}/${M}`);

    /* A prova que importa: o caminho abre o lugar e pede o salto. Um `-` no
       lugar do servidor passaria num `toContain` e não num `interpretar`. */
    const lido = interpretar(new URL(link ?? "").pathname);
    expect(lido).toEqual({
      local: { tipo: "servidor", serverId: S, channelId: C },
      mensagemId: M,
    });
  });

  it("sem servidor (DM, grupo, notas) não há link", () => {
    expect(linkDoResultado("https://vortex.local", undefined, C, M)).toBeUndefined();
    expect(linkDoResultado("https://vortex.local", "", C, M)).toBeUndefined();
  });
});
