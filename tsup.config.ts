import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  // Use `tsc --emitDeclarationOnly` in `build`; tsup DTS injects `baseUrl` (TS5101 on TS 6+).
  dts: false,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
