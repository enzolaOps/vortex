/**
 * "Tem alguém arrastando uma borda agora?"
 *
 * Um booleano module-level e um evento. Parece pequeno demais para ter arquivo
 * próprio, e é o que impede o modo edição de destruir a lista de mensagens.
 *
 * O problema: durante o arraste, a coluna de mensagem muda de largura a cada
 * frame — é isso que "preview ao vivo" quer dizer. O `ResizeObserver` da
 * `MessageList` existe desde a fase 0 justamente para reagir a mudança de
 * largura remedindo TODAS as linhas. Somados sem cuidado, os dois viram uma
 * remedição completa de 10k linhas por frame enquanto alguém arrasta.
 *
 * A referência da fase 4 manda "remedir e reancorar após o commit, nunca
 * durante o arraste". Isto é o mecanismo dessa frase.
 *
 * NÃO passa por `useSyncExternalStore`: quem lê é um callback de
 * `ResizeObserver`, imperativo, fora de render. Modelar como estado de React
 * obrigaria a re-renderizar a lista para contar a ela que não é para
 * re-renderizar.
 */
type Ouvinte = () => void;

let arrastando = false;

const aoTerminar = new Set<Ouvinte>();

export function estaArrastando(): boolean {
  return arrastando;
}

export function iniciarArraste(): void {
  arrastando = true;
}

/**
 * Fim do arraste. Quem estava adiando trabalho de layout faz agora.
 *
 * O evento é necessário porque o commit no store NÃO gera mudança de tamanho:
 * a largura já foi escrita no DOM durante o arraste, então o `ResizeObserver`
 * não dispara de novo. Sem este aviso, a remedição adiada nunca aconteceria e
 * a lista ficaria com alturas medidas numa largura que não existe mais.
 */
export function terminarArraste(): void {
  if (!arrastando) return;
  arrastando = false;
  for (const ouvinte of aoTerminar) ouvinte();
}

export function aoTerminarArraste(ouvinte: Ouvinte): () => void {
  aoTerminar.add(ouvinte);
  return () => {
    aoTerminar.delete(ouvinte);
  };
}
