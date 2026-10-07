import * as Primitivo from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";

import { comum } from "../../textos";
import { Fechar } from "../icones";
import { estilos, juntar } from "./classes";

/**
 * Diálogo. Foco preso enquanto aberto, foco devolvido ao gatilho ao fechar,
 * Esc, clique fora e `aria-modal` vêm do Radix; escrever isso à mão termina
 * em acessibilidade quebrada em algum caminho de teclado.
 */
export const Dialogo = Primitivo.Root;
export const DialogoGatilho = Primitivo.Trigger;
export const DialogoFechar = Primitivo.Close;

type Props = Omit<ComponentProps<typeof Primitivo.Content>, "title"> & {
  /** Obrigatório: diálogo sem título é anunciado como "diálogo" e mais nada. */
  titulo: string;
  /** Esconde o título da tela mas o mantém para o leitor de tela. */
  tituloOculto?: boolean;
  descricao?: string;
};

export function ConteudoDoDialogo({
  titulo,
  tituloOculto = false,
  descricao,
  className,
  children,
  ...props
}: Props): ReactNode {
  return (
    <Primitivo.Portal>
      <Primitivo.Overlay className={estilos.scrim} />
      <Primitivo.Content
        // Sem descrição o Radix avisa no console; `undefined` diz que é de propósito.
        {...(descricao === undefined ? { "aria-describedby": undefined } : {})}
        {...props}
        className={juntar(estilos.vidro, estilos.elevado, estilos.dialogo, estilos.entrada, className)}
      >
        <Primitivo.Title className={tituloOculto ? estilos.somenteLeitor : estilos.titulo}>
          {titulo}
        </Primitivo.Title>
        {descricao !== undefined && (
          <Primitivo.Description className={estilos.descricao}>{descricao}</Primitivo.Description>
        )}
        {children}
        <Primitivo.Close
          className={juntar(estilos.botaoDeIcone, estilos.fechar)}
          aria-label={comum.fechar}
        >
          <Fechar />
        </Primitivo.Close>
      </Primitivo.Content>
    </Primitivo.Portal>
  );
}
