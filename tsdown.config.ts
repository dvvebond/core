import { defineConfig } from "tsdown";

export default defineConfig([
  // Main entry point - ESM and CJS formats
  {
    entry: {
      index: "./src/index.ts",
    },
    format: ["esm", "cjs"],
    outDir: "./dist",
    clean: true,
    dts: true,
    sourcemap: true,
    // Keep dependencies external - consumers install their own
    skipNodeModulesBundle: true,
  },
  // React entry point - ESM and CJS formats
  {
    entry: {
      react: "./src/react/index.ts",
    },
    format: ["esm", "cjs"],
    outDir: "./dist",
    clean: false, // Don't clean on second build
    dts: true,
    sourcemap: true,
    skipNodeModulesBundle: true,
    // External React dependencies - peer dependencies
    external: ["react", "react-dom"],
  },
]);
