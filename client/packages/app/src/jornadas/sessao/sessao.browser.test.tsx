import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { useEffect, useState } from "react";
import {
  dentro,
  desativada,
  entrando,
  erro,
  fora,
  limparSessao,
  precisaDeMfa,
  precisaDeNome,
  type EstadoDaSessao,
} from "nucleo/store/sessao";

import { sessao } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { reiniciarEncerramento, encerrarSessao } from "./encerrar";
import { BotaoDeSair } from "./BotaoDeSair";
import { PortaoDeSessao } from "./PortaoDeSessao";
import { ShellDoApp } from "../../shell";
import { TelaDeContaDesativada } from "./TelaDeContaDesativada";
import { TelaDeEntrada } from "./TelaDeEntrada";
import { TelaDeMfa } from "./TelaDeMfa";
import { TelaDeNome } from "./TelaDeNome";
import { TelaDeRestauracao } from "./TelaDeRestauracao";

afterEach(() => {
  desmontar();
  limparSessao();
  reiniciarEncerramento();
});

/** Dois quadros: o React já aplicou as mudanças de store feitas fora de `act`. */
const assentar = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
const texto = (alvo: Element | null = document.body) => alvo?.textContent ?? "";
const campo = (rotulo: string) =>
  [...document.querySelectorAll<HTMLInputElement>("input")].find(
    (i) => document.querySelector(`label[for="${i.id}"]`)?.textContent === rotulo,
  );
const alertas = () => [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
const botao = (nome: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === nome);

describe("restaurando (esqueleto do shell)", () => {
  it("tem desenho próprio, ocupado, com aviso de estado e sem nenhum controle", () => {
    montar(<TelaDeRestauracao />);
    const raiz = pegar('[data-testid="restaurando"]')!;
    expect(raiz.getAttribute("aria-busy")).toBe("true");
    expect(pegar('[role="status"]')?.textContent).toBe(sessao.restaurando.mensagem);
    // A grade real do shell, para o conteúdo entrar no mesmo lugar sem salto.
    expect(pegar('[data-testid="shell-grade"]')).not.toBeNull();
    // Não se faz passar pelo shell de verdade (E2E e testes esperam o `shell`).
    expect(pegar('[data-testid="shell"]')).toBeNull();
    expect(raiz.querySelectorAll("input, a[href], [tabindex]").length).toBe(0);
    expect(pegar("h1")).toBeNull();
  });
});

describe("entrada", () => {
  const props = {
    entrando: false,
    aoEntrar: () => undefined,
    aoRecuperarSenha: () => undefined,
    aoCriarConta: () => undefined,
    aoEntrarComQr: () => undefined,
  };

  it("mostra os campos, o revelar senha e Manter conectado marcado", () => {
    montar(<TelaDeEntrada {...props} />);
    expect(pegar("h1")?.textContent).toBe(sessao.entrada.titulo);
    expect(campo(sessao.entrada.identificador)).toBeDefined();
    expect(campo(sessao.entrada.senha)?.type).toBe("password");
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(texto()).toContain(sessao.entrada.manterConectado);
    expect(alertas()).toEqual([]);
    expect(document.activeElement).toBe(campo(sessao.entrada.identificador));
  });

  it("esqueci a senha, criar conta e entrar com QR levam a algum lugar (nenhum controle sem destino)", async () => {
    const aoRecuperarSenha = vi.fn();
    const aoCriarConta = vi.fn();
    const aoEntrarComQr = vi.fn();
    montar(<TelaDeEntrada {...props} {...{ aoRecuperarSenha, aoCriarConta, aoEntrarComQr }} />);
    const nomes = [...document.querySelectorAll("button, a")].map((e) => e.getAttribute("aria-label") ?? e.textContent);
    expect(nomes.sort()).toEqual(
      [
        sessao.entrada.entrar,
        sessao.entrada.mostrarSenha,
        sessao.entrada.esqueciASenha,
        sessao.entrada.comQr,
        sessao.entrada.criarConta,
      ].sort(),
    );
    await userEvent.click(botao(sessao.entrada.esqueciASenha)!);
    await userEvent.click(botao(sessao.entrada.criarConta)!);
    await userEvent.click(botao(sessao.entrada.comQr)!);
    expect(aoRecuperarSenha).toHaveBeenCalledOnce();
    expect(aoCriarConta).toHaveBeenCalledOnce();
    expect(aoEntrarComQr).toHaveBeenCalledOnce();
  });

  it("revelar senha alterna o tipo do campo e anuncia o estado", async () => {
    montar(<TelaDeEntrada {...props} />);
    const revelar = page.getByRole("button", { name: sessao.entrada.mostrarSenha });
    await revelar.click();
    expect(campo(sessao.entrada.senha)?.type).toBe("text");
    expect(revelar.element().getAttribute("aria-pressed")).toBe("true");
    await revelar.click();
    expect(campo(sessao.entrada.senha)?.type).toBe("password");
  });

  it("entrar fica desabilitado até haver e-mail e senha", async () => {
    montar(<TelaDeEntrada {...props} />);
    expect(botao(sessao.entrada.entrar)?.disabled).toBe(true);
    await userEvent.fill(campo(sessao.entrada.identificador)!, "rafa");
    expect(botao(sessao.entrada.entrar)?.disabled).toBe(true);
    await userEvent.fill(campo(sessao.entrada.senha)!, "segredo");
    expect(botao(sessao.entrada.entrar)?.disabled).toBe(false);
  });

  it("Enter envia com o que foi digitado e a escolha de Manter conectado", async () => {
    const aoEntrar = vi.fn();
    montar(<TelaDeEntrada {...props} aoEntrar={aoEntrar} />);
    await userEvent.fill(campo(sessao.entrada.identificador)!, "  rafa@exemplo.com ");
    await userEvent.fill(campo(sessao.entrada.senha)!, "segredo");
    await userEvent.click(document.querySelector('input[type="checkbox"]')!);
    await userEvent.keyboard("{Enter}");
    expect(aoEntrar).toHaveBeenCalledExactlyOnceWith("rafa@exemplo.com", "segredo", false);
  });

  it("entrando: botão ocupado com o rótulo dito, campos só de leitura, sem reenvio", () => {
    const aoEntrar = vi.fn();
    montar(<TelaDeEntrada {...props} entrando aoEntrar={aoEntrar} />);
    const b = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (x) => x.getAttribute("aria-busy") === "true",
    )!;
    expect(b.textContent).toBe(sessao.entrada.entrando);
    expect(campo(sessao.entrada.identificador)?.readOnly).toBe(true);
    expect(campo(sessao.entrada.senha)?.readOnly).toBe(true);
    b.click();
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  it("credencial errada marca os dois campos, mantém o digitado e devolve o foco à senha", async () => {
    montar(<EntradaControlada inicial={{ ...props, entrando: false }} />);
    await userEvent.fill(campo(sessao.entrada.identificador)!, "rafa@exemplo.com");
    await userEvent.fill(campo(sessao.entrada.senha)!, "errada");
    controle.trocar?.({ ...props, entrando: true });
    await assentar();
    controle.trocar?.({ ...props, entrando: false, causa: { tipo: "credenciais" } });
    await assentar();
    await expect.poll(() => alertas()).toEqual([sessao.entrada.erro.credenciais]);
    expect(campo(sessao.entrada.identificador)?.value).toBe("rafa@exemplo.com");
    expect(campo(sessao.entrada.senha)?.value).toBe("errada");
    expect(campo(sessao.entrada.identificador)?.getAttribute("aria-invalid")).toBe("true");
    expect(campo(sessao.entrada.senha)?.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(campo(sessao.entrada.senha));
    // A frase está ligada ao campo da senha para o leitor de tela.
    const id = campo(sessao.entrada.senha)!.getAttribute("aria-describedby")!;
    expect(document.getElementById(id)?.textContent).toBe(sessao.entrada.erro.credenciais);
  });

  it.each([
    [{ tipo: "rede" }, sessao.entrada.erro.rede],
    [{ tipo: "servidor" }, sessao.entrada.erro.servidor],
    [{ tipo: "limite", esperaSegundos: 4 }, sessao.entrada.erro.limite(4)],
    [{ tipo: "limite", esperaSegundos: undefined }, sessao.entrada.erro.limiteSemTempo],
    [{ tipo: "naoVerificada" }, sessao.entrada.erro.naoVerificada],
    [{ tipo: "soAutenticador" }, sessao.entrada.erro.soAutenticador],
  ] as const)("falha %j vira aviso no alto e não acusa os campos", (causa, frase) => {
    montar(<TelaDeEntrada {...props} causa={causa} />);
    expect(alertas()).toEqual([frase]);
    expect(campo(sessao.entrada.identificador)?.getAttribute("aria-invalid")).toBeNull();
    expect(campo(sessao.entrada.senha)?.getAttribute("aria-invalid")).toBeNull();
  });

  it("causa desconhecida usa a frase já traduzida; sem nada, a genérica", () => {
    montar(<TelaDeEntrada {...props} causa={{ tipo: "outra" }} motivo="Frase da camada de rede." />);
    expect(alertas()).toEqual(["Frase da camada de rede."]);
    desmontar();
    montar(<TelaDeEntrada {...props} causa={{ tipo: "outra" }} />);
    expect(alertas()).toEqual([sessao.entrada.erro.generico]);
  });

  it("o limite diz os segundos no singular e no plural", () => {
    expect(sessao.entrada.erro.limite(1)).toContain("1 segundo ");
    expect(sessao.entrada.erro.limite(7)).toContain("7 segundos");
  });
});

type PropsDaEntrada = Parameters<typeof TelaDeEntrada>[0];
const controle: { trocar?: (p: PropsDaEntrada) => void } = {};

/** A entrada com props trocáveis de fora, sem remontar: é o que o portão faz entre estados. */
function EntradaControlada({ inicial }: { inicial: PropsDaEntrada }) {
  const [props, setProps] = useState(inicial);
  useEffect(() => {
    controle.trocar = setProps;
  }, []);
  return <TelaDeEntrada {...props} />;
}

describe("segundo fator", () => {
  const props = { verificando: false, incorreto: false, aoVerificar: () => undefined, aoCancelar: () => undefined };

  it("só senha: sem escolha de fator", () => {
    montar(<TelaDeMfa {...props} metodos={["senha"]} />);
    expect(pegar("h1")?.textContent).toBe(sessao.mfa.titulo);
    expect(document.querySelector('[role="group"]')).toBeNull();
    expect(campo(sessao.mfa.senha.rotulo)?.type).toBe("password");
  });

  it("senha e código de recuperação: escolhe o fator e limpa o que foi digitado", async () => {
    const aoVerificar = vi.fn();
    montar(<TelaDeMfa {...props} aoVerificar={aoVerificar} metodos={["senha", "recuperacao"]} />);
    await userEvent.fill(campo(sessao.mfa.senha.rotulo)!, "abc");
    await userEvent.click(botao(sessao.mfa.recuperacao.aba)!);
    expect(campo(sessao.mfa.recuperacao.rotulo)?.value).toBe("");
    expect(campo(sessao.mfa.recuperacao.rotulo)?.getAttribute("autocomplete")).toBe("one-time-code");
    await userEvent.fill(campo(sessao.mfa.recuperacao.rotulo)!, " codigo-1 ");
    await userEvent.keyboard("{Enter}");
    expect(aoVerificar).toHaveBeenCalledExactlyOnceWith("recuperacao", "codigo-1");
  });

  it("verificando: botão ocupado e sem reenvio", () => {
    montar(<TelaDeMfa {...props} verificando metodos={["senha"]} />);
    const ocupado = document.querySelector('button[aria-busy="true"]');
    expect(ocupado?.textContent).toBe(sessao.mfa.verificando);
    expect(botao(sessao.mfa.outraConta)?.disabled).toBe(true);
  });

  it("código incorreto: frase do fator ligada ao campo", () => {
    montar(<TelaDeMfa {...props} incorreto metodos={["recuperacao"]} />);
    expect(alertas()).toEqual([sessao.mfa.recuperacao.incorreto]);
    expect(campo(sessao.mfa.recuperacao.rotulo)?.getAttribute("aria-invalid")).toBe("true");
  });

  it("usar outra conta cancela a verificação", async () => {
    const aoCancelar = vi.fn();
    montar(<TelaDeMfa {...props} aoCancelar={aoCancelar} metodos={["senha"]} />);
    await userEvent.click(botao(sessao.mfa.outraConta)!);
    expect(aoCancelar).toHaveBeenCalledOnce();
  });
});

describe("conta desativada", () => {
  it("tem tela própria, explica e oferece entrar com outra conta", async () => {
    const aoTrocarDeConta = vi.fn();
    montar(<TelaDeContaDesativada aoTrocarDeConta={aoTrocarDeConta} />);
    expect(pegar("h1")?.textContent).toBe(sessao.desativada.titulo);
    expect(texto()).toContain(sessao.desativada.quemResolve);
    expect(document.querySelector("input")).toBeNull();
    await userEvent.click(botao(sessao.desativada.outraConta)!);
    expect(aoTrocarDeConta).toHaveBeenCalledOnce();
  });
});

describe("escolher nome", () => {
  const props = { motivo: undefined, salvando: false, aoEscolher: () => undefined, aoCancelar: () => undefined };

  it("envia o nome sem espaços nas pontas", async () => {
    const aoEscolher = vi.fn();
    montar(<TelaDeNome {...props} aoEscolher={aoEscolher} />);
    await userEvent.fill(campo(sessao.nome.rotulo)!, " rafa ");
    await userEvent.keyboard("{Enter}");
    expect(aoEscolher).toHaveBeenCalledExactlyOnceWith("rafa");
  });

  it("salvando e com erro (nome em uso)", () => {
    montar(<TelaDeNome {...props} salvando motivo="Esse nome de usuário já está em uso." />);
    expect(document.querySelector('button[aria-busy="true"]')?.textContent).toBe(sessao.nome.salvando);
    expect(alertas()).toEqual(["Esse nome de usuário já está em uso."]);
  });
});

describe("portão de sessão", () => {
  const semInicio = () => undefined;
  const filho = <p data-testid="app">dentro do app</p>;

  it("desconhecida mostra o esqueleto e NUNCA a tela de entrada", () => {
    montar(<PortaoDeSessao iniciar={semInicio}>{filho}</PortaoDeSessao>);
    expect(pegar('[data-testid="restaurando"]')).not.toBeNull();
    expect(pegar('[data-testid="tela-de-entrada"]')).toBeNull();
    expect(pegar('[data-testid="app"]')).toBeNull();
  });

  it("sem sessão guardada, restaura e cai na entrada (inicia exatamente uma vez)", async () => {
    const iniciar = vi.fn(() => {
      fora();
    });
    montar(<PortaoDeSessao iniciar={iniciar}>{filho}</PortaoDeSessao>);
    await expect.poll(() => pegar('[data-testid="tela-de-entrada"]')).not.toBeNull();
    expect(iniciar).toHaveBeenCalledTimes(1);
    expect(pegar("h1")?.textContent).toBe(sessao.entrada.titulo);
  });

  it("cada estado da sessão tem a sua tela", async () => {
    montar(<PortaoDeSessao iniciar={semInicio}>{filho}</PortaoDeSessao>);
    const em = async (muda: () => void, confere: () => boolean) => {
      muda();
      await assentar();
      await expect.poll(confere).toBe(true);
    };
    const titulo = () => pegar("h1")?.textContent;

    await em(fora, () => titulo() === sessao.entrada.titulo);
    await em(entrando, () => pegar('button[aria-busy="true"]')?.textContent === sessao.entrada.entrando);
    await em(
      () => erro("x", { tipo: "credenciais" }),
      () => alertas().includes(sessao.entrada.erro.credenciais),
    );
    await em(
      () => precisaDeMfa(["senha"]),
      () => titulo() === sessao.mfa.titulo,
    );
    await em(
      () => precisaDeNome("01U"),
      () => titulo() === sessao.nome.titulo,
    );
    await em(desativada, () => titulo() === sessao.desativada.titulo);
    await em(
      () => dentro("01U"),
      () => pegar('[data-testid="app"]') !== null,
    );
    expect(pegar('[data-testid="tela-de-entrada"]')).toBeNull();
  });

  it("errar a senha mantém o que foi digitado (a mesma tela em outro momento)", async () => {
    montar(<PortaoDeSessao iniciar={semInicio}>{filho}</PortaoDeSessao>);
    fora();
    await assentar();
    await userEvent.fill(campo(sessao.entrada.identificador)!, "rafa@exemplo.com");
    await userEvent.fill(campo(sessao.entrada.senha)!, "errada");
    entrando();
    await assentar();
    erro("x", { tipo: "credenciais" });
    await assentar();
    await expect.poll(() => alertas()).toEqual([sessao.entrada.erro.credenciais]);
    expect(campo(sessao.entrada.identificador)?.value).toBe("rafa@exemplo.com");
    expect(campo(sessao.entrada.senha)?.value).toBe("errada");
  });

  it("toda variante de EstadoDaSessao renderiza algo (o Record cobre a união)", async () => {
    const estados: Record<EstadoDaSessao, () => void> = {
      desconhecida: limparSessao,
      fora,
      entrando,
      erro: () => erro("x"),
      mfa: () => precisaDeMfa(["senha"]),
      nome: () => precisaDeNome("01U"),
      desativada,
      dentro: () => dentro("01U"),
    };
    montar(<PortaoDeSessao iniciar={semInicio}>{filho}</PortaoDeSessao>);
    for (const [estado, muda] of Object.entries(estados)) {
      muda();
      await assentar();
      expect(document.body.textContent?.length, estado).toBeGreaterThan(0);
    }
  });

  it("o servidor derrubar a sessão de quem estava dentro dispara a recarga", async () => {
    const aoSerDerrubada = vi.fn();
    montar(
      <PortaoDeSessao iniciar={semInicio} aoSerDerrubada={aoSerDerrubada}>
        {filho}
      </PortaoDeSessao>,
    );
    dentro("01U");
    await assentar();
    expect(aoSerDerrubada).not.toHaveBeenCalled();
    fora();
    await assentar();
    expect(aoSerDerrubada).toHaveBeenCalledOnce();
  });

  it("cair para a entrada sem nunca ter entrado não recarrega (sem laço)", async () => {
    const aoSerDerrubada = vi.fn();
    montar(
      <PortaoDeSessao iniciar={semInicio} aoSerDerrubada={aoSerDerrubada}>
        {filho}
      </PortaoDeSessao>,
    );
    fora();
    await assentar();
    expect(aoSerDerrubada).not.toHaveBeenCalled();
  });
});

describe("sair", () => {
  it("dentro, o shell real aparece com o Sair no rodapé da coluna de salas", async () => {
    montar(
      <PortaoDeSessao iniciar={() => undefined}>
        <ShellDoApp rodapeDasSalas={<BotaoDeSair />} />
      </PortaoDeSessao>,
    );
    dentro("01U");
    await assentar();
    expect(pegar('[data-testid="shell"]')).not.toBeNull();
    expect(pegar('[data-testid="shell-esqueleto"]')).toBeNull();
    const rodape = [...document.querySelectorAll("aside button")].map((b) => b.textContent);
    expect(rodape).toContain(sessao.sair);
  });

  beforeEach(() => {
    localStorage.setItem("vortex.sessao", JSON.stringify({ _id: "a", token: "tok-secreto", user_id: "01U" }));
  });

  it("apaga a sessão local, devolve à entrada e só recarrega depois; a pessoa que sai não vira 'derrubada'", async () => {
    const recarregar = vi.fn();
    const aoSerDerrubada = vi.fn();
    montar(
      <PortaoDeSessao iniciar={() => undefined} aoSerDerrubada={aoSerDerrubada}>
        <p data-testid="app">dentro</p>
      </PortaoDeSessao>,
    );
    dentro("01U");
    await assentar();
    await encerrarSessao(recarregar);
    await assentar();
    expect(localStorage.getItem("vortex.sessao")).toBeNull();
    expect(sessionStorage.getItem("vortex.sessao")).toBeNull();
    expect(pegar('[data-testid="tela-de-entrada"]')).not.toBeNull();
    expect(recarregar).toHaveBeenCalledOnce();
    expect(aoSerDerrubada).not.toHaveBeenCalled();
  });
});
