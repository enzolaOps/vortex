// @ts-check
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Fronteiras do `app` (04-arquitetura-trd.md §1). Regra escrita depende de
 * alguém lembrar; estas falham sozinhas.
 */
const RADIX = {
  group: ["@radix-ui/*"],
  message: "Radix só pode ser importado em src/ui/primitivos/. Feature usa o wrapper.",
};
const ICONES = {
  group: ["lucide-react", "lucide-react/*", "@remixicon/*", "@phosphor-icons/*"],
  message: "Ícone vem de src/ui/icones.tsx, nunca do pacote direto.",
};
const PADROES_GERAIS = [
  {
    regex: "^client($|/)",
    message: "O app não importa do pacote `client` (interface velha, sai no cutover).",
  },
  {
    group: [
      "nucleo/store/layout",
      "nucleo/store/drawer",
      "nucleo/store/edicao",
      "nucleo/preset/*",
    ],
    message:
      "Layout customizável morreu com o `client` (TRD §4): layout, drawer, edicao e preset não são do app.",
  },
];
const CAMINHOS = [
  {
    name: "stoat.js",
    message:
      "O SDK só pode ser importado em nucleo/src/sdk/. O app fala com tipos de domínio, nunca com o protocolo.",
  },
  {
    name: "solid-js",
    message: "A reatividade Solid é detalhe do adapter, encapsulada em nucleo/src/sdk/.",
  },
];

const restringir = (...padroes) => [
  "error",
  { patterns: [...PADROES_GERAIS, ...padroes], paths: CAMINHOS },
];

/** Sinks de HTML e execução dinâmica: a CSP e o Trusted Types contam com zero. */
const SINTAXE = [
  {
    selector:
      "JSXAttribute[name.name='key'] > JSXExpressionContainer > Identifier[name=/^(i|idx|index)$/]",
    message: "key deve ser ID de entidade, nunca índice.",
  },
  {
    selector: "JSXAttribute[name.name='className'] Literal[value=/\\[[^\\]]*\\](?!:)/]",
    message:
      "Arbitrary value proibido. Token novo entra em tokens.json; se a className exigiu colchete, o lugar é um CSS Module.",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "dangerouslySetInnerHTML proibido (05-seguranca.md §3 nº 1).",
  },
  {
    selector:
      "AssignmentExpression > MemberExpression.left[property.name=/^(innerHTML|outerHTML)$/]",
    message: "innerHTML/outerHTML proibido (05-seguranca.md §3 nº 1).",
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "insertAdjacentHTML proibido (05-seguranca.md §3 nº 1).",
  },
  {
    selector:
      "CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/]",
    message: "document.write proibido (05-seguranca.md §3 nº 1).",
  },
];

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "src/tema/*.gerado.css"] },

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat["recommended-latest"],

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "no-eval": "error",
      "no-new-func": "error",
      "no-implied-eval": "error",
      "no-restricted-syntax": ["error", ...SINTAXE],
      "no-restricted-imports": restringir(RADIX, ICONES),
    },
  },

  // Os wrappers SÃO a fronteira: aqui o import é o trabalho, não a violação.
  {
    files: ["src/ui/primitivos/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": restringir(ICONES) },
  },
  {
    files: ["src/ui/icones.tsx"],
    rules: { "no-restricted-imports": restringir(RADIX) },
  },

  // Ferramentas de linha de comando e config: fora do projeto TypeScript do app.
  {
    files: ["eslint.config.mjs", "scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["vite.config.ts", "csp.ts", "src/**/*.test.ts"],
    languageOptions: { globals: globals.node },
  },
);
