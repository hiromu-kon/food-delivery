import { notFound } from 'next/navigation';

import { CustomerComponentsDemo } from './customer-components-demo';

export default function CustomerComponentsPage() {
  // layout と並行してページが描画されるため、本番のガードはページに置く
  if (process.env.NODE_ENV !== 'development') notFound();
  return <CustomerComponentsDemo />;
}
