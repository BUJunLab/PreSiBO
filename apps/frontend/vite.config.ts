import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        // Use the same IPv4 loopback endpoint as the local RDS backend.
        // On Windows, `localhost` can resolve to a stale IPv6 dev process.
        target: "http://127.0.0.1:3001",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testing/setup.ts"],
    testTimeout: 10_000
  }
});
