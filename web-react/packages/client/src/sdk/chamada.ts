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
import {
  alternarMudoNoStore,
  alternarSurdoNoStore,
  encerrarChamada,
  lerChamada,
} from "../store/chamada";
import { toast } from "../components/ui/toastStore";

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

/**
 * O motor, ou nada — com o aviso na tela quando ele não vem.
 *
 * ⚠ **A falha aqui era MUDA, e isso não é hipotético.** `carregar()` rejeita
 * quando o chunk não baixa, e quem chama usa `void entrarNaChamada(id)` — o
 * `void` engole a rejeição num "unhandled promise rejection" que só existe no
 * console. A pessoa clica em "Entrar na sala" e NÃO ACONTECE NADA, que é o
 * modo de falha que este projeto classifica como pior que a ausência.
 *
 * O caso que faz isso acontecer é corriqueiro: quem está com a página aberta
 * quando uma versão nova sobe pede o chunk pelo hash ANTIGO, que deixou de
 * existir. Reproduzido em navegador trocando a imagem do contêiner —
 * `Failed to fetch dynamically imported module`, 404, e a interface calada.
 *
 * `motor` fica `undefined` após a falha, então tentar de novo tenta de verdade;
 * e depois de uma versão nova, recarregar resolve — que é o que o texto pede.
 *
 * Passam por aqui TODOS os cinco pontos que carregam o motor, e não só o de
 * entrar: mudo, surdo, câmera e tela ficam no rodapé da coluna o dia inteiro,
 * e um deles falhando calado é o mesmo defeito numa superfície mais visível.
 */
async function motorOuAviso(): Promise<Motor | undefined> {
  try {
    return await carregar();
  } catch {
    toast({
      tipo: "erro",
      titulo: "Não deu para carregar a voz.",
      descricao:
        "Se o app foi atualizado agora, recarregue a página e tente de novo.",
    });
    return undefined;
  }
}

export async function entrarNaChamada(channelId: string): Promise<boolean> {
  const m = await motorOuAviso();
  if (m === undefined) return false;
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

/**
 * Mudo e surdo funcionam FORA da chamada, e é o que o painel de usuário pede.
 *
 * ⚠ Antes o guarda era `return` seco: fora da sala o botão não fazia nada. Com
 * os controles no rodapé da coluna — onde o design os põe, e onde eles ficam o
 * dia inteiro — isso seria um botão morto na superfície mais visível do app.
 *
 * Fora da chamada só o STORE muda, e o motor não é carregado: mudo é
 * preferência, e `entrarNaChamada` já a lê para decidir se abre o microfone.
 * Baixar meio megabyte de WebRTC para virar um booleano seria o oposto da
 * razão de esta fachada existir.
 */
export async function alternarMudo(): Promise<void> {
  if (lerChamada().estado === "fora") {
    alternarMudoNoStore();
    return;
  }
  await (await motorOuAviso())?.alternarMudo();
}

export async function alternarSurdo(): Promise<void> {
  if (lerChamada().estado === "fora") {
    alternarSurdoNoStore();
    return;
  }
  await (await motorOuAviso())?.alternarSurdo();
}

export async function alternarCamera(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await motorOuAviso())?.alternarCamera();
}

export async function alternarTela(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await motorOuAviso())?.alternarTela();
}

/**
 * A faixa de vídeo da transmissão, para a prévia local.
 *
 * ⚠ **A única função SÍNCRONA desta fachada, e ela não carrega o motor.** Se o
 * motor não foi carregado não há sala, e sem sala não há transmissão — então
 * `undefined` é a resposta certa, e baixar meio megabyte de WebRTC para
 * descobrir isso seria o oposto da razão de a fachada existir.
 *
 * Quem chama é um efeito de componente. Uma versão assíncrona faria a caixa
 * de prévia renderizar vazia antes de cada quadro.
 */
export function faixaDeTela(): MediaStreamTrack | undefined {
  return motor?.faixaDeTela();
}

export async function pausarTela(pausar: boolean): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await motorOuAviso())?.pausarTela(pausar);
}

export async function alternarAudioDaTela(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await motorOuAviso())?.alternarAudioDaTela();
}

export async function trocarFonteDaTela(): Promise<void> {
  if (lerChamada().estado === "fora") return;
  await (await motorOuAviso())?.trocarFonteDaTela();
}

/**
 * Pede (ou devolve) o vídeo de alguém.
 *
 * ⚠ **SÍNCRONA e sem carregar o motor, ao contrário das outras.** Quem chama
 * é um efeito de montagem de ladrilho, e a limpeza dele roda no desmonte —
 * um `await` no caminho de limpeza é como se esquece de devolver uma
 * assinatura. Sem motor não há sala, e sem sala não há o que assinar.
 */
export function assinarVideo(
  userId: string,
  fonte: "camera" | "tela",
  sim: boolean,
): boolean {
  return motor?.assinarVideo(userId, fonte, sim) ?? false;
}

export function definirQualidadeDeStream(
  userId: string,
  fonte: "camera" | "tela",
  qualidade: "auto" | "alta" | "media" | "soAudio",
): void {
  motor?.definirQualidadeDeStream(userId, fonte, qualidade);
}

export function definirVolumeDe(userId: string, volume: number): void {
  motor?.definirVolumeDe(userId, volume);
}

export function volumeDe(userId: string): number {
  return motor?.volumeDe(userId) ?? 1;
}

/**
 * O que a transmissão está entregando de verdade — quadros e banda.
 *
 * Sem motor não há transmissão, então `undefined` é a resposta certa e não vale
 * carregar meio megabyte de WebRTC para descobrir isso.
 */
export async function estatisticasDaTela(): Promise<
  { fps: number | undefined; kbps: number | undefined } | undefined
> {
  return motor?.estatisticasDaTela();
}

/**
 * Ida e volta da rede de voz, em milissegundos — ou nada.
 *
 * ⚠ **Mesmo `motor?.` do `estatisticasDaTela`, e pela mesma razão que vale
 * dobrado aqui:** o consumidor é o overlay de depuração, que fica ligado o dia
 * inteiro. Carregar meio megabyte de WebRTC para descobrir que não há chamada
 * seria pagar a feature mais cara do app em toda sessão que ligasse um
 * mostrador de FPS.
 */
export async function estatisticasDeVoz(): Promise<number | undefined> {
  return motor?.estatisticasDeVoz();
}
