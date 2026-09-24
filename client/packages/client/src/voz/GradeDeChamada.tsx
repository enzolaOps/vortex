import {
  DotsThree,
  ICONE,
  MicrophoneSlash,
  Monitor,
  PictureInPicture,
  PushPin,
  SpeakerSlash,
  VideoCamera,
} from "../components/ui/icones";
import { memo, useEffect, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import {
  iconesDoParticipante,
  ROTULO_DO_ICONE,
  type IconeDeVoz,
} from "../canais/iconesDeVoz";
import { buscarAtividade } from "../sdk/atividades";
import { assinarSessao, lerSessao } from "../store/atividades";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { useChannel, usePessoa, useServer, useVozDoCanal } from "../store/hooks";
import { abrirMenuDoParticipante } from "../store/menuDoParticipante";
import { fecharPalco } from "../store/palcoDeVoz";
import { definirFormaDoPopout } from "../store/popout";
import { LadrilhoDeAtividade } from "./atividades/LadrilhoDeAtividade";
import { BotaoDoChatDaSala } from "./ChatDaSala";
import { Rtt } from "./FaixaDeVoz";
import {
  capacidadeDaChamada,
  chipDaConexao,
  contagemDaChamada,
  estadoDaPlaca,
} from "./grade";
import {
  BotaoDeTelaCheia,
  Cronometro,
  Doca,
  FaixaDeVideo,
  useVideo,
} from "./pecasDeVoz";
import css from "./GradeDeChamada.module.css";

/**
 * A grade da chamada.
 *
 * ⚠ **Ela é a tela que faltava entre "estou numa chamada" e "estou vendo a
 * chamada".** Antes dela, uma sala com câmeras ligadas e alguém transmitindo
 * era, do lado de cá, uma lista de nomes num cartão de canto: o app assinava
 * só áudio e não tinha onde pôr vídeo, então vídeo simplesmente não existia.
 *
 * ⚠ **Três disposições, e não uma.** É o que o design desenha, e cada uma
 * responde a uma pergunta diferente: a grade pergunta "quem está aqui", o
 * orador pergunta "quem está falando agora", e o fixado pergunta "quero olhar
 * ESTA pessoa e que o resto não me tire dela".
 */

const DISPOSICOES = ["grade", "orador", "fixado"] as const;
export type Disposicao = (typeof DISPOSICOES)[number];

const NOME_DA_DISPOSICAO: Record<Disposicao, string> = {
  grade: "Grade",
  orador: "Orador ativo",
  fixado: "Fixado",
};

/**
 * A nota do design, palavra por palavra.
 *
 * ⚠ **A do orador descreve uma histerese de 1,2 s que EXISTE, e não por
 * capricho de fidelidade:** sem ela a célula grande trocaria a cada
 * interjeição, e uma grade que pisca é pior que uma grade parada. Ver
 * `useOradorEstavel`.
 */
const NOTA: Record<Disposicao, string> = {
  grade:
    "Grade: todos com peso igual; as colunas acompanham quantas pessoas há, até cinco.",
  orador:
    "Orador ativo: a célula grande troca por detecção de voz com histerese de 1,2 s — sem isso a grade pisca a cada interjeição.",
  fixado:
    "Fixado: a escolha manual sobrevive a quem fala, e o layout não muda até desfixar.",
};

/** A histerese do design. */
const HISTERESE_MS = 1200;

export function GradeDeChamada() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(chamada.channelId);
  const servidor = useServer(canal?.serverId ?? "");

  const [disposicao, setDisposicao] = useState<Disposicao>("grade");
  const [fixado, setFixado] = useState<string | undefined>(undefined);

  /*
    ⚠ **As colunas saem da CONTAGEM, e antes eram quatro sempre.** A regra
    anterior — `> 8 ? 5 : 4` — dava quatro colunas para duas pessoas: dois
    ladrilhos de 84px encolhidos num canto, com o resto da tela vazio embaixo.
    Foi o que quem usa relatou, e a queixa era sobre a PRÉVIA: numa chamada de
    duas pessoas com alguém transmitindo, a miniatura da transmissão ficava
    pequena demais para servir de prévia de qualquer coisa.

    `ceil(sqrt(n))` é a grade mais quadrada que cabe, que é a que aproveita
    melhor uma área larga: 1 pessoa em 1 coluna, 2 a 4 em duas, 5 a 9 em três,
    10 a 16 em quatro, e o teto em cinco.

    ⚠ **Teto em 5 pelo motivo de sempre**, e ele não mudou: acima disso a
    célula fica menor que o rosto que ela existe para mostrar, e paginar
    esconderia justamente quem está falando.
  */
  const comAtividade =
    useSyncExternalStore(assinarSessao(chamada.channelId), () =>
      lerSessao(chamada.channelId),
    ) !== undefined;

  /*
    Quem entra na sala DEPOIS de a atividade começar não recebeu o
    `ActivityUpdate`: a grade pergunta ao abrir. O resultado vai para o store
    (não para `setState`), e falha de rede só deixa a grade sem o ladrilho.
  */
  useEffect(() => {
    if (!chamada.channelId) return;
    buscarAtividade(chamada.channelId).catch(() => undefined);
  }, [chamada.channelId]);

  /* O ladrilho da atividade ocupa 2×2: com uma coluna só ele criaria uma
     trilha implícita fora da conta. */
  const colunas = Math.min(
    5,
    Math.max(
      comAtividade ? 2 : 1,
      Math.ceil(Math.sqrt(chamada.participantes.length)),
    ),
  );

  /*
    ⚠ **Você não está em `comCamera` nem em `mudos`, e isso é de propósito.**
    As duas listas são varridas de `remoteParticipants` — o seu próprio estado
    de transporte já mora em `Chamada.camera` e `Chamada.mudo` desde a fase 6,
    e duplicá-lo nas listas daria duas fontes para o mesmo fato, com a segunda
    sempre um evento atrás. Quem resolve é aqui, uma vez.
  */
  const eu = chamada.participantes[0];

  /*
    O que o PROTOCOLO sabe de cada um — surdo e o que o servidor impôs
    (D-DVM-14). Assinado uma vez aqui, por canal, e não por ladrilho: a lista
    muda por ação humana, e vinte ladrilhos assinando o mesmo canal seriam
    vinte comparações a cada entrada na sala para descobrir o próprio item.
  */
  const sala = useVozDoCanal(chamada.channelId);

  const grande =
    disposicao === "fixado"
      ? (fixado ?? chamada.participantes[0])
      : disposicao === "orador"
        ? undefined
        : undefined;

  return (
    <>
      <header className={css.cabecalho}>
        <Monitor size={ICONE.controle} className={css.glifo} aria-hidden />
        <span className={css.nomeDoCanal}>{canal?.name ?? "voz"}</span>
        <span className={css.nomeDoServidor}>{servidor?.name ?? ""}</span>
        <ChipDaConexao />
        {/* "7 de 25" (D-VOZ-25): o total é o grupo, ou o teto da sala — ver
            `capacidadeDaChamada`. */}
        <span className={css.contagem}>
          {contagemDaChamada(
            chamada.participantes.length,
            capacidadeDaChamada(canal),
          )}
        </span>
        <Cronometro desde={chamada.desde} />

        <span className={css.espaco} />

        <div
          className={css.segmentado}
          role="radiogroup"
          aria-label="Disposição da chamada"
        >
          {DISPOSICOES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={disposicao === d}
              className={css.segmento}
              onClick={() => setDisposicao(d)}
            >
              {NOME_DA_DISPOSICAO[d]}
            </button>
          ))}
        </div>

        {/*
          ⤢ · ◱ · 💬, na ordem do design (D-DVM-11). Antes os dois primeiros
          só existiam no palco de TRANSMISSÃO — ou seja, numa chamada sem
          ninguém transmitindo não havia como pôr a grade em tela cheia nem
          devolvê-la a uma janela pequena sem sair da sala.
        */}
        <div className={css.acoesDoCabecalho}>
          <BotaoDeTelaCheia className={css.acaoDoCabecalho} />
          <BotaoDePopout />
          <BotaoDoChatDaSala className={css.acaoDoCabecalho} />
        </div>
      </header>

      <div className={css.miolo}>
        <div
          className={css.grade}
          style={{ gridTemplateColumns: `repeat(${String(colunas)}, minmax(0, 1fr))` }}
        >
          <LadrilhoDeAtividade channelId={chamada.channelId} />
          {chamada.participantes.map((id) => {
            const doProtocolo = sala.find((p) => p.userId === id);
            return (
            <Ladrilho
              key={id}
              userId={id}
              disposicao={disposicao}
              grande={grande === id}
              fixado={fixado === id}
              eu={id === eu}
              temCamera={
                id === eu ? chamada.camera : chamada.comCamera.includes(id)
              }
              transmitindo={
                id === eu ? chamada.tela : chamada.transmitindo.includes(id)
              }
              mudo={id === eu ? chamada.mudo : chamada.mudos.includes(id)}
              surdo={id === eu ? chamada.surdo : doProtocolo?.surdo === true}
              mudoPeloServidor={doProtocolo?.mudoPeloServidor === true}
              surdoPeloServidor={doProtocolo?.surdoPeloServidor === true}
              aoFixar={() => {
                setFixado(id);
                setDisposicao("fixado");
              }}
              aoDesfixar={() => {
                setFixado(undefined);
                setDisposicao("grade");
              }}
            />
            );
          })}
        </div>

        <p className={css.nota}>{NOTA[disposicao]}</p>
      </div>

      <Doca
        mudo={chamada.mudo}
        surdo={chamada.surdo}
        camera={chamada.camera}
        tela={chamada.tela}
      />
    </>
  );
}

/* ============================================================
   Ladrilho
   ============================================================ */

/**
 * Uma célula da grade.
 *
 * ⚠ **Ela ASSINA a fala e PEDE o vídeo, e as duas coisas são por pessoa.** A
 * fala vem do store efêmero, que existe desde a fase 6 justamente para não
 * repintar a coluna a cada sílaba; o vídeo vem por `assinarVideo`, e o pedido
 * é feito e DEVOLVIDO aqui — se a célula desmontasse sem devolver, a faixa
 * continuaria descendo atrás de uma tela fechada, que é o desperdício exato
 * que `autoSubscribe: false` evita, com a agravante de ser invisível.
 */
const Ladrilho = memo(function Ladrilho({
  userId,
  disposicao,
  grande,
  fixado,
  eu,
  temCamera,
  transmitindo,
  mudo,
  surdo,
  mudoPeloServidor,
  surdoPeloServidor,
  aoFixar,
  aoDesfixar,
}: {
  userId: string;
  disposicao: Disposicao;
  grande: boolean;
  fixado: boolean;
  eu: boolean;
  temCamera: boolean;
  transmitindo: boolean;
  mudo: boolean;
  surdo: boolean;
  mudoPeloServidor: boolean;
  surdoPeloServidor: boolean;
  aoFixar: () => void;
  aoDesfixar: () => void;
}) {
  const pessoa = usePessoa(userId);
  const ativo = useSyncExternalStore(
    falando.subscriber(userId),
    () => falando.getSnapshot(userId) ?? false,
  );
  const oradorEstavel = useOradorEstavel(ativo);

  useVideo(userId, "camera", temCamera && !eu);
  /*
    ⚠ **A PRÉVIA da transmissão, e ela é a metade que faltava.** Antes daqui um
    ladrilho de quem transmite mostrava o avatar e um botão "Assistir" — a
    grade sabia que havia uma tela no ar e não mostrava nada dela, então
    decidir se valia entrar exigia entrar.

    `!eu` como na câmera: a sua própria faixa não vem pela rede. Ela já está no
    store por `publicarVideoLocal`, então o `<FaixaDeVideo>` abaixo a encontra
    sem pedir nada — e pedir seria pedir ao servidor a faixa que você mesmo
    está enviando.
  */
  useVideo(userId, "tela", transmitindo && !eu);

  const destaque = disposicao === "orador" ? oradorEstavel : grande;

  /*
    Os ícones da placa, com o MESMO teto e a mesma ordem de criticidade da
    linha da sala na coluna de canais (D-DVM-14, D-VOZ-29). A placa é mais
    estreita que um ladrilho de 84px pode pagar — sem teto, quem transmite,
    ensurdecido e silenciado pelo servidor empurraria o nome para reticência.
  */
  const { visiveis, recolhidos } = iconesDoParticipante(
    estadoDaPlaca({
      transmitindo,
      camera: temCamera,
      mudo,
      surdo,
      mudoPeloServidor,
      surdoPeloServidor,
    }),
  );
  const primeiroSrv = visiveis.find((i) => i === "srvSurdo" || i === "srvMudo");

  return (
    <div
      className={css.ladrilho}
      data-falando={ativo}
      /* Ensurdecido esmaece o AVATAR, como o design (opacity 0.6 no ladrilho
         do Nando) — e só o avatar: a placa com o nome fica em opacidade
         cheia, senão o texto perderia contraste sobre o véu. */
      data-surdo={surdo || surdoPeloServidor}
      data-grande={destaque}
      data-video={temCamera || transmitindo}
      /* Um stream ocupa 2×2 por padrão: numa célula de 84px a tela de alguém
         não é legível, e uma prévia ilegível é a mesma coisa que nenhuma. */
      data-tela={transmitindo}
      /* Quem é, para o menu do participante — o Root é um só, no palco. */
      data-participante={userId}
    >
      {/*
        ⚠ **O avatar fica SEMPRE, e o vídeo cobre.** A primeira versão
        escolhia entre os dois por `temCamera` — e `temCamera` só diz que a
        pessoa PUBLICOU, não que a faixa já desceu. Entre pedir e receber, o
        ladrilho ficava vazio: nem avatar, nem imagem, nem nada. É a mesma
        armadilha do avatar real, que cobre o gradiente em vez de substituí-lo,
        e pela mesma razão — o que vem pela rede pode demorar ou falhar.
      */}
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho={destaque ? "lg" : "md"}
        className={css.avatar}
      />
      {/*
        ⚠ **A tela ganha da câmera quando as duas estão no ar.** É o que o
        Discord faz e é o que a atenção pede: quem transmite está mostrando
        alguma coisa, e a webcam dessa pessoa é o contexto, não o conteúdo. Um
        ladrilho por fonte dobraria a grade e faria a mesma pessoa aparecer
        duas vezes.
      */}
      {transmitindo ? (
        <FaixaDeVideo userId={userId} fonte="tela" className={css.video} />
      ) : temCamera ? (
        <FaixaDeVideo
          userId={userId}
          fonte="camera"
          className={css.video}
          espelhada={eu}
        />
      ) : null}

      <span className={css.placa}>
        <span className={css.nome}>{pessoa?.displayName ?? "alguém"}</span>
        {ativo ? (
          <>
            <span className={css.pontoFalando} aria-hidden />
            <span className="sr-only">falando</span>
          </>
        ) : null}
        {visiveis.map((icone) => (
          <GlifoDaPlaca key={icone} icone={icone} comSigla={icone === primeiroSrv} />
        ))}
        {recolhidos.length > 0 ? (
          <span className={css.maisEstados}>
            +{recolhidos.length}
            <span className="sr-only">
              {`, também ${recolhidos.map((i) => ROTULO_DO_ICONE[i]).join(", ")}`}
            </span>
          </span>
        ) : null}
      </span>

      {/*
        Fixar é a única ação do ladrilho, e ela é do design.

        ⚠ **`visibility` e nunca `opacity`.** Com opacidade zero o alvo
        continuaria recebendo tabulação — numa sala de vinte pessoas seriam
        vinte paradas invisíveis antes de chegar na doca. É a mesma decisão da
        barra de ações da linha de mensagem.
      */}
      <div className={css.acoesDoLadrilho}>
        <Tooltip texto={fixado ? "Desfixar" : "Fixar participante"} lado="acima">
          <button
            type="button"
            className={css.fixar}
            aria-label={`Fixar ${pessoa?.displayName ?? "participante"}`}
            aria-pressed={fixado}
            onClick={fixado ? aoDesfixar : aoFixar}
          >
            <PushPin size={ICONE.metadado} weight={fixado ? "fill" : "regular"} aria-hidden />
          </button>
        </Tooltip>
        {/*
          O `⋯` abre o MESMO menu do clique direito, despachando o evento que o
          `Trigger` do palco já escuta — ver `abrirMenuDoParticipante`. Sem
          ele, volume e moderação existiriam só para quem sabe do botão
          direito, que é a afordância que menos gente descobre.
        */}
        <button
          type="button"
          className={css.fixar}
          aria-label={`Opções de ${pessoa?.displayName ?? "participante"}`}
          aria-haspopup="menu"
          onClick={(e) => abrirMenuDoParticipante(e.currentTarget)}
        >
          <DotsThree size={ICONE.metadado} aria-hidden />
        </button>
      </div>

      {/*
        ⚠ **O botão "Assistir" SAIU, e ele tinha virado inalcançável.**

        A sala passou a entrar na prancha sozinha quando há tela no ar (ver
        `PalcoDeVoz`), então esta grade só é montada quando NÃO há transmissão
        nenhuma — e `transmitindo` é falso em todo ladrilho. Um alvo que a
        condição nunca satisfaz é a família do "construído e inalcançável" que
        o painel de fixadas já custou a este projeto: manutenção sem nada na
        tela, e de fora idêntico a ausente.

        Trocar qual tela ocupa o palco, quando houver mais de uma, é trabalho
        da FILA da prancha — não daqui.
      */}
    </div>
  );
});

/**
 * Um ícone de estado na placa de nome.
 *
 * Mesma pintura da linha da sala na coluna de canais, com uma diferença: a
 * TELA aqui é o glifo e não o selo `LIVE`. Na coluna, o selo se lê sem
 * conhecer a convenção; na placa ele disputaria a largura com o nome dentro
 * de um ladrilho de 84px, e quem transmite já está com a tela cobrindo o
 * próprio ladrilho — o conteúdo diz o estado antes do ícone.
 *
 * ⚠ **SRV é aviso e não perigo**, como na coluna: não poder falar é restrição
 * administrativa, não falha. A sigla sai uma vez só, mesmo com os dois ícones
 * do servidor.
 */
function GlifoDaPlaca({ icone, comSigla }: { icone: IconeDeVoz; comSigla: boolean }) {
  const rotulo = <span className="sr-only">{ROTULO_DO_ICONE[icone]}</span>;
  switch (icone) {
    case "tela":
      return (
        <>
          <Monitor size={ICONE.selo} className={css.glifoDaPlaca} aria-hidden />
          {rotulo}
        </>
      );
    case "video":
      return (
        <>
          <VideoCamera size={ICONE.selo} className={css.glifoCamera} aria-hidden />
          {rotulo}
        </>
      );
    case "srvSurdo":
    case "srvMudo":
      return (
        <>
          {icone === "srvSurdo" ? (
            <SpeakerSlash size={ICONE.selo} className={css.glifoSrv} aria-hidden />
          ) : (
            <MicrophoneSlash size={ICONE.selo} className={css.glifoSrv} aria-hidden />
          )}
          {comSigla ? (
            <span className={css.srv} aria-hidden>
              SRV
            </span>
          ) : null}
          {rotulo}
        </>
      );
    case "surdo":
      return (
        <>
          <SpeakerSlash size={ICONE.selo} className={css.glifoMudo} aria-hidden />
          {rotulo}
        </>
      );
    case "mudo":
      return (
        <>
          <MicrophoneSlash size={ICONE.selo} className={css.glifoMudo} aria-hidden />
          {rotulo}
        </>
      );
  }
}

/**
 * "excelente · 38 ms" no cabeçalho da grade (D-DVM-11).
 *
 * Componente próprio pela lei nº 1: o RTT amostra por segundo, e o chip é o
 * único pedaço do cabeçalho que precisa acordar para isso — a grade inteira
 * re-renderizando a cada segundo repintaria vinte ladrilhos por um número.
 * `Rtt` já é componente separado e cuida disso; aqui fica só a classificação.
 */
function ChipDaConexao() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const chip = chipDaConexao(chamada.estado, chamada.qualidade);

  return (
    <span className={css.chipDaConexao} data-tom={chip.tom}>
      <span className={css.pontoDaConexao} aria-hidden />
      {chip.texto}
      {chip.comRtt ? <Rtt className={css.rtt} /> : null}
    </span>
  );
}

/**
 * ◱ — devolve a chamada a uma janela pequena (D-DVM-11).
 *
 * ⚠ **É o POPOUT, e não o picture-in-picture do navegador.** O PiP nativo
 * leva UM `<video>`; a grade é uma sala de pessoas, e na maior parte do tempo
 * ninguém tem câmera — o PiP abriria um retângulo preto ou nada. O popout já
 * existe para isto: mostra o orador, o cronômetro e os controles, e fica sobre
 * o app enquanto a pessoa lê outro canal. Fechar o palco é o que o faz
 * aparecer (ele some quando a sala está na tela, ver `useNaSala`).
 */
function BotaoDePopout() {
  return (
    <Tooltip texto="Janela flutuante" lado="abaixo">
      <button
        type="button"
        className={css.acaoDoCabecalho}
        aria-label="Janela flutuante"
        onClick={() => {
          definirFormaDoPopout("popout");
          fecharPalco();
        }}
      >
        <PictureInPicture size={ICONE.controle} aria-hidden />
      </button>
    </Tooltip>
  );
}

/* ============================================================
   Hooks
   ============================================================ */

/**
 * "Está falando" com histerese, para a célula grande não piscar.
 *
 * ⚠ **Ela sobe na hora e desce devagar, e a assimetria é o ponto.** Quem
 * começa a falar precisa aparecer imediatamente; quem para de falar entre duas
 * palavras não deve sair da célula grande. Sem isso a grade troca de foco a
 * cada interjeição — é o que o design descreve, e o número (1,2 s) é dele.
 *
 * É a mesma assimetria da faixa de reconexão: avisar espera, parar de avisar é
 * imediato — aqui invertida, pela mesma razão de sempre (o que incomoda é a
 * troca, não o estado).
 */
function useOradorEstavel(ativo: boolean): boolean {
  const [estavel, setEstavel] = useState(ativo);

  /*
    ⚠ **Os dois lados passam por `setTimeout`, e a subida usa 0 ms.** O lint
    do projeto proíbe `setState` no CORPO de um efeito — ele produz render em
    cascata —, então mesmo a subida imediata é agendada. Zero milissegundo cai
    no mesmo quadro, e o que se ganha é a regra valendo sem exceção: quem
    vier depois não precisa decidir quando ela vale.
  */
  useEffect(() => {
    if (ativo === estavel) return;
    const t = setTimeout(() => setEstavel(ativo), ativo ? 0 : HISTERESE_MS);
    return () => clearTimeout(t);
  }, [ativo, estavel]);

  return estavel;
}
