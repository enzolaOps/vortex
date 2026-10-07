/**
 * Os gradientes de avatar e de ladrilho — os do design, exatos.
 *
 * ⚠ **Isto era DERIVADO do ID e passou a ser CURADO, por decisão de quem toca
 * o produto.** A versão anterior tirava o matiz de um hash e fixava L e C, o
 * que dava 360 identidades de cor; media-se contra o design e sobrava sempre a
 * mesma diferença, porque o croma dele varia 4,4× entre as famílias (0,026 a
 * 0,115) e nenhum par de constantes reproduz três valores tão distantes.
 *
 * O que se ganha: semelhança 1:1 — são os hexes do design, sem aproximação.
 * O que se perde, dito uma vez: **a identificação por cor encolheu de 360 para
 * três.** Numa lista de vinte pessoas, sete compartilham cada gradiente. A cor
 * deixa de ser um traço de quem é e vira variedade visual; quem identifica
 * continua sendo a inicial e o nome. Foi decidido com isso à vista.
 *
 * ⚠ **São QUATRO gradientes no design e só TRÊS entram no sorteio.** O quarto
 * — `#35C2CC → #1E7F92`, o acento — carrega `V` e `VX` em todas as 35
 * ocorrências: é a MARCA, não um avatar. Sorteá-lo para pessoas poria a cor de
 * "isto está ativo" em gente aleatória, que é a disciplina de acento que este
 * projeto já teve de consertar uma vez (nove lâminas simultâneas na tela).
 * Ele fica exportado à parte, no papel que o design lhe dá.
 *
 * Não é substituto de avatar de verdade: quando o upload existir, a imagem
 * cobre isto.
 */

import { razao } from "../tema/cor";

/** Um gradiente do design, com a cor que se escreve em cima dele. */
type Paleta = {
  readonly gradiente: string;
  readonly texto: string;
  /**
   * O ponto do gradiente onde a inicial contrasta PIOR — é contra ele que o
   * contraste é medido.
   *
   * ⚠ **Não é "o mais claro", e essa suposição me custou um teste vermelho.**
   * Com texto claro sobre os três fundos escuros, o pior ponto é de fato o
   * claro. Na paleta da marca o texto é ESCURO sobre um teal brilhante, e ali
   * a relação inverte: contra `#35C2CC` dá 8,46 e contra `#1E7F92`, 3,91. Um
   * campo chamado "o mais claro" mediria o melhor caso e chamaria de garantia.
   */
  readonly fundo: string;
};

/*
  A cor das iniciais é FIXA, e isso mudou junto.

  Enquanto o gradiente era derivado, o texto era derivado com ele e o par
  variava junto. Com o gradiente fixo, um texto que seguisse `--vx-text-1`
  quebraria no tema claro — lá o `text-1` é quase preto, e estes três fundos
  continuam escuros nos dois modos. Medido no design: `#E6EAF0` sobre os três
  escuros (67 · 32 · 24 ocorrências) e `#04181B` sobre o acento (24).
*/
const TEXTO_CLARO = "#e6eaf0";
const TEXTO_ESCURO = "#04181b";

function paleta(de: string, para: string, texto: string): Paleta {
  return {
    // 140° é o ângulo do design, em todas as ocorrências.
    gradiente: `linear-gradient(140deg, ${de}, ${para})`,
    texto,
    fundo: razao(texto, de) <= razao(texto, para) ? de : para,
  };
}

/**
 * As três famílias que uma entidade pode receber.
 *
 * A ordem é a do design por frequência — neutro (68 usos), teal escuro (34),
 * roxo (25) —, e ela importa: com `hash % 3` o índice 0 é o mais provável de
 * cair em qualquer amostra pequena, e o neutro é o que menos chama atenção
 * quando repete.
 */
const FAMILIAS: readonly Paleta[] = [
  paleta("#3c4653", "#222833", TEXTO_CLARO),
  paleta("#2c6e7a", "#173c46", TEXTO_CLARO),
  paleta("#4a3f6b", "#241f38", TEXTO_CLARO),
];

/** O quarto — reservado à marca. Ver o aviso no topo. */
export const PALETA_DA_MARCA: Paleta = paleta("#35c2cc", "#1e7f92", TEXTO_ESCURO);

/**
 * O índice a partir do ID.
 *
 * FNV-1a de 32 bits, e não `charCodeAt` somado: soma simples colide em
 * anagrama, e IDs de servidor são ULIDs que compartilham prefixo de tempo —
 * exatamente o caso em que uma soma dá a mesma cor para tudo o que foi criado
 * no mesmo minuto. Com três famílias o hash importa MAIS, não menos: o espaço
 * de saída é pequeno, então um hash que não espalhe bem os últimos caracteres
 * põe o rail inteiro numa cor só.
 */
export function indiceDe(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % FAMILIAS.length;
}

/**
 * Cache por ID.
 *
 * ⚠ Ele existia porque a derivação custava um hash mais três conversões
 * OKLCH→hex por avatar visível, e a linha de mensagem re-renderiza dezenas de
 * vezes por segundo sob firehose. Com gradiente curado o custo caiu para um
 * hash e um `%`, mas o cache FICA: `paletaDe` devolve o objeto, e sem cache ele
 * seria um objeto NOVO a cada chamada — a mesma armadilha de referência que o
 * `getSnapshot` do store tem, e o erro nº 1 do briefing.
 */
const cache = new Map<string, Paleta>();

function paletaDe(id: string): Paleta {
  const guardada = cache.get(id);
  if (guardada) return guardada;
  const nova = FAMILIAS[indiceDe(id)] as Paleta;
  cache.set(id, nova);
  return nova;
}

/** O gradiente de fundo. */
export function gradienteDe(id: string): string {
  return paletaDe(id).gradiente;
}

/** A cor das iniciais em cima dele. */
export function corDoTextoDe(id: string): string {
  return paletaDe(id).texto;
}

/** O ponto mais claro do gradiente — o que um teste de contraste mede contra. */
export function corDeFundoDe(id: string): string {
  return paletaDe(id).fundo;
}

/** As quatro paletas, para o teste medir cada uma. */
export const PALETAS: readonly Paleta[] = [...FAMILIAS, PALETA_DA_MARCA];
