import {
  Microphone,
  MicrophoneSlash,
  Monitor,
  PhoneX,
  SpeakerHigh,
  SpeakerSlash,
  VideoCamera,
  VideoCameraSlash,
} from "@phosphor-icons/react";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Tooltip } from "../components/ui/Tooltip";
import {
  alternarCamera,
  alternarMudo,
  alternarSurdo,
  alternarTela,
  sairDaChamada,
} from "../sdk/chamada";
import {
  chaveDeVideo,
  faixasDeVideo,
  type FonteDeVideo,
} from "../store/video";
import css from "./pecasDeVoz.module.css";

/**
 * As peças que as três telas do palco compartilham.
 *
 * ⚠ **Elas nasceram dentro do palco de transmissão e saíram no mesmo passe em
 * que a grade e o "assistindo" foram escritos.** O selo de AO VIVO aparece nas
 * três, a doca em duas, e a faixa de vídeo em todas — deixá-las lá dentro
 * daria a mesma divergência que já custou seis cópias do `Avatar` e quatro do
 * cartão de opção.
 */

/* ============================================================
   Selo de AO VIVO
   ============================================================ */

/** ⚠ O pulso é OPACIDADE, nunca escala: escala refluiria a linha do cabeçalho. */
export function SeloAoVivo() {
  return (
    <span className={css.aoVivo}>
      <span className={css.pontoAoVivo} aria-hidden />
      AO VIVO
    </span>
  );
}

/* ============================================================
   Cronômetro
   ============================================================ */

/**
 * Quanto tempo no ar.
 *
 * ⚠ **Componente próprio, e o store guarda o INSTANTE e não a duração.** Se os
 * segundos morassem em `Chamada`, o store publicaria sessenta vezes por minuto
 * e acordaria o cartão, a faixa do rodapé, o painel de usuário e a linha do
 * canal. Aqui o relógio é local e quem re-renderiza é este `<span>`.
 */
export function Cronometro({ desde }: { desde: number }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (desde === 0) return null;

  const total = Math.max(0, Math.floor((agora - desde) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");

  return (
    <span className={css.cronometro}>
      {mm}:{ss}
    </span>
  );
}

/* ============================================================
   Faixa de vídeo remota
   ============================================================ */

/**
 * O `<video>` de uma pessoa, ligado ao store de faixas.
 *
 * ⚠ **Assina UMA chave, e é a lei nº 1 na escala em que ela mais importa.**
 * Numa grade de vinte ladrilhos, alguém ligar a câmera acorda o ladrilho dela
 * — não a grade, não o palco, não a chamada.
 *
 * ⚠ **Devolve `null` sem faixa, e isso NÃO é um estado de erro.** Com
 * `autoSubscribe: false`, a faixa só existe depois de alguém pedir; quem
 * consome desenha o avatar enquanto ela não vem, que é o mesmo que desenha
 * para quem está com a câmera desligada. As duas situações são idênticas para
 * quem olha, e por isso não têm tratamento diferente.
 *
 * ⚠ **`muted` sempre.** O áudio de todo mundo vem por um caminho próprio, fora
 * da árvore React (ver `elementoDeAudio` no motor); deixar o elemento com som
 * daria a mesma voz duas vezes, uma delas fora de sincronia.
 */
export const FaixaDeVideo = memo(function FaixaDeVideo({
  userId,
  fonte,
  className,
  espelhada,
}: {
  userId: string;
  fonte: FonteDeVideo;
  className?: string;
  /** Só a própria câmera. Ver o comentário de `.espelhada`. */
  espelhada?: boolean;
}) {
  const chave = chaveDeVideo(userId, fonte);
  const faixa = useSyncExternalStore(
    faixasDeVideo.subscriber(chave),
    () => faixasDeVideo.getSnapshot(chave),
  );
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || !faixa) return;
    el.srcObject = new MediaStream([faixa]);
    return () => {
      el.srcObject = null;
    };
  }, [faixa]);

  if (!faixa) return null;

  return (
    <video
      ref={video}
      className={className ?? css.video}
      data-espelhada={espelhada ?? false}
      autoPlay
      muted
      playsInline
    />
  );
});

/* ============================================================
   Doca de controles
   ============================================================ */

/**
 * Os controles da chamada, no rodapé do palco.
 *
 * ⚠ **Ela precisa existir aqui porque o palco COBRE o cartão flutuante.** Sem
 * a doca, transmitindo a pessoa perderia o microfone, a câmera e o desligar —
 * e silenciar-se durante uma apresentação é a ação mais frequente que existe
 * nesta tela. Foi por isso que o design a desenhou, e o motivo vale letra por
 * letra aqui.
 *
 * ⚠ **"Parar de transmitir" NÃO está nela.** Ele mora no HUD da prancha, e a
 * separação é instrução do design com razão escrita: assim "parar de
 * transmitir" e "desligar a chamada" nunca ficam vizinhos. Errar o alvo entre
 * os dois custa a chamada inteira.
 */
export function Doca({
  mudo,
  surdo,
  camera,
  tela,
}: {
  mudo: boolean;
  surdo: boolean;
  camera: boolean;
  /**
   * Já está transmitindo?
   *
   * Quando sim, o botão de tela sai da doca — quem transmite tem o HUD da
   * prancha, e dois alvos de "parar" em telas diferentes é como se erra o
   * caminho. Quando não, ele entra: da GRADE é de onde se começa a
   * transmitir.
   */
  tela: boolean;
}) {
  return (
    <footer className={css.doca}>
      <ControleDaDoca
        nome="Microfone"
        ligado={!mudo}
        acao={mudo ? "Ativar microfone" : "Silenciar microfone"}
        perigo={mudo}
        onClick={() => void alternarMudo()}
      >
        {mudo ? (
          <MicrophoneSlash size={17} aria-hidden />
        ) : (
          <Microphone size={17} aria-hidden />
        )}
      </ControleDaDoca>

      <ControleDaDoca
        nome="Câmera"
        ligado={camera}
        acao={camera ? "Desligar câmera" : "Ligar câmera"}
        onClick={() => void alternarCamera()}
      >
        {camera ? (
          <VideoCamera size={17} aria-hidden />
        ) : (
          <VideoCameraSlash size={17} aria-hidden />
        )}
      </ControleDaDoca>

      <ControleDaDoca
        nome="Áudio recebido"
        ligado={!surdo}
        acao={surdo ? "Voltar a ouvir" : "Parar de ouvir"}
        perigo={surdo}
        onClick={() => void alternarSurdo()}
      >
        {surdo ? (
          <SpeakerSlash size={17} aria-hidden />
        ) : (
          <SpeakerHigh size={17} aria-hidden />
        )}
      </ControleDaDoca>

      {tela ? null : (
        <ControleDaDoca
          nome="Compartilhamento de tela"
          ligado={false}
          acao="Compartilhar tela"
          onClick={() => void alternarTela()}
        >
          <Monitor size={17} aria-hidden />
        </ControleDaDoca>
      )}

      <span className={css.divisaDaDoca} aria-hidden />

      <button
        type="button"
        className={css.desligar}
        onClick={() => void sairDaChamada()}
      >
        <PhoneX size={16} aria-hidden />
        Desligar
      </button>
    </footer>
  );
}

export function ControleDaDoca({
  nome,
  ligado,
  acao,
  perigo,
  onClick,
  children,
}: {
  nome: string;
  ligado: boolean;
  acao: string;
  perigo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip texto={acao} lado="acima">
      <button
        type="button"
        className={css.controleDaDoca}
        /* Nome do RECURSO no rótulo, estado no `aria-pressed` — a ação vai no
           tooltip. É a regra que o lint deste projeto cobrou nos controles do
           painel de usuário, e ela vale igual aqui. */
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
   Tela cheia
   ============================================================ */

/**
 * Põe o PALCO inteiro em tela cheia, e não só o vídeo.
 *
 * ⚠ **O alvo é a moldura, e a escolha tem consequência.** Em tela cheia sobre
 * o `<video>` sozinho, o navegador desenha os controles DELE e some com o
 * nosso chrome — cronômetro, selo de ao vivo, HUD, fila e doca, que é
 * exatamente o que estas telas existem para mostrar. Com a moldura, tudo
 * continua onde estava e só a janela cresce.
 *
 * `[data-palco]` e não um `ref` encadeado: quem pede tela cheia são duas telas
 * diferentes, e passar uma referência da moldura por props através das duas
 * seria um fio atravessando o componente inteiro para um clique.
 */
export function emTelaCheia(): void {
  const palco = document.querySelector("[data-palco]");
  if (palco instanceof HTMLElement) void palco.requestFullscreen?.();
}
