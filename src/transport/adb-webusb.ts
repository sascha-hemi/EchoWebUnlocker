import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager, type AdbDaemonWebUsbDevice } from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";
import type { AdbTransport } from "./adb";

const credentialStore = new AdbWebCredentialStore("EchoWebUnlocker");

async function open(device: AdbDaemonWebUsbDevice): Promise<Adb> {
  const connection = await device.connect();
  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial,
    connection,
    credentialStore,
  });
  return new Adb(transport);
}

const CHUNK = 64 * 1024;

export class WebUsbAdb implements AdbTransport {
  private constructor(private readonly adb: Adb) {}

  /** Must be called from a user gesture (opens the WebUSB device picker). */
  static async request(): Promise<WebUsbAdb> {
    const mgr = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!mgr) throw new Error("WebUSB not available");
    const dev = await mgr.requestDevice();
    if (!dev) throw new Error("No device selected");
    return new WebUsbAdb(await open(dev));
  }

  async shell(command: string): Promise<{ output: string; exitCode: number }> {
    const sp = this.adb.subprocess.shellProtocol;
    if (sp) {
      const r = await sp.spawnWaitText(command);
      return { output: r.stdout + r.stderr, exitCode: r.exitCode };
    }
    // TWRP's adbd may lack the shell protocol: no exit code available.
    return { output: await this.adb.subprocess.noneProtocol.spawnWaitText(command), exitCode: 0 };
  }

  async push(remotePath: string, data: Uint8Array, onProgress?: (f: number) => void): Promise<void> {
    const sync = await this.adb.sync();
    try {
      let sent = 0;
      const file = new ReadableStream<Uint8Array>({
        pull(ctrl) {
          if (sent >= data.length) return ctrl.close();
          const end = Math.min(sent + CHUNK, data.length);
          ctrl.enqueue(data.subarray(sent, end));
          sent = end;
          onProgress?.(sent / data.length);
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await sync.write({ filename: remotePath, file: file as any, permission: 0o644 });
    } finally {
      await sync.dispose();
    }
  }

  async reboot(target?: "recovery" | "bootloader"): Promise<void> {
    const cmd = target ? `reboot ${target}` : "reboot";
    // The device drops the connection mid-command, so errors are expected.
    await this.adb.subprocess.noneProtocol.spawnWaitText(cmd).catch(() => {});
    await this.adb.close().catch(() => {});
  }

  /**
   * After a reboot the old WebUSB handle is dead. Previously authorised devices are
   * returned by `getDevices()`, so no user gesture is needed. Polls until one appears.
   */
  async waitForReconnect(timeoutMs = 120_000): Promise<WebUsbAdb> {
    const mgr = AdbDaemonWebUsbDeviceManager.BROWSER;
    if (!mgr) throw new Error("WebUSB not available");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const [dev] = await mgr.getDevices();
      if (!dev) continue;
      try {
        return new WebUsbAdb(await open(dev));
      } catch {
        /* still booting / interface busy – retry */
      }
    }
    throw new Error("ADB device not found after reboot");
  }
}
