import type { Metadata } from 'next';
import { LegalDocument } from '@/features/auth/legal-document';
export const metadata: Metadata = { title: 'プライバシーポリシー | Food Delivery' };
export default function Page() {
  return <LegalDocument document="privacy" />;
}
