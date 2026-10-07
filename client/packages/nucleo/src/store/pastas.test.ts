import { beforeEach, describe, expect, it } from "vitest";

import {
  alternarColapsoDaPasta,
  colapsarPastasAoTrocarDeServidor,
  corDePastaValida,
  criarPasta,
  editarPasta,
  lerPastas,
  limparPastas,
} from "./pastas";

const A = "01SRV0000000000000000000A";
const B = "01SRV0000000000000000000B";
const C = "01SRV0000000000000000000C";

beforeEach(() => {
  limparPastas();
  localStorage.clear();
});

describe("corDePastaValida", () => {
  it("aceita hex de SEIS dígitos e recusa o resto", () => {
    expect(corDePastaValida("#35C2CC")).toBe(true);
    expect(corDePastaValida("#35c2cc")).toBe(true);
    /*
      ⚠ A recusa é de SEGURANÇA, não de gosto: a cor sai do `localStorage` e
      vai para uma custom property lida por `color-mix`. `var(--…)` leria os
      tokens do app, e `rgb()`/`url()` abrem o que chega ao CSS — a mesma
      família do `colour` de cargo, que o projeto reconstrói de números.
    */
    expect(corDePastaValida("#35c")).toBe(false);
    expect(corDePastaValida("var(--vx-accent)")).toBe(false);
    expect(corDePastaValida("rgb(1,2,3)")).toBe(false);
    expect(corDePastaValida("red")).toBe(false);
    expect(corDePastaValida(42)).toBe(false);
  });
});

describe("editarPasta", () => {
  it("aceita hex livre — o `＋` do design não é um sexto swatch", () => {
    criarPasta("Trabalho", [A, B]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { cor: "#123456" });
    expect(lerPastas()[0]!.cor).toBe("#123456");
  });

  it("cor inválida mantém a anterior em vez de virar o padrão", () => {
    criarPasta("Trabalho", [A, B]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { cor: "#123456" });
    editarPasta(id, { cor: "javascript:alert(1)" });
    expect(lerPastas()[0]!.cor).toBe("#123456");
  });

  it("grava a lista de servidores — é como o modal adia o `Remover`", () => {
    criarPasta("Trabalho", [A, B, C]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { servidores: [C, A] });
    expect(lerPastas()[0]!.servidores).toEqual([C, A]);
  });

  it("ID que não estava dentro é IGNORADO", () => {
    /* O editor não é caminho de entrada. Aceitar um ID qualquer daqui
       deixaria o mesmo servidor em duas pastas — o estado que
       `moverParaPasta` tira-antes-de-pôr existe para impedir. */
    criarPasta("Trabalho", [A]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { servidores: [A, B] });
    expect(lerPastas()[0]!.servidores).toEqual([A]);
  });

  it("esvaziar a lista DESFAZ a pasta", () => {
    criarPasta("Trabalho", [A, B]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { servidores: [] });
    expect(lerPastas()).toHaveLength(0);
  });
});

describe("colapsarPastasAoTrocarDeServidor", () => {
  it("fecha as pastas que NÃO contêm o servidor aberto", () => {
    criarPasta("Trabalho", [A]);
    criarPasta("Jogos", [B]);
    colapsarPastasAoTrocarDeServidor(B);

    const [trabalho, jogos] = lerPastas();
    expect(trabalho?.colapsada).toBe(true);
    expect(jogos?.colapsada).toBe(false);
  });

  it("NÃO abre a pasta de destino", () => {
    /* Abrir seria o app desfazer um colapso que alguém acabou de pedir. */
    criarPasta("Jogos", [B]);
    const id = lerPastas()[0]!.id;
    alternarColapsoDaPasta(id);
    expect(lerPastas()[0]!.colapsada).toBe(true);

    colapsarPastasAoTrocarDeServidor(B);
    expect(lerPastas()[0]!.colapsada).toBe(true);
  });

  it("`sempreExpandida` vence — é o que o interruptor promete", () => {
    /*
      ⚠ Este é o teste que dá SENTIDO ao interruptor. Antes do colapso
      automático existir, "Mostrar sempre expandida" só bloqueava o colapso
      MANUAL: prometia ignorar uma regra que o app não tinha.
    */
    criarPasta("Trabalho", [A]);
    const id = lerPastas()[0]!.id;
    editarPasta(id, { sempreExpandida: true });

    colapsarPastasAoTrocarDeServidor(B);
    expect(lerPastas()[0]!.colapsada).toBe(false);
  });

  it("nada a fazer NÃO grava — senão todo clique republicaria o rail", () => {
    criarPasta("Jogos", [B]);
    const antes = lerPastas();
    colapsarPastasAoTrocarDeServidor(B);
    expect(lerPastas()).toBe(antes);
  });
});
