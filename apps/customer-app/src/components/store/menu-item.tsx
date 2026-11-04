import { formatYen } from '@repo/domain';
import { cn } from '@repo/native-ui/cn';
import { Tag } from '@repo/native-ui/tag';
import { Text } from '@repo/native-ui/text';
import * as React from 'react';
import { View } from 'react-native';

import { AddButton } from '../cart/add-button';
import { FoodPhoto } from './food-photo';

type MenuItemProps = React.ComponentProps<typeof View> & {
  name: string;
  description?: string;
  price: number;
  photoUrl?: string;
  soldOut?: boolean;
  disabled?: boolean;
  onAdd?: () => void;
};

function MenuItem({
  name,
  description,
  price,
  photoUrl,
  soldOut = false,
  disabled = false,
  onAdd,
  className,
  ...props
}: MenuItemProps) {
  const addButton = !soldOut && onAdd && (
    <AddButton accessibilityLabel={`${name}をカートに入れる`} disabled={disabled} onPress={onAdd} />
  );
  return (
    <View
      className={cn('border-default flex-row items-start gap-4 border-b py-4', className)}
      {...props}
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text variant="body-l" className={soldOut ? 'text-secondary' : ''}>
          {name}
        </Text>
        {description && (
          <Text variant="body-s" className="text-secondary">
            {description}
          </Text>
        )}
        <View className="py-1">
          {(!soldOut || !onAdd) && <Text variant="label-l">{formatYen(price)}</Text>}
          {soldOut && <Tag>売り切れ</Tag>}
        </View>
      </View>
      {photoUrl ? (
        <View className="size-25">
          <FoodPhoto
            photoUrl={photoUrl}
            label={`${name}の写真`}
            className={cn('size-24', soldOut && 'opacity-45')}
          />
          <View className="absolute -right-0.75 -bottom-0.75">{addButton}</View>
        </View>
      ) : (
        <View className="self-center">{addButton}</View>
      )}
    </View>
  );
}

export { MenuItem };
