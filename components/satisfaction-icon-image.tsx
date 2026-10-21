import { Image, ImageSourcePropType, ImageStyle, StyleProp, StyleSheet } from 'react-native';

import { Satisfaction } from '@/lib/expense-record';

const SATISFACTION_IMAGES: Record<Satisfaction, ImageSourcePropType> = {
  '😫': require('@/assets/satisfaction/very-dissatisfied.png'),
  '😕': require('@/assets/satisfaction/dissatisfied.png'),
  '😐': require('@/assets/satisfaction/neutral.png'),
  '🙂': require('@/assets/satisfaction/satisfied.png'),
  '😍': require('@/assets/satisfaction/very-satisfied.png'),
};

type SatisfactionIconImageProps = {
  satisfaction: Satisfaction;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

export function SatisfactionIconImage({
  satisfaction,
  size = 34,
  style,
}: SatisfactionIconImageProps) {
  return (
    <Image
      resizeMode="contain"
      source={SATISFACTION_IMAGES[satisfaction]}
      style={[styles.image, { height: size, width: size }, style]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    flexShrink: 0,
  },
});
