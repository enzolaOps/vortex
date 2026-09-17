import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerFlatpak } from "@electron-forge/maker-flatpak";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerFlatpakOptionsConfig } from "@electron-forge/maker-flatpak/dist/Config";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// import { globSync } from "node:fs";

const STRINGS = {
  author: "enzolaOps",
  name: "Vortex",
  execName: "vortex-desktop",
  description: "Desktop shell for the Vortex chat platform.",
};

const APP_ID = "io.github.enzolaOps.Vortex";

const ASSET_DIR = "assets";

/**
 * Build targets for the desktop app
 */
const makers: ForgeConfig["makers"] = [
  /*
   * Windows: Squirrel.
   *
   * ⚠ It is the only Forge maker that emits what `update.electronjs.org` can
   * serve — the `RELEASES` manifest plus the `.nupkg` delta. A plain ZIP would
   * install fine and never update again, which is the state this whole
   * pipeline exists to end.
   *
   * ⚠ Signing is OPTIONAL: without a certificate SmartScreen warns once at
   * install. Auto-update itself works unsigned on Windows, so the warning is a
   * one-time cost, not a permanent one.
   *
   * Forge skips makers that do not support the host platform, so this one is
   * inert on the Linux runner and the Flatpak one is inert on Windows. No
   * conditional needed.
   */
  new MakerSquirrel({
    name: STRINGS.execName,
    setupIcon: `${ASSET_DIR}/icon.ico`,
    /*
      ⚠ Nome SEM versão: o botão "Baixar para desktop" do cliente aponta para
      `releases/latest/download/Vortex-Setup.exe`, e um nome com a versão
      dentro mudaria a cada release e quebraria o link.
    */
    setupExe: "Vortex-Setup.exe",
    /*
      Assinatura OPCIONAL. Com o secret configurado no CI, o instalador e o
      executável saem assinados e o SmartScreen para de avisar; sem ele, o
      build segue sem assinatura em vez de falhar. Ver o workflow do desktop.
    */
    ...(process.env.WINDOWS_CERTIFICATE_FILE
      ? {
          certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
          certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
        }
      : {}),
  }),
  new MakerFlatpak({
    options: {
      id: APP_ID,
      description: STRINGS.description,
      productName: STRINGS.name,
      productDescription: STRINGS.description,
      runtimeVersion: "25.08",
      // Sem isto a BaseApp do Electron é pedida no ramo "stable", que o
      // Flathub não publica: os ramos dela acompanham o runtime.
      baseVersion: "25.08",
      icon: {
        "16x16": `${ASSET_DIR}/hicolor/16x16.png`,
        "32x32": `${ASSET_DIR}/hicolor/32x32.png`,
        "64x64": `${ASSET_DIR}/hicolor/64x64.png`,
        "128x128": `${ASSET_DIR}/hicolor/128x128.png`,
        "256x256": `${ASSET_DIR}/hicolor/256x256.png`,
        "512x512": `${ASSET_DIR}/hicolor/512x512.png`,
      } as unknown,
      categories: ["Network"],
      modules: [
        // use the latest zypak -- Electron sandboxing for Flatpak
        {
          name: "zypak",
          sources: [
            {
              type: "git",
              url: "https://github.com/refi64/zypak",
              tag: "v2025.09",
            },
          ],
        },
      ],
      finishArgs: [
        // default arguments found by running
        // DEBUG=electron-installer-flatpak* pnpm make
        "--socket=fallback-x11",
        "--socket=wayland",
        "--share=ipc",
        "--share=network",
        "--device=dri",
        "--device=all",
        "--socket=pulseaudio",
        "--filesystem=xdg-run/pipewire-0",
        "--filesystem=xdg-videos:ro",
        "--filesystem=xdg-pictures:ro",
        "--filesystem=xdg-download",
        "--filesystem=xdg-run/speech-dispatcher",
        "--talk-name=org.freedesktop.ScreenSaver",
        "--talk-name=org.freedesktop.Notifications",
        "--talk-name=org.kde.StatusNotifierWatcher",
        "--talk-name=com.canonical.AppMenu.Registrar",
        "--talk-name=com.canonical.indicator.application",
        "--talk-name=com.canonical.Unity",
        "--env=XCURSOR_PATH=/run/host/user-share/icons:/run/host/share/icons",
        "--env=ELECTRON_TRASH=gio",
        `--env=TMPDIR=xdg-run/app/${APP_ID}`,
      ],
      files: [],
    } as MakerFlatpakOptionsConfig,
  }),
];

// skip these makers in CI/CD
if (!process.env.PLATFORM) {
  makers.push(
    // testing purposes
    new MakerDeb({
      options: {
        productName: STRINGS.name,
        productDescription: STRINGS.description,
        categories: ["Network"],
        icon: `${ASSET_DIR}/icon.png`,
      },
    }),
  );
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: STRINGS.name,
    executableName: STRINGS.execName,
    icon:
      process.platform === "darwin"
        ? `${ASSET_DIR}/icon.icon`
        : `${ASSET_DIR}/icon`,
    // extraResource: [
    //   // include all the asset files
    //   ...globSync(ASSET_DIR + "/**/*"),
    // ],
  },
  rebuildConfig: {
    /*
      ⚠ **O `uiohook-napi` NÃO é recompilado.** É N-API e traz `prebuilds/` para
      as seis plataformas, que o `node-gyp-build` acha sozinho — o mesmo binário
      serve a qualquer Electron. Recompilar exigia o X11 de desenvolvimento no
      Linux e, no Windows, um Visual Studio que o `@electron/node-gyp` reconheça:
      ele só aceita 2019 e 2022, e o runner `windows-latest` tem o 2026.
    */
    ignoreModules: ["uiohook-napi"],
  },
  makers,
  hooks: {
    // Copy the node-pipewire dist to the app on linux
    packageAfterCopy: async (_config, buildPath, _version, platform) => {
      /*
        Atalhos de voz globais (`src/native/controles.ts`), em todas as
        plataformas. `node-gyp-build` é quem acha o binário pronto dentro de
        `prebuilds/`.
      */
      for (const pacote of ["uiohook-napi", "node-gyp-build"]) {
        fs.cpSync(
          path.join("node_modules", pacote),
          path.join(buildPath, "node_modules", pacote),
          { recursive: true },
        );
      }
      /*
        O som de UMA janela compartilhada, no Windows — ver
        `src/native/audioDaJanela.ts`. Os dois são `external` no Vite e ficam
        fora do pacote como o `node-pipewire`; sem a cópia, o `import()` falha
        em produção e a janela é transmitida sem som. Os `.node` saem do asar
        pelo `plugin-auto-unpack-natives`.
      */
      if (platform === "win32") {
        for (const pacote of [
          "loopback-capture",
          "bindings",
          "file-uri-to-path",
          "koffi",
          "@koromix/koffi-win32-x64",
          /* "Atenuar outros apps" — `src/native/atenuacao.ts`. */
          "native-sound-mixer",
        ]) {
          fs.cpSync(
            path.join("node_modules", pacote),
            path.join(buildPath, "node_modules", pacote),
            { recursive: true },
          );
        }
        /*
          ⚠ **O `.node` do native-sound-mixer é trocado pelo compilado do
          FONTE.** O pacote do npm só traz o binário; ver
          `scripts/compilar-sound-mixer.mjs`. Falhar aqui falha o build — sem
          recuo para o binário publicado.
        */
        const compilado = execFileSync(
          process.execPath,
          [path.join("scripts", "compilar-sound-mixer.mjs")],
          { stdio: ["ignore", "pipe", "inherit"] },
        )
          .toString()
          .trim();
        const destino = path.join(
          buildPath,
          "node_modules",
          "native-sound-mixer",
          "dist",
          "addons",
        );
        fs.copyFileSync(compilado, path.join(destino, "win-sound-mixer.node"));
        /* O de Linux do pacote não roda no Windows e não tem fonte conferido. */
        fs.rmSync(path.join(destino, "linux-sound-mixer.node"), { force: true });
      }
      if (platform === "linux") {
        // Copy only the files we need to run the code, which is dist, LICENSE, and package.json
        fs.cpSync(
          "node_modules/node-pipewire/dist",
          path.join(buildPath, "node_modules/node-pipewire/dist"),
          { recursive: true },
        );
        fs.cpSync(
          "node_modules/node-pipewire/LICENSE",
          path.join(buildPath, "node_modules/node-pipewire/LICENSE"),
          { recursive: true },
        );
        fs.cpSync(
          "node_modules/node-pipewire/package.json",
          path.join(buildPath, "node_modules/node-pipewire/package.json"),
          { recursive: true },
        );
      }
    },
  },
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          /* A janela do overlay do jogo — preload PRÓPRIO e estreito, ver
             `src/preloadDoOverlay.ts`. Sai como `preloadDoOverlay.js`. */
          entry: "src/preloadDoOverlay.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
