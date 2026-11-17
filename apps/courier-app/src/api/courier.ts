import {
  courierAvailabilitySchema,
  courierMeSchema,
  courierOrderListSchema,
  courierCurrentOrderSchema,
  courierOrderResponseSchema,
} from '@repo/contract';

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

export function listDeliveries(controller: SessionController) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders.$get();
    await assertAuthSuccess(response);
    return courierOrderListSchema.parse(await response.json());
  });
}
export function currentDelivery(controller: SessionController) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders.current.$get();
    await assertAuthSuccess(response);
    return courierCurrentOrderSchema.parse(await response.json());
  });
}
export function deliveryDetail(controller: SessionController, id: string) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders[':id'].$get({ param: { id } });
    await assertAuthSuccess(response);
    return courierOrderResponseSchema.parse(await response.json());
  });
}
export function acceptDelivery(controller: SessionController, id: string) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders[':id'].accept.$post({
      param: { id },
    });
    await assertAuthSuccess(response);
    return courierOrderResponseSchema.parse(await response.json());
  });
}
