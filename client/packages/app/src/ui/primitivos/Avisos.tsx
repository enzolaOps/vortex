import * as Primitivo from "@radix-ui/react-toast";
import { useSyncExternalStore } from "react";
import {
  assinarToasts,
  DURACAO_DO_TOAST_MS,
  dispensarToast,
  lerToasts,
  naoExpira,
} from "nucleo/ui-logica/toastStore";

import { comum } from "../../textos";
import { Fechar } from "../icones";
import { estilos, juntar } from "./classes";

/**
 * Avisos. O estado vive no store do núcleo (module-level, fora do React): quem
 * dispara é um tratador de erro ou um caminho de reconexão, nunca uma árvore de
 * componentes. Aqui só se desenha. Dispare com `toast` do próprio núcleo.
 */
export { toast } from "nucleo/ui-logica/toastStore";

export function Avisos() {
  const avisos = useSyncExternalStore(assinarToasts, lerToasts);
  return (
    <Primitivo.Provider label={comum.notificacoes} swipeDirection="right">
      {avisos.map((aviso) => (
        <Primitivo.Root
          key={aviso.id}
          type={aviso.tipo === "erro" ? "foreground" : "background"}
          duration={naoExpira(aviso) ? Infinity : DURACAO_DO_TOAST_MS}
          onOpenChange={(aberto) => {
            if (!aberto) dispensarToast(aviso.id);
          }}
          data-tipo={aviso.tipo}
          className={juntar(estilos.vidro, estilos.elevado, estilos.aviso, estilos.entrada)}
        >
          <Primitivo.Title>
            {aviso.titulo}
            {aviso.repeticoes !== undefined && aviso.repeticoes > 1
              ? ` (${comum.repeticoes(aviso.repeticoes)})`
              : null}
          </Primitivo.Title>
          {aviso.descricao !== undefined && (
            <Primitivo.Description>{aviso.descricao}</Primitivo.Description>
          )}
          {(aviso.acao !== undefined || aviso.acaoSecundaria !== undefined) && (
            <div className={estilos.avisoAcoes}>
              {[aviso.acaoSecundaria, aviso.acao].map(
                (acao) =>
                  acao !== undefined && (
                    <Primitivo.Action
                      key={acao.rotulo}
                      altText={acao.descricaoAlternativa}
                      className={estilos.botaoDeTexto}
                      onClick={acao.aoAtivar}
                    >
                      {acao.rotulo}
                    </Primitivo.Action>
                  ),
              )}
            </div>
          )}
          <Primitivo.Close
            aria-label={comum.dispensarAviso}
            className={juntar(estilos.botaoDeIcone, estilos.fechar)}
          >
            <Fechar />
          </Primitivo.Close>
        </Primitivo.Root>
      ))}
      <Primitivo.Viewport className={estilos.areaDeAvisos} />
    </Primitivo.Provider>
  );
}
