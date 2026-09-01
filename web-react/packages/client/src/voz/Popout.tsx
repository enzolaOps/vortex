import {
  Microphone,
  MicrophoneSlash,
  PhoneX,
  PictureInPicture,
  VideoCamera,
  VideoCameraSlash,
  X,
} from "@phosphor-icons/react";
import {
  memo,
  useEffect,
  useRef,
  useSyncExternalStore,
  type PointerEvent as EventoDePonteiro,
} from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import {
  alternarCamera,
  alternarMudo,
  assinarVideo,
  sairDaChamada,
} from "../sdk/chamada";
import {
  assinarChamada,
  falando,
  lerChamada,
  type Chamada,
} from "../store/chamada";
import { useCanalAtivo, useChannel, usePessoa } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import { definirPalco, type Palco } from "../store/palcoDeVoz";
import {
  assinarPopout,
  definirFormaDoPopout,
  lerPopout,
  moverPopout,
  reiniciarPopout,
} from "../store/popout";
import { Cronometro, FaixaDeVideo } from "./pecasDeVoz";
import { useNaSala } from "./useSalaDeVoz";
import css from "./Popout.module.css";

/**
 * O popout da chamada — as duas formas do design.
 *
 * ⚠ **Ele SUBSTITUI o `CartaoDeChamada`, que era invenção nossa.** O cartão
 * resolvia o problema certo (a chamada precisa continuar visível quando não
 * está na tela) com uma forma que o design não tem: uma caixa com o nome, a
 * lista de participantes por extenso e cinco controles em fileira. O design
 * desenha `420 × (28 + 190 + rodapé)` com MÍDIA no meio e três controles, mais
 * um mínimo de 216px.
 *
 * A diferença não é estética. O cartão DIZIA quem estava na chamada; o popout
 * MOSTRA — e é isso que faz alguém deixá-lo aberto enquanto lê outro canal, em
 * vez de tratá-lo como um aviso a ignorar.
 *
 * ⚠ **Ele some quando a sala está na coluna**, pela mesma razão de sempre: a
 * sala mostra os mesmos participantes, o mesmo cronômetro e os mesmos
 * controles, e o popout flutuaria por cima da lista de membros dando a
 * informação duas vezes. Ver `useNaSala`.
 */
export function Popout() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const popout = useSyncExternalStore(assinarPopout, lerPopout);
  const canal = useChannel(chamada.channelId);
  /*
    ⚠ **O canal ABERTO, e não o da chamada — e a primeira versão passava o da
    chamada.** `useNaSala(id)` pergunta "a sala está ocupando a coluna daquele
    canal?", e ela compara `chamada.channelId === id`: passando o próprio
    `chamada.channelId`, a comparação era o id consigo mesmo, sempre
    verdadeira. O popout então sumia sempre que o palco estivesse aberto, mesmo
    com a pessoa lendo outro canal — ou seja, ele nunca aparecia, porque entrar
    numa chamada abre o palco.

    Não deu erro nenhum, compilou, e passou por typecheck e lint: os dois
    argumentos são `string`. Apareceu abrindo a tela e não achando a janela.
  */
  const canalAberto = useCanalAtivo();
  const naSala = useNaSala(canalAberto ?? "");
  const raiz = useRef<HTMLElement | null>(null);
  const arraste = useArraste(raiz, popout.dx, popout.dy);

  const fora = chamada.estado === "fora";

  /*
    ⚠ **Sair da chamada devolve forma E posição ao repouso.** Sem isto, quem
    tivesse fechado o popout numa chamada abriria a próxima sem nenhuma janela
    — e quem o tivesse arrastado para o canto de cima veria a próxima nascer
    lá. Efeito e não `return null`: devolver nada deixaria o store mentindo
    para sempre. Mesma mecânica do `fecharPalco` em `PalcoDeVoz`.
  */
  useEffect(() => {
    if (fora) reiniciarPopout();
  }, [fora]);

  if (fora || naSala || popout.forma === "fechado") return null;

  const nome = canal?.name ?? "voz";
  const pip = popout.forma === "pip";

  /* Estilo e não classe: a posição é DADO, e muda a cada arraste. */
  const posicao = {
    "--vx-popout-dx": `${String(popout.dx)}px`,
    "--vx-popout-dy": `${String(popout.dy)}px`,
  } as React.CSSProperties;

  return (
    <section
      ref={raiz}
      className={css.popout}
      data-forma={popout.forma}
      style={posicao}
      aria-label={`Chamada em ${nome}`}
    >
      {pip ? null : (
        /*
          ⚠ **O cabeçalho é a alça, e ele NÃO ganha um alvo de "mover".**

          A regra do projeto é que recurso exclusivo de ponteiro exclui gente do
          produto — foi ela que tirou o arrasto-para-criar-pasta e que pôs setas
          no redimensionamento de coluna. Aqui ela é atendida sem alvo novo: o
          que mover resolve é "está no meu caminho", e `✕` resolve o mesmo, por
          teclado, num botão que o design já desenha. Uma parada de tabulação
          invisível que só move pixels seria pior que a ausência.
        */
        <header className={css.cabecalho} onPointerDown={arraste.aoDescer}>
          {/*
            ⚠ **O nome NAVEGA e abre a chamada — as duas coisas, num alvo só.**

            Navegar sozinho mudaria a coluna de conteúdo para o chat do canal
            de voz e deixaria o popout no canto, ou seja, o gesto mais óbvio
            ("me leva até a chamada") não levaria até ela. E o palco deixou de
            ser sobreposição: sem `selecionarCanal` antes, `definirPalco`
            mudaria um store e nada apareceria.
          */}
          <button
            type="button"
            className={css.destino}
            onClick={() => {
              selecionarCanal(chamada.channelId);
              definirPalco(destinoDoPalco(chamada));
            }}
          >
            {nome}
          </button>
          <Cronometro desde={chamada.desde} />
          {/*
            ⚠ **`◱` MINIMIZA, e o rótulo da referência está errado.** Lá o
            botão diz `aria-label="Expandir"` e chama `onCollapse`, com o ícone
            de PiP — o rótulo é o engano, não o comportamento: um `◱` ao lado
            de um `✕` num cabeçalho de 28px é a convenção de janela, e nela ele
            encolhe.

            ⚠ **E não é o Picture-in-Picture do NAVEGADOR**, que já existe na
            prancha e é outra coisa: aquele tira o `<video>` da página e o
            entrega ao sistema operacional. Este é a segunda forma do popout,
            desenhada, com a contagem e os dois controles.
          */}
          <Tooltip texto="Minimizar" lado="abaixo">
            <button
              type="button"
              className={css.acaoDoCabecalho}
              aria-label="Minimizar a janela da chamada"
              onClick={() => definirFormaDoPopout("pip")}
            >
              <PictureInPicture size={13} aria-hidden />
            </button>
          </Tooltip>
          <Tooltip texto="Fechar a janela" lado="abaixo">
            <button
              type="button"
              className={css.acaoDoCabecalho}
              aria-label="Fechar a janela da chamada"
              onClick={() => definirFormaDoPopout("fechado")}
            >
              <X size={13} aria-hidden />
            </button>
          </Tooltip>
        </header>
      )}

      <div
        className={css.palco}
        onPointerDown={pip ? arraste.aoDescer : undefined}
      >
        <Mostra chamada={chamada} />

        {pip ? (
          /*
            ⚠ **A pílula de contagem é o caminho de VOLTA, e sem ela o mínimo
            era beco sem saída.** O design desenha só dois botões redondos
            (microfone e sair) e nenhum "expandir" — e o cabeçalho, que é onde
            morariam, não existe nesta forma. Sem uma porta de volta, quem
            minimizasse ficaria preso na janelinha até desligar a chamada.

            Pendurar a volta na pílula mantém os dois botões do design e reusa
            um elemento que já diz onde você está: clicar no estado para ir até
            ele é o mesmo gesto do nome do canal no popout grande.
          */
          <button
            type="button"
            className={css.pilula}
            onClick={() => definirFormaDoPopout("popout")}
          >
            <span className={css.pontoDaPilula} aria-hidden />
            {chamada.participantes.length} na chamada
          </button>
        ) : (
          <div className={css.miniaturas}>
            <Miniaturas ids={chamada.participantes} />
          </div>
        )}

        {pip ? (
          <div className={css.controlesDoPip}>
            <BotaoRedondo
              nome="Microfone"
              ligado={!chamada.mudo}
              perigo={chamada.mudo}
              acao={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}
              onClick={() => void alternarMudo()}
            >
              {chamada.mudo ? (
                <MicrophoneSlash size={13} aria-hidden />
              ) : (
                <Microphone size={13} aria-hidden />
              )}
            </BotaoRedondo>
            <BotaoRedondo
              nome="Sair da chamada"
              perigo
              acao="Sair da chamada"
              onClick={() => void sairDaChamada()}
            >
              <PhoneX size={13} aria-hidden />
            </BotaoRedondo>
          </div>
        ) : null}
      </div>

      {pip ? null : (
        /*
          ⚠ **Três controles, e o design escreve por quê:** "só três controles
          sobrevivem: microfone, câmera e sair — o resto volta ao expandir". O
          cartão anterior tinha cinco, e espremer cinco numa janela de 420 é o
          mesmo que não ter nenhum. Ensurdecer e compartilhar tela continuam na
          doca da sala e no painel de usuário.
        */
        <footer className={css.rodape}>
          <BotaoRedondo
            nome="Microfone"
            ligado={!chamada.mudo}
            perigo={chamada.mudo}
            acao={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}
            onClick={() => void alternarMudo()}
          >
            {chamada.mudo ? (
              <MicrophoneSlash size={15} aria-hidden />
            ) : (
              <Microphone size={15} aria-hidden />
            )}
          </BotaoRedondo>
          <BotaoRedondo
            nome="Câmera"
            ligado={chamada.camera}
            acao={chamada.camera ? "Desligar câmera" : "Ligar câmera"}
            onClick={() => void alternarCamera()}
          >
            {chamada.camera ? (
              <VideoCamera size={15} aria-hidden />
            ) : (
              <VideoCameraSlash size={15} aria-hidden />
            )}
          </BotaoRedondo>
          <BotaoRedondo
            nome="Sair da chamada"
            perigo
            acao="Sair da chamada"
            onClick={() => void sairDaChamada()}
          >
            <PhoneX size={15} aria-hidden />
          </BotaoRedondo>
        </footer>
      )}
    </section>
  );
}

/* ============================================================
   A mídia
   ============================================================ */

/**
 * O que aparece no palco do popout.
 *
 * ⚠ **A escolha é DETERMINÍSTICA e não "quem está falando", e a divergência
 * com o design é essa.** O mockup rotula a área como `orador ativo · Marina`,
 * e nomear o orador exige uma lista global de quem fala — que o store efêmero
 * de propósito não publica. Ela mudaria a cada ~120ms com alguém falando, e o
 * popout fica aberto o tempo todo: seria re-renderizar uma janela permanente
 * oito vezes por segundo para trocar um nome.
 *
 * A fala continua dita, e no lugar onde o próprio design a diz — a borda verde
 * das miniaturas, que assinam UMA chave cada.
 *
 * ⚠ **Tela ganha de câmera**, como na grade: quem transmite está mostrando
 * alguma coisa, e a webcam dessa pessoa é contexto, não conteúdo.
 */
const Mostra = memo(function Mostra({ chamada }: { chamada: Chamada }) {
  const eu = chamada.participantes[0];
  const { userId, fonte } = oQueMostrar(chamada);

  /*
    ⚠ **Assina enquanto o popout existe e DEVOLVE ao sair** — a metade que se
    esquece. Com `autoSubscribe: false` nada de vídeo desce sozinho; sem a
    devolução, fechar o popout deixaria a faixa descendo para um elemento que
    não existe mais. Invisível na interface, visível na conta de banda.

    ⚠ **`!== eu` porque a sua própria faixa não vem pela rede** — ela já está
    no store por `publicarVideoLocal`, e pedi-la seria pedir ao servidor o que
    você mesmo está enviando.

    ⚠ **É UMA faixa, e essa é a diferença de custo para a grade.** O popout
    fica aberto o tempo todo durante a chamada; assinar todo mundo aqui seria
    banda permanente. Uma só é o preço de mostrar em vez de só dizer.
  */
  useEffect(() => {
    if (!userId || userId === eu) return;
    assinarVideo(userId, fonte, true);
    return () => {
      assinarVideo(userId, fonte, false);
    };
  }, [userId, fonte, eu]);

  if (!userId) {
    return (
      <span className={css.semMidia}>
        {chamada.estado === "conectando"
          ? "entrando…"
          : chamada.estado === "reconectando"
            ? "reconectando…"
            : `${String(chamada.participantes.length)} na chamada`}
      </span>
    );
  }

  return (
    <FaixaDeVideo
      userId={userId}
      fonte={fonte}
      className={css.video}
      espelhada={fonte === "camera" && userId === eu}
    />
  );
});

/**
 * Qual faixa vai ao palco, em ordem de prioridade.
 *
 * ⚠ **`transmitindo` e `comCamera` NÃO incluem você — está escrito no store, e
 * eu li errado.** As duas listas são varridas de `remoteParticipants`; o seu
 * próprio estado de transporte mora em `Chamada.tela` e `Chamada.camera`,
 * porque duplicá-lo nas listas daria duas fontes para o mesmo fato.
 *
 * A primeira versão daqui lia só as listas. Consequência medida por quem usa,
 * numa chamada real: compartilhando a tela sozinho na sala, o popout mostrava
 * o xadrez e "1 na chamada" — a prévia da própria tela, que é o pedido que
 * originou este trabalho, era justamente o caso que não funcionava. E não
 * havia erro nenhum: `transmitindo[0]` é `undefined`, e `undefined` é o mesmo
 * valor de "ninguém está transmitindo".
 *
 * ⚠ **A tela de OUTRA pessoa ganha da sua.** A sua você já está vendo — ela é
 * o seu monitor. A de quem transmite é a única que só existe aqui dentro.
 */
function oQueMostrar(chamada: Chamada): {
  userId: string | undefined;
  fonte: "tela" | "camera";
} {
  const eu = chamada.participantes[0];
  const telaRemota = chamada.transmitindo[0];
  if (telaRemota) return { userId: telaRemota, fonte: "tela" };
  if (chamada.tela && eu) return { userId: eu, fonte: "tela" };

  const cameraRemota = chamada.comCamera[0];
  if (cameraRemota) return { userId: cameraRemota, fonte: "camera" };
  if (chamada.camera && eu) return { userId: eu, fonte: "camera" };

  return { userId: undefined, fonte: "camera" };
}

/* ============================================================
   Miniaturas
   ============================================================ */

/**
 * Duas miniaturas e um `+N` — a contagem é do design.
 *
 * Duas, e não "as que couberem": a fileira mora SOBRE a mídia, e cada
 * miniatura a mais é um pedaço do que se está tentando ver.
 */
function Miniaturas({ ids }: { ids: readonly string[] }) {
  const visiveis = ids.slice(0, 2);
  const resto = ids.length - visiveis.length;

  return (
    <>
      {visiveis.map((id) => (
        <Miniatura key={id} userId={id} />
      ))}
      {resto > 0 ? <span className={css.maisN}>+{resto}</span> : null}
    </>
  );
}

/**
 * Uma miniatura, assinando a PRÓPRIA fala.
 *
 * A subscrição mais fina que o popout tem: alguém começar a falar acorda esta
 * caixa de 44×32 — não o popout, não a mídia, não a chamada. É a lei nº 1 na
 * mesma forma que o anel do cartão antigo já usava.
 */
const Miniatura = memo(function Miniatura({ userId }: { userId: string }) {
  const pessoa = usePessoa(userId);
  const ativo = useSyncExternalStore(
    falando.subscriber(userId),
    () => falando.getSnapshot(userId) ?? false,
  );

  return (
    <span
      className={css.miniatura}
      data-falando={ativo}
      title={pessoa?.displayName}
    >
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho="xs"
      />
      {/* Cor e forma nunca sozinhas — presença e fala sempre com texto ao
          lado, para quem não enxerga o anel verde. */}
      {ativo ? <span className="sr-only">falando</span> : null}
    </span>
  );
});

/* ============================================================
   Botão redondo
   ============================================================ */

function BotaoRedondo({
  nome,
  ligado,
  acao,
  perigo,
  onClick,
  children,
}: {
  nome: string;
  ligado?: boolean;
  acao: string;
  /**
   * Pinta de vermelho.
   *
   * ⚠ **Só o microfone e o desligar, e NÃO "todo controle desligado".** O
   * cartão anterior pintava qualquer `ligado === false`, e com isso a câmera
   * desligada — que é o estado NORMAL de quase toda chamada — ficava vermelha
   * dizendo que algo estava errado. O design põe microfone e câmera os dois em
   * `surface-4`; o vermelho é de "sair" e do microfone CORTADO, que é a única
   * informação que a pessoa precisa ver antes de começar a falar sozinha.
   */
  perigo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip texto={acao} lado="acima">
      <button
        type="button"
        className={css.redondo}
        /* Nome do RECURSO no rótulo e estado no `aria-pressed`; a ação vai no
           tooltip. É a regra que o lint deste projeto já cobrou uma vez, e
           `Sair da chamada` fica sem `aria-pressed` porque não alterna nada. */
        aria-label={nome}
        aria-pressed={ligado}
        data-perigo={perigo ?? false}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* ============================================================
   Arraste
   ============================================================ */

/**
 * Mover a janela sem tocar o store durante o gesto.
 *
 * ⚠ **É a regra que a fase 4 estabeleceu medindo, aplicada de novo.** Escrever
 * a posição a cada `pointermove` republicaria o store sessenta vezes por
 * segundo. Aqui o gesto move o elemento por `translate`, direto no DOM, e o
 * store recebe UM commit no `pointerup`.
 *
 * ⚠ **Deslocamento a partir do canto, não coordenada.** O popout é ancorado em
 * `inset-block-end/inset-inline-end`, que crescem para DENTRO — daí o sinal
 * invertido na conta. Com coordenada absoluta, encolher a janela deixaria a
 * janelinha fora dela.
 */
function useArraste(
  raiz: React.RefObject<HTMLElement | null>,
  dx: number,
  dy: number,
) {
  const gesto = useRef<{ x: number; y: number } | null>(null);

  const aoDescer = (e: EventoDePonteiro<HTMLElement>) => {
    /* Só o botão principal, e nunca em cima de um controle: arrastar a partir
       de "fechar" cancelaria o clique que a pessoa quis dar. */
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

    const el = raiz.current;
    if (!el) return;

    /*
      ⚠ **O recuo de base é MEDIDO agora, e a primeira versão o ignorou.**

      A posição é `inset-*: base + deslocamento`, com `base` vindo do CSS
      (`--vx-space-16`). A trava original limitava o deslocamento a
      `innerWidth - largura`, esquecendo a base — e arrastando para o canto
      alto-esquerdo a janela parava com `x: -16`, ou seja, dezesseis pixels
      FORA da tela. Medido; não dá erro nenhum e some no canto.

      Medir em vez de repetir o `16`: o número está no CSS, e uma cópia aqui é
      exatamente o valor mágico que a lei nº 4 proíbe — divergiria no dia em
      que a âncora mudasse de degrau. No `pointerdown` o `translate` ainda está
      vazio, então este retângulo é a posição de repouso.
    */
    const repouso = el.getBoundingClientRect();
    const baseX = window.innerWidth - repouso.right - dx;
    const baseY = window.innerHeight - repouso.bottom - dy;

    gesto.current = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);

    const mover = (m: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      el.style.translate = `${String(m.clientX - g.x)}px ${String(m.clientY - g.y)}px`;
    };

    const soltar = (m: PointerEvent) => {
      const g = gesto.current;
      gesto.current = null;
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerup", soltar);
      el.removeEventListener("pointercancel", soltar);
      if (!g) return;

      const novoX = dx - (m.clientX - g.x);
      const novoY = dy - (m.clientY - g.y);
      const caixa = el.getBoundingClientRect();

      /*
        ⚠ **A trava é o que impede arrastar a janela para fora e perdê-la.**
        Sem ela um gesto largo deixaria o popout inalcançável, e a única saída
        seria desligar a chamada. Os limites saem do tamanho REAL do elemento,
        medido agora — as duas formas têm larguras diferentes, e um número fixo
        erraria numa delas — MENOS o recuo de base, que é o que faltava.

        Piso em zero: zero é o canto de repouso, e deslocamento negativo
        empurraria a janela para fora pelo outro lado.
      */
      const x = Math.min(
        Math.max(novoX, 0),
        Math.max(0, window.innerWidth - baseX - caixa.width),
      );
      const y = Math.min(
        Math.max(novoY, 0),
        Math.max(0, window.innerHeight - baseY - caixa.height),
      );

      /* Escrito no DOM ANTES do store: React vai renderizar o mesmo valor no
         próximo quadro, e sem isto haveria um quadro com o `translate` já
         limpo e o `inset` ainda antigo — a janela pulando de volta e indo. */
      el.style.setProperty("--vx-popout-dx", `${String(x)}px`);
      el.style.setProperty("--vx-popout-dy", `${String(y)}px`);
      el.style.translate = "";
      moverPopout(x, y);
    };

    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
  };

  return { aoDescer };
}

/* ============================================================
   Destino
   ============================================================ */

/**
 * Para onde "Abrir a chamada" leva.
 *
 * Um alvo só e o DESTINO é que muda: três alvos ("ver a minha transmissão",
 * "assistir a de alguém", "abrir a grade") num cabeçalho de 28px seriam três
 * coisas para ler antes de clicar, e as três levam ao mesmo palco.
 */
function destinoDoPalco(chamada: Chamada): Palco {
  if (chamada.tela) return { tipo: "transmitindo" };
  const so = chamada.transmitindo;
  if (so.length === 1 && so[0]) return { tipo: "assistindo", userId: so[0] };
  return { tipo: "grade" };
}
