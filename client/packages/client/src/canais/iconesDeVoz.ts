import type { ParticipanteDeVoz } from "../sdk/domain";

/**
 * Os ícones de estado de uma linha da sala de voz — e o TETO de três.
 *
 * O design: *"a linha do conectado tem 30 px de altura e comporta no máximo
 * três ícones de estado à direita; acima disso, os menos críticos colapsam num
 * '+2' com tooltip"* (D-VOZ-02). Sem teto, alguém transmitindo, ensurdecido e
 * silenciado pelo servidor empilhava quatro glifos e a sigla `SRV` numa coluna
 * de 232px — o nome encolhia até virar reticência.
 *
 * Puro, para o teto e a ordem de colapso terem teste sem DOM.
 */
export type IconeDeVoz =
  | "srvSurdo"
  | "srvMudo"
  | "tela"
  | "video"
  | "surdo"
  | "mudo";

export const TETO_DE_ICONES = 3;

/**
 * Do MAIS ao menos crítico — quem sobra na linha quando não cabe tudo.
 *
 * Imposição do servidor primeiro: é o único estado que a pessoa NÃO desfaz, e
 * quem espera resposta dela precisa saber que ela não pode falar. Depois o que
 * ela escolheu (surdo antes de mudo: surdo nem ouve a pergunta). Por último o
 * que ela publica — tela e câmera se veem no palco de quem entra.
 */
const CRITICIDADE: readonly IconeDeVoz[] = [
  "srvSurdo",
  "srvMudo",
  "surdo",
  "mudo",
  "tela",
  "video",
];

/**
 * A ordem em que os ícones aparecem na linha — a de antes do teto, que não
 * muda: estado de publicação, depois o que o servidor impôs, depois o
 * microfone. O teto escolhe QUEM fica; não reordena quem ficou.
 */
const ORDEM_NA_LINHA: readonly IconeDeVoz[] = [
  "tela",
  "video",
  "srvSurdo",
  "srvMudo",
  "surdo",
  "mudo",
];

/** O que o leitor de tela ouve, e o que o tooltip do "+N" lista. */
export const ROTULO_DO_ICONE: Record<IconeDeVoz, string> = {
  srvSurdo: "ensurdecido pelo servidor",
  srvMudo: "silenciado pelo servidor",
  tela: "compartilhando a tela",
  video: "com a câmera ligada",
  surdo: "sem ouvir",
  mudo: "com o microfone desligado",
};

type Estado = Pick<
  ParticipanteDeVoz,
  "estado" | "mudo" | "surdo" | "mudoPeloServidor" | "surdoPeloServidor"
>;

/** Todos os ícones que o estado pede, antes do teto. */
function todos(p: Estado): Set<IconeDeVoz> {
  const s = new Set<IconeDeVoz>();
  if (p.estado === "tela") s.add("tela");
  else if (p.estado === "video") s.add("video");
  if (p.surdoPeloServidor) s.add("srvSurdo");
  if (p.mudoPeloServidor) s.add("srvMudo");
  /* Surdo IMPLICA mudo no protocolo; mostrar os dois diria a mesma coisa duas
     vezes numa linha de 205px. O fone ganha, porque é o estado maior. */
  if (p.surdo) s.add("surdo");
  else if (p.mudo) s.add("mudo");
  return s;
}

export function iconesDoParticipante(
  p: Estado,
  teto = TETO_DE_ICONES,
): {
  readonly visiveis: readonly IconeDeVoz[];
  readonly recolhidos: readonly IconeDeVoz[];
} {
  const pedidos = todos(p);
  const ficam = new Set(
    CRITICIDADE.filter((i) => pedidos.has(i)).slice(0, teto),
  );
  return {
    visiveis: ORDEM_NA_LINHA.filter((i) => ficam.has(i)),
    recolhidos: CRITICIDADE.filter((i) => pedidos.has(i) && !ficam.has(i)),
  };
}
