import { memo, useSyncExternalStore } from "react";

import { Deslizante } from "../components/ui/Deslizante";
import { cn } from "../lib/cn";
import {
  barrasAcesas,
  BARRAS_DO_MEDIDOR,
  faixaDaBarra,
  fracaoDoDb,
  textoDoDb,
} from "../lib/nivelDeAudio";
import {
  definirPreferenciasDeVoz,
  LIMIAR_MAX_DB,
  LIMIAR_MIN_DB,
} from "../store/preferenciasDeVoz";
import { assinarNivelDeEntrada, lerNivelDeEntrada } from "./midiaDeTeste";
import css from "./VozEVideo.module.css";

/*
  As 28 barras, com a cor de cada uma decidida UMA vez.

  Array de constantes e não `Array.from` no render: o `key` do projeto não pode
  ser índice, e a lista é fixa — mesmos 28 segmentos, mesmas faixas de cor.
*/
const BARRAS = Array.from({ length: BARRAS_DO_MEDIDOR }, (_, i) => ({
  id: `b${String(i).padStart(2, "0")}`,
  faixa: faixaDaBarra(i),
}));

const CLASSE_DA_FAIXA = {
  ok: css.barraOk,
  alto: css.barraAlto,
  pico: css.barraPico,
} as const;

function useNivel(): number | undefined {
  return useSyncExternalStore(assinarNivelDeEntrada, lerNivelDeEntrada);
}

/**
 * As barras do medidor. ÚNICO lugar que assina o nível junto com o texto de
 * dB — o resto da página não acorda quando a voz sobe.
 *
 * Verde, amarelo acima da 19ª e vermelho acima da 24ª, pelas regras do design:
 * a cor diz "alto" e "estourando" sem a pessoa ler número nenhum.
 */
export const BarrasDoMedidor = memo(function BarrasDoMedidor({
  medindo,
}: {
  /** Presente = este é o medidor ANUNCIADO; ausente = decorativo. */
  medindo?: boolean;
}) {
  const db = useNivel();
  const acesas = barrasAcesas(db);
  const papel =
    medindo === undefined
      ? { "aria-hidden": true }
      : {
          role: "meter",
          "aria-label": "Nível de entrada",
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": Math.round(fracaoDoDb(db ?? -60) * 100),
          /* O estado e não o número: "−42 dB" muda vinte vezes por segundo,
             e "medindo"/"sem medição" é a pergunta que a pessoa tem. */
          "aria-valuetext": medindo ? "medindo" : "sem medição",
        };
  return (
    <div className={css.trilhoDoMedidor} {...papel}>
      {BARRAS.map((b, i) => (
        <span
          key={b.id}
          className={cn(css.barra, i < acesas && CLASSE_DA_FAIXA[b.faixa])}
        />
      ))}
    </div>
  );
});

/** "−46 dB" medindo, "— dB" sem teste — ausência não é silêncio. */
export const TextoDoNivel = memo(function TextoDoNivel({
  tocando,
}: {
  tocando: boolean;
}) {
  const db = useNivel();
  return (
    <span className={css.db}>
      {tocando ? "▶" : db === undefined ? "— dB" : textoDoDb(db)}
    </span>
  );
});

/**
 * O limiar manual: o MESMO medidor, com uma marca amarela arrastável.
 *
 * ⚠ **O `Deslizante` nativo por cima das barras, transparente** (`sobreposto`),
 * e não arraste escrito à mão. Ponteiro, teclado (setas, Home/End, PageUp/Down) e
 * ARIA de slider chegam de fábrica — é a mesma decisão do `Deslizante`. O que
 * o nativo não desenha é a marca, e a marca é um `<span>` posicionado pela
 * mesma fração que acende as barras (`fracaoDoDb`): arrastar até a 12ª barra
 * põe o limiar exatamente no dB que acende a 12ª.
 */
export function LimiarManual({ limiarDb }: { limiarDb: number }) {
  const posicao = `${String(fracaoDoDb(limiarDb) * 100)}%`;
  return (
    <div className={css.limiar}>
      <div className={css.linhaDoVolume}>
        <span className={css.rotuloDoLimiar}>Limiar manual</span>
        <span className={css.valor}>{textoDoDb(limiarDb)}</span>
      </div>
      <div
        className={css.medidorArrastavel}
        style={{ "--vx-limiar": posicao } as React.CSSProperties}
      >
        <BarrasDoMedidor />
        <span className={css.marcaDoLimiar} aria-hidden />
        <Deslizante
          id="limiar-manual"
          sobreposto
          valor={limiarDb}
          min={LIMIAR_MIN_DB}
          max={LIMIAR_MAX_DB}
          passo={1}
          rotulo="Limiar manual"
          texto={textoDoDb(limiarDb)}
          aoMudar={(v) => definirPreferenciasDeVoz({ limiarDb: v })}
        />
      </div>
      <p className={css.legendaDoLimiar}>
        A marca amarela é o limiar; barras à esquerda dela não transmitem.
      </p>
    </div>
  );
}
