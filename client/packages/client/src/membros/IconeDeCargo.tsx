import { cn } from "../lib/cn";
import css from "./IconeDeCargo.module.css";

/**
 * A imagem do cargo, ao lado do nome.
 *
 * Uma peça para as três superfícies — nome do autor, member list e pílula —
 * porque as três precisam das mesmas quatro decisões, e três cópias divergem
 * na primeira que alguém esquece:
 *
 * - **Tamanho em token de ícone** (`--vx-icon-*`), nunca o da imagem: o
 *   `autumn` guarda até 128px e quem administra pode subir qualquer proporção.
 * - **`object-fit: contain`**: um ícone largo encolhe inteiro em vez de ter as
 *   pontas cortadas.
 * - **Largura e altura reservadas no CSS antes de carregar**: na timeline, uma
 *   imagem que chega depois e muda a caixa move a âncora da lista.
 * - **`alt` com o nome do cargo**: a imagem carrega informação (quem é
 *   moderação), e sem texto o leitor de tela a pularia.
 */
export function IconeDeCargo({
  url,
  nome,
  tamanho = "medio",
  className,
}: {
  url: string;
  nome: string | undefined;
  /** 12 dentro de texto de 12 · 14 no caso comum · 16 ao lado de nome de 15. */
  tamanho?: "pequeno" | "medio" | "grande";
  className?: string;
}) {
  return (
    <img
      src={url}
      alt={nome ?? ""}
      title={nome}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn(css.icone, css[tamanho], className)}
    />
  );
}
