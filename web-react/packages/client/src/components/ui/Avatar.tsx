import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { corDoTextoDe, gradienteDe } from "../../lib/gradiente";
import css from "./Avatar.module.css";

/**
 * O avatar — uma peça, seis superfícies.
 *
 * ⚠ **Havia SEIS cópias disto**: member list, linha de mensagem, cartão de
 * perfil, sala de voz, lista de conversas e painel de usuário. Cada uma com o
 * próprio `.avatar` no módulo vizinho, e as seis precisando concordar sobre
 * forma, tamanho e cor. Trocar o avatar de cinza para gradiente exigiria seis
 * edições que ninguém garantiria estarem completas — e a que ficasse para trás
 * seria a que ninguém abriu naquela semana.
 *
 * O `tamanho` é a escala própria de avatar (`--vx-avatar-*`), e não a de
 * espaçamento: avatar é CAIXA DE CONTEÚDO, não respiro entre coisas.
 * Compartilhar a escala amarraria as duas, e mexer no respiro da lista mudaria
 * o tamanho da foto de todo mundo.
 *
 * `children` existe para o ponto de presença, que é sobreposto e precisa do
 * `position: relative` daqui.
 */
export function Avatar({
  id,
  sigla,
  tamanho = "sm",
  className,
  children,
}: {
  /**
   * De quem é. É daqui que sai a cor.
   *
   * String vazia é legítima: o placeholder de linha não resolvida ainda não
   * sabe de quem é, e precisa da mesma caixa para a lista não pular. Ele
   * recebe o gradiente do ID vazio, que é estável e discreto.
   */
  id: string;
  /** As iniciais. Ausente = caixa vazia, para placeholder. */
  sigla?: string;
  tamanho?: "xxs" | "xs" | "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={cn(css.avatar, css[tamanho], className)}
      aria-hidden
      /*
        Gradiente e cor vêm do DADO, então `style` inline é o lugar certo — a
        mesma regra da cor de cargo. Não é valor mágico escrito por quem
        programa, e não há como isto virar uma classe: são 360 matizes.

        O custo por render é zero: `lib/gradiente.ts` cacheia por ID, e o ID
        nunca muda. Sem isso a linha de mensagem pagaria três conversões OKLCH
        por avatar visível a cada re-render.
      */
      style={{ backgroundImage: gradienteDe(id), color: corDoTextoDe(id) }}
    >
      {/* A sigla recortada; o ponto de presença (children) FORA do recorte.
          Ver `.sigla` no módulo — o recorte no avatar comia o indicador. */}
      <span className={css.sigla}>{sigla}</span>
      {children}
    </span>
  );
}
