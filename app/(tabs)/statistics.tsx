import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import { BrandColors } from '@/constants/theme';
import { CategoryIconImage } from '@/components/category-icon-image';
import { CharacterVisual } from '@/components/character-visual';
import { SatisfactionIconImage } from '@/components/satisfaction-icon-image';
import {
  DAILY_SATISFACTIONS_STORAGE_KEY,
  DailySatisfactions,
  ExpenseRecord,
  migrateExpenseRecord,
  RECORDS_STORAGE_KEY,
  Satisfaction,
  StoredExpenseRecord,
} from '@/lib/expense-record';
import {
  getCategoryBreakdown,
  getCategorySatisfactionRanking,
  getMonthChange,
  getMonthlyDailySatisfactionBreakdown,
  getMonthlyExpenses,
  getMonthlyTotal,
  getPreviousMonth,
} from '@/lib/statistics';
import { createInitialGrowthState, getCharacterStage, GrowthState } from '@/lib/growth';
import { loadGrowthState } from '@/lib/growth-storage';

const DONUT_COLORS = [
  '#A98BEF',
  '#EF82B6',
  '#F6C85F',
  '#6DCFC1',
  '#8FC7F4',
  '#C493E8',
  '#F2B479',
  '#89B86C',
] as const;
const SATISFACTION_COLORS: Record<Satisfaction, string> = {
  '😫': DONUT_COLORS[4],
  '😕': DONUT_COLORS[5],
  '😐': DONUT_COLORS[2],
  '🙂': DONUT_COLORS[6],
  '😍': DONUT_COLORS[1],
};
const SATISFACTION_LABELS: Record<Satisfaction, string> = {
  '😫': '많이 아쉬웠어요',
  '😕': '조금 아쉬웠어요',
  '😐': '괜찮았어요',
  '🙂': '만족스러웠어요',
  '😍': '정말 좋았어요',
};
const SATISFACTION_REVIEW_TEXT: Record<Satisfaction, string> = {
  '😫': '이번 달에는 많이 아쉬웠던 날이 가장 많았어요',
  '😕': '이번 달에는 아쉬웠던 날이 가장 많았어요',
  '😐': '이번 달에는 보통으로 느낀 날이 가장 많았어요',
  '🙂': '이번 달에는 괜찮았던 날이 가장 많았어요',
  '😍': '이번 달에는 만족스러웠던 날이 가장 많았어요',
};
const DONUT_SEGMENTS = 144;

function getStableCategoryColor(categoryId: string) {
  let hash = 0;

  for (const character of categoryId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return DONUT_COLORS[hash % DONUT_COLORS.length];
}

type DonutSegment = { color: string; key: string; percentage: number };

function getSegmentColors(segments: DonutSegment[]) {
  let cumulativePercentage = 0;
  const ranges = segments.map((item) => {
    cumulativePercentage += item.percentage;
    return {
      color: item.color,
      endPercentage: cumulativePercentage,
    };
  });

  return Array.from({ length: DONUT_SEGMENTS }, (_, index) => {
    const segmentPercentage = ((index + 0.5) / DONUT_SEGMENTS) * 100;
    return ranges.find((range) => segmentPercentage <= range.endPercentage)?.color ?? '#E9E4F3';
  });
}

function DonutChart({
  accessibilityLabel,
  centerLabel,
  centerValue,
  segments,
}: {
  accessibilityLabel: string;
  centerLabel: string;
  centerValue: string;
  segments: DonutSegment[];
}) {
  const segmentColors = useMemo(() => getSegmentColors(segments), [segments]);

  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.donut}>
      {segmentColors.map((color, index) => (
        <View
          key={`${index}-${color}`}
          pointerEvents="none"
          style={[
            styles.donutSegmentTrack,
            { transform: [{ rotate: `${(360 / DONUT_SEGMENTS) * index}deg` }] },
          ]}>
          <View style={[styles.donutSegment, { backgroundColor: color }]} />
        </View>
      ))}
      <View style={styles.donutCenter}>
        <Text style={styles.donutCenterLabel}>{centerLabel}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.donutCenterAmount}>
          {centerValue}
        </Text>
      </View>
    </View>
  );
}

export default function StatisticsScreen() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});
  const [growthState, setGrowthState] = useState<GrowthState>(() => createInitialGrowthState());
  const [records, setRecords] = useState<ExpenseRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const today = new Date();

      setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));

      void loadGrowthState()
        .then((state) => {
          if (isActive) {
            setGrowthState(state);
          }
        })
        .catch((error) => {
          console.error('통계 캐릭터 성장 상태를 불러오지 못했습니다.', error);
        });

      const loadStatisticsData = async () => {
        try {
          const [savedRecords, savedDailySatisfactions] = await Promise.all([
            AsyncStorage.getItem(RECORDS_STORAGE_KEY),
            AsyncStorage.getItem(DAILY_SATISFACTIONS_STORAGE_KEY),
          ]);

          if (!isActive) {
            return;
          }

          if (savedRecords === null) {
            setRecords([]);
          } else {
            const parsedRecords: unknown = JSON.parse(savedRecords);

            if (Array.isArray(parsedRecords)) {
              const storedRecords = parsedRecords as StoredExpenseRecord[];
              const needsMigration = storedRecords.some(
                (record) =>
                  !record.occurredAt ||
                  !record.localDate ||
                  !record.timeZone ||
                  !record.categoryId ||
                  !record.categoryIcon
              );
              const migratedRecords = storedRecords.map(migrateExpenseRecord);
              setRecords(migratedRecords);

              if (needsMigration) {
                try {
                  await AsyncStorage.setItem(
                    RECORDS_STORAGE_KEY,
                    JSON.stringify(migratedRecords)
                  );
                } catch (migrationError) {
                  console.error('통계에서 보완한 소비 기록을 저장하지 못했습니다.', migrationError);
                }
              }
            } else {
              console.error('저장된 소비 기록이 배열 형태가 아닙니다.');
              setRecords([]);
            }
          }

          if (savedDailySatisfactions === null) {
            setDailySatisfactions({});
          } else {
            const parsedDailySatisfactions: unknown = JSON.parse(savedDailySatisfactions);

            if (
              typeof parsedDailySatisfactions === 'object' &&
              parsedDailySatisfactions !== null &&
              !Array.isArray(parsedDailySatisfactions)
            ) {
              setDailySatisfactions(parsedDailySatisfactions as DailySatisfactions);
            } else {
              console.error('저장된 하루 소비 만족도가 객체 형태가 아닙니다.');
              setDailySatisfactions({});
            }
          }

        } catch (error) {
          console.error('월간 통계 데이터를 불러오지 못했습니다.', error);
        }
      };

      void loadStatisticsData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const previousMonth = getPreviousMonth(year, monthIndex);
  const monthlyRecords = useMemo(
    () => getMonthlyExpenses(records, year, monthIndex),
    [monthIndex, records, year]
  );
  const previousMonthlyRecords = useMemo(
    () => getMonthlyExpenses(records, previousMonth.year, previousMonth.monthIndex),
    [previousMonth.monthIndex, previousMonth.year, records]
  );
  const monthlyTotal = getMonthlyTotal(monthlyRecords);
  const previousMonthTotal = getMonthlyTotal(previousMonthlyRecords);
  const monthChange = getMonthChange(monthlyTotal, previousMonthTotal);
  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(monthlyRecords),
    [monthlyRecords]
  );
  const dailySatisfactionBreakdown = useMemo(
    () => getMonthlyDailySatisfactionBreakdown(dailySatisfactions, year, monthIndex),
    [dailySatisfactions, monthIndex, year]
  );
  const dailySatisfactionDayCount = dailySatisfactionBreakdown.reduce(
    (total, item) => total + item.count,
    0
  );
  const topDailySatisfaction = dailySatisfactionBreakdown[0] ?? null;
  const currentCharacterStage = getCharacterStage(growthState.totalExp);
  const categorySatisfactionRanking = useMemo(
    () => getCategorySatisfactionRanking(monthlyRecords),
    [monthlyRecords]
  );
  const categoryDonutSegments = useMemo<DonutSegment[]>(
    () =>
      categoryBreakdown.map((item) => ({
        color: item.isAggregated ? '#B8B2C5' : getStableCategoryColor(item.categoryId),
        key: item.categoryId,
        percentage: item.percentage,
      })),
    [categoryBreakdown]
  );
  const dailySatisfactionDonutSegments = useMemo<DonutSegment[]>(
    () =>
      dailySatisfactionBreakdown.map((item) => ({
        color: SATISFACTION_COLORS[item.satisfaction],
        key: item.satisfaction,
        percentage: item.percentage,
      })),
    [dailySatisfactionBreakdown]
  );

  const moveMonth = (amount: number) => {
    setVisibleMonth((currentMonth) =>
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1)
    );
  };

  const comparisonText = monthChange
    ? monthChange.percentage === 0
      ? '지난달과 같은 금액'
      : `지난달보다 ${Math.abs(monthChange.percentage).toFixed(1)}% ${monthChange.percentage > 0 ? '↑' : '↓'}`
    : '지난달 비교 데이터 없음';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.screenHeader}>
          <Text style={styles.headerSparkle}>✧</Text>
          <Text style={styles.screenTitle}>통계</Text>
          <Text style={styles.headerSparklePink}>✦</Text>
        </View>

        <Text style={styles.eyebrow}>월간 소비 통계</Text>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel="이전 달" onPress={() => moveMonth(-1)} style={styles.monthButton}>
            <MaterialCommunityIcons color={BrandColors.text} name="chevron-left" size={27} />
          </Pressable>
          <Text style={styles.monthTitle}>{year}년 {monthIndex + 1}월</Text>
          <Pressable accessibilityLabel="다음 달" onPress={() => moveMonth(1)} style={styles.monthButton}>
            <MaterialCommunityIcons color={BrandColors.text} name="chevron-right" size={27} />
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryLabel}>총 소비 금액</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryAmount}>
              {monthlyTotal.toLocaleString('ko-KR')}원
            </Text>
            <Text style={styles.comparisonText}>{comparisonText}</Text>
          </View>
          <View style={styles.characterSlot}>
            <View style={styles.summarySpeechBubble}>
              <Text numberOfLines={1} style={styles.summarySpeechText}>이번 달도 기록했네!</Text>
            </View>
            <CharacterVisual
              maxSize={94}
              stageId={currentCharacterStage.id}
              style={styles.characterImage}
            />
          </View>
        </View>

        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>이번 달엔 어디에 가장 많이 썼을까? ✧</Text>
          {categoryBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아직 이번 달 소비 기록이 없어요.</Text>
            </View>
          ) : (
            <View style={styles.breakdownContent}>
              <DonutChart
                accessibilityLabel={`이번 달 총 소비 ${monthlyTotal.toLocaleString('ko-KR')}원`}
                centerLabel="총"
                centerValue={`${monthlyTotal.toLocaleString('ko-KR')}원`}
                segments={categoryDonutSegments}
              />
              <View style={styles.legend}>
                {categoryBreakdown.map((item, index) => (
                  <View
                    key={item.categoryId}
                    style={[styles.legendRow, index === 0 && styles.legendRowTop]}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor: item.isAggregated
                            ? '#B8B2C5'
                            : getStableCategoryColor(item.categoryId),
                        },
                      ]}
                    />
                    <View style={styles.legendCopy}>
                      <Text
                        numberOfLines={1}
                        style={[styles.legendName, index === 0 && styles.legendNameTop]}>
                        {item.categoryName}
                      </Text>
                    </View>
                    <Text style={styles.legendPercentage}>{item.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.sectionTitle}>이달의 소비 만족도는? ✧</Text>
          {dailySatisfactionBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>하루 소비 만족도를 기록하면 함께 돌아볼 수 있어요.</Text>
            </View>
          ) : (
            <View style={styles.chartWithSummary}>
              <View style={styles.breakdownContent}>
                <DonutChart
                  accessibilityLabel={`이번 달 하루 소비 만족도 ${dailySatisfactionDayCount}일`}
                  centerLabel="회고"
                  centerValue={`${dailySatisfactionDayCount}일`}
                  segments={dailySatisfactionDonutSegments}
                />
                <View style={styles.legend}>
                  {dailySatisfactionBreakdown.map((item, index) => (
                    <View
                      key={item.satisfaction}
                      style={[styles.legendRow, index === 0 && styles.legendRowTop]}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: SATISFACTION_COLORS[item.satisfaction] },
                        ]}
                      />
                      <View style={styles.legendCopy}>
                        <Text
                          numberOfLines={1}
                          style={[styles.legendName, index === 0 && styles.legendNameTop]}>
                          {SATISFACTION_LABELS[item.satisfaction]}
                        </Text>
                      </View>
                      <Text style={styles.legendPercentage}>
                        {item.count}일 · {item.percentage}%
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {topDailySatisfaction ? (
                <View style={styles.satisfactionSummary}>
                  <SatisfactionIconImage
                    satisfaction={topDailySatisfaction.satisfaction}
                    size={24}
                  />
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    numberOfLines={1}
                    style={styles.satisfactionSummaryText}>
                    {SATISFACTION_REVIEW_TEXT[topDailySatisfaction.satisfaction]}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.insightSection}>
          <Text style={styles.sectionTitle}>어떤 소비가 가장 만족스러웠을까? ✧</Text>
          {categorySatisfactionRanking.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아직 이번 달 소비 기록이 없어요.</Text>
            </View>
          ) : (
            <View style={styles.rankingCard}>
              {categorySatisfactionRanking.map((item, index) => (
                <View key={item.categoryId} style={styles.rankingRow}>
                  <Text style={styles.rankingNumber}>{index + 1}</Text>
                  <View style={styles.rankingIcon}>
                    <CategoryIconImage icon={item.categoryIcon} size={32} />
                  </View>
                  <Text numberOfLines={1} style={styles.rankingName}>{item.categoryName}</Text>
                  <View style={styles.rankingMetrics}>
                    <Text style={styles.rankingScore}>{item.averageSatisfaction.toFixed(1)}/5</Text>
                    <Text style={styles.rankingCount}>{item.recordCount}건</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFF9EF', flex: 1 },
  content: { gap: 13, paddingBottom: 32, paddingHorizontal: 20, paddingTop: 14 },
  screenHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  screenTitle: { color: '#302D55', fontSize: 22, fontWeight: '900' },
  headerSparkle: { color: '#302D55', fontSize: 26 },
  headerSparklePink: { color: '#FF7BAE', fontSize: 25 },
  eyebrow: { color: '#302D55', fontSize: 13, fontWeight: '800' },
  monthHeader: {
    alignItems: 'center',
    backgroundColor: '#FFFCFA',
    borderColor: '#EADFE7',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    height: 45,
    justifyContent: 'space-between',
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthTitle: { color: '#302D55', fontSize: 19, fontWeight: '900' },
  summaryCard: {
    backgroundColor: '#EDE1FF',
    borderColor: '#D7BDFB',
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 132,
    overflow: 'hidden',
    padding: 14,
  },
  summaryCopy: { flex: 1, maxWidth: '66%', zIndex: 2 },
  summaryLabel: { color: '#4C456D', fontSize: 12, fontWeight: '800' },
  summaryAmount: {
    color: '#302D55',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 7,
    maxWidth: 220,
  },
  comparisonText: { color: '#8D81A5', fontSize: 11, fontWeight: '700', marginTop: 6 },
  characterSlot: { bottom: 3, height: 116, position: 'absolute', right: 7, width: 116 },
  summarySpeechBubble: { alignItems: 'center', backgroundColor: '#FFFDFC', borderColor: '#8D7BB7', borderRadius: 9, borderWidth: 1, left: 0, paddingHorizontal: 6, paddingVertical: 4, position: 'absolute', top: 2, width: 104, zIndex: 2 },
  summarySpeechText: { color: '#403865', fontSize: 9, fontWeight: '800' },
  characterImage: { bottom: -2, position: 'absolute', right: 1 },
  chartSection: { paddingVertical: 2 },
  sectionTitle: { color: '#302D55', fontSize: 16, fontWeight: '900', marginBottom: 12 },
  emptyState: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 128,
  },
  emptyText: { color: BrandColors.textMuted, fontSize: 14, fontWeight: '600' },
  breakdownContent: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  chartWithSummary: { gap: 8 },
  donut: { height: 142, position: 'relative', width: 142 },
  donutSegmentTrack: { height: 142, left: 0, position: 'absolute', top: 0, width: 142 },
  donutSegment: { borderRadius: 2, height: 18, left: 69, position: 'absolute', top: 1, width: 4 },
  donutCenter: {
    alignItems: 'center',
    backgroundColor: BrandColors.surface,
    borderRadius: 46,
    height: 92,
    justifyContent: 'center',
    left: 25,
    position: 'absolute',
    top: 25,
    width: 92,
  },
  donutCenterLabel: { color: BrandColors.textMuted, fontSize: 11, fontWeight: '700' },
  donutCenterAmount: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
    maxWidth: 88,
  },
  legend: { flex: 1, gap: 5 },
  legendRow: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 38,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  legendRowTop: { backgroundColor: '#FFF0F7', borderColor: '#F4BDD7' },
  legendDot: { borderRadius: 5, height: 10, marginRight: 7, width: 10 },
  legendCopy: { flex: 1 },
  legendName: { color: BrandColors.text, fontSize: 12, fontWeight: '700' },
  legendNameTop: { color: '#D94E87', fontWeight: '900' },
  legendPercentage: { color: BrandColors.textMuted, fontSize: 12, fontWeight: '800', marginLeft: 5 },
  insightSection: { paddingTop: 2 },
  satisfactionSummary: {
    alignItems: 'center',
    backgroundColor: '#FFF0F7',
    borderColor: '#F4BDD7',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  satisfactionSummaryText: { color: '#A46C84', flex: 1, fontSize: 11, fontWeight: '800' },
  rankingCard: { backgroundColor: '#FFFCFA', borderColor: '#F4BDD7', borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 13 },
  rankingRow: { alignItems: 'center', borderBottomColor: '#F2E5EA', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 66 },
  rankingNumber: { color: '#F0649C', fontSize: 17, fontWeight: '900', textAlign: 'center', width: 25 },
  rankingIcon: { alignItems: 'center', backgroundColor: '#F5ECFF', borderRadius: 19, height: 38, justifyContent: 'center', marginHorizontal: 8, width: 38 },
  rankingName: { color: '#302D55', flex: 1, fontSize: 14, fontWeight: '800' },
  rankingMetrics: { alignItems: 'flex-end', marginLeft: 8 },
  rankingScore: { color: '#F0649C', fontSize: 14, fontWeight: '900' },
  rankingCount: { color: '#93889F', fontSize: 11, marginTop: 3 },
});
