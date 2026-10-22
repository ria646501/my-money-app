import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { CharacterRoomLayer, CharacterVisual } from '@/components/character-visual';
import { CharacterStage, StageProgress } from '@/lib/growth';
import { RewardFeedback, RewardFeedbackAnchor } from '@/lib/reward-feedback';

const LEVEL_BY_STAGE: Record<CharacterStage['id'], number> = {
  EGG: 1,
  CHICK: 2,
  GROWING_CHICKEN: 3,
  CHICKEN: 4,
  MYSTERY: 5,
};

type CharacterRoomProps = {
  onRewardEffectComplete?: (id: string) => void;
  progress: StageProgress;
  rewardEffects?: RewardFeedback[];
};

const SPEECH_TEXT = '오늘도\n기록해볼까?';

const REWARD_ANCHORS: Record<RewardFeedbackAnchor, ViewStyle> = {
  'left-top': { left: '20%', top: '28%' },
  'right-top': { right: '18%', top: '29%' },
  left: { left: '17%', top: '43%' },
  right: { right: '16%', top: '42%' },
  'upper-center': { left: '38%', top: '23%' },
};

function FloatingReward({
  feedback,
  onComplete,
}: {
  feedback: RewardFeedback;
  onComplete?: (id: string) => void;
}) {
  const [expProgress] = useState(() => new Animated.Value(0));
  const [pointProgress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const createAnimation = (value: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          duration: 1_500,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }),
      ]);
    const animations = [
      ...(feedback.exp > 0 ? [createAnimation(expProgress, 0)] : []),
      ...(feedback.points > 0 ? [createAnimation(pointProgress, 130)] : []),
    ];
    const animation = Animated.parallel(animations);

    animation.start(({ finished }) => {
      if (finished) {
        onComplete?.(feedback.id);
      }
    });

    return () => animation.stop();
  }, [expProgress, feedback.exp, feedback.id, feedback.points, onComplete, pointProgress]);

  const animatedStyle = (progress: Animated.Value) => ({
    opacity: progress.interpolate({
      inputRange: [0, 0.15, 0.72, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        scale: progress.interpolate({
          inputRange: [0, 0.18, 0.34, 1],
          outputRange: [0.7, 1.1, 1, 1],
        }),
      },
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [8, -28],
        }),
      },
    ],
  });

  return (
    <View pointerEvents="none" style={[styles.rewardEffect, REWARD_ANCHORS[feedback.anchor]]}>
      {feedback.exp > 0 ? (
        <Animated.Text style={[styles.rewardExp, animatedStyle(expProgress)]}>
          +{feedback.exp} EXP
        </Animated.Text>
      ) : null}
      {feedback.points > 0 ? (
        <Animated.Text style={[styles.rewardPoints, animatedStyle(pointProgress)]}>
          +{feedback.points}P
        </Animated.Text>
      ) : null}
    </View>
  );
}

export function CharacterRoom({
  onRewardEffectComplete,
  progress,
  rewardEffects = [],
}: CharacterRoomProps) {
  const requiredExp = progress.nextStage
    ? progress.nextStage.minimumExp - progress.stage.minimumExp
    : Math.max(1, progress.currentExpInStage);
  const displayedProgress = progress.nextStage
    ? Math.min(1, progress.currentExpInStage / requiredExp)
    : 1;

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

      {rewardEffects.map((feedback) => (
        <FloatingReward
          feedback={feedback}
          key={feedback.id}
          onComplete={onRewardEffectComplete}
        />
      ))}

      <View style={styles.expPanel}>
        <View style={styles.expTrack}>
          <View style={[styles.expFill, { width: `${Math.round(displayedProgress * 100)}%` }]} />
          <Text style={styles.expValue}>
            {progress.currentExpInStage} / {requiredExp}
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
    bottom: '21%',
    left: '36%',
    position: 'absolute',
  },
  rewardEffect: {
    alignItems: 'center',
    position: 'absolute',
    zIndex: 4,
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
