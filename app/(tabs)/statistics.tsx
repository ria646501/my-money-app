import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';

import { BrandColors } from '@/constants/theme';
import { SatisfactionIconImage } from '@/components/satisfaction-icon-image';
import {
  DAILY_SATISFACTIONS_STORAGE_KEY,
  DailySatisfactions,
  ExpenseRecord,
  getDateKey,
  migrateExpenseRecord,
  RECORDS_STORAGE_KEY,
  StoredExpenseRecord,
} from '@/lib/expense-record';
import {
  CategoryBreakdownItem,
  getCategoryBreakdown,
  getMonthChange,
  getMonthlyDailySatisfactions,
  getMonthlyExpenses,
  getMonthlyTotal,
  getPreviousMonth,
} from '@/lib/statistics';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CATEGORY_COLORS = [
  '#7C5CFC',
  '#F49C9C',
  '#F6C85F',
  '#6DCFC1',
  '#75A7F0',
  '#C493E8',
  '#F3A766',
  '#89B86C',
] as const;
const DONUT_SEGMENTS = 72;
const characterSource = require('@/assets/images/home-cat-placeholder.png');

function getStableCategoryColor(categoryId: string) {
  let hash = 0;

  for (const character of categoryId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }

  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

function getSegmentColors(breakdown: CategoryBreakdownItem[]) {
  let cumulativePercentage = 0;
  const ranges = breakdown.map((item) => {
    cumulativePercentage += item.percentage;
    return {
      color: item.isAggregated ? '#B8B2C5' : getStableCategoryColor(item.categoryId),
      endPercentage: cumulativePercentage,
    };
  });

  return Array.from({ length: DONUT_SEGMENTS }, (_, index) => {
    const segmentPercentage = ((index + 0.5) / DONUT_SEGMENTS) * 100;
    return ranges.find((range) => segmentPercentage <= range.endPercentage)?.color ?? '#E9E4F3';
  });
}

function DonutChart({ breakdown, total }: { breakdown: CategoryBreakdownItem[]; total: number }) {
  const segmentColors = useMemo(() => getSegmentColors(breakdown), [breakdown]);

  return (
    <View accessibilityLabel={`이번 달 총 소비 ${total.toLocaleString('ko-KR')}원`} style={styles.donut}>
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
        <Text style={styles.donutCenterLabel}>총</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.donutCenterAmount}>
          {total.toLocaleString('ko-KR')}원
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
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const today = new Date();

      setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));

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
            const parsedSatisfactions: unknown = JSON.parse(savedDailySatisfactions);

            if (
              typeof parsedSatisfactions === 'object' &&
              parsedSatisfactions !== null &&
              !Array.isArray(parsedSatisfactions)
            ) {
              setDailySatisfactions(parsedSatisfactions as DailySatisfactions);
            } else {
              console.error('저장된 하루 만족도가 날짜별 객체 형태가 아닙니다.');
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
  const monthlySatisfactions = useMemo(
    () => getMonthlyDailySatisfactions(dailySatisfactions, year, monthIndex),
    [dailySatisfactions, monthIndex, year]
  );
  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    });
  }, [monthIndex, year]);

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
            <View style={styles.speechBubble}>
              <Text style={styles.speechText}>이번 달 소비를{`\n`}같이 돌아볼까?</Text>
            </View>
          </View>
          <View style={styles.characterSlot}>
            <View style={styles.characterBackdrop} />
            <Image resizeMode="contain" source={characterSource} style={styles.characterImage} />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>카테고리별 비율</Text>
          {categoryBreakdown.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>아직 기록된 소비가 없어요.</Text>
            </View>
          ) : (
            <View style={styles.breakdownContent}>
              <DonutChart breakdown={categoryBreakdown} total={monthlyTotal} />
              <View style={styles.legend}>
                {categoryBreakdown.map((item) => (
                  <View key={item.categoryId} style={styles.legendRow}>
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
                    <Text numberOfLines={1} style={styles.legendName}>{item.categoryName}</Text>
                    <Text style={styles.legendPercentage}>{item.percentage}%</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>이번 달 감정 달력</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((weekday, index) => (
              <Text
                key={weekday}
                style={[
                  styles.weekday,
                  index === 0 && styles.sunday,
                  index === 6 && styles.saturday,
                ]}>
                {weekday}
              </Text>
            ))}
          </View>
          <View style={styles.emotionCalendarGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.emotionDayCell} />;
              }

              const dateKey = getDateKey(year, monthIndex, day);
              const satisfaction = monthlySatisfactions[dateKey];

              return (
                <View key={dateKey} style={styles.emotionDayCell}>
                  <Text style={styles.emotionDayNumber}>{day}</Text>
                  {satisfaction ? (
                    <SatisfactionIconImage satisfaction={satisfaction} size={22} />
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: BrandColors.background, flex: 1 },
  content: { gap: 16, paddingBottom: 34, paddingHorizontal: 16, paddingTop: 20 },
  monthHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surface,
    borderColor: BrandColors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  monthTitle: { color: BrandColors.text, fontSize: 22, fontWeight: '800' },
  summaryCard: {
    backgroundColor: BrandColors.surface,
    borderRadius: 22,
    flexDirection: 'row',
    minHeight: 220,
    overflow: 'hidden',
    padding: 20,
  },
  summaryCopy: { flex: 1, zIndex: 2 },
  summaryLabel: { color: BrandColors.textMuted, fontSize: 13, fontWeight: '700' },
  summaryAmount: {
    color: BrandColors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 7,
    maxWidth: 205,
  },
  comparisonText: { color: BrandColors.primary, fontSize: 12, fontWeight: '700', marginTop: 7 },
  speechBubble: {
    alignSelf: 'flex-start',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 16,
    marginTop: 22,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  speechText: { color: BrandColors.text, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  characterSlot: { bottom: 0, height: 170, position: 'absolute', right: 0, width: 180 },
  characterBackdrop: {
    backgroundColor: '#A98FFF',
    borderRadius: 80,
    bottom: -28,
    height: 155,
    position: 'absolute',
    right: -4,
    width: 168,
  },
  characterImage: { bottom: -6, height: 164, position: 'absolute', right: -2, width: 180 },
  sectionCard: { backgroundColor: BrandColors.surface, borderRadius: 22, padding: 18 },
  sectionTitle: { color: BrandColors.text, fontSize: 18, fontWeight: '800', marginBottom: 17 },
  emptyState: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 128,
  },
  emptyText: { color: BrandColors.textMuted, fontSize: 14, fontWeight: '600' },
  breakdownContent: { alignItems: 'center', flexDirection: 'row', gap: 17 },
  donut: { height: 150, position: 'relative', width: 150 },
  donutSegmentTrack: { height: 150, left: 0, position: 'absolute', top: 0, width: 150 },
  donutSegment: { borderRadius: 4, height: 10, left: 72, position: 'absolute', top: 2, width: 6 },
  donutCenter: {
    alignItems: 'center',
    backgroundColor: BrandColors.surface,
    borderRadius: 49,
    height: 98,
    justifyContent: 'center',
    left: 26,
    position: 'absolute',
    top: 26,
    width: 98,
  },
  donutCenterLabel: { color: BrandColors.textMuted, fontSize: 11, fontWeight: '700' },
  donutCenterAmount: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
    maxWidth: 88,
  },
  legend: { flex: 1, gap: 9 },
  legendRow: { alignItems: 'center', flexDirection: 'row' },
  legendDot: { borderRadius: 5, height: 10, marginRight: 7, width: 10 },
  legendName: { color: BrandColors.text, flex: 1, fontSize: 12, fontWeight: '700' },
  legendPercentage: { color: BrandColors.textMuted, fontSize: 12, fontWeight: '800', marginLeft: 5 },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { color: BrandColors.textMuted, fontSize: 11, fontWeight: '700', textAlign: 'center', width: '14.2857%' },
  sunday: { color: '#C96D62' },
  saturday: { color: '#617C9A' },
  emotionCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emotionDayCell: { alignItems: 'center', height: 54, paddingTop: 4, width: '14.2857%' },
  emotionDayNumber: { color: BrandColors.textMuted, fontSize: 10, fontWeight: '600' },
  emotionEmoji: { fontSize: 21, lineHeight: 29, marginTop: 1 },
});
