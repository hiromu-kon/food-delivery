import { courierAvailabilitySchema, courierMeSchema } from '@repo/contract';

import { assertAuthSuccess } from '@/features/auth/request';
import type { SessionController } from '@/features/auth/session';
import { createApiClient } from './client';

export function getCourier(controller: SessionController) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.me.$get();
    await assertAuthSuccess(response);
    return courierMeSchema.parse(await response.json());
  });
}
export function setAvailability(controller: SessionController, isAvailable: boolean) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.availability.$patch({
      json: { isAvailable },
    });
    await assertAuthSuccess(response);
    return courierAvailabilitySchema.parse(await response.json());
  });
}
