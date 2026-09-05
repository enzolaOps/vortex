/**
 * Os tipos dos roteiros, para quem os lê do TypeScript.
 *
 * ⚠ **Existe porque `src/config/roteiros.test.ts` importa o `.mjs`**, e sem
 * declaração o `tsc` reprova com `TS7016` — módulo implicitamente `any` na
 * fronteira. Declarar só o que o teste usa e não a forma inteira é deliberado:
 * o roteiro é dado de FERRAMENTA, e um tipo completo aqui viraria uma segunda
 * definição que precisa concordar com o arquivo real toda vez que ele ganhar
 * um campo.
 */
export type RoteiroDeConfronto = {
  readonly nome: string;
  /** O `SecaoId` da página, quando o roteiro é de uma tela de configurações. */
  readonly secao?: string;
};

export type DispensaDeConfronto = {
  readonly rotulo: string;
  readonly design: string;
  readonly app: string;
  readonly motivo: string;
};

export const ROTEIROS: readonly RoteiroDeConfronto[];
export const DISPENSAS: readonly DispensaDeConfronto[];
