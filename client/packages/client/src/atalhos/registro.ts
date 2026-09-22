/**
 * O registro de atalhos — e ele é o MECANISMO, não uma lista.
 *
 * ⚠ **A página de atalhos era uma tabela de texto sem nenhuma ligação com
 * código.** Vinte e quatro combinações estavam escritas lá; uma funcionava. Um
 * atalho anunciado e sem handler é o mesmo defeito que o lint de `onSelect`
 * foi instalado para matar — o alvo existe, a pessoa o tenta, nada acontece, e
 * ela não tenta de novo.
 *
 * Aqui a ligação é o TIPO: toda entrada carrega uma `acao`, e as únicas
 * variantes possíveis são "eu executo isto", "o composer executa isto" e "o
 * navegador já faz isto, e a razão está escrita". Não existe a variante
 * "aparece na página e não faz nada". A página é DERIVADA deste arquivo, então
 * anunciar sem implementar deixou de ser representável — ordem de preferência
 * do `enforcement.md`: tornar impossível vem antes de lint, teste e checklist.
 *
 * ⚠ **Notação NEUTRA, nunca o glifo.** A tecla é gravada como
 * `KeyboardEvent.code` e os modificadores como `mod`/`alt`/`shift`; quem
 * traduz para `⌘` ou `Ctrl` é o `<Combinacao>`. Escrever `"⌘K"` aqui faria a
 * página mostrar o símbolo do Mac para quem usa Windows — o defeito que
 * `lib/plataforma.ts` já existe para impedir em outros três lugares.
 *
 * ⚠ **O `code` e não o `key`, e é a mesma razão de `store/atalhosDeVoz.ts`:**
 * `key` muda com o layout (ABNT, US, com Shift ou sem). `Shift+R` em `key`
 * chega como `"R"` maiúsculo; em `code` é sempre `KeyR`, com `shift: true` ao
 * lado. Reutilizar `CombinacaoDeTeclas` de lá também dá `mesmaCombinacao`,
 * `nomeDaTecla` e `teclasDaCombinacao` de graça.
 */
import {
  ACOES_DE_VOZ,
  ROTULO_DA_ACAO,
  type CombinacaoDeTeclas,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
} from "../store/atalhosDeVoz";
import * as acoes from "./acoes";

export const GRUPOS_DE_ATALHO = ["Navegação", "Mensagens", "Painéis"] as const;
export type GrupoDeAtalho = (typeof GRUPOS_DE_ATALHO)[number];

/**
 * Os grupos que a PÁGINA desenha, na ordem do design.
 *
 * "Voz e chamada" não é um grupo do registro porque as combinações dele não
 * moram aqui: mutar, ensurdecer e desconectar são REMAPEÁVEIS e vivem em
 * `store/atalhosDeVoz.ts`, com o listener próprio de `sdk/atalhosDeVoz.ts`.
 * Escrevê-las de novo aqui daria duas tabelas que precisam concordar — e a
 * que diverge seria a que ninguém abriu naquela semana. A página lê a
 * combinação GRAVADA, então ela nunca afirma uma tecla que o app não escuta.
 */
export const GRUPOS_DA_PAGINA = [
  ...GRUPOS_DE_ATALHO,
  "Voz e chamada",
] as const;

/**
 * Quem executa, e é aqui que a garantia mora.
 *
 * - `documento`: o listener global de `atalhos/ligar.ts`.
 * - `composer`: a caixa de texto, porque a tecla só faz sentido com o cursor
 *   dentro dela (↑ para editar a última seria um sequestro da seta em
 *   qualquer outro lugar do app).
 * - `nativo`: o `<textarea>` já faz, e a página o documenta. Único caso sem
 *   função, e ele exige a razão POR ESCRITO — sem a razão não compila.
 * - `superficie`: outra tela já tem o listener, e a entrada NOMEIA o arquivo.
 *   É o caso de atender e recusar chamada, que `voz/ChamadaRecebida` escuta na
 *   CAPTURA de propósito — para que o `Esc` de recusar não desça até o
 *   listener global e marque o canal como lido junto. Um segundo handler aqui
 *   dispararia a ação duas vezes. O teste exige que o arquivo exista e escute
 *   teclado, senão `ligadoEm` vira prosa que envelhece.
 */
type Acao =
  | { readonly escopo: "documento"; readonly executar: () => void }
  | { readonly escopo: "composer"; readonly executar: () => void }
  | { readonly escopo: "nativo"; readonly porque: string }
  | { readonly escopo: "superficie"; readonly ligadoEm: string };

export type Atalho = {
  readonly id: string;
  readonly grupo: GrupoDeAtalho;
  readonly rotulo: string;
  readonly combinacao: CombinacaoDeTeclas;
  /**
   * Segurar a tecla repete?
   *
   * Ligado só onde repetir é o gesto — descer a coluna de canais com ⌥↓
   * segurado. Desligado no resto, e o caso que decide é ⌘K: com repetição,
   * segurar a combinação por meio segundo abre e fecha a paleta trinta vezes.
   */
  readonly repetivel?: boolean;
  /**
   * Linhas que a página junta numa só, como o design escreve — "Servidor
   * anterior / próximo ⌥⌘↑/↓".
   *
   * Duas ENTRADAS e uma linha, e não uma entrada com duas teclas: cada
   * direção tem handler próprio, e uma entrada com dois handlers precisaria
   * dizer qual tecla chamou qual.
   */
  readonly par?: string;
  /**
   * Como o rótulo aparece DEPOIS da barra, na linha juntada.
   *
   * ⚠ **Pego verificando em navegador, e o defeito era da paleta e não da
   * página.** O rótulo da segunda entrada era só "próximo" — certo em
   * "Servidor anterior / próximo", e sem sentido nenhum na lista de ações da
   * paleta, onde ele aparece sozinho: cinco linhas dizendo "próximo" e
   * "anterior" sem dizer de quê. O `rotulo` passou a ser sempre a frase
   * inteira, e este campo é o que a página encurta.
   */
  readonly rotuloNoPar?: string;
} & Acao;

/** Atalho de uma tecla só, sem modificador. */
function tecla(codigo: string, extras: Partial<CombinacaoDeTeclas> = {}) {
  return { codigo, mod: false, alt: false, shift: false, ...extras };
}

export const ATALHOS: readonly Atalho[] = [
  /* ------------------------------------------------------------ navegação */
  {
    id: "navegadorRapido",
    grupo: "Navegação",
    rotulo: "Navegador rápido",
    combinacao: tecla("KeyK", { mod: true }),
    escopo: "documento",
    executar: acoes.abrirNavegadorRapido,
  },
  {
    id: "servidorAnterior",
    grupo: "Navegação",
    rotulo: "Servidor anterior",
    par: "servidor",
    repetivel: true,
    combinacao: tecla("ArrowUp", { mod: true, alt: true }),
    escopo: "documento",
    executar: () => acoes.irParaServidorVizinho(-1),
  },
  {
    id: "servidorProximo",
    grupo: "Navegação",
    rotulo: "Servidor próximo",
    rotuloNoPar: "próximo",
    par: "servidor",
    repetivel: true,
    combinacao: tecla("ArrowDown", { mod: true, alt: true }),
    escopo: "documento",
    executar: () => acoes.irParaServidorVizinho(1),
  },
  {
    id: "canalAnterior",
    grupo: "Navegação",
    rotulo: "Canal anterior",
    par: "canal",
    repetivel: true,
    combinacao: tecla("ArrowUp", { alt: true }),
    escopo: "documento",
    executar: () => acoes.irParaCanalVizinho(-1),
  },
  {
    id: "canalProximo",
    grupo: "Navegação",
    rotulo: "Canal próximo",
    rotuloNoPar: "próximo",
    par: "canal",
    repetivel: true,
    combinacao: tecla("ArrowDown", { alt: true }),
    escopo: "documento",
    executar: () => acoes.irParaCanalVizinho(1),
  },
  {
    id: "canalNaoLido",
    grupo: "Navegação",
    rotulo: "Canal não lido mais antigo",
    combinacao: tecla("ArrowUp", { alt: true, shift: true }),
    escopo: "documento",
    executar: acoes.irParaCanalNaoLido,
  },
  {
    id: "voltar",
    grupo: "Navegação",
    rotulo: "Voltar no histórico",
    rotuloNoPar: "Voltar",
    par: "historico",
    repetivel: true,
    combinacao: tecla("BracketLeft", { mod: true }),
    escopo: "documento",
    executar: acoes.voltarNoHistorico,
  },
  {
    id: "avancar",
    grupo: "Navegação",
    rotulo: "Avançar no histórico",
    rotuloNoPar: "avançar",
    par: "historico",
    repetivel: true,
    combinacao: tecla("BracketRight", { mod: true }),
    escopo: "documento",
    executar: acoes.avancarNoHistorico,
  },
  {
    id: "conversas",
    grupo: "Navegação",
    rotulo: "Ir para DMs",
    combinacao: tecla("Digit0", { mod: true }),
    escopo: "documento",
    executar: acoes.irParaConversas,
  },

  /* ------------------------------------------------------------ mensagens */
  {
    id: "responderAUltima",
    grupo: "Mensagens",
    rotulo: "Responder à última",
    combinacao: tecla("KeyR", { shift: true }),
    escopo: "documento",
    executar: acoes.responderAUltima,
  },
  {
    id: "editarAUltima",
    grupo: "Mensagens",
    rotulo: "Editar a última sua",
    combinacao: tecla("ArrowUp"),
    escopo: "composer",
    executar: acoes.editarUltimaMinha,
  },
  {
    id: "adicionarReacao",
    grupo: "Mensagens",
    rotulo: "Adicionar reação",
    combinacao: tecla("KeyE", { mod: true, shift: true }),
    escopo: "documento",
    executar: acoes.reagirNaMensagemMirada,
  },
  {
    id: "marcarCanalLido",
    grupo: "Mensagens",
    rotulo: "Marcar canal como lido",
    combinacao: tecla("Escape"),
    escopo: "documento",
    executar: acoes.marcarCanalAtivoLido,
  },
  {
    id: "marcarServidorLido",
    grupo: "Mensagens",
    rotulo: "Marcar servidor como lido",
    combinacao: tecla("Escape", { shift: true }),
    escopo: "documento",
    executar: acoes.marcarServidorAtivoLido,
  },
  {
    id: "novaLinha",
    grupo: "Mensagens",
    rotulo: "Nova linha",
    combinacao: tecla("Enter", { shift: true }),
    escopo: "nativo",
    porque:
      "O <textarea> já quebra linha com Shift+Enter; o composer só evita ENVIAR nesse caso.",
  },
  {
    id: "atenderChamada",
    grupo: "Mensagens",
    rotulo: "Atender chamada",
    combinacao: tecla("Enter", { mod: true }),
    escopo: "superficie",
    ligadoEm: "voz/ChamadaRecebida.tsx",
  },
  {
    id: "recusarChamada",
    grupo: "Mensagens",
    rotulo: "Recusar chamada",
    combinacao: tecla("Escape"),
    escopo: "superficie",
    ligadoEm: "voz/ChamadaRecebida.tsx",
  },
  {
    id: "buscarNoCanal",
    grupo: "Mensagens",
    rotulo: "Buscar no canal",
    combinacao: tecla("KeyF", { mod: true }),
    escopo: "documento",
    executar: acoes.alternarBuscaNoCanal,
  },

  /* -------------------------------------------------------------- painéis */
  {
    id: "painelMembros",
    grupo: "Painéis",
    rotulo: "Lista de membros",
    combinacao: tecla("KeyU", { mod: true }),
    escopo: "documento",
    executar: acoes.alternarMembros,
  },
  {
    id: "painelFixados",
    grupo: "Painéis",
    rotulo: "Mensagens fixadas",
    combinacao: tecla("KeyP", { mod: true }),
    escopo: "documento",
    executar: acoes.alternarFixados,
  },
  {
    id: "painelTopicos",
    grupo: "Painéis",
    rotulo: "Tópicos",
    combinacao: tecla("KeyT", { mod: true, shift: true }),
    escopo: "documento",
    executar: acoes.alternarTopicos,
  },
  {
    id: "painelCaixaDeEntrada",
    grupo: "Painéis",
    rotulo: "Caixa de entrada",
    combinacao: tecla("KeyI", { mod: true }),
    escopo: "documento",
    executar: acoes.alternarCaixaDeEntrada,
  },
  {
    id: "seletorDeEmoji",
    grupo: "Painéis",
    rotulo: "Seletor de emoji",
    combinacao: tecla("KeyE", { mod: true }),
    escopo: "documento",
    executar: acoes.abrirSeletorDeEmoji,
  },
  {
    id: "seletorDeGif",
    grupo: "Painéis",
    rotulo: "Seletor de GIF",
    combinacao: tecla("KeyG", { mod: true }),
    escopo: "documento",
    executar: acoes.abrirSeletorDeGif,
  },

];

/**
 * Uma LINHA da página — já com o par juntado, como o design a escreve.
 *
 * "Servidor anterior / próximo" com `⌥⌘ ↑ / ↓`: os modificadores aparecem uma
 * vez e só a tecla final é que tem as duas formas. Juntar no registro daria
 * uma entrada com dois handlers; juntar aqui é só apresentação.
 */
export type LinhaDeAtalho = {
  readonly id: string;
  readonly grupo: (typeof GRUPOS_DA_PAGINA)[number];
  readonly rotulo: string;
  readonly teclas: readonly string[];
};

/**
 * As linhas do grupo "Voz e chamada" — lidas do store, não escritas aqui.
 *
 * ⚠ **`pushToTalk` entra e os dois do OVERLAY não**, e o critério é onde o
 * design os põe: abrir e silenciar o overlay do jogo são da página Desktop,
 * que já tem a tabela remapeável deles. Repeti-los aqui seria a mesma
 * combinação em duas telas, com um botão "Editar" só numa.
 *
 * Combinação ausente (alguém limpou o atalho) não vira linha: a tela diria
 * "Mutar microfone" sem tecla nenhuma ao lado.
 */
const NA_PAGINA_DE_ATALHOS = ["pushToTalk", "mutar", "ensurdecer", "desconectar"] as const;

export function linhasDeVoz(): readonly LinhaDeAtalho[] {
  const atuais = lerAtalhosDeVoz();
  return ACOES_DE_VOZ.filter((a) =>
    (NA_PAGINA_DE_ATALHOS as readonly string[]).includes(a),
  ).flatMap((acao) => {
    const c = atuais[acao];
    if (!c) return [];
    return [
      {
        id: acao,
        grupo: "Voz e chamada" as const,
        rotulo: ROTULO_DA_ACAO[acao],
        teclas: teclasDaCombinacao(c),
      },
    ];
  });
}

export function linhasDaPagina(): readonly LinhaDeAtalho[] {
  const linhas: LinhaDeAtalho[] = [];
  const porPar = new Map<string, number>();

  for (const a of ATALHOS) {
    const teclas = teclasDaCombinacao(a.combinacao);

    const rotulo = a.rotuloNoPar ?? a.rotulo;

    if (a.par === undefined) {
      linhas.push({ id: a.id, grupo: a.grupo, rotulo, teclas });
      continue;
    }

    const onde = porPar.get(a.par);
    if (onde === undefined) {
      porPar.set(a.par, linhas.length);
      linhas.push({ id: a.par, grupo: a.grupo, rotulo, teclas });
      continue;
    }

    /*
      Junta a SEGUNDA no lugar da primeira. Só o último token difere — os
      modificadores são os mesmos, e repeti-los daria `⌥⌘↑ ⌥⌘↓`, que é o
      dobro de tinta para a mesma informação.
    */
    const antes = linhas[onde]!;
    const anterior = antes.teclas[antes.teclas.length - 1];
    const proxima = teclas[teclas.length - 1];
    linhas[onde] = {
      ...antes,
      rotulo: `${antes.rotulo} / ${rotulo}`,
      teclas: [...antes.teclas.slice(0, -1), `${anterior} / ${proxima}`],
    };
  }

  return [...linhas, ...linhasDeVoz()];
}
