/**
 * Figurinhas e efeitos sonoros do arnês.
 *
 * ⚠ **12ª vez que o arnês ficaria mais pobre que o protocolo** — as listas vêm
 * de REST (`/servers/{id}/stickers|sounds`), que o firehose não produz, então
 * sem isto as duas páginas, os dois seletores e a figurinha na linha só seriam
 * vistos nos estados vazio e de falha.
 *
 * As URLs são LOCAIS de propósito: SVG em `data:` para a figurinha e um bipe
 * WAV em `blob:` para o som — os dois cabem na CSP de dev (`img-src data:`,
 * `media-src blob:`), e nenhum toca a rede.
 */
import { semearExpressoes, type EfeitoSonoro, type Figurinha } from "../sdk/expressoes";

function svgDe(emoji: string, fundo: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">` +
    `<rect width="320" height="320" rx="48" fill="${fundo}"/>` +
    `<text x="160" y="210" font-size="170" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const AUTOR = "01JQ0000000000000000USER00";

export const FIGURINHAS_DO_ARNES: readonly Omit<Figurinha, "serverId">[] = [
  { id: "01JQFIG0000000000000000001", nome: "deu ruim", descricao: "Reação para quando o deploy falha", emoji: "🙃", url: svgDe("🙃", "#2a3038"), autorId: AUTOR, autorNome: "Rafa" },
  { id: "01JQFIG0000000000000000002", nome: "subiu", descricao: "Release publicada", emoji: "🚀", url: svgDe("🚀", "#1e7f92"), autorId: AUTOR, autorNome: "Marina" },
  { id: "01JQFIG0000000000000000003", nome: "no alvo", descricao: "Quando a estimativa acerta", emoji: "🎯", url: svgDe("🎯", "#5b3f8a"), autorId: AUTOR, autorNome: "Téo" },
];

/** Um bipe curto em WAV PCM — gerado, para o arnês não carregar arquivo. */
function bipe(frequencia: number, duracaoS = 0.25): string | undefined {
  if (typeof URL.createObjectURL !== "function") return undefined;
  const taxa = 22050;
  const n = Math.floor(taxa * duracaoS);
  const dados = new DataView(new ArrayBuffer(44 + n * 2));
  const escrever = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dados.setUint8(o + i, s.charCodeAt(i));
  };
  escrever(0, "RIFF");
  dados.setUint32(4, 36 + n * 2, true);
  escrever(8, "WAVEfmt ");
  dados.setUint32(16, 16, true);
  dados.setUint16(20, 1, true);
  dados.setUint16(22, 1, true);
  dados.setUint32(24, taxa, true);
  dados.setUint32(28, taxa * 2, true);
  dados.setUint16(32, 2, true);
  dados.setUint16(34, 16, true);
  escrever(36, "data");
  dados.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const envelope = Math.min(1, (n - i) / (taxa * 0.05));
    dados.setInt16(44 + i * 2, Math.sin((2 * Math.PI * frequencia * i) / taxa) * 12000 * envelope, true);
  }
  return URL.createObjectURL(new Blob([dados.buffer], { type: "audio/wav" }));
}

const SONS: readonly Omit<EfeitoSonoro, "serverId" | "url">[] = [
  { id: "01JQSOM0000000000000000001", nome: "tambor", emoji: "🥁", volume: 80, autorId: AUTOR, autorNome: "Rafa" },
  { id: "01JQSOM0000000000000000002", nome: "anúncio", emoji: "📣", volume: 55, autorId: AUTOR, autorNome: "Marina" },
  { id: "01JQSOM0000000000000000003", nome: "fanfarra", emoji: "🎺", volume: 40, autorId: AUTOR, autorNome: "Téo" },
  { id: "01JQSOM0000000000000000004", nome: "pato", emoji: "🦆", volume: 70, autorId: AUTOR, autorNome: "Rafa" },
];
const FREQUENCIAS = [220, 440, 660, 880];

export function semearExpressoesDoArnes(serverId: string): void {
  semearExpressoes(serverId, {
    figurinhas: FIGURINHAS_DO_ARNES.map((f) => ({ ...f, serverId })),
    sons: SONS.map((s, i) => ({ ...s, serverId, url: bipe(FREQUENCIAS[i] ?? 440) })),
  });
}
