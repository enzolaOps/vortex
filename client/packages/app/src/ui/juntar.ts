/** Junta classes ignorando o que for falso. */
export function juntar(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
