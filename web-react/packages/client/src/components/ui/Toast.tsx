import * as Primitivo from "@radix-ui/react-toast";
import { useSyncExternalStore } from "react";

import { cn } from "../../lib/cn";
import { assinarToasts, dispensarToast, lerToasts } from "./toastStore";

export { toast, dispensarToast } from "./toastStore";

/**
 * Toast — notificação in-app, erro de envio, reconexão.
 *
 * Terceiro dos primitivos que o Base UI ainda não tem, e o que mais depende de
 * acessibilidade correta: o Radix cuida da região `aria-live`, do swipe para
 * dispensar, e da ordem de foco pelo atalho do sistema (F6 no Windows) —
 * detalhes que ninguém escreve à mão sem esquecer metade.
 *
 * Montado uma vez na raiz. Os toasts vêm do store, não de props.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(assinarToasts, lerToasts);

  return (
    <Primitivo.Provider duration={5000} swipeDirection="right">
      {toasts.map((t) => (
        <Primitivo.Root
          key={t.id}
          open
          onOpenChange={(aberto) => {
            if (!aberto) dispensarToast(t.id);
          }}
          className={cn(
            "rounded-3 border p-3",
            "data-[state=closed]:opacity-0 data-[state=open]:opacity-100 anim-base",
            // Erro leva borda semântica; o resto fica no neutro. Cor sozinha
            // não carrega o significado — o título diz o que aconteceu.
            t.tipo === "erro"
              ? "border-danger bg-surface-2"
              : "border-border-subtle bg-surface-2",
          )}
        >
          <Primitivo.Title className="text-md font-medium text-text-1">
            {t.titulo}
          </Primitivo.Title>

          {t.descricao ? (
            <Primitivo.Description className="mt-1 text-sm text-text-2">
              {t.descricao}
            </Primitivo.Description>
          ) : null}

          <Primitivo.Close
            aria-label="Dispensar"
            className="absolute end-2 top-2 rounded-1 px-1 text-text-3 hover:text-text-1"
          >
            ×
          </Primitivo.Close>
        </Primitivo.Root>
      ))}

      {/*
        A viewport é a região que o leitor de tela anuncia. Fica fixa e fora do
        fluxo, e por isso é o único lugar do app onde `fixed` é o certo.
      */}
      <Primitivo.Viewport className="fixed end-4 bottom-4 z-50 flex w-80 flex-col gap-2 outline-none" />
    </Primitivo.Provider>
  );
}
