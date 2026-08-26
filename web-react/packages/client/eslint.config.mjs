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
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name=/^(i|idx|index)$/]",
          message:
            "key deve ser ID de entidade, nunca índice: índice corrompe o estado da linha a cada inserção no topo.",
        },
      ],
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
    files: ["eslint.config.mjs", "vite.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
);
