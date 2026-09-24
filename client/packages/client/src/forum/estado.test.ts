import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DIAS_SEM_ATIVIDADE_PARA_ARQUIVAR, estadoDoPost } from "./estado";

describe("estadoDoPost", () => {
  it("sem estado nenhum não há selo", () => {
    expect(estadoDoPost({ arquivado: false, emAnalise: false })).toBeUndefined();
  });

  it("em análise aparece enquanto o post está aberto", () => {
    expect(estadoDoPost({ arquivado: false, emAnalise: true })).toBe("em análise");
  });

  it("fechado ganha de em análise — um selo só por card", () => {
    expect(estadoDoPost({ arquivado: true, emAnalise: true })).toBe("fechado");
    expect(estadoDoPost({ arquivado: true, emAnalise: false })).toBe("fechado");
  });
});

describe("regra de arquivamento", () => {
  it("o número que o vazio diz é o que o servidor aplica", () => {
    const rust = readFileSync(
      new URL(
        "../../../../../server/crates/core/database/src/models/channels/model.rs",
        import.meta.url,
      ),
      "utf8",
    );
    const casado = /pub const THREAD_ARCHIVE_AFTER_DAYS: u64 = (\d+);/.exec(rust);
    expect(casado, "THREAD_ARCHIVE_AFTER_DAYS sumiu do servidor").not.toBeNull();
    expect(Number(casado![1])).toBe(DIAS_SEM_ATIVIDADE_PARA_ARQUIVAR);
  });
});
