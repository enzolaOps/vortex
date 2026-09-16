/**
 * `deu-ruim.png` → `deu ruim`. O nome da figurinha aceita espaço e acento
 * (ao contrário do emoji), então só a extensão e os separadores saem.
 */
export function nomeDoArquivo(arquivo: string): string {
  const limpo = arquivo
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim();
  return limpo === "" ? "figurinha" : limpo;
}
