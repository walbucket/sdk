import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  platform: 'node', // Node.js platform for built-in modules
  external: ['@mysten/seal', 'crypto', 'fs', 'fs/promises'],
  esbuildOptions(options) {
    options.platform = 'node';
    options.mainFields = ['module', 'main'];
  },
});
