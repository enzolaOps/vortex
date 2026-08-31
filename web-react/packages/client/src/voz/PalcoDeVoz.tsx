import { useEffect, useSyncExternalStore } from "react";

import { assinarChamada, lerChamada } from "../store/chamada";
import {
  assinarPalco,
  fecharPalco,
  lerPalco,
  type Palco,
} from "../store/palcoDeVoz";
import { AssistirTransmissao } from "./AssistirTransmissao";
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

  return (
    <section data-palco className={css.palco} aria-label={rotuloDe(palco)}>
      {palco.tipo === "transmitindo" ? (
        <PalcoDeTransmissao />
      ) : palco.tipo === "grade" ? (
        <GradeDeChamada />
      ) : (
        <AssistirTransmissao userId={palco.userId} />
      )}
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
  if (palco.tipo === "grade") return "Chamada em vídeo";
  return "Assistindo a uma transmissão";
}
