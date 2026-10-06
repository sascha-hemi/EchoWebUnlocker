import { defineConfig } from "vite";

// Served from https://<user>.github.io/EchoWebUnlocker/ on GitHub Pages.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/EchoWebUnlocker/" : "/",
}));
