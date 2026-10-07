import { expect, test } from "@playwright/test";

import { contasDeTeste } from "./globalSetup";

/**
 * Specs @backend: precisam da pilha local do pi-infra (ver `globalSetup.ts`). Sem ela
 * pulam sozinhos, e é por isso que o job de CI só roda `@fumaca`. As jornadas de verdade
 * (`4.x-*.spec.ts`) nascem no marco da própria tela, escritas junto com ela.
 */
test.describe("pilha local @backend", () => {
  test.skip(
    () => process.env.VORTEX_E2E_BACKEND !== "1",
    "pilha local inalcançável (suba com make vortex-local-env && make vortex-local-up no pi-infra)",
  );

  test("a API responde com a configuração do servidor", async ({ request }) => {
    const { api } = contasDeTeste();
    const r = await request.get(`${api}/`);
    expect(r.ok()).toBe(true);
    const corpo = (await r.json()) as { revolt?: string };
    expect(corpo.revolt).toBeTruthy();
  });

  test("as duas contas existem e entram (duas pessoas)", async ({ request }) => {
    const { api, a, b } = contasDeTeste();
    for (const conta of [a, b]) {
      const r = await request.post(`${api}/auth/session/login`, {
        data: { email: conta.email, password: conta.senha },
      });
      expect(r.ok(), `login de ${conta.email}`).toBe(true);
    }
  });
});
