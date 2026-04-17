import { readExcerptYamlResultSync } from '../../src/helpers/excerptYaml.js';

/**
 * Test-only convenience wrapper, moved out of `src/helpers/excerptYaml.ts`
 * because production code no longer uses it.
 */
export function readExcerptYamlSync(
  readFile: (path: string, encoding: 'utf8') => string,
  yamlPath: string,
  region: string,
  borderKey = '#border',
): string | null {
  const result = readExcerptYamlResultSync(
    readFile,
    yamlPath,
    region,
    borderKey,
  );
  return result.status === 'found' ? result.excerpt : null;
}
