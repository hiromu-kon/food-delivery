import { addressSchema, type DeliveryAddress } from '@repo/contract';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerApiClient } from '@/api/server';
import { AddressesManager } from '@/features/addresses/addresses-manager';
import { addressErrorMessage, assertAddressSuccess } from '@/features/addresses/address-state';
import { AuthShell } from '@/features/auth/auth-shell';
import { requireCustomer } from '@/features/auth/session';

export const instant = false;

export default async function AddressesPage() {
  await requireCustomer();
  let addresses: DeliveryAddress[] = [];
  let error: string | null = null;
  const client = await createServerApiClient();
  let response: Response | undefined;
  try {
    response = await client.addresses.$get();
    assertAddressSuccess(response);
    addresses = z
      .object({ addresses: z.array(addressSchema) })
      .parse(await response.json()).addresses;
  } catch (cause) {
    error = addressErrorMessage(cause);
  }
  if (response?.status === 401) redirect('/login');
  if (response?.status === 403) redirect('/access-denied');
  return (
    <AuthShell title="お届け先の管理" description="住所・建物名・配達メモを登録できます。">
      <AddressesManager initialAddresses={addresses} initialError={error} />
    </AuthShell>
  );
}
