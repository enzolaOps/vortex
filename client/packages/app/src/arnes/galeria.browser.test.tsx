import { afterEach, expect, it } from "vitest";

import { desmontar, montar } from "../ui/ds/montar";
import { Galeria } from "./galeria";

afterEach(desmontar);

it("renderiza todos os componentes do DS sem erro e sem estourar a largura", () => {
  const erros: unknown[] = [];
  const antes = console.error;
  console.error = (...a: unknown[]) => erros.push(a);
  try {
    montar(<Galeria />);
  } finally {
    console.error = antes;
  }
  expect(erros).toEqual([]);

  const titulos = Array.from(document.querySelectorAll("h2")).map((h) => h.textContent);
  for (const nome of [
    "PainelVidro",
    "Botao",
    "Pilula",
    "Avatar e PilhaDeAvatares",
    "ItemDeSala",
    "Mensagem e Digitando",
    "CampoDeMensagem",
    "WidgetDaSala",
    "CapsulaDeControle",
    "WidgetDaChamada",
  ]) {
    expect(titulos).toContain(nome);
  }
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 1);
});
