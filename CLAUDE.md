# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

The spec ([echo-web-unlocker-spec.md](echo-web-unlocker-spec.md), German) remains the source of truth.

Implemented and unit-tested with mocks, never run against real hardware:
- Device metadata ([src/devices/](src/devices/)).
- Fastbrick port ([src/exploits/fastbrick.ts](src/exploits/fastbrick.ts)).
- Fastboot adapter on `android-fastboot` ([src/transport/fastboot-webusb.ts](src/transport/fastboot-webusb.ts)). It sends raw `download` + `flash:<part>` and avoids `flashBlob`, which would add A/B suffixes and sparse conversion.
- ADB adapter on `@yume-chan/adb` ([src/transport/adb-webusb.ts](src/transport/adb-webusb.ts)).
- FireOS and root steps ([src/steps/firmware-flash.ts](src/steps/firmware-flash.ts)), each preceded by a device check.
- ZIP loader with SHA-256 verification ([src/package-loader.ts](src/package-loader.ts)).
- Filename validation and the partition blocklist.
- TWRP fastboot step ([src/steps/twrp.ts](src/steps/twrp.ts)) and tools tab ([src/ui/tools-view.ts](src/ui/tools-view.ts), logic in [src/steps/tools.ts](src/steps/tools.ts)). The wizard does not call the TWRP step yet, because it is only needed after the BROM routes. The tools tab can run it.
- `critical()` in the wizard starts the work before `render()`, because `render()` rebuilds the DOM and discards `<input>` values.
- Wizard UI ([src/ui/wizard.ts](src/ui/wizard.ts)) with i18n ([src/i18n/](src/i18n/)). The languages are en, de, nl, fr, it and pl. The language is picked from the saved choice, then `navigator.languages`, then English. `en.ts` defines the key set and the other dictionaries are typed against it. Library-level error messages are English only.

Still missing:
- Real `manifests/*.json`. Hashes need the actual release ZIPs.
- The amonet and kamakiri BROM ports.

## Commands

- `npm run dev`: Vite dev server
- `npm run build`: typecheck plus production build
- `npm run typecheck`
- `npm test`: Vitest. Run one file with `npx vitest run src/exploits/fastbrick.test.ts`, or one test with `-t "<name>"`.

Exploit logic depends on transport interfaces (e.g. `FastbootTransport`) so it can be unit-tested with mocks. Hardware-facing adapters can only be verified on real devices.

## What is being built

"Echo Web Unlocker": a static, backend-free, browser-only wizard that unlocks, roots, installs TWRP on and unbricks four Amazon Echo devices over **WebUSB** and **WebSerial** (Chrome/Edge only, HTTPS required). It re-implements the existing shell and Python tooling by R0rt1z2, Rortiz2 and bengris32 (amonet, kamakiri, kaeru). It must **not** introduce new exploits or alter payloads.

Planned stack: Vite + TypeScript. Libraries: `android-fastboot` (fastboot), `@yume-chan/adb` with `adb-daemon-webusb` (ADB), `fflate` or `zip.js` (ZIP handling). The BROM exploits are hand ports of the Python `modules/*.py`. Planned layout is in spec §8 (`src/devices`, `transport`, `exploits`, `steps`, `ui`, `package-loader.ts`, `manifests/*.json`).

## Architecture (big picture)

The device determines the exploit path, and all paths converge on the same later steps:

- `biscuit` and `radar` (MT8163, amonet):
  - Path A, fastbrick: via fastboot, when the device still boots.
  - Path B, BROM: via WebSerial at 115200 baud, needs a test point.
- `cupcake` and `donut` (MT8516, kamakiri): BROM only, via WebUSB control transfers.
- After BROM, the flow runs the fastboot step (flash TWRP, `reboot recovery`), then flashes FireOS through ADB in TWRP (§5.5), then optionally flashes root (§5.6).
- A separate tools tab covers already-unlocked devices.
- Each step is a port of a specific upstream script: `fastbrick.sh`, `fastboot-step.sh`, and the Python `modules/` (`main`, `common`, `handshake*`, `load_payload`, `gpt`, `device`, `check_sig`). Port step order, offsets and GPT handling exactly, and compare log output against the originals.

## Constraints that are easy to get wrong

- `donut` (Echo Dot 3, D9N29T) is not `crumpet` (Echo Dot 3 Refresh, C78MP8). The UI must explicitly exclude `crumpet`.
- Fastbrick (§5.1): a flash timeout counts as success. The fastboot lib must abort on timeout without throwing or hanging. Abort on `eMMC-RO` (hardware fault) and on `Device mismatch`. Pick the payload from `getvar lk_build_desc`.
- WebSerial (§5.2): `requestPort()` needs a user gesture, but the BROM window is short. Pre-authorize the port and wait for `0e8d:0003` via `getPorts()` and the `connect` event.
- kamakiri (§5.3): `claimInterface` on the CDC-ACM BROM may fail because the OS binds a driver. Linux `cdc_acm` may need an unbind or udev rule, and Windows needs WinUSB via Zadig. Tolerate the expected USB stalls, as the Python original does.
- USB IDs: MediaTek BROM is `0e8d:0003`, Preloader is `0e8d:2000`. Amazon fastboot and ADB use vendor `1949`, with per-device PIDs still to be captured.
- Safety rules (§6):
  - Block `flash` and `erase` of `preloader`, `lk*`, `tee1`, `tee2`, `tz`, `expdb` and `swdl` in the tools tab. Internal steps are exempt.
  - Verify the device (`getvar product` or `ro.product.device`) before every write.
  - Check payload SHA-256 against the per-device manifest.
  - Show a `beforeunload` warning during critical phases.
- Firmware validation: the filename must contain `kindle-<codename>` (or `<codename>_puffin` for biscuit, radar and donut). biscuit and radar accept FireOS 6 (`NS6…`) only. Accept full updates only.
- Payloads and licensing: do not rehost release ZIPs (`amonet-*`, `kamakiri-*`, `boot-root.zip`) without author permission. The default design has the user select the downloaded ZIP and the tool unpacks it in-browser. The tool is GPL-2.0, with visible credits to k4y0z, xyz`, Rortiz2 and bengris32.
- Scope: no hardware-prep automation, no hosting of FireOS images, and no Firefox or Safari support.

## Open questions (spec §11)

Author permission for payloads, whether `twrp-cupcake.img` is correct for donut, WebUSB claiming of the MT8516 BROM on Linux and macOS, JS timing for kamakiri, the exact fastboot and ADB PIDs, and inconsistencies in the radar thread.
