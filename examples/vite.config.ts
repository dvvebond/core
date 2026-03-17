import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@dvvebond/core/react": resolve(__dirname, "../src/react/index.ts"),
      "@dvvebond/core": resolve(__dirname, "../src/index.ts"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "pdfjs-dist"],
  },
});
