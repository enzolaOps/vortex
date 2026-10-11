import "../arnes/redeFalsa";
import { useEffect, useState } from "react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";

import { shell } from "../textos";
import { Avatar } from "../ui/ds";
import { desmontar, montar, pegar } from "../ui/ds/montar";
import { LimiteDeErro } from "./LimiteDeErro";
import { ShellDoApp } from "./ShellDoApp";

afterEach(desmontar);

let quebrar = true;
let montagens = 0;

function Quebra() {
  if (quebrar) throw new Error("detalhe técnico secreto");
  useEffect(() => {
    montagens += 1;
  }, []);
  return <p data-testid="saudavel">tudo certo</p>;
}

describe("limite de erro por região", () => {
  it("a região que lança mostra a frase, esconde o erro técnico e o resto segue de pé", async () => {
    await page.viewport(1280, 800);
    quebrar = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const alvo = montar(<ShellDoApp dock={<p data-testid="dock-viva">dock</p>} area={<Quebra />} />);

    expect(alvo.textContent).toContain(shell.erro.frase);
    expect(alvo.textContent).not.toContain("detalhe técnico secreto");
    expect(pegar('[data-testid="dock-viva"]')).not.toBeNull();
    expect(pegar('[data-testid="shell-grade"]')).not.toBeNull();

    quebrar = false;
    const antes = montagens;
    (Array.from(alvo.querySelectorAll("button")).find((b) => b.textContent === "Tentar de novo"))!.click();
    await vi.waitFor(() => {
      expect(pegar('[data-testid="saudavel"]')).not.toBeNull();
    });
    expect(montagens).toBeGreaterThan(antes);
    log.mockRestore();
  });

  it("trocar de lugar (chave) limpa o erro sem clicar em nada", async () => {
    quebrar = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Pai() {
      const [chave, setChave] = useState("a");
      return (
        <>
          <button
            type="button"
            data-testid="trocar"
            onClick={() => {
              quebrar = false;
              setChave("b");
            }}
          >
            trocar
          </button>
          <LimiteDeErro chave={chave}>
            <Quebra />
          </LimiteDeErro>
        </>
      );
    }
    const alvo = montar(<Pai />);
    expect(alvo.textContent).toContain(shell.erro.frase);
    pegar<HTMLButtonElement>('[data-testid="trocar"]')!.click();
    await vi.waitFor(() => {
      expect(pegar('[data-testid="saudavel"]')).not.toBeNull();
    });
    log.mockRestore();
  });

  it("avatar com nome vazio ou ausente renderiza ? e não lança", () => {
    const alvo = montar(
      <>
        <Avatar nome={undefined} />
        <Avatar nome="" />
      </>,
    );
    const avatares = alvo.querySelectorAll('[role="img"]');
    expect(avatares).toHaveLength(2);
    expect(avatares[0]!.textContent).toBe("?");
  });
});
