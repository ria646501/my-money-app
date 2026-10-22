import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterRoomLayer, CharacterVisual } from '@/components/character-visual';
import { getLocalDateKey } from '@/lib/expense-record';
import {
  createInitialGrowthState,
  GROWTH_CONFIG,
  getCharacterStage,
  getNextStageProgress,
  GrowthState,
} from '@/lib/growth';
import { loadGrowthState } from '@/lib/growth-storage';

const CHARACTER_IMAGES = {
  EGG: require('@/assets/characters/egg.png'),
  CHICK: require('@/assets/characters/chick.png'),
  GROWING_CHICKEN: require('@/assets/characters/juvenile.png'),
  CHICKEN: require('@/assets/characters/chicken.png'),
  MYSTERY: require('@/assets/characters/chicken.png'),
} as const;

type MorePage = 'growth' | 'attendance';

export default function MoreScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [page, setPage] = useState<MorePage>('growth');
  const [growthState, setGrowthState] = useState<GrowthState>(() => createInitialGrowthState());

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setPage(view === 'attendance' ? 'attendance' : 'growth');
      void loadGrowthState().then((state) => {
        if (isActive) setGrowthState(state);
      });
      return () => {
        isActive = false;
      };
    }, [view])
  );

  const openGrowth = () => {
    router.setParams({ view: 'growth' });
    setPage('growth');
  };

  const openAttendance = () => {
    router.setParams({ view: 'attendance' });
    setPage('attendance');
  };

  return page === 'growth' ? (
    <GrowthScreen growthState={growthState} onOpenAttendance={openAttendance} />
  ) : (
    <AttendanceScreen growthState={growthState} onBack={openGrowth} />
  );
}

function ScreenHeader({ onBack, title }: { onBack?: () => void; title: string }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityLabel="캐릭터 성장으로 돌아가기"
          hitSlop={6}
          onPress={onBack}
          style={styles.backButton}>
          <MaterialCommunityIcons color="#302D55" name="chevron-left" size={28} />
        </Pressable>
      ) : <View style={styles.headerSpacer} />}
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSparkle}>✦</Text>
    </View>
  );
}

function GrowthScreen({ growthState, onOpenAttendance }: { growthState: GrowthState; onOpenAttendance: () => void }) {
  const progress = getNextStageProgress(growthState.totalExp);
  const stageIndex = GROWTH_CONFIG.stages.findIndex((stage) => stage.id === progress.stage.id);
  const stageRange = progress.nextStage
    ? progress.nextStage.minimumExp - progress.stage.minimumExp
    : Math.max(progress.currentExpInStage, 1);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="캐릭터 성장" />
        <View style={styles.roomCard}>
          <CharacterRoomLayer interiorOnly style={styles.roomBackground} />
          <View style={styles.growthBubble}><Text style={styles.growthBubbleText}>조금씩 자라고 있어!</Text></View>
          <CharacterVisual
            maxSize={145}
            stageId={progress.stage.id}
            style={styles.growthCharacter}
          />
        </View>

        <View style={styles.stageSummaryRow}>
          <Text style={styles.stageSummary}>Lv.{stageIndex + 1} · {progress.stage.name}</Text>
          <View style={styles.pointPill}><Text style={styles.pointPillText}>{growthState.totalPoints} P</Text></View>
        </View>
        <View style={styles.expHeader}>
          <Text style={styles.expLabel}>EXP</Text>
          <Text style={styles.expValue}>{progress.currentExpInStage} / {stageRange}</Text>
        </View>

        {progress.nextStage ? (
          <View style={styles.nextStageCard}>
            <CharacterVisual
              maxSize={48}
              silhouette
              stageId={progress.nextStage.id}
            />
            <View style={styles.nextStageCopy}>
              <Text style={styles.nextStageTitle}>다음 단계까지</Text>
              <Text style={styles.nextStageText}>앞으로 {progress.expToNextStage} EXP 남았어!</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>나의 성장 단계</Text>
        <View style={styles.stageGrid}>
          {GROWTH_CONFIG.stages.map((stage) => {
            const isCurrent = stage.id === progress.stage.id;
            const isUnlocked = growthState.totalExp >= stage.minimumExp;
            return (
              <View key={stage.id} style={[styles.stageCard, isCurrent && styles.stageCardCurrent]}>
                <CharacterVisual
                  maxSize={48}
                  silhouette={!isUnlocked || stage.id === 'MYSTERY'}
                  stageId={stage.id}
                />
                <Text style={styles.stageName}>
                  {isUnlocked && stage.id !== 'MYSTERY' ? stage.name : '???'}
                </Text>
                <Text style={[styles.stageStatus, isCurrent && styles.stageStatusCurrent]}>
                  {isCurrent ? '현재' : isUnlocked ? '완료 ✓' : '잠김'}
                </Text>
              </View>
            );
          })}
        </View>

        <Pressable accessibilityRole="button" onPress={onOpenAttendance} style={({ pressed }) => [styles.attendanceBanner, pressed && styles.pressed]}>
          <View>
            <Text style={styles.attendanceBannerTitle}>
              {growthState.currentStreak > 0
                ? `${growthState.currentStreak}일 연속 출석 중!`
                : '첫 출석을 기다리고 있어!'}
            </Text>
            <Text style={styles.attendanceBannerText}>출석 보상 자세히 보기</Text>
          </View>
          <View style={styles.attendanceBannerRight}>
            <Text style={styles.attendanceDone}>{growthState.attendanceHistory[getLocalDateKey(new Date())] ? '오늘 출석 완료 ✓' : '출석 확인 중'}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AttendanceScreen({ growthState, onBack }: { growthState: GrowthState; onBack: () => void }) {
  const todayKey = getLocalDateKey(new Date());
  const todayEntry = growthState.attendanceHistory[todayKey];
  const attendanceCount = Object.keys(growthState.attendanceHistory).length;
  const nextCycleDay = (attendanceCount % 7) + 1;
  const activeCycleDay = todayEntry?.cycleDay ?? nextCycleDay;
  const todayPoints = todayEntry?.points ?? GROWTH_CONFIG.attendancePointCycle[activeCycleDay - 1];
  const completedCountInCurrentCycle = todayEntry
    ? todayEntry.cycleDay
    : nextCycleDay === 1
      ? 0
      : nextCycleDay - 1;
  const nextRewardDay = activeCycleDay === 7 ? 1 : activeCycleDay + 1;
  const nextRewardPoints = GROWTH_CONFIG.attendancePointCycle[nextRewardDay - 1];
  const completedDays = useMemo(() => {
    const currentCycleEntries = Object.entries(growthState.attendanceHistory)
      .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
      .slice(0, completedCountInCurrentCycle);

    return new Set(currentCycleEntries.map(([, entry]) => entry.cycleDay));
  }, [completedCountInCurrentCycle, growthState.attendanceHistory]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader onBack={onBack} title="출석 보상" />
        <View style={styles.pointsRow}>
          <Text style={styles.pointsLabel}>내가 모은 Point</Text>
          <View style={styles.pointPill}><Text style={styles.pointPillText}>{growthState.totalPoints} P</Text></View>
        </View>
        <View style={styles.streakCard}>
          <Image resizeMode="contain" source={CHARACTER_IMAGES[getCharacterStage(growthState.totalExp).id]} style={styles.streakCharacter} />
          <View style={styles.streakCopy}>
            <Text style={styles.streakTitle}>
              {growthState.currentStreak > 0
                ? `${growthState.currentStreak}일 연속 출석!`
                : '첫 출석을 기다리고 있어!'}
            </Text>
            <Text style={styles.streakText}>오늘 첫 방문에서 자동으로 출석 처리돼요 ✧</Text>
            <Text style={styles.streakDone}>{todayEntry ? '오늘의 출석은 완료했어요 ✓' : '오늘 출석을 확인하고 있어요'}</Text>
          </View>
        </View>

        <View style={styles.rewardHeader}>
          <Text style={styles.sectionTitle}>7일 출석 보상</Text>
          <Text style={styles.rewardProgress}>{completedCountInCurrentCycle} / 7일</Text>
        </View>
        <View style={styles.rewardGrid}>
          {GROWTH_CONFIG.attendancePointCycle.map((points, index) => {
            const day = index + 1;
            const isCurrent = day === activeCycleDay;
            const isCompleted = completedDays.has(day);
            return (
              <View key={day} style={[styles.rewardDayCard, isCurrent && styles.rewardDayCardCurrent]}>
                <Text style={[styles.rewardDay, isCurrent && styles.rewardCurrentText]}>Day {day}</Text>
                <View style={[styles.rewardCoin, isCompleted && styles.rewardCoinCompleted]}><Text style={styles.rewardCoinText}>{isCompleted ? '✓' : 'P'}</Text></View>
                <Text style={styles.rewardPoints}>{points}P</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.rewardSummaryCard}>
          <View style={styles.rewardSummaryRow}>
            <Text style={styles.rewardSummaryLabel}>오늘 받은 보상 · Day {activeCycleDay}</Text>
            <Text style={styles.rewardSummaryStrong}>{todayEntry ? `${todayPoints}P ✓` : '-'}</Text>
          </View>
          <View style={styles.rewardSummaryRow}>
            <Text style={styles.rewardSummaryLabel}>다음 보상 · Day {nextRewardDay}</Text>
            <Text style={styles.rewardSummaryValue}>{nextRewardPoints}P</Text>
          </View>
          <View style={styles.rewardSummaryRow}>
            <Text style={styles.rewardSummaryLabel}>7일 출석 완료 보상</Text>
            <Text style={styles.rewardSummaryStrong}>+{GROWTH_CONFIG.attendanceMilestones[7].points}P</Text>
          </View>
        </View>
        <View style={styles.attendanceCompleteButton}>
          <Text style={styles.attendanceCompleteTitle}>{todayEntry ? '오늘 출석 완료 ✓' : '출석 확인 중'}</Text>
          <Text style={styles.attendanceCompleteCaption}>
            {todayEntry ? '자동 처리 완료' : '앱 방문 시 자동으로 처리돼요'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9EF', flex: 1 },
  content: { paddingBottom: 28, paddingHorizontal: 20, paddingTop: 14 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, minHeight: 36 },
  headerSpacer: { width: 28 },
  backButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  headerTitle: { color: '#302D55', fontSize: 21, fontWeight: '900' },
  headerSparkle: { color: '#FF77AB', fontSize: 25, width: 28 },
  roomCard: { alignSelf: 'center', height: 292, maxWidth: 390, overflow: 'hidden', position: 'relative', width: '100%' },
  roomBackground: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  growthBubble: { backgroundColor: '#FFFDFC', borderColor: '#4C4578', borderRadius: 12, borderWidth: 2, left: '32%', paddingHorizontal: 18, paddingVertical: 10, position: 'absolute', top: 83, zIndex: 2 },
  growthBubbleText: { color: '#302D55', fontSize: 14, fontWeight: '900' },
  growthCharacter: { bottom: 8, left: '30%', position: 'absolute' },
  stageSummaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  stageSummary: { color: '#302D55', fontSize: 17, fontWeight: '900' },
  pointPill: { backgroundColor: '#FFF0F6', borderColor: '#FFB5D1', borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 },
  pointPillText: { color: '#F0649C', fontSize: 15, fontWeight: '900' },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  expLabel: { color: '#302D55', fontSize: 12, fontWeight: '900' },
  expValue: { color: '#302D55', fontSize: 12, fontWeight: '700' },
  nextStageCard: { alignItems: 'center', backgroundColor: '#FFFCFA', borderColor: '#F4BDD7', borderRadius: 17, borderWidth: 1, flexDirection: 'row', marginTop: 14, minHeight: 68, paddingHorizontal: 12 },
  nextStageCopy: { flex: 1, marginLeft: 10 },
  nextStageTitle: { color: '#302D55', fontSize: 12, fontWeight: '900' },
  nextStageText: { color: '#4F486C', fontSize: 12, marginTop: 4 },
  chevron: { color: '#EF6D9F', fontSize: 23, fontWeight: '700' },
  sectionTitle: { color: '#302D55', fontSize: 16, fontWeight: '900', marginTop: 18 },
  stageGrid: { flexDirection: 'row', gap: 5, marginTop: 10 },
  stageCard: { alignItems: 'center', backgroundColor: '#FFFCFA', borderColor: '#EADFE7', borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 102, paddingHorizontal: 2, paddingVertical: 7 },
  stageCardCurrent: { backgroundColor: '#FFF1F7', borderColor: '#FF6FA7', borderWidth: 1.5 },
  stageName: { color: '#302D55', fontSize: 11, fontWeight: '800' },
  stageStatus: { color: '#A095AD', fontSize: 10, marginTop: 3 },
  stageStatusCurrent: { color: '#F0649C', fontWeight: '800' },
  attendanceBanner: { alignItems: 'center', backgroundColor: '#F1E5FF', borderColor: '#E1C8FA', borderRadius: 18, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, minHeight: 82, paddingHorizontal: 14 },
  attendanceBannerTitle: { color: '#302D55', fontSize: 15, fontWeight: '900' },
  attendanceBannerText: { color: '#4F486C', fontSize: 11, marginTop: 7 },
  attendanceBannerRight: { alignItems: 'flex-end', gap: 7 },
  attendanceDone: { color: '#F0649C', fontSize: 10, fontWeight: '800' },
  pointsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  pointsLabel: { color: '#302D55', fontSize: 14, fontWeight: '900' },
  streakCard: { alignItems: 'center', backgroundColor: '#F1E5FF', borderColor: '#E4C5FA', borderRadius: 18, borderWidth: 1, flexDirection: 'row', minHeight: 124, padding: 14 },
  streakCharacter: { backgroundColor: '#FFFCFA', height: 82, width: 82 },
  streakCopy: { flex: 1, marginLeft: 13, minWidth: 0 },
  streakTitle: { color: '#302D55', fontSize: 20, fontWeight: '900' },
  streakText: { color: '#75698A', fontSize: 11, lineHeight: 16, marginTop: 6 },
  streakDone: { color: '#F0649C', fontSize: 11, fontWeight: '800', marginTop: 7 },
  rewardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rewardProgress: { color: '#F0649C', fontSize: 12, fontWeight: '900', marginTop: 18 },
  rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  rewardDayCard: { alignItems: 'center', backgroundColor: '#FFFCFA', borderColor: '#EADFE7', borderRadius: 14, borderWidth: 1, flexBasis: '23%', minHeight: 106, paddingVertical: 10 },
  rewardDayCardCurrent: { backgroundColor: '#FFF2F7', borderColor: '#FF6FA7', borderWidth: 1.5 },
  rewardDay: { color: '#302D55', fontSize: 11, fontWeight: '800' },
  rewardCurrentText: { color: '#F0649C' },
  rewardCoin: { alignItems: 'center', backgroundColor: '#EDE2F9', borderRadius: 20, height: 38, justifyContent: 'center', marginVertical: 8, width: 38 },
  rewardCoinCompleted: { backgroundColor: '#FFE49B' },
  rewardCoinText: { color: '#F0649C', fontSize: 21, fontWeight: '900' },
  rewardPoints: { color: '#302D55', fontSize: 12, fontWeight: '900' },
  rewardSummaryCard: { backgroundColor: '#FFFCFA', borderColor: '#F4BDD7', borderRadius: 18, borderWidth: 1, gap: 16, marginTop: 16, padding: 15 },
  rewardSummaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rewardSummaryLabel: { color: '#4F486C', flex: 1, fontSize: 12, fontWeight: '700', paddingRight: 10 },
  rewardSummaryStrong: { color: '#F0649C', fontSize: 16, fontWeight: '900' },
  rewardSummaryValue: { color: '#302D55', fontSize: 13, fontWeight: '900' },
  attendanceCompleteButton: { alignItems: 'center', backgroundColor: '#FFF4E5', borderColor: '#F0DFC1', borderRadius: 14, borderWidth: 1, marginTop: 16, paddingVertical: 11 },
  attendanceCompleteTitle: { color: '#302D55', fontSize: 14, fontWeight: '900' },
  attendanceCompleteCaption: { color: '#A095AD', fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.75 },
});
