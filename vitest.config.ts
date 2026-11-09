import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so tests skip the PWA plugin.
export default defineConfig({
  test: {
    include: ['convex/**/*.test.ts', 'src/**/*.test.ts'],
    // Convex function tests run on convex-test in Convex's runtime.
    environment: 'edge-runtime',
    server: { deps: { inline: ['convex-test'] } },
  },
})
