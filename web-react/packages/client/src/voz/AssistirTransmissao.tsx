import {
  ArrowsOut,
  Check,
  ICONE,
  Microphone,
  MicrophoneSlash,
  Monitor,
  PictureInPicture,
  SpeakerHigh,
  SpeakerSlash,
  Users,
  VideoCamera,
  VideoCameraSlash,
} from "../components/ui/icones";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Avatar } from "../components/ui/Avatar";
import { Deslizante } from "../components/ui/Deslizante";
import { Tooltip } from "../components/ui/Tooltip";
import { toast } from "../components/ui/toastStore";
import { aindaNao } from "../pendente/pendencias";
import {
  alternarCamera,
  alternarMudo,
  alternarSurdo,
  alternarTela,
  assinarVideo,
  definirQualidadeDeStream,
  definirVolumeDe,
  volumeDe,
} from "../sdk/chamada";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { useChannel, usePessoa, useServer } from "../store/hooks";
import { definirPalco } from "../store/palcoDeVoz";
import { chaveDeVideo, faixasDeVideo } from "../store/video";
import { emTelaCheia, FaixaDeVideo, SeloAoVivo } from "./pecasDeVoz";
import css from "./AssistirTransmissao.module.css";

/**
 * Assistindo a transmissão de alguém.
 *
 * ⚠ **"Parar de assistir" volta para a GRADE, e nunca desliga.** É instrução
 * literal do design, e a razão é a mesma que separou "parar de transmitir" de
 * "desligar" no outro palco: sair da voz é sempre um botão separado. Quem
 * fecha um vídeo não está pedindo para sair da conversa.
 *
 * ⚠ **O vídeo só desce enquanto esta tela existe.** Com `autoSubscribe:
 * false`, a faixa é pedida no monte e devolvida no desmonte. Sem a devolução,
 * fechar a tela deixaria o stream descendo para ninguém — invisível na
 * interface e caro na banda, que é o pior par possível.
 */

const QUALIDADES = ["auto", "alta", "media", "soAudio"] as const;
type Qualidade = (typeof QUALIDADES)[number];

const NOME_DA_QUALIDADE: Record<Qualidade, string> = {
  auto: "Automática",
  alta: "1080p · 30 fps",
  media: "720p · 30 fps",
  soAudio: "Só áudio",
};

/** O que o design promete: o chrome some depois de 3 s sem ponteiro. */
const OCULTAR_APOS_MS = 3000;

export function AssistirTransmissao({ userId }: { userId: string }) {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(chamada.channelId);
  const servidor = useServer(canal?.serverId ?? "");
  const autor = usePessoa(userId);

  const [visivel, mostrar] = useChromeQueSome();
  const [menu, setMenu] = useState(false);
  const [submenu, setSubmenu] = useState(false);
  const [qualidade, setQualidade] = useState<Qualidade>("auto");
  const [volume, setVolume] = useState(() => Math.round(volumeDe(userId) * 100));

  /*
    O pedido e a devolução. Ver o comentário do topo — a devolução é a metade
    que se esquece, e a que custa.
  */
  useEffect(() => {
    assinarVideo(userId, "tela", true);
    return () => {
      assinarVideo(userId, "tela", false);
    };
  }, [userId]);

  const chave = chaveDeVideo(userId, "tela");
  const chegou =
    useSyncExternalStore(faixasDeVideo.subscriber(chave), () =>
      faixasDeVideo.getSnapshot(chave),
    ) !== undefined;

  const fila = chamada.participantes.filter((id) => id !== userId);
  const naFila = fila.slice(0, 2);
  const resto = fila.length - naFila.length;

  return (
    <div
      className={css.tela}
      data-chrome={visivel}
      onPointerMove={mostrar}
      onPointerDown={mostrar}
    >
      <FaixaDeVideo userId={userId} fonte="tela" className={css.video} />

      {/*
        ⚠ **O texto no meio só existe SEM quadro.** Sobre a imagem ele seria
        ruído permanente em cima do conteúdo que a tela existe para mostrar —
        a mesma razão que tirou o selo de língua de cima da primeira linha do
        bloco de código.
      */}
      {chegou ? null : (
        <div className={css.placa}>
          <span className={css.placaLinha}>
            stream de {autor?.displayName ?? "alguém"}
          </span>
          <span className={css.placaNota}>
            {qualidade === "soAudio"
              ? "só áudio — o vídeo foi desligado por você"
              : "pedindo o vídeo…"}
          </span>
        </div>
      )}

      {/* ------------------------------------------------- chrome de cima */}
      <header className={css.cabecalho}>
        <Avatar
          id={userId}
          sigla={autor?.sigla}
          url={autor?.avatarUrl}
          tamanho="md"
        />
        <span className={css.identidade}>
          <span className={css.nome}>{autor?.displayName ?? "alguém"}</span>
          <span className={css.lugar}>
            {canal?.name ?? "voz"} · {servidor?.name ?? ""}
          </span>
        </span>
        <SeloAoVivo />

        <span className={css.espaco} />

        {/*
          ⚠ **"N na sala", e nunca "N assistindo".** Nem o protocolo do Stoat
          nem o `livekit-client` produzem contagem de espectadores — quem
          publica não recebe contagem de assinantes, isso é webhook de
          servidor. O design escreve "👁 3"; escrever isso sobre a contagem de
          quem está na sala seria afirmar na tela algo que ninguém mediu.
        */}
        <span className={css.chip}>
          <Users size={ICONE.metadado} aria-hidden />
          {chamada.participantes.length}
        </span>

        <div className={css.acoes}>
          <BotaoDePip />
          <Tooltip texto="Tela cheia" lado="abaixo">
            <button
              type="button"
              className={css.acao}
              aria-label="Tela cheia"
              onClick={emTelaCheia}
            >
              <ArrowsOut size={ICONE.controle} aria-hidden />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* ------------------------------------------------- menu do tile */}
      {menu ? (
        <div className={css.menu}>
          <div className={css.sobrancelha}>Menu do tile</div>
          <div className={css.itens}>
            <button
              type="button"
              className={css.item}
              onClick={() => {
                definirPalco({ tipo: "grade" });
              }}
            >
              Ver na grade
              <span className={css.atalho}>G</span>
            </button>

            <button
              type="button"
              className={css.item}
              aria-expanded={submenu}
              data-aberto={submenu}
              onClick={() => setSubmenu((v) => !v)}
            >
              Qualidade do stream
              <span className={css.seta} aria-hidden>
                ›
              </span>
            </button>

            <button
              type="button"
              className={css.item}
              onClick={() => {
                definirVolumeDe(userId, 0);
                setVolume(0);
              }}
            >
              Silenciar só para mim
            </button>

            {/*
              ⚠ **"Fixar participante" do design virou "Ver na grade", e
              "Ver perfil" ficou.** Fixar aqui não quer dizer nada: você já
              está em tela cheia numa pessoa só. No design este é o menu do
              LADRILHO reusado, e fixar pertence à grade — é onde ele está.
            */}
            <button
              type="button"
              className={css.item}
              onClick={aindaNao("perfilNaChamada")}
            >
              Ver perfil
            </button>

            <hr className={css.regua} aria-hidden />

            <label className={css.rotuloDoVolume} htmlFor="volume-individual">
              Volume individual
              <span className={css.valorDoVolume}>{volume}%</span>
            </label>
            {/*
              ⚠ **`Deslizante` de `components/ui`, e o lint do projeto me
              pegou escrevendo o `<input type="range">` cru.** A regra existe
              porque o range nativo chega com o cromo do SISTEMA — no Windows,
              trilho azul claro dentro de um menu escuro. O primitivo é este
              mesmo input, pintado, e trazê-lo aqui matou de quebra vinte
              linhas de pseudo-elemento duplicadas neste módulo.
            */}
            <Deslizante
              id="volume-individual"
              valor={volume}
              min={0}
              max={200}
              passo={5}
              rotulo="Volume individual"
              texto={`${String(volume)} por cento`}
              aoMudar={(v) => {
                setVolume(v);
                definirVolumeDe(userId, v / 100);
              }}
            />
          </div>
        </div>
      ) : null}

      {menu && submenu ? (
        <div className={css.submenu} role="radiogroup" aria-label="Qualidade do stream">
          {QUALIDADES.map((q) => (
            <button
              key={q}
              type="button"
              role="radio"
              aria-checked={qualidade === q}
              className={css.itemDoSubmenu}
              data-secundario={q === "soAudio"}
              onClick={() => {
                setQualidade(q);
                definirQualidadeDeStream(userId, "tela", q);
              }}
            >
              {NOME_DA_QUALIDADE[q]}
              {qualidade === q ? (
                <Check size={ICONE.selo} className={css.marca} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* ------------------------------------------------- fila do canto */}
      <div className={css.fila}>
        {naFila.map((id) => (
          <MiniLadrilho key={id} userId={id} />
        ))}
        {resto > 0 ? (
          <button
            type="button"
            className={css.maisPessoas}
            onClick={() => {
              definirPalco({ tipo: "grade" });
            }}
          >
            +{resto}
          </button>
        ) : null}
      </div>

      {/* ------------------------------------------------- barra de baixo */}
      <div className={css.barra}>
        <ControleRedondo
          nome="Microfone"
          ligado={!chamada.mudo}
          perigo={chamada.mudo}
          acao={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}
          onClick={() => void alternarMudo()}
        >
          {chamada.mudo ? (
            <MicrophoneSlash size={ICONE.controle} aria-hidden />
          ) : (
            <Microphone size={ICONE.controle} aria-hidden />
          )}
        </ControleRedondo>

        <ControleRedondo
          nome="Áudio recebido"
          ligado={!chamada.surdo}
          perigo={chamada.surdo}
          acao={chamada.surdo ? "Voltar a ouvir" : "Parar de ouvir"}
          onClick={() => void alternarSurdo()}
        >
          {chamada.surdo ? (
            <SpeakerSlash size={ICONE.controle} aria-hidden />
          ) : (
            <SpeakerHigh size={ICONE.controle} aria-hidden />
          )}
        </ControleRedondo>

        <ControleRedondo
          nome="Câmera"
          ligado={chamada.camera}
          acao={chamada.camera ? "Desligar câmera" : "Ligar câmera"}
          onClick={() => void alternarCamera()}
        >
          {chamada.camera ? (
            <VideoCamera size={ICONE.controle} aria-hidden />
          ) : (
            <VideoCameraSlash size={ICONE.controle} aria-hidden />
          )}
        </ControleRedondo>

        {/*
          "Transmitir também" — real, e é o mesmo `alternarTela` de sempre.
          ⚠ Ele NÃO fecha esta tela: o palco troca sozinho para "transmitindo"
          quando a sua faixa sobe, porque quem transmite precisa ver o que
          está transmitindo. Ver `alternarTela` no motor.
        */}
        <button
          type="button"
          className={css.transmitirTambem}
          onClick={() => void alternarTela()}
        >
          <Monitor size={ICONE.controle} aria-hidden />
          Transmitir também
        </button>

        {/* O menu do tile fica atrás de um alvo, e não de um clique no vídeo:
            clicar no vídeo é o gesto de pausar em todo player do mundo, e
            este não pausa nada. */}
        <button
          type="button"
          className={css.transmitirTambem}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          Opções
        </button>

        <span className={css.divisa} aria-hidden />

        <button
          type="button"
          className={css.pararDeAssistir}
          onClick={() => {
            definirPalco({ tipo: "grade" });
          }}
        >
          Parar de assistir
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Peças locais
   ============================================================ */

const MiniLadrilho = memo(function MiniLadrilho({
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
    <div className={css.mini} data-falando={ativo}>
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho="sm"
      />
      <span className={css.miniNome}>{pessoa?.displayName ?? "alguém"}</span>
      {ativo ? <span className="sr-only">falando</span> : null}
    </div>
  );
});

function ControleRedondo({
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
        className={css.redondo}
        /* Nome do RECURSO, estado no `aria-pressed`, ação no tooltip — a regra
           que o lint deste projeto cobrou nos controles de microfone. */
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

function BotaoDePip() {
  if (!("pictureInPictureEnabled" in document)) return null;

  return (
    <Tooltip texto="Picture-in-picture" lado="abaixo">
      <button
        type="button"
        className={css.acao}
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
   O chrome que some
   ============================================================ */

/**
 * Esconde cabeçalho, fila e barra depois de 3 s sem ponteiro.
 *
 * ⚠ **Anima só OPACIDADE, e nada reposiciona o vídeo ao aparecer.** É
 * instrução do design com a razão escrita: as três camadas flutuam sobre a
 * imagem, então mostrar e esconder não pode mexer no layout — um vídeo que
 * salta 50px a cada movimento do mouse é intolerável em 40 minutos de
 * apresentação.
 *
 * ⚠ **`visibility` junto da opacidade**, e não só opacidade: com `opacity: 0`
 * sozinha os alvos continuariam recebendo tabulação e clique, então um clique
 * no vídeo cairia num botão invisível. É a mesma decisão da barra de ações da
 * linha de mensagem, aqui com consequência pior.
 */
function useChromeQueSome(): [boolean, () => void] {
  const [visivel, setVisivel] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const mostrar = useCallback(() => {
    setVisivel(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisivel(false), OCULTAR_APOS_MS);
  }, []);

  /*
    ⚠ **Agenda o SUMIÇO e não chama `mostrar()`, e a diferença é a regra do
    projeto.** `mostrar` faz `setState`, e `setState` no corpo de um efeito
    produz render em cascata — o lint reprova. Aqui não há o que mostrar: o
    chrome já nasce visível, e o que falta é só o relógio para ele sumir.
  */
  useEffect(() => {
    timer.current = setTimeout(() => setVisivel(false), OCULTAR_APOS_MS);
    return () => clearTimeout(timer.current);
  }, []);

  return [visivel, mostrar];
}
