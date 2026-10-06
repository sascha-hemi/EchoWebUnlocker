import { describe, expect, it } from "vitest";
import { FastbootTimeoutError } from "./fastboot";
import { WebUsbFastboot, type FastbootDeviceLike } from "./fastboot-webusb";

const fake = (over: Partial<FastbootDeviceLike> = {}): FastbootDeviceLike => ({
  getVariable: async () => null,
  runCommand: async () => ({ text: "" }),
  upload: async () => {},
  flashBlob: async () => {},
  reboot: async () => {},
  ...over,
});

describe("WebUsbFastboot", () => {
  it("maps a missing variable to an empty string", async () => {
    expect(await new WebUsbFastboot(fake()).getvar("x")).toBe("");
  });
  it("uploads then flashes the raw partition name", async () => {
    const calls: string[] = [];
    const fb = new WebUsbFastboot(
      fake({
        upload: async (p, b) => void calls.push(`upload:${p}:${b.byteLength}`),
        runCommand: async (c) => (calls.push(c), { text: "" }),
      }),
    );
    await fb.flash("brick", new Uint8Array([1, 2, 3]));
    expect(calls).toEqual(["upload:brick:3", "flash:brick"]);
  });
  it("rejects with FastbootTimeoutError and swallows the late rejection", async () => {
    let rejectLate!: (e: Error) => void;
    const fb = new WebUsbFastboot(
      fake({ upload: () => new Promise((_, rej) => (rejectLate = rej)) }),
    );
    await expect(fb.flash("brick", new Uint8Array(1), { timeoutMs: 10 })).rejects.toBeInstanceOf(FastbootTimeoutError);
    rejectLate(new Error("device gone")); // must not surface as unhandled rejection
    await new Promise((r) => setTimeout(r, 5));
  });
  it("propagates bootloader errors", async () => {
    const fb = new WebUsbFastboot(fake({ runCommand: async () => { throw new Error("eMMC-RO"); } }));
    await expect(fb.flash("brick", new Uint8Array(1))).rejects.toThrow("eMMC-RO");
  });
});
