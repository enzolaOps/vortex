/**
 * O alias de um emoji, fora do componente.
 *
 * Pura de propósito, pela mesma razão de `selecaoDeCargo.ts`: a edição inline
 * é quase só duas decisões — como o texto digitado vira alias, e se ele já é
 * de outro emoji —, e as duas carregam regra do servidor (`RE_EMOJI`, alias
 * único por servidor) que precisa de teste sem montar React nem dublar o SDK.
 */

/** O teto do protocolo (`RE_EMOJI`, 1–32). */
export const MAX_ALIAS = 32;

/**
 * O que o servidor aceita como nome.
 *
 * ⚠ **Aproximação deliberada e não a regex do servidor copiada** — ela é dele
 * e muda com ele. É a mesma decisão já escrita em `nomeDeEmoji`: isto acerta
 * no caso comum, e o que não passar volta traduzido pelo `motivo` do erro.
 * Duplicar `RE_EMOJI` aqui daria duas regras que precisam concordar, e a
 * primeira a divergir seria a que ninguém exercitou naquela semana.
 */
export function normalizarAlias(bruto: string): string {
  return bruto
    .trim()
    .normalize("NFD")
    /* Tira acento: `ação` vira `acao`, e não `ao`. */
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_ALIAS);
}

/** O que a edição inline deve fazer ao sair do campo. */
export type VeredictoDeAlias =
  /** Nada mudou, ou não sobrou nome: o campo volta ao valor de antes. */
  | { readonly tipo: "nada" }
  /**
   * O alias já é de outro emoji.
   *
   * ⚠ **`dono` é quem SUBIU o emoji que já usa o alias, e não o nome dele.** A
   * pergunta de quem colide é "quem foi que pegou esse nome?", e o design pede
   * exatamente isso: borda danger e o dono ao lado. Ausente quando o protocolo
   * não registrou o criador — `Emoji.creator` pode não vir.
   */
  | { readonly tipo: "colisao"; readonly dono: string | undefined }
  /** Vale escrever. */
  | { readonly tipo: "salvar"; readonly nome: string };

/**
 * Decide o que fazer com o texto digitado.
 *
 * ⚠ **A colisão é conferida contra a lista JÁ CARREGADA, e isso é honesto por
 * construção:** a página inteira dos emojis do servidor veio numa chamada só,
 * e ela é o conjunto onde o alias precisa ser único. Não é palpite sobre o
 * servidor — é a mesma lista que o servidor mandou.
 *
 * ⚠ **O próprio emoji é excluído da comparação.** Sem isso, entrar no campo e
 * sair sem mexer acusaria colisão consigo mesmo — que é a família do "a
 * otimista reconciliava CONSIGO MESMA" já registrada neste projeto.
 */
export function avaliarAlias(
  bruto: string,
  emojiId: string,
  atual: string,
  lista: readonly { readonly id: string; readonly nome: string; readonly porNome: string | undefined }[],
): VeredictoDeAlias {
  const nome = normalizarAlias(bruto);
  if (nome === "" || nome === atual) return { tipo: "nada" };
  const dono = lista.find((e) => e.id !== emojiId && e.nome === nome);
  if (dono) return { tipo: "colisao", dono: dono.porNome };
  return { tipo: "salvar", nome };
}
