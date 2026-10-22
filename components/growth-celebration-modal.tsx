import { Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CharacterVisual } from '@/components/character-visual';
import { CharacterStage, GROWTH_CONFIG } from '@/lib/growth';

const BACKGROUND_SOURCE = require('@/assets/characters/growth-celebration-modal-bg.png');
const REFERENCE_WIDTH = 393;
const REFERENCE_HEIGHT = 698;

const LEVEL_BY_STAGE: Record<CharacterStage['id'], number> = {
  EGG: 1,
  CHICK: 2,
  GROWING_CHICKEN: 3,
  CHICKEN: 4,
  MYSTERY: 5,
};

const CELEBRATION_NAME_BY_STAGE: Record<CharacterStage['id'], string> = {
  EGG: '알',
  CHICK: '삐약이',
  GROWING_CHICKEN: '중닭',
  CHICKEN: '닭',
  MYSTERY: '???',
};

type GrowthCelebrationModalProps = {
  onConfirm: () => void;
  stageId: CharacterStage['id'] | null;
  totalExp: number;
};

export function GrowthCelebrationModal({
  onConfirm,
  stageId,
  totalExp,
}: GrowthCelebrationModalProps) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const canvasScale = Math.min(windowWidth / REFERENCE_WIDTH, windowHeight / REFERENCE_HEIGHT, 1);
  const stageIndex = GROWTH_CONFIG.stages.findIndex((stage) => stage.id === stageId);
  const stage = stageIndex >= 0 ? GROWTH_CONFIG.stages[stageIndex] : null;
  const previousStage = stageIndex > 0 ? GROWTH_CONFIG.stages[stageIndex - 1] : null;
  const nextStage = stageIndex >= 0 ? GROWTH_CONFIG.stages[stageIndex + 1] ?? null : null;
  const stageExpRange = stage && nextStage ? nextStage.minimumExp - stage.minimumExp : 0;
  const currentExpInStage = stage ? Math.max(0, totalExp - stage.minimumExp) : 0;
  const remainingExp = nextStage ? Math.max(0, nextStage.minimumExp - totalExp) : 0;
  const progress = stageExpRange > 0 ? Math.min(1, currentExpInStage / stageExpRange) : 1;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onConfirm}
      transparent
      visible={stage !== null}>
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[
            styles.scaledFrame,
            {
              height: REFERENCE_HEIGHT * canvasScale,
              width: REFERENCE_WIDTH * canvasScale,
            },
          ]}>
          <View style={[styles.canvas, { transform: [{ scale: canvasScale }] }]}>
            <Image resizeMode="contain" source={BACKGROUND_SOURCE} style={styles.backgroundImage} />

            <Text style={styles.title}>성장했어요!</Text>

            {stage ? (
              <>
                <Text style={styles.levelText}>
                  {previousStage
                    ? `Lv.${LEVEL_BY_STAGE[previousStage.id]} ${CELEBRATION_NAME_BY_STAGE[previousStage.id]} → `
                    : ''}
                  Lv.{LEVEL_BY_STAGE[stage.id]} {CELEBRATION_NAME_BY_STAGE[stage.id]}
                </Text>

                <View style={styles.character}>
                  <CharacterVisual maxSize={230} stageId={stage.id} />
                </View>

                <Text style={styles.stageName}>
                  Lv.{LEVEL_BY_STAGE[stage.id]} · {CELEBRATION_NAME_BY_STAGE[stage.id]}
                </Text>
              </>
            ) : null}

            <Text style={styles.subtitle}>차곡차곡 쌓인 기록 덕분에 한 뼘 자랐어요</Text>

            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  {nextStage ? `다음 성장까지 ${remainingExp} EXP` : '모든 성장 단계 달성'}
                </Text>
                <Text style={styles.progressValue}>
                  {nextStage ? `${currentExpInStage}/${stageExpRange}` : '완료'}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
            </View>

            <Pressable
              accessibilityLabel="성장 축하 팝업 확인"
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmPressed]}>
              <Text style={styles.confirmText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 40, 66, 0.48)',
    flex: 1,
    justifyContent: 'center',
  },
  backgroundImage: {
    height: REFERENCE_HEIGHT,
    left: 0,
    position: 'absolute',
    top: 0,
    width: REFERENCE_WIDTH,
  },
  canvas: {
    height: REFERENCE_HEIGHT,
    left: '50%',
    marginLeft: -(REFERENCE_WIDTH / 2),
    marginTop: -(REFERENCE_HEIGHT / 2),
    position: 'absolute',
    top: '50%',
    width: REFERENCE_WIDTH,
  },
  character: {
    alignItems: 'center',
    height: 230,
    justifyContent: 'center',
    left: 81.5,
    position: 'absolute',
    top: 157,
    width: 230,
  },
  confirmButton: {
    alignItems: 'center',
    height: 49,
    justifyContent: 'center',
    left: 44,
    position: 'absolute',
    top: 578,
    width: 305,
  },
  confirmPressed: { opacity: 0.72 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  levelText: {
    color: '#3D385B',
    fontSize: 13,
    fontWeight: '800',
    left: 74,
    position: 'absolute',
    textAlign: 'center',
    top: 122,
    width: 245,
  },
  progressCard: {
    backgroundColor: '#F9F3FF',
    borderColor: '#E5D5F0',
    borderRadius: 14,
    borderWidth: 1,
    height: 59,
    left: 44,
    paddingHorizontal: 13,
    paddingTop: 12,
    position: 'absolute',
    top: 492,
    width: 305,
  },
  progressFill: {
    backgroundColor: '#F48BB4',
    borderRadius: 4,
    height: '100%',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: { color: '#343153', fontSize: 12, fontWeight: '800' },
  progressTrack: {
    backgroundColor: '#FFFFFF',
    borderColor: '#F6BAD3',
    borderRadius: 4,
    borderWidth: 1,
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
    width: '100%',
  },
  progressValue: { color: '#918AA6', fontSize: 11, fontWeight: '500' },
  scaledFrame: {
    overflow: 'hidden',
    position: 'relative',
  },
  stageName: {
    color: '#343153',
    fontSize: 21,
    fontWeight: '900',
    left: 44,
    position: 'absolute',
    textAlign: 'center',
    top: 415,
    width: 305,
  },
  subtitle: {
    color: '#9891A5',
    fontSize: 12,
    left: 44,
    position: 'absolute',
    textAlign: 'center',
    top: 450,
    width: 305,
  },
  title: {
    color: '#343153',
    fontSize: 28,
    fontWeight: '900',
    left: 44,
    letterSpacing: -0.7,
    position: 'absolute',
    textAlign: 'center',
    top: 67,
    width: 305,
  },
});
