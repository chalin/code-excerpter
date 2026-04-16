/**
 * Ensures `build` produced entry JS plus declarations in `dist/`.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const required = [
  'index.js',
  'cli.js',
  'index.d.ts',
  'cli.d.ts',
  'index.d.ts.map',
  'cli.d.ts.map',
];

const missing = required.filter((name) => !existsSync(join(dist, name)));

if (missing.length > 0) {
  console.error('verify-dist: missing under dist/:');
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}
