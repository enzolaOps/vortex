/**
 * Uma tarefa por item, com teto de simultaneidade.
 *
 * Nasceu para "dar este cargo a doze pessoas", e a forma dele é decidida por
 * três coisas que o protocolo impõe:
 *
 * 1. **Não existe escrita em lote.** `ServerMember.edit({ roles })` é uma
 *    pessoa por chamada. Doze pessoas são doze `PATCH`.
 * 2. **O limite de taxa é agressivo.** Medido contra a instância local (ver
 *    `sdk/limiteDeTaxa.test.ts`): o SEGUNDO `PATCH` seguido já pode voltar 429
 *    com `retry_after` de alguns segundos. Disparar as doze de uma vez é
 *    receber dez 429 — então há teto de simultaneidade E espera honrada.
 * 3. **Uma falha não pode derrubar as outras.** `Promise.all` rejeita na
 *    primeira e esconde o destino das onze restantes; quem administra precisa
 *    saber QUEM ficou de fora para tentar de novo só essas.
 *
 * ⚠ **Lógica pura, sem `client` e sem React.** O limite de taxa entra por
 * `esperaDe` e o relógio por `dormir`, e é isso que deixa o teste medir a
 * simultaneidade e a repetição sem rede nem tempo real.
 */

export type FalhaDeLote<T> = {
  readonly item: T;
  /** A frase já traduzida — quem chama decide como traduzir. */
  readonly motivo: string;
};

export type ResultadoDeLote<T> = {
  readonly feitos: readonly T[];
  readonly falhas: readonly FalhaDeLote<T>[];
};

export type OpcoesDeLote = {
  /** Quantas tarefas correm ao mesmo tempo. Mínimo 1. */
  readonly concorrencia?: number;
  /**
   * Chamado a cada item TERMINADO (feito ou falho), com a contagem.
   *
   * Conta terminados e não iniciados: uma barra que anda quando a chamada
   * sai, e não quando ela volta, chegaria a 100% com três pedidos pendurados.
   */
  readonly aoProgredir?: (terminados: number, total: number) => void;
  /**
   * Quanto esperar antes de repetir, em ms — ou `undefined` para não repetir.
   *
   * O único motivo legítimo para repetir é o servidor ter DITO para esperar
   * (429 com `retry_after`). Repetir qualquer erro transformaria "você não tem
   * permissão" em três pedidos negados em vez de um.
   */
  readonly esperaDe?: (erro: unknown) => number | undefined;
  /** Quantas vezes um item pode ser repetido por limite de taxa. */
  readonly repeticoes?: number;
  /** Traduz a falha para a frase que vai na tela. */
  readonly motivoDe?: (erro: unknown) => string;
  /** O relógio. Injetável para o teste não esperar segundos de verdade. */
  readonly dormir?: (ms: number) => Promise<void>;
};

const dormirDeVerdade = (ms: number) =>
  new Promise<void>((resolver) => {
    setTimeout(resolver, ms);
  });

export async function executarEmLote<T>(
  itens: readonly T[],
  tarefa: (item: T) => Promise<void>,
  opcoes: OpcoesDeLote = {},
): Promise<ResultadoDeLote<T>> {
  const {
    concorrencia = 3,
    aoProgredir,
    esperaDe = () => undefined,
    repeticoes = 2,
    motivoDe = (e: unknown) => (e instanceof Error ? e.message : String(e)),
    dormir = dormirDeVerdade,
  } = opcoes;

  const total = itens.length;
  /*
    ⚠ **A ordem do resultado é a da ENTRADA, não a de chegada.** A lista de
    falhas vira linhas na tela, e uma ordem que muda entre duas tentativas —
    porque a rede respondeu noutra sequência — faz a pessoa perder de vista
    quem ela já leu. Guardar por índice e compactar no fim resolve sem ordenar.
  */
  const estado: ({ ok: true } | { ok: false; motivo: string } | undefined)[] =
    new Array<undefined>(total).fill(undefined);
  let proximo = 0;
  let terminados = 0;

  async function umItem(i: number): Promise<void> {
    const item = itens[i] as T;
    for (let tentativa = 0; ; tentativa++) {
      try {
        await tarefa(item);
        estado[i] = { ok: true };
        return;
      } catch (e) {
        const espera = esperaDe(e);
        if (espera !== undefined && tentativa < repeticoes) {
          await dormir(espera);
          continue;
        }
        estado[i] = { ok: false, motivo: motivoDe(e) };
        return;
      }
    }
  }

  async function trabalhador(): Promise<void> {
    while (proximo < total) {
      const i = proximo++;
      await umItem(i);
      terminados++;
      aoProgredir?.(terminados, total);
    }
  }

  const n = Math.max(1, Math.min(Math.floor(concorrencia), total));
  await Promise.all(Array.from({ length: total === 0 ? 0 : n }, trabalhador));

  const feitos: T[] = [];
  const falhas: FalhaDeLote<T>[] = [];
  estado.forEach((s, i) => {
    const item = itens[i] as T;
    if (s?.ok) feitos.push(item);
    else falhas.push({ item, motivo: s?.motivo ?? "" });
  });
  return { feitos, falhas };
}
