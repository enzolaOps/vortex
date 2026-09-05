/**
 * A barra de "alterações não salvas", publicada pela PÁGINA e desenhada pela
 * CASCA.
 *
 * ⚠ **Existe porque a casca não é dona do estado sujo, e a barra é rodapé do
 * PANE.** A referência resolve isso com uma prop `saveBar` no `SettingsShell`,
 * passada pela tela que possui o formulário. Aqui a casca renderiza
 * `CONTEUDO[secao]()` e não conhece a página — então a página publica e a
 * casca assina, que é a lei nº 1 aplicada a uma superfície fria.
 *
 * ⚠ **Store module-level e não Context**, pelo mesmo motivo de sempre: quem
 * publica é um efeito dentro de um formulário, e quem consome é um irmão do
 * scroller. Context obrigaria um provider em volta dos dois, e o único lugar
 * onde ele caberia é a casca — que voltaria a conhecer a página.
 *
 * O que isto CONSERTA, além de servir ao Perfil do servidor: o scroller
 * reservava `--vx-config-rodape-h` (110px) o tempo todo, em TODA página de
 * configuração, para uma barra que aparece em duas. Com ela fora do scroller,
 * a reserva passa a ser condicional e do tamanho que a referência usa.
 */
export type BarraDeSalvar = {
  /** O que aparece à esquerda. Vazio usa o texto padrão. */
  readonly recado?: string;
  readonly aoDescartar: () => void;
  readonly aoSalvar: () => void;
  /** Trava os dois botões enquanto o servidor responde. */
  readonly salvando: boolean;
};

let barra: BarraDeSalvar | undefined = undefined;
const ouvintes = new Set<() => void>();

export function assinarBarraDeSalvar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * ⚠ **Devolve a MESMA referência enquanto nada muda** — é a armadilha nº 1 do
 * briefing. Montar o objeto aqui daria um snapshot novo a cada leitura e o
 * `useSyncExternalStore` entraria em laço, que se manifesta como aba travando
 * e não como erro.
 */
export function lerBarraDeSalvar(): BarraDeSalvar | undefined {
  return barra;
}

/**
 * A página publica; `undefined` retira.
 *
 * ⚠ **Chamar com o mesmo conteúdo NÃO emite.** A página publica de dentro de
 * um efeito que roda a cada tecla digitada no formulário; sem esta comparação,
 * cada caractere acordaria a casca inteira. Comparação por campo e não por
 * referência, porque quem chama monta o objeto no efeito — por referência
 * nunca seria igual.
 */
export function definirBarraDeSalvar(nova: BarraDeSalvar | undefined): void {
  const igual =
    (barra === undefined && nova === undefined) ||
    (barra !== undefined &&
      nova !== undefined &&
      barra.recado === nova.recado &&
      barra.salvando === nova.salvando &&
      barra.aoDescartar === nova.aoDescartar &&
      barra.aoSalvar === nova.aoSalvar);
  if (igual) return;

  barra = nova;
  for (const o of ouvintes) o();
}
