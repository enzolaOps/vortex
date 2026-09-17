import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  ⚠ **`window`, e só NESTE arquivo.**

  `src/testes/documento.ts` instala `document`, `localStorage` e `fetch` — e a
  doutrina dele é explícita: *"instala a única peça que faltava e não mexe em
  mais nada"*. `react-dom/client` precisa de `window` (ele lê `window.event`
  para decidir a prioridade do update), e pôr isso no setup GLOBAL mudaria o
  ramo que todo módulo com `typeof window` escolhe — o app tem vários, e o
  sintoma seria uma suíte distante trocando de caminho sem ninguém notar.

  Aqui o custo é local e o Vitest isola por arquivo.
*/
(globalThis as { window?: unknown }).window ??= document.defaultView;

/**
 * A guarda das ENTIDADES: cada menu, com permissão cheia e vazia.
 *
 * ⚠ **O que ela protege é a ORDEM e os BLOCOS, e os dois são invisíveis em
 * typecheck.** Um item destrutivo que sobe para o meio do menu fica onde se
 * clica sem querer ao mirar o de cima; o `ItemDeId` deixar de ser o último
 * quebra a convenção que todos os menus do app seguem; e um item
 * administrativo que aparece sem permissão é a regra do briefing sendo
 * desfeita — nenhum dos três dá erro, e nenhum aparece em revisão de código
 * que não abra a tela.
 *
 * ⚠ **Os primitivos do Radix são DUBLADOS, e isso é o ponto.** Com eles de
 * verdade o teste precisaria de `Root`, `Anchor` e `Portal` montados, e
 * passaria a medir o Radix; o que este arquivo mede é a LISTA que nós
 * escrevemos. Cada dublê vira um elemento chato com um `data-` que diz o que
 * ele é, e o teste lê a sequência.
 */

vi.mock("../components/ui/ContextMenu", () => {
  const item = (tipo: string) =>
    function Item(props: Record<string, unknown>) {
      const { children, perigo, aviso, disabled, marcado } = props as {
        children?: unknown;
        perigo?: boolean;
        aviso?: boolean;
        disabled?: boolean;
        marcado?: boolean;
      };
      return (
        <div
          data-tipo={tipo}
          data-perigo={perigo === true ? "" : undefined}
          data-aviso={aviso === true ? "" : undefined}
          data-desabilitado={disabled === true ? "" : undefined}
          data-marcado={marcado === true ? "" : undefined}
        >
          {children as never}
        </div>
      );
    };
  return {
    ContextMenu: item("root"),
    ContextMenuTrigger: item("trigger"),
    ContextMenuContent: item("content"),
    ContextMenuItem: item("item"),
    ContextMenuCheckboxItem: item("checkbox"),
    ContextMenuSeparator: item("separador"),
    ContextMenuLabel: item("rotulo"),
    ContextMenuSub: item("sub"),
    ContextMenuSubTrigger: item("subgatilho"),
    ContextMenuSubContent: item("subconteudo"),
  };
});

/** `ItemDeId` vira um marcador próprio — é ele que precisa ser o último. */
vi.mock("../components/ui/ItemDeId", () => ({
  ItemDeId: ({ id }: { id: string }) => <div data-tipo="id">{id}</div>,
}));

/*
  A permissão, ligada e desligada pelo teste.

  ⚠ **`podeNoServidor` junto**, senão o menu do servidor cairia no caminho de
  "não há canal a que perguntar" e responderia por outra função — e o teste de
  permissão vazia passaria por acidente.
*/
let permitir = true;
vi.mock("../sdk/permissoes", () => ({
  pode: () => permitir,
  podeNoServidor: () => permitir,
}));

vi.mock("../sdk/adapter", () => ({
  marcarCanalLido: () => undefined,
  usuarioLocalId: () => "eu",
  categorias: {
    getSnapshot: () => [{ id: "cat", titulo: "Geral", canais: ["c1"] }],
  },
}));

vi.mock("../store/hooks", () => ({
  useChannel: (id: string) =>
    id === ""
      ? undefined
      : {
          id,
          name: "produto",
          tipo: id === "voz1" ? "voz" : id === "dm1" ? "dm" : "texto",
          serverId: id.startsWith("dm") ? undefined : "s1",
          naoLidas: 3,
          destinatarioId: id.startsWith("dm") ? "u2" : undefined,
        },
  useServer: () => ({ id: "s1", name: "Vortex", sigla: "VX" }),
}));

vi.mock("../store/perfilDoServidor", () => ({
  usePerfilDoServidor: () => ({ tag: undefined }),
  useExibeTag: () => false,
}));

import { ItensDaConversa } from "./ItensDaConversa";
import { ItensDoCanal } from "./ItensDoCanal";
import { ItensDoServidor } from "./ItensDoServidor";
import { limparSilencio } from "../store/silencio";

let alvo: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  limparSilencio();
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
});

afterEach(() => {
  act(() => {
    raiz.unmount();
  });
  alvo.remove();
});

/** A sequência de tipos, na ordem em que o menu os desenha. */
function desenhar(no: React.ReactNode): HTMLElement[] {
  act(() => {
    raiz.render(no);
  });
  return [...alvo.querySelectorAll<HTMLElement>("[data-tipo]")];
}

function tipos(nos: readonly HTMLElement[]): string[] {
  return nos.map((n) => n.dataset.tipo ?? "");
}

/**
 * Os rótulos dos itens.
 *
 * ⚠ **O ATALHO viaja junto no `textContent`** — "Copiar link" com `⇧⌘C` ao
 * lado sai como uma string só. Comparar por `startsWith` é o certo: o atalho é
 * escrito pela plataforma (`⌘` no Mac, `Ctrl+` no resto), e um teste que
 * casasse a string inteira passaria num sistema e reprovaria no outro.
 */
function textos(nos: readonly HTMLElement[]): string[] {
  return nos
    .filter((n) => n.dataset.tipo === "item" || n.dataset.tipo === "checkbox")
    .map((n) => n.textContent?.trim() ?? "");
}

function tem(rotulos: readonly string[], texto: string): boolean {
  return rotulos.some((r) => r.startsWith(texto));
}

/**
 * As três regras que valem para TODO menu deste app.
 *
 * Uma função e não três testes por entidade: com três, acrescentar uma
 * entidade exigiria lembrar de escrever as três de novo — e a que fosse
 * esquecida seria justamente a do menu novo.
 */
function conferirRegrasGerais(nos: readonly HTMLElement[]): void {
  const seq = tipos(nos);

  /* 1. `ItemDeId` é o ÚLTIMO. É a convenção de todo menu do app, e ela vale
        para que a posição do "Copiar ID" não precise ser procurada. */
  expect(seq.at(-1)).toBe("id");
  expect(seq.filter((t) => t === "id")).toHaveLength(1);

  /*
    2. O que é PERIGO fica no fim DO BLOCO dele.

    ⚠ **A regra nasceu mais forte — "perigo é o último do menu" — e o teste a
    desmentiu no primeiro menu de DM.** O design põe "Desfazer amizade" e
    "Bloquear" em vermelho num bloco e "Fechar conversa" NUM BLOCO DEPOIS, sem
    ser vermelho: fechar uma conversa não destrói nada, é tirá-la da coluna.
    A invariante verdadeira é local ao bloco, e é a que protege o que
    importa — clicar em destruir ao mirar o item de cima.
  */
  let inicio = 0;
  const blocos: HTMLElement[][] = [];
  const itens = nos.filter((n) => n.dataset.tipo !== "content");
  itens.forEach((n, i) => {
    if (n.dataset.tipo === "separador") {
      blocos.push(itens.slice(inicio, i));
      inicio = i + 1;
    }
  });
  blocos.push(itens.slice(inicio));

  for (const bloco of blocos) {
    const ultimoComum = bloco.reduce(
      (acc, n, i) =>
        n.dataset.tipo === "item" && n.dataset.perigo === undefined ? i : acc,
      -1,
    );
    bloco.forEach((n, i) => {
      if (n.dataset.perigo !== undefined) expect(i).toBeGreaterThan(ultimoComum);
    });
  }

  /* 3. Menu nunca é VAZIO. É a invariante da onda 1.5A vista do outro lado:
        lá o gatilho recusa abrir sem alvo; aqui o conteúdo recusa ficar sem
        itens. Um menu de um item só ainda é um menu; zero não é. */
  expect(nos.filter((n) => n.dataset.tipo === "item").length).toBeGreaterThan(0);

  /* 4. Nenhum separador ENCOSTA noutro nem abre o menu: régua dupla é ruído,
        e régua no topo desenha uma linha sem nada acima dela. */
  const semConteudo = seq.filter((t) => t !== "content");
  expect(semConteudo[0]).not.toBe("separador");
  for (let i = 1; i < semConteudo.length; i++) {
    if (semConteudo[i] === "separador") {
      expect(semConteudo[i - 1]).not.toBe("separador");
    }
  }
}

describe("menu do CANAL", () => {
  it("com permissão cheia: administração presente, perigo por último", () => {
    permitir = true;
    const nos = desenhar(<ItensDoCanal channelId="c1" />);
    conferirRegrasGerais(nos);

    const rotulos = textos(nos);
    expect(rotulos[0]?.startsWith("Marcar como lida")).toBe(true);
    expect(tem(rotulos, "Editar canal")).toBe(true);
    expect(tem(rotulos, "Criar convite")).toBe(true);
    expect(tem(rotulos, "Copiar link")).toBe(true);
    expect(rotulos.at(-1)?.startsWith("Apagar canal")).toBe(true);
  });

  it("sem permissão: o bloco administrativo SOME, não fica cinza", () => {
    permitir = false;
    const nos = desenhar(<ItensDoCanal channelId="c1" />);
    conferirRegrasGerais(nos);

    const rotulos = textos(nos);
    /* A regra do briefing: item cinza ensina que a ação existe e que você não
       a tem — ruído permanente para quem nunca vai tê-la. */
    expect(tem(rotulos, "Editar canal")).toBe(false);
    expect(tem(rotulos, "Apagar canal")).toBe(false);
    expect(tem(rotulos, "Criar convite")).toBe(false);
    /* E o que é de LEITURA continua: silenciar e copiar link não pedem
       permissão de servidor nenhuma. */
    expect(tem(rotulos, "Copiar link")).toBe(true);
    expect(nos.some((n) => n.dataset.tipo === "sub")).toBe(true);
  });

  it("canal de VOZ ganha o bloco da sala", () => {
    permitir = true;
    const rotulos = textos(desenhar(<ItensDoCanal channelId="voz1" />));
    expect(tem(rotulos, "Entrar na sala")).toBe(true);
    expect(tem(rotulos, "Abrir o chat")).toBe(true);
  });
});

describe("menu do SERVIDOR", () => {
  it("com permissão cheia: criar, configurar e sair, nessa ordem", () => {
    permitir = true;
    const nos = desenhar(<ItensDoServidor serverId="s1" />);
    conferirRegrasGerais(nos);

    const rotulos = textos(nos);
    expect(rotulos[0]?.startsWith("Marcar servidor como lido")).toBe(true);
    expect(tem(rotulos, "Convidar pessoas")).toBe(true);
    expect(tem(rotulos, "Criar canal")).toBe(true);
    expect(rotulos.at(-1)?.startsWith("Sair do servidor")).toBe(true);

    /* As treze seções viraram UM submenu — o menu não pode voltar a ser mais
       alto que a coluna que o abre. */
    expect(nos.filter((n) => n.dataset.tipo === "sub").length).toBeGreaterThan(0);
  });

  it("sem permissão: some o que administra, fica o que é seu", () => {
    permitir = false;
    const nos = desenhar(<ItensDoServidor serverId="s1" />);
    conferirRegrasGerais(nos);

    const rotulos = textos(nos);
    expect(tem(rotulos, "Criar canal")).toBe(false);
    expect(tem(rotulos, "Convidar pessoas")).toBe(false);
    /* Privacidade, silêncio e sair são de QUEM USA, não de quem administra. */
    expect(tem(rotulos, "Privacidade neste servidor")).toBe(true);
    expect(rotulos.at(-1)?.startsWith("Sair do servidor")).toBe(true);
  });
});

describe("menu da CONVERSA", () => {
  it("DM: relação em vermelho e fechar no fim", () => {
    permitir = true;
    const nos = desenhar(<ItensDaConversa channelId="dm1" />);
    conferirRegrasGerais(nos);

    const rotulos = textos(nos);
    expect(rotulos[0]?.startsWith("Marcar como lida")).toBe(true);
    expect(tem(rotulos, "Ligar")).toBe(true);
    expect(tem(rotulos, "Nota privada")).toBe(true);
    expect(rotulos.at(-1)?.startsWith("Fechar conversa")).toBe(true);

    /* Desfazer amizade e bloquear são PERIGO — o design as pinta em vermelho,
       e a regra geral já garante que elas ficam depois das comuns. */
    const perigos = nos
      .filter((n) => n.dataset.perigo !== undefined)
      .map((n) => n.textContent?.trim());
    expect(perigos).toContain("Desfazer amizade");
    expect(perigos).toContain("Bloquear");
  });
});
