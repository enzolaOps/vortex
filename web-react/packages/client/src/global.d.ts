/**
 * A versão do app, injetada em tempo de build por `vite.config.ts`.
 *
 * ⚠ Constante e não `import.meta.env`: variável de ambiente é configuração de
 * quem constrói, e a versão é fato do repositório. Como `define`, ela é
 * substituída literalmente e o `package.json` não entra no bundle.
 */
declare const __VERSAO__: string;
