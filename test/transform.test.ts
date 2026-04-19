import { describe, expect, it, vi } from 'vitest';
import type { ReportedIssue } from '../src/issues.js';
import {
  applyExcerptTransforms,
  applyExcerptTransformsInOrder,
  applyOrderedExcerptTransformOps,
  applyFrom,
  applyRemove,
  applyRetain,
  applySkip,
  applyTake,
  applyTo,
  encodeSlashChar,
  parseReplacePipeline,
  patternToLinePredicate,
} from '../src/transform.js';

function errorMessages(onIssue: ReturnType<typeof vi.fn>): string[] {
  return (onIssue.mock.calls as [ReportedIssue][])
    .filter(([issue]) => issue.kind === 'error')
    .map(([issue]) => issue.message);
}

function warningMessages(onIssue: ReturnType<typeof vi.fn>): string[] {
  return (onIssue.mock.calls as [ReportedIssue][])
    .filter(([issue]) => issue.kind === 'warning')
    .map(([issue]) => issue.message);
}

describe('transform', () => {
  describe('patternToLinePredicate', () => {
    it('uses substring matching for plain strings', () => {
      const p = patternToLinePredicate('be');

      expect(p).not.toBeNull();
      expect(p!('between')).toBe(true);
      expect(p!('among')).toBe(false);
    });

    it('treats a leading \\/ as a literal slash', () => {
      const p = patternToLinePredicate(String.raw`\//`);

      expect(p).not.toBeNull();
      expect(p!('path // comment')).toBe(true);
      expect(p!('path / comment')).toBe(false);
    });

    it('treats an empty string as a literal match-all substring', () => {
      const p = patternToLinePredicate('');

      expect(p).not.toBeNull();
      expect(p!('anything')).toBe(true);
      expect(p!('')).toBe(true);
    });

    it('uses regexp matching for slash-wrapped patterns', () => {
      const p = patternToLinePredicate('/^\\s{2}lime/');

      expect(p).not.toBeNull();
      expect(p!('  lime')).toBe(true);
      expect(p!(' lime')).toBe(false);
    });

    it('supports non-capturing groups in regexp patterns', () => {
      const p = patternToLinePredicate('/^apple-(?:carrot|celery) juice$/');

      expect(p).not.toBeNull();
      expect(p!('apple-carrot juice')).toBe(true);
      expect(p!('apple-celery juice')).toBe(true);
      expect(p!('apple-lemon juice')).toBe(false);
    });

    it('warns that // is the empty regexp and still matches everything', () => {
      const onIssue = vi.fn();
      const p = patternToLinePredicate('//', onIssue);

      expect(p).not.toBeNull();
      expect(p!('anything')).toBe(true);
      expect(p!('')).toBe(true);
      expect(warningMessages(onIssue)).toEqual([
        String.raw`"//" is the empty regexp and matches everything; use "" or "\//"`,
      ]);
      expect(errorMessages(onIssue)).toEqual([]);
    });

    it('reports invalid regexp patterns and returns null', () => {
      const onIssue = vi.fn();
      const p = patternToLinePredicate('/(/', onIssue);

      expect(p).toBeNull();
      expect(errorMessages(onIssue)).not.toEqual([]);
      expect(warningMessages(onIssue)).toEqual([]);
    });
  });

  describe('applySkip', () => {
    it('non-negative', () => {
      expect(applySkip(['a', 'b', 'c'], 1)).toEqual(['b', 'c']);
      expect(applySkip(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
    });

    it('negative drops from end', () => {
      expect(applySkip(['a', 'b', 'c'], -1)).toEqual(['a', 'b']);
      expect(applySkip(['a', 'b', 'c'], -2)).toEqual(['a']);
    });
  });

  describe('applyTake', () => {
    it('non-negative', () => {
      expect(applyTake(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
      expect(applyTake(['a', 'b', 'c'], 0)).toEqual([]);
    });

    it('negative keeps trailing slice', () => {
      expect(applyTake(['a', 'b', 'c'], -1)).toEqual(['b', 'c']);
      expect(applyTake(['a', 'b', 'c'], -2)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('applyFrom', () => {
    it('starts at first match', () => {
      const pred = (s: string) => s.includes('x');
      expect(applyFrom(['a', 'bx', 'c'], pred)).toEqual(['bx', 'c']);
    });

    it('no match yields empty', () => {
      const pred = (s: string) => s.includes('z');
      expect(applyFrom(['a', 'b'], pred)).toEqual([]);
    });
  });

  describe('applyTo', () => {
    it('includes first matching line', () => {
      const pred = (s: string) => s.includes('stop');
      expect(applyTo(['a', 'b stop', 'c'], pred)).toEqual(['a', 'b stop']);
    });

    it('no match leaves lines unchanged', () => {
      const pred = (s: string) => s.includes('z');
      expect(applyTo(['a', 'b'], pred)).toEqual(['a', 'b']);
    });
  });

  describe('applyRemove / applyRetain', () => {
    it('remove', () => {
      const pred = (s: string) => /omit/.test(s);
      expect(applyRemove(['keep', 'omit this', 'x'], pred)).toEqual([
        'keep',
        'x',
      ]);
    });

    it('retain', () => {
      const pred = (s: string) => s.startsWith('!');
      expect(applyRetain(['a', '!b', 'c', '!d'], pred)).toEqual(['!b', '!d']);
    });
  });

  describe('encodeSlashChar', () => {
    it('decodes escapes', () => {
      expect(encodeSlashChar(String.raw`a\n\t\\b`)).toBe('a\n\t\\b');
    });

    it('hex', () => {
      expect(encodeSlashChar(String.raw`\x41`)).toBe('A');
    });
  });

  describe('parseReplacePipeline', () => {
    it('single segment', () => {
      const fn = parseReplacePipeline(`/foo/bar/g`);
      expect(fn).not.toBeNull();
      expect(fn!('foo')).toBe('bar');
    });

    it('multiple segments compose left-to-right', () => {
      const fn = parseReplacePipeline(`/a/x/g;/x/b/g`);
      expect(fn).not.toBeNull();
      expect(fn!('a')).toBe('b');
    });

    it('invalid reports via onError', () => {
      const onIssue = vi.fn();
      const fn = parseReplacePipeline(`foo`, onIssue);
      expect(fn).toBeNull();
      expect(errorMessages(onIssue)).not.toEqual([]);
    });
  });

  describe('applyExcerptTransformsInOrder', () => {
    it.skip('take then skip follows PI key order (differs from batch skip→take)', () => {
      const lines = ['a', 'b', 'c', 'd', 'e'];
      const map = new Map<string, string>([
        ['take', '2'],
        ['skip', '1'],
      ]);
      const out = applyExcerptTransformsInOrder(lines, ['take', 'skip'], map);
      expect(out).toEqual(['b']);
      expect(lines).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  describe('applyOrderedExcerptTransformOps', () => {
    it('preserves repeated operations in encounter order', () => {
      const lines = ['alpha', 'beta', 'gamma', 'delta'];
      const out = applyOrderedExcerptTransformOps(lines, [
        { name: 'take', value: '3' },
        { name: 'skip', value: '1' },
        { name: 'take', value: '1' },
      ]);
      expect(out).toEqual(['beta']);
      expect(lines).toEqual(['alpha', 'beta', 'gamma', 'delta']);
    });

    it('applies replace and retain in strict encounter order', () => {
      const lines = ["var greeting = 'hello';"];

      const replaceThenRetain = applyOrderedExcerptTransformOps(lines, [
        { name: 'replace', value: `/hello/bonjour/g` },
        { name: 'retain', value: 'bonjour' },
      ]);
      expect(replaceThenRetain).toEqual(["var greeting = 'bonjour';"]);

      const retainThenReplace = applyOrderedExcerptTransformOps(lines, [
        { name: 'retain', value: 'bonjour' },
        { name: 'replace', value: `/hello/bonjour/g` },
      ]);
      expect(retainThenReplace).toEqual([]);
    });

    it('repeats the same transform key without coalescing', () => {
      const out = applyOrderedExcerptTransformOps(
        ['abc'],
        [
          { name: 'replace', value: `/a/x/g` },
          { name: 'replace', value: `/x/y/g` },
        ],
      );
      expect(out).toEqual(['ybc']);
    });
  });

  describe('applyExcerptTransforms', () => {
    it.skip('applies fixed batch pipeline order: skip then take', () => {
      const lines = ['a', 'b', 'c', 'd', 'e'];
      const out = applyExcerptTransforms(lines, { skip: '1', take: '2' });
      expect(out).toEqual(['b', 'c']);
      expect(lines).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('from then to', () => {
      const out = applyExcerptTransforms(
        ['skip', 'one', 'two', 'end', 'tail'],
        { from: 'one', to: 'end' },
      );
      expect(out).toEqual(['one', 'two', 'end']);
    });

    it('remove then retain', () => {
      const out = applyExcerptTransforms(['ax', 'b', 'ay', 'bz'], {
        remove: 'b',
        retain: 'a',
      });
      expect(out).toEqual(['ax', 'ay']);
    });

    it.skip('replace then indent-by', () => {
      const out = applyExcerptTransforms(['x1', 'y1'], {
        replace: `/1/!/g`,
        indentBy: '2',
      });
      expect(out).toEqual(['  x!', '  y!']);
    });

    it('replace with capture groups', () => {
      const out = applyExcerptTransforms(['line:42'], {
        replace: String.raw`/line:(\d+)/L$1/g`,
      });
      expect(out).toEqual(['L42']);
    });

    // ECMA-262 `GetSubstitution`: `$0`, `$00`, ... are interpreted literally as
    // `$0`, `$00`, ... (no substitution), for details see {@link
    // https://tc39.es/ecma262/#sec-getsubstitution}.
    it('replace $0 matches JS behavior (literal $0, not full match)', () => {
      for (const dz of ['$0', '$00', '$000']) {
        // Sanity check expected JS behavior.
        expect('ab'.replace(/a/, dz)).toBe(`${dz}b`);

        const out = applyExcerptTransforms(['ab'], {
          replace: `/a/${dz}/g`,
        });
        expect(out).toEqual([`${dz}b`]);
      }
    });

    // ECMA-262 `GetSubstitution`: `$` + digits uses the longest *valid* capture
    // reference (≤99), not a greedy parse of all digits — e.g. with one group,
    // `$10` is `$1` + literal `0`, not group 10 (nor literal `$10`).
    it('replace $10 matches JS when only one capture group (not greedy digits)', () => {
      const js = 'ab'.replace(/(a)/, '$10');
      expect(js).toBe('a0b');

      const out = applyExcerptTransforms(['ab'], {
        replace: String.raw`/(a)/$10/g`,
      });
      expect(out).toEqual(['a0b']);
    });

    it('indent-by out of range', () => {
      const onIssue = vi.fn();
      const out = applyExcerptTransforms(['a'], { indentBy: '101' }, onIssue);
      expect(out).toEqual(['a']);
      expect(errorMessages(onIssue)).not.toEqual([]);
    });

    it('indent-by rejects non-integer strings (no parseInt prefix)', () => {
      const onIssue = vi.fn();
      const out = applyExcerptTransforms(['a'], { indentBy: '2abc' }, onIssue);
      expect(out).toEqual(['a']);
      expect(errorMessages(onIssue)).toEqual([
        expect.stringContaining('indent-by: error parsing integer value'),
      ]);
    });

    it('omit replace when invalid', () => {
      const onIssue = vi.fn();
      const out = applyExcerptTransforms(['ab'], { replace: 'bad' }, onIssue);
      expect(out).toEqual(['ab']);
      expect(errorMessages(onIssue)).not.toEqual([]);
    });

    it('invalid skip is ignored', () => {
      expect(applyExcerptTransforms(['a', 'b'], { skip: 'x' })).toEqual([
        'a',
        'b',
      ]);
    });
  });
});
