export type Codename = "biscuit" | "radar" | "cupcake" | "donut";
export type Soc = "MT8163" | "MT8516";
export type Route = "fastbrick" | "brom";

export interface FastbrickImage {
  /** Prefix match against `getvar lk_build_desc`. */
  lkBuildDescPrefix: string;
  image: string;
}

export interface DeviceInfo {
  codename: Codename;
  name: string;
  model: string;
  soc: Soc;
  exploit: "amonet" | "kamakiri";
  pkg: string;
  routes: Route[];
  /** Expected `getvar product` value (fastbrick only). */
  fastbootProduct?: string;
  fastbrick?: { defaultImage: string; images: FastbrickImage[] };
  /** Substring that must appear in firmware filenames. */
  firmwareMarker: string;
  /** Only FireOS 6 (`NS6…`) is allowed. */
  fireOs6Only: boolean;
  recoveryImage: string;
}
