import { sigla } from "../lib/sigla";
import { client } from "./client";

export type AlvoDeMencao = {
  readonly id: string;
  readonly nome: string;
  readonly username: string;
  readonly sigla: string;
};

const TETO = 8;

export function alvosDeMencao(
  ids: readonly string[],
  serverId: string,
  query: string,
): AlvoDeMencao[] {
  const q = query.toLowerCase();
  const out: AlvoDeMencao[] = [];
  for (const id of ids) {
    const user = client.users.get(id);
    if (!user) continue;
    const membro = serverId
      ? client.serverMembers.getByKey({ server: serverId, user: id })
      : undefined;
    const nome = String(membro?.nickname || user.displayName || user.username);
    const username = String(user.username);
    if (q && !nome.toLowerCase().includes(q) && !username.toLowerCase().includes(q)) {
      continue;
    }
    out.push({ id, nome, username, sigla: sigla(nome) });
    if (out.length >= TETO) break;
  }
  return out;
}
