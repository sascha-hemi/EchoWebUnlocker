import { describe, expect, it } from "vitest";
import { DEVICES } from "../devices";
import { isPartitionBlocked } from "../transport/blocklist";
import { validateFirmwareName } from "./firmware";

describe("validation", () => {
  it("checks firmware filenames", () => {
    expect(validateFirmwareName(DEVICES.biscuit, "update-kindle-biscuit_puffin-NS6xxx.bin").ok).toBe(true);
    expect(validateFirmwareName(DEVICES.biscuit, "update-kindle-radar_puffin-NS6xxx.bin").ok).toBe(false);
    expect(validateFirmwareName(DEVICES.biscuit, "update-kindle-biscuit_puffin-NS5xxx.bin").ok).toBe(false);
  });
  it("blocks critical partitions", () => {
    expect(isPartitionBlocked("LK_A")).toBe(true);
    expect(isPartitionBlocked("boot")).toBe(false);
  });
});
