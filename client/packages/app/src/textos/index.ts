import { admin } from "./admin";
import { casa } from "./casa";
import { chat } from "./chat";
import { comum } from "./comum";
import { config } from "./config";
import { ds } from "./ds";
import { salas } from "./salas";
import { shell } from "./shell";
import { sessao } from "./sessao";
import { voz } from "./voz";

export { admin, casa, chat, comum, config, ds, salas, sessao, shell, voz };

/** Todos os módulos, para o teste varrer o catálogo inteiro. */
export const catalogo = { casa, comum, sessao, salas, chat, voz, config, admin, ds, shell } as const;
