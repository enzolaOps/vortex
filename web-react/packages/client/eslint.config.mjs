// @ts-check
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Enforcement de Fase 0.
 *
 * Regra escrita depende de alguém lembrar; mecanismo não. Cada bloco abaixo
 * corresponde a uma linha de `references/enforcement.md`.
 *
 * A regra de cor default do Tailwind NÃO está aqui de propósito: ela é
 * resolvida por ausência no `@theme` (`--color-*: initial`), não por proibição.
 * Tornar impossível > proibir.
 */
/**
 * As regras de sintaxe que valem em TODO arquivo.
 *
 * Extraídas para constante porque a fase 4 acrescentou um segundo conjunto
 * que vale só em código de feature — e `no-restricted-syntax` não soma entre
 * blocos de config: o último a casar vence. Compor as listas é o que evita
 * que ligar a regra nova desligue as antigas em metade do projeto.
 */
const SINTAXE_GERAL = [
        {
          /**
           * Utility de espaçamento fracionária — `py-0.5`, `mt-1.5`, `gap-2.5`.
           *
           * Estas NÃO EXISTEM neste projeto e, pior, não falham: o `@theme` faz
           * `--spacing-*: initial` e define apenas `1..6`, então a utility
           * simplesmente não é gerada e o elemento fica sem o espaçamento que o
           * código diz ter.
           *
           * Foi assim que o ritmo de agrupamento da lista de mensagens ficou
           * escrito no comentário e ausente da tela: `py-0.5` prometia 4px
           * dentro do grupo e entregava 0px, durante toda a fase 3 e a 4.
           * Descoberto comparando com o Discord, não usando o app — o que é
           * exatamente a definição de degradação silenciosa.
           *
           * Valor fora da escala precisa de justificativa; valor fora da escala
           * que some sem avisar não precisa de justificativa, precisa de lint.
           */
          selector:
            "Literal[value=/(^|\\s)(p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me|gap|gap-x|gap-y|size|w|h|min-w|min-h|max-w|max-h|inset|top|right|bottom|left|start|end|space-x|space-y|translate-x|translate-y)-\\d+\\.\\d+($|\\s)/]",
          message:
            "Utility de espaçamento fracionária não existe aqui: a escala é 1–6 e `--spacing-*: initial` apaga o resto, então esta classe NÃO gera CSS e some sem erro. Use um degrau da escala, ou CSS Module se o valor for legítimo e fora dela.",
        },
        {
          /**
           * `aria-pressed` com rótulo que muda de AÇÃO junto do estado.
           *
           * O par tem que ser nome estável + estado no `aria-pressed`, como o
           * botão de negrito: "Negrito, pressionado". Quando o rótulo também
           * muda, os dois dizem a mesma coisa duas vezes e o leitor de tela
           * anuncia o INVERSO da verdade.
           *
           * Não é hipótese: com o microfone aberto, o cartão de chamada dizia
           * `aria-label="Silenciar microfone"` e `aria-pressed="true"` —
           * "silenciar está ativo", ou seja, mudo. Os quatro controles da
           * chamada e os três do painel de edição tinham a mesma forma, e havia
           * um comentário no código explicando por que o `aria-pressed` estava
           * ali. Não faltou atenção; faltou mecanismo.
           *
           * O rótulo de ação continua existindo onde ele serve — no tooltip.
           */
          selector:
            "JSXOpeningElement:has(JSXAttribute[name.name='aria-pressed']) JSXAttribute[name.name='aria-label'] > JSXExpressionContainer > ConditionalExpression",
          message:
            "aria-pressed exige nome ESTÁVEL: rótulo que alterna junto do estado faz o leitor de tela anunciar o inverso (\"Silenciar microfone, pressionado\" com o microfone aberto). Nomeie o recurso e deixe o estado no aria-pressed; a ação vai no tooltip.",
        },
        {
          selector:
            "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name=/^(i|idx|index)$/]",
          message:
            "key deve ser ID de entidade, nunca índice: índice corrompe o estado da linha a cada inserção no topo.",
        },
        {
          /**
           * Arbitrary value do Tailwind proibido — lei nº 4.
           *
           * `bg-[#2b2d31]`, `p-[13px]`, `max-w-[--vx-message-max-w]` são valor
           * mágico com outra sintaxe. O último foi escrito por mim durante a
           * fase 0 e passou despercebido porque esta regra ainda não existia;
           * além de proibido, não funcionava — a coluna corria a viewport
           * inteira e só apareceu numa captura de tela.
           *
           * O lookahead negativo preserva variante arbitrária, que é sintaxe
           * legítima e documentada: `data-[state=open]:opacity-100` e
           * `[&>svg]:size-4` terminam em `:` e passam. O que não passa é
           * colchete que carrega VALOR.
           *
           * Propriedade arbitrária (`[scrollbar-gutter:stable]`) também cai
           * aqui, e é o comportamento certo: styling.md manda isso para CSS
           * Module, não para a className.
           */
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\[[^\\]]*\\](?!:)/]",
          message:
            "Arbitrary value proibido (lei nº 4). Token novo entra em tokens.css e é projetado no @theme; se a className exigiu colchete, o lugar é um CSS Module.",
        },
        {
          /**
           * Direção física proibida — lei nº 6.
           *
           * `left`, `right`, `ml`, `mr`, `pl`, `pr`, `border-l/r`,
           * `rounded-l/r`, `text-left/right` assumem um lado. O equivalente
           * lógico (`start`/`end`, `ms`/`me`, `ps`/`pe`, `border-s/e`,
           * `rounded-s/e`, `text-start/end`) funciona nos dois sentidos.
           *
           * Não é sobre RTL apenas: a lei nº 6 exige que todo componente
           * funcione à esquerda E à direita, porque na fase 4 o usuário
           * reordena os painéis. Um componente que assume o lado vira
           * reescrita naquele dia; escrito com propriedade lógica desde
           * agora, custa a mesma coisa.
           *
           * Cuidado ao ler: `rounded-l` (elle, físico) e `rounded-1` (um, a
           * escala do projeto) são visualmente parecidos e semanticamente
           * opostos.
           */
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/(^|[\\s:])-?(ml-|mr-|pl-|pr-|left-|right-|border-[lr]($|[\\s-])|rounded-[lr]($|[\\s-])|text-(left|right)($|\\s))/]",
          message:
            "Direção física proibida (lei nº 6). Use a propriedade lógica: start/end, ms/me, ps/pe, border-s/e, rounded-s/e, text-start/end. Painel que assume lado vira reescrita quando o usuário puder reordenar.",
        },
];

/**
 * Controle NATIVO proibido em código de feature.
 *
 * `<select>`, `<input type="range"> `e `<input type="color">` são desenhados
 * pelo SISTEMA, não pelo app. Num cliente dark no Windows eles chegam com
 * cromo claro, e a identidade do produto termina na borda deles — o mesmo
 * efeito de misturar dois sets de ícone, que este projeto já proíbe.
 *
 * A fase 4 entregou quatro deles em superfícies de produto. O checklist de
 * revisão já cobria isso (`review-checklist.md`, os oito estados) e não foi
 * rodado — e a ordem de preferência do enforcement.md coloca checklist no
 * penúltimo degrau justamente por isso. Esta regra sobe o degrau.
 *
 * `components/ui/` é isento: é lá que os primitivos ENVOLVEM o nativo, e ali
 * o import é o trabalho, não a violação. Mesma forma da fronteira do Radix.
 *
 * `checkbox` NÃO está na lista: `accent-color` o deixa dentro do sistema de
 * cor com uma linha, e ele não abre superfície própria. A régua é "o sistema
 * desenha algo que o nosso CSS não alcança".
 *
 * `type="color"` é o caso limite e continua proibido em feature: o seletor
 * que ele abre é do SO e é insubstituível, mas o GATILHO é nosso — por isso
 * ele vive envolvido em `components/ui`, com o gatilho estilizado.
 */
/**
 * Item de menu que não faz nada.
 *
 * Nasceu de três itens reais — `Copiar texto`, `Editar` e `Apagar` — que
 * ficaram meses no menu de mensagem sem `onSelect`. Apareciam, recebiam foco,
 * fechavam o menu ao serem escolhidos e não faziam absolutamente nada.
 *
 * Nada falha: o item é válido, o Radix o renderiza, o typecheck aprova, o teste
 * não existe. E o dano não é o item — é a CONFIANÇA no menu inteiro, que a
 * pessoa deixa de ter depois da segunda vez que escolhe algo e nada acontece.
 *
 * `disabled` conta como resposta: um item desligado DIZ que não dá, e dizer não
 * é uma resposta. Silêncio não é.
 *
 * A regra é da mesma família do controle nativo e do `pnpm utilities`: falha
 * silenciosa que só aparece olhando, virando mecanismo que falha sozinho.
 */
const ITEM_INERTE = [
  {
    selector:
      "JSXOpeningElement[name.name=/^(ContextMenu|DropdownMenu)Item$/]:not(:has(JSXAttribute[name.name=/^(onSelect|disabled|asChild)$/]))",
    message:
      "Item de menu sem `onSelect`. Item que não faz nada é pior que item ausente: ensina a pessoa a não confiar no menu. Ligue a ação, marque `disabled`, ou remova até a ação existir.",
  },
];

const CONTROLE_NATIVO = [
  {
    selector: "JSXOpeningElement[name.name='select']",
    message:
      "`<select>` nativo é desenhado pelo sistema, não pelo app. Use `Segmentado` (poucas opções visíveis) ou `DropdownMenu` (muitas). Ambos já existem em components/ui.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value='range'])",
    message:
      "`<input type=\"range\">` cru chega com cromo do sistema. Use `Deslizante` de components/ui, que é este mesmo input pintado.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'][value.value='color'])",
    message:
      "`<input type=\"color\">` só pode aparecer dentro de components/ui, com o gatilho estilizado. O seletor que ele abre é do SO e não dá para substituir; o gatilho dá.",
  },
];

export default tseslint.config(
  /*
    `scripts/coletor.js` NÃO é código deste projeto — é o texto que o
    `confronto` injeta com `Runtime.evaluate` dentro das duas páginas. Ele nunca
    é importado, nunca entra no bundle e não está em tsconfig nenhum, então o
    lint com tipos morre nele com "parserOptions não gera informação de tipo".

    Ele vive num arquivo `.js` de propósito, e a razão está escrita no topo
    dele: escrito dentro de um template literal, ele quebrou o script três
    vezes — uma crase num comentário fecha a string, e uma das quebras passou
    despercebida (a conversão de oklab ficou inerte e o relatório seguiu
    mentindo). Como arquivo, o editor confere a sintaxe.
  */
  { ignores: ["dist", "node_modules", "scripts/coletor.js"] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  // configs.flat: as regras do React Compiler vivem aqui (immutability, refs,
  // purity, incompatible-library). É o compiler falando por lint.
  reactHooks.configs.flat["recommended-latest"],

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /**
       * Índice como `key` proibido.
       *
       * Em lista de chat, índice corrompe o estado da linha a cada inserção no
       * topo — e o histórico carrega justamente por cima.
       */
      "no-restricted-syntax": ["error", ...SINTAXE_GERAL],
    },
  },

  {
    /**
     * A fronteira do SDK.
     *
     * `stoat.js` só existe dentro de `src/sdk/`. É o que torna verdadeira a
     * frase "o Vortex é um produto separado do Stoat" em vez de aspiracional:
     * sem esta regra, um import de tipo dentro de um componente acopla o app ao
     * protocolo, não dá erro nenhum, e só cobra o preço na primeira feature que
     * o Stoat não tem.
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/sdk/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              /**
               * Radix só existe dentro de `components/ui/`.
               *
               * É isso que mantém viva a possibilidade de trocar Radix por
               * Base UI depois, componente por componente, sem tocar em código
               * de produto — e a troca está prevista: Base UI hoje não tem
               * Context Menu, Hover Card nem Toast, e quando tiver, a decisão
               * é reavaliada.
               *
               * Sem a regra, o primeiro `import * as Dialog from
               * "@radix-ui/react-dialog"` dentro de uma feature transforma uma
               * migração progressiva em varredura do app inteiro.
               */
              group: ["@radix-ui/*"],
              message:
                "Radix só pode ser importado em src/components/ui/. Feature usa o wrapper, nunca o primitivo — é o que mantém a troca por Base UI viável.",
            },
          ],
          paths: [
            {
              name: "stoat.js",
              message:
                "O SDK só pode ser importado em src/sdk/. Componentes falam com tipos de domínio, nunca com o protocolo. Vale para `import type` também.",
            },
            {
              name: "solid-js",
              message:
                "A reatividade Solid é detalhe do adapter e fica encapsulada em src/sdk/.",
            },
          ],
        },
      ],
    },
  },

  {
    /** `any` na fronteira de dados propaga para o app inteiro. */
    files: ["src/sdk/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    // Ferramenta de linha de comando, fora do projeto TypeScript do app.
    files: ["eslint.config.mjs", "vite.config.ts", "scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // O verificador de contraste roda no Node, nao no browser: precisa dos
    // globais de la. Bloco separado porque disableTypeChecked traz o proprio
    // languageOptions e sobrescreveria este.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },

  {
    /**
     * Código de feature: as regras gerais MAIS a proibição de controle nativo.
     *
     * A lista geral é repetida de propósito — `no-restricted-syntax` não soma
     * entre blocos, então declarar só a lista nova aqui desligaria a proibição
     * de arbitrary value e de direção física em todo `src/`, silenciosamente.
     */
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...SINTAXE_GERAL,
        ...CONTROLE_NATIVO,
        ...ITEM_INERTE,
      ],
    },
  },

  {
    // Os wrappers SAO a fronteira: aqui o import de Radix e o trabalho,
    // nao a violacao.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
);
