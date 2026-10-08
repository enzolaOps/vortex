import { lazy, Suspense } from "react";

import { chat } from "../../../textos";
import { juntar } from "../../../ui/juntar";
import css from "./Emoji.module.css";

/**
 * O painel de emoji, carregado na primeira abertura.
 *
 * A lista curada pesa alguns kB e a maioria das sessões nunca abre o seletor
 * (as reações rápidas do menu cobrem o resto): fica fora do bundle inicial. O
 * `fallback` tem a MESMA caixa do painel, para o popover não mudar de tamanho
 * quando o módulo chega.
 */
const PainelDeEmoji = lazy(() => import("./PainelDeEmoji"));

export function PainelPreguicoso({ aoEscolher }: { aoEscolher: (glifo: string) => void }) {
  return (
    <Suspense
      fallback={
        <div className={juntar(css.painel, css.carregando)} role="status">
          {chat.emoji.carregando}
        </div>
      }
    >
      <PainelDeEmoji aoEscolher={aoEscolher} />
    </Suspense>
  );
}
