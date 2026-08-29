import { ClockCounterClockwise, LockSimple } from "@phosphor-icons/react";
import { useState } from "react";

import { aindaNao } from "../pendente/pendencias";
import { CascaDeSeletor, SecaoDeSeletor } from "./CascaDeSeletor";
import css from "./Seletores.module.css";

/**
 * O seletor de figurinhas.
 *
 * ⚠ **Figurinha não existe no protocolo Stoat.** Não é "falta o upload" como
 * no emoji do servidor — não há tipo, não há evento e não há campo na
 * mensagem. É a mesma classe da etiqueta FÓRUM: superfície cujo dado nenhum
 * servidor upstream sabe produzir, e cuja implementação passa por forkar o
 * serviço `api`.
 *
 * A casca é construída porque a decisão de quem toca o produto é construir 1:1
 * agora; o que ela mostra é a estrutura do design — recentes, pacotes por
 * servidor, e o pacote bloqueado com a frase que o próprio design escreve
 * ("Entre no servidor para usar estas figurinhas").
 */
export function SeletorDeFigurinhas() {
  const [busca, setBusca] = useState("");

  return (
    <CascaDeSeletor
      rotulo="Figurinhas"
      busca={{
        valor: busca,
        aoMudar: setBusca,
        placeholder: "Buscar figurinha",
      }}
      rail={
        <>
          <button
            type="button"
            className={css.categoria}
            aria-label="Recentes"
            aria-pressed
            onClick={aindaNao("figurinha")}
          >
            <ClockCounterClockwise aria-hidden />
          </button>
          <button
            type="button"
            className={css.categoria}
            aria-label="Pacote bloqueado"
            onClick={aindaNao("figurinha")}
          >
            <LockSimple aria-hidden />
          </button>
        </>
      }
      rodape={
        <span className={css.previaOrigem}>
          Figurinhas dependem do protocolo — ver o registro de pendências
        </span>
      }
    >
      <SecaoDeSeletor titulo="Recentes" grude>
        <div className={css.gradeDeFigurinhas}>
          {["a", "b", "c"].map((id) => (
            <button
              key={id}
              type="button"
              className={css.figurinha}
              onClick={aindaNao("figurinha")}
            >
              <span className={css.gifRotulo}>figurinha</span>
            </button>
          ))}
        </div>
      </SecaoDeSeletor>

      {/*
        O pacote bloqueado, com a frase do design.

        Caixa tracejada e não um vazio: o design a usa para dizer "existe e não
        é seu", que é uma informação — some, e a pessoa conclui que o servidor
        não tem figurinha nenhuma.
      */}
      <SecaoDeSeletor titulo="Pacote bloqueado">
        <p className={css.bloqueio}>
          Entre no servidor para usar estas figurinhas
        </p>
      </SecaoDeSeletor>
    </CascaDeSeletor>
  );
}
