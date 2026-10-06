/** ADB surface the TWRP/firmware/root steps depend on (allows mocking). */
export interface AdbTransport {
  shell(command: string): Promise<{ output: string; exitCode: number }>;
  push(remotePath: string, data: Uint8Array, onProgress?: (fraction: number) => void): Promise<void>;
  /** Fire-and-forget: the connection drops while the device reboots. */
  reboot(target?: "recovery" | "bootloader"): Promise<void>;
  /** Resolve once a (new) ADB device is connected again after a reboot. */
  waitForReconnect(): Promise<AdbTransport>;
}
