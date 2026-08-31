/**
 * Com qual servidor este app fala.
 *
 * ⚠ **Isto faltava, e era o bloqueio raiz de tudo que depende de rede.** O
 * `new Client()` era construído sem `baseURL`, e o default do SDK é
 * `https://stoat.chat/api` — a instância PÚBLICA do Stoat. Ou seja: login,
 * criar conta, recuperar senha e todo `fetch` do adapter iam para o servidor
 * de outra gente. Não dava erro nenhum; o app simplesmente falava com o lugar
 * errado, e uma senha digitada na tela de entrada teria saído daqui.
 *
 * O caminho vem do compose (`pi-infra/compose/compose.vortex.yml`), que serve o
 * cliente e a API no MESMO domínio:
 *
 *     REVOLT__HOSTS__APP    https://${VORTEX_DOMAIN}
 *     REVOLT__HOSTS__API    https://${VORTEX_DOMAIN}/api
 *
 * Por isso o default é `/api` na MESMA ORIGEM, resolvido em runtime: ele
 * acompanha o domínio sozinho, funciona em produção, em túnel e em preview sem
 * ninguém reconstruir, e não deixa um domínio de terceiro compilado no bundle
 * esperando alguém esquecer de sobrescrevê-lo.
 *
 * ⚠ **Resolvido contra `location.origin`, e NÃO o `/api` relativo que o
 * cliente Solid usa.** O `stoat-api` monta a requisição com `new URL(path)`
 * SEM base — então um caminho relativo lança `Invalid URL` antes de qualquer
 * `fetch`, no navegador tanto quanto no Node. O default do upstream funciona
 * lá porque o `Controller` dele nunca chega a esse caminho com valor relativo;
 * aqui a suíte de testes acusou na primeira corrida, com 18 rejeições não
 * tratadas vindas do `#fetchConfiguration`.
 *
 * ⚠ **Só o `baseURL` é configurado aqui, de propósito.** O SDK busca o resto
 * do servidor no `GET {baseURL}/` assim que é construído — WebSocket
 * (`configuration.ws`), servidor de mídia (`features.autumn.url`) e proxy
 * (`features.january.url`) chegam de lá. O cliente Solid os declara à mão e
 * paga com quatro constantes que precisam concordar com o backend; aqui a
 * fonte é o próprio backend, e um serviço que mude de endereço não exige
 * rebuild do front.
 */

/**
 * A API.
 *
 * `VITE_DEV_API_URL` vale só em desenvolvimento e `VITE_API_URL` em qualquer
 * build — a mesma separação do cliente Solid. Ela existe porque o dev server
 * roda em `localhost:5173` e a API não: sem override, `/api` bateria no Vite.
 */
export const API_URL: string =
  (import.meta.env.DEV
    ? (import.meta.env.VITE_DEV_API_URL as string | undefined)
    : undefined) ??
  (import.meta.env.VITE_API_URL as string | undefined) ??
  mesmaOrigem();

/**
 * `{origem}/api`, ou um placeholder fora do navegador.
 *
 * ⚠ O placeholder existe para o AMBIENTE DE TESTE, onde não há `location` e o
 * SDK é construído no `import` de qualquer módulo que o toque. Sem ele, as
 * suítes que nada têm com rede quebram no `#fetchConfiguration`, que o
 * construtor dispara sozinho. Ele nunca é alcançado no app: em toda origem
 * real `location.origin` existe.
 */
function mesmaOrigem(): string {
  return typeof location === "undefined"
    ? "http://localhost/api"
    : `${location.origin}/api`;
}
