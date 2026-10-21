import { Image, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet } from 'react-native';

import { CategoryIconName } from '@/lib/categories';

const CATEGORY_IMAGES: Record<CategoryIconName, ImageSourcePropType> = {
  'silverware-fork-knife': require('@/assets/categories/meal.png'),
  'coffee-outline': require('@/assets/categories/cafe.png'),
  'shopping-outline': require('@/assets/categories/shopping.png'),
  bus: require('@/assets/categories/transport.png'),
  'gamepad-variant-outline': require('@/assets/categories/entertainment.png'),
  'home-outline': require('@/assets/categories/home.png'),
  'dots-horizontal': require('@/assets/categories/other.png'),
  'heart-outline': require('@/assets/categories/donation.png'),
  'gift-outline': require('@/assets/categories/gift.png'),
  'book-open-page-variant-outline': require('@/assets/categories/book.png'),
  run: require('@/assets/categories/fitness.png'),
  'medical-bag': require('@/assets/categories/health.png'),
  'paw-outline': require('@/assets/categories/pet.png'),
  airplane: require('@/assets/categories/travel.png'),
  'music-note': require('@/assets/categories/music.png'),
  'tag-outline': require('@/assets/categories/other.png'),
};

type CategoryIconImageProps = {
  icon: CategoryIconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function CategoryIconImage({ icon, size = 28, style }: CategoryIconImageProps) {
  return (
    <Image
      resizeMode="contain"
      source={CATEGORY_IMAGES[icon]}
      style={[styles.image, { height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 7,
  },
});
