import {
  ArrowsClockwise,
  ArrowsOut,
  ChatCircle,
  Gear,
  ICONE,
  MicrophoneSlash,
  Monitor,
  Pause,
  PictureInPicture,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  VideoCamera,
} from "../components/ui/icones";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import { toast } from "../components/ui/toastStore";
import { aindaNao } from "../pendente/pendencias";
import {
  alternarAudioDaTela,
  alternarTela,
  estatisticasDaTela,
  faixaDeTela,
  pausarTela,
  trocarFonteDaTela,
} from "../sdk/chamada";
import {
  assinarChamada,
  falando,
  lerChamada,
  type AudioDaTela,
} from "../store/chamada";
import { useChannel, usePessoa, useServer } from "../store/hooks";
import { fecharPalco } from "../store/palcoDeVoz";
import { Cronometro, Doca, emTelaCheia, SeloAoVivo } from "./pecasDeVoz";
import css from "./PalcoDeTransmissao.module.css";

/**
 * O palco de quem transmite.
 *
 * ⚠ **Ele existe porque compartilhar a tela não tinha interface NENHUMA.** O
 * botão acendia, a faixa era publicada e o app não mostrava nada: nem prévia,
 * nem selo de ao vivo, nem quanto tempo, nem uma forma de parar que não fosse
 * o mesmo botão minúsculo do cartão. Um app que transmite a sua tela sem te
 * mostrar o que está transmitindo é a definição do modo de falha que este
 * projeto chama de pior que a ausência — só que na pergunta de maior
 * consequência que uma chamada tem.
 *
 * ⚠ **A borda do palco é `danger`, e nunca `accent`.** Vermelho aqui significa
 * "você está ao vivo"; o teal significa "isto está em foco". Trocá-los faria a
 * cor mais alarmante do app dizer a coisa mais banal. É instrução do design e
 * é a disciplina de acento que este projeto já consertou uma vez.
 *
 * ⚠ **Sobre o shell, e não no lugar dele** — como as configurações. A lista de
 * mensagens fica montada atrás, com as linhas medidas e a âncora onde estava;
 * substituir o shell pagaria o custo mais caro do app pela ação mais barata.
 *
 * ⚠ **Fechar o palco NÃO para a transmissão.** São coisas diferentes, e
 * juntá-las faria "quero ver o chat" significar "quero sair do ar". Quem para
 * é o alvo vermelho do HUD, que é o único que diz isso.
 */
export function PalcoDeTransmissao() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(chamada.channelId);
  const servidor = useServer(canal?.serverId ?? "");

  return (
    <>
      <header className={css.cabecalho}>
        <Monitor size={ICONE.controle} className={css.glifoDoCanal} aria-hidden />
        <span className={css.nomeDoCanal}>{canal?.name ?? "voz"}</span>
        <span className={css.nomeDoServidor}>{servidor?.name ?? ""}</span>
        <SeloAoVivo />
        <Cronometro desde={chamada.desde} />
        <span className={css.espaco} />
        <div className={css.acoesDoCabecalho}>
          <Tooltip texto="Voltar ao chat" lado="abaixo">
            <button
              type="button"
              className={css.acaoDoCabecalho}
              aria-label="Voltar ao chat"
              onClick={fecharPalco}
            >
              <ChatCircle size={ICONE.controle} aria-hidden />
            </button>
          </Tooltip>
          <BotaoDePip />
          <Tooltip texto="Tela cheia" lado="abaixo">
            <button
              type="button"
              className={css.acaoDoCabecalho}
              aria-label="Tela cheia"
              onClick={emTelaCheia}
            >
              <ArrowsOut size={ICONE.controle} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </header>

      <div className={css.miolo}>
        <div className={css.esquerda}>
          <Prancha
            pausada={chamada.telaPausada}
            audio={chamada.telaAudio}
            naSala={chamada.participantes.length}
          />

          {/* A fila de participantes. A câmera de quem transmite é um ladrilho
              PRÓPRIO — jamais fundida ao ladrilho de tela, que é instrução do
              design e o que impede "você" de aparecer duas vezes na mesma
              caixa com dois conteúdos diferentes. */}
          <div className={css.fila}>
            {chamada.camera ? (
              <div className={css.ladrilho} data-proprio>
                <VideoCamera size={ICONE.calha} aria-hidden className={css.glifoDoLadrilho} />
                <span className={css.nomeDoLadrilho}>Você · câmera</span>
                <span className={css.selo}>SEPARADO</span>
              </div>
            ) : null}
            {chamada.participantes.map((id) => (
              <LadrilhoDePessoa key={id} userId={id} />
            ))}
          </div>
        </div>

        <NaSala participantes={chamada.participantes} />
      </div>

      <Doca
        mudo={chamada.mudo}
        surdo={chamada.surdo}
        camera={chamada.camera}
        tela
      />
    </>
  );
}

/* ============================================================
   A prancha — prévia, medidas e HUD
   ============================================================ */

/**
 * A prévia local, e ela é a faixa DE VERDADE.
 *
 * ⚠ **`MediaStreamTrack` cru e `srcObject`, sem nada de LiveKit no
 * componente.** A fachada devolve o tipo do navegador; a camada anticorrupção
 * vale para o WebRTC do mesmo jeito que vale para o `stoat.js`.
 *
 * ⚠ **`muted` no `<video>` é obrigatório e não é escolha de conforto.** Sem
 * ele o navegador recusa o autoplay da prévia — e, com áudio de tela
 * capturado, quem transmite ouviria o próprio som de volta com atraso.
 */
function Prancha({
  pausada,
  audio,
  naSala,
}: {
  pausada: boolean;
  audio: AudioDaTela;
  naSala: number;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [medidas, setMedidas] = useState<string | undefined>(undefined);
  const [fonte, setFonte] = useState<string | undefined>(undefined);
  /** O que a captura PEDIU. Comparar com o entregue é o que acende o aviso. */
  const [taxaPedida, setTaxaPedida] = useState<number | undefined>(undefined);
  const entregue = useEntrega(pausada);

  useEffect(() => {
    const faixa = faixaDeTela();
    const el = video.current;
    if (!faixa || !el) return;

    const fluxo = new MediaStream([faixa]);
    el.srcObject = fluxo;

    const ler = () => {
      const s = faixa.getSettings();
      setMedidas(
        s.width && s.height
          ? `${String(s.width)}×${String(s.height)}${
              s.frameRate ? ` · ${String(Math.round(s.frameRate))} fps` : ""
            }`
          : undefined,
      );
      setFonte(rotuloDaFonte(faixa.label));
      setTaxaPedida(s.frameRate === undefined ? undefined : Math.round(s.frameRate));
    };

    /*
      Duas leituras, e a segunda não é redundância. Em Chrome as `settings` da
      captura de tela chegam com 0×0 no primeiro quadro — medir só na
      montagem escreveria "0×0" e ficaria assim para sempre, que é a mesma
      família do anexo que media 0×0 antes de a imagem chegar.
    */
    ler();
    const t = setTimeout(ler, 800);

    return () => {
      clearTimeout(t);
      el.srcObject = null;
    };
  }, []);

  return (
    <div className={css.prancha} data-pausada={pausada}>
      <video
        ref={video}
        className={css.video}
        autoPlay
        muted
        playsInline
        aria-label="Prévia da sua transmissão"
      />

      {/*
        O que o design escreve no meio da prancha, e ele só aparece enquanto
        não há quadro: com a imagem chegando, um texto centralizado por cima
        dela seria ruído permanente sobre o conteúdo que a tela existe para
        mostrar.
      */}
      {medidas === undefined ? (
        <div className={css.placa}>
          <span className={css.placaLinha}>
            sua transmissão{fonte ? ` · ${fonte}` : ""}
          </span>
          <span className={css.placaNota}>prévia local com atraso de ~1 s</span>
        </div>
      ) : null}

      {fonte ? <span className={css.chipDaFonte}>{fonte}</span> : null}

      <div className={css.medidas}>
        {/*
          ⚠ **"na sala", e NUNCA "assistindo".** O design escreve "3
          assistindo", e nem o protocolo do Stoat nem o `livekit-client`
          produzem esse número: quem publica não recebe contagem de
          assinantes — isso é webhook de servidor. Escrever "assistindo" sobre
          a contagem de quem está na sala seria afirmar na tela algo que
          ninguém mediu, na superfície em que a pessoa decide o que deixar
          aparecer. É a mesma recusa que impediu a faixa de voz de derivar "42
          ms" de uma classificação.
        */}
        <span className={css.chip}>
          {naSala === 1 ? "1 na sala" : `${String(naSala)} na sala`}
        </span>
        {medidas ? (
          <span className={css.chip} data-bom>
            <span className={css.pontoBom} aria-hidden />
            {medidas}
            {/*
              A banda, quando ela já pôde ser medida.

              ⚠ **Ela vem de `RTCStatsReport` e é DELTA entre duas amostras** —
              a primeira leitura não tem com o que comparar, e por isso o
              número aparece uns segundos depois em vez de nascer errado.
            */}
            {entregue?.kbps === undefined
              ? null
              : ` · ${formatarBanda(entregue.kbps)}`}
          </span>
        ) : null}
        {pausada ? (
          <span className={css.chip} data-aviso>
            transmissão pausada
          </span>
        ) : null}
        {/*
          ⚠ **O aviso do design — "△ rede caiu para 22 fps" — e ele é MEDIDO.**
          Sem medir, o chip de resolução mostraria a taxa PEDIDA e este mostraria
          a mesma coisa: um aviso que nunca acende, o que é pior que não ter
          aviso. Aqui os quadros entregues saem do `outbound-rtp` e o pedido sai
          das `settings` da captura; a comparação é a única coisa que faz o par
          de chips significar alguma coisa.

          ⚠ **Um terço abaixo, e não qualquer diferença.** Codec descarta
          quadros de tela parada por design — uma apresentação sem movimento
          entrega 3 fps e está perfeita. O corte existe para pegar rede ruim, e
          por isso pede queda GRANDE e um piso absoluto.
        */}
        {aviso(entregue?.fps, taxaPedida, pausada) ? (
          <span className={css.chip} data-aviso>
            rede caiu para {String(entregue?.fps)} fps
          </span>
        ) : null}
      </div>

      {pausada ? (
        <p className={css.avisoDePausa}>
          Pausada — quem assiste vê o último quadro.
        </p>
      ) : null}

      <div className={css.hud}>
        <button
          type="button"
          className={css.parar}
          onClick={() => void alternarTela()}
        >
          {/*
            ⚠ **Duas versões do rótulo, e não uma frase partida.** `.parar` é
            um flex container: um `<span>` com espaço inicial vira item de
            flex e o navegador DESCARTA esse espaço — medido, saía
            "Pararde transmitir". Alternativas completas não têm o problema.
          */}
          <span className={css.rotuloDoHud}>Parar de transmitir</span>
          <span className={css.rotuloCurto}>Parar</span>
        </button>

        <span className={css.divisa} aria-hidden />

        <button
          type="button"
          className={css.itemDoHud}
          aria-pressed={pausada}
          onClick={() => void pausarTela(!pausada)}
        >
          {pausada ? (
            <Play size={ICONE.metadado} aria-hidden />
          ) : (
            <Pause size={ICONE.metadado} aria-hidden />
          )}
          <span className={css.rotuloDoHud}>
            {pausada ? "Retomar" : "Pausar"}
          </span>
        </button>

        <button
          type="button"
          className={css.itemDoHud}
          aria-label="Trocar fonte"
          onClick={() => void trocarFonteDaTela()}
        >
          <ArrowsClockwise size={ICONE.metadado} aria-hidden />
          <span className={css.rotuloDoHud}>Trocar fonte</span>
        </button>

        <BotaoDeAudio audio={audio} />

        <button
          type="button"
          className={css.itemDoHud}
          data-secundario
          aria-label="Qualidade da transmissão"
          onClick={aindaNao("qualidadeDaTransmissao")}
        >
          <Gear size={ICONE.metadado} aria-hidden />
          <span className={css.rotuloDoHud}>Qualidade</span>
        </button>
      </div>
    </div>
  );
}

/**
 * O áudio da fonte.
 *
 * ⚠ **Desabilitado com o motivo, nunca escondido** — é instrução do design, e
 * ela está certa: o navegador só entrega áudio de tela quando a pessoa marca a
 * caixa no seletor do sistema, e Safari e Firefox não oferecem a caixa. Um
 * botão que some faz parecer que o app não tem o recurso; um botão desabilitado
 * que diz por quê ensina onde a escolha foi feita.
 */
function BotaoDeAudio({ audio }: { audio: AudioDaTela }) {
  if (audio === "sem") {
    return (
      <Tooltip texto="Esta fonte foi capturada sem áudio" lado="acima">
        {/* ⚠ `span` em volta: um `button` desabilitado não dispara os eventos
            de ponteiro, então o tooltip do Radix nunca abriria — e o motivo,
            que é a única coisa que separa este estado de um botão quebrado,
            ficaria inalcançável. */}
        <span className={css.envolveDesabilitado}>
          <button
            type="button"
            className={css.itemDoHud}
            data-secundario
            disabled
          >
            <SpeakerSlash size={ICONE.metadado} aria-hidden />
            <span className={css.rotuloDoHud}>Sem áudio</span>
          </button>
        </span>
      </Tooltip>
    );
  }

  const ligado = audio === "ligado";

  return (
    <button
      type="button"
      className={css.itemDoHud}
      /* O nome é do RECURSO e o estado vai no `aria-pressed` — a regra que o
         lint deste projeto já cobrou uma vez nos controles de microfone. */
      aria-label="Áudio da fonte"
      aria-pressed={ligado}
      onClick={() => void alternarAudioDaTela()}
    >
      {ligado ? (
        <SpeakerHigh size={ICONE.metadado} aria-hidden />
      ) : (
        <SpeakerSlash size={ICONE.metadado} aria-hidden />
      )}
      <span className={css.rotuloDoHud}>
        {ligado ? "Áudio ligado" : "Áudio mudo"}
      </span>
    </button>
  );
}

/**
 * Picture-in-picture.
 *
 * Real, e três linhas: o elemento de vídeo já existe e a API é do navegador.
 * ⚠ Nem toda plataforma a tem (Firefox só pelo menu de contexto), então o
 * botão some onde ela não existe — e some porque a alternativa nativa
 * continua ali, ao contrário do áudio de tela, que não tem outra porta.
 */
function BotaoDePip() {
  if (!("pictureInPictureEnabled" in document)) return null;

  return (
    <Tooltip texto="Picture-in-picture" lado="abaixo">
      <button
        type="button"
        className={css.acaoDoCabecalho}
        aria-label="Picture-in-picture"
        onClick={() => {
          const el = document.querySelector("video");
          if (!el) return;
          void el.requestPictureInPicture?.().catch(() => {
            toast({
              tipo: "erro",
              titulo: "Picture-in-picture indisponível.",
              descricao: "O navegador recusou abrir a janela flutuante.",
            });
          });
        }}
      >
        <PictureInPicture size={ICONE.controle} aria-hidden />
      </button>
    </Tooltip>
  );
}

/* ============================================================
   Fila e coluna de quem está na sala
   ============================================================ */

/** Um ladrilho da fila. Assina a PESSOA e a fala — lei nº 1. */
const LadrilhoDePessoa = memo(function LadrilhoDePessoa({
  userId,
}: {
  userId: string;
}) {
  const pessoa = usePessoa(userId);
  const ativo = useSyncExternalStore(
    falando.subscriber(userId),
    () => falando.getSnapshot(userId) ?? false,
  );

  return (
    <div className={css.ladrilho} data-falando={ativo}>
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho="md"
      />
      <span className={css.nomeDoLadrilho}>
        {pessoa?.displayName ?? "alguém"}
      </span>
      {ativo ? <span className="sr-only">falando</span> : null}
    </div>
  );
});

/**
 * A coluna lateral.
 *
 * ⚠ **"Na sala", e o design diz "Espectadores".** A divergência é de DADO, não
 * de desenho: não há como saber quem está assistindo — ver o comentário das
 * medidas. Manter o título do design sobre a lista de quem está na sala seria
 * o pior dos dois mundos, porque a lista PARECE responder a pergunta. A nota
 * do rodapé, que é do design, continua verdadeira e agora explica a diferença.
 */
function NaSala({ participantes }: { participantes: readonly string[] }) {
  return (
    <aside className={css.coluna} aria-label="Quem está na sala">
      <div className={css.cabecalhoDaColuna}>
        <span className={css.tituloDaColuna}>Na sala</span>
        <span className={css.contagem}>{participantes.length}</span>
      </div>

      <div className={css.listaDaColuna}>
        {participantes.map((id) => (
          <LinhaDaSala key={id} userId={id} />
        ))}

        <p className={css.nota}>
          Quem entra no canal depois vê a transmissão com um clique — ninguém
          recebe nada em tela cheia automaticamente. O servidor não informa
          quem está assistindo.
        </p>
      </div>
    </aside>
  );
}

const LinhaDaSala = memo(function LinhaDaSala({ userId }: { userId: string }) {
  const pessoa = usePessoa(userId);
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);

  return (
    <div className={css.linhaDaSala}>
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho="sm"
      />
      <span className={css.nomeNaSala}>{pessoa?.displayName ?? "alguém"}</span>
      {chamada.mudo && userId === chamada.participantes[0] ? (
        <MicrophoneSlash size={ICONE.metadado} className={css.mudo} aria-label="mudo" />
      ) : null}
    </div>
  );
});

/* ============================================================
   Utilitários
   ============================================================ */

/**
 * O que a transmissão está entregando, amostrado a cada 2 s.
 *
 * ⚠ **2 s e não 1, e não é economia de CPU.** `getStats()` é barato; o que
 * custa é a LEITURA humana. A banda de uma captura de tela oscila muito entre
 * segundos — tela parada manda quase nada, uma rolagem manda um pico —, e um
 * número que troca a cada segundo é ruído numa superfície que a pessoa olha de
 * relance para decidir se a apresentação está indo bem.
 *
 * ⚠ **Pausado não amostra**, e nem poderia: com a faixa muda a taxa cai a zero
 * de propósito, e o aviso de rede acenderia sobre uma decisão que a pessoa
 * acabou de tomar.
 */
function useEntrega(pausada: boolean) {
  const [entrega, setEntrega] = useState<
    { fps: number | undefined; kbps: number | undefined } | undefined
  >(undefined);

  useEffect(() => {
    if (pausada) return;
    let vivo = true;
    const ler = () => {
      void estatisticasDaTela().then((e) => {
        if (vivo) setEntrega(e);
      });
    };
    const t = setInterval(ler, 2000);
    ler();
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [pausada]);

  return entrega;
}

/**
 * A rede está entregando menos do que se pediu?
 *
 * Ver o comentário do chip: um terço abaixo E abaixo de 20 fps. Sem o piso
 * absoluto, pedir 60 e entregar 39 acenderia um aviso sobre algo que ninguém
 * percebe.
 */
function aviso(
  entregue: number | undefined,
  pedida: number | undefined,
  pausada: boolean,
): boolean {
  if (pausada) return false;
  if (entregue === undefined || pedida === undefined) return false;
  return entregue < pedida * 0.67 && entregue < 20;
}

/**
 * A banda, como o design escreve: `4.2 Mbps`.
 *
 * ⚠ Abaixo de 1 Mbps fica em kbps, e não vira "0.4 Mbps": numa rede ruim, que
 * é justamente quando alguém olha este número, a casa decimal some e o valor
 * deixa de distinguir uma conexão sofrível de uma morta.
 */
function formatarBanda(kbps: number): string {
  if (kbps < 1000) return `${String(kbps)} kbps`;
  return `${(kbps / 1000).toFixed(1).replace(".", ",")} Mbps`;
}

/**
 * O nome da fonte, do jeito que o navegador o entrega.
 *
 * ⚠ **Cru demais para mostrar.** O Chrome devolve `screen:0:0` para um monitor
 * e `window:12345:0` para uma janela; o Electron devolve o título de verdade.
 * Traduzir os dois formatos técnicos é honesto — inventar o título de uma
 * janela a partir de um id não seria.
 */
function rotuloDaFonte(bruto: string): string | undefined {
  if (!bruto) return undefined;
  if (/^screen:/.test(bruto)) return "tela inteira";
  if (/^window:/.test(bruto)) return "uma janela";
  if (/^web-contents-media-stream:/.test(bruto)) return "uma aba";
  return bruto;
}
