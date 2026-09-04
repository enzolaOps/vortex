import { beforeAll, describe, expect, it } from "vitest";

import { CHANNEL_ID, seed } from "../dev/firehose";
import { channelMessageIds, messages } from "./adapter";

/**
 * Os três tipos de anexo que a linha sabe desenhar.
 *
 * ⚠ **Este teste existe porque a nona ocorrência de "o arnês está mais pobre
 * que o protocolo" foi descoberta construindo o player de mensagem de voz.**
 * `Metadata.type === "Audio"` é do protocolo desde sempre, o firehose só sabia
 * produzir imagem e arquivo, e o player nasceria construído e inalcançável —
 * a mesma família de defeito do painel de fixadas, que passou meses sem
 * caminho normal até ele.
 *
 * O que ele guarda não é a semeadura: é a TRADUÇÃO. `map.ts` decide o tipo
 * olhando `metadata.type`, e o dia em que alguém acrescentar um `else` errado
 * ali, uma mensagem de voz vira um link de download — sem erro nenhum, e
 * visível só para quem rolar até uma das 34 mensagens que a têm.
 */
describe("tipos de anexo", () => {
  beforeAll(async () => {
    await seed(300);
    // Assina tudo: o store só materializa snapshot de quem tem assinante.
    for (const id of channelMessageIds.peek(CHANNEL_ID) ?? []) {
      messages.subscriber(id)(() => {});
    }
  });

  it("o arnês produz os três tipos, e a tradução os separa", () => {
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    const anexos = ids.flatMap((id) => messages.peek(id)?.anexos ?? []);

    expect(anexos.length).toBeGreaterThan(0);

    const porTipo = new Set(anexos.map((a) => a.tipo));
    // Os três, e a ausência de qualquer um significa uma superfície da linha
    // que nada exercita — que é exatamente o buraco que este teste fecha.
    expect(porTipo).toContain("imagem");
    expect(porTipo).toContain("arquivo");
    expect(porTipo).toContain("audio");
  });

  it("o áudio NÃO cai no ramo de arquivo", () => {
    /*
      A distinção que importa: `arquivo` vira um link com ícone de download, e
      `audio` vira o player com forma de onda. Colapsar os dois é o defeito
      silencioso — ninguém baixa um áudio de oito segundos para ouvi-lo.
    */
    const ids = channelMessageIds.peek(CHANNEL_ID) ?? [];
    const audios = ids
      .flatMap((id) => messages.peek(id)?.anexos ?? [])
      .filter((a) => a.tipo === "audio");

    expect(audios.length).toBeGreaterThan(0);
    for (const a of audios) {
      expect(a.nome.endsWith(".ogg")).toBe(true);
      // Sem dimensão, como o protocolo manda para áudio: `width`/`height` só
      // existem em `Image` e `Video`, e inventá-los reservaria espaço errado.
      expect(a.largura).toBeUndefined();
      expect(a.altura).toBeUndefined();
      // O peso continua vindo formatado — o rodapé do anexo o usa.
      expect(a.tamanhoTexto).toBeTruthy();
    }
  });
});
