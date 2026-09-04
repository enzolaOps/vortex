import { useSyncExternalStore } from "react";

import { cancelarUpload } from "../store/uploads";
import { progressoDeUpload } from "../store/uploads";
import css from "./CartaoDeUpload.module.css";

/**
 * O upload em andamento, na linha da mensagem otimista.
 *
 * ⚠ **Componente próprio, e a razão é a mesma do `PontoDePresenca` e do anel
 * de fala: ISOLAR a subscrição de alta frequência.** O `progress` do
 * `XMLHttpRequest` dispara dezenas de vezes por segundo. Se a `MessageRow`
 * assinasse o progresso, cada quadro re-renderizaria corpo, markdown, anexos,
 * reações e avatar daquela linha — e a linha é o componente mais quente do
 * app. Aqui quem acorda é uma barra de 4px.
 *
 * O store efêmero já coalesce em janelas de 120ms, então o pior caso é ~8
 * re-renders por segundo deste componente, e de mais nada.
 *
 * ⚠ **A caixa tem altura FIXA e o cartão não muda de tamanho durante o
 * envio.** Crescer quando a taxa aparece moveria a âncora da lista por causa
 * de um metadado — a mesma decisão do cabeçalho do bloco de código, que fica
 * mesmo sem língua.
 */
export function CartaoDeUpload({ messageId }: { messageId: string }) {
  const progresso = useSyncExternalStore(
    progressoDeUpload.subscriber(messageId),
    () => progressoDeUpload.getSnapshot(messageId),
  );

  /*
    Nada ainda: o primeiro evento de progresso pode demorar um quadro. Um
    cartão vazio piscando antes do primeiro byte é pior que aparecer junto com
    o dado — e o rótulo "enviando…" ao lado já diz que algo começou.
  */
  if (progresso === undefined) return null;

  const pct = Math.round(progresso.fracao * 100);

  return (
    <div className={css.cartao}>
      <div className={css.linha}>
        <span className={css.nome} title={progresso.nome}>
          {progresso.nome}
        </span>
        <button
          type="button"
          className={css.cancelar}
          onClick={() => cancelarUpload(messageId)}
        >
          Cancelar
        </button>
      </div>

      {/*
        ⚠ `role="progressbar"` com os três valores, e não uma `<progress>`:
        o elemento nativo é estilizado por pseudo-elementos diferentes em cada
        navegador, e o design pede um trilho de 4px com o preenchimento em
        acento. É a mesma troca do `<select>` que virou dropdown.
      */}
      <div
        className={css.trilho}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Enviando ${progresso.nome}`}
      >
        <div className={css.preenchimento} style={{ inlineSize: `${pct}%` }} />
      </div>

      {/*
        "62% · 178 KB/s" quando há amostra, só a porcentagem antes disso. Ver
        `taxaTexto` — uma taxa medida sobre alguns milissegundos salta entre
        ordens de grandeza, e um número ilegível não vale o espaço.
      */}
      <span className={css.medida}>
        {progresso.taxaTexto === undefined
          ? `${pct}%`
          : `${pct}% · ${progresso.taxaTexto}`}
      </span>
    </div>
  );
}
