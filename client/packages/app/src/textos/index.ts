import { admin } from "./admin";
import { chat } from "./chat";
import { comum } from "./comum";
import { config } from "./config";
import { salas } from "./salas";
import { sessao } from "./sessao";
import { voz } from "./voz";

export { admin, chat, comum, config, salas, sessao, voz };

/** Todos os módulos, para o teste varrer o catálogo inteiro. */
export const catalogo = { comum, sessao, salas, chat, voz, config, admin } as const;
