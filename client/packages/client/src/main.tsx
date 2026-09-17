import { ROTA_DO_OVERLAY } from "./overlay/modelo";

const root = document.getElementById("root");
if (!root) throw new Error("#root ausente no index.html");

/*
  ⚠ **Dois entries atrás de `import()`, e a escolha é a rota.** A janela do
  overlay do jogo carrega ESTE cliente em `/overlay` e só quer tokens, fontes e
  componentes — sem sessão, rota, socket, sons nem atalhos; tudo o que ela
  desenha chega pela casca.

  Com os imports estáticos aqui em cima, `App` → `publicador` → `adapter`
  rodavam ANTES deste `if`, e o `new Client()` do adapter disparava a busca de
  configuração na API a cada vez que o overlay aparecia. Por `import()`, o
  ramo do overlay nunca baixa nem avalia o grafo do app.

  `modelo.ts` é a única importação estática: não importa nada, e é de onde vem
  a rota.
*/
if (location.pathname === ROTA_DO_OVERLAY) {
  void import("./overlay/entrada").then((m) => m.montarOverlay(root));
} else {
  void import("./entradaDoApp").then((m) => m.montarApp(root));
}
