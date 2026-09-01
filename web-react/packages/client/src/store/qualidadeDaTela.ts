/**
 * A qualidade escolhida para a transmissão em curso.
 *
 * ⚠ **Os DEGRAUS moram aqui e não no motor, e a razão é o bundle.** Quem
 * precisa da lista para DESENHAR é o HUD do palco; quem precisa dela para
 * APLICAR é `sdk/motorDeVoz.ts`, que carrega meio megabyte de WebRTC e por
 * isso só entra por `await import()`. Com a lista lá, o HUD a importaria e
 * arrastaria o LiveKit para o grafo estático — a regressão de 996 kB → 1.539
 * que esta base já mediu uma vez. Com ela aqui, o motor importa deste módulo
 * e a seta aponta para o lado barato.
 *
 * Copiar a lista nos dois lugares seria pior que qualquer uma das duas: o
 * projeto já teve uma cópia deliberada que ficou para trás em silêncio, e o
 * teste passou a medir uma cor que o app não produzia mais.
 *
 * ⚠ **Guarda o que foi PEDIDO, e não o que a fonte entrega.** Os dois são
 * diferentes de propósito: pedir 1080p de uma janela de 900px devolve 900, e
 * quem responde "o que está no ar" é `qualidadeRealDaTela()`, que mede. Este
 * store guarda a escolha para o HUD marcar a opção certa depois de se esconder
 * e reaparecer.
 */

export const QUALIDADES_DA_TELA = [
  { id: "1080p60", rotulo: "1080p · 60 fps", altura: 1080, fps: 60 },
  { id: "1080p30", rotulo: "1080p · 30 fps", altura: 1080, fps: 30 },
  { id: "720p30", rotulo: "720p · 30 fps", altura: 720, fps: 30 },
  { id: "480p30", rotulo: "480p · 30 fps", altura: 480, fps: 30 },
] as const;

export type QualidadeDaTela = (typeof QUALIDADES_DA_TELA)[number]["id"];

/**
 * As constraints de um degrau, prontas para `applyConstraints`.
 *
 * ⚠ **Mora AQUI e não no motor, e a mudança foi para poder TESTAR.** Enterrada
 * lá dentro, a decisão que mais importa desta feature — `ideal` e não `exact`
 * — só era observável com uma sala LiveKit de pé, que exige backend e captura
 * de tela reais. Aqui ela é uma função pura sobre dados puros, e uma asserção
 * a segura. É a ordem de preferência do `enforcement.md`: teste ganha de
 * checklist, e o que decide entre os dois costuma ser onde o código está.
 *
 * ⚠ **`ideal` e NUNCA `exact`.** Com `exact`, uma tela de 1366×768 recusaria
 * 1080p com `OverconstrainedError` — e o erro chegaria como "não deu para
 * trocar" numa escolha que o navegador teria atendido em 768p de bom grado. O
 * teto é um pedido; quem decide o que a fonte entrega é o sistema, e é por
 * isso que o rótulo do botão mostra a MEDIDA e não o pedido.
 */
export function constraintsDe(
  id: QualidadeDaTela,
): MediaTrackConstraints | undefined {
  const q = QUALIDADES_DA_TELA.find((x) => x.id === id);
  if (!q) return undefined;
  return { height: { ideal: q.altura }, frameRate: { ideal: q.fps } };
}

/**
 * `undefined` = nunca escolhida, e é diferente do degrau mais alto.
 *
 * Quem nunca escolheu está no que o navegador negociou ao abrir a tela, que
 * não é nenhum destes quatro; marcar "1080p60" ali afirmaria uma escolha que
 * ninguém fez. É a mesma distinção do nível de notificação por canal.
 */
let escolhida: QualidadeDaTela | undefined;

const ouvintes = new Set<() => void>();

export function assinarQualidadeDaTela(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: `getSnapshot` não pode alocar. */
export function qualidadeEscolhida(): QualidadeDaTela | undefined {
  return escolhida;
}

export function definirQualidadeEscolhida(id: QualidadeDaTela | undefined): void {
  if (escolhida === id) return;
  escolhida = id;
  for (const o of ouvintes) o();
}

/**
 * Sair da transmissão esquece a escolha.
 *
 * ⚠ Existe porque a próxima transmissão é de OUTRA fonte: a janela que
 * suportava 1080p60 pode ser uma aba de 720p na vez seguinte, e o HUD abriria
 * marcando um degrau que a faixa nova nunca recebeu. É a mesma razão do
 * `limpar()` do store efêmero, com faixa de tela no lugar de vídeo.
 */
export function esquecerQualidadeDaTela(): void {
  definirQualidadeEscolhida(undefined);
}
