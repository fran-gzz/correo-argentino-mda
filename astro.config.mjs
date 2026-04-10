// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import icon from "astro-icon";

import mdx from "@astrojs/mdx";

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  output: "server",
  integrations: [icon(), mdx()],
});