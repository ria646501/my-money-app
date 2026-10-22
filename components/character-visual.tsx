import {
  Image,
  ImageSourcePropType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { CharacterStage } from '@/lib/growth';

const ROOM_SOURCE = require('@/assets/characters/character-room.png');
const GROWTH_ROOM_SOURCE = require('@/assets/characters/growth-room-blue.jpg');

const CHARACTER_SOURCES: Record<CharacterStage['id'], ImageSourcePropType> = {
  EGG: require('@/assets/characters/egg.png'),
  CHICK: require('@/assets/characters/chick.png'),
  GROWING_CHICKEN: require('@/assets/characters/juvenile.png'),
  CHICKEN: require('@/assets/characters/chicken.png'),
  MYSTERY: require('@/assets/characters/mystery-silhouette.png'),
};

const SILHOUETTE_SOURCES: Record<CharacterStage['id'], ImageSourcePropType> = {
  EGG: require('@/assets/characters/egg-silhouette.png'),
  CHICK: require('@/assets/characters/chick-silhouette.png'),
  GROWING_CHICKEN: require('@/assets/characters/juvenile-silhouette.png'),
  CHICKEN: require('@/assets/characters/chicken-silhouette.png'),
  MYSTERY: require('@/assets/characters/mystery-silhouette.png'),
};

const CHARACTER_VISUAL_SCALE: Record<CharacterStage['id'], number> = {
  EGG: 0.6,
  CHICK: 0.72,
  GROWING_CHICKEN: 0.86,
  CHICKEN: 1,
  MYSTERY: 1.83,
};

type CharacterVisualProps = {
  maxSize: number;
  silhouette?: boolean;
  stageId: CharacterStage['id'];
  style?: StyleProp<ViewStyle>;
};

export function CharacterVisual({
  maxSize,
  silhouette = false,
  stageId,
  style,
}: CharacterVisualProps) {
  const visualSize = maxSize * CHARACTER_VISUAL_SCALE[stageId];
  const source = silhouette ? SILHOUETTE_SOURCES[stageId] : CHARACTER_SOURCES[stageId];

  return (
    <View
      pointerEvents="none"
      style={[styles.visualFrame, { height: maxSize, width: maxSize }, style]}>
      <Image
        resizeMode="contain"
        source={source}
        style={{ height: visualSize, width: visualSize }}
      />
    </View>
  );
}

type CharacterRoomLayerProps = {
  growthRoom?: boolean;
  interiorOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CharacterRoomLayer({
  growthRoom = false,
  interiorOnly = false,
  style,
}: CharacterRoomLayerProps) {
  return (
    <View pointerEvents="none" style={[styles.roomLayer, style]}>
      <Image
        resizeMode={growthRoom ? 'cover' : 'stretch'}
        source={growthRoom ? GROWTH_ROOM_SOURCE : ROOM_SOURCE}
        style={
          growthRoom
            ? styles.growthRoomImage
            : interiorOnly
              ? styles.interiorRoomImage
              : styles.fullRoomImage
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullRoomImage: {
    height: '100%',
    width: '100%',
  },
  growthRoomImage: {
    height: '100%',
    width: '100%',
  },
  interiorRoomImage: {
    height: '214%',
    left: '-40%',
    position: 'absolute',
    top: '-58%',
    width: '184%',
  },
  roomLayer: {
    overflow: 'hidden',
  },
  visualFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
