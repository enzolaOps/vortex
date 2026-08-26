/**
 * A instância do SDK.
 *
 * `new Client()` NÃO conecta — a conexão só acontece em `connect()`/login. Isso
 * é o que permite o spike rodar contra o SDK de verdade, com hidratação e
 * reatividade reais, sem backend e sem rede.
 */
import { Client } from "stoat.js";

export const client = new Client();
