import { describe, expect, it } from 'vitest';
import {
  parseExcerptYamlMap,
  readExcerptYamlResultSync,
  stripExcerptYamlBorder,
} from '../../src/helpers/excerptYaml.js';
import dedent from './dedent.js';
import { readExcerptYamlSync } from './excerptYaml.js';

// This suite primarily exercises the production helper in
// `src/helpers/excerptYaml.ts`.
// The sibling test-only wrapper in `test/helpers/excerptYaml.ts` is used here,
// but does not have its own separate test suite.
describe('excerptYaml helpers', () => {
  it('parses block and scalar entries', () => {
    const parsed = parseExcerptYamlMap(dedent`
      '#border': '|'
      '': |+
        first
        second
      'focus': |+
        |const k = 42;
        |
        |
    `);

    expect(parsed).not.toBeNull();
    expect(parsed?.get('#border')).toBe('|');
    expect(parsed?.get('')).toBe(dedent`
      first
      second
    `);
    expect(parsed?.get('focus')).toBe(dedent`
      |const k = 42;
      |
      |
    `);
  });

  it('strips #border line by line', () => {
    expect(
      stripExcerptYamlBorder(
        dedent`
          |a
          |
          b
        `,
        '|',
      ),
    ).toBe(
      dedent`
        a

        b
      `,
    );
  });

  it('rejects unsupported yaml shapes', () => {
    expect(parseExcerptYamlMap('plain: value')).toBeNull();
  });

  it('reads a region and strips optional #border', () => {
    const got = readExcerptYamlSync(
      () =>
        dedent`
          '#border': '|'
          'focus': |+
            |const k = 42;
            |
            |
        `,
      'snippet.dart.excerpt.yaml',
      'focus',
    );

    expect(got).toBe(dedent`
      const k = 42;
    `);
  });

  it('distinguishes a missing region from invalid yaml', () => {
    expect(
      readExcerptYamlResultSync(
        () =>
          dedent`
            'focus': |+
              const k = 42;
          `,
        'snippet.dart.excerpt.yaml',
        'missing',
      ),
    ).toEqual({ status: 'region-not-found' });

    expect(
      readExcerptYamlResultSync(
        () => 'plain: value',
        'snippet.dart.excerpt.yaml',
        'focus',
      ),
    ).toEqual({ status: 'file-invalid-format' });

    expect(
      readExcerptYamlResultSync(
        () =>
          dedent`
            '#border': '||'
            'focus': |+
              ||const k = 42;
          `,
        'snippet.dart.excerpt.yaml',
        'focus',
      ),
    ).toEqual({ status: 'file-invalid-format' });

    expect(
      readExcerptYamlResultSync(
        () =>
          dedent`
            'focus': |
              const k = 42;
          `,
        'snippet.dart.excerpt.yaml',
        'focus',
      ),
      // `|` is unsupported block scalar; should be `|+`
    ).toEqual({ status: 'file-invalid-format' });
  });
});
