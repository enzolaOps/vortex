import type { Leitura } from "./telaCheiaModelo";

/**
 * Pergunta ao Windows se há um jogo em tela cheia exclusiva, e qual.
 *
 * `SHQueryUserNotificationState` (shell32) é a mesma pergunta que o próprio
 * Windows faz antes de mostrar uma notificação: se a resposta é
 * `QUNS_RUNNING_D3D_FULL_SCREEN`, um app Direct3D tomou a tela. O executável
 * sai de `GetForegroundWindow` → `GetWindowThreadProcessId` →
 * `QueryFullProcessImageNameW`, pelo `koffi` que o áudio por janela já usa.
 *
 * ⚠ **`PROCESS_QUERY_LIMITED_INFORMATION` e não `PROCESS_QUERY_INFORMATION`.**
 * A limitada é concedida para processos de outro nível de integridade — um
 * jogo iniciado pela loja como administrador — e é a única que devolve o nome
 * sem pedir mais do que isso. Falhar em ler o nome não é erro: a decisão
 * esconde o overlay do mesmo jeito, só não sabe a quem avisar.
 *
 * ⚠ **Só Windows, e `undefined` em qualquer falha.** Fora dele não há o que
 * perguntar; num Windows sem o binário do `koffi`, o overlay segue como antes.
 */

type Funcoes = { ler: () => Leitura };

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
/** `MAX_PATH` estendido: caminho longo de jogo em pasta de loja passa de 260. */
const CARACTERES = 1024;

let carregado: Promise<Funcoes | undefined> | undefined;

function carregar(): Promise<Funcoes | undefined> {
  if (process.platform !== "win32") return Promise.resolve(undefined);
  carregado ??= (async () => {
    try {
      const { default: koffi } = await import("koffi");
      const shell32 = koffi.load("shell32.dll");
      const user32 = koffi.load("user32.dll");
      const kernel32 = koffi.load("kernel32.dll");

      const consultar = shell32.func(
        "long __stdcall SHQueryUserNotificationState(_Out_ int *pquns)",
      );
      const primeiroPlano = user32.func("intptr __stdcall GetForegroundWindow()");
      const pidDaJanela = user32.func(
        "uint32 __stdcall GetWindowThreadProcessId(intptr hWnd, _Out_ uint32 *lpdwProcessId)",
      );
      const abrir = kernel32.func(
        "intptr __stdcall OpenProcess(uint32 dwDesiredAccess, int bInheritHandle, uint32 dwProcessId)",
      );
      const nomeDoProcesso = kernel32.func(
        "int __stdcall QueryFullProcessImageNameW(intptr hProcess, uint32 dwFlags, _Out_ uint8_t *lpExeName, _Inout_ uint32 *lpdwSize)",
      );
      const fechar = kernel32.func("int __stdcall CloseHandle(intptr hObject)");

      const executavel = (): string | undefined => {
        const hwnd = primeiroPlano() as number;
        if (!hwnd) return undefined;
        const pid = [0];
        pidDaJanela(hwnd, pid);
        if (!pid[0]) return undefined;
        const processo = abrir(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid[0]) as number;
        if (!processo) return undefined;
        try {
          const buffer = Buffer.alloc(CARACTERES * 2);
          const tamanho = [CARACTERES];
          if (!nomeDoProcesso(processo, 0, buffer, tamanho)) return undefined;
          return buffer.toString("utf16le", 0, (tamanho[0] ?? 0) * 2);
        } finally {
          fechar(processo);
        }
      };

      return {
        ler: () => {
          const estado = [0];
          /* HRESULT negativo = a pergunta falhou; "0" não é um estado. */
          if ((consultar(estado) as number) < 0) return { estado: 0, executavel: undefined };
          return { estado: estado[0] ?? 0, executavel: executavel() };
        },
      };
    } catch (e) {
      console.error("Detecção de tela cheia indisponível:", e);
      return undefined;
    }
  })();
  return carregado;
}

export async function lerTelaCheia(): Promise<Leitura | undefined> {
  const f = await carregar();
  if (!f) return undefined;
  try {
    return f.ler();
  } catch (e) {
    console.error("Falha ao consultar tela cheia:", e);
    return undefined;
  }
}
