// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

import icon from "astro-icon";

import react from "@astrojs/react";

import node from "@astrojs/node";

export default defineConfig({
  devToolbar: {
    enabled: false,
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      esbuildOptions: {
        define: {
          "process.env.NODE_ENV": JSON.stringify("development"),
        },
      },
    },
  },

  output: "server",
  integrations: [icon(), react()],

  adapter: node({
    mode: "standalone",
  }),
});