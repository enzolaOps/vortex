import { expect } from "vitest";

/**
 * Esperas de ESTADO para os testes de navegador. Nenhuma delas conta milissegundos.
 *
 * Espera fixa (`setTimeout(r, 500)`) passa na máquina de quem escreveu e reprova no runner
 * Linux do CI quando vários arquivos disputam a CPU: o mesmo trabalho leva o dobro do tempo
 * e a medição pega a lista no meio do movimento. Aqui se espera o que o teste realmente quer
 * saber: que algo PAROU de mudar, ou que o navegador já pintou.
 */

export interface OpcoesDeAssentar {
  /** Quantas leituras seguidas iguais contam como "parou". */
  readonly leituras?: number;
  /** Intervalo entre leituras (ms). */
  readonly intervalo?: number;
  /** Teto de espera (ms). Estourar reprova o teste com a mensagem do `expect.poll`. */
  readonly timeout?: number;
}

/**
 * Espera `ler()` devolver o mesmo valor em N leituras seguidas.
 *
 * É a generalização do `assentar()` dos embeds: "colada no fim" não é "parada", porque a
 * âncora e a remedição ainda movem a janela de linhas montadas alguns quadros depois.
 */
export async function assentar(
  ler: () => unknown,
  { leituras = 6, intervalo = 80, timeout = 8000 }: OpcoesDeAssentar = {},
): Promise<void> {
  let anterior: unknown = Symbol("nenhuma");
  let iguais = 0;
  await expect
    .poll(
      () => {
        const agora = ler();
        iguais = Object.is(agora, anterior) ? iguais + 1 : 0;
        anterior = agora;
        return iguais;
      },
      { timeout, interval: intervalo },
    )
    .toBeGreaterThanOrEqual(leituras - 1);
}

/** A rolagem de um container parou: `scrollTop` e `scrollHeight` iguais em N leituras. */
export function assentarRolagem(el: () => HTMLElement, opcoes?: OpcoesDeAssentar): Promise<void> {
  return assentar(() => {
    const e = el();
    return `${String(e.scrollTop)}|${String(e.scrollHeight)}`;
  }, opcoes);
}

/**
 * Espera N quadros PINTADOS (dois `requestAnimationFrame` por quadro: o segundo só roda
 * depois de o primeiro ter sido pintado).
 *
 * Para asserção NEGATIVA ("o menu não abriu", "nada re-renderizou"): o efeito que o teste
 * proíbe viria de um render ou de um callback de quadro, e depois de N quadros pintados ele
 * já teria acontecido. Com a CPU disputada o quadro demora mais, e a espera demora junto —
 * é o que um `setTimeout` fixo não faz.
 */
export async function quadros(n = 2): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }
}
