import type { Codename, DeviceInfo } from "./types";

export const DEVICES: Record<Codename, DeviceInfo> = {
  biscuit: {
    codename: "biscuit",
    name: "Echo Dot (2016, 2nd gen)",
    model: "RS03QR",
    soc: "MT8163",
    exploit: "amonet",
    pkg: "amonet-biscuit-v2.0.0",
    routes: ["fastbrick", "brom"],
    fastbootProduct: "BISCUIT",
    fastbrick: {
      defaultImage: "fastbrick.img",
      images: [{ lkBuildDescPrefix: "63cb91b-20221007_072309", image: "fastbrick-20221007.img" }],
    },
    firmwareMarker: "biscuit_puffin",
    fireOs6Only: true,
    recoveryImage: "bin/twrp.img",
  },
  radar: {
    codename: "radar",
    name: "Echo (2017, 2nd gen)",
    model: "XC56PY",
    soc: "MT8163",
    exploit: "amonet",
    pkg: "amonet-radar-v1.0.0",
    routes: ["fastbrick", "brom"],
    fastbootProduct: "RADAR",
    fastbrick: {
      defaultImage: "fastbrick.img",
      images: [{ lkBuildDescPrefix: "59779ca-20220524_183401", image: "fastbrick-20220524.img" }],
    },
    firmwareMarker: "radar_puffin",
    fireOs6Only: true,
    recoveryImage: "bin/twrp.img",
  },
  cupcake: {
    codename: "cupcake",
    name: "Echo Input (2018)",
    model: "C1125P",
    soc: "MT8516",
    exploit: "kamakiri",
    pkg: "kamakiri-cupcake-v1.0.0",
    routes: ["brom"],
    firmwareMarker: "kindle-cupcake",
    fireOs6Only: false,
    recoveryImage: "bin/twrp-cupcake.img",
  },
  donut: {
    codename: "donut",
    name: "Echo Dot (2018, 3rd gen)",
    model: "D9N29T",
    soc: "MT8516",
    exploit: "kamakiri",
    pkg: "kamakiri-donut-v1.0.0",
    routes: ["brom"],
    firmwareMarker: "donut_puffin",
    fireOs6Only: false,
    // Spec §11 open question 2: repo script reuses twrp-cupcake.img; verify.
    recoveryImage: "bin/twrp-cupcake.img",
  },
};

/** Explicitly unsupported look-alike (Echo Dot 3 Refresh, C78MP8). */
export const EXCLUDED_CRUMPET = { codename: "crumpet", model: "C78MP8" } as const;
