import { useEffect, useSyncExternalStore } from "react";

import { Girador } from "../components/ui/Girador";
import { Pause, Play, Square, Trash, UploadSimple } from "../components/ui/icones";
import { relogio } from "../lib/duracao";
import {
  alternarPrevia,
  assinarGravacao,
  cancelarGravacao,
  lerGravacao,
  pararGravacao,
} from "./gravacaoDeVoz";
import { BARRAS_DA_GRAVACAO } from "./wav";
import css from "./GravadorDeVoz.module.css";

/**
 * O gravador de mensagem de voz — ocupa o lugar da caixa do composer enquanto
 * a gravação existe.
 *
 * **O que existe vem da referência** (`VoiceRecorder`: gravando, tempo,
 * cancelar, parar e revisar, enviar); **os valores vêm do design** ("Gravando ·
 * no composer": caixa de raio 10 com borda em `danger` a 40%, parar em 34
 * redondo tingido, onda de barras de 3px, tempo em mono `danger-text`,
 * lixeira e enviar em 30 redondos).
 *
 * ⚠ **Divergência do design, dita:** a pista dele diz "solte para enviar,
 * arraste para cancelar" — o gesto de SEGURAR do celular. Aqui gravar é um
 * clique que liga, e a pista diz o que o teclado faz (Enter envia, Esc
 * descarta). Segurar-para-gravar num app de mesa prende o mouse durante a
 * fala inteira, e não tem equivalente de teclado.
 *
 * ⚠ **O botão de parar vira TOCAR depois de parar** — a referência chama o
 * gesto de "parar e revisar", e revisar sem ouvir não é revisar.
 */
export function GravadorDeVoz({
  channelId,
  aoEnviar,
}: {
  channelId: string;
  aoEnviar: () => void;
}) {
  const g = useSyncExternalStore(assinarGravacao, lerGravacao);

  /*
    Enter envia e Esc descarta, no DOCUMENTO: o foco estava no botão de
    microfone, que desmontou junto com a caixa — sem ouvinte global as teclas
    iriam para o `body` e nada aconteceria.
  */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelarGravacao(channelId);
      } else if (e.key === "Enter" && !e.shiftKey) {
        const alvo = e.target as HTMLElement | null;
        /* Enter num botão já aciona o botão; enviar por cima dispararia duas
           ações num gesto só. */
        if (alvo?.closest("button")) return;
        e.preventDefault();
        aoEnviar();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [channelId, aoEnviar]);

  if (g.fase === "parada") return null;

  const pedindo = g.fase === "pedindo";
  const gravando = g.fase === "gravando";
  const preparando = g.fase === "preparando";
  const niveis = pedindo ? [] : g.niveis;
  const segundos = pedindo ? 0 : g.segundos;
  const tocando = g.fase === "revisando" && g.tocando;

  /*
    As barras vazias vêm PRIMEIRO: a onda cresce da direita, como um
    registro que corre, e as fixas do fim são sempre as mais recentes.
  */
  const vazias = BARRAS_DA_GRAVACAO - niveis.length;

  return (
    <div>
      <div
        className={css.caixa}
        data-fase={g.fase}
        role="group"
        aria-label="Mensagem de voz"
      >
        <button
          type="button"
          className={css.parar}
          aria-label={gravando || pedindo ? "Parar e revisar" : tocando ? "Pausar" : "Ouvir"}
          disabled={pedindo || preparando}
          onClick={() => (gravando ? void pararGravacao() : alternarPrevia())}
        >
          {gravando || pedindo ? (
            <Square aria-hidden />
          ) : tocando ? (
            <Pause aria-hidden />
          ) : (
            <Play aria-hidden />
          )}
        </button>

        <div className={css.onda} aria-hidden>
          {Array.from({ length: BARRAS_DA_GRAVACAO }, (_, posicao) => {
            const n = posicao < vazias ? undefined : niveis[posicao - vazias];
            return (
              <span
                /* A POSIÇÃO é a identidade da barra: a onda corre, e a barra
                   da ponta é sempre "a mais recente", não "a amostra 37". */
                key={`barra:${String(posicao)}`}
                className={css.barra}
                data-vazia={n === undefined || undefined}
                style={
                  n === undefined
                    ? undefined
                    : { blockSize: `${String(Math.round(15 + n * 85))}%` }
                }
              />
            );
          })}
        </div>

        {/* O tempo é anunciado só ao parar: um `status` que muda a cada
            segundo faria o leitor de tela recitar um relógio. */}
        <span className={css.tempo} aria-live={gravando ? "off" : "polite"}>
          {pedindo ? "…" : relogio(segundos)}
        </span>

        <div className={css.acoes}>
          <button
            type="button"
            className={css.descartar}
            aria-label="Descartar gravação"
            disabled={preparando}
            onClick={() => cancelarGravacao(channelId)}
          >
            <Trash aria-hidden />
          </button>
          <button
            type="button"
            className={css.enviar}
            aria-label="Enviar mensagem de voz"
            aria-busy={preparando || undefined}
            disabled={pedindo || preparando}
            onClick={aoEnviar}
          >
            {preparando ? <Girador tamanho={12} rotulo="Preparando" /> : <UploadSimple aria-hidden />}
          </button>
        </div>
      </div>

      <p className={css.pista}>
        {pedindo
          ? "Esperando o microfone…"
          : gravando
            ? "Gravando · máx. 5 min · Enter envia · Esc descarta"
            : preparando
              ? "Preparando o áudio…"
              : "Gravação pronta · Enter envia · Esc descarta"}
      </p>
    </div>
  );
}
