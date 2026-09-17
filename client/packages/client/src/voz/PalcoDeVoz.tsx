import { useEffect, useSyncExternalStore } from "react";

import { assinarChamada, lerChamada } from "../store/chamada";
import {
  assinarChatDaSala,
  assinarPalco,
  fecharPalco,
  lerChatDaSala,
  lerPalco,
  type Palco,
} from "../store/palcoDeVoz";
import { useChannel } from "../store/hooks";
import { AssistirTransmissao } from "./AssistirTransmissao";
import { ChatDaSala } from "./ChatDaSala";
import { ComMenuDoParticipante } from "./MenuDoParticipante";
import { ChamadaDireta } from "./ChamadaDireta";
import { GradeDeChamada } from "./GradeDeChamada";
import { PalcoDeTransmissao } from "./PalcoDeTransmissao";
import css from "./PalcoDeVoz.module.css";

/**
 * O palco de voz — a moldura das três telas do design.
 *
 * ⚠ **Ele é a única coisa montada, e as três telas nunca coexistem.** A união
 * `Palco` garante isso pelo tipo: transmitindo, a grade e assistindo são
 * variantes, não flags, então "assistindo alguém enquanto vejo a grade" deixou
 * de ser representável em vez de ser um caso a evitar.
 *
 * ⚠ **Sobre o shell, e não no lugar dele** — como as configurações. A lista de
 * mensagens fica montada atrás, com as linhas medidas e a âncora onde estava;
 * substituir o shell pagaria o custo mais caro do app pela ação mais barata.
 */
export function PalcoDeVoz() {
  const palco = useSyncExternalStore(assinarPalco, lerPalco);
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const chatAberto = useSyncExternalStore(assinarChatDaSala, lerChatDaSala);
  const canal = useChannel(chamada.channelId);
  const foraDaChamada = chamada.estado === "fora";

  /*
    ⚠ **Sair da chamada fecha o palco, e sem isto ele ficava na tela.**
    `encerrarChamada` zera o store de chamada e não sabe do palco — o
    resultado era uma grade de zero pessoas cobrindo o app inteiro, com uma
    doca cujo "Desligar" já não tinha o que desligar. Um efeito e não um
    `return null`: devolver nada deixaria o store dizendo "aberto" para
    sempre, e a próxima chamada abriria o palco sozinha sem ninguém pedir.
  */
  useEffect(() => {
    if (foraDaChamada) fecharPalco();
  }, [foraDaChamada]);

  if (palco.tipo === "fechado" || foraDaChamada) return null;

  /*
    De quem é a tela que ocupa o palco.

    ⚠ **A sua ganha da dos outros, e `chamada.transmitindo` NÃO te inclui** —
    está escrito no store, e ler só a lista deixaria quem transmite sozinho na
    sala vendo a grade. A sua ganha porque ela é a que você precisa conferir:
    a de outra pessoa você decide se quer, a sua já está saindo daqui.
  */
  const eu = chamada.participantes[0];
  const dono = chamada.tela ? eu : chamada.transmitindo[0];

  return (
    <section data-palco className={css.palco} aria-label={rotuloDe(palco)}>
      {/*
        ⚠ **UM menu de participante para a TELA inteira**, e não um por
        ladrilho: a grade, a fila da prancha e a lista "na sala" só marcam
        `data-participante`, e a captura decide o alvo. Ver
        `store/menuDoParticipante.ts`.

        ⚠ **Em volta da tela e NÃO da seção, e o chat é a razão.** A captura
        chama `preventDefault` fora de um participante — senão o Radix abriria
        uma caixa vazia —, e o `Trigger` do menu de mensagem ignora evento já
        prevenido. Com o chat embutido dentro deste gatilho, o clique direito
        numa mensagem do chat da sala não abria menu nenhum, sem erro.
      */}
      <ComMenuDoParticipante channelId={chamada.channelId}>
        <div className={css.tela}>
          {/*
            ⚠ **A SALA entra na prancha sozinha quando há transmissão, e antes
            exigia um clique.** Quem usa relatou assim: "o canal era para ser
            preenchido favorecendo a transmissão da tela, sem a necessidade de
            clicar assistir". A grade de pesos iguais mostrava a tela de alguém
            como um ladrilho de 84px com um botão em cima — ou seja, anunciava a
            transmissão e a escondia.

            A escolha é DERIVADA do estado da chamada, não de um modo guardado: se
            há tela no ar, a sala é a prancha; se não há, é a grade. Um quarto
            valor na união `Palco` daria dois lugares para dizer a mesma coisa, e
            o que diverge é sempre o que ninguém abriu naquela semana.

            `transmitindo` continua na união porque ele é o DESTINO de "ver a
            minha transmissão" vindo do popout — mas hoje ele e `grade` desenham a
            mesma tela quando há stream, e é isso que os torna consistentes.
          */}
          {palco.tipo === "assistindo" ? (
            <AssistirTransmissao userId={palco.userId} />
          ) : dono ? (
            <PalcoDeTransmissao dono={dono} proprio={dono === eu} />
          ) : canal?.tipo === "dm" ? (
            /*
              A conversa de duas pessoas tem tela própria — ver `ChamadaDireta`.
              Só `dm`: o grupo de DM continua na grade, que é o que o design
              desenha para ele. A transmissão ganha das duas, pela mesma razão
              de sempre.
            */
            <ChamadaDireta channelId={chamada.channelId} />
          ) : (
            <GradeDeChamada />
          )}
        </div>
      </ComMenuDoParticipante>
      {/*
        O chat do PRÓPRIO canal, ao lado da sala — ver `ChatDaSala`. Irmão da
        tela e não filho: as três telas medem a largura delas por container
        query, e o chat entrando tem de encolher a tela, não sobrepor.
      */}
      {chatAberto ? <ChatDaSala channelId={chamada.channelId} /> : null}
    </section>
  );
}

/**
 * O rótulo da região, e ele diz o MODO.
 *
 * String que só leitor de tela lê não aparece em revisão de tela nenhuma —
 * este projeto já pagou por isso uma vez, com a região de toast anunciando
 * "Notifications (F8)" num app em português. Aqui as três telas cobrem o app
 * inteiro, e "qual delas está aberta" é exatamente o que quem não enxerga
 * precisa saber ao chegar.
 */
function rotuloDe(palco: Palco): string {
  if (palco.tipo === "transmitindo") return "Você está transmitindo";
  if (palco.tipo === "grade") return "Chamada";
  return "Assistindo a uma transmissão";
}
