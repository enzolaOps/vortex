/**
 * O movimento obedece à doutrina do design?
 *
 * O Foundations do design escreve a regra inteira em uma linha:
 *
 *   "Só `transform` e `opacity`. Nada anima acima de 240ms; listas nunca
 *    animam altura."
 *
 * E o `tokens.css` a repete em prosa desde o reskin. Prosa depende de alguém
 * lembrar — e a ordem de preferência do `enforcement.md` diz que toda
 * invariante que puder virar mecanismo, deve.
 *
 * O que ela protege não é gosto. Animar uma propriedade que provoca LAYOUT
 * dentro de uma lista ancorada move a âncora, que é o defeito que a
 * virtualização inteira existe para não ter — e ele não dá erro nenhum, só
 * rolagem que escorrega.
 *
 * ⚠ **A leitura literal de "só transform e opacity" seria errada, e o próprio
 * design a desmente:** ele tem 125 transições de `background`, `border-color`,
 * `color` e `box-shadow`. Cor não provoca layout, e é ela que faz um hover
 * parecer resposta em vez de troca. O que a frase proíbe é o que MEXE A
 * CAIXA — e é isso que esta guarda confere.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FONTE = join(RAIZ, "src");

/** O teto do design. Quatro degraus, e o último é 240. */
const TETO_MS = 240;

/**
 * As que mexem a caixa. Animar qualquer uma dentro de uma lista ancorada move
 * a âncora; fora dela, custa layout a cada quadro.
 *
 * `all` está aqui porque ele INCLUI todas as outras — é a forma preguiçosa de
 * animar `height` sem escrever `height`.
 */
const MEXEM_A_CAIXA =
  /^(all|width|height|inline-size|block-size|min-|max-|margin|padding|top|right|bottom|left|inset|gap|row-gap|column-gap|font-size|line-height|flex|border(-(top|right|bottom|left|block|inline))?-width)$/;

/**
 * ⚠ **Fora de fluxo NÃO conta, e isso é derivado em vez de enumerado.**
 *
 * Elemento com `position: absolute` ou `fixed` saiu do fluxo: mudar a caixa
 * dele não move irmão nenhum, e é exatamente por isso que a lâmina do rail e
 * da lista de canais anima `block-size` — a barra cresce sem reflowar a
 * coluna. O design faz igual na barra de resultado da enquete
 * (`transition:width 180ms`).
 *
 * A primeira versão desta guarda listava as três à mão. Enumerar o que dá
 * para derivar é a forma de a lista envelhecer errado: a quarta barra
 * absoluta que alguém escrever amanhã reprova sem motivo, e quem for
 * consertar vai acrescentar uma linha à lista em vez de perguntar por quê.
 */
const FORA_DE_FLUXO = /position\s*:\s*(absolute|fixed)/;

/**
 * O que sobra depois da derivação, com a razão MEDIDA — e conferido nos DOIS
 * sentidos: exceção que parou de ser necessária também reprova, senão a lista
 * vira depósito que mente sobre uma decisão que ninguém tomou mais. É o mesmo
 * par de asserções de `EXCECOES` no contraste e de `SEM_PAR`.
 */
const EXCECOES = [
  {
    arquivo: "src/list/CartaoDeUpload.module.css",
    prop: "inline-size",
    razao:
      "barra de progresso do upload. É a única das quatro que fica NO FLUXO: " +
      "filha única de `.trilho`, que tem `block-size: 4px` e `overflow: " +
      "hidden` — então a largura não escapa da caixa, mas a guarda não tem " +
      "como saber disso lendo a regra. `scaleX` achataria a ponta " +
      "arredondada; a razão está escrita no arquivo.",
  },
];

/** A barra do Windows, montada sem escape para sobreviver ao shell. */
const BARRA = String.fromCharCode(92);

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, out);
    else if (nome.endsWith(".css")) out.push(caminho);
  }
  return out;
}

const ms = (t) => (t.endsWith("ms") ? parseFloat(t) : parseFloat(t) * 1000);

const falhas = [];
const usadas = new Set();
let conferidas = 0;

for (const arquivo of arquivos(FONTE)) {
  const rel = arquivo.slice(RAIZ.length).split(BARRA).join("/").replace(/^\//, "");
  const bruto = readFileSync(arquivo, "utf8");

  /*
    ⚠ **A varredura é sobre o TEXTO, não sobre linhas — e isso foi uma
    correção, não um cuidado antecipado.**

    A primeira versão exigia que a declaração começasse a linha, e TRÊS DAS
    QUATRO mutações passaram por ela: uma regra escrita numa linha só
    (`.x { transition: block-size 120ms; }`) simplesmente não era vista. Uma
    guarda que depende de formatação não guarda nada — o dia em que ela falha
    é o dia em que alguém escreveu CSS de outro jeito, que é exatamente o dia
    em que ninguém está olhando.

    Comentário sai antes de qualquer coisa: a doutrina é CITADA em três
    arquivos, este inclusive, e varrer sem tirá-los acusaria a explicação.
    Trocado por espaços do mesmo tamanho para o número da linha continuar
    verdadeiro.
  */
  const texto = bruto.replace(/\/\*[^]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const linhaDe = (i) => texto.slice(0, i).split("\n").length;

  /**
   * O bloco de regra que CONTÉM este ponto — para saber se ele está fora de
   * fluxo. Anda para trás contando chaves até achar o `{` que abriu, e para a
   * frente até o `}` que fecha.
   */
  const blocoEm = (i) => {
    let profundidade = 0;
    let ini = -1;
    for (let k = i; k >= 0; k--) {
      if (texto[k] === "}") profundidade++;
      else if (texto[k] === "{") {
        if (profundidade === 0) {
          ini = k;
          break;
        }
        profundidade--;
      }
    }
    if (ini === -1) return "";
    let fim = texto.length;
    profundidade = 0;
    for (let k = ini + 1; k < texto.length; k++) {
      if (texto[k] === "{") profundidade++;
      else if (texto[k] === "}") {
        if (profundidade === 0) {
          fim = k;
          break;
        }
        profundidade--;
      }
    }
    return texto.slice(ini, fim);
  };

  for (const m of texto.matchAll(
    /(transition(?:-property)?|animation)\s*:\s*([^;}]+)[;}]/g,
  )) {
    const tipo = m[1];
    const valor = m[2].trim();
    const linha = linhaDe(m.index);
    const trecho = `${tipo}: ${valor};`;

    if (/^none$/.test(valor) || valor.includes("var(--vx-revelar")) continue;

    if (tipo === "animation") {
      // Laço: o design tem `pulse` de 1,4s e `spin` de 700ms.
      if (/infinite/.test(valor)) continue;
      conferidas++;
      const dur = valor.split(/\s+/).find((c) => /^[\d.]+m?s$/.test(c));
      if (dur && ms(dur) > TETO_MS)
        falhas.push({
          rel,
          linha,
          texto: trecho,
          por: `${dur} passa do teto de ${TETO_MS}ms`,
        });
      continue;
    }

    for (const parte of valor.split(",")) {
      const campos = parte.trim().split(/\s+/);
      const prop = campos[0];
      if (!prop || prop.startsWith("var(")) continue;
      conferidas++;

      if (MEXEM_A_CAIXA.test(prop)) {
        /*
          Fora de fluxo passa por DERIVAÇÃO, e é conferido antes da lista:
          quem está `absolute` não move irmão, então a caixa dele é dele. É o
          caso da lâmina do rail, da lista de canais e da barra da enquete —
          três entradas que a primeira versão desta guarda mantinha à mão.

          `all` nunca é dispensado: ele inclui propriedades que mexem a caixa
          E as que não mexem, então nem fora de fluxo ele é o que alguém quis
          escrever.
        */
        const dispensado = prop !== "all" && FORA_DE_FLUXO.test(blocoEm(m.index));
        const ex = EXCECOES.find((e) => e.arquivo === rel && e.prop === prop);
        if (ex) usadas.add(`${ex.arquivo}|${ex.prop}`);
        else if (dispensado) {
          /* derivado, não enumerado */
        } else
          falhas.push({
            rel,
            linha,
            texto: trecho,
            por: `\`${prop}\` mexe a caixa — animá-la move a âncora da lista`,
          });
      }

      const dur = campos.find((c) => /^[\d.]+m?s$/.test(c));
      if (dur && ms(dur) > TETO_MS)
        falhas.push({
          rel,
          linha,
          texto: trecho,
          por: `${dur} passa do teto de ${TETO_MS}ms`,
        });
    }
  }
}

// A outra direção: exceção que ninguém mais precisa.
for (const e of EXCECOES)
  if (!usadas.has(`${e.arquivo}|${e.prop}`))
    falhas.push({
      rel: e.arquivo,
      linha: 0,
      texto: `exceção para \`${e.prop}\``,
      por: "não falha mais — tire-a da lista em vez de deixá-la mentir",
    });

if (falhas.length === 0) {
  console.log(
    `movimento: ${conferidas} transições/animações conferidas, ` +
      `${EXCECOES.length} exceções em uso, nenhuma fora da doutrina.`,
  );
  process.exit(0);
}

console.error(`\nmovimento: ${falhas.length} fora da doutrina.\n`);
for (const f of falhas)
  console.error(
    `  ${f.rel}${f.linha ? ":" + f.linha : ""}\n     ${f.texto}\n     ↳ ${f.por}\n`,
  );
console.error(
  'O Foundations do design: "Só transform e opacity. Nada anima acima de\n' +
    '240ms; listas nunca animam altura."\n\n' +
    "Cor, fundo, borda e sombra passam — não provocam layout, e o design as\n" +
    "usa 125 vezes. O que não passa é o que MEXE A CAIXA.\n",
);
process.exit(1);
