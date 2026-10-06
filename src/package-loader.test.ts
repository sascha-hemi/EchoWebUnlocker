import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { loadPackage, sha256Hex } from "./package-loader";

const enc = (s: string) => new TextEncoder().encode(s);

describe("loadPackage", () => {
  it("verifies hashes and strips the top-level folder", async () => {
    const data = enc("payload");
    const zip = zipSync({ "amonet-biscuit-v2.0.0/bin/fastbrick.img": data });
    const pkg = await loadPackage(zip, {
      version: "2.0.0",
      files: { "bin/fastbrick.img": { sha256: await sha256Hex(data) } },
    });
    expect(pkg.get("bin/fastbrick.img")).toEqual(data);
  });
  it("rejects a hash mismatch and missing files", async () => {
    const zip = zipSync({ "bin/a": enc("x") });
    await expect(loadPackage(zip, { version: "1", files: { "bin/a": { sha256: "00" } } })).rejects.toThrow("SHA-256");
    await expect(loadPackage(zip, { version: "1", files: { "bin/b": { sha256: "00" } } })).rejects.toThrow("missing");
  });
});
