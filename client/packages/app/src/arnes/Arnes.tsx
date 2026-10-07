import "./redeFalsa";

import { CHANNEL_ID, SERVER_ID } from "nucleo/arnes/firehose";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ListaDeMensagens } from "../jornadas/chat/ListaDeMensagens";
import { ShellDoApp } from "../shell";
import { Botao } from "../ui/ds";
import css from "./Arnes.module.css";
import { criarGate } from "./gate";

const TAMANHO = 10_000;
const JANELA_S = 30;
const AQUECIMENTO_S = 1.5;

/**
 * O arnês do gate (`/dev`): o shell de verdade com a lista de mensagens ligada ao
 * gerador sintético do `nucleo`, mais uma barra mínima para a corrida manual em
 * display real. Ele ENVOLVE o produto em vez de montar uma árvore própria: medir
 * uma árvore diferente da de produção mede a árvore do arnês.
 *
 * O contrato com o `gate.mjs` é `window.__vortexGate` (ver `contrato.ts`); a barra
 * é para gente e não é raspada por ninguém.
 */
export function Arnes() {
  const [gate] = useState(criarGate);
  // O retrato vem do store: ler `gate.estado()` solto seria memoizado pelo compiler.
  const { semeadas, semeando, medindo, relatorio } = useSyncExternalStore(gate.assinar, gate.snapshot);

  useEffect(() => {
    window.__vortexGate = gate.api;
    return () => {
      delete window.__vortexGate;
    };
  }, [gate]);

  const [throttled, setThrottled] = useState(true);

  return (
    <>
      <ShellDoApp
        principal={
          semeadas > 0 ? <ListaDeMensagens canalId={CHANNEL_ID} servidorId={SERVER_ID} /> : undefined
        }
      />
      <aside className={css.barra} aria-label="Arnês de medição">
        <Botao
          tamanho="sm"
          disabled={semeadas > 0 || semeando}
          onClick={() => {
            void gate.api.semear(TAMANHO);
          }}
        >
          {semeando ? "Semeando…" : `Semear ${TAMANHO.toLocaleString("pt-BR")}`}
        </Botao>
        <label className={css.condicao}>
          <input
            type="checkbox"
            checked={throttled}
            disabled={medindo}
            onChange={(e) => {
              setThrottled(e.target.checked);
            }}
          />
          CPU 4x
        </label>
        <Botao
          tamanho="sm"
          disabled={semeadas === 0 || medindo}
          onClick={() => {
            gate.api.firehose(true, { throttled });
            window.setTimeout(() => {
              gate.api.firehose(false);
            }, (AQUECIMENTO_S + JANELA_S) * 1000);
          }}
        >
          {medindo ? `Medindo ${JANELA_S}s…` : "Firehose 500/s"}
        </Botao>
        {relatorio && (
          <span className={css.relatorio} data-veredito={relatorio.veredito}>
            {relatorio.veredito} ·{" "}
            {((relatorio.frames.dropped / Math.max(relatorio.frames.frames, 1)) * 100).toFixed(1)}% perdidos · p95{" "}
            {relatorio.frames.p95}ms · vazão {relatorio.vazao}/s
            {relatorio.motivoInvalido ? ` · ${relatorio.motivoInvalido}` : ""}
          </span>
        )}
      </aside>
    </>
  );
}
