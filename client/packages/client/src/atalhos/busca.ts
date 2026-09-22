import { teclaExibida } from "../components/ui/Tecla";
import type { LinhaDeAtalho } from "./registro";

/**
 * O filtro: por RÓTULO ou por TECLA.
 *
 * ⚠ **A tecla é comparada na notação da PLATAFORMA e também na neutra.** Quem
 * digita "⌘K" num Mac e quem digita "ctrl" no Windows procuram a mesma coisa,
 * e os tokens gravados são `["mod","K"]` — sem comparar as duas formas, buscar
 * pelo símbolo que a própria tela mostra não acharia nada. A tradução para
 * exibição mora no `<Combinacao>`, então aqui basta casar contra o token cru e
 * contra o texto renderizado.
 */
export function casa(linha: LinhaDeAtalho, busca: string): boolean {
  if (!busca) return true;
  const termo = normalizar(busca);
  if (normalizar(linha.rotulo).includes(termo)) return true;
  /*
    A combinação INTEIRA também, nas duas grafias — "⌘K" no Mac e "ctrl+k"
    no resto. Casar só token a token faria a busca pelo exemplo que a própria
    tela sugere ("Ctrl+K") não achar nada, porque nenhum token isolado contém
    o "+".
  */
  const exibidas = linha.teclas.map(teclaExibida);
  const inteira = [exibidas.join(""), exibidas.join("+"), exibidas.join(" ")];
  if (inteira.some((f) => normalizar(f).includes(termo))) return true;
  return linha.teclas.some(
    (t) =>
      normalizar(t).includes(termo) ||
      normalizar(teclaExibida(t)).includes(termo),
  );
}

/** Sem acento e em minúscula — a mesma normalização do índice da paleta. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
