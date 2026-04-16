/** @file Unit tests for `dedent` — @see `./helpers/dedent.ts`. */

import { describe, expect, it } from 'vitest';
import { dedent } from './helpers/dedent.js';

describe('dedent', () => {
  it('strips the first character when it is a newline', () => {
    expect(dedent`\na`).toBe('a');
    expect(dedent`
      a`).toBe('a');
  });

  it('removes common leading indentation from non-blank lines', () => {
    expect(
      dedent`
        alpha
        beta
      `,
    ).toBe('alpha\nbeta');
  });

  it('drops trailing whitespace-only lines', () => {
    expect(
      dedent`
        x
        
      `,
    ).toBe('x');
  });

  it('does not use blank lines for minimum-indent calculation', () => {
    expect(
      dedent`
        a

        b
      `,
    ).toBe('a\n\nb');
  });

  it('leaves lines unchanged when minimum indent is 0', () => {
    expect(dedent`no-indent`).toBe('no-indent');
    expect(
      dedent`
mixed
  indented`,
    ).toBe('mixed\n  indented');
  });

  it('interpolates values', () => {
    const n = 2;
    expect(dedent`line ${n}`).toBe('line 2');
    expect(
      dedent`
        ${'x'}
        y
      `,
    ).toBe('x\ny');
  });

  it('returns empty string for empty or whitespace-only template', () => {
    expect(dedent``).toBe('');
    expect(dedent`\n`).toBe('');
  });

  it('preserves leading spaces when they exceed common indent', () => {
    expect(
      dedent`
        outer
          inner
      `,
    ).toBe('outer\n  inner');
  });
});
