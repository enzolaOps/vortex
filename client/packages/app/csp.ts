import type { Plugin } from "vite";

/**
 * A Content-Security-Policy do `app`, injetada como `<meta>` no `index.html`.
 *
 * Herda a política do `client` (05-seguranca.md §2.1) sem afrouxar nada: em
 * produção `script-src` não tem `unsafe-inline` nem `unsafe-eval` (só
 * `'wasm-unsafe-eval'`, que compila WebAssembly e não libera `eval`); `img-src`,
 * `media-src` e `connect-src` não têm `https:` nem `*`. Só o dev server aceita
 * script inline, porque o Vite injeta o preâmbulo do React Refresh assim.
 *
 * TODO (M1c, 05-seguranca.md §5 nº 4): Trusted Types. `require-trusted-types-for
 * 'script'` em modo REPORT-ONLY NÃO é possível por `<meta>` (o navegador ignora
 * `report-only` em meta). Quando o Caddy do pi-infra emitir o cabeçalho
 * `Content-Security-Policy-Report-Only: require-trusted-types-for 'script'`,
 * registrar antes disso uma política `default` de Trusted Types (hook
 * `instalarPoliticaDeTrustedTypes` em `src/main.tsx`) que só relata. Depois que as
 * jornadas passarem sem violação, o cabeçalho vira bloqueante. Mesmo vale para
 * `frame-ancestors`, que também não existe em meta.
 */
export function montarPolitica(opcoes: { dev: boolean; apiUrl?: string }): string {
  const origens = new Set<string>();
  const extras = new Set<string>();
  if (opcoes.apiUrl) {
    try {
      const u = new URL(opcoes.apiUrl);
      origens.add(u.origin);
      extras.add(u.origin);
      /* `ws:` é origem separada de `http:` para `connect-src`. */
      extras.add(`${u.protocol === "https:" ? "wss" : "ws"}://${u.host}`);
    } catch {
      /* URL inválida é problema do build; o sdk/config.ts falha adiante. */
    }
  }

  return [
    "default-src 'self'",
    opcoes.dev
      ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
      : "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data: blob:", ...origens].join(" "),
    ["media-src 'self' blob:", ...origens].join(" "),
    "font-src 'self' data:",
    ["connect-src 'self'", ...extras].join(" "),
    "frame-src 'self'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function cspDoVortex(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: "vortex-csp",
    configResolved(cfg) {
      env = cfg.env as Record<string, string>;
    },
    transformIndexHtml(_html, ctx) {
      const apiUrl = (ctx.server ? env.VITE_DEV_API_URL : env.VITE_API_URL) ?? "";
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: montarPolitica({ dev: Boolean(ctx.server), apiUrl }),
          },
          injectTo: "head-prepend",
        },
      ];
    },
  };
}
