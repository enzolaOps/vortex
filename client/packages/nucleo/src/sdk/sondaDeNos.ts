/**
 * Escolhe o nó de voz mais próximo.
 *
 * O protocolo entrega uma lista de nós com URL pública, e o upstream corre uma
 * sonda de latência entre eles. Aqui é a mesma ideia, com `Promise.any`: o
 * primeiro que responder ganha.
 *
 * ⚠ **A sonda é otimização, nunca requisito — e por isso tem teto.** Antes ela
 * não tinha timeout nem era pulada com um nó só: um nó pendurado segurava a
 * entrada na sala inteira. Agora: com no máximo um nó não há o que comparar
 * (devolve o nome dele, sem rede); com vários, o teto devolve `undefined` e o
 * servidor escolhe.
 *
 * ⚠ `replace(/^ws/, "http")` é ANCORADO — sem a âncora, um nó chamado
 * `wsproxy` teria o nome trocado no meio.
 */
export type NoDeVoz = { name: string; public_url: string };

export const LIMITE_DA_SONDA_MS = 1500;

export async function escolherNoMaisRapido(
  nos: readonly NoDeVoz[],
  opcoes: { buscar?: typeof fetch; limiteMs?: number } = {},
): Promise<string | undefined> {
  if (nos.length <= 1) return nos[0]?.name;
  const buscar = opcoes.buscar ?? fetch;
  const limiteMs = opcoes.limiteMs ?? LIMITE_DA_SONDA_MS;
  const parar = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.any(
        nos.map(async (no) => {
          await buscar(no.public_url.replace(/^ws/, "http"), {
            mode: "no-cors",
            signal: parar.signal,
          });
          return no.name;
        }),
      ),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), limiteMs);
      }),
    ]);
  } catch {
    // Nenhum respondeu. Entrar mesmo assim é melhor que não entrar.
    return undefined;
  } finally {
    clearTimeout(timer);
    parar.abort();
  }
}
