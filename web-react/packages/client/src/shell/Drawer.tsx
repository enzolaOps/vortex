import { useEffect, useSyncExternalStore } from "react";

import { CaixaDeEntrada } from "../caixa/CaixaDeEntrada";
import { PainelDeFixados } from "../fixados/PainelDeFixados";
import { LimiteDeErro } from "../components/ui/LimiteDeErro";
import { NOME_DO_PAINEL, type PainelId } from "../preset/schema";
import { assinarDrawer, fecharDrawer, lerDrawer } from "../store/drawer";
import css from "./Drawer.module.css";

/**
 * Os painéis que sabem flutuar.
 *
 * `Partial<Record<PainelId, …>>` e não `Record`: rail e canais são estrutura
 * do shell, não drawer, e obrigá-los a ter uma entrada aqui seria o tipo
 * pedindo uma decisão que não existe. Painel novo que deva flutuar entra
 * nesta lista; painel que não deva simplesmente não entra, e `alternarSuperficie`
 * continua ancorando-o.
 */
const FLUTUAM: Partial<Record<PainelId, () => React.ReactNode>> = {
  fixados: () => <PainelDeFixados aoFechar={fecharDrawer} />,
  caixaDeEntrada: () => <CaixaDeEntrada aoFechar={fecharDrawer} />,
};

/**
 * O drawer lateral — fixadas e caixa de entrada, como o design os desenha.
 *
 * ⚠ **Flutua, e não ocupa slot.** Ver `store/drawer.ts`: abrir pelo cabeçalho
 * roubava o slot da ponta e a lista de membros sumia. Aqui nada é evictado, e
 * fechar não mexe no layout de ninguém.
 *
 * Montado UMA vez na camada sobreposta, e renderiza `null` quase sempre —
 * um `useSyncExternalStore` sobre uma string, comparada por valor. Montar em
 * vez de esconder é o que faz cada abertura nascer limpa, como o registro de
 * modais já faz.
 */
export function Drawer() {
  const aberto = useSyncExternalStore(assinarDrawer, lerDrawer);

  /*
    `Esc` fecha, e o listener só existe enquanto há drawer.

    No `document` e não no painel: o foco pode estar em qualquer alvo dentro
    dele, e um handler no container perderia a tecla assim que alguém clicasse
    numa linha. Não é `Dialog` do Radix de propósito — o drawer NÃO prende
    foco nem escurece o app; ele existe para a pessoa continuar lendo a
    conversa atrás dele, que é a mesma razão pela qual o painel de edição
    também ficou de fora do registro de modais.
  */
  useEffect(() => {
    if (aberto === null) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") fecharDrawer();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  if (aberto === null) return null;
  const render = FLUTUAM[aberto];
  if (!render) return null;

  return (
    <aside className={css.drawer} aria-label={NOME_DO_PAINEL[aberto]}>
      {/* O mesmo limite por painel que o shell usa: um painel que lança não
          pode levar a conversa junto. */}
      <LimiteDeErro oQue={`O painel de ${NOME_DO_PAINEL[aberto]}`}>
        {render()}
      </LimiteDeErro>
    </aside>
  );
}
