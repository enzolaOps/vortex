import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VORTEX_");

  // Baked in at build time: the instance this shell is a client for.
  // There is no sensible default — a wrong one would silently ship a client
  // pointed at somebody else's server.
  if (!env.VORTEX_APP_URL) {
    throw new Error(
      "VORTEX_APP_URL is required. Set it in desktop/.env (see .env.example).",
    );
  }

  return {
    define: {
      __VORTEX_APP_URL__: JSON.stringify(env.VORTEX_APP_URL),
    },
    build: {
      rollupOptions: {
        external: ["node-pipewire"],
      },
    },
  };
});
