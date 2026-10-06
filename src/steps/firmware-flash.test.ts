import { describe, expect, it } from "vitest";
import { DEVICES } from "../devices";
import type { AdbTransport } from "../transport/adb";
import { flashFireOs } from "./firmware-flash";

function mockAdb(cmds: string[], product = "biscuit"): AdbTransport {
  const self: AdbTransport = {
    shell: async (c) => (cmds.push(c), { output: c.startsWith("getprop") ? product : "ok", exitCode: 0 }),
    push: async (p) => void cmds.push(`push ${p}`),
    reboot: async (t) => void cmds.push(`reboot ${t ?? ""}`.trim()),
    waitForReconnect: async () => (cmds.push("reconnect"), self),
  };
  return self;
}
const base = (adb: AdbTransport, fileName = "update-kindle-biscuit_puffin-NS6001.bin") => ({
  adb, device: DEVICES.biscuit, fileName, firmware: new Uint8Array(1), log: () => {},
});

describe("flashFireOs", () => {
  it("runs the spec §5.5 sequence", async () => {
    const cmds: string[] = [];
    await flashFireOs(base(mockAdb(cmds)));
    const seq = cmds.filter((c) => !c.startsWith("getprop"));
    expect(seq[0]).toBe("twrp wipe cache");
    expect(seq[1]).toBe("twrp wipe data");
    expect(seq[2]).toBe("push /sdcard/update.zip");
    expect(seq[3]).toBe("twrp install /sdcard/update.zip");
    expect(seq[4]).toContain("bcbtool");
    expect(seq.slice(5)).toEqual(["reboot recovery", "reconnect", "twrp install /sdcard/update.zip"]);
  });
  it("refuses the wrong device before writing anything", async () => {
    const cmds: string[] = [];
    await expect(flashFireOs(base(mockAdb(cmds, "radar")))).rejects.toThrow("Wrong device");
    expect(cmds.some((c) => c.startsWith("twrp"))).toBe(false);
  });
  it("refuses a bad firmware filename", async () => {
    await expect(flashFireOs(base(mockAdb([]), "foo.bin"))).rejects.toThrow();
  });
});
