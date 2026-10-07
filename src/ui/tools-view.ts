import { DEVICES } from "../devices";
import type { DeviceInfo } from "../devices/types";
import { t } from "../i18n";
import { flashFireOs, flashRoot } from "../steps/firmware-flash";
import { factoryReset, getSlot, guardedFlash, setSlot } from "../steps/tools";
import { flashTwrp } from "../steps/twrp";
import type { LoadedPackage } from "../package-loader";
import { loadPackage } from "../package-loader";
import { WebUsbAdb } from "../transport/adb-webusb";
import { WebUsbFastboot } from "../transport/fastboot-webusb";

/** What the tools tab needs from the host view. */
export interface ToolsCtx {
  root: HTMLElement;
  device?: DeviceInfo;
  pkg?: LoadedPackage;
  busy: boolean;
  logHtml: string;
  setDevice(d: DeviceInfo | undefined): void;
  setPkg(p: LoadedPackage): void;
  log(line: string): void;
  critical(fn: () => Promise<void>): Promise<void>;
  rerender(): void;
}

const bytes = async (f: File) => new Uint8Array(await f.arrayBuffer());

export function toolsBody(c: ToolsCtx): string {
  const dis = c.busy ? "disabled" : "";
  const opts = Object.values(DEVICES)
    .map((d) => `<option value="${d.codename}" ${c.device?.codename === d.codename ? "selected" : ""}>${d.name} (${d.codename})</option>`)
    .join("");
  const need = c.device ? "" : "disabled";
  return `<p>${t("tools.intro")}</p>
    <label>${t("tools.device")}: <select id="tdev"><option value="">–</option>${opts}</select></label>
    <h3>${t("tools.fastboot")}</h3>
    <div class="row">
      <label class="file">${t("tools.pkg")} <input type="file" id="tpkg" accept=".zip"></label>
      ${c.pkg ? `<span>✓ ${c.pkg.names().length}</span>` : ""}
    </div>
    <div class="row">
      <button class="primary" id="t-flashtwrp" ${dis} ${c.device && c.pkg ? "" : "disabled"}>${t("tools.flashTwrp")}</button>
      <button class="primary" id="t-bootrec" ${dis} ${need}>${t("tools.bootRecovery")}</button>
    </div>
    <div class="row">
      <input id="t-part" placeholder="${t("tools.partition")}" autocomplete="off">
      <input type="file" id="t-partfile">
      <button class="primary" id="t-flashpart" ${dis} ${need}>${t("tools.flashPartition")}</button>
    </div>
    <h3>${t("tools.twrp")}</h3>
    <div class="row">
      <label class="file">${t("flash.file")} <input type="file" id="t-fw" accept=".bin,.zip"></label>
      <button class="primary" id="t-flashfw" ${dis} ${need}>${t("tools.flashFirmware")}</button>
    </div>
    <div class="row">
      <label class="file">${t("root.file")} <input type="file" id="t-root" accept=".zip"></label>
      <button class="primary" id="t-flashroot" ${dis} ${need}>${t("root.run")}</button>
    </div>
    <div class="row">
      <button class="primary" id="t-slot" ${dis} ${need}>${t("tools.showSlot")}</button>
      <button class="primary" id="t-slota" ${dis} ${need}>${t("tools.setSlot", { slot: "A" })}</button>
      <button class="primary" id="t-slotb" ${dis} ${need}>${t("tools.setSlot", { slot: "B" })}</button>
      <button class="primary" id="t-wipe" ${dis} ${need}>${t("tools.wipe")}</button>
    </div>
    ${c.logHtml}`;
}

export function wireTools(c: ToolsCtx) {
  const $ = <T extends HTMLElement>(id: string) => c.root.querySelector<T>(`#${id}`);
  const on = (id: string, fn: () => Promise<void>) => $(id)?.addEventListener("click", () => c.critical(fn));
  const file = (id: string) => ($<HTMLInputElement>(id)?.files ?? [])[0];
  const dev = () => c.device!;

  $<HTMLSelectElement>("tdev")?.addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value as keyof typeof DEVICES;
    c.setDevice(v ? DEVICES[v] : undefined);
    c.rerender();
  });
  $("tpkg")?.addEventListener("change", async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      // No hashes yet (manifests pending), so only unpack.
      c.setPkg(await loadPackage(await bytes(f), { version: "unverified", files: {} }));
      c.rerender();
    } catch (err) {
      alert(t("prepare.zipError", { error: err instanceof Error ? err.message : String(err) }));
    }
  });

  on("t-flashtwrp", async () => {
    const name = dev().recoveryImage;
    const path = c.pkg!.names().find((n) => n === name || n.endsWith(`/${name}`));
    if (!path) throw new Error(t("exploit.imageMissing", { name }));
    await flashTwrp(await WebUsbFastboot.connect(), dev(), c.pkg!.get(path), c.log);
    c.log(t("tools.done"));
  });
  on("t-bootrec", async () => {
    const fb = await WebUsbFastboot.connect();
    c.log("reboot recovery");
    await fb.reboot("recovery");
  });
  on("t-flashpart", async () => {
    const part = $<HTMLInputElement>("t-part")?.value ?? "";
    const f = file("t-partfile");
    if (!f) throw new Error(t("flash.noFile"));
    await guardedFlash(await WebUsbFastboot.connect(), dev(), part, await bytes(f), c.log);
    c.log(t("tools.done"));
  });
  on("t-flashfw", async () => {
    const f = file("t-fw");
    if (!f) throw new Error(t("flash.noFile"));
    await flashFireOs({ adb: await WebUsbAdb.request(), device: dev(), fileName: f.name, firmware: await bytes(f), log: c.log });
    c.log(t("flash.done"));
  });
  on("t-flashroot", async () => {
    const f = file("t-root");
    if (!f) throw new Error(t("root.noFile"));
    await flashRoot(await WebUsbAdb.request(), dev(), await bytes(f), c.log);
    c.log(t("root.done"));
  });
  on("t-slot", async () => c.log(t("tools.slot", { slot: await getSlot(await WebUsbAdb.request(), dev()) })));
  on("t-slota", async () => { await setSlot(await WebUsbAdb.request(), dev(), "a"); c.log(t("tools.done")); });
  on("t-slotb", async () => { await setSlot(await WebUsbAdb.request(), dev(), "b"); c.log(t("tools.done")); });
  on("t-wipe", async () => {
    if (!confirm(t("tools.wipeConfirm"))) return;
    c.log((await factoryReset(await WebUsbAdb.request(), dev())).trim());
    c.log(t("tools.done"));
  });
}
