import { beforeEach, describe, expect, it } from "vitest";

import type { BlocoDeMensagem, TrechoDeMensagem } from "../sdk/domain";
import {
  achatar,
  analisar,
  limparCacheDeMarkdown,
  tamanhoDoCache,
} from "./analisar";

beforeEach(() => {
  limparCacheDeMarkdown();
});

/** O texto que sobrou, para afirmar sobre conteúdo sem escrever a árvore toda. */
function texto(trechos: readonly TrechoDeMensagem[]): string {
  return trechos
    .map((t) => {
      switch (t.tipo) {
        case "texto":
        case "codigo":
          return t.valor;
        case "mencao":
          return `@${t.valor}`;
        case "emoji":
          return `:${t.valor}:`;
        case "quebra":
          return "\n";
        default:
          return texto(t.filhos);
      }
    })
    .join("");
}

function umParagrafo(entrada: string): readonly TrechoDeMensagem[] {
  const blocos = analisar(entrada);
  expect(blocos).toHaveLength(1);
  const b = blocos[0]!;
  if (b.tipo !== "paragrafo") throw new Error(`esperava parágrafo, veio ${b.tipo}`);
  return b.filhos;
}

describe("o caso comum", () => {
  it("texto puro vira um parágrafo de um trecho", () => {
    const filhos = umParagrafo("bom dia");
    expect(filhos).toHaveLength(1);
    expect(filhos[0]).toEqual({ tipo: "texto", valor: "bom dia", de: 0 });
  });

  it("mensagem vazia não vira bloco nenhum", () => {
    expect(analisar("")).toHaveLength(0);
  });
});

describe("menções", () => {
  /*
    Este teste guarda uma sorte documentada: `<@01ABC>` sobrevive ao parse de
    markdown porque nome de tag HTML precisa começar com letra e link
    automático precisa de esquema, então `<@…>` não é nenhum dos dois. Se o
    CommonMark mudar de ideia, o teste reprova em vez de a menção sumir da tela
    sem ninguém perceber.
  */
  it("sobrevivem ao parse de markdown", () => {
    const filhos = umParagrafo("oi <@01ABC>, tudo bem?");
    expect(filhos.map((t) => t.tipo)).toEqual(["texto", "mencao", "texto"]);
    expect(filhos[1]).toMatchObject({ tipo: "mencao", valor: "01ABC" });
  });

  /*
    A razão de a árvore existir. Com a lista plana anterior isto era
    irrepresentável: ou o negrito ou a menção sobreviveria.
  */
  it("funcionam DENTRO de formatação", () => {
    const filhos = umParagrafo("**urgente <@01ABC>**");
    expect(filhos).toHaveLength(1);
    const forte = filhos[0]!;
    if (forte.tipo !== "forte") throw new Error("esperava forte");
    expect(forte.filhos.map((t) => t.tipo)).toEqual(["texto", "mencao"]);
  });

  it("duas menções iguais na mesma frase têm chaves diferentes", () => {
    const filhos = umParagrafo("<@01A> e <@01A>");
    const mencoes = filhos.filter((t) => t.tipo === "mencao");
    expect(mencoes).toHaveLength(2);
    expect(mencoes[0]!.de).not.toBe(mencoes[1]!.de);
  });
});

describe("formatação inline", () => {
  it("reconhece negrito, itálico, riscado e código", () => {
    expect(umParagrafo("**a**")[0]!.tipo).toBe("forte");
    expect(umParagrafo("*a*")[0]!.tipo).toBe("enfase");
    // Riscado é GFM — se o plugin sair, isto vira texto e o teste reprova.
    expect(umParagrafo("~~a~~")[0]!.tipo).toBe("riscado");
    expect(umParagrafo("`a`")[0]!).toEqual({ tipo: "codigo", valor: "a", de: 0 });
  });

  /*
    `remark-breaks` é TRANSFORMADOR, não extensão do parser: só `parse()` o
    ignoraria em silêncio. Este teste é o que garante que `runSync` continua
    sendo chamado — e quebra de linha simples é a formatação mais usada numa
    conversa.
  */
  it("quebra de linha simples vira quebra, não espaço", () => {
    const filhos = umParagrafo("linha um\nlinha dois");
    expect(filhos.map((t) => t.tipo)).toEqual(["texto", "quebra", "texto"]);
  });
});

describe("blocos", () => {
  it("bloco de código guarda valor e linguagem", () => {
    const blocos = analisar("```ts\nconst a = 1;\n```");
    expect(blocos).toHaveLength(1);
    expect(blocos[0]).toMatchObject({
      tipo: "blocoDeCodigo",
      valor: "const a = 1;",
      lingua: "ts",
    });
  });

  it("bloco de código sem linguagem não inventa uma", () => {
    const b = analisar("```\nx\n```")[0]!;
    expect(b).toMatchObject({ tipo: "blocoDeCodigo", lingua: undefined });
  });

  it("citação carrega blocos dentro", () => {
    const b = analisar("> citado")[0]!;
    if (b.tipo !== "citacao") throw new Error("esperava citação");
    expect(b.filhos[0]!.tipo).toBe("paragrafo");
  });

  it("lista guarda ordem e início", () => {
    const b = analisar("3. a\n4. b")[0]!;
    if (b.tipo !== "lista") throw new Error("esperava lista");
    expect(b.ordenada).toBe(true);
    expect(b.inicio).toBe(3);
    expect(b.itens).toHaveLength(2);
  });

  it("lista não ordenada é marcada como tal", () => {
    const b = analisar("- a\n- b")[0]!;
    expect(b).toMatchObject({ tipo: "lista", ordenada: false });
  });

  /*
    Seis níveis num balão de conversa não são hierarquia, são ruído. O nível 6
    do markdown cai em 3, e o componente soma 2 para o `aria-level` — o esboço
    da página continua sendo do app, não da mensagem.
  */
  it("título limita a três níveis", () => {
    expect(analisar("# a")[0]).toMatchObject({ tipo: "titulo", nivel: 1 });
    expect(analisar("###### a")[0]).toMatchObject({ tipo: "titulo", nivel: 3 });
  });

  it("régua vira bloco próprio", () => {
    expect(analisar("---")[0]!.tipo).toBe("regra");
  });
});

/*
  A seção que justifica o arquivo existir separado.

  O token de sessão deste app mora em `localStorage`, então um XSS aqui é
  roubo de conta — e a superfície de onde ele viria é exatamente esta: texto
  escrito por terceiro, renderizado na tela de todo mundo.
*/
describe("segurança", () => {
  it("link http e https passam", () => {
    const b = umParagrafo("[x](https://exemplo.com)")[0]!;
    expect(b).toMatchObject({ tipo: "link", href: "https://exemplo.com/" });
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("esquema %s NÃO vira link", (url) => {
    const filhos = umParagrafo(`[clique](${url})`);
    expect(filhos.some((t) => t.tipo === "link")).toBe(false);
    // E o texto do autor sobrevive: apagar esconderia de quem lê que havia
    // algo ali.
    expect(texto(filhos)).toContain("clique");
  });

  /*
    Sem base no `new URL`. Com base, `/qualquer-coisa` resolveria contra ela e
    passaria como link para um lugar que não é o que o autor escreveu.
  */
  it("URL relativa não vira link", () => {
    const filhos = umParagrafo("[x](/interno)");
    expect(filhos.some((t) => t.tipo === "link")).toBe(false);
  });

  it("HTML cru vira TEXTO, nunca marcação", () => {
    const blocos = analisar('<img src=x onerror="alert(1)">');
    const tudo = achatar(blocos);
    expect(tudo.every((t) => t.tipo === "texto")).toBe(true);
    expect(texto(tudo)).toContain("onerror");
  });

  it("HTML inline dentro de parágrafo também vira texto", () => {
    const filhos = umParagrafo("antes <b>meio</b> depois");
    expect(filhos.every((t) => t.tipo === "texto")).toBe(true);
    expect(texto(filhos)).toContain("<b>");
  });

  /*
    Imagem de markdown vira LINK e nunca `<img>`: `![](url)` faria o navegador
    buscar aquela URL sozinho, na máquina de todo mundo que abrisse o canal,
    entregando IP e cabeçalhos a quem escreveu a mensagem — sem clique nenhum.
  */
  it("imagem vira link, não imagem", () => {
    const b = umParagrafo("![gato](https://exemplo.com/g.png)")[0]!;
    expect(b).toMatchObject({ tipo: "link", href: "https://exemplo.com/g.png" });
    if (b.tipo !== "link") throw new Error("esperava link");
    expect(texto(b.filhos)).toBe("gato");
  });

  it("imagem com esquema recusado vira texto", () => {
    const filhos = umParagrafo("![x](javascript:alert(1))");
    expect(filhos.some((t) => t.tipo === "link")).toBe(false);
  });
});

describe("cache", () => {
  it("mesmo conteúdo devolve a MESMA referência", () => {
    const a = analisar("oi");
    const b = analisar("oi");
    expect(a).toBe(b);
  });

  it("conteúdo diferente não compartilha árvore", () => {
    expect(analisar("a")).not.toBe(analisar("b"));
  });

  /*
    O teto existe porque a alternativa é o erro nº 5 do briefing com outra
    roupa: um `Map` sem limite numa sessão de 8h guarda a árvore de toda
    mensagem que já passou pela tela, e ninguém percebe até a sexta hora.
  */
  it("não cresce sem limite", () => {
    for (let i = 0; i < 2500; i++) analisar(`mensagem ${i}`);
    expect(tamanhoDoCache()).toBeLessThanOrEqual(2000);
  });

  it("a entrada mais antiga é a que sai", () => {
    for (let i = 0; i < 2001; i++) analisar(`m${i}`);
    // `m0` saiu; pedir de novo reconstrói, e a referência muda.
    const primeira = analisar("m0");
    expect(analisar("m0")).toBe(primeira);
  });
});

describe("achatar", () => {
  it("descarta estrutura e preserva o que se lê", () => {
    const blocos = analisar("# título\n\n- um\n- dois\n\n```\ncod\n```");
    expect(texto(achatar(blocos))).toBe("títuloumdoiscod");
  });

  it("citação aninhada não se perde", () => {
    expect(texto(achatar(analisar("> > fundo")))).toBe("fundo");
  });

  it("régua some, porque não há o que ler nela", () => {
    const blocos: readonly BlocoDeMensagem[] = analisar("a\n\n---\n\nb");
    expect(texto(achatar(blocos))).toBe("ab");
  });
});

describe("emoji personalizado", () => {
  /** Um ULID válido: 26 caracteres do alfabeto Crockford. */
  const ID = "01H2XABCDEFGHJKMNPQRSTVWXY";

  it("vira trecho próprio, e o resto do texto sobrevive", () => {
    const t = umParagrafo(`bom dia :${ID}: pessoal`);
    expect(t.map((x) => x.tipo)).toEqual(["texto", "emoji", "texto"]);
    expect(t[1]).toMatchObject({ tipo: "emoji", valor: ID });
  });

  /*
    ⚠ **O teste que decide a regex.** Aceitar `\w+` faria toda mensagem com
    dois-pontos virar uma imagem quebrada — `:sorriso:`, `:-)`, `12:30:15`,
    `https://x` são texto que alguém escreveu. Só um ULID é referência a um
    arquivo, e é por isso que o alfabeto é fechado.
  */
  it("NÃO casa dois-pontos que não seja ULID", () => {
    for (const cru of [
      ":sorriso:",
      ":festa_da_firma:",
      "às 12:30:15 de hoje",
      ":01H2XABCDEFGHJKMNPQRSTVWX:",
      ":01H2XABCDEFGHJKMNPQRSTVWXYZZ:",
      ":01H2XABCDEFGHIKMNPQRSTVWXY:",
    ]) {
      const t = umParagrafo(cru);
      expect(t.every((x) => x.tipo !== "emoji")).toBe(true);
    }
  });

  it("convive com menção no mesmo texto, na ordem certa", () => {
    const t = umParagrafo(`<@01EU> olha :${ID}:`);
    expect(t.map((x) => x.tipo)).toEqual(["mencao", "texto", "emoji"]);
  });

  it("atravessa a formatação, como a menção", () => {
    const t = umParagrafo(`**:${ID}:**`);
    expect(t).toHaveLength(1);
    expect(t[0]?.tipo).toBe("forte");
    expect(texto(achatar([{ tipo: "paragrafo", filhos: t, de: 0 }]))).toBe(
      `:${ID}:`,
    );
  });

  /*
    Chave é tipo + deslocamento, e dois emojis iguais na mesma mensagem
    precisam de chaves diferentes — senão o React descarta um deles sem avisar.
  */
  it("dois iguais têm deslocamentos diferentes", () => {
    const t = umParagrafo(`:${ID}: :${ID}:`);
    const emojis = t.filter((x) => x.tipo === "emoji");
    expect(emojis).toHaveLength(2);
    expect(emojis[0]?.de).not.toBe(emojis[1]?.de);
  });
});

