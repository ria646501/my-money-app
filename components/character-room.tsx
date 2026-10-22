import { StyleSheet, Text, View } from 'react-native';

import { CharacterRoomLayer, CharacterVisual } from '@/components/character-visual';
import { CharacterStage, StageProgress } from '@/lib/growth';

const LEVEL_BY_STAGE: Record<CharacterStage['id'], number> = {
  EGG: 1,
  CHICK: 2,
  GROWING_CHICKEN: 3,
  CHICKEN: 4,
  MYSTERY: 5,
};

type RewardEffect = {
  exp: number;
  points: number;
} | null;

type CharacterRoomProps = {
  progress: StageProgress;
  rewardEffect?: RewardEffect;
};

const SPEECH_TEXT = '오늘도\n기록해볼까?';

export function CharacterRoom({ progress, rewardEffect = null }: CharacterRoomProps) {
  const totalExp = progress.stage.minimumExp + progress.currentExpInStage;
  const requiredExp = progress.nextStage?.minimumExp ?? Math.max(1, totalExp);
  const displayedProgress = Math.min(1, totalExp / requiredExp);

  return (
    <View accessibilityLabel="캐릭터 방" style={styles.container}>
      <CharacterRoomLayer style={styles.roomBackground} />

      <View pointerEvents="none" style={styles.topStatus}>
        <Text style={styles.levelText}>Lv.{LEVEL_BY_STAGE[progress.stage.id]}</Text>
      </View>

      <View pointerEvents="none" style={styles.speechBubble}>
        <Text style={styles.speechText}>{SPEECH_TEXT}</Text>
        <View style={styles.speechTail} />
      </View>

      <CharacterVisual
        maxSize={100}
        stageId={progress.stage.id}
        style={styles.characterImage}
      />

      {rewardEffect ? (
        <View pointerEvents="none" style={styles.rewardEffect}>
          {rewardEffect.exp > 0 ? <Text style={styles.rewardExp}>+{rewardEffect.exp} EXP</Text> : null}
          {rewardEffect.points > 0 ? <Text style={styles.rewardPoints}>+{rewardEffect.points}P</Text> : null}
        </View>
      ) : null}

      <View style={styles.expPanel}>
        <View style={styles.expTrack}>
          <View style={[styles.expFill, { width: `${Math.round(displayedProgress * 100)}%` }]} />
          <Text style={styles.expValue}>
            {totalExp} / {requiredExp}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 1.03,
    marginBottom: 6,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  roomBackground: {
    bottom: 0,
    height: '100%',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
  topStatus: {
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderColor: '#5362B1',
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    left: '31%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: '31%',
    top: '31%',
  },
  levelText: {
    color: '#34427D',
    fontSize: 10,
    fontWeight: '900',
  },
  speechBubble: {
    backgroundColor: '#FFFDF9',
    borderColor: '#37478E',
    borderRadius: 8,
    borderWidth: 1.5,
    left: '34.5%',
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    top: '46%',
    width: '31%',
  },
  speechText: {
    color: '#34427D',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  speechTail: {
    backgroundColor: '#FFFDF9',
    borderBottomColor: '#37478E',
    borderBottomWidth: 1.5,
    borderRightColor: '#37478E',
    borderRightWidth: 1.5,
    bottom: -8,
    height: 14,
    left: '50%',
    marginLeft: -7,
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    width: 14,
  },
  characterImage: {
    bottom: '16%',
    left: '36%',
    position: 'absolute',
  },
  rewardEffect: {
    alignItems: 'center',
    left: '54%',
    position: 'absolute',
    top: '25%',
  },
  rewardExp: {
    color: '#E96699',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: '#FFFFFF',
    textShadowRadius: 2,
  },
  rewardPoints: {
    color: '#7C5CFC',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
    textShadowColor: '#FFFFFF',
    textShadowRadius: 2,
  },
  expPanel: {
    bottom: '14.5%',
    left: '29%',
    position: 'absolute',
    right: '29%',
  },
  expValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    position: 'absolute',
    textAlign: 'center',
    textShadowColor: '#29427F',
    textShadowRadius: 2,
    width: '100%',
  },
  expTrack: {
    backgroundColor: '#FFFDF9',
    borderColor: '#304D9D',
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  expFill: {
    backgroundColor: '#75B9F3',
    borderRadius: 7,
    height: '100%',
  },
});
