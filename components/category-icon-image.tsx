import { Image, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet, View } from 'react-native';

import { CategoryIconName } from '@/lib/categories';

const CATEGORY_IMAGES: Record<CategoryIconName, ImageSourcePropType> = {
  'silverware-fork-knife': require('@/assets/categories/meal.png'),
  'coffee-outline': require('@/assets/categories/cafe.png'),
  'shopping-outline': require('@/assets/categories/shopping.png'),
  'gamepad-variant-outline': require('@/assets/categories/entertainment.png'),
  bus: require('@/assets/categories/transport.png'),
  lipstick: require('@/assets/categories/beauty.png'),
  'package-variant-closed': require('@/assets/categories/household.png'),
  'gift-outline': require('@/assets/categories/gift.png'),
  'medical-bag': require('@/assets/categories/health.png'),
  'tshirt-crew-outline': require('@/assets/categories/fashion.png'),
  'home-outline': require('@/assets/categories/home.png'),
  'paw-outline': require('@/assets/categories/pet.png'),
};

export const PRIMARY_CATEGORY_ICON_SIZE = 44;

type CategoryIconImageProps = {
  icon: CategoryIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function CategoryIconImage({ icon, size = 28, style }: CategoryIconImageProps) {
  const renderedSize = size * 1.72;

  return (
    <View style={[styles.viewport, { height: size, width: size }]}>
      <Image
        resizeMode="contain"
        source={CATEGORY_IMAGES[icon]}
        style={[styles.image, { height: renderedSize, width: renderedSize }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    borderRadius: 7,
  },
});
