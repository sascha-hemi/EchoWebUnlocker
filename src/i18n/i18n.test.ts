import { describe, expect, it } from "vitest";
import { LANGS, detectLang } from "./index";
import { en } from "./en";

describe("i18n", () => {
  it("detects from browser languages and falls back to English", () => {
    expect(detectLang(null, ["de-AT", "en"])).toBe("de");
    expect(detectLang(null, ["xx", "pl-PL"])).toBe("pl");
    expect(detectLang(null, ["ja"])).toBe("en");
    expect(detectLang(null, [])).toBe("en");
  });
  it("prefers a saved choice", () => {
    expect(detectLang("it", ["de"])).toBe("it");
    expect(detectLang("bogus", ["fr"])).toBe("fr");
  });
  it("has the same placeholders in every language", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [code, { dict }] of Object.entries(LANGS))
      for (const k of Object.keys(en) as (keyof typeof en)[])
        expect(ph(dict[k]), `${code}:${k}`).toBe(ph(en[k]));
  });
});
