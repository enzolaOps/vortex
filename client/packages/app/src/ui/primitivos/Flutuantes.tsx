import * as CartaoFlutuante from "@radix-ui/react-hover-card";
import * as Balao from "@radix-ui/react-popover";
import * as RadixDica from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactNode } from "react";

import { estilos, juntar } from "./classes";

// Popover: conteúdo interativo ancorado num gatilho.
export const Popover = Balao.Root;
export const GatilhoDoPopover = Balao.Trigger;

export function ConteudoDoPopover({ className, ...props }: ComponentProps<typeof Balao.Content>) {
  return (
    <Balao.Portal>
      <Balao.Content
        sideOffset={8}
        {...props}
        className={juntar(estilos.vidro, estilos.camada, estilos.popover, estilos.entrada, className)}
      />
    </Balao.Portal>
  );
}

// Dica: texto curto que repete o nome acessível de um controle só de ícone.
export const ProvedorDeDicas = RadixDica.Provider;

export function Dica({
  texto,
  children,
  lado = "top",
}: {
  texto: string;
  children: ReactNode;
  lado?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <RadixDica.Root>
      <RadixDica.Trigger asChild>{children}</RadixDica.Trigger>
      <RadixDica.Portal>
        <RadixDica.Content
          side={lado}
          sideOffset={6}
          className={juntar(estilos.vidro, estilos.camada, estilos.dica, estilos.entrada)}
        >
          {texto}
        </RadixDica.Content>
      </RadixDica.Portal>
    </RadixDica.Root>
  );
}

// Cartão flutuante: prévia ao passar o ponteiro (perfil, link). Só ponteiro.
export const CartaoAoPassar = CartaoFlutuante.Root;
export const GatilhoDoCartao = CartaoFlutuante.Trigger;

export function ConteudoDoCartao({
  className,
  ...props
}: ComponentProps<typeof CartaoFlutuante.Content>) {
  return (
    <CartaoFlutuante.Portal>
      <CartaoFlutuante.Content
        sideOffset={8}
        {...props}
        className={juntar(estilos.vidro, estilos.camada, estilos.cartao, estilos.entrada, className)}
      />
    </CartaoFlutuante.Portal>
  );
}
