/**
 * Entrar e sair de uma chamada — a fachada, sem LiveKit.
 *
 * ⚠ **Este arquivo NÃO importa `livekit-client`, e a ausência é o ponto.** O
 * motor (`motorDeVoz.ts`) é carregado com `await import()` no primeiro clique
 * em "entrar na sala". Com o import estático, o carregamento inicial do app
 * saltava de 996 kB para 1.539 kB (gzip: 303 → 444) — meio megabyte em toda
 * abertura para uma feature que a maioria das sessões nunca usa.
 *
 * A fachada existe para que o resto do app (menu de canal, cartão de chamada)
 * chame `entrarNaChamada` sem arrastar o WebRTC junto.
 */
import { encerrarChamada, lerChamada } from "../store/chamada";

type Motor = typeof import("./motorDeVoz");

let motor: Motor | undefined;

/**
 * Carrega o motor uma vez.
 *
 * `import()` cacheia por si só, mas guardar a referência evita uma promessa por
 * clique em botão de microfone — que numa chamada é o alvo mais apertado que
 * existe.
 */
async function carregar(): Promise<Motor> {
  motor ??= await import("./motorDeVoz");
  return motor;
}

export async function entrarNaChamada(channelId: string): Promise<boolean> {
  const m = await carregar();
  return m.entrarNaChamada(channelId);
}

/**
 * Sai.
 *
 * Se o motor nunca foi carregado, não há sala — e carregar meio megabyte para
 * descobrir isso seria absurdo. `encerrarChamada` limpa o store, que é tudo o
 * que sobra nesse caso.
 */
export async function sairDaChamada(): Promise<void> {
  if (!motor) {
    encerrarChamada();
    return;
  }
  await motor.sairDaChamada();
}

export async function alternarMudo(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await carregar()).alternarMudo();
}

export async function alternarSurdo(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await carregar()).alternarSurdo();
}

export async function alternarCamera(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await carregar()).alternarCamera();
}

export async function alternarTela(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await carregar()).alternarTela();
}
