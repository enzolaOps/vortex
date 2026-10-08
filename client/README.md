# client

Monorepo pnpm do cliente Vortex (React 19). O código Solid do upstream fica em
`../vendor/stoat-web/` só como referência.

| Pacote | O que é |
| --- | --- |
| `packages/app` | A interface: shell, jornadas, design system, textos |
| `packages/nucleo` | Lógica sem interface: adapter do SDK, stores, markdown, rota, som |
| `packages/stoat.js` | SDK do protocolo (submodule). Precisa de `pnpm build` antes de tudo |

## Comandos

```bash
pnpm install
pnpm run build:deps   # constrói o stoat.js
pnpm dev              # servidor de desenvolvimento do app
pnpm run check        # build das dependências, depois typecheck, lint, testes e build de cada pacote
pnpm --filter app e2e # jornadas com Playwright (precisa da pilha local)
```

Leia `../CLAUDE.md` antes de escrever código aqui. As decisões, o PRD, o design,
a arquitetura e a segurança estão em `../docs/reescrita/`.
