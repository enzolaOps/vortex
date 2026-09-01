import { Pause, Play } from "../components/ui/icones";
import { useEffect, useRef, useState } from "react";

import type { AnexoSnapshot } from "../sdk/domain";
import css from "./ReprodutorDeVoz.module.css";

/**
 * Quantas barras a forma de onda tem — SEMPRE as mesmas.
 *
 * O design escreve a razão: *"a waveform é gerada no cliente com número fixo
 * de barras (não proporcional à duração), assim mensagens de 5 s e de 5 min
 * têm o mesmo peso visual e o mesmo alvo de scrub"*. Uma barra por segundo
 * daria um player de 5 minutos com 300 alvos de 1px.
 */
const BARRAS = 28;

/**
 * As alturas da forma de onda, derivadas do ID.
 *
 * ⚠ **Não são as amplitudes reais do áudio, e a diferença está dita.** A forma
 * de onda verdadeira sai de `decodeAudioData`, que exige baixar o arquivo
 * inteiro e decodificá-lo antes de desenhar — para toda mensagem de voz
 * visível na janela, no componente mais quente do app. Isso é trabalho
 * próprio, e está dito AQUI — não em `pendencias.ts`, onde já esteve.
 *
 * ⚠ Aquele registro é de CONTROLE desenhado que ainda não faz nada, e aqui não
 * há o que clicar: a barra é um alvo de scrub que funciona. É a mesma família
 * da etiqueta FÓRUM e da reação SUPER, que ficam de fora pelo mesmo motivo.
 *
 * O que estas barras entregam enquanto isso é o que a forma de onda serve
 * PRIMEIRO: um alvo de scrub com granularidade constante e um lugar onde o
 * progresso é legível de relance. Elas são estáveis por arquivo — o mesmo
 * áudio desenha o mesmo perfil em toda sessão e para todo mundo —, pelo mesmo
 * mecanismo do gradiente de avatar.
 *
 * FNV-1a e não soma de códigos: os IDs de anexo compartilham prefixo, e uma
 * soma daria perfis quase idênticos para arquivos criados juntos.
 */
function ondaDe(id: string): readonly number[] {
  let h = 0x811c9dc5;
  const out: number[] = [];
  for (let i = 0; i < BARRAS; i++) {
    for (const c of `${id}:${i}`) {
      h ^= c.codePointAt(0)!;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // 25% a 100%: barra de altura zero some e quebra o alvo de scrub.
    out.push(25 + (h % 76));
  }
  return out;
}

/** `0:08` — o formato do design. */
function relogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const VELOCIDADES = [1, 1.5, 2] as const;

/**
 * Uma mensagem de voz na timeline.
 *
 * ⚠ **É a metade do design que PODE existir hoje.** Gravar depende de subir o
 * arquivo ao servidor de mídia — a mesma dependência de `anexar` —, então o
 * gravador do composer continua sendo a pendência `mensagemDeVoz`. Tocar não
 * depende de nada: o anexo de áudio vem no protocolo (`Metadata.type ===
 * "Audio"`), e qualquer servidor Stoat já o entrega.
 *
 * ⚠ **Um `<audio>` sem `controls`, e não um player de biblioteca.** O elemento
 * nativo resolve rede, decodificação, buffer e sessão de mídia do sistema; o
 * que ele não resolve é a aparência, que é exatamente o que este projeto
 * escreve à mão. É a mesma divisão do `livekit-client` sem
 * `@livekit/components-react`.
 */
export function ReprodutorDeVoz({ anexo }: { anexo: AnexoSnapshot }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [velocidade, setVelocidade] = useState(0);

  const onda = ondaDe(anexo.id);
  const progresso = duracao > 0 ? posicao / duracao : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = VELOCIDADES[velocidade] ?? 1;
  }, [velocidade]);

  function irPara(fracao: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = el.duration * fracao;
    setPosicao(el.currentTime);
  }

  return (
    <div className={css.player}>
      {/*
        `preload="metadata"` e não `auto`.

        Um canal com trinta mensagens de voz baixaria trinta arquivos inteiros
        ao abrir. Os metadados dão a DURAÇÃO, que é o que o player precisa
        mostrar antes de alguém apertar tocar.
      */}
      <audio
        ref={audioRef}
        src={anexo.url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setPosicao(0);
        }}
      />

      <button
        type="button"
        className={css.tocar}
        aria-label={tocando ? "Pausar" : "Tocar"}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        {tocando ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />}
      </button>

      {/*
        A forma de onda É o controle de posição.

        `role="slider"` com as setas movendo em passos de 5%: sem isso o único
        jeito de pular para o meio do áudio seria o ponteiro, e uma mensagem de
        voz de cinco minutos vira inalcançável por teclado.
      */}
      <div
        className={css.onda}
        role="slider"
        tabIndex={0}
        aria-label="Posição"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progresso * 100)}
        aria-valuetext={`${relogio(posicao)} de ${relogio(duracao)}`}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          irPara((e.clientX - r.left) / r.width);
        }}
        onKeyDown={(e) => {
          const passo =
            e.key === "ArrowRight" ? 0.05 : e.key === "ArrowLeft" ? -0.05 : 0;
          if (passo === 0) return;
          e.preventDefault();
          irPara(Math.min(1, Math.max(0, progresso + passo)));
        }}
      >
        {onda.map((altura, i) => (
          <span
            /*
              Índice como chave, e é o caso legítimo: a onda tem tamanho FIXO e
              nunca reordena. O lint proíbe o padrão porque índice corrompe o
              estado da linha ao inserir no topo — aqui não há inserção, não há
              estado, e o índice É a identidade da barra.
            */
            key={`${anexo.id}:${i}`}
            className={css.barra}
            data-tocada={i / BARRAS < progresso || undefined}
            style={{ blockSize: `${altura}%` }}
          />
        ))}
      </div>

      <span className={css.tempo}>
        {relogio(posicao)} / {relogio(duracao)}
      </span>

      {/*
        A velocidade, ciclando entre três degraus.

        Um dropdown para três valores seria dois cliques para o que um resolve,
        e o design a desenha como um alvo só ("1×"). Ciclar é o gesto certo
        quando a lista é curta e ordenada.
      */}
      <button
        type="button"
        className={css.velocidade}
        aria-label={`Velocidade ${VELOCIDADES[velocidade]}×`}
        onClick={() => setVelocidade((v) => (v + 1) % VELOCIDADES.length)}
      >
        {VELOCIDADES[velocidade]}×
      </button>
    </div>
  );
}
