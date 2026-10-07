import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ligarAtalhosDeVoz } from "nucleo/sdk/atalhosDeVoz";
import { abrirConfig, lerConfig, limparConfig } from "nucleo/store/config";
import { ATALHOS_PADRAO, definirAtalho, lerAtalhosDeVoz } from "nucleo/store/atalhosDeVoz";
import { limparMeuStatus, semearMeuStatus } from "nucleo/store/meuStatus";
import {
  definirNotificacoes,
  lerNotificacoes,
} from "nucleo/store/notificacoes";
import {
  definirPreferenciasDeVoz,
  lerPreferenciasDeVoz,
  constraintsDeAudio,
} from "nucleo/store/preferenciasDeVoz";
import { definirSegurando, lerSegurando, microfoneAberto } from "nucleo/store/pushToTalk";
import type { Dispositivo, ResultadoDeConta } from "nucleo/sdk/perfil";

import { config } from "../../textos";
import { definirPersonalizacao, lerPersonalizacao } from "../../tema/personalizado";
import { PERSONALIZACAO_PADRAO } from "../../tema/personalizar";
import { desmontar, montar } from "../../ui/ds/montar";
import { Avisos } from "../../ui/primitivos/Avisos";
import { CascaDeConfig } from "./CascaDeConfig";

interface Controle {
  eu: { displayName: string; username: string; pronomes: string; bio: string; avatarUrl: string | undefined };
  completo: { bio: string; bannerUrl: string | undefined } | undefined;
  email: string | undefined;
  donos: { id: string; nome: string }[];
  chamadas: string[];
  salvo: { nome: string; bio: string | undefined }[];
  recados: string[];
  imagens: { qual: string; id: string | undefined }[];
  uploads: number;
  resultado: ResultadoDeConta;
  dispositivos: readonly Dispositivo[] | undefined;
  devolverFalhaNaLista: boolean;
  senhasUsadas: string[];
  comMidia: boolean;
  lento: Promise<unknown> | undefined;
}

const ctl = vi.hoisted(
  (): Controle => ({
    eu: { displayName: "Rafa", username: "rafa", pronomes: "", bio: "", avatarUrl: undefined },
    completo: { bio: "Oi, sou a Rafa", bannerUrl: undefined },
    email: "rafa@exemplo.com",
    donos: [],
    chamadas: [],
    salvo: [],
    recados: [],
    imagens: [],
    uploads: 0,
    resultado: { ok: true },
    dispositivos: undefined,
    devolverFalhaNaLista: false,
    senhasUsadas: [],
    comMidia: true,
    lento: undefined,
  }),
);

vi.mock("nucleo/sdk/anexos", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  temServidorDeMidia: () => ctl.comMidia,
  subirAnexo: () => {
    ctl.uploads += 1;
    return Promise.resolve("ANEXO1");
  },
}));

vi.mock("nucleo/sdk/perfil", async (original) => {
  const meu = await import("nucleo/store/meuStatus");
  return {
    ...(await original<Record<string, unknown>>()),
    lerMeuPerfil: () => ctl.eu,
    lerMeuPerfilCompleto: () => ctl.lento ?? Promise.resolve(ctl.completo),
    lerMeuEmail: () => Promise.resolve(ctl.email),
    servidoresQueEuDono: () => ctl.donos,
    salvarNomeEBio: (nome: string, bio: string | undefined) => {
      ctl.salvo.push({ nome, bio });
      return Promise.resolve(true);
    },
    definirStatusTexto: (texto: string) => {
      ctl.recados.push(texto);
      meu.definirMeuTextoLocal(texto || undefined);
      return Promise.resolve(true);
    },
    definirPresenca: (p: Parameters<typeof meu.definirMeuStatusLocal>[0]) => {
      meu.definirMeuStatusLocal(p);
      ctl.chamadas.push(`presenca:${p}`);
      return Promise.resolve(true);
    },
    trocarImagemDoPerfil: (qual: string, id: string | undefined) => {
      ctl.imagens.push({ qual, id });
      return Promise.resolve(true);
    },
    trocarSenhaComMotivo: (nova: string, atual: string) => {
      ctl.chamadas.push(`senha:${atual}>${nova}`);
      return Promise.resolve(ctl.resultado);
    },
    trocarEmailComMotivo: (novo: string, senha: string) => {
      ctl.chamadas.push(`email:${novo}:${senha}`);
      return Promise.resolve(ctl.resultado);
    },
    trocarNomeDeUsuarioComMotivo: (novo: string, senha: string) => {
      ctl.chamadas.push(`nome:${novo}:${senha}`);
      return Promise.resolve(ctl.resultado);
    },
    pedirExclusaoComMotivo: (_fator: string, senha: string) => {
      ctl.chamadas.push(`excluir:${senha}`);
      return Promise.resolve(ctl.resultado);
    },
    buscarDispositivos: () => ctl.lento ?? Promise.resolve(ctl.devolverFalhaNaLista ? undefined : ctl.dispositivos),
    derrubarDispositivoComMotivo: (id: string, senha: string) => {
      ctl.chamadas.push(`derrubar:${id}`);
      ctl.senhasUsadas.push(senha);
      return Promise.resolve(senha === "certa" ? OK : ctl.resultado);
    },
    derrubarOutrosComMotivo: (senha: string) => {
      ctl.chamadas.push("derrubarOutros");
      ctl.senhasUsadas.push(senha);
      return Promise.resolve(senha === "certa" ? OK : ctl.resultado);
    },
    renomearDispositivoComMotivo: (id: string, nome: string) => {
      ctl.chamadas.push(`renomear:${id}:${nome}`);
      return Promise.resolve({ ok: true } as ResultadoDeConta);
    },
  };
});

const OK: ResultadoDeConta = { ok: true };
const SENHA_ERRADA: ResultadoDeConta = { ok: false, causa: "senhaIncorreta", motivo: "x" };

beforeEach(async () => {
  await page.viewport(1280, 900);
  ctl.eu = { displayName: "Rafa", username: "rafa", pronomes: "", bio: "", avatarUrl: undefined };
  ctl.completo = { bio: "Oi, sou a Rafa", bannerUrl: undefined };
  ctl.email = "rafa@exemplo.com";
  ctl.donos = [];
  ctl.chamadas = [];
  ctl.salvo = [];
  ctl.recados = [];
  ctl.imagens = [];
  ctl.uploads = 0;
  ctl.resultado = { ok: true };
  ctl.dispositivos = [{ id: "S0", nome: "Este navegador", atual: true, desde: Date.UTC(2026, 0, 5) }];
  ctl.devolverFalhaNaLista = false;
  ctl.senhasUsadas = [];
  ctl.comMidia = true;
  ctl.lento = undefined;
  semearMeuStatus({ presenca: "online", texto: undefined });
});

afterEach(() => {
  desmontar();
  limparConfig();
  limparMeuStatus();
  definirSegurando(false);
  definirAtalho("pushToTalk", ATALHOS_PADRAO.pushToTalk);
  definirPreferenciasDeVoz({
    modo: "deteccao",
    ruido: "padrao",
    entradaId: undefined,
    sensibilidadeAutomatica: true,
    atrasoAoSoltarMs: 120,
    sons: true,
    fundo: "nenhum",
  });
  definirPersonalizacao({ ...PERSONALIZACAO_PADRAO });
  vi.restoreAllMocks();
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
const texto = () => document.body.textContent;
const botao = (nome: string | RegExp) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    typeof nome === "string" ? (b.getAttribute("aria-label") ?? b.textContent) === nome : nome.test(b.getAttribute("aria-label") ?? b.textContent),
  );
const campo = (rotulo: string) =>
  [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select")].find(
    (i) => document.querySelector(`label[for="${i.id}"]`)?.textContent?.startsWith(rotulo) === true,
  );
const alertas = () => [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
const radio = (nome: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((b) => (b.getAttribute("aria-label") ?? b.textContent)?.startsWith(nome));
const interruptor = (nome: string) =>
  document.querySelector<HTMLButtonElement>(`[role="switch"][aria-label="${nome}"]`);

async function abrir(secao: Parameters<typeof abrirConfig>[0] = "perfil") {
  montar(
    <>
      <Avisos />
      <CascaDeConfig />
    </>,
  );
  abrirConfig(secao);
  await assentar();
}

describe("a casca", () => {
  it("abre por cima do shell sem desmontá-lo, e Esc devolve a pessoa ao mesmo lugar", async () => {
    montar(
      <>
        <div data-testid="shell" />
        <CascaDeConfig />
      </>,
    );
    const shell = document.querySelector('[data-testid="shell"]');
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    abrirConfig("conta");
    await assentar();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="shell"]')).toBe(shell);

    await userEvent.keyboard("{Escape}");
    await assentar();
    expect(lerConfig().secao).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[data-testid="shell"]')).toBe(shell);
  });

  it("navega pelas seis seções e marca a atual", async () => {
    await abrir("perfil");
    const nav = document.querySelector(`nav[aria-label="${config.navegacao}"]`)!;
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(config.perfil);
    for (const [secao, nome] of [
      ["conta", config.conta],
      ["sessoes", config.dispositivos],
      ["vozEVideo", config.vozEVideo],
      ["notificacoes", config.notificacoes],
      ["aparencia", config.aparencia],
    ] as const) {
      const item = [...nav.querySelectorAll("button")].find((b) => b.textContent === nome)!;
      await userEvent.click(item);
      await assentar();
      expect(lerConfig().secao).toBe(secao);
      expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe(nome);
      expect(document.querySelector("header h2")?.textContent).toBe(nome);
    }
  });

  it("uma seção que não é desta jornada cai no perfil", async () => {
    await abrir("privacidade");
    await assentar();
    expect(lerConfig().secao).toBe("perfil");
  });
});

describe("perfil", () => {
  it("carrega os dados e só então mostra o formulário", async () => {
    let liberar: (v: unknown) => void = () => undefined;
    ctl.lento = new Promise((r) => {
      liberar = r;
    });
    await abrir();
    expect(texto()).toContain(config.carregando);
    expect(campo(config.perfilTela.sobreVoce)).toBeUndefined();
    liberar({ bio: "Oi", bannerUrl: undefined });
    ctl.lento = undefined;
    await assentar();
    expect((campo(config.perfilTela.sobreVoce) as HTMLTextAreaElement).value).toBe("Oi");
  });

  it("alterações acendem a barra de salvar; descartar volta ao que estava", async () => {
    await abrir();
    expect(texto()).not.toContain(config.barraDeSalvar.recado);
    await userEvent.fill(campo(config.perfilTela.recado)!, "em reunião");
    await assentar();
    expect(texto()).toContain(config.barraDeSalvar.recado);
    await userEvent.click(botao(config.descartarAlteracoes)!);
    await assentar();
    expect((campo(config.perfilTela.recado) as HTMLInputElement).value).toBe("");
    expect(texto()).not.toContain(config.barraDeSalvar.recado);
  });

  it("salva nome, bio e recado, e a barra some", async () => {
    await abrir();
    await userEvent.fill(campo(config.perfilTela.nomeDeExibicao)!, "Rafa Souza");
    await userEvent.fill(campo(config.perfilTela.sobreVoce)!, "Nova bio");
    await userEvent.fill(campo(config.perfilTela.recado)!, "ocupada");
    await userEvent.click(botao(config.salvar)!);
    await assentar();
    expect(ctl.salvo).toEqual([{ nome: "Rafa Souza", bio: "Nova bio" }]);
    expect(ctl.recados).toEqual(["ocupada"]);
    expect(texto()).not.toContain(config.barraDeSalvar.recado);
    expect(texto()).toContain(config.salvouComSucesso);
  });

  it("só o recado alterado não reescreve nome nem bio", async () => {
    await abrir();
    await userEvent.fill(campo(config.perfilTela.recado)!, "almoço");
    await userEvent.click(botao(config.salvar)!);
    await assentar();
    expect(ctl.salvo).toEqual([]);
    expect(ctl.recados).toEqual(["almoço"]);
  });

  it("se a bio não carregou, o campo trava e salvar o nome nunca a apaga", async () => {
    ctl.completo = undefined;
    await abrir();
    const bio = campo(config.perfilTela.sobreVoce) as HTMLTextAreaElement;
    expect(bio.disabled).toBe(true);
    expect(texto()).toContain(config.naoDeuParaCarregar);
    await userEvent.fill(campo(config.perfilTela.nomeDeExibicao)!, "Rafa S");
    await userEvent.click(botao(config.salvar)!);
    await assentar();
    expect(ctl.salvo).toEqual([{ nome: "Rafa S", bio: undefined }]);
  });

  it("a presença vale no clique e a prévia do cartão acompanha", async () => {
    await abrir();
    await userEvent.click(radio(config.perfilTela.presencas.dnd)!);
    await assentar();
    expect(ctl.chamadas).toContain("presenca:dnd");
    expect(radio(config.perfilTela.presencas.dnd)?.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[data-testid="previa-do-cartao"]')?.textContent).toContain(config.perfilTela.presencas.dnd);
  });

  it("trocar a foto envia o arquivo, grava no perfil e mostra a nova imagem sem passar pela barra", async () => {
    await abrir();
    const arquivo = new File([new Uint8Array([137, 80, 78, 71])], "foto.png", { type: "image/png" });
    const seletor = document.querySelector<HTMLInputElement>('[data-testid="seletor-de-foto"]')!;
    const dt = new DataTransfer();
    dt.items.add(arquivo);
    seletor.files = dt.files;
    seletor.dispatchEvent(new Event("change", { bubbles: true }));
    await assentar();
    await expect.poll(() => ctl.imagens).toEqual([{ qual: "avatar", id: "ANEXO1" }]);
    expect(document.querySelector('[data-testid="foto-do-perfil"] img')).not.toBeNull();
    expect(texto()).not.toContain(config.barraDeSalvar.recado);
  });

  it("sem servidor de mídia os botões de imagem ficam desligados e a tela diz por quê", async () => {
    ctl.comMidia = false;
    await abrir();
    expect(botao(config.perfilTela.trocarAvatar)!.disabled).toBe(true);
    expect(botao(config.perfilTela.trocarBanner)!.disabled).toBe(true);
    expect(texto()).toContain(config.perfilTela.semMidia);
  });

  it("não aceita arquivo que não é imagem", async () => {
    await abrir();
    const seletor = document.querySelector<HTMLInputElement>('[data-testid="seletor-de-banner"]')!;
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "nota.txt", { type: "text/plain" }));
    seletor.files = dt.files;
    seletor.dispatchEvent(new Event("change", { bubbles: true }));
    await assentar();
    expect(ctl.uploads).toBe(0);
    expect(texto()).toContain(config.perfilTela.imagemInvalida);
  });
});

describe("conta", () => {
  it("mostra o e-mail escondido e revela sob pedido", async () => {
    await abrir("conta");
    expect(texto()).toContain("r***@exemplo.com");
    expect(texto()).not.toContain("rafa@exemplo.com");
    await userEvent.click(botao(config.contaTela.emailMostrar)!);
    await assentar();
    expect(texto()).toContain("rafa@exemplo.com");
  });

  it("e-mail que não carregou diz que não deu para consultar", async () => {
    ctl.email = undefined;
    await abrir("conta");
    expect(texto()).toContain(config.contaTela.emailIndisponivel);
  });

  it("trocar a senha com a atual errada mostra o erro no campo e limpa a senha digitada", async () => {
    ctl.resultado = SENHA_ERRADA;
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.trocarSenha)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "errada");
    await userEvent.fill(campo(config.contaTela.senhaNova)!, "uma-senha-nova-1");
    await userEvent.fill(campo(config.contaTela.senhaConfirmar)!, "uma-senha-nova-1");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.contaTela.erroSenhaAtual);
    expect((campo(config.contaTela.senhaAtual) as HTMLInputElement).value).toBe("");
    expect(document.querySelector('[role="dialog"] form')).not.toBeNull();
  });

  it("valida senha curta e senhas diferentes antes de ir ao servidor", async () => {
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.trocarSenha)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "atual");
    await userEvent.fill(campo(config.contaTela.senhaNova)!, "curta");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.contaTela.erroSenhaCurta);
    await userEvent.fill(campo(config.contaTela.senhaNova)!, "uma-senha-nova-1");
    await userEvent.fill(campo(config.contaTela.senhaConfirmar)!, "outra-coisa-1");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.contaTela.erroSenhasDiferentes);
    expect(ctl.chamadas).toEqual([]);
  });

  it("troca a senha, fecha o diálogo e avisa", async () => {
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.trocarSenha)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "atual-1234");
    await userEvent.fill(campo(config.contaTela.senhaNova)!, "uma-senha-nova-1");
    await userEvent.fill(campo(config.contaTela.senhaConfirmar)!, "uma-senha-nova-1");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => ctl.chamadas).toEqual(["senha:atual-1234>uma-senha-nova-1"]);
    await assentar();
    expect(texto()).toContain(config.contaTela.senhaTrocada);
    expect(campo(config.contaTela.senhaNova)).toBeUndefined();
  });

  it("e-mail em uso aparece no campo do e-mail", async () => {
    ctl.resultado = { ok: false, causa: "emailEmUso", motivo: "x" };
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.trocarEmail)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.emailNovo)!, "outro@exemplo.com");
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "atual-1234");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.contaTela.erroEmailEmUso);
  });

  it("nome de usuário em uso aparece no campo do nome", async () => {
    ctl.resultado = { ok: false, causa: "nomeEmUso", motivo: "x" };
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.trocarNome)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.nomeDeUsuario)!, "outra");
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "atual-1234");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.contaTela.erroNomeEmUso);
  });

  it("excluir a conta exige o nome de usuário e a senha, e avisa que o e-mail confirma", async () => {
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.excluirBotao)!);
    await assentar();
    await userEvent.fill(campo(config.contaTela.excluirConfirmarNome)!, "outra-pessoa");
    await userEvent.fill(campo(config.contaTela.senhaAtual)!, "atual-1234");
    await userEvent.keyboard("{Enter}");
    await assentar();
    expect(ctl.chamadas).toEqual([]);
    await userEvent.fill(campo(config.contaTela.excluirConfirmarNome)!, "rafa");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => ctl.chamadas).toEqual(["excluir:atual-1234"]);
    await assentar();
    expect(texto()).toContain(config.contaTela.excluirEnviado);
  });

  it("quem é dono de servidor não pode excluir, e a frase diz quantos", async () => {
    ctl.donos = [
      { id: "S1", nome: "Turma" },
      { id: "S2", nome: "Jogos" },
    ];
    await abrir("conta");
    await userEvent.click(botao(config.contaTela.excluirBotao)!);
    await assentar();
    expect(texto()).toContain(config.contaTela.excluirDono(2));
    await userEvent.click(botao(config.contaTela.excluirConfirmar)!);
    await assentar();
    expect(ctl.chamadas).toEqual([]);
  });
});

describe("dispositivos", () => {
  const outros: Dispositivo[] = [
    { id: "S0", nome: "Este navegador", atual: true, desde: Date.UTC(2026, 0, 5) },
    { id: "S1", nome: "Celular", atual: false, desde: Date.UTC(2026, 0, 3) },
    { id: "S2", nome: "Notebook", atual: false, desde: Date.UTC(2026, 0, 2) },
  ];

  it("só a sessão atual: mostra o estado vazio e nenhum botão de desconectar", async () => {
    await abrir("sessoes");
    expect(document.querySelector('[data-testid="dispositivos-vazio"]')).not.toBeNull();
    expect(texto()).toContain(config.dispositivosTela.vazioTitulo);
    expect(botao(config.dispositivosTela.desconectarTodos)).toBeUndefined();
  });

  it("mostra o carregando enquanto a lista não chega", async () => {
    ctl.lento = new Promise<unknown>(() => undefined);
    await abrir("sessoes");
    expect(texto()).toContain(config.dispositivosTela.carregando);
  });

  it("falha ao listar não vira lista vazia: diz o erro e deixa tentar de novo", async () => {
    ctl.devolverFalhaNaLista = true;
    await abrir("sessoes");
    expect(alertas()).toContain(config.naoDeuParaCarregar);
    expect(document.querySelector('[data-testid="dispositivos-vazio"]')).toBeNull();
  });

  it("pede a senha uma vez só e reaproveita para os próximos", async () => {
    ctl.dispositivos = outros;
    await abrir("sessoes");
    await userEvent.click(botao(config.dispositivosTela.desconectarRotulo("Celular"))!);
    await assentar();
    expect(texto()).toContain(config.dispositivosTela.confirmeTitulo);
    await userEvent.fill(campo(config.dispositivosTela.senhaAtual)!, "certa");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => ctl.chamadas).toEqual(["derrubar:S1"]);
    await assentar();
    // Segundo dispositivo: nenhum pedido de senha, a ação roda direto com a guardada.
    await userEvent.click(botao(config.dispositivosTela.desconectarRotulo("Notebook"))!);
    await assentar();
    expect(texto()).not.toContain(config.dispositivosTela.confirmeTitulo);
    await expect.poll(() => ctl.chamadas).toEqual(["derrubar:S1", "derrubar:S2"]);
    expect(ctl.senhasUsadas).toEqual(["certa", "certa"]);
  });

  it("senha errada fica no diálogo, com o erro no campo", async () => {
    ctl.dispositivos = outros;
    ctl.resultado = SENHA_ERRADA;
    await abrir("sessoes");
    await userEvent.click(botao(config.dispositivosTela.desconectarTodos)!);
    await assentar();
    await userEvent.fill(campo(config.dispositivosTela.senhaAtual)!, "errada");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => alertas()).toContain(config.dispositivosTela.senhaErro);
    expect(texto()).toContain(config.dispositivosTela.confirmeTitulo);
  });

  it("derrubar os outros desconecta todos menos este e a lista passa a mostrar só este", async () => {
    ctl.dispositivos = outros;
    await abrir("sessoes");
    await userEvent.click(botao(config.dispositivosTela.desconectarTodos)!);
    await assentar();
    await userEvent.fill(campo(config.dispositivosTela.senhaAtual)!, "certa");
    // O servidor passa a listar só a sessão atual.
    ctl.dispositivos = [outros[0]!];
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => ctl.chamadas).toEqual(["derrubarOutros"]);
    await expect.poll(() => document.querySelector('[data-testid="dispositivos-vazio"]')).not.toBeNull();
  });

  it("renomear um dispositivo não pede senha", async () => {
    ctl.dispositivos = outros;
    await abrir("sessoes");
    await userEvent.click(botao(config.dispositivosTela.renomearRotulo("Celular"))!);
    await assentar();
    await userEvent.fill(campo(config.dispositivosTela.nomeDoDispositivo)!, "Celular da Rafa");
    await userEvent.click(botao(config.dispositivosTela.salvarNome)!);
    await expect.poll(() => ctl.chamadas).toEqual(["renomear:S1:Celular da Rafa"]);
  });
});

describe("voz e vídeo", () => {
  it("escolher o modo pressionar mostra a tecla e o atraso, e guarda a preferência que o motor lê", async () => {
    await abrir("vozEVideo");
    expect(campo(config.vozTela.atrasoAoSoltar)).toBeUndefined();
    await userEvent.click(radio(config.vozTela.pressionar)!);
    await assentar();
    expect(lerPreferenciasDeVoz().modo).toBe("pressionar");
    expect(campo(config.vozTela.atrasoAoSoltar)).toBeDefined();
    expect(document.querySelector('[data-testid="tecla-de-falar"]')?.textContent).toBe("Alt + Espaço");
  });

  it("push-to-talk de verdade: o microfone só abre enquanto a tecla está segurada", async () => {
    ligarAtalhosDeVoz();
    definirPreferenciasDeVoz({ modo: "pressionar", atrasoAoSoltarMs: 0 });
    await abrir("vozEVideo");
    const aberto = () =>
      microfoneAberto({ mudo: false, surdo: false, modo: lerPreferenciasDeVoz().modo, segurando: lerSegurando() });
    expect(aberto()).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", altKey: true, bubbles: true }));
    await assentar();
    expect(lerSegurando()).toBe(true);
    expect(aberto()).toBe(true);
    expect(texto()).toContain(config.vozTela.teclaSegurando);

    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", altKey: true, bubbles: true }));
    await assentar();
    expect(lerSegurando()).toBe(false);
    expect(aberto()).toBe(false);
    expect(texto()).not.toContain(config.vozTela.teclaSegurando);

    // Sem mudar o modo para "pressionar", a mesma tecla não decide mais nada.
    definirPreferenciasDeVoz({ modo: "deteccao" });
    expect(microfoneAberto({ mudo: false, surdo: false, modo: "deteccao", segurando: true })).toBe(true);
  });

  it("gravar outra tecla a aplica no mesmo atalho que o motor escuta, e Esc cancela", async () => {
    definirPreferenciasDeVoz({ modo: "pressionar" });
    await abrir("vozEVideo");
    const mudar = botao(config.vozTela.mudarTecla)!;
    await userEvent.click(mudar);
    await assentar();
    expect(texto()).toContain(config.vozTela.gravandoTecla);

    // Esc cancela a gravação sem fechar as configurações.
    mudar.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
    await assentar();
    expect(lerAtalhosDeVoz().pushToTalk).toEqual(ATALHOS_PADRAO.pushToTalk);
    expect(lerConfig().secao).toBe("vozEVideo");

    await userEvent.click(botao(config.vozTela.mudarTecla)!);
    await assentar();
    botao(config.vozTela.cancelarGravacao)!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }),
    );
    await assentar();
    expect(lerAtalhosDeVoz().pushToTalk).toEqual({ codigo: "KeyK", mod: true, alt: false, shift: false });
    expect(document.querySelector('[data-testid="tecla-de-falar"]')?.textContent).toBe("Ctrl + K");
  });

  it("a mesma tecla de outra ação avisa do conflito", async () => {
    definirAtalho("mutar", ATALHOS_PADRAO.pushToTalk);
    definirPreferenciasDeVoz({ modo: "pressionar" });
    await abrir("vozEVideo");
    expect(alertas()).toContain(config.vozTela.teclaEmConflito);
    definirAtalho("mutar", ATALHOS_PADRAO.mutar);
  });

  it("escolher a supressão de ruído guarda o nível e muda as restrições do microfone", async () => {
    await abrir("vozEVideo");
    await userEvent.click(radio(config.vozTela.ruidoNiveis.desligada)!);
    await assentar();
    expect(lerPreferenciasDeVoz().ruido).toBe("desligada");
    expect(constraintsDeAudio().noiseSuppression).toBe(false);
    expect(texto()).toContain(config.vozTela.ruidoAjuda.desligada);
    await userEvent.click(radio(config.vozTela.ruidoNiveis.agressiva)!);
    await assentar();
    expect(lerPreferenciasDeVoz().ruido).toBe("agressiva");
    expect(constraintsDeAudio().noiseSuppression).toBe(true);
  });

  it("escolher o fundo do vídeo guarda a preferência", async () => {
    await abrir("vozEVideo");
    await userEvent.click(radio(config.vozTela.fundos.desfoque)!);
    await assentar();
    expect(lerPreferenciasDeVoz().fundo).toBe("desfoque");
  });

  it("sem microfone, testar mostra o erro com a frase certa", async () => {
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(new DOMException("x", "NotFoundError"));
    await abrir("vozEVideo");
    await userEvent.click(botao(config.vozTela.testarBotao)!);
    await expect.poll(() => alertas()).toContain(config.vozTela.erroSemDispositivo);
  });

  it("microfone negado e microfone em uso têm frases diferentes", async () => {
    const espiao = vi.spyOn(navigator.mediaDevices, "getUserMedia");
    espiao.mockRejectedValue(new DOMException("x", "NotAllowedError"));
    await abrir("vozEVideo");
    await userEvent.click(botao(config.vozTela.testarBotao)!);
    await expect.poll(() => alertas()).toContain(config.vozTela.erroPermissao);
    // Desliga e liga de novo com outro erro.
    await userEvent.click(botao(config.vozTela.pararTeste)!);
    espiao.mockRejectedValue(new DOMException("x", "NotReadableError"));
    await userEvent.click(botao(config.vozTela.testarBotao)!);
    await expect.poll(() => alertas()).toContain(config.vozTela.erroEmUso);
  });

  it("o teste mede o nível de verdade e fecha a faixa ao parar", async () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const destino = ctx.createMediaStreamDestination();
    osc.connect(destino);
    osc.start();
    const parados: number[] = [];
    for (const t of destino.stream.getTracks()) {
      const parar = t.stop.bind(t);
      t.stop = () => {
        parados.push(1);
        parar();
      };
    }
    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockResolvedValue(destino.stream);
    await abrir("vozEVideo");
    await userEvent.click(botao(config.vozTela.testarBotao)!);
    const medidor = () => Number(document.querySelector('[data-testid="medidor-de-entrada"]')?.getAttribute("data-acesas"));
    await expect.poll(medidor, { timeout: 4000 }).toBeGreaterThan(0);
    await userEvent.click(botao(config.vozTela.pararTeste)!);
    await assentar();
    expect(parados.length).toBeGreaterThan(0);
    expect(medidor()).toBe(0);
    void ctx.close();
  });
});

describe("aparência", () => {
  it("o tema de fábrica é o padrão e não escreve nada no documento", async () => {
    await abrir("aparencia");
    expect(radio(config.aparenciaTela.escuro)?.getAttribute("aria-checked")).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--vx-accent")).toBe("");
    expect(texto()).toContain(config.aparenciaTela.soEscuro);
  });

  it("a paleta personalizada aplica as cores validadas e voltar ao tema de fábrica as remove", async () => {
    await abrir("aparencia");
    await userEvent.click(radio(config.aparenciaTela.personalizado)!);
    await assentar();
    const raiz = document.documentElement.style;
    expect(lerPersonalizacao().ativo).toBe(true);
    const acentoLavanda = raiz.getPropertyValue("--vx-accent");
    expect(acentoLavanda).toMatch(/^#[0-9a-f]{6}$/);

    await userEvent.click(radio(config.aparenciaTela.destaques.menta)!);
    await assentar();
    expect(raiz.getPropertyValue("--vx-accent")).not.toBe(acentoLavanda);
    expect(radio(config.aparenciaTela.destaques.menta)?.getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector('[data-testid="previa-da-paleta"]')).not.toBeNull();

    const base = raiz.getPropertyValue("--vx-backdrop-base");
    const matiz = campo(config.aparenciaTela.matiz) as HTMLInputElement;
    await userEvent.fill(matiz, "120");
    await assentar();
    expect(raiz.getPropertyValue("--vx-backdrop-base")).not.toBe(base);

    await userEvent.click(radio(config.aparenciaTela.escuro)!);
    await assentar();
    expect(raiz.getPropertyValue("--vx-accent")).toBe("");
    expect(raiz.getPropertyValue("--vx-backdrop-base")).toBe("");
  });

  it("a escolha fica guardada para a próxima abertura", async () => {
    await abrir("aparencia");
    await userEvent.click(radio(config.aparenciaTela.personalizado)!);
    await userEvent.click(radio(config.aparenciaTela.destaques.rosa)!);
    await assentar();
    const guardado = JSON.parse(localStorage.getItem("vortex:tema-personalizado") ?? "{}") as Record<string, unknown>;
    expect(guardado).toMatchObject({ ativo: true, destaque: "rosa" });
  });
});

describe("notificações", () => {
  it("só lista os eventos que o app dispara hoje", async () => {
    await abrir("notificacoes");
    const rotulos = [...document.querySelectorAll('[role="switch"]')].map((s) => s.getAttribute("aria-label"));
    expect(rotulos).toContain(config.notificacoesTela.notificacaoDe("Mensagem direta"));
    expect(rotulos).not.toContain(config.notificacoesTela.notificacaoDe("Chamada recebida"));
    expect(rotulos).not.toContain(config.notificacoesTela.notificacaoDe("Evento do servidor"));
  });

  it("cada interruptor escreve na matriz que o notificador consulta", async () => {
    await abrir("notificacoes");
    const som = interruptor(config.notificacoesTela.somDe("Mensagem em canal"))!;
    expect(som.getAttribute("aria-checked")).toBe("false");
    await userEvent.click(som);
    await assentar();
    expect(lerNotificacoes().matriz.has("mensagem:som")).toBe(true);
    expect(interruptor(config.notificacoesTela.somDe("Mensagem em canal"))?.getAttribute("aria-checked")).toBe("true");

    const toast = interruptor(config.notificacoesTela.notificacaoDe("Mensagem em canal"))!;
    await userEvent.click(toast);
    await assentar();
    expect(lerNotificacoes().matriz.has("mensagem:toast")).toBe(false);
    definirNotificacoes({ matriz: new Set(["mensagem:toast"]) });
  });

  it("o interruptor dos sons das salas escreve a preferência de voz", async () => {
    await abrir("notificacoes");
    await userEvent.click(interruptor(config.notificacoesTela.sonsDeVoz)!);
    await assentar();
    expect(lerPreferenciasDeVoz().sons).toBe(false);
  });
});
