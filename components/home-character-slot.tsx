import { Image, StyleSheet, Text, View } from 'react-native';

import { BrandColors } from '@/constants/theme';

const characterSource = require('@/assets/images/home-cat-placeholder.png');

export function HomeCharacterSlot() {
  return (
    <View accessibilityLabel="소비 다이어리 고양이 캐릭터" style={styles.container}>
      <View style={styles.speechBubble}>
        <Text style={styles.speechCaption}>재윤님</Text>
        <Text style={styles.speechText}>오늘은 어떤 소비가{`\n`}기다리고 있을까?</Text>
        <View style={styles.speechTail} />
      </View>

      <View style={styles.characterShadow}>
        <View style={styles.shadowEarLeft} />
        <View style={styles.shadowEarRight} />
      </View>
      <Image resizeMode="contain" source={characterSource} style={styles.characterImage} />
      <View style={styles.sideNoteBox}>
        <Text style={styles.sideNote}>기록하는 오늘이{`\n`}더 좋은 내일을 만들 거야!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 176,
    overflow: 'hidden',
    position: 'relative',
  },
  speechBubble: {
    backgroundColor: BrandColors.surface,
    borderRadius: 22,
    left: 4,
    paddingHorizontal: 15,
    paddingVertical: 13,
    position: 'absolute',
    top: 28,
    width: 150,
    zIndex: 3,
  },
  speechCaption: {
    color: BrandColors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 5,
  },
  speechText: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
  },
  speechTail: {
    backgroundColor: BrandColors.surface,
    bottom: 23,
    height: 17,
    position: 'absolute',
    right: -7,
    transform: [{ rotate: '45deg' }],
    width: 17,
  },
  characterShadow: {
    backgroundColor: '#9A7BFF',
    borderRadius: 66,
    bottom: -12,
    height: 139,
    position: 'absolute',
    right: 63,
    transform: [{ rotate: '-3deg' }],
    width: 152,
  },
  shadowEarLeft: {
    backgroundColor: '#9A7BFF',
    height: 48,
    left: 10,
    position: 'absolute',
    top: -13,
    transform: [{ rotate: '35deg' }],
    width: 48,
  },
  shadowEarRight: {
    backgroundColor: '#9A7BFF',
    height: 48,
    position: 'absolute',
    right: 10,
    top: -13,
    transform: [{ rotate: '55deg' }],
    width: 48,
  },
  characterImage: {
    bottom: -7,
    height: 158,
    position: 'absolute',
    right: 49,
    width: 184,
    zIndex: 2,
  },
  sideNoteBox: {
    backgroundColor: BrandColors.background,
    borderRadius: 12,
    paddingHorizontal: 3,
    paddingVertical: 5,
    position: 'absolute',
    right: 0,
    top: 64,
    transform: [{ rotate: '-7deg' }],
    width: 74,
    zIndex: 3,
  },
  sideNote: {
    color: '#6F6880',
    fontSize: 9,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'center',
  },
});
