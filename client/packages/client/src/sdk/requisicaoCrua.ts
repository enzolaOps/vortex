/**
 * Requisição com CORPO para rota que o `stoat-api` não conhece.
 *
 * ⚠ **`client.api.post(caminho, corpo)` DESCARTA o corpo em rota do fork, sem
 * erro nenhum.** O `req` do `stoat-api` só copia parâmetros para o corpo
 * depois de achar a rota na tabela gerada do OpenAPI (`getPathName`); rota
 * desconhecida sai com `body: "{}"`. Medido no navegador com `fetch` dublado:
 * `POST /auth/qr/create` e `POST /auth/qr/:id/exchange` saíam com `{}` — o
 * servidor recusaria o primeiro por validação e o segundo por segredo errado,
 * e a tela mostraria "expirou" para sempre.
 *
 * Rota do fork SEM corpo (`get`, `delete`, `post` vazio) continua passando por
 * `client.api`: ali não há o que perder.
 *
 * Mesmo contrato do `stoat-api` para o resto — base, cabeçalhos da sessão e o
 * TEXTO da resposta lançado em caso de erro, que é o que `erros.ts` lê.
 */
import { client } from "./client";

export async function postarCru<T>(caminho: string, corpo: unknown): Promise<T> {
  const { baseURL, headers } = client.api.config;
  const r = await fetch(`${baseURL ?? ""}${caminho}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const texto = r.status === 204 ? "" : await r.text();
  if (!r.ok) throw texto;
  return (texto ? JSON.parse(texto) : null) as T;
}
