import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { AnexoSnapshot } from "nucleo/sdk/domain";

import { chat } from "../../textos";
import { Pausar, Reproduzir } from "../../ui/icones";
import css from "./PlayerDeAudio.module.css";

/** `m:ss` (ou `h:mm:ss`). Duração desconhecida (NaN/∞) vira `0:00`, nunca `NaN:NaN`. */
export function tempoTexto(segundos: number): string {
  const total = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${String(h)}:${String(m).padStart(2, "0")}:${ss}` : `${String(m)}:${ss}`;
}

const PASSO_S = 5;

/**
 * Player de áudio do anexo. O `<audio>` de baixo não tem `controls`: ele resolve
 * rede, decodificação e buffer; aqui só se desenha. Altura fixa (`ALTURA_DO_AUDIO`
 * em `caixaDoAnexo.ts`): a estimativa de altura da linha não depende do estado.
 *
 * O progresso é estado LOCAL do player: `timeupdate` acorda este componente,
 * nunca a linha. A barra é um `slider` de verdade (ponteiro com captura,
 * teclado, valores anunciados).
 */
export function PlayerDeAudio({ a }: { a: AnexoSnapshot }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [falhou, setFalhou] = useState(false);
  const arrastando = useRef(false);

  const total = Number.isFinite(duracao) ? duracao : 0;
  const fracao = total > 0 ? Math.min(1, atual / total) : 0;

  function ir(segundos: number) {
    const el = audio.current;
    if (el === null || total <= 0) return;
    const alvo = Math.max(0, Math.min(total, segundos));
    el.currentTime = alvo;
    setAtual(alvo);
  }

  function alternar() {
    const el = audio.current;
    if (el === null) return;
    if (el.paused) {
      // Rejeita se a mídia não carrega; o `onError` do elemento já conta a história.
      el.play().catch(() => {
        setFalhou(true);
      });
    } else el.pause();
  }

  function doPonteiro(e: PointerEvent<HTMLDivElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    if (caixa.width <= 0) return;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const x = rtl ? caixa.right - e.clientX : e.clientX - caixa.left;
    ir((Math.max(0, Math.min(caixa.width, x)) / caixa.width) * total);
  }

  function doTeclado(e: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number | undefined> = {
      ArrowRight: atual + PASSO_S,
      ArrowUp: atual + PASSO_S,
      ArrowLeft: atual - PASSO_S,
      ArrowDown: atual - PASSO_S,
      PageUp: atual + total / 10,
      PageDown: atual - total / 10,
      Home: 0,
      End: total,
    };
    const alvo = passos[e.key];
    if (alvo === undefined) return;
    e.preventDefault();
    ir(alvo);
  }

  const atualTxt = tempoTexto(atual);
  const totalTxt = tempoTexto(total);

  return (
    <div
      className={css.player}
      data-tocando={tocando || undefined}
      data-falhou={falhou || undefined}
    >
      <audio
        ref={audio}
        src={a.url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuracao(e.currentTarget.duration);
        }}
        onDurationChange={(e) => {
          setDuracao(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => {
          if (!arrastando.current) setAtual(e.currentTarget.currentTime);
        }}
        onPlay={() => {
          setTocando(true);
          setFalhou(false);
        }}
        onPause={() => {
          setTocando(false);
        }}
        onEnded={() => {
          setTocando(false);
          setAtual(0);
        }}
        onError={() => {
          setFalhou(true);
          setTocando(false);
        }}
      />
      <button
        type="button"
        className={css.botao}
        aria-label={tocando ? chat.player.pausar : chat.player.reproduzir}
        onClick={alternar}
      >
        {tocando ? <Pausar tamanho={16} /> : <Reproduzir tamanho={16} />}
      </button>
      <div className={css.corpo}>
        <div className={css.titulo}>
          <span className={css.nome}>{a.nome}</span>
          {falhou ? (
            <span className={css.erro} role="alert">
              {chat.player.falhou}
            </span>
          ) : (
            a.tamanhoTexto !== undefined && <span className={css.peso}>{a.tamanhoTexto}</span>
          )}
        </div>
        <div className={css.linha}>
          <div
            className={css.barra}
            role="slider"
            tabIndex={0}
            aria-label={chat.player.posicao(a.nome)}
            aria-valuemin={0}
            aria-valuemax={Math.round(total)}
            aria-valuenow={Math.round(atual)}
            aria-valuetext={chat.player.valorDaPosicao(atualTxt, totalTxt)}
            onKeyDown={doTeclado}
            onPointerDown={(e) => {
              if (total <= 0) return;
              arrastando.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              doPonteiro(e);
            }}
            onPointerMove={(e) => {
              if (arrastando.current) doPonteiro(e);
            }}
            onPointerUp={(e) => {
              arrastando.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              arrastando.current = false;
            }}
          >
            <i className={css.progresso} style={{ transform: `scaleX(${String(fracao)})` }} />
            <b className={css.alca} style={{ insetInlineStart: `${String(fracao * 100)}%` }} />
          </div>
          <span className={css.tempo}>
            {atualTxt} / {totalTxt}
          </span>
        </div>
      </div>
    </div>
  );
}
