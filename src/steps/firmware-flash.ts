import type { DeviceInfo } from "../devices/types";
import type { AdbTransport } from "../transport/adb";
import { validateFirmwareName } from "./firmware";

export interface FlashDeps {
  adb: AdbTransport;
  device: DeviceInfo;
  fileName: string;
  firmware: Uint8Array;
  log(line: string): void;
  onProgress?(fraction: number): void;
}

async function must(adb: AdbTransport, cmd: string, log: (l: string) => void): Promise<string> {
  const r = await adb.shell(cmd);
  log(`$ ${cmd}\n${r.output.trim()}`);
  if (r.exitCode !== 0) throw new Error(`"${cmd}" failed (exit ${r.exitCode}): ${r.output.trim()}`);
  return r.output;
}

/** Device must report the expected codename before any write (spec §6). */
export async function assertDevice(adb: AdbTransport, device: DeviceInfo): Promise<void> {
  const { output } = await adb.shell("getprop ro.product.device");
  const actual = output.trim();
  if (!actual.toLowerCase().includes(device.codename)) {
    throw new Error(`Wrong device: expected ${device.codename}, got "${actual}"`);
  }
}

type Slot = "a" | "b";

/**
 * The slot a FireOS install wrote, from TWRP's own report:
 * "Flashing A/B zip to inactive slot: B". TWRP writes the slot it did NOT
 * boot from and stages a switch to it; the switch happens on the next
 * "reboot recovery".
 */
export function flashedSlot(output: string): Slot {
  const m = /inactive slot:\s*([AB])\b/i.exec(output);
  const slot = m?.[1];
  if (!slot) throw new Error(`TWRP did not say which slot it flashed: ${output.trim()}`);
  return slot.toLowerCase() as Slot;
}

/**
 * Install once and make sure the slot just written is the one booted next.
 * TWRP stages that itself on the first install of a recovery session (later
 * installs in the same session leave the BCB alone), so this reads the BCB
 * and writes it only if it does not already name the slot. Toggling blindly here would UNDO TWRP's switch and
 * send the second install to the same slot again (seen on radar, 2026-10-10:
 * all three installs went to B, A was never written).
 */
async function installAndStage(adb: AdbTransport, log: (l: string) => void): Promise<Slot> {
  const slot = flashedSlot(await must(adb, "twrp install /sdcard/update.zip", log));
  const active = (await must(adb, "bcbtool get_active", log)).trim();
  if (active !== slot) {
    await must(adb, `bcbtool set_active ${slot}`, log);
    const now = (await must(adb, "bcbtool get_active", log)).trim();
    if (now !== slot) throw new Error(`Could not stage slot ${slot}: bcbtool still reports "${now}"`);
  }
  return slot;
}

async function rebootRecovery(adb: AdbTransport, device: DeviceInfo, log: (l: string) => void): Promise<AdbTransport> {
  await adb.reboot("recovery");
  log("Rebooting to recovery – waiting for ADB …");
  const next = await adb.waitForReconnect();
  await assertDevice(next, device);
  return next;
}

/**
 * Spec §5.5: wipe, then install into BOTH slots. Each install writes the slot
 * TWRP did not boot from, so a reboot into recovery between them is what
 * moves the second install to the other slot. The last reboot consumes the
 * second staged switch, so the device boots what it was last given.
 */
export async function flashFireOs(d: FlashDeps): Promise<AdbTransport> {
  const check = validateFirmwareName(d.device, d.fileName);
  if (!check.ok) throw new Error(check.reason);

  let adb = d.adb;
  const log = d.log;
  await assertDevice(adb, d.device);

  await must(adb, "twrp wipe cache", log);
  await must(adb, "twrp wipe data", log);
  log(`push ${d.fileName} → /sdcard/update.zip`);
  await adb.push("/sdcard/update.zip", d.firmware, d.onProgress);

  const first = await installAndStage(adb, log);
  adb = await rebootRecovery(adb, d.device, log);
  const second = await installAndStage(adb, log);
  if (second === first) {
    throw new Error(`Both installs wrote slot ${first}; the other slot still holds the old system`);
  }
  return rebootRecovery(adb, d.device, log);
}

/** Spec §5.6 */
export async function flashRoot(adb: AdbTransport, device: DeviceInfo, bootRoot: Uint8Array, log: (l: string) => void) {
  await assertDevice(adb, device);
  await adb.push("/sdcard/boot-root.zip", bootRoot);
  await must(adb, "twrp install /sdcard/boot-root.zip", log);
  await adb.reboot();
}
