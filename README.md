# Echo Web Unlocker

A browser-based tool that guides you through unlocking, installing TWRP, flashing FireOS and rooting selected Amazon Echo devices. It uses **WebUSB** and **WebSerial**, so it needs no local install (no Python, ADB or fastboot).

> ## ⚠️ Work in progress – untested
>
> **This project is under active development and has not been tested on real hardware.**
> The code is only covered by unit tests with mocked USB transports. Using it on a real device
> **can permanently brick it** and void your warranty. **Do not use it on a device you care about.**
> Use at your own risk, with no warranty of any kind.

## Status

| Area | State |
|---|---|
| Fastbrick exploit (biscuit, radar) | Implemented, untested on hardware |
| Fastboot (WebUSB) and ADB (WebUSB) adapters | Implemented, untested on hardware |
| FireOS and root flashing via TWRP | Implemented, untested on hardware |
| Wizard UI, 6 languages (en, de, nl, fr, it, pl) | Implemented, only partly reviewed |
| amonet BROM (WebSerial), kamakiri BROM (WebUSB) | **Not implemented** |
| SHA-256 manifests for release packages | **Not implemented** – package integrity is not verified yet |
| TWRP fastboot step, tools tab (flash TWRP, boot recovery, partition flash with blocklist, slot, factory reset) | Implemented, untested on hardware |

## Supported devices

| Codename | Device | Model | Method |
|---|---|---|---|
| `biscuit` | Echo Dot 2nd gen (2016) | RS03QR | fastbrick, BROM |
| `radar` | Echo 2nd gen (2017) | XC56PY | fastbrick, BROM |
| `cupcake` | Echo Input (2018) | C1125P | BROM |
| `donut` | Echo Dot 3rd gen (2018) | D9N29T | BROM |

The Echo Dot 3 Refresh (`crumpet`, C78MP8) is **not** supported.

## How it works

The tool re-implements existing exploits and scripts by other authors in the browser. It adds no new exploits and does not change their payloads. It does not host any payloads or firmware: you download the release ZIPs and FireOS images yourself and select them in the tool, which unpacks them locally in your browser. Nothing is uploaded and there is no telemetry.

Requirements: Chrome or Edge on desktop (WebUSB/WebSerial). Firefox and Safari are not supported.

## Development

```
npm install
npm run dev        # dev server
npm test           # unit tests (mocked transports)
npm run build      # typecheck + production build
```

See [echo-web-unlocker-spec.md](echo-web-unlocker-spec.md) (German) for the full specification.

## Credits and license

Based on the work of k4y0z, xyz`, Rortiz2, bengris32 and R0rt1z2 ([amonet](https://github.com/R0rt1z2/amonet), [kamakiri](https://github.com/R0rt1z2/kamakiri), [kaeru](https://github.com/R0rt1z2/kaeru)). Not affiliated with Amazon. Licensed under GPL-2.0.
