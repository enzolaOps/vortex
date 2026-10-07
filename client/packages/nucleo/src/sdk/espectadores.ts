/**
 * O atributo de participante que diz o que cada pessoa está assistindo.
 *
 * ⚠ **Por que existe.** Quem publica uma tela não recebe do LiveKit a lista de
 * quem a assina — isso só existe como webhook de servidor, e os webhooks do
 * LiveKit não têm evento de assinatura. O caminho que sobra é cada cliente
 * ANUNCIAR o que assiste num atributo próprio (o token passou a conceder
 * `can_update_own_metadata`, ver `voice_client.rs`), e todo mundo na sala ler
 * os atributos dos outros.
 *
 * ⚠ **Atributo é escrito pelo próprio cliente.** Serve para EXIBIÇÃO — contar
 * espectadores e dizer em que qualidade cada um recebe — e nunca para
 * autorização. Por isso a leitura aqui é defensiva: valor malformado, grande
 * demais ou com dono inventado vira ausência, nunca exceção nem texto cru na
 * tela.
 *
 * Módulo puro, sem `livekit-client`: o motor escreve, o store lê, e os dois
 * falam este formato.
 */

import type { Assistindo } from "../store/espectadores";

/** A chave do atributo. Prefixo `vx.` para não colidir com a de outro cliente. */
export const CHAVE_ASSISTE = "vx.assiste";

/**
 * Teto do valor, em caracteres.
 *
 * O LiveKit limita o tamanho total de metadata/atributos no servidor; aqui o
 * teto é do CLIENTE, bem abaixo, para um anúncio nunca ser a razão de uma
 * escrita recusada — e para quem LÊ não parsear um valor gigante que outro
 * cliente escreveu.
 */
export const TETO_DO_VALOR = 256;

/** Quantas transmissões um anúncio carrega. A sala raramente tem mais de 2. */
export const MAXIMO_DE_ENTRADAS = 4;

/** ID de usuário (ULID) ou o que o arnês usa: curto, sem separadores. */
const DONO_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Formato: entradas separadas por `;`, campos por `,` — `dono,altura,flags`.
 * `flags` é `r` (rede) e/ou `c` (cheia). Ex.: `01H…,1080,` · `01H…,720,r`.
 *
 * Compacto e não JSON: cabe quatro entradas com folga no teto, e um formato
 * sem aninhamento não tem como carregar estrutura inesperada.
 */
export function codificarAssistindo(lista: readonly Assistindo[]): string {
  const partes: string[] = [];
  for (const a of lista.slice(0, MAXIMO_DE_ENTRADAS)) {
    if (!DONO_VALIDO.test(a.dono)) continue;
    const altura =
      a.altura !== undefined && Number.isFinite(a.altura) && a.altura > 0
        ? String(Math.round(a.altura))
        : "";
    partes.push(`${a.dono},${altura},${a.rede ? "r" : ""}${a.cheia ? "c" : ""}`);
  }
  return partes.join(";");
}

const VAZIO: readonly Assistindo[] = [];

export function decodificarAssistindo(
  valor: string | undefined,
): readonly Assistindo[] {
  if (!valor || valor.length > TETO_DO_VALOR) return VAZIO;
  const lista: Assistindo[] = [];
  const vistos = new Set<string>();
  for (const entrada of valor.split(";")) {
    if (lista.length >= MAXIMO_DE_ENTRADAS) break;
    const [dono, alturaCrua, flags] = entrada.split(",");
    if (dono === undefined || !DONO_VALIDO.test(dono) || vistos.has(dono)) continue;
    vistos.add(dono);
    const numero = alturaCrua ? Number(alturaCrua) : NaN;
    const altura =
      Number.isInteger(numero) && numero > 0 && numero <= 8640 ? numero : undefined;
    lista.push({
      dono,
      ...(altura === undefined ? {} : { altura }),
      rede: flags?.includes("r") ?? false,
      cheia: flags?.includes("c") ?? false,
    });
  }
  return lista.length === 0 ? VAZIO : lista;
}

/**
 * Recebe abaixo do que é publicado SEM ter pedido menos?
 *
 * Margem de 10% porque captura de tela sai com alturas quebradas (1078, 1076)
 * e o simulcast arredonda camadas; "(rede)" sobre um quadro de 2px a menos
 * acusaria a conexão de alguém por aritmética.
 */
export function limitadoPelaRede(
  recebida: number | undefined,
  publicada: number | undefined,
  pediuMenos: boolean,
): boolean {
  if (pediuMenos || recebida === undefined || publicada === undefined) return false;
  return recebida < publicada * 0.9;
}
