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

/** Spec §5.5: wipe, install into both slots, reboot recovery in between. */
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
  await must(adb, "twrp install /sdcard/update.zip", log);

  const switchSlot =
    "s=$(bcbtool get_active); case $s in a) bcbtool set_active b;; b) bcbtool set_active a;; *) echo \"unexpected: $s\"; exit 1;; esac";
  await must(adb, switchSlot, log);

  await adb.reboot("recovery");
  log("Rebooting to recovery – waiting for ADB …");
  adb = await adb.waitForReconnect();
  await assertDevice(adb, d.device);
  await must(adb, "twrp install /sdcard/update.zip", log);
  return adb;
}

/** Spec §5.6 */
export async function flashRoot(adb: AdbTransport, device: DeviceInfo, bootRoot: Uint8Array, log: (l: string) => void) {
  await assertDevice(adb, device);
  await adb.push("/sdcard/boot-root.zip", bootRoot);
  await must(adb, "twrp install /sdcard/boot-root.zip", log);
  await adb.reboot();
}
