// @ts-check
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Enforcement do núcleo — as fronteiras da lógica.
 *
 * Os blocos de estilo e de JSX do `client` não vêm para cá: o núcleo não tem
 * JSX nem CSS. Valem as regras de direção (§1 do TRD da reescrita).
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules"] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  // As regras do React Compiler (immutability, refs, purity): `store/hooks.ts`
  // e os arquivos de hook são código React.
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
      "no-restricted-syntax": [
        "error",
        {
          /** `virtualizer.measure()` cru apaga as alturas medidas. */
          selector:
            "CallExpression[arguments.length=0][callee.type='MemberExpression'][callee.property.name='measure']",
          message:
            "`measure()` cru apaga as alturas medidas e deixa as linhas montadas na estimativa (sobreposição e buracos). Use `remedir(virtualizer)` de `lib/remedir.ts`.",
        },
      ],
    },
  },

  {
    /**
     * A fronteira do SDK.
     *
     * `stoat.js` e `solid-js` só existem dentro de `src/sdk/`; e o núcleo nunca
     * importa da interface (`client`, `app`). Com `nodeLinker: isolated` o
     * segundo nem resolve — a regra deixa o motivo escrito.
     */
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/sdk/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(client|app)(/|$)",
              message:
                "O núcleo nunca importa da interface. A dependência é UI → núcleo.",
            },
          ],
          paths: [
            {
              name: "stoat.js",
              message:
                "O SDK só pode ser importado em src/sdk/. Os demais módulos falam com tipos de domínio, nunca com o protocolo. Vale para `import type` também.",
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
    /** Dentro do SDK a regra de fronteira de interface continua valendo. */
    files: ["src/sdk/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(client|app)(/|$)",
              message:
                "O núcleo nunca importa da interface. A dependência é UI → núcleo.",
            },
          ],
        },
      ],
    },
  },

  {
    // Ferramenta de linha de comando, fora do projeto TypeScript do núcleo.
    files: ["eslint.config.mjs", "vitest.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
);
