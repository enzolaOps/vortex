import { useSyncExternalStore } from "react";

import { PARES, verificar } from "../tema/pares";
import { LIMITES_DA_SEMENTE, SEMENTE_PADRAO, type Modo } from "../tema/derivar";
import { paletaFinal } from "../tema/aplicar";
import { assinarLayout, definirSemente, lerSemente } from "../store/layout";
import css from "./PickerDePaleta.module.css";

const MODOS: { id: Modo; rotulo: string }[] = [
  { id: "escuro", rotulo: "escuro" },
  { id: "claro", rotulo: "claro" },
];

/** Amostras da paleta, na ordem em que a interface as usa. */
const AMOSTRAS = [
  { token: "--vx-surface-0", rotulo: "fundo" },
  { token: "--vx-surface-2", rotulo: "painel" },
  { token: "--vx-text-1", rotulo: "texto" },
  { token: "--vx-text-3", rotulo: "apagado" },
  { token: "--vx-accent", rotulo: "ação" },
  { token: "--vx-danger", rotulo: "erro" },
  { token: "--vx-warning", rotulo: "aviso" },
  { token: "--vx-success", rotulo: "ok" },
] as const;

/**
 * O picker de paleta.
 *
 * Quatro controles para vinte tokens, e essa proporção é a decisão de design
 * inteira. A referência descarta color picker por componente por quatro
 * motivos, e o mais duro deles é que acessibilidade vira impossível de
 * garantir. A saída não é validar mais — é dar ao usuário só os eixos que não
 * quebram nada.
 *
 * O usuário escolhe MATIZ e CROMA; o app decide toda a LUMINOSIDADE. Em OKLCH
 * é a luminosidade que carrega o contraste, então a rampa fixa entrega o mesmo
 * contraste em qualquer matiz. Uma varredura de matiz × croma × modo prova
 * isso em teste — por isso este painel mostra a folga de contraste como
 * informação, e não como alerta: não há escolha aqui que produza uma paleta
 * ilegível.
 *
 * O que ele NÃO tem, e a ausência é a feature: nenhum campo para editar um
 * token individual. Essa é a escotilha `theme` do preset, que existe no tipo e
 * não tem UI — quem quiser usá-la sabe o que está fazendo.
 */
export function PickerDePaleta() {
  /**
   * Assina a SEMENTE, não o layout inteiro.
   *
   * A primeira versão assinava o layout e chamava `lerSemente()` solto logo
   * depois. As cores mudavam na tela — o pintor é quem escreve no documento —
   * mas o veredito de contraste ficava congelado, porque para o React (e para
   * o compiler) aquela leitura não dependia de nada e podia ser reaproveitada
   * entre renders.
   *
   * Ler estado externo fora de `useSyncExternalStore` é quebrar as Rules of
   * React, e o sintoma foi o mais traiçoeiro possível: metade da tela
   * atualizando e a outra metade não.
   */
  const semente = useSyncExternalStore(assinarLayout, lerSemente);

  const paleta = paletaFinal(semente);
  const veredito = verificar(paleta);
  const apertado = veredito.maisApertado;

  return (
    <section className={css.picker} aria-label="Paleta">
      <div className={css.linha}>
        <span className={css.rotulo}>modo</span>
        <div className={css.grupo} role="group" aria-label="Modo do tema">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={css.opcao}
              aria-pressed={semente.modo === m.id}
              onClick={() =>
                // Trocar de modo troca a RAMPA inteira, então o resto da
                // semente vem do padrão daquele modo — manter o matiz de um
                // acento pensado para fundo escuro sobre fundo claro dá uma
                // paleta que passa no contraste e parece errada.
                definirSemente({
                  ...SEMENTE_PADRAO[m.id],
                  matiz: semente.matiz,
                  croma: semente.croma,
                })
              }
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className={css.linha}>
        <label className={css.rotulo} htmlFor="picker-acento">
          ação
        </label>
        <input
          id="picker-acento"
          type="color"
          className={css.cor}
          value={paleta["--vx-accent"]}
          onChange={(e) => definirSemente({ ...semente, acento: e.target.value })}
        />
        <span className={css.dica}>
          o matiz é seu; a luminosidade é do app — é o que garante o contraste
        </span>
      </div>

      <div className={css.linha}>
        <label className={css.rotulo} htmlFor="picker-matiz">
          neutro
        </label>
        <input
          id="picker-matiz"
          type="range"
          className={css.faixa}
          min={LIMITES_DA_SEMENTE.matiz.min}
          max={LIMITES_DA_SEMENTE.matiz.max}
          step={1}
          value={semente.matiz}
          aria-valuetext={`matiz ${Math.round(semente.matiz)} graus`}
          onChange={(e) => definirSemente({ ...semente, matiz: Number(e.target.value) })}
        />
        <span className={css.medida}>{Math.round(semente.matiz)}°</span>
      </div>

      <div className={css.linha}>
        <label className={css.rotulo} htmlFor="picker-croma">
          saturação
        </label>
        <input
          id="picker-croma"
          type="range"
          className={css.faixa}
          min={LIMITES_DA_SEMENTE.croma.min}
          max={LIMITES_DA_SEMENTE.croma.max}
          step={0.05}
          value={semente.croma}
          aria-valuetext={`${Math.round(semente.croma * 100)} por cento`}
          onChange={(e) => definirSemente({ ...semente, croma: Number(e.target.value) })}
        />
        <span className={css.medida}>{Math.round(semente.croma * 100)}%</span>
      </div>

      <div className={css.amostras}>
        {AMOSTRAS.map((a) => (
          <span
            key={a.token}
            className={css.amostra}
            style={{ background: paleta[a.token] }}
            title={`${a.rotulo} · ${paleta[a.token]}`}
          >
            <span className="sr-only">
              {a.rotulo}: {paleta[a.token]}
            </span>
          </span>
        ))}
      </div>

      {/*
        A folga aparece como INFORMAÇÃO, não como alerta.

        Um aviso aqui seria teatro: a varredura em teste prova que nenhuma
        combinação destes controles reprova. O que vale mostrar é quanta folga
        a escolha tem — quem quiser uma paleta confortável e não só aprovada
        tem o número para decidir.
      */}
      <p className={css.veredito} data-ok={veredito.ok}>
        {veredito.ok ? (
          <>
            {PARES.length} pares verificados
            {apertado ? (
              <>
                {" · "}mais apertado {apertado.razao.toFixed(2)}:1 em{" "}
                <code>{apertado.par.fg.replace("--vx-", "")}</code> sobre{" "}
                <code>{apertado.par.bg.replace("--vx-", "")}</code> (mín{" "}
                {apertado.par.min})
              </>
            ) : null}
          </>
        ) : (
          <>
            {veredito.falhas.length} de {PARES.length} pares abaixo do mínimo —
            isto não deveria acontecer, e é bug da derivação, não escolha ruim
          </>
        )}
      </p>
    </section>
  );
}
