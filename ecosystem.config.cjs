module.exports = {
  apps: [
    {
      name: "mda-portal",
      script: "./dist/server/entry.mjs",
      env: {
        NODE_ENV: "production",
        PORT: 4321,
      },
    },
    {
      name: "mda-radar",
      script: "npx",
      args: "tsx scripts/ping-worker.ts",
    },
  ],
};
