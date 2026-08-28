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

/** Os dois pontos do gradiente e a cor do texto em cima. Fixos em L. */
const CLARO = { l: 0.42, c: 0.06 };
const ESCURO = { l: 0.27, c: 0.055 };
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
