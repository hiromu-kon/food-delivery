import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AuthShell } from './auth-shell';

export async function LegalDocument({ document }: { document: 'terms' | 'privacy' }) {
  'use cache';
  const text = await readFile(
    path.join(process.cwd(), '../../docs/legal', `${document}.md`),
    'utf8',
  );
  const title = document === 'terms' ? '利用規約' : 'プライバシーポリシー';
  return (
    <AuthShell title={title}>
      <article className="text-body-m break-words [&_p]:mb-4 [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:font-bold [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-2 [&_blockquote]:mb-6 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-secondary [&_table]:w-full [&_table]:text-body-s [&_th]:border [&_th]:bg-subtle [&_th]:p-2 [&_td]:border [&_td]:p-2">
        <Markdown remarkPlugins={[remarkGfm]}>{text.replace(/^# .+\n/, '')}</Markdown>
      </article>
    </AuthShell>
  );
}
