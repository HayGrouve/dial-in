import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: tests run in Convex's runtime, not the browser build.
export default defineConfig({
  test: {
    include: ['convex/**/*.test.ts', 'src/**/*.test.ts'],
    // Convex function tests run on convex-test in Convex's runtime.
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
  },
})
