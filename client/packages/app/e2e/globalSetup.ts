/**
 * Preparação global dos E2E: as DUAS contas de teste na pilha local do pi-infra.
 *
 * Dois contextos de navegador = duas pessoas (TRD §9). A pilha sobe com
 *   make vortex-local-env && make vortex-local-up      (no repositório pi-infra)
 * e fala em http://localhost:8880, com a API em /api e a verificação de e-mail
 * DESLIGADA na configuração local (sem isso a criação de conta exigiria um e-mail
 * que ninguém lê).
 *
 * Contas (valores de teste, só existem nessa pilha local descartável):
 *   A: vortex-e2e-a@teste.local   B: vortex-e2e-b@teste.local
 *   senha: VORTEX_E2E_SENHA, ou o padrão abaixo.
 *
 * Contrato:
 *  - API inalcançável NÃO reprova a corrida: o setup avisa, marca VORTEX_E2E_BACKEND=0 e
 *    os specs @backend se pulam sozinhos. É o que deixa o smoke rodar no CI sem pilha.
 *  - API de pé: cria as contas (400 "já existe" é aceito, o setup é idempotente) e marca
 *    VORTEX_E2E_BACKEND=1. Falha de verdade (5xx, resposta estranha) reprova alto, porque
 *    pilha de pé com setup quebrado dá E2E que mente.
 *
 * Os specs leem VORTEX_E2E_BACKEND e as credenciais por `contasDeTeste()`.
 */
const API = process.env.VORTEX_E2E_API ?? "http://localhost:8880/api";
const SENHA = process.env.VORTEX_E2E_SENHA ?? "vortex-e2e-senha-local-1";

export const CONTAS = {
  a: { email: "vortex-e2e-a@teste.local", username: "VortexE2eA" },
  b: { email: "vortex-e2e-b@teste.local", username: "VortexE2eB" },
} as const;

export function contasDeTeste() {
  return {
    api: API,
    a: { ...CONTAS.a, senha: SENHA },
    b: { ...CONTAS.b, senha: SENHA },
  };
}

async function alcancavel(): Promise<boolean> {
  try {
    const r = await fetch(`${API}/`, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function criarConta(email: string): Promise<void> {
  const r = await fetch(`${API}/auth/account/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
    signal: AbortSignal.timeout(10_000),
  });
  // 204 = criada. 400 = e-mail já registrado (corrida anterior): tudo certo.
  if (r.status === 204 || r.status === 400) return;
  throw new Error(`globalSetup: criar ${email} voltou ${r.status} ${await r.text()}`);
}

export default async function globalSetup(): Promise<void> {
  if (!(await alcancavel())) {
    process.env.VORTEX_E2E_BACKEND = "0";
    console.warn(
      `[e2e] API local inalcançável em ${API}: specs @backend serão pulados. ` +
        `Suba a pilha (pi-infra: make vortex-local-env && make vortex-local-up) para rodá-los.`,
    );
    return;
  }
  await criarConta(CONTAS.a.email);
  await criarConta(CONTAS.b.email);
  process.env.VORTEX_E2E_BACKEND = "1";
  console.log(`[e2e] pilha local de pé em ${API}: contas A e B prontas.`);
}
