import { DEVICES, EXCLUDED_CRUMPET } from "../devices";
import type { DeviceInfo, Route } from "../devices/types";
import { runFastbrick } from "../exploits/fastbrick";
import { loadPackage, type LoadedPackage } from "../package-loader";
import { flashFireOs, flashRoot } from "../steps/firmware-flash";
import type { AdbTransport } from "../transport/adb";
import { WebUsbAdb } from "../transport/adb-webusb";
import { WebUsbFastboot } from "../transport/fastboot-webusb";
import { LANGS, getLang, setLang, t, type Lang } from "../i18n";
import { browserSupport } from "./browser-check";
import { toolsBody, wireTools, type ToolsCtx } from "./tools-view";

type Step = "disclaimer" | "device" | "route" | "prepare" | "exploit" | "flash" | "root" | "done";
const ORDER: Step[] = ["disclaimer", "device", "route", "prepare", "exploit", "flash", "root", "done"];

interface State {
  mode: "wizard" | "tools";
  step: Step;
  device?: DeviceInfo;
  route?: Route;
  pkg?: LoadedPackage;
  adb?: AdbTransport;
  busy: boolean;
  log: string[];
  progress?: number;
}
const st: State = { mode: "wizard", step: "disclaimer", busy: false, log: [] };
let root: HTMLElement;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const log = (l: string) => { st.log.push(l); const el = root.querySelector("pre.log"); if (el) { el.textContent = st.log.join("\n"); el.scrollTop = el.scrollHeight; } };
const go = (s: Step) => { st.step = s; render(); };
const guard = (e: BeforeUnloadEvent) => e.preventDefault();

/** Runs a critical phase with a beforeunload warning (spec §6). */
async function critical(fn: () => Promise<void>) {
  st.busy = true; window.addEventListener("beforeunload", guard);
  // Start fn() before render(): its synchronous part reads <input> values that render() would discard.
  const running = fn();
  render();
  try { await running; } catch (e) { log(t("error", { error: e instanceof Error ? e.message : String(e) })); }
  finally { st.busy = false; window.removeEventListener("beforeunload", guard); render(); }
}

async function readFile(f: File): Promise<Uint8Array> { return new Uint8Array(await f.arrayBuffer()); }
const file = (id: string) => (root.querySelector<HTMLInputElement>(`#${id}`)?.files ?? [])[0];

function body(): string {
  const d = st.device;
  const logBox = `<pre class="log">${esc(st.log.join("\n"))}</pre>`;
  switch (st.step) {
    case "disclaimer": {
      const { usb, serial } = browserSupport();
      return `<div class="warn">${t("disclaimer.risk")}</div>
        ${usb && serial ? "" : `<div class="warn">${t("disclaimer.browser")}</div>`}
        <label><input type="checkbox" id="ack"> ${t("disclaimer.ack")}</label>
        <div class="row"><button class="primary" id="next" disabled>${t("next")}</button></div>`;
    }
    case "device":
      return `<div class="cards">${Object.values(DEVICES).map((x) =>
        `<button class="card" data-dev="${x.codename}"><b>${esc(x.name)}</b><small>${x.codename} · ${t("device.model", { model: x.model })} · ${x.soc}</small></button>`).join("")}</div>
        <div class="warn">${t("device.crumpet", { codename: EXCLUDED_CRUMPET.codename, model: EXCLUDED_CRUMPET.model })}</div>`;
    case "route":
      return `<p>${t("route.question")}</p><div class="cards">
        <button class="card" data-route="fastbrick"><b>${t("route.a.title")}</b><small>${t("route.a.desc")}</small></button>
        <button class="card" data-route="brom"><b>${t("route.b.title")}</b><small>${t("route.b.desc")}</small></button></div>`;
    case "prepare":
      return `<p>${t("prepare.intro", { device: esc(d!.name), route: st.route === "brom" ? t("prepare.routeBrom") : t("prepare.routeFastbrick") })}</p>
        <ul>${st.route === "fastbrick" ? `<li>${t("prepare.fastboot")}</li>`
          : d!.exploit === "amonet" ? `<li>${t("prepare.testpoint")}</li>` : `<li>${t("prepare.uber")}</li>`}
        ${d!.codename === "radar" || d!.codename === "donut" ? `<li>${t("prepare.pads")}</li>` : ""}
        <li>${t("prepare.os")}</li></ul>
        <label class="file">${t("prepare.zip", { pkg: esc(d!.pkg) })} <input type="file" id="pkg" accept=".zip"></label>
        <div class="warn">${t("prepare.noHash")}</div>
        <div class="row"><button class="primary" id="next" disabled>${t("next")}</button></div>`;
    case "exploit":
      if (st.route === "brom") return `<div class="warn">${t("exploit.bromMissing", { exploit: d!.exploit })}</div><button class="link" id="back">${t("back")}</button>`;
      return `<p>${t("exploit.confirm")}</p>
        <div class="row"><input id="yes" placeholder="YES" autocomplete="off"><button class="primary" id="run" disabled>${t("start")}</button></div>
        ${st.busy ? `<p>${t("exploit.running")}</p>` : ""}
        ${logBox}
        <div class="row"><button class="primary" id="next" ${st.busy ? "disabled" : ""}>${t("exploit.toFlash")}</button></div>`;
    case "flash":
      return `<p>${t("flash.intro")}</p>
        <label class="file">${t("flash.file")} <input type="file" id="fw" accept=".bin,.zip"></label>
        <div class="row"><button class="primary" id="run" ${st.busy ? "disabled" : ""}>${t("flash.run")}</button></div>
        ${st.progress !== undefined ? `<progress max="1" value="${st.progress}"></progress>` : ""}
        ${logBox}
        <div class="row"><button class="link" id="skip" ${st.busy ? "disabled" : ""}>${t("skip")}</button> <button class="primary" id="next" ${st.busy ? "disabled" : ""}>${t("flash.toRoot")}</button></div>`;
    case "root":
      return `<label class="file">${t("root.file")} <input type="file" id="rootzip" accept=".zip"></label>
        <div class="row"><button class="primary" id="run" ${st.busy ? "disabled" : ""}>${t("root.run")}</button><button class="link" id="next">${t("root.skip")}</button></div>
        ${logBox}`;
    case "done":
      return `<p>${t("done.keys")}</p><p>${t("done.adb")}</p>`;
  }
}

function wire() {
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`);
  $("ack")?.addEventListener("change", (e) => { $<HTMLButtonElement>("next")!.disabled = !(e.target as HTMLInputElement).checked; });
  $("pkg")?.addEventListener("change", (e) => { $<HTMLButtonElement>("next")!.disabled = !(e.target as HTMLInputElement).files?.length; });
  $("yes")?.addEventListener("input", (e) => { $<HTMLButtonElement>("run")!.disabled = (e.target as HTMLInputElement).value !== "YES" || st.busy; });
  $("back")?.addEventListener("click", () => go("route"));
  root.querySelectorAll<HTMLElement>("[data-dev]").forEach((b) => b.addEventListener("click", () => {
    st.device = DEVICES[b.dataset.dev as keyof typeof DEVICES]; st.log = [];
    if (st.device.routes.length > 1) go("route"); else { st.route = "brom"; go("prepare"); }
  }));
  root.querySelectorAll<HTMLElement>("[data-route]").forEach((b) => b.addEventListener("click", () => { st.route = b.dataset.route as Route; go("prepare"); }));
  $("skip")?.addEventListener("click", () => go("done"));

  $("next")?.addEventListener("click", async () => {
    const s = st.step;
    if (s === "prepare") {
      try {
        // No hashes yet (manifests pending), so only unpack.
        st.pkg = await loadPackage(await readFile(file("pkg")!), { version: "unverified", files: {} });
      } catch (e) { alert(t("prepare.zipError", { error: e instanceof Error ? e.message : String(e) })); return; }
    }
    const nxt: Partial<Record<Step, Step>> = { disclaimer: "device", prepare: "exploit", exploit: "flash", flash: "root", root: "done" };
    st.log = []; go(nxt[s]!);
  });

  if (st.step === "exploit" && st.route === "fastbrick") $("run")?.addEventListener("click", () => critical(async () => {
    const fb = await WebUsbFastboot.connect();
    const r = await runFastbrick({
      fb, device: st.device!, log,
      loadImage: async (name) => {
        const p = st.pkg!.names().find((n) => n.endsWith(`/${name}`) || n === name);
        if (!p) throw new Error(t("exploit.imageMissing", { name }));
        return st.pkg!.get(p);
      },
    });
    const msg: Record<typeof r.status, string> = {
      success: t("exploit.success"),
      "already-unlocked": t("exploit.unlocked"),
      "emmc-ro": t("exploit.emmc", { boots: "boots" in r && r.boots ? `, boots=${r.boots}` : "" }),
      "device-mismatch": t("exploit.mismatch"),
      "wrong-product": t("exploit.wrongProduct", { product: "product" in r ? r.product : "?" }),
    };
    log(msg[r.status]);
  }));

  if (st.step === "flash") $("run")?.addEventListener("click", () => critical(async () => {
    const f = file("fw");
    if (!f) throw new Error(t("flash.noFile"));
    st.progress = 0;
    const adb = await WebUsbAdb.request();
    st.adb = await flashFireOs({
      adb, device: st.device!, fileName: f.name, firmware: await readFile(f), log,
      onProgress: (p) => { st.progress = p; root.querySelector("progress")?.setAttribute("value", String(p)); },
    });
    log(t("flash.done"));
  }));

  if (st.step === "root") $("run")?.addEventListener("click", () => critical(async () => {
    const f = file("rootzip");
    if (!f) throw new Error(t("root.noFile"));
    await flashRoot(st.adb ?? (await WebUsbAdb.request()), st.device!, await readFile(f), log);
    log(t("root.done"));
  }));
}

const toolsCtx = (): ToolsCtx => ({
  root, device: st.device, pkg: st.pkg, busy: st.busy,
  logHtml: `<pre class="log">${esc(st.log.join("\n"))}</pre>`,
  setDevice: (d) => { st.device = d; },
  setPkg: (p) => { st.pkg = p; },
  log, critical, rerender: render,
});

function render() {
  const idx = ORDER.indexOf(st.step);
  const tools = st.mode === "tools";
  root.innerHTML = `<main>
    <div class="row" style="justify-content:space-between;margin-top:0">
      <h1>${t("title")}</h1>
      <label>${t("language")}: <select id="lang">${(Object.keys(LANGS) as Lang[]).map((l) =>
        `<option value="${l}" ${l === getLang() ? "selected" : ""}>${LANGS[l].name}</option>`).join("")}</select></label>
    </div>
    <p class="sub">${t("subtitle")}</p>
    <div class="row"><button class="${tools ? "link" : "primary"}" id="mode-wizard">${t("mode.wizard")}</button>
      <button class="${tools ? "primary" : "link"}" id="mode-tools">${t("mode.tools")}</button></div>
    ${tools ? "" : `<ol class="steps">${ORDER.map((k, i) => `<li class="${i === idx ? "on" : i < idx ? "done" : ""}">${t(`step.${k}`)}</li>`).join("")}</ol>`}
    ${tools ? toolsBody(toolsCtx()) : body()}
    <footer>${t("footer")}</footer></main>`;
  root.querySelector<HTMLSelectElement>("#lang")!.addEventListener("change", (e) => {
    setLang((e.target as HTMLSelectElement).value as Lang);
    render();
  });
  for (const m of ["wizard", "tools"] as const) {
    root.querySelector(`#mode-${m}`)!.addEventListener("click", () => {
      if (st.busy || st.mode === m) return;
      st.mode = m; st.log = []; render();
    });
  }
  if (tools) wireTools(toolsCtx()); else wire();
}

export function mountWizard(el: HTMLElement) { root = el; render(); }
