import {
  ChatCircle,
  MicrophoneSlash,
  Monitor,
  PushPin,
} from "@phosphor-icons/react";
import { memo, useEffect, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import { assinarVideo } from "../sdk/chamada";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { useChannel, usePessoa, useServer } from "../store/hooks";
import { definirPalco, fecharPalco } from "../store/palcoDeVoz";
import { Cronometro, Doca, FaixaDeVideo } from "./pecasDeVoz";
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
    "Grade: todos com peso igual, 4 colunas até 8 participantes, 5 acima disso.",
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
    ⚠ **Acima de 8 a grade abre para 5 colunas** — a célula fica menor e
    continua legível. Paginar esconderia justamente quem está falando, que é a
    única informação que a grade existe para dar de relance.
  */
  const colunas = chamada.participantes.length > 8 ? 5 : 4;

  /*
    ⚠ **Você não está em `comCamera` nem em `mudos`, e isso é de propósito.**
    As duas listas são varridas de `remoteParticipants` — o seu próprio estado
    de transporte já mora em `Chamada.camera` e `Chamada.mudo` desde a fase 6,
    e duplicá-lo nas listas daria duas fontes para o mesmo fato, com a segunda
    sempre um evento atrás. Quem resolve é aqui, uma vez.
  */
  const eu = chamada.participantes[0];

  const grande =
    disposicao === "fixado"
      ? (fixado ?? chamada.participantes[0])
      : disposicao === "orador"
        ? undefined
        : undefined;

  return (
    <>
      <header className={css.cabecalho}>
        <Monitor size={16} className={css.glifo} aria-hidden />
        <span className={css.nomeDoCanal}>{canal?.name ?? "voz"}</span>
        <span className={css.nomeDoServidor}>{servidor?.name ?? ""}</span>
        <span className={css.contagem}>
          {chamada.participantes.length === 1
            ? "1 na chamada"
            : `${String(chamada.participantes.length)} na chamada`}
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

        <Tooltip texto="Voltar ao chat" lado="abaixo">
          <button
            type="button"
            className={css.acaoDoCabecalho}
            aria-label="Voltar ao chat"
            onClick={fecharPalco}
          >
            <ChatCircle size={17} aria-hidden />
          </button>
        </Tooltip>
      </header>

      <div className={css.miolo}>
        <div
          className={css.grade}
          style={{ gridTemplateColumns: `repeat(${String(colunas)}, minmax(0, 1fr))` }}
        >
          {chamada.participantes.map((id) => (
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
              aoFixar={() => {
                setFixado(id);
                setDisposicao("fixado");
              }}
              aoDesfixar={() => {
                setFixado(undefined);
                setDisposicao("grade");
              }}
            />
          ))}
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

  return (
    <div
      className={css.ladrilho}
      data-falando={ativo}
      data-grande={destaque}
      data-video={temCamera || transmitindo}
      /* Um stream ocupa 2×2 por padrão: numa célula de 84px a tela de alguém
         não é legível, e uma prévia ilegível é a mesma coisa que nenhuma. */
      data-tela={transmitindo}
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
        {transmitindo ? (
          <Monitor size={11} className={css.glifoDaPlaca} aria-label="transmitindo" />
        ) : null}
        {mudo ? (
          <MicrophoneSlash size={11} className={css.glifoMudo} aria-label="mudo" />
        ) : null}
      </span>

      {/*
        Fixar é a única ação do ladrilho, e ela é do design.

        ⚠ **`visibility` e nunca `opacity`.** Com opacidade zero o alvo
        continuaria recebendo tabulação — numa sala de vinte pessoas seriam
        vinte paradas invisíveis antes de chegar na doca. É a mesma decisão da
        barra de ações da linha de mensagem.
      */}
      <Tooltip texto={fixado ? "Desfixar" : "Fixar participante"} lado="acima">
        <button
          type="button"
          className={css.fixar}
          aria-label={`Fixar ${pessoa?.displayName ?? "participante"}`}
          aria-pressed={fixado}
          onClick={fixado ? aoDesfixar : aoFixar}
        >
          <PushPin size={13} weight={fixado ? "fill" : "regular"} aria-hidden />
        </button>
      </Tooltip>

      {/*
        ⚠ **O seu ladrilho leva à PRANCHA, o dos outros ao "assistindo".** São
        telas diferentes com públicos diferentes: a prancha tem o HUD de quem
        transmite (pausar, trocar de fonte, qualidade, parar), e o "assistindo"
        tem os controles de quem olha (volume, qualidade recebida, fila). Um
        botão só que abrisse a mesma tela para os dois daria a metade errada
        das ações para cada lado.
      */}
      {transmitindo ? (
        <button
          type="button"
          className={css.assistir}
          onClick={() =>
            definirPalco(
              eu ? { tipo: "transmitindo" } : { tipo: "assistindo", userId },
            )
          }
        >
          {eu ? "Ver transmissão" : "Assistir"}
        </button>
      ) : null}
    </div>
  );
});

/* ============================================================
   Hooks
   ============================================================ */

/**
 * Pede o vídeo de alguém enquanto este componente existe, e devolve ao sair.
 *
 * ⚠ **A devolução é a metade que se esquece, e a que custa.** Sem ela, fechar
 * a grade deixaria dez faixas descendo para uma tela que não existe mais —
 * invisível na interface e visível na conta de banda.
 */
function useVideo(userId: string, fonte: "camera" | "tela", quero: boolean) {
  useEffect(() => {
    if (!quero) return;
    assinarVideo(userId, fonte, true);
    return () => {
      assinarVideo(userId, fonte, false);
    };
  }, [userId, fonte, quero]);
}

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
