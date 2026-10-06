import { de } from "./de";
import { en, type Dict } from "./en";
import { fr } from "./fr";
import { it } from "./it";
import { nl } from "./nl";
import { pl } from "./pl";

export const LANGS = {
  en: { name: "English", dict: en },
  de: { name: "Deutsch", dict: de },
  nl: { name: "Nederlands", dict: nl },
  fr: { name: "Français", dict: fr },
  it: { name: "Italiano", dict: it },
  pl: { name: "Polski", dict: pl },
} as const;
export type Lang = keyof typeof LANGS;
export type Key = keyof Dict;

const STORAGE_KEY = "echowebunlocker.lang";
const isLang = (s: string | null | undefined): s is Lang => !!s && s in LANGS;

/** Saved choice → first matching browser language (`de-AT` → `de`) → English. */
export function detectLang(
  saved: string | null = safeGet(),
  preferred: readonly string[] = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language],
): Lang {
  if (isLang(saved)) return saved;
  for (const p of preferred) {
    const base = p.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function safeGet(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

let current: Lang = detectLang();

export const getLang = () => current;

export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* storage unavailable */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
}

/** Translate; `{name}` placeholders are replaced from `params`. */
export function t(key: Key, params: Record<string, string | number> = {}): string {
  const s = LANGS[current].dict[key] ?? en[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}

if (typeof document !== "undefined") document.documentElement.lang = current;
