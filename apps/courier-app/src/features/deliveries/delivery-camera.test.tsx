import React, { useEffect, useImperativeHandle } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeliveryCamera } from './delivery-camera';

const sdk = vi.hoisted(() => ({
  capture: vi.fn(),
  deleteFile: vi.fn(),
  permission: { granted: true, canAskAgain: true },
  request: vi.fn(),
}));
vi.mock('expo-camera', () => ({
  useCameraPermissions: () => [sdk.permission, sdk.request],
  CameraView: ({ ref, onCameraReady }: { ref: React.Ref<unknown>; onCameraReady: () => void }) => {
    useImperativeHandle(ref, () => ({ takePictureAsync: sdk.capture }));
    useEffect(onCameraReady, [onCameraReady]);
    return React.createElement('camera');
  },
}));
vi.mock('expo-file-system', () => ({
  File: class {
    delete = sdk.deleteFile;
  },
}));
vi.mock('react-native', () => ({
  View: 'view',
  Image: 'image',
  Linking: { openSettings: vi.fn() },
}));
vi.mock('@repo/native-ui/button', () => ({ Button: 'button' }));
vi.mock('@repo/native-ui/text', () => ({ Text: 'text' }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  sdk.permission = { granted: true, canAskAgain: true };
});
afterEach(async () => {
  await act(() => renderer?.unmount());
  renderer = undefined;
});
async function mount(onUpload = vi.fn().mockResolvedValue(undefined)) {
  await act(() => {
    renderer = create(<DeliveryCamera busy={false} onUpload={onUpload} />);
  });
  return onUpload;
}
async function press(label: string) {
  const button = renderer!.root
    .findAllByType('button' as React.ElementType)
    .find((node) => node.props.children === label);
  if (!button) throw new Error(`Button missing: ${label}`);
  const action = button.props.onPress as () => void;
  await act(() => {
    action();
  });
}
it('R-15 撮影後はプレビューで確認し、明示送信するまでアップロードしない。端末キャッシュを削除する', async () => {
  const upload = await mount();
  sdk.capture.mockResolvedValue({ base64: '/9j/2Q==', uri: 'file:///synthetic-photo.jpg' });
  await press('置いた場所の写真を撮る');
  await press('撮影する');
  expect(sdk.deleteFile).toHaveBeenCalledOnce();
  expect(upload).not.toHaveBeenCalled();
  await press('この写真を送信');
  expect(upload).toHaveBeenCalledWith({ mimeType: 'image/jpeg', base64: '/9j/2Q==' });
  await press('写真を撮り直す');
  expect(renderer!.root.findAllByType('image' as React.ElementType)).toHaveLength(0);
});
it('R-15 権限拒否を案内し、撮影も送信もしない', async () => {
  sdk.permission = { granted: false, canAskAgain: true };
  sdk.request.mockResolvedValue({ granted: false });
  const upload = await mount();
  await press('置いた場所の写真を撮る');
  expect(sdk.capture).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer!.toJSON())).toContain('カメラの利用を許可');
});
it('R-15 画面離脱後に撮影が完了しても送信せず、キャッシュだけ削除する', async () => {
  let resolve!: (photo: { base64: string; uri: string }) => void;
  sdk.capture.mockReturnValue(
    new Promise((result) => {
      resolve = result;
    }),
  );
  const upload = await mount();
  await press('置いた場所の写真を撮る');
  await press('撮影する');
  await act(() => renderer!.unmount());
  renderer = undefined;
  await act(() => {
    resolve({ base64: '/9j/2Q==', uri: 'file:///synthetic-photo.jpg' });
  });
  expect(upload).not.toHaveBeenCalled();
  expect(sdk.deleteFile).toHaveBeenCalledOnce();
});
