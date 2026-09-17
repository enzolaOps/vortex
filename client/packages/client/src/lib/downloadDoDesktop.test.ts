import { describe, expect, it } from "vitest";

import { linkDeDownload } from "./downloadDoDesktop";

describe("link de download do desktop", () => {
  /* Os nomes precisam bater com o que o workflow anexa. */
  it("Windows baixa o instalador de nome estável", () => {
    expect(linkDeDownload("Windows")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest/download/Vortex-Setup.exe",
    );
    expect(linkDeDownload("win32")).toMatch(/Vortex-Setup\.exe$/);
  });

  it("Ubuntu/Debian baixam o .deb", () => {
    expect(linkDeDownload("X11; Ubuntu; Linux x86_64")).toMatch(
      /\/download\/Vortex\.deb$/,
    );
    expect(linkDeDownload("X11; Linux x86_64; Debian")).toMatch(
      /\/download\/Vortex\.deb$/,
    );
  });

  it("Linux genérico (Arch) baixa o zip", () => {
    expect(linkDeDownload("Linux")).toMatch(/\/download\/Vortex-linux\.zip$/);
    expect(linkDeDownload("X11; Linux x86_64")).toMatch(
      /\/download\/Vortex-linux\.zip$/,
    );
  });

  /* Android se anuncia com "Linux" no user agent e não roda o zip nem o .deb. */
  it("Android e macOS caem na página da release", () => {
    expect(linkDeDownload("Linux; Android 14")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest",
    );
    expect(linkDeDownload("macOS")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest",
    );
  });
});
