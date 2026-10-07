import { gerarQr } from "nucleo/lib/qr";

import css from "./Entrada.module.css";

/** Módulos de zona de silêncio em volta: a norma pede quatro. */
const SILENCIO = 4;

/**
 * O QR desenhado como UM caminho de SVG.
 *
 * Um `<rect>` por módulo seriam ~1.300 nós; um `path` é um nó, e o SVG escala sem
 * serrilhar em qualquer densidade de tela. A câmera lê bordas, e borda borrada de um
 * bitmap ampliado é o que faz o código demorar a ser lido. Preto sobre branco fixos,
 * qualquer que seja o tema: contraste do código é da câmera, não do tema.
 */
export function CodigoQr({ texto, rotulo }: { texto: string; rotulo: string }) {
  const matriz = gerarQr(texto);
  const lado = matriz.length + SILENCIO * 2;

  let d = "";
  matriz.forEach((linha, y) => {
    linha.forEach((escuro, x) => {
      if (escuro) d += `M${String(x + SILENCIO)} ${String(y + SILENCIO)}h1v1h-1z`;
    });
  });

  return (
    <svg
      className={css.qr}
      viewBox={`0 0 ${String(lado)} ${String(lado)}`}
      role="img"
      aria-label={rotulo}
      shapeRendering="crispEdges"
    >
      <rect className={css.qrFundo} width={lado} height={lado} />
      <path className={css.qrModulos} d={d} />
    </svg>
  );
}
