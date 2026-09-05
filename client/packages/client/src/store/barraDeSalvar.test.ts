import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarBarraDeSalvar,
  definirBarraDeSalvar,
  lerBarraDeSalvar,
} from "./barraDeSalvar";

/**
 * A barra de salvar, publicada pela página e desenhada pela casca.
 *
 * ⚠ **A regra que estas asserções guardam é de CUSTO, e ela é invisível.** A
 * página publica de dentro de um efeito que roda a cada tecla digitada no
 * formulário. Sem a comparação por campo, cada caractere emitiria e acordaria
 * a casca de configurações inteira — e nada falharia: a tela ficaria certa,
 * só cara.
 */

const nada = () => undefined;

beforeEach(() => {
  definirBarraDeSalvar(undefined);
});

describe("barra de salvar", () => {
  it("nasce ausente", () => {
    expect(lerBarraDeSalvar()).toBeUndefined();
  });

  it("publicar avisa quem assina", () => {
    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));

    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });
    expect(avisos).toBe(1);
    expect(lerBarraDeSalvar()).toBeDefined();

    parar();
  });

  /*
    ⚠ O caso que a comparação existe para cobrir: o efeito da página republica
    o MESMO conteúdo a cada render, e isso não pode custar nada.
  */
  it("publicar o mesmo conteúdo NÃO avisa de novo", () => {
    const a = { aoDescartar: nada, aoSalvar: nada, salvando: false };
    definirBarraDeSalvar(a);

    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));

    /* Objeto NOVO com os mesmos campos — é o que um efeito produz. */
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });
    expect(avisos).toBe(0);

    parar();
  });

  it("mudar o estado de salvando avisa", () => {
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });

    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));

    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: true });
    expect(avisos).toBe(1);
    expect(lerBarraDeSalvar()?.salvando).toBe(true);

    parar();
  });

  /*
    ⚠ **A referência precisa ser estável entre leituras**, senão o
    `useSyncExternalStore` entra em laço — a armadilha nº 1 do briefing. Duas
    leituras seguidas sem publicação têm de devolver o mesmo objeto.
  */
  it("duas leituras seguidas devolvem a MESMA referência", () => {
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });
    expect(lerBarraDeSalvar()).toBe(lerBarraDeSalvar());
  });

  it("retirar avisa e volta a ausência", () => {
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });

    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));

    definirBarraDeSalvar(undefined);
    expect(avisos).toBe(1);
    expect(lerBarraDeSalvar()).toBeUndefined();

    parar();
  });

  it("retirar duas vezes avisa uma vez", () => {
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });
    definirBarraDeSalvar(undefined);

    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));
    definirBarraDeSalvar(undefined);
    expect(avisos).toBe(0);

    parar();
  });

  it("quem parou de assinar não é avisado", () => {
    let avisos = 0;
    const parar = assinarBarraDeSalvar(() => (avisos += 1));
    parar();
    definirBarraDeSalvar({ aoDescartar: nada, aoSalvar: nada, salvando: false });
    expect(avisos).toBe(0);
  });

  it("as ações chegam de volta intactas", () => {
    const salvar = vi.fn();
    const descartar = vi.fn();
    definirBarraDeSalvar({ aoDescartar: descartar, aoSalvar: salvar, salvando: false });

    lerBarraDeSalvar()?.aoSalvar();
    lerBarraDeSalvar()?.aoDescartar();
    expect(salvar).toHaveBeenCalledOnce();
    expect(descartar).toHaveBeenCalledOnce();
  });
});
