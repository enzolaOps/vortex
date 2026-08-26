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
  { ignores: ["dist", "node_modules"] },

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
      "no-restricted-syntax": ["error", ...SINTAXE_GERAL, ...CONTROLE_NATIVO],
    },
  },

  {
    // Os wrappers SAO a fronteira: aqui o import de Radix e o trabalho,
    // nao a violacao.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
);
