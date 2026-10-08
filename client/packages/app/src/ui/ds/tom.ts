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

const letras = (t: string) => Array.from(t);

/**
 * Siglas de duas letras para um conjunto de salas irmãs. O prefixo que todas
 * repetem ("voz-geral", "voz-jogos") não identifica nenhuma e sai; sobra a
 * palavra que as distingue ("JO"). Quando duas ainda coincidem, a segunda letra
 * avança pela palavra até achar uma sigla livre; se não houver, repete (o nome
 * completo continua no rótulo).
 */
export function siglasDeSalas(nomes: readonly string[]): string[] {
  const partes = nomes.map((n) => n.trim().split(/[\s\-_]+/).filter(Boolean));
  let corte = 0;
  const primeira = partes[0]?.[0]?.toLocaleLowerCase("pt-BR");
  if (
    partes.length > 1 &&
    primeira !== undefined &&
    partes.every((p) => p.length > 1 && p[0]?.toLocaleLowerCase("pt-BR") === primeira)
  ) {
    corte = 1;
  }
  const usadas = new Set<string>();
  return partes.map((p, i) => {
    const uteis = p.slice(corte);
    const base = uteis[0] ?? nomes[i] ?? "";
    const letrasDaBase = letras(base);
    const segunda = uteis[1] ? letras(uteis[1])[0] : undefined;
    const candidatas: string[] = [];
    const a = letrasDaBase[0] ?? "";
    if (letrasDaBase.length > 1) candidatas.push(a + (letrasDaBase[1] ?? ""));
    if (segunda) candidatas.push(a + segunda);
    for (let k = 2; k < letrasDaBase.length; k++) candidatas.push(a + (letrasDaBase[k] ?? ""));
    if (candidatas.length === 0) candidatas.push(a);
    const cand = candidatas.map((c) => c.toLocaleUpperCase("pt-BR"));
    const escolhida = cand.find((c) => !usadas.has(c)) ?? cand[0] ?? "";
    usadas.add(escolhida);
    return escolhida;
  });
}
