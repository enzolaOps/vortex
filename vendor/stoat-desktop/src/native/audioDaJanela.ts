import { ipcMain, type WebContents } from "electron";

/**
 * O áudio de UMA janela compartilhada, e não o do computador inteiro.
 *
 * ⚠ **O Electron não sabe fazer isto.** `setDisplayMediaRequestHandler` aceita
 * `audio: "loopback"`, que no Windows é o som do SISTEMA — então compartilhar
 * só o navegador levava junto o Spotify, as notificações e a voz de quem está
 * na própria chamada. A outra opção (`WebFrameMain`) só captura conteúdo do
 * próprio app.
 *
 * O Windows tem a API certa desde o 10 2004: loopback por PROCESSO
 * (`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`). `loopback-capture` a
 * embrulha num addon N-API — ABI estável, então o binário pronto roda no
 * Electron sem recompilar. A janela vira processo por
 * `GetWindowThreadProcessId`, chamado pelo `koffi`.
 *
 * ⚠ **A ÁRVORE de processos, e não só o dono da janela.** Chrome, Edge,
 * Discord e o próprio Electron tocam áudio num processo FILHO; capturar só o
 * PID da janela daria silêncio exatamente nos apps mais compartilhados.
 *
 * O PCM (16 bits, estéreo, 48 kHz, blocos de 10 ms) desce ao renderer por IPC,
 * e é o cliente que o transforma em faixa e publica. Um bloco a cada 10 ms é
 * trabalho trivial para o IPC.
 */

type Captura = { start: StartFn; stop: () => void };
type StartFn = (
  pid: number,
  arvore: boolean,
  aoBloco: (bloco: Buffer) => void,
) => void;

type Nativo = {
  novaCaptura: () => Captura;
  pidDaJanela: (hwnd: number) => number;
};

/**
 * Carregado sob demanda, e `undefined` quando não dá.
 *
 * ⚠ **Só Windows, e falhar ao carregar não é erro fatal.** Fora do Windows o
 * cliente nem pede; num Windows antigo ou sem o binário, compartilhar janela
 * continua funcionando — sem som, que é o certo: a alternativa seria voltar
 * ao som do sistema inteiro, que é o defeito que este arquivo existe para
 * matar.
 */
let nativo: Promise<Nativo | undefined> | undefined;

function carregar(): Promise<Nativo | undefined> {
  if (process.platform !== "win32") return Promise.resolve(undefined);
  nativo ??= (async () => {
    try {
      const [{ default: koffi }, loopback] = await Promise.all([
        import("koffi"),
        import("loopback-capture"),
      ]);
      const user32 = koffi.load("user32.dll");
      const GetWindowThreadProcessId = user32.func(
        "uint32 __stdcall GetWindowThreadProcessId(intptr hWnd, _Out_ uint32 *lpdwProcessId)",
      );
      /* O addon chega como `default` no ESM e solto no CJS, conforme o
         empacotador; os dois têm a mesma classe. */
      const modulo = loopback as unknown as {
        default?: { LoopbackCapture: new () => Captura };
        LoopbackCapture?: new () => Captura;
      };
      const Classe = modulo.default?.LoopbackCapture ?? modulo.LoopbackCapture;
      if (!Classe) return undefined;
      return {
        novaCaptura: () => new Classe(),
        pidDaJanela: (hwnd) => {
          const saida = [0];
          GetWindowThreadProcessId(hwnd, saida);
          return saida[0] ?? 0;
        },
      };
    } catch (e) {
      console.error("Áudio por janela indisponível:", e);
      return undefined;
    }
  })();
  return nativo;
}

/**
 * O HWND dentro do id do `desktopCapturer` — `window:<hwnd>:<n>`.
 *
 * `undefined` para tela ou id estranho — e aí não há o que capturar.
 */
export function hwndDoId(id: string): number | undefined {
  const m = /^window:(\d+):/.exec(id);
  if (!m) return undefined;
  const hwnd = Number(m[1]);
  return Number.isSafeInteger(hwnd) && hwnd > 0 ? hwnd : undefined;
}

/**
 * A última janela que o handler de captura ENTREGOU.
 *
 * ⚠ **É a autorização.** O renderer só pode pedir o áudio da janela que a
 * pessoa acabou de escolher no seletor e que já está sendo transmitida — nunca
 * um id que ele mesmo mande. Um XSS no cliente não escolhe o que ouvir.
 */
let janelaEntregue: string | undefined;

export function registrarJanelaEntregue(id: string | undefined): void {
  janelaEntregue = id;
}

/** Captura em curso, por renderer. Uma transmissão por janela de app. */
const emCurso = new Map<number, Captura>();

function parar(wc: WebContents): void {
  const c = emCurso.get(wc.id);
  if (!c) return;
  emCurso.delete(wc.id);
  try {
    c.stop();
  } catch {
    /* Parar o que já parou (processo alvo encerrado) não é erro. */
  }
}

/** Há suporte a áudio por janela nesta máquina? O handler de captura pergunta. */
export async function audioDaJanelaDisponivel(): Promise<boolean> {
  return (await carregar()) !== undefined;
}

export function registrarAudioDaJanela(): void {
  ipcMain.handle("audioJanelaDisponivel", () => audioDaJanelaDisponivel());

  ipcMain.handle("audioJanelaIniciar", async (e) => {
    const id = janelaEntregue;
    const hwnd = id === undefined ? undefined : hwndDoId(id);
    const n = await carregar();
    if (hwnd === undefined || !n) return false;

    const pid = n.pidDaJanela(hwnd);
    if (pid === 0) return false;

    const wc = e.sender;
    parar(wc);

    try {
      const captura = n.novaCaptura();
      captura.start(pid, true, (bloco) => {
        if (wc.isDestroyed()) return;
        wc.send("audioJanelaBloco", bloco);
      });
      emCurso.set(wc.id, captura);
      /* A janela do app fechou ou recarregou: a captura não pode sobreviver a
         quem a consumia. */
      /* `did-navigate` e não `did-start-navigation`: o segundo dispara também
         no `pushState` do roteador, e trocar de canal cortaria o som. */
      wc.once("destroyed", () => parar(wc));
      wc.once("did-navigate", () => parar(wc));
      return true;
    } catch (erro) {
      console.error("Não deu para capturar o áudio da janela:", erro);
      return false;
    }
  });

  ipcMain.handle("audioJanelaParar", (e) => parar(e.sender));
}
