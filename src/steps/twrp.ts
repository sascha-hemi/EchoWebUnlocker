import type { DeviceInfo } from "../devices/types";
import type { FastbootTransport } from "../transport/fastboot";

/**
 * Port of fastboot-step.sh (spec §5.4): flash TWRP to `recovery`, then reboot into it.
 * kaeru remaps `recovery` to the `swdl` partition internally, so only `recovery` is sent.
 */
export async function flashTwrp(
  fb: FastbootTransport,
  device: DeviceInfo,
  image: Uint8Array,
  log: (l: string) => void,
): Promise<void> {
  await assertFastbootDevice(fb, device, log);
  log(`flash recovery (${device.recoveryImage})`);
  await fb.flash("recovery", image);
  log("reboot recovery");
  await fb.reboot("recovery");
}

/**
 * Device check before a write (spec §6). The `product` of the kamakiri devices' hacked
 * fastboot is not known yet, so for devices without `fastbootProduct` a mismatch is only logged.
 */
export async function assertFastbootDevice(
  fb: FastbootTransport,
  device: DeviceInfo,
  log: (l: string) => void,
): Promise<void> {
  const product = (await fb.getvar("product")).trim();
  if (device.fastbootProduct) {
    if (product.toUpperCase() !== device.fastbootProduct) {
      throw new Error(`Wrong device: expected ${device.fastbootProduct}, got "${product}"`);
    }
  } else {
    log(`product=${product || "(empty)"} (not verified for ${device.codename})`);
  }
}
