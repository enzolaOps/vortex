import { ulidAnterior, ulidDoInstante } from "../lib/ulid";

/**
 * Os filtros da busca, lidos do PRÓPRIO texto do campo.
 *
 * ⚠ **O texto é a fonte, e os chips são projeção dele** — a mesma decisão da
 * referência (`SearchPanel`), e pela razão dela: quem digita `de:marina` não
 * quer abrir um menu, e quem clica no `✕` de um chip espera o texto do campo
 * mudar junto. Dois donos (campo e lista de chips) divergiriam no primeiro
 * `backspace`.
 *
 * Módulo puro, sem SDK: resolver `de:marina` para um ID de usuário é trabalho
 * da camada anticorrupção (`sdk/busca.ts`), e converter data em cursor é conta,
 * não protocolo.
 *
 * O que o protocolo aceita, e para onde cada filtro vai:
 *
 * | filtro              | campo                          |
 * |---------------------|--------------------------------|
 * | `de:nome`           | `author` (ID resolvido)        |
 * | `tem:arquivo`…      | `has`                          |
 * | `antes:`/`depois:`  | `before`/`after` (ULID)        |
 * | `durante:`          | os dois                        |
 *
 * ⚠ As datas NÃO ganharam campo no servidor, e não precisavam: `before` e
 * `after` já existiam como cursor, e cursor de ULID é instante.
 */

export type TipoDeConteudo = "arquivo" | "imagem" | "video" | "audio" | "link";

export type ChaveDeFiltro = "de" | "tem" | "antes" | "depois" | "durante";

export type Filtro = {
  readonly chave: ChaveDeFiltro;
  readonly valor: string;
  /** Como está escrito no campo — é o que o `✕` tira. */
  readonly bruto: string;
  /** `tem:` com tipo desconhecido ou data que não é data. */
  readonly valido: boolean;
};

export type ConsultaAnalisada = {
  /** O texto livre, sem os filtros. */
  readonly texto: string;
  readonly filtros: readonly Filtro[];
};

/** A grafia do campo → o tipo do domínio. Acento opcional, como se digita. */
const TIPOS: Record<string, TipoDeConteudo> = {
  arquivo: "arquivo",
  anexo: "arquivo",
  imagem: "imagem",
  video: "video",
  vídeo: "video",
  audio: "audio",
  áudio: "audio",
  link: "link",
};

/** Os tipos, na ordem do menu `+ filtro`. */
export const TIPOS_DE_CONTEUDO: readonly TipoDeConteudo[] = [
  "arquivo",
  "imagem",
  "video",
  "audio",
  "link",
];

const RE_FILTRO = /(^|\s)(de|tem|antes|depois|durante):(\S+)/giu;
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/u;

/** Meia-noite LOCAL do dia — "durante 12/09" é o dia de quem busca. */
function inicioDoDia(valor: string): number | undefined {
  const m = RE_DATA.exec(valor);
  if (!m) return undefined;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(ano, mes - 1, dia);
  /* `new Date(2026, 1, 31)` vira 3 de março em silêncio — conferir de volta. */
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
    return undefined;
  }
  return d.getTime();
}

function diaSeguinte(inicio: number): number {
  const d = new Date(inicio);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export function tipoDoFiltro(valor: string): TipoDeConteudo | undefined {
  return TIPOS[valor.toLocaleLowerCase("pt-BR")];
}

export function analisarConsulta(consulta: string): ConsultaAnalisada {
  const filtros: Filtro[] = [];
  const texto = consulta.replace(
    RE_FILTRO,
    (_tudo, espaco: string, chave: string, valor: string) => {
      const c = chave.toLowerCase() as ChaveDeFiltro;
      const valido =
        c === "de"
          ? valor.length > 0
          : c === "tem"
            ? tipoDoFiltro(valor) !== undefined
            : inicioDoDia(valor) !== undefined;
      filtros.push({ chave: c, valor, bruto: `${chave}:${valor}`, valido });
      return espaco;
    },
  );
  return { texto: texto.replace(/\s+/gu, " ").trim(), filtros };
}

/** Tira um filtro do texto do campo — o `✕` do chip. */
export function tirarFiltro(consulta: string, bruto: string): string {
  const i = consulta.indexOf(bruto);
  if (i === -1) return consulta;
  return (consulta.slice(0, i) + consulta.slice(i + bruto.length))
    .replace(/\s+/gu, " ")
    .trim();
}

/** Acrescenta o começo de um filtro ao fim do campo — o `+ filtro`. */
export function acrescentarFiltro(consulta: string, trecho: string): string {
  const base = consulta.trimEnd();
  return base.length === 0 ? trecho : `${base} ${trecho}`;
}

export type IntervaloDeBusca = {
  /** `before` do protocolo — exclusivo. */
  readonly antesDe: string | undefined;
  /** `after` do protocolo — exclusivo. */
  readonly depoisDe: string | undefined;
};

/**
 * As datas → os dois cursores do protocolo.
 *
 * ⚠ **Os dois são EXCLUSIVOS no servidor (`$lt` e `$gt`)**, e é por isso que
 * o começo de um dia vira `ulidAnterior` do primeiro ULID dele: com o próprio
 * ULID de meia-noite, uma mensagem gerada exatamente em 00:00:00.000 com
 * aleatório zero cairia fora. Improvável, e o tipo de erro que só aparece no
 * relatório de alguém.
 *
 * Mais de um filtro de data ESTREITA: o `before` é o menor e o `after` o maior.
 */
export function intervaloDasDatas(filtros: readonly Filtro[]): IntervaloDeBusca {
  let antesDe: string | undefined;
  let depoisDe: string | undefined;

  const estreitarAntes = (id: string | undefined) => {
    if (id === undefined) return;
    if (antesDe === undefined || id < antesDe) antesDe = id;
  };
  const estreitarDepois = (id: string | undefined) => {
    if (id === undefined) return;
    if (depoisDe === undefined || id > depoisDe) depoisDe = id;
  };

  for (const f of filtros) {
    if (!f.valido) continue;
    const inicio = inicioDoDia(f.valor);
    if (inicio === undefined) continue;
    const primeiroDoDia = ulidDoInstante(inicio);
    const primeiroDoSeguinte = ulidDoInstante(diaSeguinte(inicio));

    if (f.chave === "antes") estreitarAntes(primeiroDoDia);
    else if (f.chave === "depois") {
      estreitarDepois(primeiroDoSeguinte && ulidAnterior(primeiroDoSeguinte));
    } else if (f.chave === "durante") {
      estreitarDepois(primeiroDoDia && ulidAnterior(primeiroDoDia));
      estreitarAntes(primeiroDoSeguinte);
    }
  }

  return { antesDe, depoisDe };
}

export type CandidatoAAutor = {
  readonly id: string;
  /** Username, nome de exibição, apelido — tudo por que alguém a chamaria. */
  readonly nomes: readonly string[];
};

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

/**
 * `de:marina` → a pessoa.
 *
 * Nome inteiro igual ganha; sem isso, uma PALAVRA do nome que comece com o
 * digitado — mas só se for UMA pessoa. Dois candidatos para `de:ma` e a busca
 * escolheria um deles em silêncio, devolvendo mensagens da pessoa errada com
 * cara de resultado certo; melhor não filtrar e dizer.
 */
export function escolherAutor(
  nome: string,
  candidatos: readonly CandidatoAAutor[],
): string | undefined {
  const alvo = normalizar(nome);
  if (alvo.length === 0) return undefined;

  for (const c of candidatos) {
    if (c.nomes.some((n) => normalizar(n) === alvo)) return c.id;
  }

  const porPrefixo = candidatos.filter((c) =>
    c.nomes.some((n) => normalizar(n).split(/\s+/u).some((p) => p.startsWith(alvo))),
  );
  return porPrefixo.length === 1 ? porPrefixo[0]?.id : undefined;
}

/** O menor de dois cursores `before` — o da página e o da data. */
export function menorCursor(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return a < b ? a : b;
}
