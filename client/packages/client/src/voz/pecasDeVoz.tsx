import {
  ArrowsIn,
  ArrowsOut,
  CaretDown,
  DotsThree,
  ICONE,
  Microphone,
  MicrophoneSlash,
  Monitor,
  MusicNotes,
  PhoneX,
  Rows,
  SpeakerHigh,
  SpeakerSlash,
  VideoCamera,
  VideoCameraSlash,
} from "../components/ui/icones";
import { memo, useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/Popover";
import { Tooltip } from "../components/ui/Tooltip";
import {
  alternarCamera,
  alternarMudo,
  alternarSurdo,
  alternarTela,
  assinarVideo,
  sairDaChamada,
} from "../sdk/chamada";
import { Soundboard } from "../seletores/Soundboard";
import { assinarChamada, lerChamada } from "../store/chamada";
import { abrirConfig } from "../store/config";
import {
  comNome,
  PADRAO_DO_SISTEMA,
  useDispositivos,
} from "../store/dispositivos";
import { abrirModal } from "../store/modais";
import { fecharPalco } from "../store/palcoDeVoz";
import { definirFormaDoPopout } from "../store/popout";
import {
  assinarPreferenciasDeVoz,
  definirPreferenciasDeVoz,
  lerPreferenciasDeVoz,
} from "../store/preferenciasDeVoz";
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
   Pedido de vídeo
   ============================================================ */

/**
 * Pede o vídeo de alguém enquanto este componente existe, e devolve ao sair.
 *
 * Mora aqui e não na grade desde que a chamada DIRETA passou a pedir o vídeo
 * de quem está do outro lado — duas cópias do pedido e da devolução seriam
 * duas chances de esquecer a devolução.
 *
 * ⚠ **A devolução é a metade que se esquece, e a que custa.** Sem ela, fechar
 * a grade deixaria dez faixas descendo para uma tela que não existe mais —
 * invisível na interface e visível na conta de banda.
 */
export function useVideo(userId: string, fonte: "camera" | "tela", quero: boolean) {
  useEffect(() => {
    if (!quero) return;
    assinarVideo(userId, fonte, true);
    return () => {
      assinarVideo(userId, fonte, false);
    };
  }, [userId, fonte, quero]);
}

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
  onde,
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
  /**
   * Qual tela a monta — e as duas não têm a mesma doca.
   *
   * ⚠ **O design desenha DUAS ordens, e elas não são descuido.** A grade
   * (D-DVM-17) é `🎤 · 🎧 · 📹 · ◧ · ♪ · ◎ · Sair da chamada`: ouvir vem
   * colado a falar, porque numa sala o par é o que se mexe junto. O palco
   * (D-TELA-18) é `🎤▾ · 📹▾ · ◧ · ◎ · ♪ · ⋯ · Desligar`: ali quem manda é a
   * transmissão, e os dois dispositivos de captura ficam lado a lado com o
   * `▾`. O `⋯` só existe no palco — a grade termina em `◎`.
   */
  onde: "grade" | "palco";
}) {
  const microfone = (
    <ComOpcoes key="mic" rotulo="Opções de áudio" menu={<OpcoesDoMicrofone />}>
      <ControleDaDoca
        nome="Microfone"
        ligado={!mudo}
        acao={mudo ? "Ativar microfone" : "Silenciar microfone"}
        perigo={mudo}
        onClick={() => void alternarMudo()}
      >
        {mudo ? (
          <MicrophoneSlash size={ICONE.controle} aria-hidden />
        ) : (
          <Microphone size={ICONE.controle} aria-hidden />
        )}
      </ControleDaDoca>
    </ComOpcoes>
  );

  const capturaDeCamera = (
    <ComOpcoes key="camera" rotulo="Opções de câmera" menu={<OpcoesDaCamera />}>
      <ControleDaDoca
        nome="Câmera"
        ligado={camera}
        acao={camera ? "Desligar câmera" : "Ligar câmera"}
        onClick={() => void alternarCamera()}
      >
        {camera ? (
          <VideoCamera size={ICONE.controle} aria-hidden />
        ) : (
          <VideoCameraSlash size={ICONE.controle} aria-hidden />
        )}
      </ControleDaDoca>
    </ComOpcoes>
  );

  const ouvir = (
    <ControleDaDoca
      key="ouvir"
      nome="Áudio recebido"
      ligado={!surdo}
      acao={surdo ? "Voltar a ouvir" : "Parar de ouvir"}
      perigo={surdo}
      onClick={() => void alternarSurdo()}
    >
      {surdo ? (
        <SpeakerSlash size={ICONE.controle} aria-hidden />
      ) : (
        <SpeakerHigh size={ICONE.controle} aria-hidden />
      )}
    </ControleDaDoca>
  );

  const compartilhar = tela ? null : (
    <ControleDaDoca
      key="tela"
      nome="Compartilhamento de tela"
      ligado={false}
      acao="Compartilhar tela"
      onClick={() => void alternarTela()}
    >
      <Monitor size={ICONE.controle} aria-hidden />
    </ControleDaDoca>
  );

  /* ◎ e ♪ — os mesmos destinos da faixa de voz do rodapé, porque o palco a
     COBRE: sem eles aqui, abrir uma atividade ou tocar um som exigiria sair
     da tela. As teclas 1–9 do soundboard seguem montadas UMA vez, na faixa. */
  const atividades = (
    <ControleDaDoca
      key="atividades"
      nome="Atividades"
      acao="Atividades"
      onClick={() => abrirModal("atividades")}
    >
      <Rows size={ICONE.controle} aria-hidden />
    </ControleDaDoca>
  );

  const soundboard = (
    <Popover key="soundboard">
      <Tooltip texto="Soundboard" lado="acima">
        <PopoverTrigger asChild>
          <button type="button" className={css.controleDaDoca} aria-label="Soundboard">
            <MusicNotes size={ICONE.controle} aria-hidden />
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="p-02" side="top">
        <Soundboard />
      </PopoverContent>
    </Popover>
  );

  const sair = onde === "grade" ? "Sair da chamada" : "Desligar";

  const controles =
    onde === "grade"
      ? [microfone, ouvir, capturaDeCamera, compartilhar, soundboard, atividades]
      : [
          microfone,
          capturaDeCamera,
          ouvir,
          compartilhar,
          atividades,
          soundboard,
          <MenuDaChamada key="mais" acao="Mais opções">
            <button type="button" className={css.controleDaDoca} aria-label="Mais opções">
              <DotsThree size={ICONE.controle} aria-hidden />
            </button>
          </MenuDaChamada>,
        ];

  return (
    <footer className={css.doca}>
      {controles}

      <span className={css.divisaDaDoca} aria-hidden />

      {/* O verbo também é do design, e muda com a tela: da SALA se sai, e o
          palco diz "Desligar" (D-TELA-18). No `aria-label` também, porque em
          doca estreita o texto some e fica só o ícone. */}
      <button
        type="button"
        className={css.desligar}
        aria-label={sair}
        onClick={() => void sairDaChamada()}
      >
        <PhoneX size={ICONE.controle} aria-hidden />
        <span className={css.rotuloDeSair}>{sair}</span>
      </button>
    </footer>
  );
}

/* ============================================================
   ⋯ — o menu da chamada (D-VOZ-24, D-TELA-18)
   ============================================================ */

/**
 * O `⋯` da chamada direta e da doca do palco — UM menu, nas duas.
 *
 * ⚠ **O design desenha o alvo e não o menu, e este não inventa nada.** Os
 * itens são ações que JÁ existem e que a barra de cada tela deixou de fora:
 * a chamada direta não tem `🎧` nem `▾`, e sem este menu ensurdecer e trocar
 * de fone exigiriam fechar a tela. Tela cheia e janela flutuante são as do
 * cabeçalho da grade. Dois menus com os mesmos itens divergem no primeiro que
 * ganha um item novo — por isso é um componente, e as duas telas só dão o
 * gatilho.
 *
 * O gatilho vem como filho porque cada barra tem o PRÓPRIO botão (44px na
 * doca, o da barra flutuante na direta). `Tooltip` por fora do
 * `DropdownMenuTrigger`, como o `♪` do soundboard: `asChild` sobre um Root do
 * Radix não pousa em DOM nenhum, e o clique morreria sem erro.
 */
export function MenuDaChamada({
  acao,
  children,
}: {
  acao: string;
  children: React.ReactElement;
}) {
  return (
    <DropdownMenu>
      <Tooltip texto={acao} lado="acima">
        <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent side="top" align="end">
        <ItensDaChamada />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/*
  Só monta com o menu aberto — então as assinaturas (surdo, tela cheia) e as
  listas de dispositivo existem enquanto alguém está escolhendo, como no `▾`.
*/
function ItensDaChamada() {
  const surdo = useSyncExternalStore(assinarChamada, () => lerChamada().surdo);
  const cheia = useEmTelaCheia();
  return (
    <>
      <DropdownMenuCheckboxItem
        marcado={surdo}
        aoAlternar={() => void alternarSurdo()}
      >
        Ensurdecer
      </DropdownMenuCheckboxItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Microfone e saída de áudio</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <OpcoesDoMicrofone />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Câmera</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <OpcoesDaCamera />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={cheia ? sairDaTelaCheia : emTelaCheia}>
        {cheia ? "Sair da tela cheia" : "Tela cheia"}
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={() => {
          definirFormaDoPopout("popout");
          fecharPalco();
        }}
      >
        Janela flutuante
      </DropdownMenuItem>
    </>
  );
}

/* ============================================================
   ▾ — opções de dispositivo (D-TELA-18)
   ============================================================ */

/**
 * O controle com o `▾` no canto.
 *
 * ⚠ **Dois botões IRMÃOS, e nunca um dentro do outro.** Botão dentro de
 * botão é HTML inválido: o navegador reestrutura a árvore e o clique no `▾`
 * acionaria também o microfone — silenciar-se sem querer para trocar de
 * fone. O invólucro só dá o contexto de posição.
 *
 * O controle continua no mesmo lugar com o menu aberto ou fechado: é regra
 * do design ("controles ficam no mesmo lugar"), e é por isso que o `▾` é
 * `absolute` e não entra no fluxo.
 */
function ComOpcoes({
  rotulo,
  menu,
  children,
}: {
  rotulo: string;
  menu: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={css.comOpcoes}>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={css.opcoes} aria-label={rotulo}>
            <CaretDown aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/*
  ⚠ **As listas vivem no CONTEÚDO do menu, e ele só monta aberto.** O
  `devicechange` e a assinatura das preferências existem enquanto alguém
  está escolhendo — a doca fechada não escuta nada, e ligar um fone no meio
  da chamada não acorda a barra.
*/

function usePreferencias() {
  return useSyncExternalStore(assinarPreferenciasDeVoz, lerPreferenciasDeVoz);
}

function ListaDeDispositivos({
  tipo,
  titulo,
  escolhido,
  aoEscolher,
}: {
  tipo: MediaDeviceKind;
  titulo: string;
  escolhido: string | undefined;
  aoEscolher: (id: string | undefined) => void;
}) {
  const lista = comNome(useDispositivos(tipo));
  /* Um id guardado de um fone que não está mais plugado cai no padrão —
     marcar um item que não existe deixaria o menu sem nenhuma marca. */
  const vale = lista.some((d) => d.deviceId === escolhido) ? escolhido : undefined;

  return (
    <>
      <DropdownMenuLabel>{titulo}</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        marcado={vale === undefined}
        aoAlternar={() => aoEscolher(undefined)}
      >
        {PADRAO_DO_SISTEMA}
      </DropdownMenuCheckboxItem>
      {lista.map((d) => (
        <DropdownMenuCheckboxItem
          key={d.deviceId}
          marcado={vale === d.deviceId}
          aoAlternar={() => aoEscolher(d.deviceId)}
        >
          {d.label}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

function ItemDeConfiguracoes() {
  return (
    <DropdownMenuItem onSelect={() => abrirConfig("vozEVideo")}>
      Configurações de voz e vídeo
    </DropdownMenuItem>
  );
}

/*
  Escrever a preferência É trocar o dispositivo: o motor assina as
  preferências enquanto a sala existe e chama `switchActiveDevice` — o mesmo
  caminho de Configurações › Voz e vídeo, então as duas telas não podem
  discordar sobre qual microfone está aberto.
*/

function OpcoesDoMicrofone() {
  const p = usePreferencias();
  return (
    <>
      <ListaDeDispositivos
        tipo="audioinput"
        titulo="Microfone"
        escolhido={p.entradaId}
        aoEscolher={(entradaId) => definirPreferenciasDeVoz({ entradaId })}
      />
      <DropdownMenuSeparator />
      <ListaDeDispositivos
        tipo="audiooutput"
        titulo="Saída de áudio"
        escolhido={p.saidaId}
        aoEscolher={(saidaId) => definirPreferenciasDeVoz({ saidaId })}
      />
      <DropdownMenuSeparator />
      <ItemDeConfiguracoes />
    </>
  );
}

function OpcoesDaCamera() {
  const p = usePreferencias();
  return (
    <>
      <ListaDeDispositivos
        tipo="videoinput"
        titulo="Câmera"
        escolhido={p.cameraId}
        aoEscolher={(cameraId) => definirPreferenciasDeVoz({ cameraId })}
      />
      <DropdownMenuSeparator />
      <ItemDeConfiguracoes />
    </>
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
  /**
   * Estado de um controle que ALTERNA. Ausente num que só abre algo (◎, ⋯):
   * `aria-pressed="false"` ali anunciaria "desligado" sobre um botão que
   * não tem estado.
   */
  ligado?: boolean;
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

/** Sai da tela cheia — o `⤡` do design (D-TELA-20). */
export function sairDaTelaCheia(): void {
  if (document.fullscreenElement) void document.exitFullscreen?.();
}

function assinarTelaCheia(ouvinte: () => void): () => void {
  document.addEventListener("fullscreenchange", ouvinte);
  return () => document.removeEventListener("fullscreenchange", ouvinte);
}

function lerTelaCheia(): boolean {
  return (document.fullscreenElement ?? null) !== null;
}

/**
 * O documento está em tela cheia?
 *
 * ⚠ **Ouve `fullscreenchange`, e não guarda o que o botão pediu.** A saída
 * mais comum é o `Esc` do NAVEGADOR, que não passa por código nosso; um
 * estado local ficaria dizendo "tela cheia" numa janela que já saiu dela, e
 * o botão mostraria `⤡` para uma ação que não tem o que desfazer.
 */
export function useEmTelaCheia(): boolean {
  return useSyncExternalStore(assinarTelaCheia, lerTelaCheia, () => false);
}

/**
 * `⤢` fora da tela cheia, `⤡ Sair da tela cheia` dentro (D-TELA-20).
 *
 * Um botão só que troca, e não dois: o alvo fica no MESMO lugar, então quem
 * entrou com um clique sai com um clique sem procurar. O `Esc` nativo
 * continua valendo — este botão é para quem não sabe dele, ou está no mouse.
 */
export function BotaoDeTelaCheia({ className }: { className: string | undefined }) {
  const cheia = useEmTelaCheia();
  const rotulo = cheia ? "Sair da tela cheia" : "Tela cheia";
  return (
    <Tooltip texto={rotulo} lado="abaixo">
      <button
        type="button"
        className={className}
        aria-label={rotulo}
        onClick={cheia ? sairDaTelaCheia : emTelaCheia}
      >
        {cheia ? (
          <ArrowsIn size={ICONE.controle} aria-hidden />
        ) : (
          <ArrowsOut size={ICONE.controle} aria-hidden />
        )}
      </button>
    </Tooltip>
  );
}
