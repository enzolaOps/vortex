/**
 * A decisão da atenuação — o efeito (carregar o `native-sound-mixer`, ouvir o
 * IPC e o `app`) mora em `atenuacao.ts`.
 *
 * ⚠ **Fechar o app não pode deixar o computador a 50%.** O mixer é `import()`
 * assíncrono: um `void atenuar(false)` no `will-quit` deixava o processo sair
 * antes de o volume voltar — na primeira fala da sessão, com o módulo ainda
 * carregando, era a regra e não a exceção. `aoSair` resolve os três casos:
 *
 * 1. nunca houve atenuação → não segura nada;
 * 2. mixer já em mãos → restaura SÍNCRONO, e o fechamento segue;
 * 3. mixer ainda carregando → segura o `before-quit`, espera a restauração com
 *    TETO de tempo e pede para sair de novo, uma vez só.
 */

export const FATOR = 0.5;
/** Quanto o fechamento pode esperar o volume voltar antes de desistir. */
export const TETO_AO_SAIR_MS = 1500;

export type Sessao = { appName: string; volume: number };
export type Mixer = { getDefaultDevice(tipo: number): { sessions: Sessao[] } };
export type MixerCarregado = { m: Mixer; saida: number };

type Deps = {
  /** Idempotente: a mesma promessa a cada chamada. */
  carregar: () => Promise<MixerCarregado | undefined>;
  /** O executável do próprio app, cujas sessões ficam de fora. */
  proprio: string;
  tetoMs?: number;
  erro?: (...args: unknown[]) => void;
};

export function criarAtenuacao({
  carregar,
  proprio,
  tetoMs = TETO_AO_SAIR_MS,
  erro = console.error,
}: Deps) {
  /** Por executável: o volume original e o que nós pusemos. */
  const atenuadas = new Map<string, { original: number; posto: number }>();
  /** O mixer, assim que carregou — é o que permite restaurar síncrono. */
  let carregado: MixerCarregado | undefined;
  /** `atenuar` esperando o mixer: pode vir a atenuar depois do fechamento. */
  let pendentes = 0;
  /** O fechamento começou: nada mais atenua. */
  let encerrando = false;
  /** Já esperamos uma vez; o segundo `before-quit` passa direto. */
  let liberado = false;
  let segurando = false;

  function sessoesDeOutros({ m, saida }: MixerCarregado): Sessao[] {
    const p = proprio.toLowerCase();
    return m
      .getDefaultDevice(saida)
      .sessions.filter((s) => s.appName && s.appName.toLowerCase() !== p);
  }

  function aplicar(x: MixerCarregado, sim: boolean): void {
    try {
      const sessoes = sessoesDeOutros(x);
      if (sim) {
        for (const s of sessoes) {
          if (atenuadas.has(s.appName)) continue;
          const posto = s.volume * FATOR;
          atenuadas.set(s.appName, { original: s.volume, posto });
          s.volume = posto;
        }
        return;
      }
      for (const s of sessoes) {
        const a = atenuadas.get(s.appName);
        if (!a) continue;
        /* Mexeram no volume enquanto estava atenuado: a escolha é da pessoa. */
        if (Math.abs(s.volume - a.posto) < 0.02) s.volume = a.original;
      }
      atenuadas.clear();
    } catch (e) {
      /* Um programa que fechou no meio da conversa leva a sessão junto. */
      erro("Não deu para ajustar o volume dos outros apps:", e);
      if (!sim) atenuadas.clear();
    }
  }

  async function atenuar(sim: boolean): Promise<void> {
    if (sim && encerrando) return;
    pendentes++;
    let x: MixerCarregado | undefined;
    try {
      x = await carregar();
    } finally {
      pendentes--;
    }
    if (!x) return;
    carregado = x;
    /* O fechamento pode ter começado enquanto o mixer carregava. */
    if (sim && encerrando) return;
    aplicar(x, sim);
  }

  /**
   * Para o `before-quit`. `sair` é o `app.quit()` que retoma o fechamento
   * depois da espera.
   */
  function aoSair(evento: { preventDefault(): void }, sair: () => void): void {
    if (liberado) return;
    encerrando = true;
    if (carregado) {
      aplicar(carregado, false);
      return;
    }
    if (pendentes === 0 && atenuadas.size === 0) return;
    evento.preventDefault();
    if (segurando) return;
    segurando = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const teto = new Promise<void>((r) => {
      timer = setTimeout(r, tetoMs);
    });
    void Promise.race([atenuar(false).catch(() => undefined), teto]).then(() => {
      clearTimeout(timer);
      liberado = true;
      sair();
    });
  }

  return { atenuar, aoSair };
}
