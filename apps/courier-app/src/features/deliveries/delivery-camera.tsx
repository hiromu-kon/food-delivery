import { deliveryPhotoUploadSchema, type DeliveryPhotoUpload } from '@repo/contract';
import { Button } from '@repo/native-ui/button';
import { Text } from '@repo/native-ui/text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { Image, Linking, View } from 'react-native';

export function DeliveryCamera({
  busy,
  onUpload,
}: {
  busy: boolean;
  onUpload: (photo: DeliveryPhotoUpload) => Promise<void>;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const mounted = useRef(true);
  const taking = useRef(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<DeliveryPhotoUpload>();
  const [message, setMessage] = useState('');
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function capture() {
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
  }

  return (
    <View className="gap-3">
      <Text>
        商品を置いた場所の写真を1枚撮影・送信してください。人物や不要な個人情報が写らないようにしてください。
      </Text>
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      {photo ? (
        <>
          <Image
            source={{ uri: `data:image/jpeg;base64,${photo.base64}` }}
            accessibilityLabel="送信前の置き配写真"
            style={{ width: '100%', height: 240 }}
            resizeMode="contain"
          />
          <Button
            disabled={busy}
            onPress={() => {
              void onUpload(photo);
            }}
          >
            この写真を送信
          </Button>
        </>
      ) : null}
      {open && permission?.granted ? (
        <>
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
          <Button
            disabled={busy || !ready}
            onPress={() => {
              void capture();
            }}
          >
            撮影する
          </Button>
          <Button variant="secondary" disabled={busy} onPress={() => setOpen(false)}>
            撮影をやめる
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setMessage('');
            if (permission?.granted) {
              setPhoto(undefined);
              setReady(false);
              setOpen(true);
            } else if (permission && !permission.canAskAgain) {
              void Linking.openSettings().catch(() => {
                if (mounted.current)
                  setMessage('設定を開けません。端末の設定からカメラを許可してください。');
              });
            } else
              void requestPermission()
                .then((result) => {
                  if (!mounted.current) return;
                  if (result.granted) {
                    setPhoto(undefined);
                    setReady(false);
                    setOpen(true);
                  } else setMessage('カメラの利用を許可してください。端末の設定から変更できます。');
                })
                .catch(() => {
                  if (mounted.current)
                    setMessage('カメラの権限を確認できません。再試行してください。');
                });
          }}
        >
          {permission && !permission.canAskAgain && !permission.granted
            ? '端末の設定を開く'
            : photo
              ? '写真を撮り直す'
              : '置いた場所の写真を撮る'}
        </Button>
      )}
    </View>
  );
}
