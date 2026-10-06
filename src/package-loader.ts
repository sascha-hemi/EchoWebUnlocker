import { unzipSync } from "fflate";

export interface Manifest {
  version: string;
  /** Expected files inside the release ZIP (paths relative to the ZIP root, any top-level folder is stripped). */
  files: Record<string, { sha256: string }>;
}

export interface LoadedPackage {
  get(path: string): Uint8Array;
  has(path: string): boolean;
  names(): string[];
}

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = data.slice().buffer as ArrayBuffer;
  return hex(await crypto.subtle.digest("SHA-256", copy));
}

/**
 * Unpacks a user-selected release ZIP in memory and verifies every file the
 * manifest lists (spec §6/§7). Throws on missing or mismatching files.
 */
export async function loadPackage(zip: Uint8Array, manifest: Manifest): Promise<LoadedPackage> {
  const raw = unzipSync(zip);
  const entries = Object.entries(raw).filter(([n]) => !n.endsWith("/"));
  const build = (strip: boolean) =>
    new Map(entries.map(([n, d]) => [strip ? n.slice(n.indexOf("/") + 1) : n, d]));
  // Release ZIPs usually wrap everything in one folder; use it only if the manifest paths need it.
  const wanted = Object.keys(manifest.files);
  const flat = build(false);
  const files = wanted.every((p) => flat.has(p)) ? flat : build(true);
  for (const [path, { sha256 }] of Object.entries(manifest.files)) {
    const data = files.get(path);
    if (!data) throw new Error(`Package incomplete: ${path} is missing`);
    const actual = await sha256Hex(data);
    if (actual !== sha256.toLowerCase()) {
      throw new Error(`SHA-256 mismatch for ${path} (expected ${sha256}, got ${actual})`);
    }
  }
  return {
    has: (p) => files.has(p),
    names: () => [...files.keys()],
    get(p) {
      const d = files.get(p);
      if (!d) throw new Error(`File not in package: ${p}`);
      return d;
    },
  };
}
