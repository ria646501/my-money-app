import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { CharacterVisual } from '@/components/character-visual';
import { CharacterStage, GROWTH_CONFIG } from '@/lib/growth';

const LEVEL_BY_STAGE: Record<CharacterStage['id'], number> = {
  EGG: 1,
  CHICK: 2,
  GROWING_CHICKEN: 3,
  CHICKEN: 4,
  MYSTERY: 5,
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
  const stageIndex = GROWTH_CONFIG.stages.findIndex((stage) => stage.id === stageId);
  const stage = stageIndex >= 0 ? GROWTH_CONFIG.stages[stageIndex] : null;
  const nextStage = stageIndex >= 0 ? GROWTH_CONFIG.stages[stageIndex + 1] ?? null : null;
  const remainingExp = nextStage ? Math.max(0, nextStage.minimumExp - totalExp) : 0;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onConfirm}
      transparent
      visible={stage !== null}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={[styles.confetti, styles.confettiLeft]}>✦</Text>
          <Text style={[styles.confetti, styles.confettiRight]}>✧</Text>
          <Text style={[styles.sparkle, styles.sparkleLeft]}>✦</Text>
          <Text style={[styles.sparkle, styles.sparkleRight]}>✦</Text>

          <View style={styles.titlePill}>
            <Text style={styles.title}>성장했어요!</Text>
          </View>
          <Text style={styles.subtitle}>꾸준한 기록으로 한 단계 더 자랐어요</Text>

          {stage ? (
            <View style={styles.characterHalo}>
              <CharacterVisual maxSize={150} stageId={stage.id} />
            </View>
          ) : null}

          {stage ? (
            <Text style={styles.stageName}>
              Lv.{LEVEL_BY_STAGE[stage.id]} · {stage.name}
            </Text>
          ) : null}

          <View style={styles.nextCard}>
            <Text style={styles.nextLabel}>다음 성장까지</Text>
            <Text style={styles.nextValue}>
              {nextStage ? `${remainingExp} EXP 남았어요` : '모든 성장 단계를 달성했어요!'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmPressed]}>
            <Text style={styles.confirmText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(48, 45, 85, 0.38)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#FFF9EF',
    borderColor: '#F4C5D9',
    borderRadius: 28,
    borderWidth: 2,
    maxWidth: 360,
    overflow: 'hidden',
    paddingBottom: 22,
    paddingHorizontal: 24,
    paddingTop: 25,
    position: 'relative',
    width: '100%',
  },
  characterHalo: {
    alignItems: 'center',
    backgroundColor: '#F1E5FF',
    borderColor: '#E3CCFA',
    borderRadius: 94,
    borderWidth: 2,
    height: 188,
    justifyContent: 'center',
    marginTop: 18,
    width: 188,
  },
  confetti: {
    color: '#FF7DAE',
    fontSize: 25,
    fontWeight: '900',
    position: 'absolute',
    top: 30,
  },
  confettiLeft: { left: 25, transform: [{ rotate: '-18deg' }] },
  confettiRight: { right: 25, transform: [{ rotate: '18deg' }] },
  confirmButton: {
    alignItems: 'center',
    backgroundColor: '#F277A7',
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 48,
    width: '100%',
  },
  confirmPressed: { opacity: 0.78 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  nextCard: {
    alignItems: 'center',
    backgroundColor: '#FFF0F6',
    borderColor: '#F7CADC',
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 11,
    width: '100%',
  },
  nextLabel: { color: '#8A7894', fontSize: 11, fontWeight: '700' },
  nextValue: { color: '#554269', fontSize: 14, fontWeight: '900', marginTop: 3 },
  sparkle: { color: '#AD8BE5', fontSize: 18, position: 'absolute' },
  sparkleLeft: { left: 35, top: 185 },
  sparkleRight: { right: 34, top: 156 },
  stageName: { color: '#3E365C', fontSize: 20, fontWeight: '900', marginTop: 12 },
  subtitle: { color: '#897A91', fontSize: 12, marginTop: 9 },
  title: { color: '#F0649C', fontSize: 23, fontWeight: '900' },
  titlePill: {
    backgroundColor: '#FFE9F2',
    borderRadius: 22,
    paddingHorizontal: 21,
    paddingVertical: 8,
  },
});
