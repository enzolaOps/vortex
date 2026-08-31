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
  assinarPreferenciasDeVoz,
  constraintsDeAudio,
  lerPreferenciasDeVoz,
} from "../store/preferenciasDeVoz";
import {
  ConnectionState,
  Room,
  ConnectionQuality,
  RoomEvent,
  Track,
  type LocalParticipant,
  type RemoteTrack,
  type ScreenShareCaptureOptions,
} from "livekit-client";

import { client } from "./client";
import type { QualidadeDeVoz } from "../store/chamada";
import {
  alternarMudoNoStore,
  alternarSurdoNoStore,
  definirChamada,
  definirFalantes,
  encerrarChamada,
  lerChamada,
} from "../store/chamada";
import { toast } from "../components/ui/toastStore";
import { ALTURA_DE, ponteDeTela } from "./seletorDeTela";
import { pedirEscolhaDeTela } from "../store/seletorDeTela";

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
      desde: Date.now(),
      channelId,
      participantes: participantesDe(r),
    });
  });

  r.on(RoomEvent.Disconnected, () => encerrarChamada());
  r.on(RoomEvent.Reconnecting, () => definirChamada({ estado: "reconectando" }));
  r.on(RoomEvent.Reconnected, () => definirChamada({ estado: "dentro" }));

  /*
    A qualidade da conexão, do LiveKit.

    Só a do participante LOCAL: a do outro lado é problema dele, e mostrar a
    pior de todas faria o painel acusar a sua rede quando quem está mal é
    alguém do outro continente.

    `ConnectionQuality` é classificação, não número — ver `QualidadeDeVoz` no
    store. O design mostra "42 ms"; derivar milissegundos de "good" seria dado
    falso numa superfície onde a pessoa decide se sai da chamada.
  */
  r.on(RoomEvent.ConnectionQualityChanged, (qualidade, participante) => {
    if (participante?.identity !== r.localParticipant.identity) return;
    definirChamada({ qualidade: traduzirQualidade(qualidade) });
  });

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
    /*
      ⚠ **As preferências de Voz e vídeo chegam ao WebRTC AQUI**, e são as três
      que o navegador sabe cumprir: supressão de ruído, cancelamento de eco e
      controle de ganho são `MediaTrackConstraints`, mais o `deviceId` da
      entrada. Sem esta linha a tela de configurações guardaria escolhas que
      nada lê — que é exatamente o defeito que ela existe para não ter.
    */
    await r.localParticipant.setMicrophoneEnabled(
      !lerChamada().mudo,
      constraintsDeAudio(),
    );
    await aplicarSaida(r);
    pararDeOuvirPreferencias = assinarPreferenciasDeVoz(() => {
      void trocarDispositivos(r);
    });
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
  pararDeOuvirPreferencias?.();
  pararDeOuvirPreferencias = undefined;
  if (!r) return;
  r.removeAllListeners();
  await r.disconnect();
  encerrarChamada();
}

/**
 * Trocar de microfone ou de fone SEM sair da chamada.
 *
 * ⚠ A assinatura vive só enquanto a sala existe, e é desfeita em
 * `sairDaChamada` — listener sem cleanup é o erro nº 5 do briefing, e este
 * ficaria pendurado numa `Room` já desconectada.
 *
 * Sem `try`: `switchActiveDevice` rejeita quando o dispositivo some no meio
 * (fone desconectado), e uma exceção não tratada aqui derrubaria a chamada por
 * causa de uma troca de dispositivo.
 */
let pararDeOuvirPreferencias: (() => void) | undefined;

async function aplicarSaida(r: Room): Promise<void> {
  const { saidaId } = lerPreferenciasDeVoz();
  if (saidaId === undefined) return;
  try {
    await r.switchActiveDevice("audiooutput", saidaId);
  } catch {
    /* Dispositivo sumiu entre a escolha e o uso. O padrão do sistema assume. */
  }
}

async function trocarDispositivos(r: Room): Promise<void> {
  const { entradaId } = lerPreferenciasDeVoz();
  try {
    if (entradaId !== undefined) {
      await r.switchActiveDevice("audioinput", entradaId);
    }
  } catch {
    /* Idem. */
  }
  await aplicarSaida(r);
}

/**
 * A grafia do LiveKit para a nossa. Não sai daqui.
 *
 * `Unknown` e `Lost` são estados diferentes e o produto os trata igual? Não:
 * `perdida` é a única que muda a cor do painel para danger, porque é a única
 * em que a pessoa provavelmente já parou de ser ouvida.
 */
function traduzirQualidade(q: ConnectionQuality): QualidadeDeVoz {
  switch (q) {
    case ConnectionQuality.Excellent:
      return "otima";
    case ConnectionQuality.Good:
      return "boa";
    case ConnectionQuality.Poor:
      return "ruim";
    case ConnectionQuality.Lost:
      return "perdida";
    default:
      return "desconhecida";
  }
}

export async function alternarMudo(): Promise<void> {
  // A regra é do store; aqui só se APLICA no transporte. Ver
  // `alternarMudoNoStore`.
  const mudo = alternarMudoNoStore();
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
  const { surdo, mudo } = alternarSurdoNoStore();
  await sala?.localParticipant.setMicrophoneEnabled(!surdo && !mudo);

  const el = elementoDeAudio();
  for (const audio of el.querySelectorAll("audio")) audio.muted = surdo;
}

/**
 * O participante local, ou a notícia de que não há sala.
 *
 * ⚠ **Existe por causa de um defeito silencioso, e ele é a razão desta função
 * não ser um `sala?.` a mais.** Câmera e tela eram `await
 * sala?.localParticipant.setXEnabled(v)` — e com `sala` indefinida o
 * encadeamento opcional devolve `undefined`, `await undefined` RESOLVE, o
 * `catch` nunca dispara e a linha seguinte marca o estado como ligado.
 *
 * O sintoma medido: clicar em "Compartilhar tela" levava `aria-pressed` de
 * `false` para `true` nos dois botões, **sem abrir seletor nenhum e sem erro
 * no console**. A interface afirmava estar transmitindo com nada acontecendo —
 * que é a única coisa que ela existe para não fazer.
 *
 * ⚠ **Mudo e surdo continuam com `sala?.` de propósito**, e a diferença é
 * real: aqueles são PREFERÊNCIA, aplicada no store antes de tocar o
 * transporte, e valem fora da chamada (ver `alternarMudoNoStore`). Câmera e
 * tela são transporte puro — sem sala não há o que ligar.
 */
function participanteLocal(): LocalParticipant | undefined {
  const p = sala?.localParticipant;
  if (!p) {
    toast({
      tipo: "erro",
      titulo: "A chamada não está conectada.",
      descricao: "Entre numa sala de voz para transmitir.",
    });
  }
  return p;
}

export async function alternarCamera(): Promise<void> {
  const p = participanteLocal();
  if (!p) return;

  const camera = !lerChamada().camera;
  try {
    await p.setCameraEnabled(camera);
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

/**
 * Compartilhar a tela.
 *
 * ⚠ **Quem desenha o seletor é o NAVEGADOR**, não o Vortex.
 * `setScreenShareEnabled(true)` chama `getDisplayMedia`, e a escolha de tela,
 * janela ou aba é uma superfície do sistema — nenhuma página pode substituí-la
 * nem estilizá-la. O seletor próprio que o design desenha (Telas · Janelas ·
 * Abas, com resolução e taxa de quadros) só é possível na casca Electron, via
 * `desktopCapturer`, e é trabalho de outra etapa.
 *
 * ⚠ `getDisplayMedia` exige ativação transitória — o clique. O caminho aqui
 * passa por um `await import()` do motor, mas na chamada REAL o módulo já foi
 * carregado por `entrarNaChamada`, então o clique chega direto. É só no arnês,
 * onde a chamada é falsa e o motor nunca foi carregado, que o import acontece
 * no clique.
 */
export async function alternarTela(): Promise<void> {
  const p = participanteLocal();
  if (!p) return;

  const ligando = !lerChamada().tela;

  /* Desligar não escolhe nada — o seletor só existe no caminho de ligar. */
  if (!ligando) {
    try {
      await p.setScreenShareEnabled(false);
    } finally {
      definirChamada({ tela: false });
    }
    return;
  }

  /*
    Na casca, o Vortex escolhe; no navegador, o sistema.

    `seletorProprio()` é a pergunta certa em vez de "estamos no Electron":
    mesmo dentro da casca, Wayland e macOS recente desenham o seletor do
    sistema e o handler nem roda. Quem sabe disso é a casca.
  */
  const ponte = ponteDeTela();
  const opcoes = ponte && (await ponte.seletorProprio())
    ? await comSeletorProprio(ponte)
    : {};

  /* `undefined` = cancelou no painel. Cancelar não é falha. */
  if (opcoes === undefined) return;

  try {
    await p.setScreenShareEnabled(true, opcoes);
    definirChamada({ tela: true });
  } catch {
    // Cancelar o seletor do sistema cai aqui, e também não é falha.
    definirChamada({ tela: false });
    void ponte?.cancelar();
  }
}

/**
 * Pergunta o que transmitir e ARMA a escolha na casca.
 *
 * Devolve as constraints para o LiveKit, ou `undefined` se a pessoa cancelou.
 *
 * ⚠ **A ordem importa: armar ANTES de pedir a captura.** O handler do main
 * consome a escolha armada quando o `getDisplayMedia` chega, e a escolha é de
 * uso único. Invertido, o pedido chegaria sem escolha e seria recusado.
 */
async function comSeletorProprio(
  ponte: NonNullable<ReturnType<typeof ponteDeTela>>,
): Promise<ScreenShareCaptureOptions | undefined> {
  const escolha = await pedirEscolhaDeTela();
  if (!escolha) return undefined;

  const armou = await ponte.escolher(escolha.fonteId, escolha.audio);
  if (!armou) {
    toast({
      tipo: "erro",
      titulo: "Não deu para preparar a transmissão.",
      descricao: "Tente escolher a tela de novo.",
    });
    return undefined;
  }

  const altura = ALTURA_DE[escolha.resolucao];
  return {
    audio: escolha.audio,
    /*
      ⚠ Só a ALTURA vira teto — ver `ALTURA_DE`. A largura sai de `16/9` porque
      `resolution` do LiveKit pede as duas, e travar a largura REAL da fonte
      distorceria uma tela ultrawide. O navegador respeita a proporção da fonte
      e usa isto como limite superior.
    */
    ...(altura === undefined
      ? {}
      : {
          resolution: {
            width: Math.round((altura * 16) / 9),
            height: altura,
            frameRate: escolha.taxa,
          },
        }),
    /*
      `contentHint` muda o que o codec preserva quando falta banda: `detail`
      segura o texto e sacrifica movimento; `motion` faz o contrário. 60 quadros
      só faz sentido pedindo movimento — a pessoa que os escolheu está mostrando
      algo que se mexe.
    */
    contentHint: escolha.taxa >= 60 ? "motion" : "detail",
  };
}

/** O estado bruto da conexão, para o arnês conferir sem abrir a sala. */
export function estadoBruto(): string {
  return sala?.state ?? ConnectionState.Disconnected;
}
