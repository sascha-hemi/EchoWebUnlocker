import type { DeviceInfo } from "../devices/types";
import type { AdbTransport } from "../transport/adb";
import { isPartitionBlocked } from "../transport/blocklist";
import type { FastbootTransport } from "../transport/fastboot";
import { assertDevice } from "./firmware-flash";
import { assertFastbootDevice } from "./twrp";

export type Slot = "a" | "b";

/** Tools-tab flash: blocklist and device check first (spec §6). */
export async function guardedFlash(
  fb: FastbootTransport,
  device: DeviceInfo,
  partition: string,
  data: Uint8Array,
  log: (l: string) => void,
): Promise<void> {
  const name = partition.trim();
  if (!name) throw new Error("No partition given");
  if (isPartitionBlocked(name)) throw new Error(`Partition "${name}" is blocked for safety`);
  await assertFastbootDevice(fb, device, log);
  log(`flash ${name} (${data.length} bytes)`);
  await fb.flash(name, data);
}

export async function getSlot(adb: AdbTransport, device: DeviceInfo): Promise<string> {
  await assertDevice(adb, device);
  return (await adb.shell("bcbtool get_active")).output.trim();
}

export async function setSlot(adb: AdbTransport, device: DeviceInfo, slot: Slot): Promise<void> {
  await assertDevice(adb, device);
  const r = await adb.shell(`bcbtool set_active ${slot}`);
  if (r.exitCode !== 0) throw new Error(`bcbtool set_active ${slot} failed: ${r.output.trim()}`);
}

/** `twrp wipe data` (factory reset). The caller must have asked the user to confirm. */
export async function factoryReset(adb: AdbTransport, device: DeviceInfo): Promise<string> {
  await assertDevice(adb, device);
  const r = await adb.shell("twrp wipe data");
  if (r.exitCode !== 0) throw new Error(`twrp wipe data failed: ${r.output.trim()}`);
  return r.output;
}
