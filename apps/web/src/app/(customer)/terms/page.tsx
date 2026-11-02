import type { Metadata } from 'next';
import { LegalDocument } from '@/features/auth/legal-document';
export const metadata: Metadata = { title: '利用規約 | Food Delivery' };
export default function Page() {
  return <LegalDocument document="terms" />;
}
