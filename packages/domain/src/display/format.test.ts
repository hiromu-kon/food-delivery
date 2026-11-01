import { describe, expect, it } from 'vitest';

import { formatDistance, formatYen } from './format';

describe('formatYen', () => {
  it('円記号を前に付け、整数の円を 3 桁ずつ区切る', () => {
    expect(formatYen(0)).toBe('¥0');
    expect(formatYen(1960)).toBe('¥1,960');
    expect(formatYen(1234567)).toBe('¥1,234,567');
  });
});

describe('formatDistance', () => {
  it('1 km 未満は m、1 km 以上は小数 1 桁の km にする', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(800)).toBe('800 m');
    expect(formatDistance(999)).toBe('999 m');
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1250)).toBe('1.3 km');
  });
});
