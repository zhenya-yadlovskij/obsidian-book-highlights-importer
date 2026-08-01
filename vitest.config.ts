import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: { enabled: false },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
