import { Hash, SpeakerHigh } from "@phosphor-icons/react";

import { useChannel } from "../store/hooks";
import css from "./CabecalhoDeCanal.module.css";

/**
 * O id do nome do canal, para quem precisa se nomear por ele.
 *
 * Constante exportada e não string solta nos dois lados: `aria-labelledby` que
 * aponta para um id inexistente não dá erro — só deixa o elemento sem nome, em
 * silêncio, que é a forma que este projeto já viu esse defeito tomar.
 */
export const ID_DO_NOME_DO_CANAL = "vx-nome-do-canal";

/**
 * O cabeçalho do canal aberto: nome e tópico.
 *
 * `channel.description` — o tópico — já vinha pelo fio desde sempre e não
 * tinha onde aparecer, porque **não havia cabeçalho de canal**. Era um dos
 * quatro campos que a varredura de protocolo listou como "o custo é a
 * superfície, não o campo": nenhum deles é difícil, todos precisavam de um
 * lugar que não existia.
 *
 * Assina o canal e mais nada. Mensagem nova republica a contagem daquele
 * canal, então o cabeçalho re-renderiza junto — e é barato: são dois textos.
 * Assinar aqui e não receber por prop é o que mantém o Shell sem saber que
 * canais têm nome.
 *
 * O tópico trunca em uma linha de propósito. Ele pode ter parágrafos, e um
 * cabeçalho que cresce com o texto empurra a lista de mensagens para baixo —
 * numa lista ancorada, isso é a âncora se movendo por causa de metadado.
 */
export function CabecalhoDeCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);

  // Mesma disciplina da linha e da member list: caixa com altura, nunca
  // `null`. O grid do shell reserva esta linha, e devolver nada aqui faria a
  // lista saltar para cima no instante em que o canal resolvesse.
  if (!canal) {
    return <header className={css.cabecalho} aria-hidden />;
  }

  const Icone = canal.tipo === "voz" ? SpeakerHigh : Hash;

  return (
    <header className={css.cabecalho}>
      <Icone size={20} aria-hidden className={css.icone} />
      {/*
        O id existe para a LISTA se nomear por ele.

        `role="log"` sem nome é anunciado como "log", sem dizer de que canal — e
        a lista é a região mais importante do app. Nomear por `aria-labelledby`
        e não por `aria-label` é o que torna isso de graça: a lista não pode
        assinar o snapshot do canal só para saber o nome, porque o snapshot
        muda a cada não-lida e isso re-renderizaria as dez mil linhas 500 vezes
        por segundo sob o firehose.
      */}
      <h1 id={ID_DO_NOME_DO_CANAL} className={css.nome}>
        {canal.name}
      </h1>

      {canal.topico ? (
        <>
          {/* Régua fina entre nome e tópico — uma das poucas separações raras
              que ainda merecem linha, porque aqui os dois textos correm no
              mesmo eixo e o espaço sozinho não os separaria. */}
          <span className={css.divisa} aria-hidden />
          <p className={css.topico} title={canal.topico}>
            {canal.topico}
          </p>
        </>
      ) : null}
    </header>
  );
}
