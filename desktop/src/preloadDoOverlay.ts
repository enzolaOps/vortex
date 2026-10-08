import { contextBridge, ipcRenderer } from "electron";

import {
  CANAL_DA_PORTA,
  COMANDOS_DO_OVERLAY,
  type ParaOOverlay,
  lerParaOOverlay,
} from "./native/portasDoOverlayModelo";

/**
 * O preload da janela do OVERLAY do jogo — ver `native/overlay.ts`.
 *
 * ⚠ **Separado de `preload.ts`, e é o conserto de segurança.** A janela do
 * overlay carregava o mesmo preload da principal, e com ele `native.close`
 * (que fecha a janela PRINCIPAL), `vortexControles.definirAtalhos` (hook
 * global de teclado), `vortexAtenuacao.atenuar` (volume do sistema) e
 * `vortex.gravarPreferencia`/`reiniciar`/`limparCache`. Nada disso tem motivo
 * para existir numa página que só desenha o que a principal publica.
 *
 * Aqui atravessam DUAS pontes, e só elas: `vortexOverlay` (estado, mensagens,
 * interação e o comando dos botões de voz) e `vortexOverlaySilencio`.
 *
 * ⚠ **Nenhuma delas usa canal de IPC.** O main entrega UMA porta a esta
 * página a cada carregamento (`CANAL_DA_PORTA`), e é por ela que tudo passa —
 * ver `native/portasDoOverlayModelo.ts`. O `ipcRenderer` aqui só RECEBE a
 * porta; ele nunca manda nada.
 *
 * ⚠ **O preload guarda o último valor de cada coisa e o reentrega a quem
 * assina depois.** O retrato chega na porta assim que ela é entregue, o que
 * pode ser antes de o React montar; sem a reentrega, o overlay abriria vazio
 * até a chamada mudar de novo.
 *
 * ⚠ **`publicar` e `mensagem` existem e não fazem nada.** O contrato do
 * cliente (`ponteDeOverlay` em `client/…/overlay/modelo.ts`) só reconhece a
 * ponte com os seis verbos; tirar os dois faria o overlay não se desenhar.
 * Publicar é papel da principal, e esta porta nem aceita isso no main.
 */

let porta: MessagePort | undefined;

const ultimo: {
  estado?: ParaOOverlay & { tipo: "estado" };
  interacao?: ParaOOverlay & { tipo: "interacao" };
  silencio?: ParaOOverlay & { tipo: "silencio" };
} = {};

const ouvintes = {
  estado: new Set<(e: unknown) => void>(),
  mensagem: new Set<(m: unknown) => void>(),
  interacao: new Set<(sim: boolean) => void>(),
  silencio: new Set<(sim: boolean) => void>(),
};

function avisar<T>(conjunto: Set<(v: T) => void>, valor: T): void {
  for (const f of conjunto) {
    try {
      f(valor);
    } catch (erro) {
      console.error("Ouvinte do overlay lançou:", erro);
    }
  }
}

function receber(dado: unknown): void {
  const m = lerParaOOverlay(dado);
  if (!m) return;
  switch (m.tipo) {
    case "estado":
      ultimo.estado = m;
      return avisar(ouvintes.estado, m.estado);
    case "mensagem":
      return avisar(ouvintes.mensagem, m.mensagem);
    case "interacao":
      ultimo.interacao = m;
      return avisar(ouvintes.interacao, m.interagindo);
    case "silencio":
      ultimo.silencio = m;
      return avisar(ouvintes.silencio, m.silenciadas);
  }
}

ipcRenderer.on(CANAL_DA_PORTA, (evento) => {
  const nova = evento.ports[0];
  if (!nova) return;
  /* Uma porta por página: a anterior (se o main recriou) deixa de falar. */
  porta?.close();
  porta = nova;
  nova.onmessage = (e) => receber(e.data);
});

function assinar<T>(conjunto: Set<(v: T) => void>, ouvinte: (v: T) => void, atual?: T): () => void {
  conjunto.add(ouvinte);
  if (atual !== undefined) ouvinte(atual);
  return () => void conjunto.delete(ouvinte);
}

contextBridge.exposeInMainWorld("vortexOverlay", {
  publicar: (): void => undefined,
  mensagem: (): void => undefined,
  assinarEstado: (ouvinte: (e: unknown) => void) =>
    assinar(ouvintes.estado, ouvinte, ultimo.estado?.estado),
  assinarMensagens: (ouvinte: (m: unknown) => void) => assinar(ouvintes.mensagem, ouvinte),
  assinarInteracao: (ouvinte: (sim: boolean) => void) =>
    assinar(ouvintes.interacao, ouvinte, ultimo.interacao?.interagindo),
  /* Só as intenções da lista fechada saem daqui; o main confere de novo. */
  comando: (c: unknown) => {
    if (!(COMANDOS_DO_OVERLAY as readonly unknown[]).includes(c)) return;
    porta?.postMessage({ tipo: "comando", comando: c });
  },
});

/** Ver `alternarSilencioDoOverlay`. Um booleano atravessa. */
contextBridge.exposeInMainWorld("vortexOverlaySilencio", {
  assinar: (ouvinte: (silenciadas: boolean) => void) =>
    assinar(ouvintes.silencio, ouvinte, ultimo.silencio?.silenciadas),
});
