import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMemo } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CharacterVisual } from '@/components/character-visual';
import { getLocalDateKey } from '@/lib/expense-record';
import { GROWTH_CONFIG, getCharacterStage, GrowthState } from '@/lib/growth';

type AttendanceRewardModalProps = {
  growthState: GrowthState;
  onClose: () => void;
  visible: boolean;
};

/** 어느 화면에서 열어도, 닫으면 원래 화면에 남는 출석 보상 팝업. */
export function AttendanceRewardModal({ growthState, onClose, visible }: AttendanceRewardModalProps) {
  const todayKey = getLocalDateKey(new Date());
  const todayEntry = growthState.attendanceHistory[todayKey];
  const attendanceCount = Object.keys(growthState.attendanceHistory).length;
  const nextCycleDay = (attendanceCount % 7) + 1;
  const activeCycleDay = todayEntry?.cycleDay ?? nextCycleDay;
  const todayPoints = todayEntry?.points ?? GROWTH_CONFIG.attendancePointCycle[activeCycleDay - 1];
  const completedCountInCurrentCycle = todayEntry
    ? todayEntry.cycleDay
    : nextCycleDay === 1 ? 0 : nextCycleDay - 1;
  const nextRewardDay = activeCycleDay === 7 ? 1 : activeCycleDay + 1;
  const nextRewardPoints = GROWTH_CONFIG.attendancePointCycle[nextRewardDay - 1];
  const completedDays = useMemo(() => {
    const entries = Object.entries(growthState.attendanceHistory)
      .sort(([firstDate], [secondDate]) => secondDate.localeCompare(firstDate))
      .slice(0, completedCountInCurrentCycle);
    return new Set(entries.map(([, entry]) => entry.cycleDay));
  }, [completedCountInCurrentCycle, growthState.attendanceHistory]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>출석 보상</Text>
            <Pressable accessibilityLabel="출석 보상 팝업 닫기" hitSlop={8} onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color="#302D55" name="close" size={23} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.pointsRow}>
              <Text style={styles.pointsLabel}>내가 모은 Point</Text>
              <View style={styles.pointPill}><Text style={styles.pointPillText}>{growthState.totalPoints} P</Text></View>
            </View>
            <View style={styles.streakCard}>
              <CharacterVisual maxSize={82} stageId={getCharacterStage(growthState.totalExp).id} style={styles.streakCharacter} />
              <View style={styles.streakCopy}>
                <Text style={styles.streakTitle}>{growthState.currentStreak > 0 ? `${growthState.currentStreak}일 연속 출석!` : '첫 출석을 기다리고 있어!'}</Text>
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
                return <View key={day} style={[styles.rewardDayCard, isCurrent && styles.rewardDayCardCurrent]}>
                  <Text style={[styles.rewardDay, isCurrent && styles.rewardCurrentText]}>Day {day}</Text>
                  <View style={[styles.rewardCoin, isCompleted && styles.rewardCoinCompleted]}><Text style={styles.rewardCoinText}>{isCompleted ? '✓' : 'P'}</Text></View>
                  <Text style={styles.rewardPoints}>{points}P</Text>
                </View>;
              })}
            </View>
            <View style={styles.rewardSummaryCard}>
              <Summary label={`오늘 받은 보상 · Day ${activeCycleDay}`} value={todayEntry ? `${todayPoints}P ✓` : '-'} emphasized />
              <Summary label={`다음 보상 · Day ${nextRewardDay}`} value={`${nextRewardPoints}P`} />
              <Summary label="7일 출석 완료 보상" value={`+${GROWTH_CONFIG.attendanceMilestones[7].points}P`} emphasized />
            </View>
            <View style={styles.attendanceComplete}><Text style={styles.attendanceCompleteTitle}>{todayEntry ? '오늘 출석 완료 ✓' : '출석 확인 중'}</Text><Text style={styles.attendanceCompleteCaption}>{todayEntry ? '자동 처리 완료' : '앱 방문 시 자동으로 처리돼요'}</Text></View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function Summary({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return <View style={styles.rewardSummaryRow}><Text style={styles.rewardSummaryLabel}>{label}</Text><Text style={emphasized ? styles.rewardSummaryStrong : styles.rewardSummaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(48, 36, 61, 0.42)', flex: 1, justifyContent: 'flex-end' },
  sheet: { alignSelf: 'center', backgroundColor: '#FFF9EF', borderTopLeftRadius: 26, borderTopRightRadius: 26, height: '88%', maxHeight: 780, maxWidth: 430, overflow: 'hidden', width: '100%' },
  handle: { alignSelf: 'center', backgroundColor: '#D8CDDB', borderRadius: 4, height: 5, marginTop: 10, width: 42 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: 18 },
  headerSpacer: { width: 38 }, headerTitle: { color: '#302D55', fontSize: 20, fontWeight: '900' }, closeButton: { alignItems: 'center', height: 38, justifyContent: 'center', width: 38 },
  content: { paddingBottom: 34, paddingHorizontal: 20 }, pointsRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }, pointsLabel: { color: '#302D55', fontSize: 14, fontWeight: '900' },
  pointPill: { backgroundColor: '#FFF0F6', borderColor: '#FFB5D1', borderRadius: 20, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 7 }, pointPillText: { color: '#F0649C', fontSize: 15, fontWeight: '900' },
  streakCard: { alignItems: 'center', backgroundColor: '#F1E5FF', borderColor: '#E4C5FA', borderRadius: 18, borderWidth: 1, flexDirection: 'row', minHeight: 124, padding: 14 }, streakCharacter: { backgroundColor: '#FFFCFA', height: 82, width: 82 }, streakCopy: { flex: 1, marginLeft: 13, minWidth: 0 }, streakTitle: { color: '#302D55', fontSize: 20, fontWeight: '900' }, streakText: { color: '#75698A', fontSize: 11, lineHeight: 16, marginTop: 6 }, streakDone: { color: '#F0649C', fontSize: 11, fontWeight: '800', marginTop: 7 },
  rewardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sectionTitle: { color: '#302D55', fontSize: 16, fontWeight: '900', marginTop: 18 }, rewardProgress: { color: '#F0649C', fontSize: 12, fontWeight: '900', marginTop: 18 }, rewardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, rewardDayCard: { alignItems: 'center', backgroundColor: '#FFFCFA', borderColor: '#EADFE7', borderRadius: 14, borderWidth: 1, flexBasis: '23%', minHeight: 106, paddingVertical: 10 }, rewardDayCardCurrent: { backgroundColor: '#FFF2F7', borderColor: '#FF6FA7', borderWidth: 1.5 }, rewardDay: { color: '#302D55', fontSize: 11, fontWeight: '800' }, rewardCurrentText: { color: '#F0649C' }, rewardCoin: { alignItems: 'center', backgroundColor: '#EDE2F9', borderRadius: 20, height: 38, justifyContent: 'center', marginVertical: 8, width: 38 }, rewardCoinCompleted: { backgroundColor: '#FFE49B' }, rewardCoinText: { color: '#F0649C', fontSize: 21, fontWeight: '900' }, rewardPoints: { color: '#302D55', fontSize: 12, fontWeight: '900' },
  rewardSummaryCard: { backgroundColor: '#FFFCFA', borderColor: '#F4BDD7', borderRadius: 18, borderWidth: 1, gap: 16, marginTop: 16, padding: 15 }, rewardSummaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, rewardSummaryLabel: { color: '#4F486C', flex: 1, fontSize: 12, fontWeight: '700', paddingRight: 10 }, rewardSummaryStrong: { color: '#F0649C', fontSize: 16, fontWeight: '900' }, rewardSummaryValue: { color: '#302D55', fontSize: 13, fontWeight: '900' }, attendanceComplete: { alignItems: 'center', backgroundColor: '#FFF4E5', borderColor: '#F0DFC1', borderRadius: 14, borderWidth: 1, marginTop: 16, paddingVertical: 11 }, attendanceCompleteTitle: { color: '#302D55', fontSize: 14, fontWeight: '900' }, attendanceCompleteCaption: { color: '#A095AD', fontSize: 11, marginTop: 3 },
});
