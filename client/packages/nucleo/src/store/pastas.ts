/**
 * Pastas de servidor — agrupar o rail.
 *
 * ⚠ **O protocolo não tem pastas, e por isso elas moram aqui.** O Stoat guarda
 * ORDEM de servidor em configuração de usuário, e nada mais; agrupamento é
 * conceito de cliente. É a mesma situação de `silencio.ts` (o SDK delega a
 * decisão) e de `colapso.ts` (preferência de leitura), e a resposta é a mesma:
 * store local, no dispositivo, com a sincronia listada como pendência.
 *
 * **Não vai no preset**, e a regra é a mais dura do projeto: uma pasta carrega
 * IDs de servidor, que é exatamente a família de dado que o schema do preset
 * foi desenhado para tornar irrepresentável. Preset já compartilhado não volta
 * atrás.
 *
 * A ordem das pastas é a de criação; a dos servidores dentro de cada uma é a
 * de entrada. Reordenar por arraste é pendência — e vai precisar escrever no
 * protocolo, porque a ordem dos servidores SOLTOS é dele.
 */

const CHAVE = "vortex:pastas";

export type Pasta = {
  readonly id: string;
  readonly nome: string;
  /** IDs de servidor, na ordem em que entraram. */
  readonly servidores: readonly string[];
  readonly colapsada: boolean;
  /**
   * A cor da pasta, em hex.
   *
   * ⚠ **Ela tinge só o FUNDO do agrupamento (a 10%) e o anel de soltura —
   * nunca os ícones dos servidores.** É instrução da referência, e a razão é
   * a mesma da disciplina de acento: cada servidor tem gradiente próprio, que
   * é como se identifica um servidor de relance. Tingir os ícones apagaria
   * essa identidade para marcar a caixa que os contém.
   */
  readonly cor: string;
  /**
   * Nunca colapsar sozinha ao trocar de servidor.
   *
   * `colapsada` é o estado AGORA; esta é a preferência sobre ele. Sem as duas
   * separadas, "sempre expandida" seria só um colapso desfeito que o próximo
   * clique refaz.
   */
  readonly sempreExpandida: boolean;
};

/**
 * As cinco cores oferecidas, na ordem do design.
 *
 * ⚠ **Eram SEIS numa ordem própria, e sem o `＋` que o design desenha ao lado.**
 * A lista é o atalho, não a cerceadura: o design põe cinco atalhos mais um
 * campo de hex livre, porque a cor tinge um fundo a 10% — nada pousa em cima
 * dela, então um hex qualquer não pode reprovar contraste de texto nenhum. O
 * que ele PODE fazer é sumir, e a resposta a isso é o `＋` mostrar a prévia,
 * não a lista proibir.
 */
export const CORES_DE_PASTA = [
  "#35C2CC",
  "#8B7BE8",
  "#46C98A",
  "#E2B15C",
  "#E8596B",
] as const;

/* O primeiro degrau: é o acento do produto, e o default óbvio. */
const COR_PADRAO = CORES_DE_PASTA[0];

/**
 * Um hex de seis dígitos, e só.
 *
 * ⚠ **Ela guarda uma fronteira de SEGURANÇA, não de gosto.** A cor sai do
 * `localStorage` e vai para uma custom property lida por `color-mix` — a
 * mesma família do `colour` de cargo, que este projeto já reconstrói de
 * números em vez de deixar a string do servidor chegar ao `style`. Três
 * dígitos, `rgb()`, `var(--…)` e nome de cor ficam de fora porque nenhum
 * deles é necessário e todos ampliam o que pode chegar ao CSS.
 */
const HEX = /^#[0-9a-f]{6}$/i;

export function corDePastaValida(bruta: unknown): bruta is string {
  return typeof bruta === "string" && HEX.test(bruta);
}

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1. Nunca montar no getter. */
let pastas: readonly Pasta[] = ler();

/**
 * Lê do armazenamento, defensivamente.
 *
 * `localStorage` é editável por quem usa o app, e um valor corrompido não pode
 * derrubar o rail inteiro — que é a única coluna sempre visível. Campo com
 * forma errada é DESCARTADO, não corrigido: adivinhar o que alguém quis dizer
 * com `{nome: 42}` produz uma pasta que ninguém criou.
 */
function ler(): readonly Pasta[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista: unknown = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];

    return lista.flatMap((p: unknown): Pasta[] => {
      if (typeof p !== "object" || p === null) return [];
      const o = p as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.nome !== "string") return [];
      const servidores = Array.isArray(o.servidores)
        ? o.servidores.filter((s): s is string => typeof s === "string")
        : [];
      return [
        {
          id: o.id,
          nome: o.nome,
          servidores,
          colapsada: o.colapsada === true,
          /* Forma errada cai no padrão em vez de ser aceita: o que vem do
             armazenamento chega a uma custom property, e é `corDePastaValida`
             quem decide o que pode chegar lá. */
          cor: corDePastaValida(o.cor) ? o.cor : COR_PADRAO,
          sempreExpandida: o.sempreExpandida === true,
        },
      ];
    });
  } catch {
    return [];
  }
}

function gravar(novas: readonly Pasta[]): void {
  pastas = novas;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novas));
  } catch {
    /*
      Armazenamento bloqueado não derruba a sessão viva.

      Modo privado e política de site podem recusar a escrita. A pasta continua
      valendo nesta aba — o que se perde é a memória entre aberturas, e é
      infinitamente melhor que uma exceção no meio de um clique.
    */
  }
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarPastas(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerPastas(): readonly Pasta[] {
  return pastas;
}

/** Um ID que não colide e não depende de relógio nem de aleatório. */
let contador = 0;

export function criarPasta(nome: string, servidores: readonly string[]): void {
  contador += 1;
  const id = `p${contador}-${servidores[0] ?? "vazia"}`;
  gravar([
    ...pastas,
    {
      id,
      nome: nome.trim() || "Pasta",
      servidores: [...servidores],
      colapsada: false,
      cor: COR_PADRAO,
      sempreExpandida: false,
    },
  ]);
}

export function renomearPasta(id: string, nome: string): void {
  gravar(
    pastas.map((p) => (p.id === id ? { ...p, nome: nome.trim() || p.nome } : p)),
  );
}

/**
 * Desfaz a pasta. Os servidores voltam a ser soltos, nunca somem.
 *
 * É a diferença entre "remover a pasta" e "remover os servidores", e confundir
 * as duas é o defeito clássico desta interface: quem apaga uma pasta espera
 * perder o AGRUPAMENTO, não sair de cinco servidores.
 */
export function removerPasta(id: string): void {
  gravar(pastas.filter((p) => p.id !== id));
}

/**
 * Grava nome, cor e a preferência de expansão de uma vez.
 *
 * Um só `editarPasta` em vez de três setters: o editor salva tudo junto ao
 * fechar, e três gravações seguidas dariam três escritas no `localStorage` e
 * três publicações para o rail redesenhar.
 */
export function editarPasta(
  id: string,
  dados: {
    readonly nome?: string;
    readonly cor?: string;
    readonly sempreExpandida?: boolean;
    /**
     * A lista inteira, na ordem — nunca um "mover de A para B".
     *
     * ⚠ **Ela existe porque `Remover` APLICAVA NA HORA e `Cancelar` não
     * desfazia.** O editor é um modal com rodapé de Cancelar/Salvar, e uma
     * ação que escapa dele torna o Cancelar uma promessa falsa: quem tira
     * três servidores e desiste não recupera nenhum.
     *
     * Lista inteira e não operação porque o editor já tem a ordem final na
     * mão — mandar o delta obrigaria os dois lados a concordar sobre o
     * estado de partida, que é justamente o que o modal não garante.
     *
     * Lista VAZIA desfaz a pasta, pela mesma regra de `moverParaPasta`: caixa
     * vazia permanente no rail é ruído que ninguém vai limpar depois.
     */
    readonly servidores?: readonly string[];
  },
): void {
  const novas = pastas.map((p) =>
    p.id === id
      ? {
          ...p,
          nome: dados.nome?.trim() || p.nome,
          cor: corDePastaValida(dados.cor) ? dados.cor : p.cor,
          sempreExpandida: dados.sempreExpandida ?? p.sempreExpandida,
          /* Filtra pelos que JÁ estavam dentro: o editor não é caminho de
             entrada, e aceitar um ID qualquer daqui deixaria o mesmo servidor
             em duas pastas — que é o estado que `moverParaPasta` tira de onde
             está antes de pôr justamente para impedir. */
          servidores:
            dados.servidores === undefined
              ? p.servidores
              : dados.servidores.filter((s) => p.servidores.includes(s)),
        }
      : p,
  );

  gravar(novas.filter((p) => p.servidores.length > 0));
}

/**
 * O colapso AUTOMÁTICO ao trocar de servidor.
 *
 * ⚠ **Ele não existia, e por isso "Mostrar sempre expandida" não controlava
 * nada** — o interruptor só bloqueava o colapso MANUAL, ou seja prometia
 * ignorar uma regra que o app não tinha. A regra é a do design: ao abrir um
 * servidor, as pastas que não o contêm se fecham.
 *
 * FECHA as outras e nunca ABRE a de destino: abrir seria o app desfazer um
 * colapso que alguém acabou de pedir. Quem entra num servidor dentro de uma
 * pasta fechada já a abriu para clicar nele.
 *
 * Só grava se ALGUMA mudou — sem isso, todo clique no mesmo servidor
 * escreveria no `localStorage` e republicaria o rail inteiro.
 */
export function colapsarPastasAoTrocarDeServidor(serverId: string): void {
  let mudou = false;
  const novas = pastas.map((p) => {
    if (p.sempreExpandida || p.colapsada) return p;
    if (p.servidores.includes(serverId)) return p;
    mudou = true;
    return { ...p, colapsada: true };
  });
  if (mudou) gravar(novas);
}

export function alternarColapsoDaPasta(id: string): void {
  gravar(
    pastas.map((p) =>
      /* `sempreExpandida` VENCE o clique de colapsar. Se não vencesse, a
         preferência seria só um colapso desfeito que o próximo clique refaz —
         e o controle no editor não controlaria nada. */
      p.id === id && !p.sempreExpandida ? { ...p, colapsada: !p.colapsada } : p,
    ),
  );
}

/**
 * Move um servidor para uma pasta, ou para fora de todas.
 *
 * Tira de onde estiver ANTES de pôr: sem isso um servidor movido entre pastas
 * apareceria nas duas, e o rail o desenharia duas vezes.
 */
export function moverParaPasta(serverId: string, pastaId: string | null): void {
  const semEle = pastas.map((p) => ({
    ...p,
    servidores: p.servidores.filter((s) => s !== serverId),
  }));

  const com =
    pastaId === null
      ? semEle
      : semEle.map((p) =>
          p.id === pastaId ? { ...p, servidores: [...p.servidores, serverId] } : p,
        );

  // Pasta que ficou vazia deixa de existir: uma caixa vazia permanente no rail
  // é ruído que ninguém vai limpar depois.
  gravar(com.filter((p) => p.servidores.length > 0));
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparPastas(): void {
  pastas = [];
  contador = 0;
}

/* ------------------------------------------------------------ agrupamento */

export type ItemDoRail =
  | { readonly tipo: "pasta"; readonly pasta: Pasta }
  | { readonly tipo: "servidor"; readonly id: string };

/**
 * A ordem final do rail: pastas primeiro, soltos depois.
 *
 * ⚠ **Filtra pelos IDs que EXISTEM.** Uma pasta guardada no dispositivo pode
 * citar servidor do qual a pessoa saiu — e desenhar um ladrilho para um
 * servidor que não está mais na sessão daria um item que não abre nada.
 *
 * Roda no RENDER e não no store, de propósito: ela depende de duas fontes (as
 * pastas e a lista de servidores do adapter), e um valor derivado guardado no
 * store precisaria ser invalidado quando qualquer uma mudasse. São dezenas de
 * itens; o React Compiler memoiza o corpo do componente.
 */
export function agrupar(
  ids: readonly string[],
  lista: readonly Pasta[],
): readonly ItemDoRail[] {
  const existe = new Set(ids);
  const dentroDePasta = new Set<string>();

  const grupos: ItemDoRail[] = [];
  for (const p of lista) {
    const servidores = p.servidores.filter((s) => existe.has(s));
    if (servidores.length === 0) continue;
    for (const s of servidores) dentroDePasta.add(s);
    grupos.push({ tipo: "pasta", pasta: { ...p, servidores } });
  }

  const soltos: ItemDoRail[] = ids
    .filter((id) => !dentroDePasta.has(id))
    .map((id) => ({ tipo: "servidor", id }));

  return [...grupos, ...soltos];
}
