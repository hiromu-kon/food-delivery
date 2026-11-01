import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { cn, textSizeTokens } from './cn';

const themeCss = readFileSync(
  createRequire(import.meta.url).resolve('@repo/design-tokens/theme.css'),
  'utf8',
);

describe('cn', () => {
  it('トークンの文字の大きさと文字色を一緒に書くと、両方が残る', () => {
    expect(cn('text-heading-l', 'text-primary')).toBe('text-heading-l text-primary');
  });

  it('文字の大きさを 2 つ書くと、あとのほうが残る', () => {
    expect(cn('text-body-m', 'text-heading-l')).toBe('text-heading-l');
  });

  it('影を 2 つ書くと、あとのほうが残る', () => {
    expect(cn('shadow-raised', 'shadow-overlay')).toBe('shadow-overlay');
  });

  it('theme.css の文字の大きさのトークンを、すべて大きさとして扱う', () => {
    const names = [...themeCss.matchAll(/^\s*--text-([a-z0-9-]+):/gm)]
      .flatMap(([, name]) => (name ? [name] : []))
      .filter((name) => !name.startsWith('color-') && !name.includes('--'));
    expect([...textSizeTokens].sort()).toEqual([...new Set(names)].sort());
  });
});
