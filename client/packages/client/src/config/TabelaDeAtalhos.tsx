import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Selo } from "../components/ui/Selo";
import { Combinacao } from "../components/ui/Tecla";
import { pausarAtalhos } from "../sdk/atalhosDeVoz";
import {
  ACOES_DE_VOZ,
  ROTULO_DA_ACAO,
  acoesEmConflito,
  assinarAtalhosDeVoz,
  combinacaoDoEvento,
  definirAtalho,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
  type AcaoDeVoz,
} from "../store/atalhosDeVoz";
import css from "./VozEVideo.module.css";

const MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/**
 * A gravação de uma combinação — o "Editar" da tabela e o "Regravar" do bloco
 * de push-to-talk são o MESMO gesto.
 *
 * ⚠ **Um hook e não duas cópias**: a gravação pausa os atalhos, captura a
 * tecla antes do app e trata `Esc`. Duas cópias divergem na primeira que
 * esquecer de pausar — e gravar a combinação de mutar com ela valendo mutaria
 * no meio.
 */
export function useGravacaoDeAtalho() {
  const [gravando, setGravando] = useState<AcaoDeVoz | undefined>(undefined);

  useEffect(() => {
    if (!gravando) return;
    pausarAtalhos(true);
    const aoTeclado = (e: KeyboardEvent) => {
      /* Captura e interrompe: a tecla é da gravação, não do app. */
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === "Escape") {
        setGravando(undefined);
        return;
      }
      const c = combinacaoDoEvento(e, MAC);
      if (!c) return;
      definirAtalho(gravando, c);
      setGravando(undefined);
    };
    window.addEventListener("keydown", aoTeclado, { capture: true });
    return () => {
      window.removeEventListener("keydown", aoTeclado, { capture: true });
      pausarAtalhos(false);
    };
  }, [gravando]);

  return [gravando, setGravando] as const;
}

/**
 * Os atalhos de voz, gravados de verdade.
 *
 * "Editar" arma a gravação: a próxima combinação com uma tecla principal vira
 * o atalho, `Esc` desiste. Enquanto grava, nenhum atalho dispara (ver
 * `pausarAtalhos`) — senão gravar a combinação de mutar, com ela já valendo,
 * mutaria no meio.
 *
 * ⚠ **Conflito marca as DUAS linhas e desliga as duas**, como o design pede:
 * disparar mutar e desconectar com a mesma tecla seria pior que nada.
 */
export function TabelaDeAtalhos() {
  const atalhos = useSyncExternalStore(assinarAtalhosDeVoz, lerAtalhosDeVoz);
  const [gravando, setGravando] = useGravacaoDeAtalho();
  const conflito = acoesEmConflito(atalhos);

  return (
    <div className={css.tabela}>
      <div className={css.cabecalhoDaTabela}>
        <span>Ação</span>
        <span>Combinação</span>
        <span />
      </div>

      {ACOES_DE_VOZ.map((acao) => {
        const c = atalhos[acao];
        const emConflito = conflito.has(acao);
        const estaGravando = gravando === acao;
        return (
          <div
            key={acao}
            className={css.linhaDaTabela}
            data-conflito={emConflito}
          >
            <span className={css.acao}>
              {ROTULO_DA_ACAO[acao]}
              {emConflito ? (
                <Selo forma="etiqueta" tom="perigo">
                  Conflito
                </Selo>
              ) : null}
            </span>
            {estaGravando ? (
              <span className={css.gravando} aria-live="polite">
                Pressione a combinação… (Esc cancela)
              </span>
            ) : c ? (
              <Combinacao
                teclas={teclasDaCombinacao(c)}
                className={emConflito ? css.conflitoNaTecla : undefined}
              />
            ) : (
              <span className={css.semAtalho}>sem atalho</span>
            )}
            <span className={css.acoesDaLinha}>
              {c && !estaGravando ? (
                <Botao
                  variante="sutil"
                  tamanho="pequeno"
                  onClick={() => definirAtalho(acao, undefined)}
                >
                  Remover
                </Botao>
              ) : null}
              <Botao
                variante="sutil"
                tamanho="pequeno"
                aria-pressed={estaGravando}
                onClick={() => setGravando(estaGravando ? undefined : acao)}
              >
                {estaGravando ? "Cancelar" : "Editar"}
              </Botao>
            </span>
          </div>
        );
      })}
    </div>
  );
}
