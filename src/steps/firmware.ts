import type { DeviceInfo } from "../devices/types";

export interface FirmwareCheck {
  ok: boolean;
  reason?: string;
}

/** Filename validation before flashing (spec §5.5). */
export function validateFirmwareName(device: DeviceInfo, fileName: string): FirmwareCheck {
  if (!fileName.includes(device.firmwareMarker)) {
    return { ok: false, reason: `File name does not contain "${device.firmwareMarker}"` };
  }
  if (device.fireOs6Only && !/NS6/.test(fileName)) {
    return { ok: false, reason: "Only FireOS 6 (NS6…) is supported" };
  }
  if (/incremental/i.test(fileName)) {
    return { ok: false, reason: "Full updates only, no incrementals" };
  }
  return { ok: true };
}
