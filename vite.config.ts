import { defineConfig } from "vite";

export default defineConfig({
  root: "client",
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [".."]
    }
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true
  }
});
