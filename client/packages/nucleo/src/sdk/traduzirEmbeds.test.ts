import { MessageEmbed } from "stoat.js";
import { describe, expect, it } from "vitest";

import { HOSTS_DE_PLAYER, traduzirEmbeds } from "./traduzirEmbeds";

/** Cliente de mentira: só o proxy, que é a única coisa que o domínio consulta. */
const comProxy = { proxyFile: (u: string) => `https://app.test/january/proxy?url=${encodeURIComponent(u)}` };
const semProxy = { proxyFile: () => undefined };

function embeds(dados: unknown[], cliente: { proxyFile: (u: string) => string | undefined } = comProxy) {
  return traduzirEmbeds(dados.map((d) => MessageEmbed.from(cliente as never, d as never)));
}

const IMAGEM = { url: "https://cdn.exemplo.com/a.png", width: 800, height: 400, size: "Large" };

describe("traduzirEmbeds", () => {
  it("site: título, descrição, origem, cor e imagem pelo proxy com a caixa do metadata", () => {
    const [e] = embeds([
      {
        type: "Website",
        url: "https://www.exemplo.com/post",
        title: "Um post",
        description: "Resumo",
        site_name: "Exemplo",
        colour: "#35c2cc",
        image: IMAGEM,
      },
    ]);
    expect(e).toMatchObject({
      tipo: "site",
      url: "https://www.exemplo.com/post",
      origem: "Exemplo",
      titulo: "Um post",
      descricao: "Resumo",
      cor: "#35c2cc",
      imagemGrande: true,
    });
    expect(e?.imagem).toEqual({
      url: `https://app.test/january/proxy?url=${encodeURIComponent(IMAGEM.url)}`,
      largura: 800,
      altura: 400,
    });
  });

  it("sem siteName usa o host, sem o www", () => {
    const [e] = embeds([{ type: "Website", url: "https://www.exemplo.com/x", title: "T" }]);
    expect(e?.origem).toBe("exemplo.com");
  });

  it("sem proxy no servidor, nenhuma imagem: o cartão fica de texto", () => {
    const [e] = embeds([{ type: "Website", url: "https://exemplo.com", title: "T", image: IMAGEM }], semProxy);
    expect(e?.titulo).toBe("T");
    expect(e?.imagem).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain("cdn.exemplo.com");
  });

  it("nunca expõe a URL original da mídia, só a do proxy", () => {
    const todos = embeds([
      { type: "Website", url: "https://exemplo.com", title: "T", image: IMAGEM },
      { type: "Image", ...IMAGEM },
      { type: "Video", url: "https://cdn.exemplo.com/v.mp4", width: 640, height: 360 },
    ]);
    for (const e of todos) {
      for (const m of [e.imagem, e.video]) {
        if (m) expect(m.url.startsWith("https://app.test/january/proxy?url=")).toBe(true);
      }
    }
    expect(todos).toHaveLength(3);
  });

  it("imagem e vídeo soltos sem proxy são descartados", () => {
    expect(embeds([{ type: "Image", ...IMAGEM }], semProxy)).toHaveLength(0);
    expect(embeds([{ type: "Video", url: "https://x.com/v.mp4", width: 1, height: 1 }], semProxy)).toHaveLength(0);
  });

  it("imagem solta e vídeo solto viram cartões de mídia com a caixa reservada", () => {
    const [i, v] = embeds([
      { type: "Image", ...IMAGEM },
      { type: "Video", url: "https://cdn.exemplo.com/v.mp4", width: 640, height: 360 },
    ]);
    expect(i).toMatchObject({ tipo: "imagem", imagem: { largura: 800, altura: 400 } });
    expect(v).toMatchObject({ tipo: "video", video: { largura: 640, altura: 360 } });
  });

  it("URL que não é http(s) não vira destino do cartão", () => {
    const [e] = embeds([{ type: "Website", url: "javascript:alert(1)", title: "T" }]);
    expect(e?.url).toBeUndefined();
    const [d] = embeds([{ type: "Website", url: "data:text/html,x", title: "T" }]);
    expect(d?.url).toBeUndefined();
  });

  it("mídia cujo proxy não é http(s) é descartada", () => {
    const [e] = embeds(
      [{ type: "Website", url: "https://exemplo.com", title: "T", image: IMAGEM }],
      { proxyFile: () => "javascript:alert(1)" },
    );
    expect(e?.imagem).toBeUndefined();
  });

  it("cor só em hex: o resto some", () => {
    const [a] = embeds([{ type: "Website", url: "https://a.com", title: "T", colour: "red; background:url(x)" }]);
    const [b] = embeds([{ type: "Website", url: "https://b.com", title: "T", colour: "var(--vx-bg)" }]);
    expect(a?.cor).toBeUndefined();
    expect(b?.cor).toBeUndefined();
  });

  it("embed vazio é descartado", () => {
    expect(embeds([{ type: "Website", url: "https://exemplo.com" }])).toHaveLength(0);
    expect(embeds([{ type: "None" }])).toHaveLength(0);
  });

  it("especial: player de host conhecido, só como URL — e áudio marcado", () => {
    const [yt, sp] = embeds([
      {
        type: "Website",
        url: "https://youtu.be/abc",
        title: "Vídeo",
        special: { type: "YouTube", id: "abc", timestamp: "10" },
        image: IMAGEM,
        video: { url: "https://yt.exemplo/v.mp4", width: 1280, height: 720 },
      },
      {
        type: "Website",
        url: "https://open.spotify.com/track/xyz",
        title: "Faixa",
        special: { type: "Spotify", content_type: "track", id: "xyz" },
      },
    ]);
    expect(yt?.especial).toMatchObject({ servico: "YouTube", audio: false });
    expect(yt?.especial?.playerUrl).toBe("https://www.youtube-nocookie.com/embed/abc?modestbranding=1&start=10");
    // Com player, o vídeo do site é o player: não vira <video> por fora.
    expect(yt?.video).toBeUndefined();
    expect(sp?.especial).toMatchObject({ servico: "Spotify", audio: true });
    expect(HOSTS_DE_PLAYER.has(new URL(sp?.especial?.playerUrl ?? "").hostname)).toBe(true);
  });

  it("especial sem tipo reconhecido não ganha player", () => {
    const [e] = embeds([{ type: "Website", url: "https://x.com", title: "T", special: { type: "None" } }]);
    expect(e?.especial).toBeUndefined();
  });

  it("texto: markdown analisado, sem imagem", () => {
    const [e] = embeds([{ type: "Text", title: "Deploy", description: "**ok** em `prod`", colour: "#3fb950" }]);
    expect(e).toMatchObject({ tipo: "texto", titulo: "Deploy", cor: "#3fb950" });
    expect(e?.blocos?.[0]?.tipo).toBe("paragrafo");
    expect(e?.imagem).toBeUndefined();
  });

  it("sem embeds devolve sempre a MESMA referência vazia", () => {
    expect(traduzirEmbeds(undefined)).toBe(traduzirEmbeds([]));
  });

  it("dois embeds com a mesma URL viram um", () => {
    const r = embeds([
      { type: "Website", url: "https://a.com", title: "A" },
      { type: "Website", url: "https://a.com", title: "A de novo" },
    ]);
    expect(r).toHaveLength(1);
  });
});
