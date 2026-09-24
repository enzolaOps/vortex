import type { ChannelSnapshot, EstadoDeVoz } from "../sdk/domain";
import type { EstadoDaChamada, QualidadeDeVoz } from "../store/chamada";

/**
 * As decisões da grade da chamada que não precisam de DOM — puras, para terem
 * teste sem montar a tela.
 */

/**
 * Quantas pessoas CABEM nesta chamada — o "25" de "7 de 25 na chamada"
 * (D-VOZ-25).
 *
 * ⚠ **Duas fontes, e cada uma responde uma pergunta diferente.** No grupo de
 * DM o total é quem FAZ PARTE do grupo: são as pessoas que poderiam entrar, e
 * "7 de 25" diz quantas do grupo estão aqui agora. No canal de servidor não há
 * lista de quem poderia — o servidor inteiro pode —, então o único teto
 * verdadeiro é o `limite` da sala. Sem nenhum dos dois, `undefined`: inventar
 * um denominador ("de 99") seria afirmar um teto que ninguém configurou.
 */
export function capacidadeDaChamada(
  canal: Pick<ChannelSnapshot, "tipo" | "participantes" | "limite"> | undefined,
): number | undefined {
  if (!canal) return undefined;
  if (canal.tipo === "grupo") {
    return canal.participantes > 0 ? canal.participantes : undefined;
  }
  return canal.limite;
}

/**
 * "N na chamada" ou "N de M na chamada".
 *
 * ⚠ **O "de M" some quando não diz nada.** Com todo mundo dentro, "5 de 5"
 * repete o número; e com o total MENOR que a contagem (o grupo perdeu alguém
 * que ainda não caiu da sala, ou quem modera furou o teto — `ManageChannel`
 * fura no servidor), "6 de 5" afirmaria uma impossibilidade.
 */
export function contagemDaChamada(n: number, capacidade: number | undefined): string {
  const base = String(n);
  if (capacidade === undefined || capacidade <= n) return `${base} na chamada`;
  return `${base} de ${String(capacidade)} na chamada`;
}

/**
 * O adjetivo do chip de qualidade do cabeçalho — o "excelente" de "excelente ·
 * 38 ms" (D-DVM-11).
 *
 * ⚠ **Mais curto que o da faixa de voz, e de propósito.** A faixa diz
 * "conexão ótima" porque ela é uma linha sozinha no rodapé; aqui o chip divide
 * o cabeçalho com canal, servidor, contagem e cronômetro, e o design escreve
 * uma palavra. O TOM decide a cor e não o texto — mesma classificação do
 * `QualidadeDeVoz`, sem inventar milissegundos a partir dela: o número ao lado
 * é o RTT medido (ver `Rtt`), ausente enquanto não há amostra.
 *
 * `Record` fechado: variante nova de qualidade não compila até ganhar texto.
 */
export type TomDoChip = "bom" | "aviso" | "perigo" | "neutro";

const CHIP_DA_QUALIDADE: Record<
  QualidadeDeVoz,
  { readonly texto: string; readonly tom: TomDoChip }
> = {
  otima: { texto: "excelente", tom: "bom" },
  boa: { texto: "boa", tom: "bom" },
  ruim: { texto: "instável", tom: "aviso" },
  perdida: { texto: "perdida", tom: "perigo" },
  desconhecida: { texto: "medindo", tom: "neutro" },
};

/**
 * O chip inteiro: texto, tom e se o RTT entra ao lado.
 *
 * ⚠ **O estado da CONEXÃO ganha do da qualidade**, a mesma regra da faixa de
 * voz: durante "reconectando…" a qualidade anterior é história, e "excelente"
 * ali diria o contrário do que está acontecendo. E o RTT só aparece DENTRO —
 * medido antes do ICE nomear um par, ele não existe.
 */
export function chipDaConexao(
  estado: EstadoDaChamada,
  qualidade: QualidadeDeVoz,
): { readonly texto: string; readonly tom: TomDoChip; readonly comRtt: boolean } {
  if (estado === "conectando") return { texto: "entrando…", tom: "neutro", comRtt: false };
  if (estado === "reconectando") {
    return { texto: "reconectando…", tom: "perigo", comRtt: false };
  }
  return { ...CHIP_DA_QUALIDADE[qualidade], comRtt: estado === "dentro" };
}

/**
 * O estado que a placa de nome mostra, no formato que `iconesDoParticipante`
 * entende (D-DVM-14, D-VOZ-29).
 *
 * ⚠ **Duas fontes por pessoa, e a regra de quem ganha é a mesma da grade.**
 * Você não está nas listas varridas do LiveKit (`comCamera`, `mudos`): o seu
 * estado de transporte mora em `Chamada.camera/mudo/surdo`. Os outros vêm das
 * listas — e o SURDO dos outros vem do protocolo (`is_receiving`), porque o
 * LiveKit não publica se alguém está ouvindo: não existe faixa para "não
 * ouço". O que o SERVIDOR impôs vem sempre do protocolo, inclusive o seu —
 * é o único estado que você não desfaz, e o LiveKit não sabe dele.
 */
export function estadoDaPlaca(p: {
  transmitindo: boolean;
  camera: boolean;
  mudo: boolean;
  surdo: boolean;
  mudoPeloServidor: boolean;
  surdoPeloServidor: boolean;
}): {
  estado: EstadoDeVoz;
  mudo: boolean;
  surdo: boolean;
  mudoPeloServidor: boolean;
  surdoPeloServidor: boolean;
} {
  return {
    estado: p.transmitindo ? "tela" : p.camera ? "video" : "voz",
    mudo: p.mudo,
    surdo: p.surdo,
    mudoPeloServidor: p.mudoPeloServidor,
    surdoPeloServidor: p.surdoPeloServidor,
  };
}
