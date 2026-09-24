import { contagem } from "../lib/plural";

/**
 * A segunda linha de uma conversa na coluna da casa.
 *
 * No GRUPO é a última mensagem com quem a disse, como no design ("Júlia: subo
 * os cortes hoje") — é o único tipo em que "quem disse" não é óbvio. Sem a
 * mensagem carregada (a sessão nunca abriu o grupo), volta a ser a contagem
 * de gente: degradação honesta, nem esqueleto nem texto inventado.
 *
 * Na DM e nas notas é só o texto: há um lado só falando com você, ou só você.
 *
 * Pura para ser testável sem store — quem resolve os nomes é o componente.
 */
export function detalheDaConversa(conversa: {
  readonly tipo: "dm" | "grupo" | "notas";
  readonly participantes: number;
  /** A última mensagem, se a sessão a tem. */
  readonly ultima: { readonly conteudo: string; readonly minha: boolean } | undefined;
  /** O nome de quem escreveu a última, quando não fui eu. */
  readonly autor: string | undefined;
}): string | undefined {
  const { tipo, ultima } = conversa;
  if (tipo !== "grupo") return ultima?.conteudo || undefined;
  if (!ultima?.conteudo) return `${contagem(conversa.participantes)} pessoas`;
  const quem = ultima.minha ? "Você" : (conversa.autor ?? "Alguém");
  return `${quem}: ${ultima.conteudo}`;
}
