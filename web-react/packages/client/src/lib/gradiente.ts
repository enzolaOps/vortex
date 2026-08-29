import { oklchParaHex } from "../tema/cor";

/**
 * Um gradiente estável por ID — o preenchimento de avatar e de ladrilho.
 *
 * ⚠ **Isto resolve o que mais destoava do design, e resolve sem upload.** O
 * design desenha todo servidor e toda pessoa como uma caixa PREENCHIDA com
 * gradiente; o app desenhava anéis vazios e quadrados cinza, e era a diferença
 * que mais fazia a tela parecer outro produto. Os gradientes do mock são
 * escolhidos à mão, um por servidor — aqui eles são derivados do ID, o que dá
 * a mesma leitura e ainda é estável entre sessões e entre pessoas.
 *
 * Não é substituto de avatar de verdade: quando o upload existir, a imagem
 * cobre isto. É o fallback, e um fallback que identifica é melhor que um que
 * só ocupa espaço — duas iniciais em cinza são iguais para todo mundo.
 *
 * **A luminosidade é do app, o matiz é do ID.** É a mesma divisão do
 * `derivar.ts`, e pela mesma razão: em OKLCH o L carrega o contraste, então
 * fixar o L garante que as iniciais sejam legíveis sobre QUALQUER matiz que o
 * hash produza. Um teste varre os 360 e prova.
 */

/**
 * Os dois pontos do gradiente e a cor do texto em cima. Fixos em L.
 *
 * ⚠ **O croma ENCOLHE ao longo do gradiente, e antes ele não encolhia.**
 *
 * Medidos os quatro gradientes que o design usa à mão, a razão croma-fim sobre
 * croma-início é 0,77 (teal `#35C2CC→#1E7F92`), 0,85 (neutro
 * `#3C4653→#222833`) e 0,62 (roxo `#4A3F6B→#241F38`). A nossa era **0,92** —
 * praticamente reta, e um gradiente que não perde saturação lê como uma cor
 * chapada com sombra, não como gradiente. Era a diferença mais visível entre a
 * nossa tela e a do design, porque avatar e ladrilho são as caixas mais
 * repetidas do app.
 *
 * 0,075 → 0,048 reproduz a família ROXA do design exatamente, e ela é a do
 * meio das três. ⚠ **Não dá para reproduzir as três com um par de constantes**
 * — o croma delas varia 4,4× (0,026 a 0,115) porque foram escolhidas uma a
 * uma. A escolha aqui é manter a DERIVAÇÃO por ID (360 identidades em vez de
 * quatro) e copiar a física; adotar as quatro exatas é decisão de produto, e
 * custa a identificação por cor.
 *
 * A razão em L (0,64) já estava dentro da faixa do design (0,65–0,74), e o
 * giro de matiz de +12° também — o design gira +12, +7 e −2.
 */
const CLARO = { l: 0.42, c: 0.075 };
const ESCURO = { l: 0.27, c: 0.048 };
const TEXTO = { l: 0.92, c: 0.04 };

/**
 * Matiz a partir do ID.
 *
 * FNV-1a de 32 bits, e não `charCodeAt` somado: soma simples colide em
 * anagrama, e IDs de servidor são ULIDs que compartilham prefixo de tempo —
 * exatamente o caso em que uma soma dá o mesmo matiz para tudo o que foi
 * criado no mesmo minuto.
 */
export function matizDe(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 360000) / 1000;
}

/**
 * Cache por ID, e ele é OBRIGATÓRIO — não otimização preventiva.
 *
 * Um dos consumidores é a linha de mensagem, o componente mais quente do app:
 * sob firehose ela re-renderiza dezenas de vezes por segundo, e sem cache cada
 * passagem pagaria um hash mais TRÊS conversões OKLCH→hex por avatar visível.
 * É o erro nº 4 do briefing — derivação cara no caminho de render — só que com
 * cor em vez de markdown.
 *
 * O ID não muda nunca, então o cache não invalida. Sem teto de tamanho pela
 * mesma razão: o número de entradas é o número de pessoas e servidores que a
 * sessão viu, não o de mensagens.
 */
type Paleta = {
  readonly gradiente: string;
  readonly texto: string;
  readonly fundo: string;
};

const cache = new Map<string, Paleta>();

function paletaDe(id: string): Paleta {
  const guardada = cache.get(id);
  if (guardada) return guardada;

  const h = matizDe(id);
  const clara = oklchParaHex({ l: CLARO.l, c: CLARO.c, h });
  const escura = oklchParaHex({ l: ESCURO.l, c: ESCURO.c, h: (h + 12) % 360 });
  const nova: Paleta = {
    // 140° é o ângulo do design.
    gradiente: `linear-gradient(140deg, ${clara}, ${escura})`,
    texto: oklchParaHex({ l: TEXTO.l, c: TEXTO.c, h }),
    fundo: clara,
  };
  cache.set(id, nova);
  return nova;
}

/** O gradiente de fundo. */
export function gradienteDe(id: string): string {
  return paletaDe(id).gradiente;
}

/** A cor das iniciais em cima dele. Mesmo matiz, L alto e fixo. */
export function corDoTextoDe(id: string): string {
  return paletaDe(id).texto;
}

/** O ponto mais claro do gradiente — o que um teste de contraste mede contra. */
export function corDeFundoDe(id: string): string {
  return paletaDe(id).fundo;
}
