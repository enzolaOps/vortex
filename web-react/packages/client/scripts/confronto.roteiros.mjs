/**
 * Os roteiros do `pnpm confronto` — uma entrada por tela comparável.
 *
 * ⚠ **Este arquivo é a regra que o projeto não tinha.** O `espec` diz quais
 * valores o design usa; o `espelho` diz que estrutura ele tem. Os dois exigem
 * que EU leia e compare — e a lista de divergências desta rodada mostra o que
 * acontece: eu confiro o que lembro de conferir. Fundo e respiro entraram
 * certos; tipografia e cor de texto ficaram para trás em três telas seguidas,
 * porque o instrumento nem as imprimia.
 *
 * Aqui a comparação é da MÁQUINA. Cada entrada diz como chegar à tela nos dois
 * lados, e o `confronto` renderiza os dois, alinha as árvores e reporta o que
 * difere. Tela que não está aqui não é conferida — e é por isso que a entrada
 * vem junto com a tela, não depois.
 *
 * Campos:
 *
 *   - `nome`        rótulo no relatório
 *   - `arquivo`     o `.dc.html` do design
 *   - `ancora`      texto que existe na tela do design
 *   - `cliques`     o que acionar antes (as telas vivem atrás de `sc-if`)
 *   - `subir`       níveis a subir depois de achar a caixa da âncora
 *   - `profundidade` até onde descer na comparação
 *   - `app`         URL do app já construído
 *   - `preparar`    JS que leva o app até a tela (o arnês precisa semear)
 *   - `raiz`        seletor da caixa equivalente no app
 *   - `pular`       nós do design que o app deliberadamente NÃO tem, pelo texto
 *                   da subárvore. Casamento EXATO; prefixe com `~` para
 *                   "contém".
 *                   ⚠ Cada entrada precisa de motivo no comentário ao lado —
 *                   é a mesma disciplina de `EXCECOES` no contraste, e o que
 *                   não estiver aqui continua reprovando.
 */

/**
 * O caminho comum até um canal no arnês.
 *
 * Repetido por função e não copiado: as telas de canal são muitas, e um passo
 * a mais aqui é um passo a mais em todas.
 */
const abrirConfigDeCanal = (secao) => `
  const B = (t) =>
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(t),
    );
  B("1.000 msgs")?.click();
  await new Promise((r) => setTimeout(r, 250));
  B("Semear 1.000")?.click();
  await new Promise((r) => setTimeout(r, 3200));
  document.querySelector("[data-naolidas]")?.click();
  await new Promise((r) => setTimeout(r, 1200));
  const canais = [...document.querySelectorAll("button")].filter((b) =>
    String(b.className).startsWith("_canal_"),
  );
  canais[0].click();
  await new Promise((r) => setTimeout(r, 900));
  canais[0].dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, clientX: 200, clientY: 200 }),
  );
  await new Promise((r) => setTimeout(r, 600));
  [...document.querySelectorAll('[role="menuitem"]')]
    .find((e) => e.textContent.trim() === "Configurações do canal")
    ?.click();
  await new Promise((r) => setTimeout(r, 800));
  ${
    secao
      ? `[...document.querySelectorAll("nav button")]
           .filter((e) => e.textContent.trim() === ${JSON.stringify(secao)})
           .pop()
           ?.click();
         await new Promise((r) => setTimeout(r, 800));`
      : ""
  }
`;

const CANAL =
  "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex Configurações do Canal.dc.html";

export const ROTEIROS = [
  {
    nome: "canal · visão geral",
    arquivo: CANAL,
    ancora: "Nome do canal",
    cliques: [],
    /* A âncora cai no bloco do campo; a TELA está um nível acima. */
    subir: 1,
    profundidade: 3,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeCanal(null),
    raiz: "[class*=_forma_]",
    /*
      ⚠ Esta tela fica com 3 diferenças de raiz que são ESPERADAS e ficam
      visíveis de propósito: o design tem um `h1` no conteúdo e o nosso título
      mora na barra da casca (poda-lo por texto derrubava o alinhamento —
      medido, o filtro casava mais do que devia). Elas não crescem sozinhas, e
      uma quarta linha aqui é sinal.
    */
    pular: [
      /*
        ⚠ O bloco de voz aparece no design MARCADO com o selo "MESMA PÁGINA" —
        anotação de quem desenhou dizendo que ele está ali fora de contexto,
        para o leitor do arquivo ver. Num canal de TEXTO ele não existe, e o
        app confere: só monta em canal de voz.
      */
      "~Quando o canal é de voz",
    ],
  },
  {
    nome: "canal · permissões",
    arquivo: CANAL,
    ancora: "Canal privado",
    cliques: ["Permissões"],
    subir: 1,
    profundidade: 3,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeCanal("Permissões"),
    raiz: "[class*=_forma_]",
    pular: [
      /* O título vive na barra da casca de configurações, não no conteúdo —
         renderizá-lo aqui o anunciaria duas vezes para o leitor de tela. */
      "Permissões",
      /* Banner de dessincronização: categoria não tem permissões no protocolo,
         então não há com o que comparar e o aviso seria sempre falso. */
      "~Permissões dessincronizadas",
    ],
  },
  {
    nome: "canal · convites",
    arquivo: CANAL,
    ancora: "Criar convite",
    cliques: ["Convites"],
    subir: 1,
    profundidade: 3,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeCanal("Convites"),
    raiz: "[class*=_forma_]",
    pular: [
      /* O título vive na barra da casca, como em Permissões. */
      "~Convites3 convites ativos",
    ],
  },
];
