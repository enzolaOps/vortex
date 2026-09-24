import {
  ChatCircle,
  DotsThree,
  Microphone,
  MicrophoneSlash,
  Monitor,
  VideoCamera,
  VideoCameraSlash,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import {
  alternarCamera,
  alternarMudo,
  alternarTela,
  sairDaChamada,
} from "../sdk/chamada";
import { usuarioLocalId } from "../sdk/adapter";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { useChannel, usePessoa } from "../store/hooks";
import { fecharPalco } from "../store/palcoDeVoz";
import { Cronometro, FaixaDeVideo, MenuDaChamada, useVideo } from "./pecasDeVoz";
import css from "./ChamadaDireta.module.css";

/**
 * A chamada de duas pessoas — o vídeo de quem está do outro lado ocupa tudo,
 * o seu fica no canto, os controles flutuam embaixo.
 *
 * ⚠ **É a quarta tela do palco, e não uma variante da grade.** Numa DM a
 * grade daria dois ladrilhos de pesos iguais, e o design desenha outra coisa:
 * a pessoa com quem se fala é o conteúdo, e você é a CONFERÊNCIA ("estou
 * enquadrado?"). Quem escolhe entre as duas é o `PalcoDeVoz`, pelo tipo do
 * canal — grupo de DM continua na grade, que é o que o design desenha para
 * "Chamada em grupo de DM".
 *
 * Reusa o motor inteiro e as peças do palco: `FaixaDeVideo`, `useVideo`, o
 * `Cronometro` e o `falando`. O que é novo aqui é só a composição.
 */
export function ChamadaDireta({ channelId }: { channelId: string }) {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(channelId);

  /*
    ⚠ **O outro lado vem do CANAL, e não da lista de participantes.** Enquanto
    toca, quem ligou está sozinho na sala — `participantes` só tem você —, e
    a tela precisa dizer PARA QUEM se está ligando desde o primeiro quadro.
  */
  const outro = canal?.destinatarioId;
  const eu = chamada.participantes[0] ?? usuarioLocalId();
  const outroDentro = outro !== undefined && chamada.participantes.includes(outro);
  const outroComCamera = outroDentro && chamada.comCamera.includes(outro);

  return (
    /*
      ⚠ **`data-participante` na TELA, e sem ele o clique direito na chamada
      direta era morto — nem menu do app, nem nativo.** O
      `ComMenuDoParticipante` envolve o palco inteiro e resolve o alvo pelo
      ladrilho mais próximo; esta tela não marcava nenhum, então a mira
      devolvia "sem alvo" e o gatilho recusava abrir.

      Na SEÇÃO e não no avatar: com câmera ligada, o vídeo cobre a tela como
      irmão do avatar, e marcar só o avatar deixaria o clique direito morto
      justamente onde há o que olhar. O PiP próprio marca a si mesmo, e
      `closest` resolve o mais próximo.

      Numa chamada de DM não há moderação (não existe `ServerMember`): o que
      sobra é volume, "silenciar só para mim" e "ver perfil".
    */
    <section
      className={css.palco}
      aria-label="Chamada direta"
      data-participante={outro}
    >
      {outro ? (
        <Remoto userId={outro} dentro={outroDentro} comCamera={outroComCamera} />
      ) : null}

      <Identidade
        userId={outro}
        chamando={!outroDentro}
        desde={chamada.desde}
      />

      {eu ? <Proprio userId={eu} camera={chamada.camera} /> : null}

      <div className={css.barra} role="toolbar" aria-label="Controles da chamada">
        <Controle
          nome="Microfone"
          ligado={!chamada.mudo}
          acao={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}
          perigo={chamada.mudo}
          onClick={() => void alternarMudo()}
        >
          {chamada.mudo ? <MicrophoneSlash aria-hidden /> : <Microphone aria-hidden />}
        </Controle>
        <Controle
          nome="Câmera"
          ligado={chamada.camera}
          ativo={chamada.camera}
          acao={chamada.camera ? "Desligar câmera" : "Ligar câmera"}
          onClick={() => void alternarCamera()}
        >
          {chamada.camera ? <VideoCamera aria-hidden /> : <VideoCameraSlash aria-hidden />}
        </Controle>
        <Controle
          nome="Compartilhamento de tela"
          ligado={chamada.tela}
          ativo={chamada.tela}
          acao={chamada.tela ? "Parar de transmitir" : "Compartilhar tela"}
          onClick={() => void alternarTela()}
        >
          <Monitor aria-hidden />
        </Controle>
        {/* "Abrir chat" volta para a conversa sem sair da chamada — o cartão
            flutuante assume, como em qualquer sala. */}
        <Controle nome="Abrir chat" acao="Abrir chat" onClick={fecharPalco}>
          <ChatCircle aria-hidden />
        </Controle>
        {/* O MESMO menu do `⋯` da doca do palco — ensurdecer e os
            dispositivos, que esta barra não tem, moram nele. */}
        <MenuDaChamada acao="Mais ações">
          <button
            type="button"
            className={css.controle}
            aria-label="Mais ações"
            data-secundario="true"
          >
            <DotsThree aria-hidden />
          </button>
        </MenuDaChamada>

        <span className={css.divisa} aria-hidden />

        <button
          type="button"
          className={css.desligar}
          onClick={() => void sairDaChamada()}
        >
          Desligar
        </button>
      </div>
    </section>
  );
}

/* ============================================================
   As partes
   ============================================================ */

/**
 * O outro lado. Vídeo quando há câmera, avatar grande quando não há.
 *
 * ⚠ **O avatar fica SEMPRE embaixo, e o vídeo cobre** — a mesma armadilha do
 * ladrilho da grade: `comCamera` diz que a pessoa PUBLICOU, não que a faixa
 * já desceu, e entre pedir e receber a tela ficaria vazia.
 */
function Remoto({
  userId,
  dentro,
  comCamera,
}: {
  userId: string;
  dentro: boolean;
  comCamera: boolean;
}) {
  const pessoa = usePessoa(userId);
  const fala = useSyncExternalStore(
    falando.subscriber(userId),
    () => falando.getSnapshot(userId) ?? false,
  );
  useVideo(userId, "camera", comCamera);

  return (
    <>
      <div
        className={css.centro}
        data-falando={dentro && fala}
        data-dentro={dentro}
      >
        <Avatar id={userId} sigla={pessoa?.sigla} url={pessoa?.avatarUrl} tamanho="lg" />
      </div>
      {comCamera ? (
        <FaixaDeVideo
          userId={userId}
          fonte="camera"
          className={css.videoRemoto}
        />
      ) : null}
    </>
  );
}

function Identidade({
  userId,
  chamando,
  desde,
}: {
  userId: string | undefined;
  chamando: boolean;
  desde: number;
}) {
  const pessoa = usePessoa(userId ?? "");
  return (
    <div className={css.pilula}>
      <span className={css.nome}>{pessoa?.displayName ?? "Chamada"}</span>
      {/*
        ⚠ **"chamando…" no lugar do cronômetro enquanto o outro lado não
        entrou.** O design só desenha a chamada em andamento; um cronômetro
        contando enquanto ninguém atendeu diria que a conversa começou.
      */}
      {chamando ? (
        <span className={css.estado}>chamando…</span>
      ) : (
        <span className={css.tempo}>
          <Cronometro desde={desde} />
        </span>
      )}
    </div>
  );
}

/** A sua conferência, no canto. Espelhada — é a sua câmera. */
function Proprio({ userId, camera }: { userId: string; camera: boolean }) {
  const pessoa = usePessoa(userId);
  return (
    /* Marca a si mesmo: `closest` resolve o mais próximo, então o PiP abre o
       menu de VOCÊ e o resto da tela o do outro lado. */
    <div className={css.proprio} data-participante={userId}>
      {camera ? (
        <FaixaDeVideo
          userId={userId}
          fonte="camera"
          className={css.videoProprio}
          espelhada
        />
      ) : (
        <span className={css.semCamera}>
          <Avatar id={userId} sigla={pessoa?.sigla} url={pessoa?.avatarUrl} tamanho="sm" />
        </span>
      )}
      <span className={css.voce}>Você</span>
    </div>
  );
}

function Controle({
  nome,
  acao,
  ligado,
  ativo,
  perigo,
  onClick,
  children,
}: {
  nome: string;
  acao: string;
  /** Ausente em ação que não é estado — abrir o chat, o menu. */
  ligado?: boolean;
  /** Em acento: câmera e tela no ar. O microfone aberto é o NORMAL, não ativo. */
  ativo?: boolean;
  perigo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip texto={acao} lado="acima">
      <button
        type="button"
        className={css.controle}
        aria-label={nome}
        aria-pressed={ligado}
        data-perigo={perigo ?? false}
        data-ativo={ativo ?? false}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
