import type { ChannelSnapshot, EstadoDeVoz, ParticipanteDeVoz } from "../sdk/domain";
import type { Chamada, EstadoDaChamada, QualidadeDeVoz } from "../store/chamada";

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

/* ============================================================
   Quem é quem na chamada
   ============================================================ */

/**
 * O estado de UMA pessoa da chamada, das duas fontes que o descrevem.
 *
 * ⚠ **A regra "você vem de `Chamada`, os outros vêm das listas" estava
 * escrita à mão em três lugares, e um deles a escreveu pela metade** — a
 * linha da coluna lateral do palco de transmissão só olhava `chamada.mudo`
 * e só para `participantes[0]`, então o ícone de mudo aparecia para VOCÊ e
 * nunca para mais ninguém (D-DVM-15). Uma função só é o que impede a quarta
 * cópia de errar de novo.
 *
 * Você não está em `comCamera`, `mudos` nem `transmitindo`: o seu estado de
 * transporte mora em `Chamada.camera/mudo/tela/surdo`, e duplicá-lo nas
 * listas daria duas fontes para o mesmo fato. O SURDO dos outros vem do
 * protocolo (`is_receiving`) — o LiveKit não publica "não ouço". E o que o
 * SERVIDOR impôs vem sempre do protocolo, inclusive o seu.
 */
export type EstadoNaChamada = {
  readonly eu: boolean;
  readonly camera: boolean;
  readonly transmitindo: boolean;
  readonly mudo: boolean;
  readonly surdo: boolean;
  readonly mudoPeloServidor: boolean;
  readonly surdoPeloServidor: boolean;
};

export function estadoNaChamada(
  chamada: Pick<
    Chamada,
    | "participantes"
    | "camera"
    | "comCamera"
    | "tela"
    | "transmitindo"
    | "mudo"
    | "mudos"
    | "surdo"
  >,
  sala: readonly Pick<
    ParticipanteDeVoz,
    "userId" | "surdo" | "mudoPeloServidor" | "surdoPeloServidor"
  >[],
  userId: string,
): EstadoNaChamada {
  const eu = userId === chamada.participantes[0];
  const doProtocolo = sala.find((p) => p.userId === userId);
  return {
    eu,
    camera: eu ? chamada.camera : chamada.comCamera.includes(userId),
    transmitindo: eu ? chamada.tela : chamada.transmitindo.includes(userId),
    mudo: eu ? chamada.mudo : chamada.mudos.includes(userId),
    surdo: eu ? chamada.surdo : doProtocolo?.surdo === true,
    mudoPeloServidor: doProtocolo?.mudoPeloServidor === true,
    surdoPeloServidor: doProtocolo?.surdoPeloServidor === true,
  };
}

/**
 * A segunda linha e o tom de uma pessoa na lista "Na chamada" (D-DVM-15).
 *
 * UMA palavra por pessoa, como o design — cinco linhas, cinco estados. A
 * ordem é a do que quem vai falar com ela precisa saber PRIMEIRO: não ouve >
 * não pode falar > está falando > o que ela mostra. Ensurdecido implica mudo,
 * então vem antes; falando não convive com mudo (o anel só acende com áudio
 * publicado).
 *
 * O TOM decide a cor do NOME, e é o que o design pinta: o nome de quem fala
 * no acento, o de quem está mudo no vermelho de texto, o de quem transmite no
 * aviso. O restante fica no tom de sempre.
 *
 * `texto` ausente quando não há nada a dizer — "conectado" numa lista chamada
 * "Na chamada" repetiria o título em cada linha.
 */
export type TomNaLista = "falando" | "mudo" | "tela" | "neutro";

export function rotuloNaLista(
  e: EstadoNaChamada,
  falando: boolean,
): {
  readonly texto: string | undefined;
  readonly tom: TomNaLista;
  readonly esmaecido: boolean;
} {
  if (e.surdoPeloServidor) {
    return { texto: "ensurdecido pelo servidor", tom: "neutro", esmaecido: true };
  }
  if (e.surdo) return { texto: "ensurdecido", tom: "neutro", esmaecido: true };
  if (e.mudoPeloServidor) {
    return { texto: "silenciado pelo servidor", tom: "mudo", esmaecido: false };
  }
  if (e.mudo) return { texto: "mudo", tom: "mudo", esmaecido: false };
  if (falando) return { texto: "falando", tom: "falando", esmaecido: false };
  if (e.transmitindo) {
    return { texto: "compartilhando tela", tom: "tela", esmaecido: false };
  }
  if (e.camera) return { texto: "vídeo ligado", tom: "neutro", esmaecido: false };
  return { texto: undefined, tom: "neutro", esmaecido: false };
}

/* ============================================================
   Disposição
   ============================================================ */

/**
 * Quantos ladrilhos a grade desenha antes de a sala virar fila (D-VOZ-26).
 *
 * "acima de 16, os últimos entram como fila de avatares" — o número é do
 * design. Com 17 pessoas em cinco colunas a célula já é do tamanho de um
 * rosto; o que vem depois é presença, não conteúdo.
 */
export const TETO_DE_LADRILHOS = 16;

/**
 * Parte a sala entre ladrilhos e fila.
 *
 * ⚠ **Quem está em DESTAQUE nunca vai para a fila.** A célula grande do
 * orador (ou a fixada) é justamente quem a pessoa quer ver; se o orador for o
 * 20º a entrar, mandá-lo para a fila deixaria a disposição "Orador ativo" sem
 * orador. Ele troca de lugar com o último ladrilho.
 */
export function repartirGrade(
  ids: readonly string[],
  destaque: string | undefined,
  teto: number = TETO_DE_LADRILHOS,
): { readonly ladrilhos: readonly string[]; readonly fila: readonly string[] } {
  if (ids.length <= teto) return { ladrilhos: ids, fila: [] };
  const ladrilhos = ids.slice(0, teto);
  const fila = ids.slice(teto);
  const i = destaque === undefined ? -1 : fila.indexOf(destaque);
  const saindo = ladrilhos[teto - 1];
  if (i >= 0 && destaque !== undefined && saindo !== undefined) {
    ladrilhos[teto - 1] = destaque;
    fila[i] = saindo;
  }
  return { ladrilhos, fila };
}

/** A histerese do design: "sem isso a grade pisca a cada interjeição". */
export const HISTERESE_MS = 1200;

export type EstadoDoOrador = {
  readonly orador: string | undefined;
  /** Desde quando o orador atual está calado — ausente enquanto fala. */
  readonly caladoDesde: number | undefined;
};

export const ORADOR_INICIAL: EstadoDoOrador = {
  orador: undefined,
  caladoDesde: undefined,
};

/**
 * Quem ocupa a célula grande na disposição "Orador ativo" (D-VOZ-27).
 *
 * ⚠ **UMA célula, decidida no nível da grade, e não uma histerese por
 * ladrilho.** A versão anterior dava a cada ladrilho a própria histerese: com
 * duas pessoas conversando, as duas ficavam 2×2 ao mesmo tempo durante 1,2 s
 * a cada troca de turno — a grade se reorganizava inteira, que é o piscar que
 * a histerese existia para impedir.
 *
 * A regra, e a assimetria é o ponto:
 * - sem orador, o primeiro a falar assume NA HORA;
 * - o orador que fala fica;
 * - o orador calado só perde a célula depois de 1,2 s calado E se houver
 *   outra pessoa falando — sala em silêncio mantém quem falou por último,
 *   porque trocar para ninguém também é piscar;
 * - orador que saiu da sala é substituído na hora.
 *
 * `revisarEm` é quanto falta para a histerese vencer: quem chama agenda uma
 * nova avaliação para esse instante, porque a troca pode acontecer sem
 * nenhum evento de fala novo (o outro já estava falando).
 */
export function proximoOrador(
  estado: EstadoDoOrador,
  falandoAgora: readonly string[],
  presentes: readonly string[],
  agora: number,
  histerese: number = HISTERESE_MS,
): { readonly estado: EstadoDoOrador; readonly revisarEm: number | undefined } {
  const { orador } = estado;
  const outro = falandoAgora.find((id) => id !== orador && presentes.includes(id));

  if (orador === undefined || !presentes.includes(orador)) {
    return { estado: { orador: outro, caladoDesde: undefined }, revisarEm: undefined };
  }
  if (falandoAgora.includes(orador)) {
    return { estado: { orador, caladoDesde: undefined }, revisarEm: undefined };
  }

  const caladoDesde = estado.caladoDesde ?? agora;
  const calado = agora - caladoDesde;
  if (outro !== undefined && calado >= histerese) {
    return { estado: { orador: outro, caladoDesde: undefined }, revisarEm: undefined };
  }
  return {
    estado: { orador, caladoDesde },
    revisarEm: outro === undefined ? undefined : histerese - calado,
  };
}
