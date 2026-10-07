import { describe, expect, it } from "vitest";
import { DEVICES } from "../devices";
import type { AdbTransport } from "../transport/adb";
import type { FastbootTransport } from "../transport/fastboot";
import { factoryReset, getSlot, guardedFlash, setSlot } from "./tools";
import { flashTwrp } from "./twrp";

const fbMock = (calls: string[], product = "BISCUIT"): FastbootTransport => ({
  getvar: async () => product,
  flash: async (p) => void calls.push(`flash ${p}`),
  reboot: async (t) => void calls.push(`reboot ${t ?? ""}`.trim()),
});
const adbMock = (calls: string[], product = "biscuit"): AdbTransport => ({
  shell: async (c) => (calls.push(c), { output: c.startsWith("getprop") ? product : "a\n", exitCode: 0 }),
  push: async () => {},
  reboot: async () => {},
  waitForReconnect: async () => { throw new Error("unused"); },
});
const log = () => {};

describe("twrp step", () => {
  it("flashes recovery then reboots into it", async () => {
    const calls: string[] = [];
    await flashTwrp(fbMock(calls), DEVICES.biscuit, new Uint8Array(1), log);
    expect(calls).toEqual(["flash recovery", "reboot recovery"]);
  });
  it("aborts on the wrong product before writing", async () => {
    const calls: string[] = [];
    await expect(flashTwrp(fbMock(calls, "RADAR"), DEVICES.biscuit, new Uint8Array(1), log)).rejects.toThrow("Wrong device");
    expect(calls).toEqual([]);
  });
  it("does not abort for devices without a known product", async () => {
    const calls: string[] = [];
    await flashTwrp(fbMock(calls, "whatever"), DEVICES.donut, new Uint8Array(1), log);
    expect(calls).toEqual(["flash recovery", "reboot recovery"]);
  });
});

describe("tools", () => {
  it("blocks critical partitions and allows others", async () => {
    const calls: string[] = [];
    await expect(guardedFlash(fbMock(calls), DEVICES.biscuit, "LK_A", new Uint8Array(1), log)).rejects.toThrow("blocked");
    await expect(guardedFlash(fbMock(calls), DEVICES.biscuit, " ", new Uint8Array(1), log)).rejects.toThrow();
    await guardedFlash(fbMock(calls), DEVICES.biscuit, "boot", new Uint8Array(1), log);
    expect(calls).toEqual(["flash boot"]);
  });
  it("reads and sets the slot, checking the device first", async () => {
    const calls: string[] = [];
    expect(await getSlot(adbMock(calls), DEVICES.biscuit)).toBe("a");
    await setSlot(adbMock(calls), DEVICES.biscuit, "b");
    expect(calls).toContain("bcbtool set_active b");
    await expect(setSlot(adbMock([], "radar"), DEVICES.biscuit, "b")).rejects.toThrow("Wrong device");
  });
  it("wipes data only on the right device", async () => {
    const calls: string[] = [];
    await factoryReset(adbMock(calls), DEVICES.biscuit);
    expect(calls).toContain("twrp wipe data");
    const bad: string[] = [];
    await expect(factoryReset(adbMock(bad, "radar"), DEVICES.biscuit)).rejects.toThrow();
    expect(bad.some((c) => c.startsWith("twrp"))).toBe(false);
  });
});
