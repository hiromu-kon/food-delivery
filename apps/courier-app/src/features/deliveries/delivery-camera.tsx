import { deliveryPhotoUploadSchema, type DeliveryPhotoUpload } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Linking, View } from 'react-native';

export function DeliveryCamera({
  busy,
  hasUploadedPhoto,
  onUpload,
  onComplete,
  onFooterChange,
}: {
  busy: boolean;
  hasUploadedPhoto: boolean;
  onUpload: (photo: DeliveryPhotoUpload) => Promise<boolean>;
  onComplete: () => void;
  onFooterChange: (footer: ReactNode | null) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const taking = useRef(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<DeliveryPhotoUpload>();
  const [message, setMessage] = useState('');
  const [replacingUploadedPhoto, setReplacingUploadedPhoto] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const requestCamera = useCallback(() => {
    setMessage('');
    if (permission?.granted) {
      setPhoto(undefined);
      setReplacingUploadedPhoto(hasUploadedPhoto);
      setReady(false);
      setOpen(true);
    } else if (permission && !permission.canAskAgain) {
      void Linking.openSettings().catch(() => {
        if (mounted.current)
          setMessage('設定を開けません。端末の設定からカメラを許可してください。');
      });
    } else {
      void requestPermission()
        .then((result) => {
          if (!mounted.current) return;
          if (result.granted) {
            setPhoto(undefined);
            setReplacingUploadedPhoto(hasUploadedPhoto);
            setReady(false);
            setOpen(true);
          } else setMessage('カメラの利用を許可してください。端末の設定から変更できます。');
        })
        .catch(() => {
          if (mounted.current) setMessage('カメラの権限を確認できません。再試行してください。');
        });
    }
  }, [hasUploadedPhoto, permission, requestPermission]);

  const capture = useCallback(async () => {
    if (taking.current || !ready || busy) return;
    taking.current = true;
    setReady(false);
    try {
      const result = await camera.current?.takePictureAsync({
        base64: true,
        quality: 0.6,
        exif: false,
      });
      if (result?.uri && !result.uri.startsWith('data:')) new File(result.uri).delete();
      if (!mounted.current) return;
      const parsed = deliveryPhotoUploadSchema.safeParse({
        mimeType: 'image/jpeg',
        base64: result?.base64,
      });
      if (!parsed.success) throw new Error('Invalid photo');
      setPhoto(parsed.data);
      setOpen(false);
      setMessage('写真を確認して送信してください。');
    } catch {
      if (mounted.current) {
        setMessage('撮影できませんでした。2MB以内になるよう写真を撮り直してください。');
        setOpen(false);
      }
    } finally {
      taking.current = false;
    }
  }, [busy, ready]);

  const sendPhoto = useCallback(async () => {
    if (!photo || busy) return;
    if (await onUpload(photo)) setReplacingUploadedPhoto(false);
  }, [busy, onUpload, photo]);

  const footer = useMemo(() => {
    if (open && permission?.granted)
      return (
        <View className="gap-3">
          <CameraView
            ref={camera}
            facing="back"
            mode="picture"
            onCameraReady={() => setReady(true)}
            onMountError={() => {
              setOpen(false);
              setMessage('カメラを起動できません。再試行してください。');
            }}
            style={{ width: '100%', height: 280 }}
          />
          <Button disabled={busy || !ready} onPress={() => void capture()}>
            撮影する
          </Button>
          <Button variant="secondary" disabled={busy} onPress={() => setOpen(false)}>
            撮影をやめる
          </Button>
        </View>
      );
    if (photo && (!hasUploadedPhoto || replacingUploadedPhoto))
      return (
        <Button disabled={busy} loading={busy} onPress={() => void sendPhoto()}>
          この写真を送信
        </Button>
      );
    if (hasUploadedPhoto)
      return (
        <View className="gap-2">
          <Text className="text-secondary">写真はお客様の注文状況に表示されます。</Text>
          <Button disabled={busy} loading={busy} onPress={onComplete}>
            置いた（配達完了）
          </Button>
        </View>
      );
    return (
      <View className="gap-2">
        <Text className="text-secondary">
          置き配です。置いた場所の写真を1枚撮ってから完了にします。
        </Text>
        <Button disabled={busy} onPress={requestCamera}>
          {permission && !permission.canAskAgain && !permission.granted
            ? '端末の設定を開く'
            : '置いた場所の写真を撮る'}
        </Button>
      </View>
    );
  }, [
    busy,
    capture,
    hasUploadedPhoto,
    onComplete,
    open,
    permission,
    photo,
    ready,
    replacingUploadedPhoto,
    requestCamera,
    sendPhoto,
  ]);

  useEffect(() => {
    onFooterChange(footer);
  }, [footer, onFooterChange]);

  useEffect(() => () => onFooterChange(null), [onFooterChange]);

  return (
    <View className="gap-3">
      <Text>
        商品を置いた場所の写真を1枚撮影・送信してください。人物や不要な個人情報が写らないようにしてください。
      </Text>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      {photo ? (
        <View className="gap-3">
          <Image
            source={{ uri: `data:image/jpeg;base64,${photo.base64}` }}
            accessibilityLabel="送信前の置き配写真"
            style={{ width: '100%', height: 240 }}
            resizeMode="contain"
          />
          <Button variant="secondary" disabled={busy} onPress={requestCamera}>
            写真を撮り直す
          </Button>
        </View>
      ) : hasUploadedPhoto ? (
        <View className="gap-2">
          <Text className="text-secondary">写真の送信を確認しました。配達完了にできます。</Text>
          <Button variant="secondary" disabled={busy} onPress={requestCamera}>
            写真を撮り直す
          </Button>
        </View>
      ) : null}
    </View>
  );
}
