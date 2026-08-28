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
import { memo, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Tooltip } from "../components/ui/Tooltip";
import {
  alternarCamera,
  alternarMudo,
  alternarSurdo,
  alternarTela,
  sairDaChamada,
} from "../sdk/chamada";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { usePessoa } from "../store/hooks";
import { useCanalAtivo, useChannel } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import css from "./CartaoDeChamada.module.css";

/**
 * A chamada em andamento.
 *
 * ⚠ **Sobreposto ao topo da coluna de conteúdo, NUNCA no lugar dela** — é o
 * conflito nº 3 do plano de paridade resolvido. O upstream põe a chamada na
 * área de conteúdo, substituindo a conversa; aqui a âncora (coluna de mensagem
 * + composer) não move, porque é ela que protege a virtualização.
 *
 * Quando a pessoa navega para OUTRO canal, o cartão encolhe para o canto —
 * o modo PiP — em vez de sumir. Uma chamada que desaparece ao trocar de canal
 * é uma chamada que a pessoa acha que caiu.
 */

/** O anel de fala de uma pessoa. Assina SÓ a si mesmo. */
const Falante = memo(function Falante({ userId }: { userId: string }) {
  const pessoa = usePessoa(userId);
  /*
    ⚠ **A subscrição mais fina do app.**

    Este `useSyncExternalStore` é o único consumidor do store efêmero de fala.
    Quando alguém começa a falar, acorda ESTE avatar — não o cartão, não a
    coluna de canais, não a lista. É o aviso do `CLAUDE.md` virando código.
  */
  const ativo = useSyncExternalStore(
    falando.subscriber(userId),
    () => falando.getSnapshot(userId) ?? false,
  );

  return (
    <span className={css.pessoa} data-falando={ativo}>
      {/* `data-falando` no PAI: o anel de fala é do container, não do
          avatar — é ele que ganha a sombra, e o avatar continua sendo a
          mesma peça de sempre. */}
      <Avatar id={userId} sigla={pessoa?.sigla} tamanho="sm" />
      <span className={css.nomeDaPessoa}>
        {pessoa?.displayName ?? "alguém"}
      </span>
      {/* O anel é visual; para quem não vê, o texto é o que carrega o estado —
          presença e fala nunca só por cor ou forma. */}
      {ativo ? <span className="sr-only">falando</span> : null}
    </span>
  );
});

export function CartaoDeChamada() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canalAberto = useCanalAtivo();
  const canal = useChannel(chamada.channelId);

  if (chamada.estado === "fora") return null;

  /*
    Encolhido quando a pessoa está OLHANDO outro canal.

    Não é "minimizado por escolha": é o cartão sabendo que virou contexto de
    fundo. Quem volta ao canal da chamada vê o cartão inteiro de novo, sem
    apertar nada.
  */
  const compacto = canalAberto !== chamada.channelId;

  return (
    <section
      className={css.cartao}
      data-compacto={compacto}
      aria-label={`Chamada em ${canal?.name ?? "voz"}`}
    >
      <header className={css.cabecalho}>
        <button
          type="button"
          className={css.destino}
          onClick={() => selecionarCanal(chamada.channelId)}
        >
          <span className={css.nome}>{canal?.name ?? "voz"}</span>
          <span className={css.estado}>
            {chamada.estado === "conectando"
              ? "entrando…"
              : chamada.estado === "reconectando"
                ? "reconectando…"
                : `${chamada.participantes.length} na sala`}
          </span>
        </button>
      </header>

      {/* A lista some no compacto: o cartão de canto é para saber que a
          chamada existe e desligá-la, não para acompanhar quem entra. */}
      {compacto ? null : (
        <div className={css.pessoas}>
          {chamada.participantes.map((id) => (
            <Falante key={id} userId={id} />
          ))}
        </div>
      )}

      <div className={css.controles}>
        <Controle
          nome="Microfone"
          ligado={!chamada.mudo}
          rotulo={chamada.mudo ? "Ativar microfone" : "Silenciar microfone"}
          onClick={() => void alternarMudo()}
        >
          {chamada.mudo ? (
            <MicrophoneSlash size={20} aria-hidden />
          ) : (
            <Microphone size={20} aria-hidden />
          )}
        </Controle>

        <Controle
          nome="Áudio dos outros"
          ligado={!chamada.surdo}
          rotulo={chamada.surdo ? "Voltar a ouvir" : "Parar de ouvir"}
          onClick={() => void alternarSurdo()}
        >
          {chamada.surdo ? (
            <SpeakerSlash size={20} aria-hidden />
          ) : (
            <SpeakerHigh size={20} aria-hidden />
          )}
        </Controle>

        <Controle
          nome="Câmera"
          ligado={chamada.camera}
          rotulo={chamada.camera ? "Desligar câmera" : "Ligar câmera"}
          onClick={() => void alternarCamera()}
        >
          {chamada.camera ? (
            <VideoCamera size={20} aria-hidden />
          ) : (
            <VideoCameraSlash size={20} aria-hidden />
          )}
        </Controle>

        <Controle
          nome="Compartilhamento de tela"
          ligado={chamada.tela}
          rotulo={chamada.tela ? "Parar de compartilhar" : "Compartilhar tela"}
          onClick={() => void alternarTela()}
        >
          <Monitor size={20} aria-hidden />
        </Controle>

        <Tooltip texto="Sair da chamada" lado="acima">
          <button
            type="button"
            className={css.desligar}
            aria-label="Sair da chamada"
            onClick={() => void sairDaChamada()}
          >
            <PhoneX size={20} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </section>
  );
}

function Controle({
  nome,
  ligado,
  rotulo,
  onClick,
  children,
}: {
  nome: string;
  ligado: boolean;
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip texto={rotulo} lado="acima">
      <button
        type="button"
        className={css.controle}
        /*
          ⚠ **O nome é do RECURSO, e `aria-pressed` é do estado — e antes eram
          os dois a mesma string de AÇÃO, o que invertia a resposta.**

          Com o microfone aberto, `aria-label` era "Silenciar microfone" e
          `aria-pressed` era `true`: o leitor anunciava *"Silenciar microfone,
          alternância, pressionado"*, que se lê como "silenciar está ATIVO" —
          ou seja, mudo. O inverso da verdade, na pergunta de maior
          consequência que existe numa chamada.

          Não era um controle errado entre quatro certos: os quatro tinham a
          mesma forma, e "Desligar câmera, pressionado" com a câmera ligada é o
          mesmo defeito. Um defeito uniforme, um conserto.

          O padrão certo é o do botão de negrito: o nome não muda ("Microfone"),
          e `aria-pressed` diz se está ligado. A AÇÃO continua dita — no
          tooltip, que é onde quem enxerga a lê.
        */
        aria-pressed={ligado}
        aria-label={nome}
        data-ligado={ligado}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
