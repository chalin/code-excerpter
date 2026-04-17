import { describe, expect, it, vi } from 'vitest';
import {
  injectMarkdown,
  parseFragmentArgs,
  parseNamedArgs,
} from '../src/inject.js';
import { dedent } from './helpers/dedent.js';

describe('inject arg processing', () => {
  describe('parseNamedArgs', () => {
    it('preserves encounter order and distinguishes bare vs valued args', () => {
      const parsed = parseNamedArgs(
        'skip="1" plaster retain="x" replace="/a/b/g"',
      );

      expect(parsed.entries).toStrictEqual([
        { key: 'skip', value: '1', hasValue: true },
        { key: 'plaster', value: undefined, hasValue: false },
        { key: 'retain', value: 'x', hasValue: true },
        { key: 'replace', value: '/a/b/g', hasValue: true },
      ]);
    });

    it('reports a parse failure near the first invalid token', () => {
      const onError = vi.fn();
      const parsed = parseNamedArgs('skip="1" @oops replace="/a/b/g"', onError);

      expect(parsed.entries).toStrictEqual([
        { key: 'skip', value: '1', hasValue: true },
      ]);
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('instruction argument parsing failure'),
      );
    });
  });

  describe('parseFragmentArgs', () => {
    it('preserves repeated TOps in exact encounter order while splitting settings', () => {
      const parsed = parseNamedArgs(
        'skip="1" region="r" replace="/a/b/g" retain="x" replace="/b/c/g" indent-by="2" plaster="tpl"',
      );
      const fragment = parseFragmentArgs(parsed);

      expect(fragment).toStrictEqual({
        transformOps: [
          { name: 'skip', value: '1' },
          { name: 'replace', value: '/a/b/g' },
          { name: 'retain', value: 'x' },
          { name: 'replace', value: '/b/c/g' },
        ],
        regionValue: 'r',
        indentByRaw: '2',
        plasterTemplate: 'tpl',
        hasBarePlaster: false,
        hasUnsupportedDiff: false,
      });
    });

    it('classifies fragment replace as a transform operation', () => {
      const fragment = parseFragmentArgs(parseNamedArgs('replace="/a/b/g"'));

      expect(fragment?.transformOps).toStrictEqual([
        { name: 'replace', value: '/a/b/g' },
      ]);
      expect(fragment?.regionValue).toBeUndefined();
      expect(fragment?.indentByRaw).toBeUndefined();
      expect(fragment?.plasterTemplate).toBeUndefined();
    });

    it.each(['region', 'indent-by', 'plaster'] as const)(
      'rejects repeated %s settings',
      (key) => {
        const onError = vi.fn();
        const value = key === 'indent-by' ? '1' : 'x';
        const parsed = parseNamedArgs(
          `${key}="${value}" ${key}="${value}"`,
          onError,
        );

        expect(parseFragmentArgs(parsed, onError)).toBeNull();
        expect(onError).toHaveBeenCalledWith(
          `${key}: repeated setting argument on fragment instruction`,
        );
      },
    );

    it('flags unsupported diff args without adding transform ops', () => {
      const fragment = parseFragmentArgs(
        parseNamedArgs('skip="1" diff-with="b.dart" diff-u="3"'),
      );

      expect(fragment?.transformOps).toStrictEqual([
        { name: 'skip', value: '1' },
      ]);
      expect(fragment?.hasUnsupportedDiff).toBe(true);
    });
  });

  describe('scope-sensitive replace', () => {
    it('treats set replace as a file setting and fragment replace as a TOp', () => {
      const src = dedent`
        // #docregion
        a
        // #enddocregion
      `;
      const md = dedent`
        <?code-excerpt replace="/b/c/g"?>
        <?code-excerpt "a.dart" replace="/a/b/g"?>

        \`\`\`
        old
        \`\`\`

      `;

      const out = injectMarkdown(md, {
        readFile: (p) => (p === 'a.dart' ? src : null),
      });

      expect(out).toStrictEqual(dedent`
        <?code-excerpt replace="/b/c/g"?>
        <?code-excerpt "a.dart" replace="/a/b/g"?>

        \`\`\`
        c
        \`\`\`

      `);
    });
  });
});
