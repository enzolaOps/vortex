import { Permission } from "stoat.js";
import { describe, expect, it } from "vitest";

import { BIT_VER_CANAL } from "./bits";

describe("BIT_VER_CANAL", () => {
  it("é o ViewChannel do protocolo, e não o bit 0 (ManageChannel)", () => {
    expect(BIT_VER_CANAL).toBe(BigInt(Permission.ViewChannel));
    expect(BIT_VER_CANAL).not.toBe(BigInt(Permission.ManageChannel));
  });
});
