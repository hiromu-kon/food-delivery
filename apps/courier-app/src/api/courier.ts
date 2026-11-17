import {
  deliveryPhotoUploadSchema,
  type DeliveryPhotoUpload,
  courierAvailabilitySchema,
  courierDeliveryHistoryResponseSchema,
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
export function receiveDelivery(controller: SessionController, id: string) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders[':id'].receive.$post({
      param: { id },
    });
    await assertAuthSuccess(response);
    return courierOrderResponseSchema.parse(await response.json());
  });
}
export function completeDelivery(controller: SessionController, id: string) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders[':id'].deliver.$post({
      param: { id },
    });
    await assertAuthSuccess(response);
    return courierOrderResponseSchema.parse(await response.json());
  });
}
export function deliveryHistory(controller: SessionController) {
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders.history.$get();
    await assertAuthSuccess(response);
    return courierDeliveryHistoryResponseSchema.parse(await response.json());
  });
}

export function uploadDeliveryPhoto(
  controller: SessionController,
  id: string,
  photo: DeliveryPhotoUpload,
) {
  const json = deliveryPhotoUploadSchema.parse(photo);
  return controller.authenticatedRequest(async (token) => {
    const response = await createApiClient(token).courier.orders[':id'].photo.$post({
      param: { id },
      json,
    });
    await assertAuthSuccess(response);
    return courierOrderResponseSchema.parse(await response.json());
  });
}
