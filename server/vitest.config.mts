import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths({ root: './' })],
  test: {
    setupFiles: './src/tests/setup.ts',
    coverage: {
      reporter: ['text'],
      include: ['src'],
      exclude: [
        'src/tests',
        'src/scripts',
        'src/configs/type.ts',
        'src/**/__tests__',
        'src/adapters',
        'src/node.tsx',
      ],
    },
  },
})
