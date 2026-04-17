/** @file Unit tests for `dedent` helpers — @see `./helpers/dedent.ts`. */

import { describe, expect, it } from 'vitest';
import dedent, { dedent0, dedent2, dedentMax } from './helpers/dedent.js';

describe('dedentMax', () => {
  it('strips the first character when it is a newline', () => {
    expect(dedentMax`\na`).toBe('a');
    expect(dedentMax`
      a`).toBe('a');
  });

  it('removes common leading indentation from non-blank lines', () => {
    expect(
      dedentMax`
        alpha
        beta
      `,
    ).toBe('alpha\nbeta');
  });

  it('drops trailing whitespace-only lines', () => {
    expect(
      dedentMax`
        x
        
      `,
    ).toBe('x');
  });

  it('does not use blank lines for minimum-indent calculation', () => {
    expect(
      dedentMax`
        a

        b
      `,
    ).toBe('a\n\nb');
  });

  it('leaves lines unchanged when minimum indent is 0', () => {
    expect(dedentMax`no-indent`).toBe('no-indent');
    expect(
      dedentMax`
mixed
  indented`,
    ).toBe('mixed\n  indented');
  });

  it('interpolates values', () => {
    const n = 2;
    expect(dedentMax`line ${n}`).toBe('line 2');
    expect(
      dedentMax`
        ${'x'}
        y
      `,
    ).toBe('x\ny');
  });

  it('returns empty string for empty or whitespace-only template', () => {
    expect(dedentMax``).toBe('');
    expect(dedentMax`\n`).toBe('');
  });

  it('preserves leading spaces when they exceed common indent', () => {
    expect(
      dedentMax`
        outer
          inner
      `,
    ).toBe('outer\n  inner');
  });
});

describe('dedent0', () => {
  it('strips the first character when it is a newline', () => {
    expect(dedent0`\na`).toBe('a');
  });

  it('uses the closing line indentation as the trim amount', () => {
    expect(
      dedent0`
          alpha
          beta
      `,
    ).toBe('    alpha\n    beta');
  });

  it('preserves extra indentation beyond the closing line margin', () => {
    expect(
      dedent0`
          outer
            inner
      `,
    ).toBe('    outer\n      inner');
  });

  it('returns blank interior lines without whitespace', () => {
    expect(
      dedent0`
          a

          b
      `,
    ).toBe('    a\n\n    b');
  });

  it('does not trim indentation when there is no trailing margin line', () => {
    expect(dedent0`no-indent`).toBe('no-indent');
    expect(
      dedent0`
mixed
  indented`,
    ).toBe('mixed\n  indented');
  });

  it('interpolates values', () => {
    const n = 2;
    expect(dedent0`line ${n}`).toBe('line 2');
  });

  it('returns empty string for empty or whitespace-only template', () => {
    expect(dedent0``).toBe('');
    expect(dedent0`\n`).toBe('');
  });
});

describe('dedent', () => {
  it('is the default export for dedent2', () => {
    expect(dedent).toBe(dedent2);
  });

  it('strips two more spaces than dedent0 on non-blank lines', () => {
    expect(
      dedent`
          alpha
          beta
      `,
    ).toBe('  alpha\n  beta');
  });

  it('preserves extra indentation beyond the additional two-space trim', () => {
    expect(
      dedent`
          outer
            inner
      `,
    ).toBe('  outer\n    inner');
  });

  it('returns blank interior lines without whitespace', () => {
    expect(
      dedent`
          a

          b
      `,
    ).toBe('  a\n\n  b');
  });

  it('does not trim indentation when there is no trailing margin line', () => {
    expect(dedent`no-indent`).toBe('no-indent');
    expect(
      dedent`
mixed
  indented`,
    ).toBe('mixed\nindented');
  });

  it('interpolates values', () => {
    const n = 2;
    expect(dedent`line ${n}`).toBe('line 2');
  });

  it('returns empty string for empty or whitespace-only template', () => {
    expect(dedent``).toBe('');
    expect(dedent`\n`).toBe('');
  });
});
