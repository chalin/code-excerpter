/** @file Tests for the `injectMarkdown` function.
 * @see `src/inject.ts`
 *
 * cSpell:ignore mundo
 */

import { describe, expect, it, vi } from 'vitest';
import {
  injectMarkdown,
  PROC_INSTR_RE,
  type MarkdownInjectContext,
} from '../src/inject.js';
import { dedent } from './helpers/dedent.js';

function ctx(files: Record<string, string>, base = ''): MarkdownInjectContext {
  return {
    readFile: (p) => files[p] ?? null,
    pathBase: base,
  };
}

/** Expected plaster separator line inside ` ```lang ` fences for `it.each` plaster tests. */
const PLASTER_LINE_BY_FENCE_LANG: Record<string, string> = {
  python: '# ···',
  py: '# ···',
  ruby: '# ···',
  rb: '# ···',
  erlang: '% ···',
  go: '// ···',
  rust: '// ···',
  rs: '// ···',
  cpp: '// ···',
  csharp: '// ···',
  cs: '// ···',
  javascript: '// ···',
  typescript: '// ···',
  kotlin: '// ···',
  kt: '// ···',
  java: '// ···',
  php: '// ···',
  swift: '// ···',
};

describe('inject', () => {
  describe('PROC_INSTR_RE', () => {
    it('matches quoted path and named args', () => {
      const m = '<?code-excerpt "lib/a.dart (r)" skip="1"?>'.match(
        PROC_INSTR_RE,
      );
      expect(m?.groups?.unnamed).toBe('lib/a.dart (r)');
      expect(m?.groups?.named?.trim()).toBe('skip="1"');
    });

    it('matches set instruction', () => {
      const x = '<?code-excerpt path-base="ex"?>'.match(PROC_INSTR_RE);
      expect(x?.groups?.unnamed).toBeUndefined();
      expect(x?.groups?.named?.trim()).toBe('path-base="ex"');
    });

    it('does not match when non-whitespace follows the closing ?>', () => {
      expect(
        '<?code-excerpt "a.dart"?> trailing'.match(PROC_INSTR_RE),
      ).toBeNull();
    });

    it('allows trailing whitespace after ?>', () => {
      const m = '<?code-excerpt "a.dart"?>   \t'.match(PROC_INSTR_RE);
      expect(m?.groups?.unnamed).toBe('a.dart');
    });
  });

  describe('injectMarkdown', () => {
    it('injects default region from dart source', () => {
      const src = dedent`
        // #docregion
        final x = 1;
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "lib/a.dart"?>

        \`\`\`dart
        old
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'lib/a.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "lib/a.dart"?>

        \`\`\`dart
        final x = 1;
        \`\`\`

      `);
    });

    it('injects through tilde markdown fences', () => {
      const src = dedent`
        // #docregion
        tilde-body
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "tilde.dart"?>

        ~~~dart
        old
        ~~~

      `;
      const out = injectMarkdown(md, ctx({ 'tilde.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "tilde.dart"?>

        ~~~dart
        tilde-body
        ~~~
      `);
    });

    it('injects excerpt containing nested markdown code fences when outer fence is tilde', () => {
      // Outer `~~~` is required so inner ``` lines are not mistaken for the
      // closing fence (fence-end matching is by kind: backtick vs tilde).
      const src = dedent`
        # Section

        \`\`\`dart
        const injected = 42;
        \`\`\`

        Trailing prose.
      `;
      const md = dedent`
        <?code-excerpt "nested-fences.md"?>

        ~~~markdown
        old-placeholder
        ~~~

      `;
      const expected = dedent`
        <?code-excerpt "nested-fences.md"?>

        ~~~markdown
        # Section

        \`\`\`dart
        const injected = 42;
        \`\`\`

        Trailing prose.
        ~~~
      `;
      const out = injectMarkdown(md, ctx({ 'nested-fences.md': src }));
      expect(out).toStrictEqual(expected);
    });

    it('applies path-base before resolving path', () => {
      const src = '// ok\n';
      const md = dedent`
        <?code-excerpt path-base="p"?>
        <?code-excerpt "b.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'p/b.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt path-base="p"?>
        <?code-excerpt "b.dart"?>

        \`\`\`
        // ok
        \`\`\`

      `);
    });

    it('increments instructionStats for parsed set and fragment directives', () => {
      const instructionStats = { set: 0, fragment: 0 };
      const src = '// ok\n';
      const md = dedent`
        <?code-excerpt path-base="p"?>
        <?code-excerpt "b.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      injectMarkdown(md, {
        ...ctx({ 'p/b.dart': src }),
        instructionStats,
      });
      expect(instructionStats.set).toBe(1);
      expect(instructionStats.fragment).toBe(1);
    });

    it('applies skip transform', () => {
      const src = dedent`
        // #docregion
        a
        b
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "f.dart" skip="1"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'f.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "f.dart" skip="1"?>

        \`\`\`
        b
        \`\`\`

      `);
    });

    it('strips list marker prefix in linePrefix', () => {
      const src = dedent`
        // #docregion
        z
        // #enddocregion
      `;
      const md = dedent`
        - <?code-excerpt "x.dart"?>

          \`\`\`
          .
          \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'x.dart': src }));
      expect(out).toStrictEqual(dedent`
        - <?code-excerpt "x.dart"?>

          \`\`\`
          z
          \`\`\`

      `);
    });

    it('returns original block when source is missing', () => {
      const onError = vi.fn();
      const md = dedent`
        <?code-excerpt "missing.dart"?>

        \`\`\`
        keep
        \`\`\`

      `;
      const out = injectMarkdown(md, { readFile: () => null, onError });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalled();
    });

    it('leaves block unchanged for diff-with with error', () => {
      const onError = vi.fn();
      const md = dedent`
        <?code-excerpt "a.dart" diff-with="b.dart"?>

        \`\`\`
        old
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: () => '//\n',
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalled();
    });

    it('reads implicit default region when file has no directives', () => {
      const src = 'plain line\n';
      const md = dedent`
        <?code-excerpt "plain.txt"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'plain.txt': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "plain.txt"?>

        \`\`\`
        plain line
        \`\`\`

      `);
    });

    it('applies file-level set replace after excerpt transforms', () => {
      const src = dedent`
        // #docregion
        SRC_TOKEN
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="/SRC_TOKEN/NEW/g"?>
        <?code-excerpt "r.dart"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'r.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="/SRC_TOKEN/NEW/g"?>
        <?code-excerpt "r.dart"?>

        \`\`\`
        NEW
        \`\`\`

      `);
    });

    it('applies globalReplace from context after file-level replace', () => {
      const src = dedent`
        // #docregion
        aa
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="/aa/bb/g"?>
        <?code-excerpt "g.dart"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'g.dart' ? src : null),
        globalReplace: `/bb/cc/g`,
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="/aa/bb/g"?>
        <?code-excerpt "g.dart"?>

        \`\`\`
        cc
        \`\`\`

      `);
    });

    it('throws on invalid globalReplace', () => {
      expect(() =>
        injectMarkdown('x', {
          readFile: () => null,
          globalReplace: 'not-valid',
        }),
      ).toThrow(/invalid global replace/);
    });

    it('reports invalid processing instruction when regex does not match', () => {
      const onError = vi.fn();
      const bad = '<?code-excerpt "broken.dart skip="1"?>';
      const md = dedent`
        ${bad}

        \`\`\`
        x
        \`\`\`

      `;
      injectMarkdown(md, {
        readFile: () => '//\n',
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('invalid processing instruction'),
      );
    });

    it('treats valueless named args as invalid processing-instruction syntax', () => {
      const onError = vi.fn();
      const md = dedent`
        <?code-excerpt "basic.dart (greeting)" title?>

        \`\`\`dart
        keep
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: () => '//\n',
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('invalid processing instruction'),
      );
    });

    it('warns when text follows ?> on the same line and does not inject', () => {
      const onWarning = vi.fn();
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        NEVER
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "t.dart"?> trailing junk

        \`\`\`
        KEEP
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 't.dart' ? src : null),
        onWarning,
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringContaining('extraneous text after closing "?>"'),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('warns when PI is not closed with ?>', () => {
      const onWarning = vi.fn();
      const src = dedent`
        // #docregion
        ok
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "c.dart">

        \`\`\`
        x
        \`\`\`

      `;
      injectMarkdown(md, {
        readFile: (p) => (p === 'c.dart' ? src : null),
        onWarning,
      });
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringMatching(/processing instruction must be closed using/),
      );
    });

    it('errors on unterminated markdown fence and keeps original block', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        NOT_INJECTED
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "u.dart"?>

        \`\`\`
        keep-inner
      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'u.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('unterminated markdown code block'),
      );
    });

    it('errors when code block does not immediately follow excerpt PI', () => {
      const onError = vi.fn();
      const src = '//\n';
      const md = dedent`
        <?code-excerpt "q.dart"?>

        int x = 0;
        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'q.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/code block should immediately follow/s),
      );
    });

    it('errors on set instruction with more than one argument', () => {
      const onError = vi.fn();
      const md = dedent`
        <?code-excerpt path-base="a" replace="/x/y/g"?>
        <?code-excerpt "b.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      injectMarkdown(md, {
        readFile: () => '//\n',
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        'set instruction should have at most one argument',
      );
    });

    it('warns and ignores unrecognized set instruction argument', () => {
      const onWarning = vi.fn();
      const md = dedent`
        <?code-excerpt foo="abc"?>
        <?code-excerpt "z.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      injectMarkdown(md, {
        readFile: () => '//\n',
        onWarning,
      });
      expect(onWarning).toHaveBeenCalledWith(
        expect.stringMatching(/unrecognized set instruction argument:\s*foo/),
      );
    });

    it('clears file-level replace when set replace is empty', () => {
      const src = dedent`
        // #docregion
        SRC_TOKEN
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="/SRC_TOKEN/NEW/g"?>
        <?code-excerpt replace=""?>
        <?code-excerpt "clr.dart"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'clr.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="/SRC_TOKEN/NEW/g"?>
        <?code-excerpt replace=""?>
        <?code-excerpt "clr.dart"?>

        \`\`\`
        SRC_TOKEN
        \`\`\`

      `);
    });

    it('does not apply invalid file-level set replace (reports error)', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        SRC_TOKEN
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="not-a-regex-pipeline"?>
        <?code-excerpt "inv.dart"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'inv.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="not-a-regex-pipeline"?>
        <?code-excerpt "inv.dart"?>

        \`\`\`
        SRC_TOKEN
        \`\`\`

      `);
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/invalid replace attribute/),
      );
    });

    it('applies globalReplace without file-level set replace', () => {
      const src = dedent`
        // #docregion
        hello
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "only-gr.dart"?>

        \`\`\`
        x
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'only-gr.dart' ? src : null),
        globalReplace: `/hello/mundo/g`,
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "only-gr.dart"?>

        \`\`\`
        mundo
        \`\`\`

      `);
    });

    it('treats set class-only and title-only as no-ops (no warning)', () => {
      const onWarning = vi.fn();
      const src = dedent`
        // #docregion
        ok
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt class="prettyprint"?>
        <?code-excerpt title="Sample"?>
        <?code-excerpt "noop.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'noop.dart' ? src : null),
        onWarning,
      });
      expect(onWarning).not.toHaveBeenCalled();
      expect(out).toStrictEqual(dedent`
        <?code-excerpt class="prettyprint"?>
        <?code-excerpt title="Sample"?>
        <?code-excerpt "noop.dart"?>

        \`\`\`
        ok
        \`\`\`

      `);
    });

    it('uses region= named argument when path has no (region) suffix', () => {
      const src = dedent`
        // #docregion r1
        in-r1
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "reg.dart" region="r1"?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'reg.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "reg.dart" region="r1"?>

        \`\`\`
        in-r1
        \`\`\`

      `);
    });

    it('preserves repeated transform operations in fragment PI order', () => {
      const src = dedent`
        // #docregion
        var greeting = 'hello';
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "arg.dart" replace="/hello/bonjour/g" retain="bonjour"?>

        \`\`\`
        .
        \`\`\`

        <?code-excerpt "arg.dart" retain="bonjour" replace="/hello/bonjour/g"?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'arg.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "arg.dart" replace="/hello/bonjour/g" retain="bonjour"?>

        \`\`\`
        var greeting = 'bonjour';
        \`\`\`

        <?code-excerpt "arg.dart" retain="bonjour" replace="/hello/bonjour/g"?>

        \`\`\`
        \`\`\`

      `);
    });

    it('region="" overrides path-embedded (region) and returns full file', () => {
      const src = dedent`
        // #docregion greeting
        var greeting = 'hello';
        // #enddocregion greeting

        void main() {}
      `;
      const md = dedent`
        <?code-excerpt "a.dart (greeting)" region=""?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'a.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "a.dart (greeting)" region=""?>

        \`\`\`
        var greeting = 'hello';

        void main() {}
        \`\`\`

      `);
    });

    it('leaves block unchanged on repeated region setting', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion r1
        in-r1
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "reg.dart" region="r1" region=""?>

        \`\`\`
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'reg.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('region: repeated setting argument'),
      );
    });

    it('leaves block unchanged on repeated indent-by setting', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        ok
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "dup-indent.dart" indent-by="2" indent-by="4"?>

        \`\`\`
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'dup-indent.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('indent-by: repeated setting argument'),
      );
    });

    it('leaves block unchanged on invalid indent-by setting', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        ok
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "bad-indent.dart" indent-by="2abc"?>

        \`\`\`
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'bad-indent.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('indent-by: error parsing integer value'),
      );
    });

    it('substitutes plaster markers using the default plaster template', () => {
      const src = dedent`
        // #docregion
        before
        // #enddocregion
        // #docregion
        after
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "pl.dart"?>

        \`\`\`dart
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'pl.dart' ? src : null),
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "pl.dart"?>

        \`\`\`dart
        before
        // ···
        after
        \`\`\`

      `);
    });

    it('uses an empty fragment plaster template', () => {
      const src = dedent`
        // #docregion
        before
        // #enddocregion
        // #docregion
        after
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "empty-plaster.dart" plaster=""?>

        \`\`\`dart
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'empty-plaster.dart' ? src : null),
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "empty-plaster.dart" plaster=""?>

        \`\`\`dart
        before

        after
        \`\`\`

      `);
    });

    it('errors on plaster="unset" on a set instruction', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        a
        // #enddocregion
        // #docregion
        b
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt plaster="none"?>
        <?code-excerpt plaster="unset"?>
        <?code-excerpt "unset-plaster.dart"?>

        \`\`\`dart
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'unset-plaster.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt plaster="none"?>
        <?code-excerpt plaster="unset"?>
        <?code-excerpt "unset-plaster.dart"?>

        \`\`\`dart
        a
        b
        \`\`\`

      `);
      expect(onError).toHaveBeenCalledWith(
        'plaster: invalid setting value on set instruction',
      );
    });

    it('leaves block unchanged on repeated plaster setting', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        a
        // #enddocregion
        // #docregion
        b
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "dup-plaster.dart" plaster="none" plaster="/*...*/"?>

        \`\`\`dart
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'dup-plaster.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('plaster: repeated setting argument'),
      );
    });

    it('leaves block unchanged on fragment plaster="unset"', () => {
      const onError = vi.fn();
      const src = dedent`
        // #docregion
        a
        // #enddocregion
        // #docregion
        b
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "frag-unset.dart" plaster="unset"?>

        \`\`\`dart
        ORIGINAL
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'frag-unset.dart' ? src : null),
        onError,
      });
      expect(out).toStrictEqual(md);
      expect(onError).toHaveBeenCalledWith(
        'plaster: invalid setting value on fragment instruction',
      );
    });

    it('treats explicit fragment plaster as a full template', () => {
      const src = dedent`
        // #docregion
        before
        // #enddocregion
        // #docregion
        after
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "tpl.dart" plaster="/*...*/"?>

        \`\`\`dart
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'tpl.dart' ? src : null),
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "tpl.dart" plaster="/*...*/"?>

        \`\`\`dart
        before
        /*...*/
        after
        \`\`\`

      `);
    });

    it('expands $defaultPlaster inside an explicit plaster template', () => {
      const src = dedent`
        // #docregion
        before
        // #enddocregion
        // #docregion
        after
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "tpl-default.dart" plaster="/* $defaultPlaster */"?>

        \`\`\`dart
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'tpl-default.dart' ? src : null),
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "tpl-default.dart" plaster="/* $defaultPlaster */"?>

        \`\`\`dart
        before
        /* ··· */
        after
        \`\`\`

      `);
    });

    it.each([
      'python',
      'py',
      'ruby',
      'rb',
      'erlang',
      'go',
      'rust',
      'rs',
      'cpp',
      'csharp',
      'cs',
      'javascript',
      'typescript',
      'kotlin',
      'kt',
      'java',
      'php',
      'swift',
    ] as const)(
      'substitutes plaster with the default template for %s fence',
      (lang) => {
        const src = dedent`
          // #docregion
          x
          // #enddocregion
          // #docregion
          y
          // #enddocregion
        `;
        const md = dedent`
          <?code-excerpt "snippet.txt"?>

          \`\`\`${lang}
          .
          \`\`\`
        `;
        const out = injectMarkdown(md, {
          readFile: (p) => (p === 'snippet.txt' ? src : null),
        });
        const plasterLine = PLASTER_LINE_BY_FENCE_LANG[lang];
        expect(plasterLine).toBeDefined();
        expect(out).toStrictEqual(dedent`
          <?code-excerpt "snippet.txt"?>

          \`\`\`${lang}
          x
          ${plasterLine}
          y
          \`\`\`
        `);
      },
    );

    it('strips DEFAULT_PLASTER lines when plaster=none', () => {
      const src = dedent`
        // #docregion
        a
        // #enddocregion
        // #docregion
        b
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt plaster="none"?>
        <?code-excerpt "pn.dart"?>

        \`\`\`dart
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'pn.dart' ? src : null),
      });
      expect(out).toStrictEqual(dedent`
        <?code-excerpt plaster="none"?>
        <?code-excerpt "pn.dart"?>

        \`\`\`dart
        a
        b
        \`\`\`

      `);
    });

    it('errors when input ends after excerpt PI (no code block)', () => {
      const onError = vi.fn();
      const md = dedent`
        <?code-excerpt "end.dart"?>
      `;
      injectMarkdown(md, {
        readFile: () => '//\n',
        onError,
      });
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('reached end of input'),
      );
    });

    it('handles liquid prettify fences like backtick fences', () => {
      const src = dedent`
        // #docregion
        liquid
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "liq.dart"?>

        {% prettify dart %}
        .
        {% endprettify %}

      `;
      const out = injectMarkdown(md, ctx({ 'liq.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt "liq.dart"?>

        {% prettify dart %}
        liquid
        {% endprettify %}

      `);
    });

    it('does not treat non-prettify Liquid blocks as code fences', () => {
      const src = dedent`
        // #docregion
        INJECTED
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt "x.dart"?>

        {% if true %}
        SHOULD_STAY
        {% endif %}

      `;
      const out = injectMarkdown(md, ctx({ 'x.dart': src }));
      expect(out).toStrictEqual(md);
    });

    it('chains multiple replace steps in file-level set replace', () => {
      const src = dedent`
        // #docregion
        ab
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="/a/x/g;/b/y/g"?>
        <?code-excerpt "chain.dart"?>

        \`\`\`
        .
        \`\`\`

      `;
      const out = injectMarkdown(md, ctx({ 'chain.dart': src }));
      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="/a/x/g;/b/y/g"?>
        <?code-excerpt "chain.dart"?>

        \`\`\`
        xy
        \`\`\`

      `);
    });
  });
});
