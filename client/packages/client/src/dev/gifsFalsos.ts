import type { Gif, ProvedorDeGif } from "../sdk/gifs";

/**
 * O dublê do provedor de GIF, para o arnês `/dev`.
 *
 * ⚠ **Existe porque sem ele o seletor só é visto VAZIO.** A instância de
 * desenvolvimento não sobe o `gifbox`, então o seletor mostraria "esta
 * instância não configurou GIFs" para sempre — o masonry, a paginação e o
 * envio nasceriam construídos e inalcançáveis, que é a família do painel de
 * fixadas.
 *
 * A prévia é um `webm` de verdade, GRAVADO de um canvas por `MediaRecorder`:
 * a CSP de `media-src` aceita `blob:`, e uma URL de terceiro seria justamente
 * o que o proxy existe para não fazer. Seis cores, gravadas uma vez.
 */

const PROPORCOES: readonly (readonly [number, number])[] = [
  [220, 124],
  [220, 220],
  [220, 290],
  [220, 160],
];

const CORES = ["#35c2cc", "#8b7cf6", "#e8596b", "#f2b544", "#4cc38a", "#5b8def"];

let gravadas: Promise<readonly string[]> | undefined;

function gravar(cor: string): Promise<string> {
  return new Promise((resolver) => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d");
    const fluxo = canvas.captureStream(30);
    const gravador = new MediaRecorder(fluxo, { mimeType: "video/webm" });
    const pedacos: Blob[] = [];
    gravador.ondataavailable = (e) => pedacos.push(e.data);
    gravador.onstop = () =>
      resolver(URL.createObjectURL(new Blob(pedacos, { type: "video/webm" })));

    let quadro = 0;
    const desenhar = () => {
      if (!ctx) return;
      ctx.fillStyle = "#0e1116";
      ctx.fillRect(0, 0, 160, 90);
      ctx.fillStyle = cor;
      ctx.fillRect((quadro * 6) % 160, 30, 30, 30);
      quadro++;
      if (gravador.state === "recording") requestAnimationFrame(desenhar);
    };
    gravador.start();
    desenhar();
    setTimeout(() => gravador.stop(), 600);
  });
}

function previas(): Promise<readonly string[]> {
  gravadas ??= Promise.all(CORES.map(gravar));
  return gravadas;
}

/** Três páginas de doze, para a paginação ter o que buscar. */
const PAGINAS = 3;
const POR_PAGINA = 12;

export const provedorDeGifFalso: ProvedorDeGif = {
  async buscar(consulta, posicao) {
    const urls = await previas();
    const pagina = posicao === undefined ? 0 : Number(posicao);
    const semente = consulta.tipo === "busca" ? consulta.termo.length : 0;
    const gifs: Gif[] = Array.from({ length: POR_PAGINA }, (_, i) => {
      const n = pagina * POR_PAGINA + i;
      const [largura, altura] = PROPORCOES[(n + semente) % PROPORCOES.length] ?? [220, 124];
      return {
        id: `${consulta.tipo === "busca" ? consulta.termo : "alta"}-${n}`,
        url: `https://gif.exemplo/view/${n}`,
        previa: urls[(n + semente) % urls.length] ?? "",
        largura,
        altura,
      };
    });
    return {
      gifs,
      proxima: pagina + 1 < PAGINAS ? String(pagina + 1) : undefined,
    };
  },
};
