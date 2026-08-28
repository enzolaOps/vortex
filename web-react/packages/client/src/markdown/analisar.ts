/**
 * Markdown → domínio.
 *
 * A mensagem chega do protocolo como **texto cru**, e até agora era isso que
 * ia para a tela: `**negrito**` aparecia com asteriscos, bloco de código com
 * crases, e link não era link. O `CLAUDE.md` sempre disse que o pipeline de
 * markdown "atravessa sem reescrita" — verdade como afirmação de
 * portabilidade, e que nunca tinha sido ligada.
 *
 * Este módulo é a segunda tradução do projeto, ao lado de `sdk/map.ts`. A
 * diferença é a fronteira que cada uma guarda: `map.ts` traduz o SDK, e este
 * traduz o CONTEÚDO — e o conteúdo é escrito por qualquer pessoa. Tudo o que
 * é decisão de segurança neste arquivo sai daí.
 *
 * Mora fora de `src/sdk/` de propósito: `unified` não é o SDK, o texto de
 * entrada já é domínio (`message.content`), e a saída é domínio. Se o
 * `stoat.js` sumir amanhã, este arquivo não muda uma linha.
 */
import type {
  Content,
  Parent,
  PhrasingContent,
  Root,
} from "mdast";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type {
  BlocoDeMensagem,
  ItemDeLista,
  TrechoDeMensagem,
} from "../sdk/domain";

/**
 * `runSync` e não só `parse`, e a diferença não é cosmética.
 *
 * `remark-gfm` entra como extensão do PARSER — riscado, tabela e link
 * automático nascem já na árvore. `remark-breaks` é um TRANSFORMADOR: ele
 * roda depois, convertendo `\n` solto em quebra de linha de verdade. Só
 * `parse()` aplicaria o primeiro e ignoraria o segundo em silêncio — e numa
 * conversa a quebra de linha simples é a formatação mais usada que existe.
 */
const processador = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks);

/** Referência compartilhada: mensagem vazia é caso real (só anexo). */
const SEM_BLOCOS: readonly BlocoDeMensagem[] = [];

/* --------------------------------------------------------------- segurança */

/**
 * Os únicos esquemas de URL que viram link.
 *
 * O resto — `javascript:`, `data:`, `vbscript:`, `file:` — vira texto comum.
 * **Isto não é zelo abstrato:** o token de sessão deste app mora em
 * `localStorage` (decisão registrada em `store/sessao.ts`), então um XSS aqui
 * é roubo de conta, e a superfície de onde ele viria é exatamente esta — texto
 * escrito por terceiro, renderizado na tela de todo mundo.
 */
const ESQUEMAS_PERMITIDOS = new Set(["http:", "https:", "mailto:"]);

/**
 * A URL, se for segura. `undefined` derruba o link para texto.
 *
 * Sem `base` no `new URL` de propósito, e isso é a parte que importa: com
 * base, `/qualquer-coisa` resolveria contra ela e passaria como link válido
 * para um lugar que não é o que o autor escreveu. Sem base, URL relativa
 * lança, cai no `catch` e vira texto — que é a resposta certa para um
 * protocolo onde link relativo não significa nada.
 */
export function hrefSeguro(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return ESQUEMAS_PERMITIDOS.has(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/* ----------------------------------------------------------------- menções */

const MENCAO = /<@([0-9A-Za-z]+)>/g;

/**
 * Parte um trecho de texto separando as menções.
 *
 * Roda por nó de TEXTO da árvore, e não sobre a mensagem inteira, e é essa
 * ordem que faz `**oi <@fulano>**` funcionar: quando esta função vê o texto, o
 * negrito já é estrutura, não caractere.
 *
 * `<@01ABC>` sobrevive ao parse de markdown por sorte documentada: nome de tag
 * HTML precisa começar com letra e link automático precisa de esquema, então
 * `<@…>` não é nenhum dos dois e chega aqui inteiro. Um teste guarda isso —
 * se um dia o CommonMark mudar de ideia, ele reprova em vez de a menção sumir.
 *
 * O nome NÃO é resolvido aqui. Quem sabe o nome é a member list, e puxá-la
 * para dentro do parse acoplaria as duas coleções por uma linha de texto.
 */
function fatiarMencoes(
  texto: string,
  /** Deslocamento do nó dentro da mensagem — a base das chaves. */
  base: number,
  saida: TrechoDeMensagem[],
): void {
  if (!texto.includes("<@")) {
    if (texto.length > 0) saida.push({ tipo: "texto", valor: texto, de: base });
    return;
  }

  MENCAO.lastIndex = 0;
  let ultimo = 0;
  for (const m of texto.matchAll(MENCAO)) {
    const i = m.index;
    if (i > ultimo) {
      saida.push({
        tipo: "texto",
        valor: texto.slice(ultimo, i),
        de: base + ultimo,
      });
    }
    saida.push({ tipo: "mencao", valor: m[1]!, de: base + i });
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) {
    saida.push({
      tipo: "texto",
      valor: texto.slice(ultimo),
      de: base + ultimo,
    });
  }
}

/* -------------------------------------------------------------- conversão */

/**
 * Onde o nó começa no texto original — a identidade dele.
 *
 * Existe pelo mesmo motivo que existia em `fatiarMencoes` antes: o lint proíbe
 * índice como `key`, e a regra tem razão. O deslocamento vem do DADO; o índice
 * vem da posição no array.
 */
function inicio(no: { position?: { start: { offset?: number } } }): number {
  return no.position?.start.offset ?? 0;
}

function trechos(filhos: readonly PhrasingContent[]): readonly TrechoDeMensagem[] {
  const saida: TrechoDeMensagem[] = [];
  for (const filho of filhos) converterTrecho(filho, saida);
  return saida;
}

function converterTrecho(no: PhrasingContent, saida: TrechoDeMensagem[]): void {
  const de = inicio(no);

  switch (no.type) {
    case "text":
      fatiarMencoes(no.value, de, saida);
      return;

    case "inlineCode":
      saida.push({ tipo: "codigo", valor: no.value, de });
      return;

    case "break":
      saida.push({ tipo: "quebra", de });
      return;

    case "emphasis":
      saida.push({ tipo: "enfase", filhos: trechos(no.children), de });
      return;

    case "strong":
      saida.push({ tipo: "forte", filhos: trechos(no.children), de });
      return;

    case "delete":
      saida.push({ tipo: "riscado", filhos: trechos(no.children), de });
      return;

    case "link": {
      const href = hrefSeguro(no.url);
      const dentro = trechos(no.children);
      // Esquema recusado NÃO some: vira o texto que o autor escreveu. Apagar
      // seria esconder de quem lê que havia algo ali.
      if (href === undefined) {
        saida.push(...dentro);
        return;
      }
      saida.push({ tipo: "link", href, filhos: dentro, de });
      return;
    }

    /*
      Imagem de markdown vira LINK, e é decisão de segurança.

      `![](url)` faria o navegador buscar aquela URL sozinho, na máquina de
      todo mundo que abrisse o canal — o que entrega IP e cabeçalhos a quem
      escreveu a mensagem, sem clique nenhum. Imagem de verdade neste app é
      ANEXO, que vem do protocolo com dimensão e passa pelo servidor.
    */
    case "image": {
      const href = hrefSeguro(no.url);
      const rotulo = no.alt || no.url;
      if (href === undefined) {
        saida.push({ tipo: "texto", valor: rotulo, de });
        return;
      }
      saida.push({
        tipo: "link",
        href,
        filhos: [{ tipo: "texto", valor: rotulo, de }],
        de,
      });
      return;
    }

    /*
      HTML cru vira TEXTO. Nunca marcação.

      É a mesma regra do `hrefSeguro` vista de outro ângulo, e a única resposta
      compatível com um app que renderiza conteúdo de terceiro guardando o
      token em `localStorage`.
    */
    case "html":
      saida.push({ tipo: "texto", valor: no.value, de });
      return;

    default: {
      /*
        Tudo o que este cliente ainda não estrutura cai no texto que o autor
        escreveu — referência de link, nota de rodapé, fórmula.

        Devolver nada seria pior que devolver cru: a mensagem perderia trecho
        sem nenhum erro, que é a família de defeito que este projeto mais
        persegue.
      */
      const bruto = no as { value?: string; children?: PhrasingContent[] };
      if (typeof bruto.value === "string") {
        saida.push({ tipo: "texto", valor: bruto.value, de });
      } else if (bruto.children) {
        for (const filho of bruto.children) converterTrecho(filho, saida);
      }
      return;
    }
  }
}

function blocos(filhos: readonly Content[]): readonly BlocoDeMensagem[] {
  const saida: BlocoDeMensagem[] = [];
  for (const filho of filhos) converterBloco(filho, saida);
  return saida;
}

function converterBloco(no: Content, saida: BlocoDeMensagem[]): void {
  const de = inicio(no);

  switch (no.type) {
    case "paragraph":
      saida.push({ tipo: "paragrafo", filhos: trechos(no.children), de });
      return;

    case "heading":
      saida.push({
        tipo: "titulo",
        // Seis níveis num balão de conversa não são hierarquia, são ruído.
        // Três já é mais do que qualquer mensagem precisa.
        nivel: no.depth <= 1 ? 1 : no.depth === 2 ? 2 : 3,
        filhos: trechos(no.children),
        de,
      });
      return;

    case "code":
      saida.push({
        tipo: "blocoDeCodigo",
        valor: no.value,
        // A linguagem é do AUTOR, e por enquanto só rotula. Realce de sintaxe
        // é `shiki`, que é o maior pacote do pipeline e entra atrás de import
        // dinâmico — não no bundle inicial de um cliente de chat.
        lingua: no.lang || undefined,
        de,
      });
      return;

    case "blockquote":
      saida.push({ tipo: "citacao", filhos: blocos(no.children), de });
      return;

    case "list": {
      const itens: ItemDeLista[] = no.children.map((item) => ({
        filhos: blocos(item.children),
        de: inicio(item),
      }));
      saida.push({
        tipo: "lista",
        ordenada: no.ordered === true,
        inicio: no.start ?? 1,
        itens,
        de,
      });
      return;
    }

    case "thematicBreak":
      saida.push({ tipo: "regra", de });
      return;

    case "html":
      // Mesma regra do inline: vira parágrafo de texto, nunca marcação.
      saida.push({
        tipo: "paragrafo",
        filhos: [{ tipo: "texto", valor: no.value, de }],
        de,
      });
      return;

    default: {
      // Tabela e o resto do GFM que ainda não tem desenho: o conteúdo textual
      // sobrevive como parágrafo em vez de sumir.
      const pai = no as Partial<Parent>;
      if (pai.children) {
        const dentro: TrechoDeMensagem[] = [];
        for (const filho of pai.children as PhrasingContent[]) {
          converterTrecho(filho, dentro);
        }
        if (dentro.length > 0) {
          saida.push({ tipo: "paragrafo", filhos: dentro, de });
        }
      }
      return;
    }
  }
}

/* ------------------------------------------------------------------ cache */

/**
 * Quantas árvores ficam guardadas.
 *
 * Existe teto porque a alternativa é o erro nº 5 do briefing com outra roupa:
 * um `Map` sem limite numa sessão de 8h guarda a árvore de toda mensagem que
 * já passou pela tela, e ninguém percebe até a sexta hora.
 *
 * Dois mil cobre com folga a janela visível e o que rola perto dela; acima
 * disso a entrada mais antiga sai. `Map` preserva ordem de inserção, então a
 * primeira chave do iterador É a mais antiga — não precisa de estrutura.
 */
const TETO_DO_CACHE = 2000;

const cache = new Map<string, readonly BlocoDeMensagem[]>();

/**
 * O conteúdo, em árvore de domínio.
 *
 * **Cacheado por CONTEÚDO, e o cache é o ponto deste arquivo.**
 * `toMessageSnapshot` não roda uma vez por mensagem — roda de novo a cada
 * mudança de layout, de estado de envio, de permissão e a cada reação, para
 * toda linha assinada. Parsear markdown ali dentro seria o erro nº 4 do
 * briefing ("markdown reparseado no render") mudado de lugar, e ele degrada
 * exatamente onde dói: quando a presença começa a piscar.
 *
 * A chave é o texto e não o ID porque duas coisas boas caem juntas: mensagem
 * editada troca de chave sozinha, sem invalidação explícita; e "ok" digitado
 * por trinta pessoas divide uma árvore só.
 */
export function analisar(texto: string): readonly BlocoDeMensagem[] {
  if (texto.length === 0) return SEM_BLOCOS;

  const guardado = cache.get(texto);
  if (guardado) return guardado;

  const arvore = processador.runSync(processador.parse(texto)) as Root;
  const resultado = blocos(arvore.children);

  if (cache.size >= TETO_DO_CACHE) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
  cache.set(texto, resultado);
  return resultado;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparCacheDeMarkdown(): void {
  cache.clear();
}

/** Quantas árvores estão guardadas — só para o teste do teto. */
export function tamanhoDoCache(): number {
  return cache.size;
}

/**
 * O texto puro de uma árvore, para prévia de uma linha.
 *
 * A citação e o painel de fixados mostram a mensagem em UMA linha, e ali
 * estrutura não cabe: um bloco de código dentro de uma prévia de 20px seria
 * uma caixa esmagada. Achatar preserva o que se lê e descarta o que se vê.
 */
export function achatar(
  blocosDaMensagem: readonly BlocoDeMensagem[],
): readonly TrechoDeMensagem[] {
  const saida: TrechoDeMensagem[] = [];

  function bloco(b: BlocoDeMensagem): void {
    switch (b.tipo) {
      case "paragrafo":
      case "titulo":
        saida.push(...b.filhos);
        return;
      case "blocoDeCodigo":
        saida.push({ tipo: "codigo", valor: b.valor, de: b.de });
        return;
      case "citacao":
        b.filhos.forEach(bloco);
        return;
      case "lista":
        for (const item of b.itens) item.filhos.forEach(bloco);
        return;
      case "regra":
        return;
    }
  }

  blocosDaMensagem.forEach(bloco);
  return saida;
}
