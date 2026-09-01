/**
 * `--vx-surface-0` como FUNDO só onde alguém escreveu por quê.
 *
 * ⚠ **Este guarda nasce do único defeito que passou por TODAS as outras oito
 * guardas duas vezes, e as duas foram relatadas por quem usa.**
 *
 * A prancha pintava `surface-0` no gutter em qualquer largura, e o rodapé do
 * composer pintava `surface-0` atrás do campo. Nos dois casos o token é
 * válido, a cor é válida, o contraste passa, o `pnpm escala` passa, o
 * `pnpm vars` passa — e a tela fica errada, porque o PAPEL está errado.
 *
 * O Foundations do design dá a `surface.sunken` (#08090B) dois papéis, e
 * escreve os dois: *"Rail, gutter ultrawide"*. Tudo o mais que o usa está
 * fazendo uma escolha, e escolha sem motivo escrito é como as duas faixas
 * pretas apareceram.
 *
 * O mecanismo é o mesmo de `SEM_PAR` e `EXCECOES` em `tema/pares.ts`, que este
 * projeto já usa duas vezes: uma lista fechada, cada entrada com a razão, e a
 * asserção nos DOIS sentidos —
 *
 *   1. uso fora da lista reprova (é o que pega o defeito novo);
 *   2. entrada da lista que não casa com uso nenhum também reprova (senão a
 *      lista vira depósito que mente sobre uma decisão que ninguém tomou).
 *
 * Só `surface-0` por enquanto, e de propósito: é o degrau cujo papel é mais
 * estreito e o único que já falhou. A estrutura aceita os outros quatro sem
 * mudança — `PAPEL` é um mapa.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(RAIZ, "src");

/**
 * O que o Foundations do design diz que este degrau é.
 *
 * Fica escrito aqui porque a mensagem de erro precisa dizer o que a pessoa
 * deveria ter usado, e não só que ela errou.
 */
const PAPEL = {
  "--vx-surface-0":
    'o design chama de `surface.sunken` e lhe dá DOIS papéis: "Rail, gutter ' +
    "ultrawide\". Fora deles, o conteúdo é `surface-2` (canvas), o painel de " +
    "entrada é `surface-3` (raised), o que flutua é `surface-4` (float), o " +
    "trilho de controle é `--vx-track` e o véu de modal é `--vx-scrim`.",
};

/**
 * Cada entrada é `arquivo relativo a src/` → `seletor` → razão.
 *
 * A razão é para quem vier depois, e ela precisa dizer POR QUE este lugar é
 * chão e não conteúdo. "É o padrão" não é razão.
 */
const PERMITIDO = {
  "voz/PalcoDeVoz.module.css": {
    ".palco":
      "O CHÃO das três telas do palco, em volta da mídia. O design pinta a " +
      "moldura no tom mais escuro pela mesma razão que pinta o rail: o que " +
      "cerca a mídia precisa desaparecer para que ela seja a única coisa " +
      "com luz. Uma moldura em `surface-2` competiria em luminosidade com " +
      "o próprio vídeo.",
  },
  "voz/GradeDeChamada.module.css": {
    ".placa":
      "Véu sobre o vídeo do ladrilho, e não superfície — um tom sólido " +
      "apagaria um pedaço da imagem de quem está falando.",
    ".fixar": "O mesmo véu, sob o alvo de fixar.",
  },
  "voz/AssistirTransmissao.module.css": {
    ".cabecalho":
      "Gradiente sobre o vídeo, e o design manda SEM blur: `backdrop-filter` " +
      "sobre vídeo em movimento é o efeito mais caro que existe numa camada " +
      "que fica na tela o tempo todo.",
    ".chip": "Véu sobre o vídeo, a 70%.",
    ".acao": "O mesmo véu, a 60%, sob os alvos do cabeçalho.",
    ".barra": "O mesmo véu, a 82%, sob a barra de controles.",
  },
  "voz/PalcoDeTransmissao.module.css": {
    ".chipDaFonte, .chip": "Véu sobre a mídia, não superfície — `color-mix` com 78% de opacidade sobre conteúdo em movimento. Um tom sólido apagaria um pedaço do que está sendo transmitido.",
    ".hud": "O mesmo véu, a 82%, sob os controles do transmissor.",
    ".selo": "O mesmo véu, a 70%, atrás do selo de ladrilho separado.",
  },
  "voz/Popout.module.css": {
    ".popout":
      "O chão da JANELA flutuante, e não um painel dentro do app. Mesma " +
      "razão da moldura do palco de voz: o que está em volta da mídia " +
      "precisa desaparecer para que a mídia seja a única coisa com luz. O " +
      "mockup escreve #0A0C0F, que é um quase-acerto de `surface.sunken` " +
      "(#08090B) — a própria implementação de referência usa o token.",
    ".pilula":
      "Véu sobre a mídia a 80%, do design (`rgba(8,9,11,0.8)`) — não " +
      "superfície. A pílula de contagem pousa sobre o vídeo, e um tom sólido " +
      "apagaria um pedaço do que se está tentando ver.",
    ".pilula:hover":
      "O mesmo véu, opaco. O hover precisa de um degrau, e subir a opacidade " +
      "do MESMO tom mantém a família em vez de trocar de cor.",
    ".controlesDoPip .redondo":
      "O mesmo véu a 80%, sob os dois controles do mínimo. No rodapé do " +
      "popout grande eles são `surface-4`, porque lá há superfície embaixo; " +
      "aqui eles flutuam sobre a imagem.",
  },
  "shell/Shell.module.css": {
    ".shell":
      "O chão da janela, atrás de tudo. É o que o mock inteiro do design " +
      "pousa em cima, e o que aparece se um slot colapsar a zero.",
    '.slot[data-painel="rail"]':
      "O rail. É o primeiro dos dois papéis que o Foundations nomeia, " +
      "literalmente.",
    /*
      ⚠ **A entrada de `.prancha` saiu, e foi este guarda que a cobrou.**

      Ela dispensava o gutter ultrawide, e o gutter deixou de existir: a
      coluna de leitura preenche a trilha, então não há sobra para pintar.
      Quem usa relatou as faixas pretas de 924px em 3440 — a mesma queixa
      que já tinha tirado a pintura das janelas comuns, agora na largura
      onde ela devia estar funcionando.

      A entrada ficou órfã e o guarda reprovou o build por isso, que é
      exatamente o segundo sentido dele: razão que sobrou mente sobre uma
      decisão que ninguém tomou mais. Ver `shell/Shell.module.css`.
    */
  },
  "styles/tokens.css": {
    body: "O chão da página, antes de qualquer componente montar.",
  },
  "sessao/TelaDeLogin.module.css": {
    ".tela":
      "Tela cheia sem shell: aqui não há rail nem conteúdo, então ela É o " +
      "chão. Mesma família do `body`.",
  },
  "desktop/BarraDeTitulo.module.css": {
    ".barra":
      "Cromo de JANELA, e nao conteudo — mesma familia do rail, que e o " +
      "primeiro papel nomeado. Ela fica ACIMA do rail e continua a mesma " +
      "superficie: um degrau mais claro ali desenharia uma faixa flutuando " +
      "sobre o app em vez da moldura da janela, que e o que ela e.",
  },
  "config/canal/Canal.module.css": {
    ".filtro":
      "Campo de BUSCA, e o design separa os dois papéis: o que recebe entrada " +
      "para buscar afunda, o que recebe entrada para guardar fica no plano do " +
      "painel. A diferença fica visível justamente aqui, onde o filtro da " +
      "matriz aparece na mesma tela que campos de formulário em `surface-3`.",
  },
  "canais/ListaDeCanais.module.css": {
    ".busca":
      "Campo, mesma regra do `Campo.entrada`. Verificado byte a byte no " +
      "`Vortex App.dc.html`: o campo de 30px da coluna é `#08090B`.",
  },
  "caixa/CaixaDeEntrada.module.css": {
    ".respostaCampo": "Campo de entrada — a mesma regra do `Campo.entrada`.",
    ".respostaEnviar":
      "O botão colado no campo, e ele afunda junto: a dupla campo+enviar é " +
      "uma caixa só no desenho, e um botão em `surface-3` ao lado de um campo " +
      "em `surface-0` leria como duas peças que não se conhecem.",
  },
  "list/Encaminhar.module.css": {
    ".previa":
      "O poço da citação dentro do modal. O modal já é `surface-4`; a prévia " +
      "é conteúdo CITADO, e afundá-la é o que a separa do formulário sem " +
      "gastar borda.",
  },
  "layout/PainelDeEdicao.module.css": {
    ".veu":
      "Véu, e não superfície — ele entra com `opacity` da escala da marca " +
      "por cima. ⚠ NÃO é `--vx-scrim`: o scrim é opaco a 72% e existe para " +
      "BLOQUEAR o que está atrás; este véu existe para deixar o preview ao " +
      "vivo legível enquanto se arrasta uma borda.",
  },
  "usuario/PainelDeUsuario.module.css": {
    ".painel":
      "O rodapé da coluna de canais é CHÃO, não conteúdo: a lista rola por " +
      "cima dele e ele não rola. Mesmo token do rail, e a leitura é a mesma " +
      "— 'isto não é a lista'.",
    ".ponto::after":
      "O anel do ponto de presença recorta o fundo em que ele é desenhado, e " +
      "ele é desenhado sobre o `.painel` acima. Ele acompanha, não escolhe.",
  },
  "presenca/PontoDePresenca.module.css": {
    ".ponto::after":
      "Mesma razão do anel do painel de usuário, e aqui `--vx-surface-0` é " +
      "só o FALLBACK de `--anel`: quem monta o ponto passa a superfície real " +
      "em que ele pousa.",
  },
};

/* ------------------------------------------------------------ varredura */

function arquivos(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules") continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) out.push(...arquivos(caminho));
    else if (nome.endsWith(".css") || nome.endsWith(".tsx") || nome.endsWith(".ts")) {
      out.push(caminho);
    }
  }
  return out;
}

/**
 * Comentário fora primeiro, e trocado por espaço.
 *
 * O projeto DOCUMENTA armadilhas de cor em prosa — este arquivo mesmo cita
 * `background: var(--vx-surface-0)` num comentário. Sem tirar comentário, o
 * guarda acusa a própria explicação. Espaço em vez de vazio para o número da
 * linha continuar certo. É a mesma decisão do `scripts/vars.mjs`.
 */
function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * O seletor que abre a regra onde o casamento está.
 *
 * ⚠ **Anda para trás em CARACTERE, e a primeira versão andava em LINHA.** Ela
 * juntava três linhas e cortava no PRIMEIRO `{` da janela em vez do `{` que
 * estava procurando: o `.prancha` dentro de um `@container` saía como
 * `(desconhecido)`, ou seja, o guarda não conseguia nomear justamente a regra
 * que ele foi escrito para vigiar. Pego na primeira execução.
 *
 * O primeiro `{` sem par andando para trás É a regra mais interna, então
 * aninhamento (`@container`, `@media`) sai de graça — a condição de fora fica
 * na razão escrita, que é onde ela serve a quem lê.
 */
function seletorNoOffset(texto, offset) {
  let profundidade = 0;
  for (let i = offset; i >= 0; i--) {
    const c = texto[i];
    if (c === "}") profundidade += 1;
    else if (c === "{") {
      if (profundidade === 0) {
        const antes = texto.slice(0, i);
        const corte = Math.max(
          antes.lastIndexOf("}"),
          antes.lastIndexOf("{"),
          antes.lastIndexOf(";"),
        );
        return antes
          .slice(corte + 1)
          .trim()
          .replace(/\s+/g, " ");
      }
      profundidade -= 1;
    }
  }
  return "(desconhecido)";
}

const TOKEN = Object.keys(PAPEL)[0];
const RE_CSS = new RegExp(
  String.raw`background(?:-color)?\s*:[^;{}]*${TOKEN}\b`,
  "g",
);
const RE_UTIL = /(?<![\w-])bg-surface-0(?![\w-])/;

const usos = [];
for (const caminho of arquivos(SRC)) {
  const rel = caminho.slice(SRC.length + 1).replace(/\\/g, "/");
  const bruto = readFileSync(caminho, "utf8");

  if (caminho.endsWith(".css")) {
    const limpo = semComentarios(bruto);
    for (const m of limpo.matchAll(RE_CSS)) {
      usos.push({
        rel,
        sel: seletorNoOffset(limpo, m.index),
        n: limpo.slice(0, m.index).split("\n").length,
      });
    }
  } else {
    // Nos utilities não há seletor: o "lugar" é o arquivo mais a classe.
    semComentarios(bruto)
      .split("\n")
      .forEach((linha, i) => {
        if (RE_UTIL.test(linha)) usos.push({ rel, sel: "bg-surface-0", n: i + 1 });
      });
  }
}

/* --------------------------------------------------------------- veredito */

const foraDaLista = usos.filter(({ rel, sel }) => PERMITIDO[rel]?.[sel] === undefined);

const casados = new Set(usos.map(({ rel, sel }) => `${rel} ${sel}`));
const mortas = [];
for (const [rel, seletores] of Object.entries(PERMITIDO)) {
  for (const sel of Object.keys(seletores)) {
    if (!casados.has(`${rel} ${sel}`)) mortas.push(`${rel} → ${sel}`);
  }
}

if (foraDaLista.length === 0 && mortas.length === 0) {
  console.log(
    `superficies: ${usos.length} usos de ${TOKEN} como fundo, todos com razão escrita.`,
  );
  process.exit(0);
}

if (foraDaLista.length > 0) {
  console.error(`\n${TOKEN} usado como FUNDO sem razão escrita:\n`);
  for (const { rel, sel, n } of foraDaLista) {
    console.error(`  ${rel}:${n}  →  ${sel}`);
  }
  console.error(`\n${PAPEL[TOKEN]}\n`);
  console.error(
    "Se este lugar é mesmo chão, acrescente a entrada em `PERMITIDO` no\n" +
      "`scripts/superficies.mjs` COM O MOTIVO. A lista existe para a decisão\n" +
      "ficar escrita, não para ser satisfeita.\n",
  );
}

if (mortas.length > 0) {
  console.error("\nEntradas de `PERMITIDO` que não casam com uso nenhum:\n");
  for (const m of mortas) console.error(`  ${m}`);
  console.error(
    "\nO uso saiu ou o seletor mudou de nome. Razão que sobrou mente sobre\n" +
      "uma decisão que ninguém tomou mais — apague a entrada.\n",
  );
}

process.exit(1);
