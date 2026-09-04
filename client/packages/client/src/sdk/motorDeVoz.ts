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
  VideoQuality,
  type LocalParticipant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type ScreenShareCaptureOptions,
} from "livekit-client";
import {
  constraintsDe,
  esquecerQualidadeDaTela,
  type QualidadeDaTela,
} from "../store/qualidadeDaTela";

import { client } from "./client";
import { sairDaSalaLocalmente } from "./adapter";
import type { Chamada, QualidadeDeVoz } from "../store/chamada";
import {
  alternarMudoNoStore,
  alternarSurdoNoStore,
  definirChamada,
  definirFalantes,
  encerrarChamada,
  lerChamada,
} from "../store/chamada";
import { definirPalco, lerPalco } from "../store/palcoDeVoz";
import { chaveDeVideo, faixasDeVideo, type FonteDeVideo } from "../store/video";
import { toast } from "../components/ui/toastStore";
import { ALTURA_DE, ponteDeTela } from "./seletorDeTela";
import { pedirEscolhaDeTela } from "../store/seletorDeTela";
import { motivoDoErro } from "./erros";

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

/**
 * A frase de uma falha de voz.
 *
 * ⚠ **Mídia PRIMEIRO, rede depois — e a ordem é o conserto.** Antes isto
 * delegava tudo a `motivoDoErro`, que lê o envelope do Revolt (`type`,
 * `status`). Um `DOMException` não tem nenhum dos dois e caía no fallback
 * dele: **"Sem resposta do servidor. Verifique sua conexão."**
 *
 * Medido no painel do navegador, que bloqueia captura: entrar na chamada
 * falhava com o microfone negado e a interface mandava conferir a REDE. A
 * pessoa vai procurar o problema no roteador por causa de uma permissão de
 * site — frase errada com confiança, que é pior que frase genérica.
 *
 * Um tradutor só para os dois caminhos (entrar e compartilhar tela): com dois,
 * o primeiro a ganhar um caso novo divergiria do outro.
 */
function motivo(e: unknown): string {
  return motivoDeMidia(e) ?? motivoDoErro(e);
}

/** `undefined` quando não é falha de dispositivo — aí quem responde é a rede. */
function motivoDeMidia(e: unknown): string | undefined {
  if (!(e instanceof DOMException)) return undefined;
  switch (e.name) {
    case "NotAllowedError":
      return "O navegador não liberou o microfone. Confira a permissão deste site.";
    case "NotFoundError":
      return "Nenhum microfone encontrado.";
    case "NotReadableError":
      return "O sistema não liberou o microfone. Feche outros programas que estejam usando ele.";
    case "OverconstrainedError":
      return "O dispositivo escolhido nas configurações não está disponível.";
    case "AbortError":
      return "A captura foi interrompida.";
    default:
      return undefined;
  }
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
    publicarFontes(r);
    /*
      ⚠ **Entrar numa sala ABRE a sala, e isto e o que faltava.** Antes daqui,
      entrar num canal de voz nao mudava nada na coluna de conteudo: a conversa
      continuava, e a unica prova de que voce estava dentro era o cartao
      flutuante do canto. "Clicar no canal e ver quem esta la" e o gesto mais
      basico da superficie, e ele nao existia.

      No `Connected` e nao no `Reconnected`: voltar de uma queda nao deve tirar
      da tela o chat que a pessoa escolheu ver enquanto ouvia.
    */
    definirPalco({ tipo: "grade" });
  });

  /*
    ⚠ **Sair da chamada apaga as faixas, e isto NÃO existia.**
    `encerrarChamada` zera o store de chamada e não sabe do de vídeo, então
    toda faixa — a sua e a de todo mundo — sobrevivia à sala. Ver `limpar` em
    `store/ephemeral.ts` para as duas consequências; a que morde primeiro não
    é o vazamento, é a faixa MORTA reaparecendo na chamada seguinte, porque
    as chaves (`usuário:fonte`) são estáveis entre chamadas.
  */
  r.on(RoomEvent.Disconnected, () => {
    faixasDeVideo.limpar();
    /* A contagem morre com a sala. Sem isto, entrar de novo começaria com
       assinantes fantasmas e a primeira borda nunca chegaria a zero. */
    assinantesDeVideo.clear();
    assinadoNoTransporte.clear();
    for (const t of liberacoesPendentes.values()) clearTimeout(t);
    liberacoesPendentes.clear();
    encerrarChamada();
  });
  r.on(RoomEvent.Reconnecting, () => definirChamada({ estado: "reconectando" }));

  /*
    ⚠ **Reconectar RE-VARRE quem publica o quê, e não só marca "dentro".**

    `transmitindo`, `comCamera` e `mudos` são mantidos por evento
    (`TrackPublished`, `TrackUnpublished`, `TrackMuted`, `TrackUnmuted`), e
    evento que chega durante uma queda não chega. Sem esta varredura, voltar de
    uma reconexão deixaria alguém marcado como ao vivo depois de ter parado, ou
    — pior — ninguém marcado com alguém transmitindo, e o alvo "Assistir"
    simplesmente não existiria.

    É o mesmo motivo pelo qual `publicarFontes` varre a sala inteira em vez de
    somar e subtrair: reconexão é justamente quando o incremental diverge.
  */
  r.on(RoomEvent.Reconnected, () => {
    definirChamada({ estado: "dentro", participantes: participantesDe(r) });
    publicarFontes(r);
    /*
      ⚠ **E as fontes LOCAIS junto — `publicarFontes` varre só os remotos.**

      O raciocínio do comentário acima vale igual para o seu lado e não estava
      sendo aplicado: durante uma queda o LiveKit republica as suas faixas, e
      o `MediaStreamTrack` que volta costuma ser outro OBJETO. Sem esta
      varredura, `faixasDeVideo` seguia apontando para o anterior — morto — e
      a sua própria prévia ficava congelada no último quadro de antes da
      queda, no ladrilho da grade e no palco do popout.

      E os dois booleanos vão junto: se o compartilhamento não sobreviveu à
      queda, `chamada.tela` continuaria `true` e a interface afirmaria que
      você está transmitindo quando não está — que é a mesma classe de mentira
      que a varredura dos remotos existe para evitar.
    */
    rescanearFontesLocais(r.localParticipant);
  });

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

  r.on(RoomEvent.ParticipantConnected, () => {
    publicar();
    publicarFontes(r);
  });
  /*
    ⚠ **Sair da sala é diferente de parar de transmitir, e só o segundo estava
    tratado.**

    `TrackUnpublished` devolve quem assiste para a grade quando a pessoa PARA
    — mas quando ela cai, a garantia passa a depender da ordem e da chegada
    desses eventos, que numa queda de rede é justamente o que não se pode
    assumir. Sem isto, o palco ficava em "assistindo fulano" com fulano fora
    da sala: quadro congelado, sem aviso, e sem forma de saber que acabou.

    Apagar as faixas dela aqui tem a mesma razão — `TrackUnsubscribed` faz
    isso no caminho feliz, e este é o caminho em que ele pode não vir.
  */
  r.on(RoomEvent.ParticipantDisconnected, (participante) => {
    publicar();
    publicarFontes(r);

    faixasDeVideo.apagar(chaveDeVideo(participante.identity, "tela"));
    faixasDeVideo.apagar(chaveDeVideo(participante.identity, "camera"));

    const palco = lerPalco();
    if (palco.tipo === "assistindo" && palco.userId === participante.identity) {
      definirPalco({ tipo: "grade" });
    }
  });

  /*
    ⚠ **Quem para a transmissão pode não ser o Vortex, e sem isto o app
    continuava afirmando que você estava ao vivo.**

    O Chrome desenha a própria barra — "está compartilhando sua tela · Parar de
    compartilhar" — e o Electron, o macOS e o Wayland têm as suas. Clicar ali
    encerra a faixa por fora: o LiveKit despublica e avisa, e o nosso store não
    ouvia. O botão ficava aceso, o selo de AO VIVO ficaria aceso, e o palco
    seguiria mostrando a última prévia.

    É o modo de falha que este projeto classifica como pior que a ausência: a
    interface afirmando o contrário do que está acontecendo, na pergunta de
    maior consequência que uma chamada tem — "a minha tela está sendo vista?".
  */
  /*
    ⚠ **Este é o caminho em que `alternarTela` NÃO roda**, e por isso ele
    precisa apagar a faixa do store por conta própria: parar de transmitir pelo
    botão do NAVEGADOR (ou do sistema operacional) despublica a faixa sem
    passar pela nossa função. Sem esta limpeza o store guardaria uma faixa já
    encerrada, e o ladrilho da grade e o palco do popout continuariam
    desenhando um `<video>` congelado no último quadro de uma transmissão que
    acabou — pior que o xadrez, porque parece que ainda está no ar.
  */
  r.on(RoomEvent.LocalTrackUnpublished, (pub) => {
    const local = r.localParticipant;
    if (pub.source === Track.Source.ScreenShare) {
      definirChamada({ tela: false, telaPausada: false, telaAudio: "sem" });
      /*
        ⚠ A escolha de qualidade morre com a FAIXA, e é aqui que ela morre nos
        dois caminhos — o nosso e o do botão do navegador. A janela que
        suportava 1080p60 pode ser uma aba de 720p na vez seguinte, e o menu
        abriria marcando um degrau que a faixa nova nunca recebeu. Mesma razão
        do `limpar()` do store efêmero.
      */
      esquecerQualidadeDaTela();
      publicarVideoLocal(local, "tela", Track.Source.ScreenShare, false);
      /*
        ⚠ **Volta para a GRADE, e não fecha — regressão da mudança de
        arquitetura, corrigida aqui.** Enquanto o palco era sobreposição,
        `fecharPalco()` significava "tira essa camada da frente do app" e era
        a coisa certa. Com a sala ocupando a coluna de conteúdo, "fechado"
        passou a significar "sai da sala e mostra o chat do canal": parar de
        transmitir expulsava a pessoa da chamada que ela continua ouvindo.

        Só age se o palco mostrava a SUA transmissão — quem parou de
        transmitir pode continuar assistindo alguém.
      */
      if (lerPalco().tipo === "transmitindo") definirPalco({ tipo: "grade" });
      return;
    }
    if (pub.source === Track.Source.Camera) {
      definirChamada({ camera: false });
      /* Mesma limpeza, e a câmera tinha o mesmo furo — só era menos visível
         porque desligar a câmera quase sempre passa por `alternarCamera`. */
      publicarVideoLocal(local, "camera", Track.Source.Camera, false);
    }
  });

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
  r.on(RoomEvent.TrackSubscribed, (faixa: RemoteTrack, pub, participante) => {
    if (faixa.kind === Track.Kind.Audio) {
      elementoDeAudio().appendChild(faixa.attach());
      return;
    }

    /*
      Video vai para o STORE, e nao para um elemento fora da arvore.

      ⚠ A diferenca com o audio nao e estilo: audio nao tem lugar na tela e
      precisa tocar mesmo com a superficie fechada; video so existe DENTRO de
      um ladrilho, e e o ladrilho que decide quando anexar. Anexar aqui daria
      um `<video>` orfao decodificando quadros que ninguem ve - o custo exato
      que `autoSubscribe: false` foi instalado para nao pagar.
    */
    const fonte = fonteDe(pub.source);
    if (!fonte) return;
    faixasDeVideo.set(
      chaveDeVideo(participante.identity, fonte),
      faixa.mediaStreamTrack,
    );
  });

  r.on(RoomEvent.TrackUnsubscribed, (faixa: RemoteTrack, pub, participante) => {
    if (faixa.kind === Track.Kind.Audio) {
      faixa.detach().forEach((el) => el.remove());
      return;
    }
    const fonte = fonteDe(pub.source);
    if (fonte) faixasDeVideo.apagar(chaveDeVideo(participante.identity, fonte));
  });

  /*
    Quem publica o que.

    ⚠ **Assina so AUDIO, e o video continua entrando sob pedido.** O que mudou
    e que agora existe quem PECA: a grade e a tela de assistir chamam
    `assinarVideo`. Baixar camera de dez pessoas ao entrar continua sendo
    desperdicio puro - o design diz a mesma coisa em prosa: "quem entra no
    canal depois ve o stream com um clique, nao recebe nada automaticamente".

    O que a publicacao faz e ANUNCIAR: sem estas duas listas, uma sala onde
    alguem esta ao vivo seria indistinguivel de uma sala vazia, porque com
    `autoSubscribe: false` "existe stream" e "tenho o stream" sao fatos
    diferentes.
  */
  r.on(RoomEvent.TrackPublished, (pub, participante) => {
    if (pub.kind === Track.Kind.Audio) pub.setSubscribed(true);
    publicarFontes(r);
    void participante;
  });

  /*
    Mudo de outra pessoa.

    ⚠ **Estes dois eventos existem porque `TrackPublished` não cobre o caso.**
    Silenciar não despublica a faixa — ela continua lá, muda. Sem ouvir isto, o
    ícone de microfone cortado da grade só apareceria para quem entrou
    silenciado e nunca mais mudaria.
  */
  r.on(RoomEvent.TrackMuted, () => publicarFontes(r));
  r.on(RoomEvent.TrackUnmuted, () => publicarFontes(r));

  r.on(RoomEvent.TrackUnpublished, (pub, participante) => {
    const fonte = fonteDe(pub.source);
    if (fonte) faixasDeVideo.apagar(chaveDeVideo(participante.identity, fonte));
    publicarFontes(r);

    /*
      ⚠ **Quem voce esta assistindo pode parar, e o palco ficaria congelado no
      ultimo quadro sem dizer nada.** Voltar para a grade e o que o design
      chama de "parar de assistir volta para a grade sem sair da chamada" - e
      aqui nao foi voce que parou.
    */
    const p = lerPalco();
    if (
      p.tipo === "assistindo" &&
      p.userId === participante.identity &&
      pub.source === Track.Source.ScreenShare
    ) {
      definirPalco({ tipo: "grade" });
    }
  });
}

/** A fonte do LiveKit no vocabulario do app, ou nada quando nao interessa. */
function fonteDe(fonte: Track.Source): FonteDeVideo | undefined {
  if (fonte === Track.Source.Camera) return "camera";
  if (fonte === Track.Source.ScreenShare) return "tela";
  return undefined;
}

/**
 * Republica quem esta com camera e quem esta transmitindo.
 *
 * ⚠ **Varre a sala inteira em vez de somar e subtrair por evento.** A lista e
 * de participantes de uma sala de voz - dezenas no pior caso -, e a soma
 * incremental e onde nasce o estado que diverge: um `TrackUnpublished` perdido
 * durante uma reconexao deixaria alguem marcado como ao vivo para sempre. A
 * varredura e O(n) sobre um n pequeno e nao tem como derivar.
 *
 * ⚠ **Compara por CONTEUDO antes de publicar.** Sem isso, cada publicacao
 * emitiria um array novo e acordaria todo mundo que assina a chamada - o
 * cartao, a faixa, o painel de usuario - a cada vez que alguem ligasse a
 * camera. E a armadilha nº 1 do briefing, na forma de lista.
 */
function publicarFontes(r: Room): void {
  const transmitindo: string[] = [];
  const comCamera: string[] = [];
  const mudos: string[] = [];

  for (const p of r.remoteParticipants.values()) {
    if (p.getTrackPublication(Track.Source.ScreenShare)) {
      transmitindo.push(p.identity);
    }
    if (p.getTrackPublication(Track.Source.Camera)) comCamera.push(p.identity);
    /*
      ⚠ **Sem publicação de microfone TAMBÉM conta como mudo**, e não é
      detalhe: quem entra silenciado nunca publica a faixa, então perguntar só
      pelo `isMuted` da publicação existente deixaria a pessoa mais silenciosa
      da sala como a única sem o ícone.
    */
    const mic = p.getTrackPublication(Track.Source.Microphone);
    if (!mic || mic.isMuted) mudos.push(p.identity);
  }

  const atual = lerChamada();
  const mudanca: { -readonly [K in keyof Chamada]?: Chamada[K] } = {};
  if (!mesmaLista(atual.transmitindo, transmitindo)) {
    mudanca.transmitindo = transmitindo;
  }
  if (!mesmaLista(atual.comCamera, comCamera)) mudanca.comCamera = comCamera;
  if (!mesmaLista(atual.mudos, mudos)) mudanca.mudos = mudos;
  if (Object.keys(mudanca).length > 0) definirChamada(mudanca);
}

function mesmaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Quantas superfícies querem cada faixa de vídeo, por `usuário:fonte`.
 *
 * ⚠ **Existe porque DUAS telas pedem a mesma faixa, e quem soltava primeiro
 * derrubava a de quem estava chegando.** O ladrilho da grade e a tela de
 * assistir assinam o mesmo `(usuário, tela)`; trocar de uma para a outra
 * desmonta a primeira e monta a segunda no MESMO commit do React, então saía
 * `setSubscribed(false)` seguido de `setSubscribed(true)` no mesmo tique.
 *
 * O que isso produzia, e foi relatado por quem usa: clicar em "Assistir"
 * deixava a tela em "pedindo o vídeo…" para sempre, e voltar para a grade
 * deixava o ladrilho só com o avatar. Os dois pelo mesmo motivo — `apagar()`
 * roda na hora, e o `TrackSubscribed` que repovoaria o store depende de o
 * servidor REENTREGAR a faixa. Ele recebe as duas mensagens juntas, termina no
 * estado assinado, e não tem por que entregar de novo.
 *
 * Com a contagem, a troca de dono nunca chega a zero e o servidor não é
 * consultado: a faixa que já está descendo continua descendo.
 */
const assinantesDeVideo = new Map<string, number>();

/**
 * Devoluções agendadas, por `usuário:fonte`.
 *
 * ⚠ Sem elas a contagem não resolve nada na troca de tela, porque o React
 * desmonta antes de montar e a contagem toca zero no caminho. Ver `assinarVideo`.
 */
const liberacoesPendentes = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * O que está de fato assinado NO TRANSPORTE.
 *
 * ⚠ **Separado da contagem, e o teste é que exigiu.** A contagem responde
 * "quantas telas querem"; esta responde "o servidor já está mandando". Elas
 * divergem exatamente durante a devolução adiada — ninguém quer, e a faixa
 * continua descendo — e é aí que a troca de tela acontece.
 *
 * Sem a distinção, o consumidor que chega vê a contagem em zero, conclui que
 * precisa assinar, e manda um segundo `setSubscribed(true)`. Medido no teste:
 * `[true, true]` onde devia sair `[true]`.
 */
const assinadoNoTransporte = new Set<string>();

/**
 * Pede (ou devolve) a faixa de video de uma pessoa.
 *
 * ⚠ **E a unica porta para video remoto, e ela e EXPLICITA por decisao de
 * custo.** Com `autoSubscribe: false` nada de video desce sozinho; quem quer
 * ver chama isto e, ao desmontar, chama de novo com `false`. Uma grade que
 * assinasse e esquecesse de devolver deixaria dez faixas descendo atras de uma
 * tela fechada - o desperdicio que a decisao original evita, com a agravante
 * de ser invisivel.
 *
 * Devolve `false` quando nao ha o que assinar: a pessoa saiu, ou nunca
 * publicou aquela fonte.
 */
export function assinarVideo(
  userId: string,
  fonte: FonteDeVideo,
  sim: boolean,
): boolean {
  const pub = publicacaoDeVideo(userId, fonte);
  if (!pub) return false;

  const chave = chaveDeVideo(userId, fonte);
  const depois = Math.max(
    0,
    (assinantesDeVideo.get(chave) ?? 0) + (sim ? 1 : -1),
  );
  if (depois === 0) assinantesDeVideo.delete(chave);
  else assinantesDeVideo.set(chave, depois);

  /*
    Só fala com o servidor nas BORDAS: do zero para um, e de um para zero.
    No meio, a troca de dono não é assunto dele.

    ⚠ **A borda de descida é ADIADA, e a contagem sozinha não bastava.** O
    React roda a limpeza do que sai ANTES do efeito do que entra — mesmo no
    mesmo commit —, então trocar a grade pela tela de assistir passa por zero
    de qualquer jeito, e o `setSubscribed(false)` sai. Com a espera, o pedido
    do consumidor que está chegando cancela a devolução do que saiu, e o
    servidor não chega a ser consultado.

    250 ms porque a troca é de um quadro e a conta é assimétrica: segurar uma
    faixa por um quarto de segundo a mais é banda desprezível, e soltá-la cedo
    demais é o defeito relatado — "pedindo o vídeo…" que nunca resolve.
  */
  const adiado = liberacoesPendentes.get(chave);
  if (adiado !== undefined) {
    clearTimeout(adiado);
    liberacoesPendentes.delete(chave);
  }

  if (sim) {
    if (!assinadoNoTransporte.has(chave)) {
      assinadoNoTransporte.add(chave);
      pub.setSubscribed(true);
    }
  } else if (depois === 0) {
    liberacoesPendentes.set(
      chave,
      setTimeout(() => {
        liberacoesPendentes.delete(chave);
        /* Alguém pode ter voltado a querer entre o agendamento e agora. */
        if ((assinantesDeVideo.get(chave) ?? 0) > 0) return;
        assinadoNoTransporte.delete(chave);
        publicacaoDeVideo(userId, fonte)?.setSubscribed(false);
        faixasDeVideo.apagar(chave);
      }, 250),
    );
  }

  /*
    ⚠ **Repovoa o store quando JÁ estava assinado, e sem isto a contagem não
    bastaria.** `TrackSubscribed` é a única porta de entrada de
    `faixasDeVideo`, e ele é um evento de CHEGADA: assinar algo que já chegou
    não o dispara de novo. O segundo consumidor montaria com o store certo por
    acaso — porque o primeiro o preencheu — e com o store VAZIO sempre que ele
    fosse o primeiro a montar depois de uma limpeza.

    A faixa já está na publicação; escrevê-la aqui é ler o que existe, não
    inventar estado.
  */
  const faixa = sim ? pub.track?.mediaStreamTrack : undefined;
  if (faixa) faixasDeVideo.set(chave, faixa);

  return true;
}

/**
 * A qualidade que se aceita receber de um stream.
 *
 * ⚠ **`soAudio` e `setEnabled(false)`, e nao uma resolucao menor.** O design
 * chama de "So audio" e diz para que serve: rede ruim. `setEnabled(false)`
 * manda o servidor PARAR de enviar aquela faixa, que e a unica coisa que
 * realmente devolve banda; pedir 180p continuaria baixando video.
 */
export type QualidadeDeStream = "auto" | "alta" | "media" | "soAudio";

export function definirQualidadeDeStream(
  userId: string,
  fonte: FonteDeVideo,
  qualidade: QualidadeDeStream,
): void {
  const pub = publicacaoDeVideo(userId, fonte);
  if (!pub) return;

  if (qualidade === "soAudio") {
    pub.setEnabled(false);
    return;
  }
  pub.setEnabled(true);
  /*
    `auto` volta ao teto ALTO de propósito: o LiveKit ja degrada sozinho
    quando a banda nao sustenta, e o que "automatica" promete e justamente
    nao ter teto imposto por voce. Fixar MEDIUM em "auto" seria pedir 720p
    para sempre e chamar isso de automatico.
  */
  pub.setVideoQuality(
    qualidade === "media" ? VideoQuality.MEDIUM : VideoQuality.HIGH,
  );
}

/**
 * O volume de UMA pessoa, so para voce.
 *
 * `0` e o "silenciar so para mim" do design. Vale de 0 a 2 no LiveKit (200% no
 * desenho), e o ganho acima de 1 e o que salva quem fala baixo.
 */
export function definirVolumeDe(userId: string, volume: number): void {
  const p = participanteRemoto(userId);
  p?.setVolume(volume, Track.Source.Microphone);
  p?.setVolume(volume, Track.Source.ScreenShareAudio);
}

export function volumeDe(userId: string): number {
  return participanteRemoto(userId)?.getVolume(Track.Source.Microphone) ?? 1;
}

function participanteRemoto(userId: string): RemoteParticipant | undefined {
  for (const p of sala?.remoteParticipants.values() ?? []) {
    if (p.identity === userId) return p;
  }
  return undefined;
}

function publicacaoDeVideo(
  userId: string,
  fonte: FonteDeVideo,
): RemoteTrackPublication | undefined {
  const p = participanteRemoto(userId);
  if (!p) return undefined;
  return p.getTrackPublication(
    fonte === "camera" ? Track.Source.Camera : Track.Source.ScreenShare,
  );
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
    /*
      ⚠ **DESCONECTA a sala, e não só limpa o store — o caminho de falha
      deixava você conectado de verdade.**

      A primeira leitura deste defeito foi errada e vale registrar: eu supus
      que `joinCall` registrava a presença no servidor e que sobrava um
      fantasma sem conserto, porque o protocolo não tem rota de saída. A fonte
      desmente — `crates/delta/src/routes/channels/voice_join.rs` só emite um
      TOKEN. Quem registra presença é o webhook do LiveKit.

      Ou seja: se você aparece na sala depois de "não deu para entrar", é
      porque `r.connect()` DEU CERTO e o que estourou foi o passo seguinte —
      abrir o microfone, por exemplo, que falha quando o navegador nega o
      dispositivo. E o `catch` largava `sala` conectada: presença real, áudio
      real, com o app se dando por fora. Medido em navegador: "1 na sala" ao
      lado do toast de falha.

      `sairDaChamada` desconecta, solta os ouvintes e limpa o store; o LiveKit
      avisa o servidor e o `VoiceChannelLeave` chega pelo caminho normal. Como
      ela volta cedo quando não houve sala, o `encerrarChamada` fica depois —
      para o caso de a falha ter sido ANTES de a sala existir.
    */
    await sairDaChamada();
    encerrarChamada();
    /*
      E a remoção local logo em seguida, para a coluna não mostrar você dentro
      da sala durante a ida e volta do webhook. É otimista como a reação: se um
      `VoiceChannelJoin` atrasado ainda estiver a caminho, o `Leave` que vem
      atrás dele corrige — o estado converge em vez de ficar mentindo.
    */
    sairDaSalaLocalmente(channelId);
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
  /*
    Lido ANTES de `encerrarChamada`, que zera o store — depois dela não há
    mais de qual canal sair.
  */
  const canalId = lerChamada().channelId;
  sala = undefined;
  pararDeOuvirPreferencias?.();
  pararDeOuvirPreferencias = undefined;
  if (!r) return;
  r.removeAllListeners();
  await r.disconnect();
  encerrarChamada();

  /*
    ⚠ **A saída limpa a CHAMADA e esquecia a SALA, e o fantasma ficava na
    coluna.** `encerrarChamada` zera o store da chamada — faixa e cartão sumem
    —, mas a lista de quem está dentro do canal de voz é outro store, e
    ninguém a tocava. Medido: dez segundos depois de sair, a coluna ainda
    mostrava `sonda_anexo · com o microfone desligado` dentro da "Sala do
    time"; só um F5 limpava.

    ⚠ **E o servidor estava certo o tempo todo** — depois de recarregar a sala
    aparecia vazia. Ou seja o webhook do LiveKit funciona e o `Ready` traz a
    verdade; o que faltava era o cliente não mentir no intervalo.

    Otimista, como a reação: se um `VoiceChannelLeave` vier atrás, ele diz a
    mesma coisa. É exatamente o que o caminho de FALHA já fazia desde que
    entrar na chamada parou de falhar calado — faltava a metade de sucesso,
    que é a que acontece todo dia.
  */
  if (canalId !== "") sairDaSalaLocalmente(canalId);
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
    publicarVideoLocal(p, "camera", Track.Source.Camera, camera);
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
      definirChamada({ tela: false, telaPausada: false, telaAudio: "sem" });
      publicarVideoLocal(p, "tela", Track.Source.ScreenShare, false);
      /* Mesma correção do handler de `LocalTrackUnpublished`: a sala é o
         conteúdo do canal, então parar de transmitir volta para a grade em
         vez de sair dela. */
      if (lerPalco().tipo === "transmitindo") definirPalco({ tipo: "grade" });
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
    definirChamada({
      tela: true,
      telaPausada: false,
      /* A faixa de áudio só existe quando a pessoa marcou a caixa no seletor
         do sistema — e nem toda plataforma oferece a caixa. Perguntar é a
         única forma de saber; supor produziria um "silenciado" para quem
         nunca teve som nenhum. */
      telaAudio:
        p.getTrackPublication(Track.Source.ScreenShareAudio) === undefined
          ? "sem"
          : "ligado",
    });
    /*
      ⚠ **A faixa local de TELA no store, e ela NUNCA esteve lá.**

      `publicarVideoLocal` era chamado só para a câmera, então
      `faixasDeVideo` conhecia a sua webcam e não o seu compartilhamento. Todo
      consumidor que lê o store — o ladrilho da grade e o palco do popout —
      procurava `chaveDeVideo(voce, "tela")` e não achava nada, exibindo o
      xadrez de "ainda não chegou" para uma faixa que estava publicada e
      rodando. Sem erro nenhum: `undefined` é o mesmo valor de "esta pessoa
      não está transmitindo".

      A prancha escapava porque tem um caminho PRÓPRIO (`faixaDeTela()`, um
      getter direto no `localParticipant`) — e é exatamente o segundo caminho
      que o comentário de `publicarVideoLocal` diz existir para evitar. Ele
      mascarou a ausência: a única tela onde a própria transmissão aparecia
      era a única que não usava o store.

      Relatado por quem usa, transmitindo de verdade: "a tela não aparece ali
      na popup".
    */
    publicarVideoLocal(p, "tela", Track.Source.ScreenShare, true);
    /*
      ⚠ **A SALA, e nao a prancha de transmissao.** Comecar a transmitir abria
      `PalcoDeTransmissao` em cima do app inteiro — quem usa relatou a tela
      cheia de HUD com rail, canais e membros desaparecidos, e nenhuma forma de
      voltar sem parar de transmitir.

      O sintoma original que este `definirPalco` resolve continua resolvido: a
      sala mostra a sua tela como PREVIA num ladrilho, com o selo de ao vivo e
      o botao de parar. O que se perdeu foi so a tomada de conta — a prancha
      continua a um clique, pelo ladrilho, para quem quiser o HUD inteiro.
    */
    definirPalco({ tipo: "grade" });
  } catch (e) {
    definirChamada({ tela: false, telaPausada: false, telaAudio: "sem" });
    void ponte?.cancelar();

    /*
      ⚠ **O `catch` engolia TUDO, e com isso falha real e desistência ficavam
      indistinguíveis — para quem usa e para quem depura.**

      A justificativa antiga era verdadeira pela metade: cancelar o seletor do
      sistema de fato cai aqui, e avisar sobre isso seria ruído sobre uma
      decisão que a pessoa acabou de tomar. Mas o mesmo `catch` também pega o
      LiveKit falhando ao PUBLICAR a faixa depois de a captura ter dado certo,
      o codec recusado, e a chamada tendo caído no meio — e nesses o botão
      voltava ao repouso sem uma palavra.

      Medido no painel do navegador, que bloqueia captura: clicar em
      "Compartilhamento de tela" não fazia absolutamente nada. Sem toast, sem
      console, com `aria-pressed` de volta em `false`.

      ⚠ **`NotAllowedError` continua calado, e não é preguiça: o padrão
      conflaciona os dois casos.** Medido — desistir no seletor e ser barrado
      por Permissions Policy produzem o MESMO `DOMException` com o MESMO nome
      e a mensagem "Permission denied". Inventar a diferença seria afirmar na
      tela algo que o navegador não disse, que é o que a faixa de voz recusou
      ao não derivar milissegundos de uma classificação.
    */
    if (e instanceof DOMException && e.name === "NotAllowedError") return;

    toast({
      tipo: "erro",
      titulo: "Não deu para compartilhar a tela.",
      descricao: motivo(e),
    });
  }
}


/**
 * A faixa de vídeo da transmissão, para a prévia local.
 *
 * ⚠ **SÍNCRONA e devolvendo `MediaStreamTrack` cru, e as duas coisas são
 * decisão.** Síncrona porque quem a chama é um efeito de componente, e um
 * `await` ali significaria um render com a caixa vazia antes de cada quadro.
 * Crua porque nada de `livekit-client` sai deste arquivo — a mesma regra que
 * mantém `Room` aqui dentro. O componente recebe um tipo do navegador e não
 * sabe que existe LiveKit.
 */
/**
 * Poe (ou tira) a PROPRIA faixa no mesmo store das alheias.
 *
 * ⚠ **O store guarda "o que um `<video>` precisa", e nao "o que o servidor
 * mandou".** A primeira versao tratava a propria camera como caso especial, com
 * um componente proprio lendo a faixa por `setTimeout` — e isso era um segundo
 * caminho para a mesma coisa, com a propria latencia e o proprio bug. Com uma
 * fonte so, o ladrilho da grade nao sabe de quem e o video.
 *
 * ⚠ **`setCameraEnabled` resolve antes de a publicacao existir em alguns
 * navegadores**, e por isso ha uma segunda tentativa. Sem ela o proprio
 * ladrilho ficaria no avatar ate o proximo render — a mesma armadilha da
 * previa da transmissao medindo 0×0.
 */
/**
 * O que VOCÊ está publicando de fato, relido do LiveKit.
 *
 * Pergunta à publicação em vez de acreditar no store — é o mesmo princípio de
 * `publicarFontes`, que relê os remotos em vez de somar e subtrair. Reconexão
 * é justamente quando o incremental diverge.
 */
function rescanearFontesLocais(p: LocalParticipant): void {
  const camera = p.getTrackPublication(Track.Source.Camera) !== undefined;
  const tela = p.getTrackPublication(Track.Source.ScreenShare) !== undefined;

  definirChamada({ camera, tela });
  publicarVideoLocal(p, "camera", Track.Source.Camera, camera);
  publicarVideoLocal(p, "tela", Track.Source.ScreenShare, tela);
}

function publicarVideoLocal(
  p: LocalParticipant,
  fonte: FonteDeVideo,
  origem: Track.Source,
  ligado: boolean,
): void {
  const chave = chaveDeVideo(p.identity, fonte);
  if (!ligado) {
    faixasDeVideo.apagar(chave);
    return;
  }

  const por = () => {
    const faixa = p.getTrackPublication(origem)?.track?.mediaStreamTrack;
    if (faixa) faixasDeVideo.set(chave, faixa);
    return faixa !== undefined;
  };
  if (!por()) setTimeout(por, 600);
}

/**
 * O que a transmissão está REALMENTE entregando.
 *
 * ⚠ **Medido no `RTCStatsReport`, e não derivado do que se pediu.** O design
 * desenha "1080p · 30 fps · 4.2 Mbps" e, ao lado, "△ rede caiu para 22 fps" —
 * as duas frases só fazem sentido juntas se a segunda puder DESMENTIR a
 * primeira. Mostrar a taxa pedida nos dois lugares daria um aviso que nunca
 * acende, que é pior que não ter aviso.
 *
 * É a mesma recusa que impediu a faixa de voz de derivar "42 ms" de uma
 * classificação — com a diferença de que aqui o número existe.
 *
 * ⚠ **A banda é DELTA entre duas amostras**, e por isso a primeira chamada
 * devolve `kbps: undefined`: `bytesSent` é um acumulador desde o início da
 * conexão, e dividi-lo pelo tempo total daria a média da sessão inteira em vez
 * do que está saindo agora. Quem chama sabe pedir de novo.
 */
type AmostraDeTela = { bytes: number; em: number };
let amostraAnterior: AmostraDeTela | undefined;

export async function estatisticasDaTela(): Promise<
  { fps: number | undefined; kbps: number | undefined } | undefined
> {
  const faixa = sala?.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  )?.track;
  if (!faixa) {
    amostraAnterior = undefined;
    return undefined;
  }

  const relatorio = await faixa.getRTCStatsReport();
  if (!relatorio) return undefined;

  let fps: number | undefined;
  let bytes: number | undefined;

  relatorio.forEach((entrada: unknown) => {
    const e = entrada as {
      type?: string;
      kind?: string;
      framesPerSecond?: number;
      bytesSent?: number;
    };
    if (e.type !== "outbound-rtp" || e.kind !== "video") return;
    /*
      Com simulcast há uma entrada por camada. Somar os bytes é o certo — é
      tudo o que sai desta máquina —, e para os quadros vale a MAIOR: a camada
      de menor resolução costuma andar mais devagar, e a média entre elas não
      descreve nada que alguém esteja vendo.
    */
    if (e.framesPerSecond !== undefined) {
      fps = Math.max(fps ?? 0, e.framesPerSecond);
    }
    if (e.bytesSent !== undefined) bytes = (bytes ?? 0) + e.bytesSent;
  });

  let kbps: number | undefined;
  const agora = Date.now();
  if (bytes !== undefined) {
    const anterior = amostraAnterior;
    if (anterior && agora > anterior.em && bytes >= anterior.bytes) {
      const segundos = (agora - anterior.em) / 1000;
      kbps = Math.round(((bytes - anterior.bytes) * 8) / segundos / 1000);
    }
    amostraAnterior = { bytes, em: agora };
  }

  return { fps: fps === undefined ? undefined : Math.round(fps), kbps };
}

export function faixaDeTela(): MediaStreamTrack | undefined {
  const pub = sala?.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  );
  return pub?.track?.mediaStreamTrack;
}

/**
 * Pausa ou retoma a transmissão.
 *
 * ⚠ **`mute()` da faixa, e não `setScreenShareEnabled(false)`.** O segundo
 * DESPUBLICA: quem assiste perde a caixa, e voltar exigiria escolher a fonte
 * outra vez, com o seletor do sistema abrindo de novo. `mute` congela a
 * imagem no último quadro e mantém o lugar — que é o que "pausar" promete.
 */
export async function pausarTela(pausar: boolean): Promise<void> {
  const faixa = sala?.localParticipant.getTrackPublication(
    Track.Source.ScreenShare,
  )?.track;
  if (!faixa) return;

  if (pausar) await faixa.mute();
  else await faixa.unmute();
  definirChamada({ telaPausada: pausar });
}

/**
 * Liga e desliga o áudio que acompanha a tela.
 *
 * Sem faixa de áudio não há o que alternar — e o controle na tela precisa
 * saber disso para se desabilitar em vez de fingir. Ver `Chamada.telaAudio`.
 */
export async function alternarAudioDaTela(): Promise<void> {
  const pub = sala?.localParticipant.getTrackPublication(
    Track.Source.ScreenShareAudio,
  );
  const faixa = pub?.track;
  if (!faixa) return;

  const ligando = faixa.isMuted;
  if (ligando) await faixa.unmute();
  else await faixa.mute();
  definirChamada({ telaAudio: ligando ? "ligado" : "mudo" });
}

/**
 * Troca a fonte sem sair do ar mais do que o necessário.
 *
 * ⚠ **Para e recomeça, e não há caminho melhor.** Nem `getDisplayMedia` nem o
 * LiveKit permitem trocar a fonte de uma faixa publicada; o que existe é
 * capturar outra e substituir. Fazer isso em dois passos explícitos deixa o
 * intervalo visível para quem assiste — melhor que um controle que promete
 * troca contínua e entrega o mesmo corte.
 */
export async function trocarFonteDaTela(): Promise<void> {
  if (!lerChamada().tela) return;
  await alternarTela();
  await alternarTela();
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

/**
 * O RTT da conexão de voz, do `RTCStatsReport`.
 *
 * ⚠ **Medido e nunca derivado.** `ConnectionQuality` do LiveKit é
 * CLASSIFICAÇÃO (`excellent/good/poor/lost`), e a faixa de voz já recusou
 * transformá-la em "42 ms" — dado falso numa superfície onde alguém decide se
 * troca de rede. `currentRoundTripTime` existe de verdade no par de
 * candidatos, e é ele ou `undefined`.
 *
 * ⚠ **Só o par NOMINADO.** Um `RTCPeerConnection` guarda o histórico de todos
 * os pares testados durante o ICE, inclusive os que perderam; ler qualquer um
 * daria o RTT de um caminho que não está sendo usado.
 */
export async function estatisticasDeVoz(): Promise<number | undefined> {
  const engine = (
    sala as unknown as {
      engine?: { pcManager?: { publisher?: { getStats?: () => Promise<RTCStatsReport> } } };
    }
  )?.engine;
  const obter = engine?.pcManager?.publisher?.getStats;
  if (!obter) return undefined;

  let relatorio: RTCStatsReport;
  try {
    relatorio = await obter.call(engine.pcManager?.publisher);
  } catch {
    /* A conexão pode fechar entre a decisão de medir e a medição. Sem chamada
       não há RTT, e isso não é erro. */
    return undefined;
  }

  let ms: number | undefined;
  relatorio.forEach((entrada: unknown) => {
    const e = entrada as {
      type?: string;
      nominated?: boolean;
      state?: string;
      currentRoundTripTime?: number;
    };
    if (e.type !== "candidate-pair") return;
    if (e.nominated !== true && e.state !== "succeeded") return;
    if (e.currentRoundTripTime === undefined) return;
    ms = Math.round(e.currentRoundTripTime * 1000);
  });
  return ms;
}

/**
 * Troca resolução e taxa de quadros SEM parar de transmitir.
 *
 * ⚠ **`applyConstraints` na faixa, e NÃO `restartTrack` nem republicar.** O
 * `depende` desta pendência dizia que trocar hoje era "parar e recomeçar", e a
 * afirmação estava certa sobre `setScreenShareEnabled` — que só lê as
 * constraints na PUBLICAÇÃO — e errada sobre o resto. Duas alternativas foram
 * lidas no código do SDK antes desta:
 *
 * - `LocalVideoTrack.restartTrack()` existe e serve para CÂMERA: ele chama
 *   `restart()`, que refaz a captura por `getUserMedia`. Numa faixa de tela
 *   isso pediria a câmera no lugar do que está sendo transmitido.
 * - Republicar mostraria de novo o seletor de janela do navegador, e a pessoa
 *   teria de reescolher o que já estava compartilhando.
 *
 * `applyConstraints` age sobre o `MediaStreamTrack` que já está no ar: mesma
 * faixa, mesma publicação, mesmos assinantes, sem renegociação e sem prompt.
 *
 * ⚠ **`ideal` e nunca `exact`.** Com `exact`, uma tela de 1366×768 recusaria
 * 1080p com `OverconstrainedError` — e o erro chegaria como "não deu para
 * trocar" numa escolha que o navegador teria atendido em 768p de bom grado. O
 * teto é um pedido; quem decide o que a fonte entrega é o sistema.
 */
export async function definirQualidadeDaTela(
  id: QualidadeDaTela,
): Promise<boolean> {
  const faixa = faixaDeTela();
  const constraints = constraintsDe(id);
  if (!faixa || !constraints) return false;

  try {
    await faixa.applyConstraints(constraints);
    return true;
  } catch {
    /* A faixa pode ter terminado entre a escolha e a aplicação — parar de
       compartilhar pela barra do navegador faz exatamente isso. Sem
       transmissão não há qualidade a trocar, e isso não é erro. */
    return false;
  }
}

/**
 * O que a faixa está entregando AGORA, medido — nunca o que foi pedido.
 *
 * ⚠ `getSettings()` e não a constraint guardada: a fonte decide. Pedir 1080p
 * de uma janela de 900px devolve 900, e mostrar "1080p" ali seria a mesma
 * mentira do "Conectado · 42 ms" que a faixa de voz recusou.
 */
export function qualidadeRealDaTela():
  | { altura: number; fps: number }
  | undefined {
  const s = faixaDeTela()?.getSettings();
  if (!s?.height) return undefined;
  return { altura: s.height, fps: Math.round(s.frameRate ?? 0) };
}
