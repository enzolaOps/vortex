/**
 * As iniciais de um nome, para o avatar sem foto.
 *
 * ⚠ **Havia QUATRO cópias** — `sdk/map.ts`, `sdk/servidores.ts`,
 * `list/Encaminhar.tsx` e `usuario/PainelDeUsuario.tsx` — e a quinta ia nascer
 * no cartão de identidade das configurações. É a mesma história do `Avatar`,
 * que tinha seis: cada cópia precisa concordar sobre quantas letras, onde
 * cortar e o que fazer com nome vazio, e a que diverge é a que ninguém abriu
 * naquela semana.
 *
 * Separadores: espaço, `_`, `.` e `-`. Nome de usuário do protocolo usa os
 * três últimos, e "ana.ribeiro" precisa dar `AR` e não `AN`.
 *
 * `[...p][0]` e não `p[0]`: nome que começa com emoji ou letra fora do BMP
 * daria metade de um par substituto, que o navegador desenha como caixinha.
 */
export function sigla(nome: string): string {
  const partes = nome
    .trim()
    .split(/[\s_.-]+/)
    .filter(Boolean);
  if (partes.length === 0) return "?";
  const letras = partes.slice(0, 2).map((p) => [...p][0] ?? "");
  return letras.join("").toUpperCase();
}
