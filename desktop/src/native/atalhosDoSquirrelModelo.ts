import path from "node:path";

/**
 * Os eventos de ciclo de vida do Squirrel.Windows — a DECISÃO, pura e testada.
 *
 * ⚠ **Quem cria o atalho é o APP, não o instalador.** O `Vortex-Setup.exe`
 * apenas extrai a pasta e roda o executável com `--squirrel-install`; criar o
 * atalho do menu Iniciar é responsabilidade de quem recebe esse argumento. Sem
 * este módulo o app abria uma janela normal durante a instalação e nunca saía,
 * então NENHUM atalho era criado — medido: `%LOCALAPPDATA%\vortex-desktop\`
 * com o app inteiro e `Start Menu\Programs` sem nada com "Vortex" no nome. É
 * por isso que o app não aparecia na busca do Windows.
 *
 * ⚠ **E é por isso que a animação verde ficava pendurada sobre a janela.** O
 * `Setup.exe` mostra o GIF de carregamento ENQUANTO espera o processo de
 * `--squirrel-install` terminar. Um processo que abre a interface e nunca
 * encerra deixa o spinner de pé para sempre. Sair aqui é o que o fecha.
 *
 * Os quatro eventos, e o que cada um significa:
 *
 * | Argumento              | Quando                         | O que fazer      |
 * | ---------------------- | ------------------------------ | ---------------- |
 * | `--squirrel-install`   | logo após instalar             | criar o atalho   |
 * | `--squirrel-updated`   | logo após atualizar            | criar o atalho   |
 * | `--squirrel-uninstall` | ao desinstalar                 | remover o atalho |
 * | `--squirrel-obsolete`  | versão antiga sendo aposentada | só sair          |
 *
 * ⚠ **`--squirrel-firstrun` NÃO está na lista, e a ausência é a decisão.** Ele
 * chega na primeira abertura DE VERDADE, logo depois da instalação: ali o app
 * precisa subir normalmente. Tratá-lo como evento faria o app sair no lugar de
 * abrir, e a instalação terminaria sem nada na tela.
 *
 * ⚠ **`--squirrel-updated` recria o atalho, e não é redundância.** O atalho
 * aponta para o stub na raiz da instalação e carrega a descrição e o ícone
 * lidos do executável da versão CORRENTE; recriar é como o Squirrel mantém os
 * dois em dia. É também o que conserta, sozinho, a instalação que hoje está
 * sem atalho nenhum: a primeira atualização a partir da 1.3.1 passa por aqui.
 */
export type AcaoDoSquirrel =
  | { tipo: "criarAtalho"; exe: string }
  | { tipo: "removerAtalho"; exe: string }
  | { tipo: "sair" }
  | { tipo: "seguir" };

/**
 * ⚠ **`path.win32` e não `path`**, embora o código só rode no Windows: assim a
 * decisão é a mesma no Linux, que é onde a suíte de testes roda no CI.
 */
export function acaoDoSquirrel(
  argv: readonly string[],
  plataforma: string,
  execPath: string,
): AcaoDoSquirrel {
  /*
    Fora do Windows não existe Squirrel, e em desenvolvimento (`pnpm start`)
    nenhum destes argumentos é passado — o guarda de plataforma mais a
    igualdade exata dos quatro nomes é o que mantém o caminho inerte ali.
  */
  if (plataforma !== "win32") return { tipo: "seguir" };

  const exe = path.win32.basename(execPath);

  for (const argumento of argv) {
    switch (argumento) {
      case "--squirrel-install":
      case "--squirrel-updated":
        return { tipo: "criarAtalho", exe };
      case "--squirrel-uninstall":
        return { tipo: "removerAtalho", exe };
      case "--squirrel-obsolete":
        return { tipo: "sair" };
    }
  }

  return { tipo: "seguir" };
}

/**
 * O `Update.exe` mora UM nível acima do executável.
 *
 * Medido na instalação real: o app fica em
 * `%LOCALAPPDATA%\vortex-desktop\app-1.3.1\vortex-desktop.exe` e o
 * `Update.exe` em `%LOCALAPPDATA%\vortex-desktop\Update.exe`. Derivar do
 * `execPath` em vez de montar o caminho a partir do nome do pacote é o que faz
 * isto continuar certo se a pasta da instalação mudar de nome.
 */
export function caminhoDoUpdateExe(execPath: string): string {
  return path.win32.resolve(path.win32.dirname(execPath), "..", "Update.exe");
}

export interface EntornoDoSquirrel {
  argv: readonly string[];
  plataforma: string;
  execPath: string;
  /** Roda o `Update.exe` e chama `aoTerminar` quando o processo fechar. */
  rodarUpdate(comando: string, argumentos: string[], aoTerminar: () => void): void;
  sair(): void;
}

/**
 * Executa a decisão. Devolve `true` quando o processo está encerrando — quem
 * chama usa isso para não montar janela, bandeja nem ponte.
 *
 * ⚠ **O `sair()` só vem DEPOIS que o `Update.exe` fecha.** Encerrar antes mata
 * o filho no meio da escrita do `.lnk`, e o sintoma é a instalação que às vezes
 * cria o atalho e às vezes não — o pior tipo de defeito para diagnosticar.
 */
export function tratarEventosDoSquirrel(entorno: EntornoDoSquirrel): boolean {
  const acao = acaoDoSquirrel(entorno.argv, entorno.plataforma, entorno.execPath);

  if (acao.tipo === "seguir") return false;

  if (acao.tipo === "sair") {
    entorno.sair();
    return true;
  }

  /*
    ⚠ **Verbo e nome como argumentos SEPARADOS** (`--createShortcut exe`), que
    é a forma verificada contra o `Update.exe` da instalação 1.3.1 desta
    máquina: ela produziu `Start Menu\Programs\enzolaOps\Vortex.lnk` e o atalho
    na área de trabalho, e `--removeShortcut` apagou os dois.
  */
  const verbo = acao.tipo === "criarAtalho" ? "--createShortcut" : "--removeShortcut";

  entorno.rodarUpdate(caminhoDoUpdateExe(entorno.execPath), [verbo, acao.exe], entorno.sair);

  return true;
}
