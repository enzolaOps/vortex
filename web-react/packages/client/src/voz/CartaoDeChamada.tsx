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
import {
  assinarChamada,
  falando,
  lerChamada,
  type Chamada,
} from "../store/chamada";
import { usePessoa } from "../store/hooks";
import { definirPalco, type Palco } from "../store/palcoDeVoz";
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
      <Avatar
        id={userId}
        sigla={pessoa?.sigla}
        url={pessoa?.avatarUrl}
        tamanho="sm"
        /* ⚠ A classe carrega o ANEL DE FALA (`.pessoa[data-falando] .avatar`),
           e ela sumiu quando o avatar virou primitivo — o anel ficou morto
           sem que nada falhasse. */
        className={css.avatar}
      />
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

      {/*
        ⚠ **A porta de volta ao palco, e sem ela o palco era de mão única.**
        Fechar o palco não para a transmissão — de propósito, senão "quero ver
        o chat" significaria "quero sair do ar". Mas sem este alvo, quem
        fechasse ficaria transmitindo sem nenhum jeito de rever o que está
        transmitindo a não ser parando e recomeçando.

        ⚠ **Aparece TAMBÉM no compacto, ao contrário da lista de pessoas** —
        e a primeira versão o escondia ali. O compacto é exatamente o estado
        de quem está olhando outro canal enquanto transmite, ou seja, quem
        mais precisa da volta; escondê-lo ali deixava a única porta fechada
        justamente no caso que a motiva.

        ⚠ **Um botão só, e o DESTINO é que muda.** Três alvos ("ver a minha
        transmissão", "assistir a de alguém", "abrir a grade") num cartão de
        canto seriam três coisas para ler antes de clicar, e as três levam ao
        mesmo palco. Ver `destinoDoPalco`.
      */}
      <button
        type="button"
        className={css.verPalco}
        onClick={() => definirPalco(destinoDoPalco(chamada))}
      >
        <Monitor size={14} aria-hidden />
        {rotuloDoPalco(chamada)}
      </button>

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

/**
 * Para onde o botão do cartão leva.
 *
 * ⚠ **A ordem é de especificidade, e o caso do meio é a promessa do design.**
 * Ele escreve, no painel de espectadores, que "quem entra no canal depois vê o
 * stream com um clique". Com UMA pessoa transmitindo, o clique certo é abrir a
 * transmissão dela — mandar para a grade seria um clique a mais para chegar ao
 * único lugar interessante. Com duas, a grade é a resposta honesta: escolher
 * uma por você seria adivinhar.
 */
function destinoDoPalco(chamada: Chamada): Palco {
  if (chamada.tela) return { tipo: "transmitindo" };
  const so = chamada.transmitindo;
  if (so.length === 1 && so[0]) return { tipo: "assistindo", userId: so[0] };
  return { tipo: "grade" };
}

function rotuloDoPalco(chamada: Chamada): string {
  if (chamada.tela) return "Ver transmissão";
  if (chamada.transmitindo.length > 0) return "Assistir";
  return "Abrir vídeo";
}
