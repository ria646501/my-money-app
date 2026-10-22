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
  SATISFACTIONS,
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
    () => getCategorySatisfactionRanking(monthlyRecords, monthlyRecords.length),
    [monthlyRecords]
  );
  const spendingSatisfactionPatterns = useMemo(
    () =>
      SATISFACTIONS.map((satisfaction) => {
        const matchingRecords = monthlyRecords.filter(
          (record) => record.satisfaction === satisfaction
        );
        const totalAmount = getMonthlyTotal(matchingRecords);

        return {
          averageAmount:
            matchingRecords.length > 0 ? Math.round(totalAmount / matchingRecords.length) : 0,
          count: matchingRecords.length,
          satisfaction,
          totalAmount,
        };
      }).filter((item) => item.count > 0),
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

        <View style={styles.satisfactionHero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>이번 달 소비 만족도</Text>
            {topDailySatisfaction ? (
              <>
                <Text style={styles.heroTitle}>
                  {SATISFACTION_LABELS[topDailySatisfaction.satisfaction]}
                </Text>
                <Text style={styles.heroCaption}>
                  {SATISFACTION_REVIEW_TEXT[topDailySatisfaction.satisfaction]}
                </Text>
                <Text style={styles.heroCount}>{dailySatisfactionDayCount}일의 하루 회고</Text>
              </>
            ) : (
              <>
                <Text style={styles.heroTitle}>아직 기록을 기다리고 있어요</Text>
                <Text style={styles.heroCaption}>하루 소비 만족도를 남기면 이달의 흐름을 보여드려요.</Text>
              </>
            )}
          </View>
          {topDailySatisfaction ? (
            <View style={styles.heroIcon}>
              <SatisfactionIconImage
                satisfaction={topDailySatisfaction.satisfaction}
                size={76}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>하루 만족도 분포 ✧</Text>
          {dailySatisfactionBreakdown.length === 0 ? (
            <View style={styles.compactEmptyState}>
              <Text style={styles.emptyText}>하루 소비 만족도를 기록하면 분포를 볼 수 있어요.</Text>
            </View>
          ) : (
            <View style={styles.horizontalChart}>
              {dailySatisfactionBreakdown.map((item) => (
                <View key={item.satisfaction} style={styles.horizontalRow}>
                  <SatisfactionIconImage satisfaction={item.satisfaction} size={30} />
                  <View style={styles.horizontalBarCopy}>
                    <View style={styles.horizontalLabelRow}>
                      <Text style={styles.horizontalLabel}>
                        {SATISFACTION_LABELS[item.satisfaction]}
                      </Text>
                      <Text style={styles.horizontalValue}>{item.count}일 · {item.percentage}%</Text>
                    </View>
                    <View style={styles.horizontalTrack}>
                      <View
                        style={[
                          styles.horizontalFill,
                          {
                            backgroundColor: SATISFACTION_COLORS[item.satisfaction],
                            width: `${item.percentage}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>카테고리별 평균 개별 소비 만족도 ✧</Text>
          {categorySatisfactionRanking.length === 0 ? (
            <View style={styles.compactEmptyState}>
              <Text style={styles.emptyText}>개별 소비 만족도를 기록하면 비교할 수 있어요.</Text>
            </View>
          ) : (
            <View style={styles.categoryAverageList}>
              {categorySatisfactionRanking.map((item) => (
                <View key={item.categoryId} style={styles.categoryAverageRow}>
                  <View style={styles.categoryAverageHeader}>
                    <View style={styles.categoryAverageIdentity}>
                      <CategoryIconImage icon={item.categoryIcon} size={30} />
                      <Text numberOfLines={1} style={styles.categoryAverageName}>
                        {item.categoryName}
                      </Text>
                    </View>
                    <Text style={styles.categoryAverageScore}>
                      {item.averageSatisfaction.toFixed(1)} / 5
                    </Text>
                  </View>
                  <View style={styles.categoryAverageTrack}>
                    <View
                      style={[
                        styles.categoryAverageFill,
                        { width: `${(item.averageSatisfaction / 5) * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.categoryAverageMeta}>
                    {item.recordCount}건 · {item.totalAmount.toLocaleString('ko-KR')}원
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>금액 × 개별 소비 만족도 ✧</Text>
          <Text style={styles.sectionDescription}>각 만족도로 기록한 소비의 평균 금액을 함께 보여드려요.</Text>
          {spendingSatisfactionPatterns.length === 0 ? (
            <View style={styles.compactEmptyState}>
              <Text style={styles.emptyText}>이번 달 소비 기록이 아직 없어요.</Text>
            </View>
          ) : (
            <View style={styles.patternList}>
              {spendingSatisfactionPatterns.map((item) => (
                <View key={item.satisfaction} style={styles.patternRow}>
                  <SatisfactionIconImage satisfaction={item.satisfaction} size={34} />
                  <View style={styles.patternCopy}>
                    <Text style={styles.patternLabel}>{SATISFACTION_LABELS[item.satisfaction]}</Text>
                    <Text style={styles.patternMeta}>{item.count}건 · 합계 {item.totalAmount.toLocaleString('ko-KR')}원</Text>
                  </View>
                  <View style={styles.patternAmountCopy}>
                    <Text style={styles.patternAmount}>{item.averageAmount.toLocaleString('ko-KR')}원</Text>
                    <Text style={styles.patternAmountLabel}>건당 평균</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>카테고리별 소비 금액 ✧</Text>
          {categoryBreakdown.length === 0 ? (
            <View style={styles.compactEmptyState}>
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
                  <View key={item.categoryId} style={[styles.legendRow, index === 0 && styles.legendRowTop]}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: item.isAggregated ? '#B8B2C5' : getStableCategoryColor(item.categoryId) },
                      ]}
                    />
                    <Text numberOfLines={1} style={[styles.legendName, index === 0 && styles.legendNameTop]}>
                      {item.categoryName}
                    </Text>
                    <Text style={styles.legendPercentage}>{item.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.totalSummaryCard}>
          <View style={styles.totalSummaryCopy}>
            <Text style={styles.summaryLabel}>이번 달 총 소비 금액</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.totalSummaryAmount}>
              {monthlyTotal.toLocaleString('ko-KR')}원
            </Text>
            <Text style={styles.comparisonText}>{comparisonText}</Text>
          </View>
          <CharacterVisual maxSize={66} stageId={currentCharacterStage.id} />
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
  legendName: { color: BrandColors.text, flex: 1, fontSize: 12, fontWeight: '700' },
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
  satisfactionHero: {
    alignItems: 'center',
    backgroundColor: '#FFF0F7',
    borderColor: '#F4BDD7',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 158,
    overflow: 'hidden',
    padding: 18,
  },
  heroCopy: { flex: 1, paddingRight: 8 },
  heroEyebrow: { color: '#A46C84', fontSize: 12, fontWeight: '900' },
  heroTitle: { color: '#302D55', fontSize: 21, fontWeight: '900', marginTop: 8 },
  heroCaption: { color: '#756A80', fontSize: 11, lineHeight: 17, marginTop: 6 },
  heroCount: { color: '#F0649C', fontSize: 11, fontWeight: '800', marginTop: 8 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#F7D6E4',
    borderRadius: 48,
    borderWidth: 1,
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  sectionCard: {
    backgroundColor: '#FFFCFA',
    borderColor: '#EADFE7',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  sectionDescription: { color: '#8D8198', fontSize: 11, lineHeight: 16, marginBottom: 10, marginTop: -5 },
  compactEmptyState: {
    alignItems: 'center',
    backgroundColor: '#FFF8F4',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 82,
    paddingHorizontal: 12,
  },
  horizontalChart: { gap: 12 },
  horizontalRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  horizontalBarCopy: { flex: 1 },
  horizontalLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  horizontalLabel: { color: '#4E4665', flex: 1, fontSize: 11, fontWeight: '800' },
  horizontalValue: { color: '#8E8299', fontSize: 10, fontWeight: '700', marginLeft: 8 },
  horizontalTrack: { backgroundColor: '#F1EAF3', borderRadius: 5, height: 8, marginTop: 5, overflow: 'hidden' },
  horizontalFill: { borderRadius: 5, height: '100%' },
  categoryAverageList: { gap: 15 },
  categoryAverageRow: { borderBottomColor: '#F1E7EC', borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  categoryAverageHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryAverageIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, minWidth: 0 },
  categoryAverageName: { color: '#413958', flex: 1, fontSize: 13, fontWeight: '800' },
  categoryAverageScore: { color: '#F0649C', fontSize: 13, fontWeight: '900', marginLeft: 8 },
  categoryAverageTrack: { backgroundColor: '#F0E8F3', borderRadius: 5, height: 8, marginTop: 7, overflow: 'hidden' },
  categoryAverageFill: { backgroundColor: '#C49BEC', borderRadius: 5, height: '100%' },
  categoryAverageMeta: { color: '#94899E', fontSize: 10, marginTop: 5 },
  patternList: { gap: 4 },
  patternRow: { alignItems: 'center', borderBottomColor: '#F1E7EC', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 62 },
  patternCopy: { flex: 1, marginLeft: 9, minWidth: 0 },
  patternLabel: { color: '#4A425E', fontSize: 12, fontWeight: '800' },
  patternMeta: { color: '#978B9F', fontSize: 9, marginTop: 4 },
  patternAmountCopy: { alignItems: 'flex-end', marginLeft: 8 },
  patternAmount: { color: '#6E5B89', fontSize: 12, fontWeight: '900' },
  patternAmountLabel: { color: '#A095A8', fontSize: 9, marginTop: 3 },
  totalSummaryCard: {
    alignItems: 'center',
    backgroundColor: '#EDE1FF',
    borderColor: '#D7BDFB',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 94,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  totalSummaryCopy: { flex: 1 },
  totalSummaryAmount: { color: '#302D55', fontSize: 23, fontWeight: '900', marginTop: 4, maxWidth: 230 },
});
