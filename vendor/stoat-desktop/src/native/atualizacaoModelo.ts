/**
 * O ciclo de atualização da casca — a DECISÃO, sem Electron.
 *
 * `atualizacao.ts` só liga o `autoUpdater` a isto. O que se decide aqui é o
 * que o cliente vê e quando a instalação acontece, e é justamente o que
 * quebrou antes: "Atualizar e reiniciar" na tela de bloqueio chamava um canal
 * que só agia em `pronta`, então na atualização OBRIGATÓRIA — em que quase
 * nunca há nada baixado ainda — o botão não fazia nada.
 */

/** Os seis estados do design, no vocabulário do cliente. */
export type EstadoDeAtualizacao =
  | "em-dia"
  | "verificando"
  | "baixando"
  | "pronta"
  | "obrigatoria"
  | "falhou";

export type Atualizacao = {
  readonly estado: EstadoDeAtualizacao;
  readonly versao: string | undefined;
  /**
   * ⚠ **0 ou 100, nunca um número do meio.** O `autoUpdater` do
   * Squirrel.Windows não reporta bytes — avisa que começou e que terminou.
   * Um percentual intermediário seria inventado, a mesma mentira do
   * "Conectado · 42 ms" que a faixa de voz recusou.
   */
  readonly progresso: number;
};

/** O que o `autoUpdater` nativo emite, traduzido. */
export type EventoDoAtualizador =
  | { readonly tipo: "verificando" }
  | { readonly tipo: "disponivel" }
  | { readonly tipo: "nada" }
  | { readonly tipo: "erro" }
  | { readonly tipo: "baixada"; readonly versao: string | undefined };

export type Dependencias = {
  /** `autoUpdater.checkForUpdates()` — pode lançar. */
  readonly checar: () => void;
  /** `autoUpdater.quitAndInstall()`. */
  readonly instalar: () => void;
  /** Manda o estado novo para as janelas. */
  readonly emitir: (a: Atualizacao) => void;
  /**
   * Há atualizador de pé? Falso em desenvolvimento e no Linux, onde não
   * existe feed — ver `atualizacao.ts`.
   */
  readonly disponivel: boolean;
};

export type PedidoDeInstalacao = { readonly obrigatoria: boolean };

export function criarAtualizacao(dep: Dependencias) {
  let atual: Atualizacao = { estado: "em-dia", versao: undefined, progresso: 0 };
  /*
    Pedido obrigatório chegou antes de haver o que instalar. Fica armado até a
    atualização terminar de baixar — ou até falhar, que o desarma: senão um
    download bem-sucedido horas depois reiniciaria o app sem ninguém pedir.
  */
  let instalarAoBaixar = false;

  const mudar = (estado: EstadoDeAtualizacao, versao?: string) => {
    atual = {
      estado,
      versao: versao ?? atual.versao,
      progresso: estado === "pronta" ? 100 : 0,
    };
    dep.emitir(atual);
  };

  const falhar = () => {
    instalarAoBaixar = false;
    mudar("falhou");
  };

  function verificar(): void {
    if (!dep.disponivel) return;
    try {
      dep.checar();
    } catch {
      falhar();
    }
  }

  return {
    estado: (): Atualizacao => atual,

    verificar,

    aoEvento(e: EventoDoAtualizador): void {
      switch (e.tipo) {
        case "verificando":
          mudar("verificando");
          return;
        case "disponivel":
          mudar("baixando");
          return;
        case "nada":
          /*
            ⚠ Nada a baixar com uma instalação obrigatória pedida quer dizer
            que o feed não tem a versão que o servidor exige. Voltar a "em dia"
            mentiria — a pessoa continuaria bloqueada sem saída. É falha, e a
            tela oferece o download manual.
          */
          if (instalarAoBaixar) falhar();
          else mudar("em-dia");
          return;
        case "erro":
          falhar();
          return;
        case "baixada":
          mudar("pronta", e.versao);
          if (instalarAoBaixar) {
            instalarAoBaixar = false;
            dep.instalar();
          }
          return;
      }
    },

    pedirInstalacao(pedido: PedidoDeInstalacao): void {
      if (atual.estado === "pronta") {
        dep.instalar();
        return;
      }
      /* Fora de `pronta`, só o pedido obrigatório age: o da faixa comum não
         tem o que instalar, e é o comportamento de sempre. */
      if (!pedido.obrigatoria) return;
      if (!dep.disponivel) {
        falhar();
        return;
      }
      instalarAoBaixar = true;
      /* Já está verificando ou baixando: o evento de fim chega sozinho, e
         checar de novo recomeçaria o download. */
      if (atual.estado === "verificando" || atual.estado === "baixando") return;
      mudar("verificando");
      verificar();
    },
  };
}

/**
 * Valida o argumento cru do canal `vortexInstalarEReiniciar`.
 *
 * Sem argumento é o pedido de sempre (faixa de "pronta"); `{ obrigatoria }`
 * vem da tela de bloqueio. Qualquer outra forma é recusada. Casca antiga
 * ignora o argumento, então o cliente novo não precisa de verbo novo.
 */
export function validarPedidoDeInstalacao(
  ...args: unknown[]
): PedidoDeInstalacao | undefined {
  if (args.length === 0 || args[0] === undefined) return { obrigatoria: false };
  if (args.length !== 1) return undefined;
  const a = args[0];
  if (typeof a !== "object" || a === null || Array.isArray(a)) return undefined;
  const o = (a as { obrigatoria?: unknown }).obrigatoria;
  if (o === undefined) return { obrigatoria: false };
  return typeof o === "boolean" ? { obrigatoria: o } : undefined;
}
