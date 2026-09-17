import { describe, expect, it } from "vitest";

import { linkDeDownload } from "./downloadDoDesktop";

describe("link de download do desktop", () => {
  /* Os nomes precisam bater com o que o workflow anexa. */
  it("Windows baixa o instalador de nome estável", () => {
    expect(linkDeDownload("Windows")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest/download/Vortex-Setup.exe",
    );
  });

  it("Linux baixa o Flatpak", () => {
    expect(linkDeDownload("Linux")).toMatch(/\/download\/Vortex\.flatpak$/);
  });

  /* Android se anuncia com "Linux" no user agent e não roda Flatpak. */
  it("Android e macOS caem na página da release", () => {
    expect(linkDeDownload("Linux; Android 14")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest",
    );
    expect(linkDeDownload("macOS")).toBe(
      "https://github.com/enzolaOps/vortex/releases/latest",
    );
  });
});
