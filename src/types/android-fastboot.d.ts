// android-fastboot ships no typings; only the surface we use is declared.
declare module "android-fastboot" {
  export class FastbootError extends Error {
    status: string;
    bootloaderMessage: string;
  }
  export class FastbootDevice {
    readonly isConnected: boolean;
    connect(): Promise<void>;
    getVariable(name: string): Promise<string | null>;
    runCommand(command: string): Promise<{ text: string; dataSize?: string }>;
    upload(partition: string, buffer: ArrayBuffer, onProgress?: (p: number) => void): Promise<void>;
    flashBlob(partition: string, blob: Blob, onProgress?: (p: number) => void): Promise<void>;
    reboot(target?: string, wait?: boolean, onReconnect?: () => void): Promise<void>;
    waitForConnect(onReconnect?: () => void): Promise<void>;
  }
}
