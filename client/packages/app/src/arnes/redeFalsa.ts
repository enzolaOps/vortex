/**
 * A rede do arnês, fechada para o que é do servidor.
 *
 * O `new Client()` do SDK dispara `#fetchConfiguration()` no construtor, sem
 * `await`, contra `location.origin + "/api"`. No arnês e nos testes de navegador
 * não há servidor ali: o dev server e o `vite preview` respondem com o
 * `index.html` do app, o SDK tenta ler JSON e a rejeição sobra como erro não
 * tratado, ruído que esconde o erro de verdade. O dublê devolve uma configuração
 * mínima e VÁLIDA (o caminho que o construtor exercita é o de sucesso). O resto
 * do tráfego passa intacto.
 *
 * Importe ESTE módulo ANTES de qualquer um que importe o SDK: a requisição sai na
 * avaliação do módulo do cliente.
 */
const original = globalThis.fetch.bind(globalThis);

function ehDaApi(entrada: RequestInfo | URL): boolean {
  const url = new URL(
    entrada instanceof Request ? entrada.url : String(entrada),
    globalThis.location.href,
  );
  return url.origin === globalThis.location.origin && url.pathname.startsWith("/api");
}

globalThis.fetch = (entrada, init) =>
  ehDaApi(entrada)
    ? Promise.resolve(
        new Response(
          JSON.stringify({
            revolt: "0.0.0-arnes",
            features: {
              autumn: { enabled: false, url: "" },
              january: { enabled: false, url: "" },
            },
            ws: "ws://localhost/events",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
    : original(entrada, init);

export {};
