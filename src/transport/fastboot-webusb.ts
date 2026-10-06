import { FastbootDevice } from "android-fastboot";
import { FastbootTimeoutError, type FastbootTransport } from "./fastboot";

/** The subset of FastbootDevice used here (allows a fake in tests). */
export type FastbootDeviceLike = Pick<
  FastbootDevice,
  "getVariable" | "runCommand" | "upload" | "flashBlob" | "reboot"
>;

/**
 * WebUSB fastboot adapter. Must be created from a user gesture because
 * `connect()` may call `navigator.usb.requestDevice()`.
 */
export class WebUsbFastboot implements FastbootTransport {
  constructor(private readonly dev: FastbootDeviceLike) {}

  static async connect(): Promise<WebUsbFastboot> {
    const dev = new FastbootDevice();
    await dev.connect();
    return new WebUsbFastboot(dev);
  }

  async getvar(name: string): Promise<string> {
    return (await this.dev.getVariable(name)) ?? "";
  }

  /**
   * Raw `download` + `flash:<partition>`. Deliberately bypasses `flashBlob`,
   * which appends A/B slot suffixes and converts images to sparse format.
   * That would change what the original fastbrick.sh sends.
   *
   * On timeout the in-flight USB transfer cannot be cancelled; it is left
   * pending and its eventual rejection (device reset/disconnect) is swallowed.
   */
  async flash(partition: string, data: Uint8Array, opts?: { timeoutMs?: number }): Promise<void> {
    const work = (async () => {
      const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      await this.dev.upload(partition, buf);
      await this.dev.runCommand(`flash:${partition}`);
    })();
    if (opts?.timeoutMs === undefined) return work;

    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new FastbootTimeoutError()), opts.timeoutMs);
    });
    work.catch(() => {});
    try {
      await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  async reboot(target?: "recovery" | "bootloader"): Promise<void> {
    await this.dev.reboot(target ?? "");
  }
}
