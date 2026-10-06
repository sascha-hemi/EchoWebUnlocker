/** Minimal fastboot surface the exploit logic depends on (allows mocking). */
export interface FastbootTransport {
  getvar(name: string): Promise<string>;
  /**
   * Flash a partition. Must reject with `FastbootTimeoutError` when `timeoutMs`
   * elapses, without hanging or leaving the transport unusable.
   */
  flash(partition: string, data: Uint8Array, opts?: { timeoutMs?: number }): Promise<void>;
  reboot(target?: "recovery" | "bootloader"): Promise<void>;
}

export class FastbootTimeoutError extends Error {
  constructor() {
    super("fastboot operation timed out");
    this.name = "FastbootTimeoutError";
  }
}
