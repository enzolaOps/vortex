import { describe, expect, it, vi } from "vitest";

import { createEntityStore } from "./entities";

/**
 * O store externo é a peça onde a lei nº 1 vive. Estes testes cobrem as três
 * propriedades que, quando quebram, não dão erro — só degradam.
 */
describe("store de entidade", () => {
  it("devolve a MESMA referência enquanto nada muda", () => {
    const store = createEntityStore<{ texto: string }>();
    store.set("a", { texto: "oi" });

    // A armadilha nº 1 do projeto: `useSyncExternalStore` compara por
    // `Object.is` a cada render. Getter que aloca vira loop infinito, e o
    // sintoma é a aba travando, não um erro no console.
    expect(Object.is(store.getSnapshot("a"), store.getSnapshot("a"))).toBe(true);
  });

  it("troca de referência quando a entidade muda", () => {
    const store = createEntityStore<{ texto: string }>();
    store.set("a", { texto: "antes" });
    const antes = store.getSnapshot("a");
    store.set("a", { texto: "depois" });

    expect(Object.is(antes, store.getSnapshot("a"))).toBe(false);
  });

  it("assina o SDK uma vez só, por mais assinantes que cheguem", () => {
    const assinar = vi.fn(() => vi.fn());
    const store = createEntityStore<number>(assinar);

    const sair1 = store.subscriber("a")(() => {});
    const sair2 = store.subscriber("a")(() => {});
    const sair3 = store.subscriber("b")(() => {});

    expect(assinar).toHaveBeenCalledTimes(2);
    expect(assinar).toHaveBeenCalledWith("a");
    expect(assinar).toHaveBeenCalledWith("b");

    sair1();
    sair2();
    sair3();
  });

  it("é idempotente sob StrictMode", () => {
    const desfazer = vi.fn();
    const assinar = vi.fn(() => desfazer);
    const store = createEntityStore<number>(assinar);

    // StrictMode invoca effects duas vezes em dev. Numa app 100% websocket
    // isso geraria listener duplicado e mensagem dobrada — a defesa é o
    // refcount aqui, não um flag no componente.
    const sair1 = store.subscriber("a")(() => {});
    sair1();
    const sair2 = store.subscriber("a")(() => {});

    expect(assinar).toHaveBeenCalledTimes(2);
    expect(desfazer).toHaveBeenCalledTimes(1);

    sair2();
    expect(desfazer).toHaveBeenCalledTimes(2);
  });

  it("solta a subscrição do SDK quando o último assinante sai", () => {
    const desfazer = vi.fn();
    const store = createEntityStore<number>(() => desfazer);

    const sair1 = store.subscriber("a")(() => {});
    const sair2 = store.subscriber("a")(() => {});

    sair1();
    expect(desfazer).not.toHaveBeenCalled();

    sair2();
    expect(desfazer).toHaveBeenCalledTimes(1);
  });

  it("mantém o snapshot em cache depois que o último assinante sai", () => {
    const store = createEntityStore<{ texto: string }>();
    const sair = store.subscriber("a")(() => {});
    store.set("a", { texto: "oi" });
    sair();

    // Descartar aqui garante que toda remontagem de linha começa em
    // `undefined` — e numa lista virtualizada isso mede altura zero e
    // realimenta o virtualizador até travar a aba. O que vaza é o efeito,
    // não o objeto.
    expect(store.getSnapshot("a")).toEqual({ texto: "oi" });
  });

  it("avisa só quem assina aquele id", () => {
    const store = createEntityStore<number>();
    const ouvinteA = vi.fn();
    const ouvinteB = vi.fn();

    store.subscriber("a")(ouvinteA);
    store.subscriber("b")(ouvinteB);
    store.set("a", 1);

    // Editar uma mensagem toca uma linha, não a lista.
    expect(ouvinteA).toHaveBeenCalledTimes(1);
    expect(ouvinteB).not.toHaveBeenCalled();
  });
});
