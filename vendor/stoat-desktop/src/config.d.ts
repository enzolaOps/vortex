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
};

/** Instance URL baked in at build time from `VORTEX_APP_URL`. */
declare const __VORTEX_APP_URL__: string;
