import { analisar } from "../../markdown/analisar";
import type { BlocoDeMensagem, TrechoDeMensagem } from "../../sdk/domain";

/**
 * A prévia de um resultado de busca: texto puro, com o termo marcado.
 *
 * ⚠ **Não renderiza markdown.** Um resultado é uma linha de varredura, e
 * estrutura (bloco de código, lista, título) esmagaria o cartão. O texto sai da
 * árvore CACHEADA de `analisar` (a mesma da linha de mensagem, por conteúdo):
 * buscar duas vezes o mesmo termo não reparseia nada, e a mensagem que a
 * timeline já mostrou nem chega a ser analisada de novo.
 */

function trechos(
  lista: readonly TrechoDeMensagem[],
  nomeDe: (id: string) => string,
  saida: string[],
): void {
  for (const t of lista) {
    switch (t.tipo) {
      case "texto":
      case "codigo":
        saida.push(t.valor);
        break;
      case "mencao":
        saida.push(`@${nomeDe(t.valor)}`);
        break;
      case "emoji":
        break;
      case "quebra":
        saida.push(" ");
        break;
      case "enfase":
      case "forte":
      case "riscado":
      case "link":
        trechos(t.filhos, nomeDe, saida);
        break;
    }
  }
}

function blocos(
  lista: readonly BlocoDeMensagem[],
  nomeDe: (id: string) => string,
  saida: string[],
): void {
  for (const b of lista) {
    switch (b.tipo) {
      case "paragrafo":
      case "titulo":
        trechos(b.filhos, nomeDe, saida);
        break;
      case "blocoDeCodigo":
        saida.push(b.valor);
        break;
      case "citacao":
        blocos(b.filhos, nomeDe, saida);
        break;
      case "lista":
        for (const item of b.itens) blocos(item.filhos, nomeDe, saida);
        break;
      case "regra":
        break;
    }
    // Um bloco acaba onde o seguinte começa: sem o espaço, dois parágrafos colam.
    saida.push(" ");
  }
}

/** O conteúdo da mensagem em uma linha de texto puro. `nomeDe` resolve menção. */
export function textoDaPrevia(conteudo: string, nomeDe: (id: string) => string): string {
  const partes: string[] = [];
  blocos(analisar(conteudo), nomeDe, partes);
  return partes.join("").replace(/\s+/gu, " ").trim();
}

/** As palavras do texto livre da busca, sem repetição, para marcar na prévia. */
export function termosDaConsulta(texto: string): readonly string[] {
  const vistos = new Set<string>();
  for (const palavra of texto.split(/\s+/u)) {
    const p = palavra.trim();
    if (p.length > 0) vistos.add(p);
  }
  return [...vistos];
}

export type PedacoDePrevia = { readonly texto: string; readonly destaque: boolean };

const ESPECIAIS = new Set([..."\\^$.*+?()[]{}|"]);

function escaparParaRegex(t: string): string {
  return Array.from(t, (c) => (ESPECIAIS.has(c) ? `\\${c}` : c)).join("");
}

function semAcento(t: string): string {
  return t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/**
 * Recorta a prévia em volta do primeiro termo e marca todas as ocorrências.
 *
 * Sem acento e sem caixa, como se busca: "joao" marca "João". O casamento é
 * feito sobre uma versão "letra base" do texto, e cada posição dela aponta
 * para a letra ORIGINAL, de modo que o recorte e a marcação usam os índices do
 * texto como a pessoa o lê.
 */
export function recortarComDestaque(
  texto: string,
  termos: readonly string[],
  maximo = 180,
): readonly PedacoDePrevia[] {
  if (texto.length === 0) return [];
  const chars = Array.from(texto);
  const base = chars.map(semAcento);
  const plano = base.join("");
  const indiceDoPlano: number[] = [];
  base.forEach((b, i) => {
    for (let k = 0; k < b.length; k += 1) indiceDoPlano.push(i);
  });

  const marcado = new Array<boolean>(chars.length).fill(false);
  let primeiro = -1;
  for (const termo of termos) {
    const t = semAcento(termo);
    if (t.length === 0) continue;
    const re = new RegExp(escaparParaRegex(t), "gu");
    for (const m of plano.matchAll(re)) {
      const de = indiceDoPlano[m.index] ?? 0;
      const ate = indiceDoPlano[m.index + m[0].length - 1] ?? de;
      for (let i = de; i <= ate; i += 1) marcado[i] = true;
      if (primeiro === -1 || de < primeiro) primeiro = de;
    }
  }

  let inicio = 0;
  if (chars.length > maximo) {
    inicio = primeiro === -1 ? 0 : Math.max(0, Math.min(primeiro - 30, chars.length - maximo));
  }
  const fim = Math.min(chars.length, inicio + maximo);

  const pedacos: PedacoDePrevia[] = [];
  let atual = "";
  let atualDestaque = false;
  const empurrar = () => {
    if (atual.length > 0) pedacos.push({ texto: atual, destaque: atualDestaque });
    atual = "";
  };
  if (inicio > 0) pedacos.push({ texto: "…", destaque: false });
  for (let i = inicio; i < fim; i += 1) {
    const d = marcado[i] === true;
    if (d !== atualDestaque) {
      empurrar();
      atualDestaque = d;
    }
    atual += chars[i];
  }
  empurrar();
  if (fim < chars.length) pedacos.push({ texto: "…", destaque: false });
  return pedacos;
}
