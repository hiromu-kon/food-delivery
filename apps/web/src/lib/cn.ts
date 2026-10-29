import { createCn } from 'cn/config';

// cn は知らない text-* を文字色とみなし、text-heading-l と text-primary を一緒に書くと大きさのほうを消す。
// トークンの文字の大きさ（packages/design-tokens/theme.css の --text-*）を大きさとして教える。
export const textSizeTokens = [
  'display',
  'heading-l',
  'heading-m',
  'body-l',
  'body-m',
  'body-s',
  'label-l',
  'label-m',
  'label-s',
] as const;

export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: [...textSizeTokens] }],
      shadow: [{ shadow: ['raised', 'overlay'] }],
    },
  },
});
