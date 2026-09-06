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
 *   - `secao`       o `SecaoId` da página de configurações, quando é uma.
 *                   ⚠ **É o que amarra este arquivo à união fechada de
 *                   seções.** `src/config/roteiros.test.ts` exige um
 *                   roteiro por seção de servidor e um `secao` válido por
 *                   roteiro — nos DOIS sentidos, como `EXCECOES` no
 *                   contraste. Sem isso, categoria nova nasce sem
 *                   confronto e ninguém descobre.
 *   - `arquivo`     o `.dc.html` do design
 *   - `ancora`      texto que existe na tela do design
 *   - `cliques`     o que acionar antes (as telas vivem atrás de `sc-if`)
 *   - `larguraDoDesign` largura da caixa alvo no design. Sem ela, o escalador
 *                   sobe até a primeira caixa larga (>= 600) com dois filhos —
 *                   o que nunca alcança coluna estreita.
 *   - `subir`       níveis a subir depois de achar a caixa da âncora
 *   - `profundidade` até onde descer na comparação
 *   - `app`         URL do app já construído
 *   - `preparar`    JS que leva o app até a tela (o arnês precisa semear)
 *   - `raiz`        EXPRESSÃO JS que devolve a caixa equivalente no app.
 *                   ⚠ Nunca por pedaço de classe de CSS Module: o hash
 *                   muda a cada build e o roteiro passa a não achar a
 *                   tela sem que nada tenha mudado nela. Mire em `role`,
 *                   `aria-label`, ou suba a partir de algo estável.
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

/**
 * O caminho até o app com um canal aberto — a base de quase toda tela.
 *
 * `1.000` e não `10.000`: o confronto mede estilo, não desempenho, e semear
 * dez mil linhas custa quatro segundos por roteiro sem mudar um pixel do que
 * ele compara. O gate mede o outro lado.
 */
const abrirCanal = (extra = "") => `
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
  await new Promise((r) => setTimeout(r, 1500));
  ${extra}
`;

/** Abre o menu de contexto de uma mensagem e espera ele montar. */
const menuDaMensagem = `
  const art = document.querySelectorAll("article")[3];
  art.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, clientX: 400, clientY: 200 }),
  );
  await new Promise((r) => setTimeout(r, 700));
`;

/**
 * O caminho até uma CATEGORIA das configurações de servidor.
 *
 * ⚠ **Nenhuma das treze tinha roteiro, e é exatamente por isso que elas
 * derivaram.** O cabeçalho deste arquivo já dizia a regra — "tela que não está
 * aqui não é conferida" — e as páginas de servidor foram construídas, revisadas
 * e corrigidas três vezes sem nunca entrar nele. A comparação ficou comigo, e a
 * pergunta de quem usa ("como garantir que fiquem 1:1?") tem esta resposta: não
 * garante enquanto for humana.
 *
 * O `secao` é o rótulo do item na coluna — igual dos dois lados.
 */
const abrirConfigDeServidor = (secao) => `
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

  /*
    POINTERDOWN e nao click, e isso custou uma corrida inteira dizendo "raiz
    nao achada". O menu do servidor e um DropdownMenu do Radix, e o gatilho
    dele abre no pointerdown; um .click() programatico nao dispara nada e nao
    lanca nada — o roteiro seguia, achava a tela do chat e reportava a raiz
    como ausente, sem dizer por que.
  */
  const gatilho = [...document.querySelectorAll("button")].find((b) =>
    (b.getAttribute("aria-label") || "").startsWith("Opções de"),
  );
  gatilho?.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
    }),
  );
  await new Promise((r) => setTimeout(r, 700));

  /*
    O menu ja carrega as treze categorias, entao o caminho e um clique so — sem
    passar pelo Perfil e depois pela coluna. Um passo a menos e um passo a
    menos que pode falhar em silencio.
  */
  [...document.querySelectorAll('[role="menuitem"]')]
    .find((e) => e.textContent.trim() === ${JSON.stringify(secao)})
    ?.click();
  await new Promise((r) => setTimeout(r, 1200));
`;

/**
 * A caixa comparável nos dois lados: o CONTEÚDO da categoria.
 *
 * ⚠ **O CONTEÚDO e não o rolável, e a primeira versão errou nisso.** Mirar o
 * rolável parecia melhor — é o mesmo nó nas treze e traz o título junto — e
 * produziu 97 diferenças das quais ~90 eram do INSTRUMENTO: o pane do design
 * tem 940 de altura e o nosso arnês 798, os dois arquivos de design usam
 * respiros diferentes (36 e 40 no eixo, 28/32/0 no topo), e a contagem de
 * filhos difere porque o nosso título mora num `header` irmão. Comparar o
 * conteúdo alinha as duas árvores no primeiro nó que as duas realmente
 * desenharam igual.
 *
 * `lastElementChild` porque o `header` da casca é o primeiro filho: o que sobra
 * é a página. A largura do lado do design vai por roteiro, medida em cada
 * página — ela varia de 720 (Acesso) a 1120 (Perfil), e um número só levava o
 * escalador para o pane inteiro.
 *
 * ⚠ Por `data-secao` e nunca por pedaço de classe de CSS Module: o hash muda a
 * cada build, e o roteiro passaria a não achar a tela sem que nada tivesse
 * mudado nela.
 */
const CONTEUDO_DO_APP = ` return document.querySelector("[data-secao]")?.lastElementChild`;

/**
 * A caixa do lado do DESIGN: o rolável do pane, ou o único filho dele.
 *
 * ⚠ **Ela é declarada e não escalada por largura, e a razão está medida.** O
 * escalador sobe do texto da âncora até o primeiro ancestral da largura
 * pedida — e numa tabela a LINHA tem a largura da tabela. Oito das treze
 * categorias acabaram comparando uma linha contra uma página inteira, e o
 * relatório dizia "nº de filhos: design 5 · app 2" sobre dois nós que não são
 * a mesma coisa.
 *
 * Perfil e Cargos embrulham a página num wrapper de largura máxima; as outras
 * põem os blocos como irmãos direto no rolável. O `children.length === 1`
 * cobre os dois casos sem uma entrada por página.
 */
const ROLAVEL_DO_DESIGN = `
  const sc = [...document.querySelectorAll(".vx-scroll")]
    .find((e) => e.getBoundingClientRect().width > 600);
  if (!sc) return null;
  return sc.children.length === 1 ? sc.firstElementChild : sc;
`;

/**
 * O CONTEÚDO da página, quando o design a embrulha numa caixa de medida.
 *
 * Modelo e Segurança são [h1, subtítulo, wrapper]: o wrapper é o equivalente
 * exato da nossa página, porque o título e o subtítulo, aqui, moram na barra
 * da casca. Podar os dois pelo texto funcionaria e deixaria o roteiro
 * dependendo de uma frase; descer para o wrapper não depende de nada.
 */
const CONTEUDO_DO_DESIGN = `
  const sc = [...document.querySelectorAll(".vx-scroll")]
    .find((e) => e.getBoundingClientRect().width > 600);
  return sc ? sc.lastElementChild : null;
`;

const SERVIDOR =
  "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex Configurações do Servidor.dc.html";
const RESTANTES =
  "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex Servidor - Páginas Restantes.dc.html";

const APP = "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex App.dc.html";
const SUPERFICIES =
  "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex Mensagens - Superfícies.dc.html";
const CANAL =
  "C:/Users/lagun/Downloads/Implementação de voz e chamada/Vortex Configurações do Canal.dc.html";

/**
 * As divergências que o projeto ADOTOU, com o motivo escrito.
 *
 * ⚠ **Mesma disciplina das `EXCECOES` do contraste, e pela mesma razão.** Uma
 * divergência deliberada e um defeito são indistinguíveis num relatório: as
 * duas aparecem como linha vermelha. Sem esta lista, a saída do confronto tem
 * ruído permanente — e guarda com falso positivo é guarda que se aprende a
 * ignorar, que é exatamente o que já aconteceu com o `pnpm utilities` antes de
 * ele ganhar mutação.
 *
 * Cada entrada casa por PROPRIEDADE e pelo PAR de valores, nunca só pela
 * propriedade: dispensar "tipo" inteiro apagaria toda divergência de
 * tipografia junto com a que se quis aceitar.
 *
 * O relatório diz quantas foram dispensadas. Entrada que parou de casar
 * também precisa sair — senão a lista mente sobre uma decisão que ninguém
 * tomou mais.
 */
export const DISPENSAS = [
  {
    rotulo: "borda",
    design: "t1 #ffffff@8 r1 #ffffff@8 b1 #ffffff@8 l1 #ffffff@8",
    app: "t1 #ffffff@6 r1 #ffffff@6 b1 #ffffff@6 l1 #ffffff@6",
    motivo:
      "Véu de contorno a 8% contra os 6% do `--vx-hairline-06`. Terceira variação do mesmo traço no design (5, 6, 7 e 8 em telas irmãs); o que existiria de novo seria um quarto token de hairline para dois pontos percentuais.",
  },
  {
    rotulo: "borda",
    design: "b1 #ffffff@5",
    app: "b1 #ffffff@6",
    motivo:
      "Divisória de linha a 5% contra os 6% do `--vx-hairline-06`. Mesmo caso do 7%: um ponto percentual num traço de 1px, e o design usa 5, 6 e 7 em telas irmãs sem distinção.",
  },
  {
    rotulo: "borda",
    design: "t1 #ffffff@5",
    app: "t1 #ffffff@6",
    motivo:
      "Divisória de linha a 5% contra os 6% do `--vx-hairline-06`. Mesmo caso do 7%: um ponto percentual num traço de 1px, e o design usa 5, 6 e 7 em telas irmãs sem distinção.",
  },
  {
    rotulo: "borda",
    design: "t1 #35c2cc r1 #35c2cc b1 #35c2cc l1 #35c2cc",
    app: "t1 #ffffff@6 r1 #ffffff@6 b1 #ffffff@6 l1 #ffffff@6",
    motivo:
      "O mock do design deixa uma figurinha em EDIÇÃO, com anel de acento sólido e Salvar/Cancelar no lugar de Editar/Excluir. Editar figurinha é pendência registrada — não há estado de edição para reproduzir, e um cartão permanentemente aceso seria pior que a ausência.",
  },
  {
    rotulo: "borda",
    design: "t1 #ffffff@7 r1 #ffffff@7 b1 #ffffff@7 l1 #ffffff@7",
    app: "t1 #35c2cc@35 r1 #35c2cc@35 b1 #35c2cc@35 l1 #35c2cc@35",
    motivo:
      "O anel de ESCOLHIDO, e os dois mocks marcam opções diferentes. O do design abre com a segunda opção de cada grupo marcada; o nosso abre no estado REAL do servidor, que é sempre o primeiro (\"entrada imediata\", \"sem verificação\") porque nenhum desses campos existe no protocolo. A dispensa casa o PAR nos dois sentidos, então um cartão que perdesse o anel em ambos continuaria reprovando.",
  },
  {
    rotulo: "borda",
    design: "t1 #35c2cc@35 r1 #35c2cc@35 b1 #35c2cc@35 l1 #35c2cc@35",
    app: "t1 #ffffff@6 r1 #ffffff@6 b1 #ffffff@6 l1 #ffffff@6",
    motivo:
      "O anel de ESCOLHIDO, e os dois mocks marcam opções diferentes. O do design abre com a segunda opção de cada grupo marcada; o nosso abre no estado REAL do servidor, que é sempre o primeiro (\"entrada imediata\", \"sem verificação\") porque nenhum desses campos existe no protocolo. A dispensa casa o PAR nos dois sentidos, então um cartão que perdesse o anel em ambos continuaria reprovando.",
  },
  {
    rotulo: "borda",
    design: "t1 #35c2cc@35 r1 #35c2cc@35 b1 #35c2cc@35 l1 #35c2cc@35",
    app: "t1 #ffffff@7 r1 #ffffff@7 b1 #ffffff@7 l1 #ffffff@7",
    motivo:
      "O anel de ESCOLHIDO, e os dois mocks marcam opções diferentes. O do design abre com a segunda opção de cada grupo marcada; o nosso abre no estado REAL do servidor, que é sempre o primeiro (\"entrada imediata\", \"sem verificação\") porque nenhum desses campos existe no protocolo. A dispensa casa o PAR nos dois sentidos, então um cartão que perdesse o anel em ambos continuaria reprovando.",
  },
  {
    rotulo: "borda",
    design: "t1 #ffffff@6 r1 #ffffff@6 b1 #ffffff@6 l1 #ffffff@6",
    app: "t1 #35c2cc@35 r1 #35c2cc@35 b1 #35c2cc@35 l1 #35c2cc@35",
    motivo:
      "O anel de ESCOLHIDO, e os dois mocks marcam opções diferentes. O do design abre com a segunda opção de cada grupo marcada; o nosso abre no estado REAL do servidor, que é sempre o primeiro (\"entrada imediata\", \"sem verificação\") porque nenhum desses campos existe no protocolo. A dispensa casa o PAR nos dois sentidos, então um cartão que perdesse o anel em ambos continuaria reprovando.",
  },
  {
    rotulo: "borda",
    design: "t1 #e8596b@26 r1 #e8596b@26 b1 #e8596b@26 l1 #e8596b@26",
    app: "t1 #e8596b@28 r1 #e8596b@28 b1 #e8596b@28 l1 #e8596b@28",
    motivo:
      "Dois pontos percentuais no véu vermelho do banner de perigo. O valor é do `Banner`, primitivo compartilhado por oito superfícies, e mexer nele por 2% mudaria as oito para casar uma.",
  },
  {
    rotulo: "tipo",
    design: "14px/600",
    app: "13px/600",
    motivo:
      "14 não é degrau da escala de tipo deste projeto — ela tem 11, 12, 13, 15, 17 e 22, e a razão está no `tokens.css`. O degrau vizinho é 13, e um sétimo tamanho para 1px é o que a escala existe para evitar.",
  },
  {
    rotulo: "respiro",
    design: "13px 15px",
    app: "13px 14px",
    motivo:
      "1px no respiro lateral do cartão de opção. `--vx-space-15` não existe na escala — ela tem 14 e 16 — e o guarda `pnpm vars` reprovou a tentativa de usá-lo. Um degrau novo para 1px é o oposto do que a escala serve, e é a mesma decisão do raio de 14 no ladrilho do rail.",
  },
  {
    rotulo: "tipo",
    design: "12px/400",
    app: "12px/450",
    motivo: "Mesma decisão do #188 — Instrument Sans engrossada.",
  },
  {
    rotulo: "tipo",
    design: "22px/400",
    app: "22px/450",
    motivo: "Mesma decisão do #188 — Instrument Sans engrossada.",
  },
  {
    rotulo: "tipo",
    design: "17px/400",
    app: "17px/450",
    motivo: "Mesma decisão do #188 — Instrument Sans engrossada.",
  },
  {
    rotulo: "borda",
    design: "t1 #ffffff@14 r1 #ffffff@14 b1 #ffffff@14 l1 #ffffff@14",
    app: "t1 #ffffff@16 r1 #ffffff@16 b1 #ffffff@16 l1 #ffffff@16",
    motivo:
      "Tracejado de área de envio a 14% contra os 16% do nosso `--vx-hairline-16`. Dois pontos percentuais num traço de 1px tracejado; o token existe para exatamente este papel e um terceiro degrau de hairline não se paga.",
  },
  {
    rotulo: "borda",
    design: "t1 #ffffff@7 r1 #ffffff@7 b1 #ffffff@7 l1 #ffffff@7",
    app: "t1 #ffffff@6 r1 #ffffff@6 b1 #ffffff@6 l1 #ffffff@6",
    motivo:
      "Hairline a 7%% contra os 6%% do nosso `--vx-hairline-06`. Um ponto percentual num traço de 1px não é perceptível, e o design usa 6 e 7 em telas irmãs sem distinção — o que existiria de novo seria um segundo token de divisória, com par de contraste e classificação, para nada.",
  },
  {
    rotulo: "tipo",
    design: "15px/400",
    app: "15px/450",
    motivo:
      "Instrument Sans engrossada de propósito no #188 (“thicken Instrument " +
      "Sans”). O design herda o 400 do navegador na raiz e declara o peso em " +
      "cada elemento; o 450 do app é escolha de legibilidade em tela escura, " +
      "não descuido. Aparecia em 25 nós de 13 telas.",
  },
  {
    rotulo: "tipo",
    design: "11px/400",
    app: "11px/450",
    motivo: "Mesma decisão do #188, na nota de rodapé das telas.",
  },
  {
    rotulo: "tipo",
    design: "13px/400",
    app: "13px/450",
    motivo: "Mesma decisão do #188, no corpo das telas.",
  },
];

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
    raiz: `return document.querySelector("[class*=_forma_]")`,
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
    raiz: `return document.querySelector("[class*=_forma_]")`,
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
    raiz: `return document.querySelector("[class*=_forma_]")`,
    pular: [
      /* O título vive na barra da casca, como em Permissões. */
      "~Convites3 convites ativos",
    ],
  },

  /* ------------------------------------------------ o app principal */

  {
    nome: "shell · rolável dos canais",
    arquivo: APP,
    /*
      ⚠ **Ele compara SÓ o container rolável, e não o que está dentro — duas
      limitações somadas, as duas escritas para ninguém tentar de novo.**

      (1) *Estrutura.* O design põe cabeçalho de categoria e canais como
      IRMÃOS (16 filhos direto no rolável); o app aninha os canais dentro de um
      `.categoria`, que é o que permite colapsar a seção. Com `profundidade`
      maior, o confronto casa o 3º filho do design com o 3º do app — nós
      diferentes — e toda "diferença" que ele relata é do desalinhamento.

      (2) *Instrumento.* Mirar UMA linha não é possível: o escalador sobe do
      texto até um ancestral da largura declarada, e `subir` só soma a essa
      subida — não há como descer. Com `larguraDoDesign` desligado ele sobe
      pelo heurístico de 600px e passa ainda mais longe. É a mesma limitação
      que mantém o rail fora, e por isso a mesma ressalva: a linha de canal, o
      cabeçalho do servidor, a faixa de busca, o cabeçalho de categoria e a
      lâmina são conferidos À MÃO contra o markup do design.

      Medidos nesta rodada, e todos batendo: cabeçalho `0 14` em 50 · faixa
      `10 10 6` · busca h30 `0 9` gap 7 · categoria `12 6 5` gap 5 · linha h30
      `0 8` gap 7 com nome em 14 · lâmina 3×20 em top 5 · badge 16×16 `0 5`.

      Sobra uma diferença de ALTURA (706 contra 695) que não é do desenho: o
      rolável é `flex:1` e recebe o que a janela deixa, e o app é medido em
      `/dev`, onde a barra do arnês come a diferença. Comparar altura de
      caixa que se estica é comparar a janela.
    */
    ancora: "boas-vindas",
    cliques: [],
    larguraDoDesign: 248,
    subir: 0,
    profundidade: 0,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(),
    raiz: `return document.querySelector("[class*=_rolagem_]")`,
  },
  /*
    ⚠ **O rail NÃO tem roteiro, e a razão é o instrumento.** O confronto ancora
    por TEXTO, e o rail do design é feito de ladrilhos com uma ou duas letras —
    "V", "PD", "R" — que não são únicos em lugar nenhum do arquivo. Ancorar num
    deles pegaria a primeira ocorrência em qualquer tela. Ele fica de fora até
    haver uma forma de mirar que não dependa de texto; enquanto isso, é a única
    superfície do shell conferida só à mão.
  */
  {
    nome: "shell · cabeçalho do canal",
    arquivo: APP,
    ancora: "Buscar em #produto",
    cliques: [],
    subir: 1,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(),
    raiz: `return [...document.querySelectorAll('header,div')].find((e) => Math.round(e.getBoundingClientRect().height) === 50 && e.getBoundingClientRect().width > 300)`,
  },
  {
    nome: "shell · composer",
    arquivo: APP,
    ancora: "shift + ↵ nova linha",
    cliques: [],
    subir: 2,
    profundidade: 3,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(),
    raiz: `return document.querySelector('textarea')?.closest('[class*=_campo_]')`,
  },
  {
    nome: "shell · painel de usuário",
    arquivo: APP,
    ancora: "revisando specs",
    larguraDoDesign: 248,
    cliques: [],
    subir: 1,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(),
    raiz: `return document.querySelector("[class*=_painel_]")`,
  },

  /* --------------------------------------- superfícies da mensagem */

  {
    nome: "mensagem · menu de contexto",
    arquivo: SUPERFICIES,
    /* ⚠ "Adicionar reação" não serve de âncora: o texto vive num nó COM
       filhos (ele tem a seta de submenu ao lado), e o buscador só olha folhas.
       "Copiar texto" é folha e só aparece no menu. */
    ancora: "Copiar texto",
    cliques: [],
    subir: 1,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(menuDaMensagem),
    raiz: `return document.querySelector('[role="menu"]')`,
  },
  {
    nome: "mensagem · enquete",
    arquivo: APP,
    ancora: "Bitrate padrão",
    cliques: [],
    subir: 1,
    profundidade: 3,
    app: "http://localhost:4174/dev",
    preparar: abrirCanal(),
    raiz: `return document.querySelector('[role="group"]')?.parentElement`,
  },

  /* ======================================================================
     Configurações de SERVIDOR — uma entrada por categoria
     ----------------------------------------------------------------------
     ⚠ **As treze estão aqui, e a ausência de uma passa a REPROVAR.** O teste
     `src/config/roteiros.test.ts` lê este arquivo e a lista de seções, e falha
     quando uma categoria não tem roteiro. É o que responde "como garantir que
     fiquem 1:1": categoria nova não existe sem confronto, do mesmo jeito que
     modal novo não compila sem entrada em `ModalId`.

     `larguraDoDesign: 1310` nas treze — é o rolável do pane do design (1560
     menos os 248 da coluna). Sem ele o escalador sobe até a tela inteira e o
     confronto compara o pane inteiro contra o nosso rolável.
     ====================================================================== */

  {
    nome: "servidor · perfil",
    secao: "servidor",
    raizDesign: `
      const sc = [...document.querySelectorAll('.vx-scroll')]
        .find((e) => e.getBoundingClientRect().width > 600);
      /* ⚠ Não há wrapper de PAR no design: o de 1120 tem [cabeçalho,
         coluna do formulário, coluna da prévia] como irmãos. Descer mais
         um nível caía na prévia e comparava-a contra a página inteira. */
      return sc ? sc.firstElementChild : null;
    `,
    soFilhos: true,
    arquivo: SERVIDOR,
    ancora: "Recomendado 512×512",
    cliques: [],
    larguraDoDesign: 1120,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Perfil do servidor"),
    raiz: CONTEUDO_DO_APP,
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      /* ⚠ Casamento EXATO nos dois, e não `~`. O `todo` é a subárvore
         cortada em 120 caracteres, então a COLUNA inteira começa com o mesmo
         texto do cabeçalho — um `~` podava a coluna junto e sobrava um bloco
         só do lado do design. */
      "Perfil do servidor",
      "É assim que o servidor aparece em convites e na descoberta interna. O card à direita atualiza ao vivo.",
    ],
  },
  {
    nome: "servidor · tag",
    secao: "tag",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "2 a 4 caracteres",
    cliques: ["Tag do servidor"],
    larguraDoDesign: 1080,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Tag do servidor"),
    raiz: CONTEUDO_DO_APP,
    pularApp: [
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~O protocolo do Stoat não tem tag de servidor",
    ],
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      "~Identificador curto que aparece ao lado",
    ],
  },
  {
    nome: "servidor · modelo",
    secao: "modelo",
    raizDesign: CONTEUDO_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "Sincronizar com o servidor atual",
    cliques: ["Modelo do servidor"],
    larguraDoDesign: 760,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Modelo do servidor"),
    raiz: CONTEUDO_DO_APP,
    pularApp: [
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~O protocolo do Stoat não tem modelos de servidor",
    ],
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      "~Gere um modelo com a estrutura deste servidor",
    ],
  },
  {
    nome: "servidor · emoji",
    secao: "emojis",
    raizDesign: CONTEUDO_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "o nome vira o alias automaticamente",
    cliques: ["Emoji"],
    larguraDoDesign: 1000,
    subir: 0,
    profundidade: 1,
    /* ⚠ Profundidade 1: as linhas vêm do DADO — o design semeia 9 e o arnês
       41 —, e comparar a contagem delas mede o gerador, não a tela. O que
       vale aqui é a moldura da tabela e o rodapé ao lado dela. */
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Emoji"),
    raiz: CONTEUDO_DO_APP,
    pular: [
      "~24 de 50 estáticos",
      /* Coluna "quem pode usar": não existe em `Emoji` — o objeto tem parent,
         creator, name, animated, mature e a URL, e nada que gateie o uso. */
      "QUEM PODE USAR",
    ],
    pularApp: [
      /* A barra de contagem: no design os números vivem no cabeçalho da
         página, que na nossa casca é a barra do pane. Eles não têm outro
         lugar para morar aqui. */
      "~Apagar um emoji não apaga",
      /* O rodapé que diz o que o protocolo NÃO guarda é acréscimo nosso —
         é ele que transforma coluna ausente em decisão declarada. */
    ],
  },
  {
    nome: "servidor · figurinhas",
    secao: "figurinhas",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "vagas restantes",
    cliques: ["Figurinhas"],
    larguraDoDesign: 1000,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Figurinhas"),
    raiz: CONTEUDO_DO_APP,
    pularApp: [
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~O protocolo do Stoat não tem figurinhas",
    ],
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      "~12 de 15 · PNG ou APNG",
    ],
  },
  {
    nome: "servidor · efeitos sonoros",
    secao: "sons",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "fanfarra",
    cliques: ["Efeitos sonoros"],
    larguraDoDesign: 900,
    subir: 0,
    profundidade: 1,
    /* ⚠ Profundidade 1: as linhas vêm do DADO — o design semeia 9 e o arnês
       41 —, e comparar a contagem delas mede o gerador, não a tela. O que
       vale aqui é a moldura da tabela e o rodapé ao lado dela. */
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Painel de efeitos sonoros"),
    raiz: CONTEUDO_DO_APP,
    pularApp: [
      /* O botão de enviar: o design o põe no cabeçalho da página, que aqui
         é a barra do pane. */
      "Enviar som",
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~O protocolo do Stoat não tem painel de efeitos sonoros",
    ],
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      "~8 de 8 sons",
    ],
  },
  {
    nome: "servidor · membros",
    secao: "membros",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "Bea Toledo",
    cliques: ["Membros"],
    larguraDoDesign: 1238,
    subir: 0,
    profundidade: 1,
    /* ⚠ Profundidade 1: as linhas vêm do DADO — o design semeia 9 e o arnês
       41 —, e comparar a contagem delas mede o gerador, não a tela. O que
       vale aqui é a moldura da tabela e o rodapé ao lado dela. */
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Membros"),
    raiz: CONTEUDO_DO_APP,
    pular: [
      /* "Última atividade" não é campo do protocolo — o Stoat não registra
         atividade por membro, e a contagem de online do topo é do servidor
         inteiro, que o cliente não conhece. */
      "ÚLTIMA ATIVIDADE",
    ],
    pularApp: [
      /* Filtros e contagem: o design os põe na banda FIXA acima do rolável;
         a nossa casca rola o cabeçalho junto com o conteúdo, e eles vêm
         com ele. É a divergência de arquitetura registrada no `.rolagem`. */
      "~Todos os cargos",
      /* O rodapé que diz o que o protocolo NÃO guarda é acréscimo nosso —
         é ele que transforma coluna ausente em decisão declarada. */
      "~O que o protocolo não conta",
    ],
  },
  {
    nome: "servidor · cargos",
    secao: "cargos",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: SERVIDOR,
    ancora: "Exibir membros separadamente",
    cliques: ["Cargos"],
    larguraDoDesign: 986,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Cargos"),
    raiz: `return document.querySelector("[data-bloco='editor-de-cargo']")`,
    pularApp: [
      /* Cabeçalho e abas do editor: no design eles ficam na banda fixa
         acima do rolável; aqui rolam com o conteúdo, como o resto. */
      "~Editar cargo",
      /* As quatro abas. */
      "~ExibiçãoPermissões",
    ],
  },
  {
    nome: "servidor · convites",
    secao: "convites",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "Convite pessoal padrão",
    cliques: ["Convites"],
    larguraDoDesign: 1080,
    subir: 0,
    profundidade: 1,
    /* ⚠ Profundidade 1: as linhas vêm do DADO — o design semeia 9 e o arnês
       41 —, e comparar a contagem delas mede o gerador, não a tela. O que
       vale aqui é a moldura da tabela e o rodapé ao lado dela. */
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Convites"),
    raiz: CONTEUDO_DO_APP,
    pular: [
      /* ⚠ O protocolo não tem convite PADRÃO de servidor: convite é sempre
         de um canal, e nenhum campo o marca como o do botão "Convidar
         pessoas". A seção inteira do design depende desse conceito. */
      "~Convite pessoal padrão",
      "~6 convites ativos",
      /* `uses`, `max_uses`, `expires_at`, `temporary` e `vanity` dão ZERO
         ocorrências no schema do `stoat-api`. Só `creator` existe. */
      "USOS",
      "EXPIRA",
    ],
    pularApp: [
      /* A barra de criar: mesma razão de Membros — no design ela é banda
         fixa, aqui rola com o conteúdo. */
      "~Cada convite leva a um canal",
      /* O rodapé que diz o que o protocolo NÃO guarda é acréscimo nosso —
         é ele que transforma coluna ausente em decisão declarada. */
      "~O design mostra ainda usos, validade",
    ],
  },
  {
    nome: "servidor · acesso",
    secao: "acesso",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "Nenhum convite funciona até reabrir",
    cliques: ["Acesso"],
    larguraDoDesign: 720,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Acesso"),
    raiz: CONTEUDO_DO_APP,
    pular: [
      "Requisitos de entrada",
      "Acesso",
      "~Quem consegue entrar e o que precisa",
      /* A fila só aparece em "Aprovação manual" — é o que o design faz, e o
         mock dele abre já naquele modo. */
      "~Fila de aprovação",
    ],
    pularApp: [
      /* ⚠ **A sobrancelha de Requisitos de entrada fica FORA do cartão
         aqui, e é a referência que decide.** O design a desenha dentro da
         caixa; a referência — que é quem decide o que EXISTE — a põe como
         `text-eyebrow` solta, igual às outras duas seções da página
         vizinha. Seguir o design aqui faria a mesma etiqueta aparecer de
         dois jeitos em telas irmãs. */
      "Requisitos de entrada",
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~Nada aqui chega ao servidor ainda",
    ],
  },
  {
    nome: "servidor · segurança",
    secao: "seguranca",
    raizDesign: CONTEUDO_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "Ações de segurança de emergência",
    cliques: ["Segurança"],
    larguraDoDesign: 760,
    subir: 0,
    profundidade: 2,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Segurança"),
    raiz: CONTEUDO_DO_APP,
    pularApp: [
      /* Mesma decisão de Acesso: a sobrancelha do grupo fica FORA do
         cartão, como a referência faz — e como as duas seções acima
         desta mesma página já fazem. */
      "Contato entre membros",
      /* O `Banner` de pendência é ACRÉSCIMO nosso: sem ele, controles que
         não mudam parecem quebrados. O design não tem o conceito. */
      "~Nada aqui chega ao servidor ainda",
    ],
    /* O cabeçalho da página: no design ele rola com o conteúdo;
       na nossa casca ele é a barra do pane, fora da página. */
    pular: [
      /* A sobrancelha do grupo vive DENTRO do cartão no design e fora
         aqui — ver o motivo no `pularApp`. Podada dos dois lados. */
      "Contato entre membros",
      "~Nível de verificação, filtro de mídia",
    ],
  },
  {
    nome: "servidor · auditoria",
    secao: "auditoria",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: false,
    /* A lista é toda dado: cinco entradas aqui, seis lá, e a régua de dia
       aparece conforme as datas caem. Compara-se o container. */
    arquivo: SERVIDOR,
    ancora: "ROLE_UPDATE",
    cliques: ["Registro de auditoria"],
    larguraDoDesign: 900,
    subir: 0,
    profundidade: 0,
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Registro de auditoria"),
    raiz: `return document.querySelector("[data-secao] ul")`,
  },
  {
    nome: "servidor · banimentos",
    secao: "banimentos",
    raizDesign: ROLAVEL_DO_DESIGN,
    soFilhos: true,
    arquivo: RESTANTES,
    ancora: "spam_842",
    cliques: ["Banimentos"],
    larguraDoDesign: 1080,
    subir: 0,
    profundidade: 1,
    /* ⚠ Profundidade 1: as linhas vêm do DADO — o design semeia 9 e o arnês
       41 —, e comparar a contagem delas mede o gerador, não a tela. O que
       vale aqui é a moldura da tabela e o rodapé ao lado dela. */
    app: "http://localhost:4174/dev",
    preparar: abrirConfigDeServidor("Banimentos"),
    raiz: CONTEUDO_DO_APP,
    pular: [
      /* "Banido por" e "Data" não estão em `ServerBan` — ele guarda `_id`,
         `reason` e o usuário. Os dois existem na auditoria, em `BanCreate`. */
      "BANIDO POR",
      "DATA",
    ],
    pularApp: [
      /* A contagem: banda fixa no design, dentro da página aqui. */
      "~contas banidas",
      /* O rodapé que diz o que o protocolo NÃO guarda é acréscimo nosso —
         é ele que transforma coluna ausente em decisão declarada. */
    ],
  },
];
