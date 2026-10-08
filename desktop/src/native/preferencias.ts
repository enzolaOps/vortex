import { app } from "electron";
import { registrar, semArgumentos } from "./registroDeIpc";

import { definirIniciarComSistema, iniciarComSistemaNoSistema } from "./autoLaunch";
import { config } from "./config";
import {
  camposDaGravacao,
  preferenciasParaOCliente,
  validarGravacao,
  type ConfigDasPreferencias,
  type Gravacao,
  type PreferenciasLidas,
} from "./preferenciasDoCliente";
import { aplicarCorretor, mainWindow } from "./window";

/**
 * Os EFEITOS das preferências da tela Desktop — a tradução pura mora em
 * `preferenciasDoCliente.ts`.
 *
 * O que cada uma faz de verdade, e quando:
 *
 * | Preferência              | Efeito                                         | Quando       |
 * | ------------------------ | ---------------------------------------------- | ------------ |
 * | iniciarComSistema        | entrada de login do sistema, com `--hidden`    | na hora      |
 * | minimizarParaBandeja     | = `aoFechar` bandeja/encerrar                  | na hora      |
 * | aoFechar                 | o `close` da janela esconde, encerra ou pergunta | na hora    |
 * | abrirMinimizado          | `startMinimisedToTray`                         | próximo início |
 * | lembrarJanela            | restaura posição por arranjo de monitores      | próximo início |
 * | sempreNoTopoEmChamada    | `setAlwaysOnTop` com chamada em PiP            | na hora      |
 * | barraNativa              | `frame` da janela                              | reinício     |
 * | aceleracaoDeHardware     | `disableHardwareAcceleration`                  | reinício     |
 * | reduzirEmSegundoPlano    | `setBackgroundThrottling`                      | na hora      |
 * | corretorOrtografico      | `setSpellCheckerEnabled` + idioma da sessão    | na hora      |
 *
 * ⚠ **`preCarregarAnexos` NÃO está aqui**, e a ausência é a decisão: não há
 * comportamento nenhum atrás dela, nem na casca nem no cliente. Gravá-la
 * seria o interruptor que "funciona" e não faz nada — a tela a mostra como
 * pendente.
 */

/**
 * O que está EM USO neste processo. Gravar a preferência depois não muda
 * isto; é o que o cliente usa para desenhar a barra certa e avisar que falta
 * reiniciar.
 *
 * ⚠ **Capturado ao criar a janela, e não ao importar.** `window.ts`,
 * `config.ts` e este arquivo se importam em ciclo; lido no topo do módulo,
 * `config` ainda era `undefined` e o main caía antes do `ready` — medido no
 * Electron. Entre o import e a janela nada escreve nesses dois campos: a
 * única escrita é por IPC, que só existe depois.
 */
let EM_USO: { customFrame: boolean; hardwareAcceleration: boolean } | undefined;

export function capturarEmUso(): void {
  EM_USO ??= {
    customFrame: config.customFrame,
    hardwareAcceleration: config.hardwareAcceleration,
  };
}

function configAtual(): ConfigDasPreferencias {
  return {
    iniciarComSistema: config.iniciarComSistema,
    minimiseToTray: config.minimiseToTray,
    startMinimisedToTray: config.startMinimisedToTray,
    lembrarJanela: config.lembrarJanela,
    sempreNoTopoEmChamada: config.sempreNoTopoEmChamada,
    customFrame: config.customFrame,
    aoFechar: config.aoFechar,
    hardwareAcceleration: config.hardwareAcceleration,
    reduzirEmSegundoPlano: config.reduzirEmSegundoPlano,
    spellchecker: config.spellchecker,
  };
}

async function lerPreferencias(): Promise<PreferenciasLidas> {
  capturarEmUso();
  const lidas = preferenciasParaOCliente(configAtual(), EM_USO!, process.platform);
  /* O sistema ganha do arquivo: a entrada pode ter sido removida por fora. */
  const noSistema = await iniciarComSistemaNoSistema();
  return noSistema === undefined ? lidas : { ...lidas, iniciarComSistema: noSistema };
}

/* ------------------------------------------------------ sempre no topo */

let chamadaEmPip = false;

function aplicarSempreNoTopo(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const querer = config.sempreNoTopoEmChamada && chamadaEmPip;
  if (mainWindow.isAlwaysOnTop() !== querer) mainWindow.setAlwaysOnTop(querer);
}

/** Publicado pelo cliente junto do estado de voz — ver `controles.ts`. */
export function definirChamadaEmPip(sim: boolean): void {
  if (chamadaEmPip === sim) return;
  chamadaEmPip = sim;
  aplicarSempreNoTopo();
}

/** Chamado ao criar a janela: o que vale "na hora" vale desde o início. */
export function aplicarPreferenciasNaJanela(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.setBackgroundThrottling(config.reduzirEmSegundoPlano);
  aplicarSempreNoTopo();
}

async function gravarPreferencia(g: Gravacao): Promise<void> {
  const campos = camposDaGravacao(g, process.platform);
  const destino = config as unknown as Record<string, unknown>;
  for (const [campo, v] of Object.entries(campos)) destino[campo] = v;

  switch (g.chave) {
    case "iniciarComSistema":
      await definirIniciarComSistema(g.valor);
      return;
    case "sempreNoTopoEmChamada":
      aplicarSempreNoTopo();
      return;
    case "reduzirEmSegundoPlano":
      aplicarPreferenciasNaJanela();
      return;
    /*
      ⚠ **O setter de `config.spellchecker` já liga o motor na sessão**, mas
      não escolhe IDIOMA — e um corretor em inglês num app em português
      sublinha tudo, que é o mesmo que não ter corretor com o custo de riscar
      a tela. `aplicarCorretor` faz as duas coisas, e é a mesma função da
      partida: dois caminhos divergiriam no primeiro que ganhasse uma regra.
    */
    case "corretorOrtografico":
      aplicarCorretor();
      return;
    default:
      return;
  }
}

export function registrarPreferencias(): void {
  registrar("vortexLerPreferencias", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => lerPreferencias(),
  });

  /*
    ⚠ **Chave E tipo conferidos, e não repassados.** `config` é um store em
    disco que o main lê para decidir comportamento; aceitar chave ou valor
    arbitrário do renderer deixaria conteúdo de terceiro escrevê-lo.
  */
  registrar("vortexGravarPreferencia", {
    via: "invoke",
    quem: ["principal"],
    validar: (chave: unknown, valor: unknown) => validarGravacao(chave, valor),
    executar: (g) => gravarPreferencia(g),
  });

  /*
    "Reiniciar agora", do aviso de aceleração de hardware. Ponte PRÓPRIA
    (`vortexReinicio`) pela razão de versão de sempre. Só a janela principal
    pode pedir: reiniciar é derrubar a chamada de quem está nela.
  */
  registrar("vortexReiniciar", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => {
      app.relaunch();
      /* `quit` e não `exit`: passa pelo `before-quit`, que libera o `close`
         de esconder na bandeja e para o hook de teclado. */
      app.quit();
    },
  });
}
