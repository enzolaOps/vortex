/**
 * Expulsar, banir e castigar — uma pessoa ou várias.
 *
 * ⚠ **Sempre em lote, mesmo para uma pessoa.** O modal de moderação é o único
 * chamador, e ele trata "uma" como lote de um: a falha aparece na mesma faixa,
 * com o mesmo "Tentar de novo". Duas funções por ação (uma e várias) seriam
 * dois caminhos de erro que precisam concordar.
 *
 * Uma chamada por pessoa, com simultaneidade baixa e 429 honrado — o porquê
 * está em `lib/lote.ts`. O protocolo não tem moderação em lote.
 *
 * ⚠ **Rota direta e não `Server.kickUser`/`banUser`/`ServerMember.setTimeout`.**
 * Os três métodos do SDK não aceitam cabeçalho, e o motivo de auditoria mora
 * num (`X-Audit-Log-Reason`, lido por `member_remove`, `member_edit` e
 * `ban_create` no `delta`). E `setTimeout` exige o membro em cache — num lote
 * vindo da página de Membros, nem todo selecionado precisa estar.
 *
 * ⚠ **`delete_message_seconds` não está nos tipos do `stoat-api`**, mas está no
 * `DataBanCreate` do servidor (0..604800). O submódulo `stoat.js` aponta para o
 * upstream, então o campo entra AQUI, tipado por este módulo. `client.api.put`
 * numa rota CONHECIDA copia todo parâmetro não-query para o corpo — a armadilha
 * de `requisicaoCrua.ts` só vale para rota que o `stoat-api` não conhece.
 */
import { client } from "./client";
import { esperaDoLimite, motivoDoErro } from "./erros";
import { executarEmLote, type ResultadoDeLote } from "../lib/lote";

/** Teto do servidor para o cabeçalho (`HeaderTooLarge` acima disto). */
const TETO_DO_MOTIVO_EM_BYTES = 512;

/** Janelas de "Excluir mensagens recentes", em segundos. */
export const JANELAS_DE_EXCLUSAO = [0, 3600, 86_400, 604_800] as const;
export type JanelaDeExclusao = (typeof JANELAS_DE_EXCLUSAO)[number];

/**
 * O cabeçalho de auditoria para um motivo, ou nenhum.
 *
 * ⚠ **Bytes UTF-8 escritos como byte-string, e não o texto cru.** Valor de
 * cabeçalho no `fetch` é byte-string: um caractere acima de U+00FF (emoji,
 * travessão) LANÇA `TypeError` antes de sair, e um acentuado de Latin-1 ("ç")
 * sai como UM byte 0xE7 — que o servidor lê como UTF-8 inválido. Moderação em
 * português tem acento em quase todo motivo. Escrever cada byte UTF-8 como um
 * caractere faz o `fetch` mandar exatamente os bytes UTF-8, que é o que o
 * `delta` decodifica.
 *
 * Quebra de linha vira espaço (cabeçalho não tem linha), e o corte é em 512
 * BYTES sem partir caractere — cortar no meio de um multibyte deixaria UTF-8
 * inválido no fim, e o servidor recusaria o motivo inteiro.
 */
export function cabecalhoDeMotivo(motivo: string | undefined): Record<string, string> {
  const limpo = (motivo ?? "").replace(/[\r\n\t]+/g, " ").trim();
  if (limpo === "") return {};

  const codificador = new TextEncoder();
  let bytes = new Uint8Array(0);
  for (const caractere of limpo) {
    const proximo = codificador.encode(caractere);
    if (bytes.length + proximo.length > TETO_DO_MOTIVO_EM_BYTES) break;
    const juntos = new Uint8Array(bytes.length + proximo.length);
    juntos.set(bytes);
    juntos.set(proximo, bytes.length);
    bytes = juntos;
  }

  let byteString = "";
  for (const b of bytes) byteString += String.fromCharCode(b);
  return { "X-Audit-Log-Reason": byteString };
}

type AoProgredir = (terminados: number, total: number) => void;

function emLote(
  userIds: readonly string[],
  tarefa: (userId: string) => Promise<unknown>,
  aoProgredir: AoProgredir | undefined,
): Promise<ResultadoDeLote<string>> {
  return executarEmLote(
    userIds,
    async (userId) => {
      await tarefa(userId);
    },
    {
      concorrencia: 2,
      aoProgredir,
      esperaDe: esperaDoLimite,
      motivoDe: motivoDoErro,
    },
  );
}

/* A forma que o servidor aceita; o `stoat-api` não conhece o segundo campo. */
type CorpoDeBanimento = {
  reason?: string;
  delete_message_seconds?: number;
};

export function expulsarEmLote(
  serverId: string,
  userIds: readonly string[],
  opcoes: { motivo?: string | undefined },
  aoProgredir?: AoProgredir,
): Promise<ResultadoDeLote<string>> {
  const headers = cabecalhoDeMotivo(opcoes.motivo);
  return emLote(
    userIds,
    (userId) =>
      client.api.delete(
        `/servers/${serverId}/members/${userId}` as never,
        undefined,
        { headers } as never,
      ),
    aoProgredir,
  );
}

export function banirEmLote(
  serverId: string,
  userIds: readonly string[],
  opcoes: {
    motivo?: string | undefined;
    /** Segundos de histórico apagado em todos os canais. 0 não apaga nada. */
    excluirMensagensDe?: JanelaDeExclusao;
  },
  aoProgredir?: AoProgredir,
): Promise<ResultadoDeLote<string>> {
  const headers = cabecalhoDeMotivo(opcoes.motivo);
  const corpo: CorpoDeBanimento = {};
  const motivo = opcoes.motivo?.trim();
  /* No CORPO também: é a rede de segurança do cabeçalho (`header.or(reason)`)
     e é o que o registro de banimentos mostra. */
  if (motivo) corpo.reason = motivo;
  if (opcoes.excluirMensagensDe) corpo.delete_message_seconds = opcoes.excluirMensagensDe;
  return emLote(
    userIds,
    (userId) =>
      client.api.put(
        `/servers/${serverId}/bans/${userId}` as never,
        corpo as never,
        { headers } as never,
      ),
    aoProgredir,
  );
}

/**
 * Castigo por um tempo. Minutos e não uma data: quem modera pensa em "meia
 * hora". `0` tira o castigo.
 */
export function castigarEmLote(
  serverId: string,
  userIds: readonly string[],
  opcoes: { minutos: number; motivo?: string | undefined },
  aoProgredir?: AoProgredir,
): Promise<ResultadoDeLote<string>> {
  const headers = cabecalhoDeMotivo(opcoes.motivo);
  const corpo =
    opcoes.minutos <= 0
      ? { remove: ["Timeout"] }
      : { timeout: new Date(Date.now() + opcoes.minutos * 60_000).toISOString() };
  return emLote(
    userIds,
    (userId) =>
      client.api.patch(
        `/servers/${serverId}/members/${userId}` as never,
        corpo as never,
        { headers } as never,
      ),
    aoProgredir,
  );
}

/**
 * "Avisar por DM" do castigo (D-SRVPG-40): abre a conversa com cada pessoa e
 * manda o texto.
 *
 * ⚠ **Rota direta, e pelo mesmo motivo das três acima:** `User.openDM()` exige
 * o usuário em cache, e num lote vindo da página de Membros nem todo
 * selecionado precisa estar. `GET /users/{id}/dm` é idempotente no protocolo
 * — conversa existente volta a mesma.
 *
 * ⚠ **Só quem REALMENTE foi castigado** chega aqui: quem chama passa os
 * `feitos` do lote, nunca a seleção. Avisar alguém cujo castigo falhou seria
 * afirmar um fato que o servidor recusou.
 *
 * A falha não desfaz nada — o castigo já valeu. Quem chama só conta quantos
 * não foram avisados (privacidade de DM é o motivo comum).
 */
export function avisarPorDmEmLote(
  userIds: readonly string[],
  texto: string,
): Promise<ResultadoDeLote<string>> {
  return emLote(
    userIds,
    async (userId) => {
      const canal = (await client.api.get(`/users/${userId}/dm` as never)) as {
        _id?: string;
      };
      if (!canal._id) throw new Error("conversa sem ID");
      await client.api.post(
        `/channels/${canal._id}/messages` as never,
        { content: texto } as never,
      );
    },
    undefined,
  );
}
