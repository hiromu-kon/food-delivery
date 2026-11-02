import { cn } from '@repo/native-ui/cn';
import { Icon } from '@repo/native-ui/icon';
import { UtensilsCrossed } from 'lucide-react-native';
import * as React from 'react';
import { Image, View } from 'react-native';

type FoodPhotoProps = {
  photoUrl?: string | undefined;
  label: string;
  className?: string;
  iconClassName?: string;
};

function FoodPhoto({ photoUrl, label, className, iconClassName }: FoodPhotoProps) {
  const [failedUrl, setFailedUrl] = React.useState<string>();
  const showPhoto = Boolean(photoUrl) && failedUrl !== photoUrl;
  return (
    <View
      className={cn(
        'bg-disabled items-center justify-center overflow-hidden rounded-md',
        className,
      )}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl }}
          accessibilityLabel={label}
          resizeMode="cover"
          className="size-full"
          onError={() => setFailedUrl(photoUrl)}
        />
      ) : (
        <Icon
          as={UtensilsCrossed}
          className={cn('text-disabled size-6', iconClassName)}
          aria-hidden
        />
      )}
    </View>
  );
}

export { FoodPhoto };
