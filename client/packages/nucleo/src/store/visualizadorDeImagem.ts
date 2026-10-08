/**
 * Qual imagem de qual mensagem o visualizador está mostrando.
 *
 * Mira a MENSAGEM e não a URL: com uma URL solta, o cabeçalho (quem, onde,
 * quando) e as setas (qual é a próxima da mesma mensagem) são irrepresentáveis.
 *
 * Store module-level e não Context, pela lei nº 1: abrir muda uma vez por
 * clique, e um Context re-renderizaria a lista inteira. Um visualizador para o
 * app inteiro, e não um Dialog por anexo — o anexo é montado em toda linha.
 */

export type AlvoDoVisualizador = {
  readonly messageId: string;
  readonly anexoId: string;
};

/** O objeto GUARDADO: montá-lo no getter seria referência nova a cada leitura. */
let alvo: AlvoDoVisualizador | null = null;
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const o of ouvintes) o();
}

export function assinarVisualizador(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerAlvoDoVisualizador(): AlvoDoVisualizador | null {
  return alvo;
}

/** Abre (ou troca) pelo anexo. Comparação por campo: repetir não acorda ninguém. */
export function abrirVisualizador(messageId: string, anexoId: string): void {
  if (alvo?.messageId === messageId && alvo.anexoId === anexoId) return;
  alvo = { messageId, anexoId };
  avisar();
}

export function fecharVisualizador(): void {
  if (alvo === null) return;
  alvo = null;
  avisar();
}
