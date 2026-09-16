declare type DesktopConfig = {
  firstLaunch: boolean;
  customFrame: boolean;
  minimiseToTray: boolean;
  spellchecker: boolean;
  hardwareAcceleration: boolean;
  windowState: {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximised: boolean;
  };
  startMinimisedToTray: boolean;
  iniciarComSistema: boolean;
  aoFechar: "bandeja" | "encerrar" | "perguntar";
  lembrarJanela: boolean;
  sempreNoTopoEmChamada: boolean;
  reduzirEmSegundoPlano: boolean;
  janelasPorArranjo: Record<
    string,
    { x: number; y: number; width: number; height: number; isMaximised: boolean }
  >;
  jogosAvisadosDeTelaCheia: string[];
};

/** Instance URL baked in at build time from `VORTEX_APP_URL`. */
declare const __VORTEX_APP_URL__: string;
