/*
  O service worker do Vortex — só push, e nada mais.

  ⚠ **JS cru em `public/`, e não um módulo do bundle.** Service worker precisa
  morar na RAIZ para ter escopo sobre o app inteiro (`/sw.js` controla `/`), e
  um worker empacotado pelo Vite nasceria em `/assets/…-hash.js`, com escopo só
  sobre `/assets/`. Em `public/` ele é servido igual em dev e no build, e a CSP
  (`worker-src 'self'`) já o cobre. Sem `importScripts` e sem dependência: o
  worker acorda com o navegador fechado, e cada byte a mais é latência antes da
  notificação.

  ⚠ **Sem cache de página.** O upstream usa o worker também para precache do
  Workbox; aqui não, porque cache offline de um cliente que só funciona com
  socket é uma versão velha do app abrindo sem saber que é velha.

  Testado por `src/notificacao/sw.test.ts`, que roda ESTE arquivo numa sandbox
  com um `self` falso — o teste mede o artefato servido, não uma cópia.
*/

/* O worker novo assume já: um push que chega entre instalar e ativar cairia
   no worker antigo, e ele pode nem existir mais. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

/*
  O que o `pushd` manda, e o destino dentro do Vortex.

  ⚠ **A `url` do payload NÃO serve**: o servidor a monta como
  `{app}/channel/{id}/{mensagem}`, que é a rota do cliente upstream. Aqui a
  rota é `/servidor/S/canal/C/M` ou `/dm/C`, e o payload traz `channel` e
  `message` inteiros — dá para montar o caminho certo sem adivinhar.
*/
function destinoDoPush(dados) {
  const canal = dados && dados.channel;
  const mensagem = dados && dados.message;
  if (canal && canal._id) {
    if (canal.server) {
      return (
        "/servidor/" +
        canal.server +
        "/canal/" +
        canal._id +
        (mensagem && mensagem._id ? "/" + mensagem._id : "")
      );
    }
    return "/dm/" + canal._id;
  }
  return "/";
}

/*
  Título e corpo em português, com a mesma forma de `textoDaNotificacao`.

  ⚠ O servidor escreve pedido de amizade e chamada EM INGLÊS dentro de `body`
  ("X sent you a friend request"). Traduzir aqui é casar a frase — frágil se
  o `pushd` mudar o texto, e por isso o que não casa passa como veio em vez de
  sumir.
*/
function textoDoPush(dados) {
  const corpo = typeof dados.body === "string" ? dados.body : "";
  const canal = dados.channel;

  if (canal) {
    const autor = dados.author || "Alguém";
    let titulo = autor;
    if (canal.channel_type === "TextChannel" && canal.name) {
      titulo = autor + " em #" + canal.name;
    } else if (canal.channel_type === "Group" && canal.name) {
      titulo = autor + " em " + canal.name;
    }
    return { titulo: titulo, corpo: corpo || "Enviou um anexo", destino: destinoDoPush(dados) };
  }

  const traducoes = [
    [/^(.+) sent you a friend request$/, "enviou um pedido de amizade", "/amigos/pedidos"],
    [/^(.+) accepted your friend request$/, "aceitou seu pedido de amizade", "/amigos"],
    [/^(.+) is calling you$/, "chamada de voz", "/"],
    [/^(.+) is calling your group, .+$/, "chamada de voz em grupo", "/"],
  ];
  for (const [padrao, frase, destino] of traducoes) {
    const casou = padrao.exec(corpo);
    if (casou) return { titulo: casou[1], corpo: frase, destino: destino };
  }

  return { titulo: dados.title || "Vortex", corpo: corpo, destino: "/" };
}

self.addEventListener("push", (evento) => {
  if (!evento.data) return;
  let dados;
  try {
    dados = JSON.parse(evento.data.text());
  } catch {
    return;
  }
  const texto = textoDoPush(dados);

  evento.waitUntil(
    self.registration.showNotification(texto.titulo, {
      body: texto.corpo,
      icon: dados.icon || "/mark.svg",
      /* Por canal: dez mensagens seguidas no mesmo canal substituem a anterior
         em vez de empilhar dez avisos — mesma regra do notificador da aba. */
      tag: dados.tag || texto.destino,
      data: { caminho: texto.destino },
    }),
  );
});

/*
  O clique abre a conversa.

  Com o Vortex aberto numa aba, ela é FOCADA e recebe o caminho por mensagem —
  navegar de verdade recarregaria o app, perdendo lista, âncora e rascunho. Sem
  aba nenhuma, abre uma nova já no destino.
*/
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const caminho =
    (evento.notification.data && evento.notification.data.caminho) || "/";

  evento.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((janelas) => {
        const aberta = janelas[0];
        if (aberta) {
          aberta.postMessage({ tipo: "vortex:abrir", caminho: caminho });
          return aberta.focus();
        }
        return self.clients.openWindow(caminho);
      }),
  );
});
