import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@ref": path.resolve(__dirname, "reference") } },
  test: { include: ["tests/**/*.test.ts"] },
});
