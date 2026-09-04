import { lazy, Suspense } from "react";

import { ARNES_ATIVO } from "./dev/arnesAtivo";
import { Cliente } from "./app/Cliente";

/**
 * Quem entra: o cliente, ou o arnês de medição.
 *
 * ⚠ **O arnês NÃO é uma rota do produto, e mantê-lo fora do `Local` é
 * deliberado.** `Local` é a união marcada que descreve onde a pessoa está —
 * casa, servidor, conversa — e é ela que a URL projeta, que o preset não pode
 * carregar e que o deep-link do Electron resolve. Um `{ tipo: "arnes" }` ali
 * dentro seria um lugar do produto que o produto não tem: apareceria no
 * histórico, na paleta de comandos e em toda exaustividade de `Record<Local,
 * …>` que o projeto usa como mecanismo.
 *
 * Então ele é lido do `pathname` cru, uma vez, e nunca entra em store nenhum.
 *
 * O predicado mora em `dev/arnesAtivo.ts` porque o `main` precisa dele
 * também, para não ligar o roteador — ver o comentário lá.
 */

const Arnes = lazy(() =>
  import("./dev/Arnes").then((m) => ({ default: m.Arnes })),
);

export function App() {
  if (!ARNES_ATIVO) return <Cliente />;

  /*
    `Suspense` sem fallback visível de propósito.

    O arnês só é alcançável em desenvolvimento, na própria máquina, e o chunk
    dele chega no mesmo quadro. Uma tela de carregamento aqui pisca uma vez e
    some — que é o tipo de estado transiente que o projeto já decidiu não
    desenhar quando ninguém o vê tempo suficiente para lê-lo.
  */
  return (
    <Suspense fallback={null}>
      <Arnes />
    </Suspense>
  );
}
