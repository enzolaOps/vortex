import * as Primitivo from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/cn";

/**
 * Tooltip.
 *
 * O Provider fica na raiz do app, não por tooltip: ele coordena o atraso
 * compartilhado — o primeiro tooltip espera, os seguintes abrem na hora
 * enquanto o ponteiro segue na mesma região. Um Provider por tooltip
 * devolveria o atraso cheio a cada ícone da barra, que é o comportamento
 * irritante que todo mundo reconhece e ninguém sabe nomear.
 */
export const TooltipProvider = Primitivo.Provider;

/**
 * Lado LÓGICO, não físico.
 *
 * O Radix só fala `side` físico — `left` e `right` —, e o projeto inteiro usa
 * propriedades lógicas por causa da lei nº 6: um painel movido para a borda
 * oposta, ou uma interface em árabe, invertem o que "à direita" significa.
 * Espalhar `side="right"` pelos componentes é plantar uma premissa de lado em
 * cada chamada.
 *
 * O mapeamento vive AQUI, num lugar só, e é lido da direção real do documento
 * em vez de assumida — é a mesma razão pela qual `padding-inline-start` existe.
 *
 * `top` e `bottom` atravessam sem tradução: o eixo de bloco não inverte em
 * nenhum dos idiomas que este app pretende falar.
 */
export type LadoLogico = "acima" | "abaixo" | "inicio" | "fim";

function ladoFisico(lado: LadoLogico): "top" | "bottom" | "left" | "right" {
  if (lado === "acima") return "top";
  if (lado === "abaixo") return "bottom";

  const rtl =
    typeof document !== "undefined" &&
    getComputedStyle(document.documentElement).direction === "rtl";

  if (lado === "inicio") return rtl ? "right" : "left";
  return rtl ? "left" : "right";
}

export function Tooltip({
  texto,
  children,
  lado = "acima",
  ...props
}: {
  texto: ReactNode;
  children: ReactNode;
  lado?: LadoLogico;
} & Omit<ComponentProps<typeof Primitivo.Root>, "children">) {
  return (
    <Primitivo.Root {...props}>
      <Primitivo.Trigger asChild>{children}</Primitivo.Trigger>
      <Primitivo.Portal>
        <Primitivo.Content
          side={ladoFisico(lado)}
          sideOffset={6}
          className={cn(
            /*
              ⚠ A borda é ALFA (`hairline-10`) e não o sólido `border-subtle`:
              o tooltip pousa sobre qualquer superfície do app — timeline,
              painel, modal — e um `#1d232d` fixo desaparece contra `surface-1`
              e grita contra `surface-4`.
            */
            "z-flutuante rounded-06 border border-hairline-10 bg-surface-4 px-10 py-06 shadow-e2",
            /* 12 e não 11: o degrau de 11 é o de SOBRANCELHA e selo, e o
               tooltip é uma frase curta que alguém para para ler. */
            "text-sm font-semibold text-text-1",
            // Movimento explica de onde a coisa veio; não chama atenção.
            // 120ms, só opacity — e nada sob prefers-reduced-motion.
            "anim-fast",
          )}
        >
          {texto}
          <Primitivo.Arrow className="fill-surface-4" />
        </Primitivo.Content>
      </Primitivo.Portal>
    </Primitivo.Root>
  );
}
