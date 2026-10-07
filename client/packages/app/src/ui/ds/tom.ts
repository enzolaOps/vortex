export type Tom = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** FNV-1a: IDs de pessoa compartilham prefixo, e uma soma de códigos os agruparia. */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Tom do avatar (1 a 8). Tom explícito vence; sem ele, o ID escolhe, e sem ID o
 * nome. Estável entre sessões: o tom é identidade decorativa, quem a pessoa é
 * vem das iniciais e do nome.
 */
export function tomDe(id: string | undefined, nome: string, tom?: number): Tom {
  if (tom !== undefined && Number.isInteger(tom) && tom >= 1 && tom <= 8) return tom as Tom;
  return ((hash(id ?? nome) % 8) + 1) as Tom;
}

/** Primeira letra da primeira e da última palavra; uma palavra só dá uma letra. */
export function iniciais(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = palavras[0];
  if (primeira === undefined) return "";
  const ultima = palavras.length > 1 ? palavras[palavras.length - 1] : undefined;
  const primeiraLetra = Array.from(primeira).at(0) ?? "";
  const ultimaLetra = ultima === undefined ? "" : (Array.from(ultima).at(0) ?? "");
  return (primeiraLetra + ultimaLetra).toLocaleUpperCase("pt-BR");
}
