import { describe, expect, it } from "vitest";
import { DEVICES } from "../devices";
import type { AdbTransport } from "../transport/adb";
import { flashFireOs, flashedSlot } from "./firmware-flash";

type Slot = "a" | "b";
const other = (s: Slot): Slot => (s === "a" ? "b" : "a");

/**
 * A device in TWRP, modelled on what radar did on 2026-10-10: an install
 * writes the slot recovery did NOT boot from and stages a switch to it in the
 * BCB; "reboot recovery" boots whatever the BCB says.
 */
function device(opts: { product?: string; stages?: boolean; booted?: Slot } = {}) {
  const st = { booted: opts.booted ?? ("a" as Slot), active: opts.booted ?? ("a" as Slot), written: [] as Slot[] };
  const cmds: string[] = [];
  const adb: AdbTransport = {
    shell: async (c) => {
      cmds.push(c);
      if (c.startsWith("getprop")) return { output: opts.product ?? "biscuit", exitCode: 0 };
      if (c === "twrp install /sdcard/update.zip") {
        const slot = other(st.booted);
        st.written.push(slot);
        if (opts.stages !== false) st.active = slot;
        return {
          output: `Flashing A/B zip to inactive slot: ${slot.toUpperCase()}\nTo flash additional zips, please reboot recovery to switch to the updated slot.`,
          exitCode: 0,
        };
      }
      if (c === "bcbtool get_active") return { output: `${st.active}\n`, exitCode: 0 };
      const set = /^bcbtool set_active ([ab])$/.exec(c);
      if (set) return (st.active = set[1] as Slot), { output: `Active slot set to ${set[1]}.`, exitCode: 0 };
      return { output: "ok", exitCode: 0 };
    },
    push: async (p) => void cmds.push(`push ${p}`),
    reboot: async (t) => {
      cmds.push(`reboot ${t ?? ""}`.trim());
      st.booted = st.active;
    },
    waitForReconnect: async () => (cmds.push("reconnect"), adb),
  };
  return { adb, cmds, st };
}

const base = (adb: AdbTransport, fileName = "update-kindle-biscuit_puffin-NS6001.bin") => ({
  adb, device: DEVICES.biscuit, fileName, firmware: new Uint8Array(1), log: () => {},
});

describe("flashedSlot", () => {
  it("reads the slot from TWRP's output", () => {
    expect(flashedSlot("Installing zip file '/sdcard/update.zip'\nFlashing A/B zip to inactive slot: B\nStep 1/2")).toBe("b");
    expect(flashedSlot("Flashing A/B zip to inactive slot: A")).toBe("a");
  });
  it("refuses output that names no slot", () => {
    expect(() => flashedSlot("Error installing zip file")).toThrow();
  });
});

describe("flashFireOs", () => {
  it("writes both slots and never undoes TWRP's own switch", async () => {
    const { adb, cmds, st } = device();
    await flashFireOs(base(adb));
    expect([...st.written].sort()).toEqual(["a", "b"]);
    expect(cmds.some((c) => c.startsWith("bcbtool set_active"))).toBe(false);
    const seq = cmds.filter((c) => !c.startsWith("getprop"));
    expect(seq).toEqual([
      "twrp wipe cache", "twrp wipe data", "push /sdcard/update.zip",
      "twrp install /sdcard/update.zip", "bcbtool get_active", "reboot recovery", "reconnect",
      "twrp install /sdcard/update.zip", "bcbtool get_active", "reboot recovery", "reconnect",
    ]);
    expect(st.booted).toBe(st.written[1]);
  });
  it("works from slot b too", async () => {
    const { adb, st } = device({ booted: "b" });
    await flashFireOs(base(adb));
    expect(st.written).toEqual(["a", "b"]);
  });
  it("stages the slot itself when TWRP did not", async () => {
    const { adb, cmds, st } = device({ stages: false });
    await flashFireOs(base(adb));
    expect([...st.written].sort()).toEqual(["a", "b"]);
    expect(cmds.filter((c) => c.startsWith("bcbtool set_active"))).toEqual(["bcbtool set_active b", "bcbtool set_active a"]);
  });
  it("stops when the second install hits the same slot", async () => {
    const { adb } = device();
    const real = adb.reboot;
    adb.reboot = async () => {}; // recovery comes back on the same slot
    await expect(flashFireOs(base(adb))).rejects.toThrow("Both installs wrote slot b");
    adb.reboot = real;
  });
  it("refuses the wrong device before writing anything", async () => {
    const { adb, cmds } = device({ product: "radar" });
    await expect(flashFireOs(base(adb))).rejects.toThrow("Wrong device");
    expect(cmds.some((c) => c.startsWith("twrp"))).toBe(false);
  });
  it("refuses a bad firmware filename", async () => {
    await expect(flashFireOs(base(device().adb, "foo.bin"))).rejects.toThrow();
  });
});
