import { describe, expect, it } from 'vitest';
import { tryParseDirective } from '../src/directive.js';
import {
  DEFAULT_PLASTER,
  dropTrailingBlankLines,
  extractExcerpts,
  getExcerptRegionLines,
  maxUnindent,
} from '../src/extract.js';
import type { ReportedIssue } from '../src/issues.js';
import dedent from './helpers/dedent.js';

const uri = 'foo';

/**
 * Returns the non-directive lines of `content` (split on `\n`), with trailing
 * blank lines removed — mirroring what `extractExcerpts` puts into the default
 * region when there is no explicit `#docregion` for it.
 */
function stripDirectives(content: string): string[] {
  const lines = content
    .split('\n')
    .filter((line) => tryParseDirective(line) === null);
  while (lines.length > 0 && /^\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }
  return lines;
}

function warningMessages(warnings: string[]): (issue: ReportedIssue) => void {
  return (issue) => {
    if (issue.kind === 'warning') warnings.push(issue.message);
  };
}

describe('extract', () => {
  // -------------------------------------------------------------------------
  describe('utilities', () => {
    describe('dropTrailingBlankLines', () => {
      it('empty array', () => {
        expect(dropTrailingBlankLines([])).toEqual([]);
      });

      it('no trailing blanks', () => {
        expect(dropTrailingBlankLines(['abc', 'def'])).toEqual(['abc', 'def']);
      });

      it('trailing blank lines removed', () => {
        expect(dropTrailingBlankLines(['abc', '', '  '])).toEqual(['abc']);
      });

      it('returns new array (does not mutate)', () => {
        const original = ['abc', ''];
        const result = dropTrailingBlankLines(original);
        expect(result).toEqual(['abc']);
        expect(original).toEqual(['abc', '']);
      });
    });

    describe('maxUnindent', () => {
      it('empty array', () => {
        expect(maxUnindent([])).toEqual([]);
      });

      it('all blank lines — no shift', () => {
        expect(maxUnindent(['', '   '])).toEqual(['', '   ']);
      });

      it('no indentation — no shift', () => {
        expect(maxUnindent(['abc', 'def'])).toEqual(['abc', 'def']);
      });

      it('uniform indentation removed', () => {
        expect(maxUnindent(['  abc', '  def'])).toEqual(['abc', 'def']);
      });

      it('partial indentation removed (min of non-blank lines)', () => {
        expect(maxUnindent(['    abc', '  def'])).toEqual(['  abc', 'def']);
      });

      it('blank lines preserved (not shifted)', () => {
        expect(maxUnindent(['  abc', '', '  def'])).toEqual(['abc', '', 'def']);
      });

      it('line shorter than indent is left as-is', () => {
        // A blank line (empty string) is shorter than minLen of 2 — left unchanged.
        expect(maxUnindent(['  abc', '  def', ''])).toEqual(['abc', 'def', '']);
      });
    });

    describe('stripDirectives helper sanity', () => {
      it('filters directive lines and trims trailing blanks', () => {
        const content = dedent`
          #docregion a
            abc
          #enddocregion a
          #docregion b
            def
          #enddocregion b
        `;
        expect(stripDirectives(content)).toEqual(['  abc', '  def']);
      });
    });

    describe('getExcerptRegionLines', () => {
      it('uses extract map when directives exist', () => {
        const s = dedent`
          // #docregion
          x
          // #enddocregion
        `;
        expect(getExcerptRegionLines(uri, s, '')).toEqual(['x']);
      });

      it('falls back to full file when there are no directives', () => {
        expect(getExcerptRegionLines(uri, 'plain\n', '')).toEqual(['plain']);
      });

      it('returns null for unknown named region', () => {
        expect(
          getExcerptRegionLines(
            uri,
            '// #docregion a\n// #enddocregion a\n',
            'b',
          ),
        ).toBeNull();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('no excerpts', () => {
    const cases = [
      '',
      'abc',
      'abc\ndef\n',
      'docregion' /* without leading # */,
    ];

    for (const content of cases) {
      it(`returns empty map for ${JSON.stringify(content)}`, () => {
        expect(extractExcerpts(uri, content).size).toBe(0);
      });
    }
  });

  // -------------------------------------------------------------------------
  describe('basic delimited default region', () => {
    it('1-line region', () => {
      const result = extractExcerpts(uri, '#docregion\nabc\n#enddocregion');
      expect(result).toEqual(new Map([['', ['abc']]]));
    });
  });

  // -------------------------------------------------------------------------
  describe('normalized indentation', () => {
    it('default region — indentation stripped', () => {
      const result = extractExcerpts(
        uri,
        dedent`
          #docregion
            abc
          #enddocregion
        `,
      );
      expect(result).toEqual(new Map([['', ['abc']]]));
    });

    it('named region a — region content stripped; default region (from full file) untouched', () => {
      const content = dedent`
        #docregion a
          abc
        #enddocregion a
      `;
      const result = extractExcerpts(uri, content);
      expect(result).toEqual(
        new Map([
          ['', ['  abc']], // fullFileKey → default, NOT maxUnindented
          ['a', ['abc']], // named region IS maxUnindented
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('two disjoint regions', () => {
    it('produces correct default and named regions', () => {
      const content = dedent`
        #docregion a
          abc
        #enddocregion a
        #docregion b
          def
        #enddocregion b
      `;
      const result = extractExcerpts(uri, content);
      expect(result).toEqual(
        new Map([
          ['', stripDirectives(content)],
          ['a', ['abc']],
          ['b', ['def']],
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('region not closed', () => {
    it('empty default region (not closed)', () => {
      expect(extractExcerpts(uri, '#docregion')).toEqual(new Map([['', []]]));
    });

    it('default region with trailing newline (not closed)', () => {
      expect(extractExcerpts(uri, '#docregion\n')).toEqual(new Map([['', []]]));
    });

    it('default region with content line (not closed)', () => {
      expect(extractExcerpts(uri, '#docregion\nabc')).toEqual(
        new Map([['', ['abc']]]),
      );
    });

    it('named region with no content (not closed)', () => {
      expect(extractExcerpts(uri, '#docregion a')).toEqual(
        new Map([
          ['', []], // fullFileKey → default (no non-directive lines)
          ['a', []],
        ]),
      );
    });

    it('named region with content (not closed)', () => {
      expect(extractExcerpts(uri, '#docregion a\nabc')).toEqual(
        new Map([
          ['', ['abc']], // fullFileKey → default
          ['a', ['abc']],
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('problems', () => {
    describe('empty region', () => {
      it('warns for empty default region', () => {
        const warnings: string[] = [];
        const result = extractExcerpts(
          uri,
          '#docregion\n#enddocregion',
          warningMessages(warnings),
        );
        expect(warnings).toEqual(['empty region at foo:2']);
        expect(result).toEqual(new Map([['', []]]));
      });

      it('warns for empty named region', () => {
        const warnings: string[] = [];
        const result = extractExcerpts(
          uri,
          '#docregion a\n#enddocregion a',
          warningMessages(warnings),
        );
        expect(warnings).toEqual(['empty region a at foo:2']);
        expect(result).toEqual(
          new Map([
            ['', []],
            ['a', []],
          ]),
        );
      });
    });

    describe('end before start', () => {
      it('default region', () => {
        const warnings: string[] = [];
        extractExcerpts(uri, '#enddocregion', warningMessages(warnings));
        expect(warnings).toEqual([
          'region "" end without a prior start at foo:1',
        ]);
      });

      it('named region a', () => {
        const warnings: string[] = [];
        extractExcerpts(uri, '#enddocregion a', warningMessages(warnings));
        expect(warnings).toEqual([
          'region "a" end without a prior start at foo:1',
        ]);
      });

      it('named regions a,b', () => {
        const warnings: string[] = [];
        extractExcerpts(uri, '#enddocregion a,b', warningMessages(warnings));
        expect(warnings).toEqual([
          'regions ("a", "b") end without a prior start at foo:1',
        ]);
      });

      it('start a, end default', () => {
        const warnings: string[] = [];
        extractExcerpts(
          uri,
          '#docregion a\n#enddocregion',
          warningMessages(warnings),
        );
        expect(warnings).toEqual([
          'region "" end without a prior start at foo:2',
        ]);
      });
    });

    describe('repeated start', () => {
      it('default region repeated', () => {
        const warnings: string[] = [];
        extractExcerpts(
          uri,
          '#docregion\n#docregion',
          warningMessages(warnings),
        );
        expect(warnings).toEqual(['repeated start for region "" at foo:2']);
      });

      it('named region a repeated', () => {
        const warnings: string[] = [];
        extractExcerpts(
          uri,
          '#docregion a\n#docregion a',
          warningMessages(warnings),
        );
        expect(warnings).toEqual(['repeated start for region "a" at foo:2']);
      });
    });

    describe('directive issues forwarded', () => {
      it('unquoted default region name is deprecated', () => {
        const warnings: string[] = [];
        extractExcerpts(uri, '#docregion ,a', warningMessages(warnings));
        expect(warnings).toEqual([
          'unquoted default region name is deprecated at foo:1',
        ]);
      });

      it('duplicate region argument', () => {
        const warnings: string[] = [];
        extractExcerpts(uri, '#docregion a,a', warningMessages(warnings));
        expect(warnings).toEqual(['repeated argument "a" at foo:1']);
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('plaster', () => {
    it('region a with 1 plaster between two sub-spans', () => {
      // Close and reopen region 'a' — the '···' plaster stays in the middle.
      const content = dedent`
        #docregion a
        abc
        #enddocregion a
        gap
        #docregion a
        def
        #enddocregion a
      `;
      const result = extractExcerpts(uri, content);
      expect(result.get('a')).toEqual(['abc', DEFAULT_PLASTER, 'def']);
    });

    it('overlapping regions — each region ends independently', () => {
      // Region a ends before region b; b continues collecting lines.
      const content = dedent`
        #docregion a,b
          abc
        #enddocregion a
          def
        #enddocregion b
      `;
      const result = extractExcerpts(uri, content);
      expect(result).toEqual(
        new Map([
          ['', ['  abc', '  def']], // fullFileKey → default, NOT maxUnindented
          ['a', ['abc']], // only '  abc', maxUnindented
          ['b', ['abc', 'def']], // both lines, maxUnindented
        ]),
      );
    });

    it('plaster indentation taken from the reopening #docregion directive', () => {
      // Content lines have 0 indent; the reopened #docregion has 2-space indent.
      // The plaster line should inherit that indentation.
      const content = dedent`
        #docregion a
        abc
        #enddocregion a
        def
          #docregion a
        ghi
        #enddocregion a
      `;
      const result = extractExcerpts(uri, content);
      expect(result.get('a')).toEqual(['abc', `  ${DEFAULT_PLASTER}`, 'ghi']);
    });
  });
});
