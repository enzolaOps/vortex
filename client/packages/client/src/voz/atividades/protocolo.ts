/**
 * O contrato entre o app e o host de atividade embutido.
 *
 * ⚠ **O host é tratado como NÃO CONFIÁVEL, mesmo sendo servido por nós.** Ele
 * roda num iframe com `sandbox="allow-scripts"` e sem `allow-same-origin`, ou
 * seja, com origem opaca: não lê o token, o `localStorage`, os cookies nem o
 * DOM do app. O único canal é `postMessage`, e tudo que chega por ele passa
 * por `lerMensagemDoHost` antes de tocar a rede:
 *
 * - a mensagem precisa vir da `contentWindow` DAQUELE iframe (conferido por
 *   quem escuta — origem não serve, porque a de um sandbox é `"null"` para
 *   qualquer iframe sandboxado da página);
 * - só duas formas são aceitas, com campos de tipo exato;
 * - a operação é texto de até 4096 bytes, o teto do servidor.
 *
 * O que o app manda para dentro é o que todo mundo na sala já recebe (as
 * operações) e o próprio ID. Por isso `targetOrigin: "*"` é aceitável — e é o
 * único possível para um destino de origem opaca.
 */
import { TETO_DA_OPERACAO } from "../../store/atividades";

/** Versão do contrato. Host que não a declarar é ignorado. */
export const VERSAO_DO_CONTRATO = 1;

export type MensagemDoHost =
  | { readonly tipo: "pronto" }
  | { readonly tipo: "op"; readonly op: string; readonly snapshot: boolean };

export type MensagemParaHost =
  | {
      readonly vortex: typeof VERSAO_DO_CONTRATO;
      readonly tipo: "carregar";
      readonly eu: string;
      readonly registro: readonly string[];
    }
  | { readonly vortex: typeof VERSAO_DO_CONTRATO; readonly tipo: "op"; readonly op: string };

export function lerMensagemDoHost(dado: unknown): MensagemDoHost | undefined {
  if (typeof dado !== "object" || dado === null) return undefined;
  const m = dado as Record<string, unknown>;
  if (m.vortex !== VERSAO_DO_CONTRATO) return undefined;

  if (m.tipo === "pronto") return { tipo: "pronto" };

  if (m.tipo === "op") {
    if (typeof m.op !== "string" || m.op.length === 0) return undefined;
    if (new TextEncoder().encode(m.op).length > TETO_DA_OPERACAO) return undefined;
    return { tipo: "op", op: m.op, snapshot: m.snapshot === true };
  }

  return undefined;
}
