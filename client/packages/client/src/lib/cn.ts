import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * O `tailwind-merge` precisa aprender a escala deste projeto.
 *
 * Ele resolve conflito por grupo de classe, e os grupos que conhece são os do
 * Tailwind de fábrica. A escala default de raio foi desativada em `tokens.css`
 * (`--radius-*: initial`) e substituída por `rounded-02..14` mais
 * `rounded-pill`, que ele não
 * reconhece — sem esta extensão, `cn("rounded-06", "rounded-12")` devolve AS
 * DUAS e quem ganha é a ordem no CSS, não a intenção de quem chamou.
 *
 * A falha é silenciosa: nada quebra, o canto só fica errado. Verificada por
 * `pnpm classes`, que reprova de propósito quando a extensão sai.
 *
 * Espaço, tipo e cor não precisam de extensão — os grupos de fábrica já casam
 * com `p-12`, `text-lg` e `bg-surface-2`.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [
        {
          rounded: [
            "02","03","04","05","06","07","08","09","10","12","14","pill",
          ],
        },
      ],
    },
  },
});

/**
 * Compõe classes resolvendo conflito pelo último a chegar.
 *
 * É o que faz um wrapper aceitar customização de fora sem virar loteria de
 * ordem de CSS. O React Compiler não se importa: é string, não hook.
 */
export function cn(...classes: ClassValue[]) {
  return merge(clsx(classes));
}
