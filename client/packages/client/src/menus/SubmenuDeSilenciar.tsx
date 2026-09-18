import { useEffect, useState, useSyncExternalStore } from "react";

import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../components/ui/ContextMenu";
import { BellSimple, BellSimpleSlash, ICONE } from "../components/ui/icones";
import { assinarSilencio } from "../store/silencio";
import {
  DURACOES_DE_SILENCIO,
  duracaoDoAlvo,
  estaMudoOAlvo,
  prazoDoAlvo,
  reativarAlvo,
  restanteDeSilencio,
  silenciarAlvo,
  type AlvoDeSilencio,
} from "./silenciar";
import css from "./SubmenuDeSilenciar.module.css";

/**
 * O submenu de silenciar — o mesmo em servidor, canal, DM, grupo e tópico.
 *
 * Ver `silenciar.ts` para por que ele existe e por que categoria fica de fora.
 *
 * ⚠ **Submenu SEMPRE, inclusive silenciado, e isso reverte uma decisão
 * anterior.** O menu do canal virava um item só ("Reativar avisos") com a
 * razão escrita: *"reativar é uma coisa só — um submenu com uma opção pede
 * dois gestos para fazer o que um faz"*. Só que ele não tem uma opção: tem
 * seis, porque TROCAR o prazo é o caso que faltava — quem silenciou por 15
 * minutos e quer 8 horas precisava reativar e silenciar de novo. "Reativar
 * avisos" continua sendo o primeiro item de dentro, então o gesto extra é um
 * movimento do ponteiro, não um clique.
 *
 * ⚠ **`ContextMenuCheckboxItem` e não `Item` com ✓ desenhado à mão**: dentro
 * de um `menu` o leitor de tela precisa de `menuitemcheckbox` para anunciar
 * "marcado", e o wrapper já resolve isso desde a fase 2.
 */
export function SubmenuDeSilenciar({
  alvo,
  rotulo,
}: {
  alvo: AlvoDeSilencio;
  /** "Silenciar canal", "Silenciar servidor", "Silenciar conversa"… */
  rotulo: string;
}) {
  const mudo = useSyncExternalStore(assinarSilencio, () => estaMudoOAlvo(alvo));
  const escolhida = useSyncExternalStore(assinarSilencio, () => duracaoDoAlvo(alvo));
  const ate = useSyncExternalStore(assinarSilencio, () => prazoDoAlvo(alvo));

  /*
    O relógio de MINUTO, e só enquanto há prazo finito.

    Mesma separação do `Cronometro` e do marcador da coluna: o rótulo é "7 h"
    ou "12 min", e nenhum dos dois muda mais rápido que isso. O menu só existe
    montado, então o intervalo morre com ele.
  */
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (ate === undefined || ate === Infinity) return;
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [ate]);

  const restante = restanteDeSilencio(ate, agora);

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        {mudo ? (
          <BellSimpleSlash size={ICONE.calha} aria-hidden />
        ) : (
          <BellSimple size={ICONE.calha} aria-hidden />
        )}
        {rotulo}
        {/* O restante vive no GATILHO e não dentro: é a resposta de "estou
            silenciado até quando?", e essa pergunta se faz sem abrir nada. */}
        {restante ? <span className={css.restante}>{restante}</span> : null}
      </ContextMenuSubTrigger>

      <ContextMenuSubContent>
        {mudo ? (
          <>
            <ContextMenuItem onSelect={() => reativarAlvo(alvo)}>
              <BellSimple size={ICONE.calha} aria-hidden />
              Reativar avisos
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}

        {DURACOES_DE_SILENCIO.map((d) => (
          <ContextMenuCheckboxItem
            key={d.rotulo}
            marcado={mudo && escolhida === d.ms}
            aoAlternar={() => silenciarAlvo(alvo, d.ms)}
          >
            {d.rotulo}
          </ContextMenuCheckboxItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
