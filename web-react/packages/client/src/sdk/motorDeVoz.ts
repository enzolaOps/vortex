/**
 * O motor de voz — o único módulo do app que importa `livekit-client`.
 *
 * ⚠ **Separado de `chamada.ts` por causa do BUNDLE, e o número é o argumento.**
 * Com o LiveKit importado estaticamente, o carregamento inicial pulou de 996 kB
 * para 1.539 kB (gzip: 303 → 444). Meio megabyte a mais em toda abertura do
 * app, para uma feature que a maioria das sessões nunca usa — e este é um
 * cliente de jornada de 8h, onde a primeira pintura importa.
 *
 * `chamada.ts` importa este arquivo com `await import()`, no primeiro clique em
 * "entrar na sala". Quem nunca entra em chamada nunca baixa o WebRTC.
 *
 * ⚠ **Só `livekit-client`, e NÃO `@livekit/components-react`.** O plano de
 * paridade previa os dois; a doutrina do projeto diz o contrário e ela ganha:
 * `component-primitives.md` lista "painel de voz e indicadores de fala" entre
 * o que se escreve à mão, e a razão é a de sempre — biblioteca de componente
 * traz modelo de dados, estilo e estado próprios, que são os três lugares onde
 * este projeto já tem decisão tomada.
 *
 * O que o LiveKit resolve e ninguém quer reescrever é o TRANSPORTE: WebRTC,
 * renegociação, seleção de codec, reconexão. Isso é `livekit-client`. O anel de
 * fala é um `boolean` num store efêmero — não paga uma segunda árvore de
 * contexto React.
 *
 * ⚠ **Nada de `Room` sai deste arquivo.** O que sai é o store de `chamada.ts`,
 * como o adapter faz com `stoat.js`.
 */
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from "livekit-client";

import { client } from "./client";
import {
  definirChamada,
  definirFalantes,
  encerrarChamada,
  lerChamada,
} from "../store/chamada";
import { toast } from "../components/ui/toastStore";

/**
 * A sala, module-level.
 *
 * Uma por app e não uma por componente: o cartão de chamada desmonta quando a
 * pessoa navega, e uma sala presa a ele derrubaria a chamada ao trocar de
 * canal — que é exatamente o que o modo PiP existe para não fazer.
 */
let sala: Room | undefined;

/** Onde o áudio remoto toca. Um só, fora da árvore React. */
let saidaDeAudio: HTMLDivElement | undefined;

function elementoDeAudio(): HTMLDivElement {
  if (!saidaDeAudio) {
    saidaDeAudio = document.createElement("div");
    // Fora da árvore do React de propósito: o React não precisa saber que
    // existem elementos `<audio>`, e um re-render não pode reiniciá-los.
    saidaDeAudio.style.display = "none";
    document.body.appendChild(saidaDeAudio);
  }
  return saidaDeAudio;
}

function motivo(e: unknown): string {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 403) return "Você não pode entrar nesta sala.";
  if (status === 404) return "Esta sala não existe.";
  if (status !== undefined) return "O servidor recusou a entrada.";
  return "Não deu para alcançar o servidor de voz.";
}

/**
 * Escolhe o nó de voz mais próximo.
 *
 * O protocolo entrega uma lista de nós com URL pública, e o upstream corre uma
 * sonda de latência entre eles. Aqui é a mesma ideia, com `Promise.any`: o
 * primeiro que responder ganha. Sem nós declarados, `undefined` deixa o
 * servidor escolher.
 *
 * ⚠ `replace(/^ws/, "http")` é ANCORADO — sem a âncora, um nó chamado
 * `wsproxy` teria o nome trocado no meio. O upstream tem a mesma linha, e a
 * âncora é a diferença entre funcionar e falhar em um nó específico.
 */
async function noMaisRapido(): Promise<string | undefined> {
  const feature = (
    client.configuration as
      | { features?: { livekit?: { nodes?: { name: string; public_url: string }[] } } }
      | undefined
  )?.features?.livekit;
  const nos = feature?.nodes ?? [];
  if (nos.length === 0) return undefined;

  try {
    return await Promise.any(
      nos.map(async (no) => {
        await fetch(no.public_url.replace(/^ws/, "http"), { mode: "no-cors" });
        return no.name;
      }),
    );
  } catch {
    // Nenhum respondeu. Entrar mesmo assim é melhor que não entrar: o servidor
    // tem um padrão, e a sonda é otimização, não requisito.
    return undefined;
  }
}

/** Quem está na sala agora, do ponto de vista do LiveKit. */
function participantesDe(r: Room): string[] {
  const ids: string[] = [];
  const eu = r.localParticipant.identity;
  if (eu) ids.push(eu);
  for (const p of r.remoteParticipants.values()) ids.push(p.identity);
  return ids;
}

function ligarEventos(r: Room, channelId: string): void {
  const publicar = () =>
    definirChamada({ channelId, participantes: participantesDe(r) });

  r.on(RoomEvent.Connected, () => {
    definirChamada({
      estado: "dentro",
      channelId,
      participantes: participantesDe(r),
    });
  });

  r.on(RoomEvent.Disconnected, () => encerrarChamada());
  r.on(RoomEvent.Reconnecting, () => definirChamada({ estado: "reconectando" }));
  r.on(RoomEvent.Reconnected, () => definirChamada({ estado: "dentro" }));

  r.on(RoomEvent.ParticipantConnected, publicar);
  r.on(RoomEvent.ParticipantDisconnected, publicar);

  /*
    ⚠ **O evento mais quente do app inteiro.**

    `ActiveSpeakersChanged` chega várias vezes por segundo por pessoa. Ele NÃO
    toca o store de chamada nem o de canais — só o efêmero, que coalesce em
    120ms. É o aviso que o `CLAUDE.md` registrou antes de esta etapa existir.
  */
  r.on(RoomEvent.ActiveSpeakersChanged, (falantes) => {
    definirFalantes(falantes.map((p) => p.identity));
  });

  /*
    Áudio remoto: anexa num elemento fora da árvore React.

    `autoSubscribe: false` na conexão significa que nada chega sozinho — o que
    evita baixar vídeo de todo mundo ao entrar. Assinar o áudio explicitamente
    aqui é o que faz a sala ter som.
  */
  r.on(RoomEvent.TrackSubscribed, (faixa: RemoteTrack) => {
    if (faixa.kind !== Track.Kind.Audio) return;
    elementoDeAudio().appendChild(faixa.attach());
  });

  r.on(RoomEvent.TrackUnsubscribed, (faixa: RemoteTrack) => {
    faixa.detach().forEach((el) => el.remove());
  });

  r.on(RoomEvent.TrackPublished, (pub, participante) => {
    // Assina só áudio por padrão. Vídeo entra quando a tela de chamada pedir —
    // baixar câmera de dez pessoas para mostrar avatares é desperdício puro.
    if (pub.kind === Track.Kind.Audio) void pub.setSubscribed(true);
    void participante;
  });
}

/**
 * Entra numa sala de voz.
 *
 * `joinCall` do protocolo devolve `{token, url}` — o token é do LiveKit, não do
 * Stoat, e vale para uma sala só. É a única chamada de rede desta etapa que
 * passa pelo `stoat.js`.
 */
export async function entrarNaChamada(channelId: string): Promise<boolean> {
  if (lerChamada().channelId === channelId && lerChamada().estado !== "fora") {
    return true;
  }

  await sairDaChamada();
  definirChamada({ estado: "conectando", channelId, participantes: [] });

  try {
    const canal = client.channels.get(channelId);
    if (!canal) throw new Error("canal desconhecido");

    const no = await noMaisRapido();
    const auth = await canal.joinCall(no);

    const r = new Room();
    sala = r;
    ligarEventos(r, channelId);

    /*
      `autoSubscribe: false` é o padrão daqui, e é decisão de custo: com ele
      ligado, entrar numa sala de dez pessoas começa a baixar dez faixas de
      vídeo que ninguém pediu. O áudio é assinado por evento, acima.
    */
    await r.connect(auth.url, auth.token, { autoSubscribe: false });
    await r.localParticipant.setMicrophoneEnabled(!lerChamada().mudo);
    return true;
  } catch (e) {
    encerrarChamada();
    toast({
      tipo: "erro",
      titulo: "Não deu para entrar na chamada.",
      descricao: motivo(e),
    });
    return false;
  }
}

/**
 * Sai.
 *
 * ⚠ **Não existe rota de saída no protocolo** — sair é desconectar do LiveKit,
 * e o servidor descobre pelo socket. Procurar um `DELETE` aqui é procurar o que
 * não existe.
 */
export async function sairDaChamada(): Promise<void> {
  const r = sala;
  sala = undefined;
  if (!r) return;
  r.removeAllListeners();
  await r.disconnect();
  encerrarChamada();
}

export async function alternarMudo(): Promise<void> {
  const mudo = !lerChamada().mudo;
  definirChamada({ mudo });
  await sala?.localParticipant.setMicrophoneEnabled(!mudo);
}

/**
 * Ensurdecer também emudece.
 *
 * Quem não está ouvindo não deve continuar falando: é a convenção de todo
 * cliente de voz, e a razão é social — falar sem ouvir a resposta atropela a
 * conversa. Desensurdecer NÃO desfaz o mudo automaticamente: se a pessoa já
 * estava muda antes, voltar a transmitir seria uma decisão que ela não tomou.
 */
export async function alternarSurdo(): Promise<void> {
  const surdo = !lerChamada().surdo;
  definirChamada({ surdo, mudo: surdo ? true : lerChamada().mudo });
  await sala?.localParticipant.setMicrophoneEnabled(!surdo && !lerChamada().mudo);

  const el = elementoDeAudio();
  for (const audio of el.querySelectorAll("audio")) audio.muted = surdo;
}

export async function alternarCamera(): Promise<void> {
  const camera = !lerChamada().camera;
  try {
    await sala?.localParticipant.setCameraEnabled(camera);
    definirChamada({ camera });
  } catch {
    // Permissão negada é o caso comum, e não é erro do app.
    toast({
      tipo: "erro",
      titulo: "Câmera indisponível.",
      descricao: "Verifique a permissão do navegador.",
    });
  }
}

export async function alternarTela(): Promise<void> {
  const tela = !lerChamada().tela;
  try {
    await sala?.localParticipant.setScreenShareEnabled(tela);
    definirChamada({ tela });
  } catch {
    // Cancelar o seletor do navegador cai aqui, e cancelar não é falha —
    // por isso não há toast.
    definirChamada({ tela: false });
  }
}

/** O estado bruto da conexão, para o arnês conferir sem abrir a sala. */
export function estadoBruto(): string {
  return sala?.state ?? ConnectionState.Disconnected;
}
