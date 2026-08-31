import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandColors } from '@/constants/theme';

const RECORDS_STORAGE_KEY = '@my-money-app/expense-records';
const DAILY_SATISFACTIONS_STORAGE_KEY = '@my-money-app/daily-satisfactions';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Satisfaction = '😫' | '😕' | '😐' | '🙂' | '😍';
type DailySatisfactions = Record<string, Satisfaction>;

type ExpenseRecord = {
  id: string;
  amount: number;
  category: string;
  satisfaction: Satisfaction;
  memo: string;
  createdAt: string;
  localDate: string;
  timeZone: string;
};

function getDateKey(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

function getLocalDateKey(date: Date) {
  return getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatRecordTime(record: ExpenseRecord) {
  const createdDate = new Date(record.createdAt);

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: record.timeZone,
    }).format(createdDate);
  } catch (error) {
    console.error('기록 당시 시간대로 시각을 표시하지 못했습니다.', error);

    try {
      return new Intl.DateTimeFormat('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(createdDate);
    } catch {
      return '시간 정보 없음';
    }
  }
}

export default function CalendarScreen() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCalendarData = async () => {
        try {
          const [savedRecords, savedDailySatisfactions] = await Promise.all([
            AsyncStorage.getItem(RECORDS_STORAGE_KEY),
            AsyncStorage.getItem(DAILY_SATISFACTIONS_STORAGE_KEY),
          ]);

          if (!isActive) {
            return;
          }

          if (savedRecords !== null) {
            const parsedRecords: unknown = JSON.parse(savedRecords);

            if (Array.isArray(parsedRecords)) {
              setRecords(parsedRecords as ExpenseRecord[]);
            } else {
              console.error('저장된 소비 기록이 배열 형태가 아닙니다.');
            }
          } else {
            setRecords([]);
          }

          if (savedDailySatisfactions !== null) {
            const parsedDailySatisfactions: unknown = JSON.parse(savedDailySatisfactions);

            if (
              typeof parsedDailySatisfactions === 'object' &&
              parsedDailySatisfactions !== null &&
              !Array.isArray(parsedDailySatisfactions)
            ) {
              setDailySatisfactions(parsedDailySatisfactions as DailySatisfactions);
            } else {
              console.error('저장된 하루 만족도가 날짜별 객체 형태가 아닙니다.');
            }
          } else {
            setDailySatisfactions({});
          }
        } catch (error) {
          console.error('달력 데이터를 불러오지 못했습니다.', error);
        }
      };

      void loadCalendarData();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const year = visibleMonth.getFullYear();
  const monthIndex = visibleMonth.getMonth();
  const todayDateKey = getLocalDateKey(new Date());

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const usedCellCount = firstWeekday + daysInMonth;
    const totalCellCount = Math.ceil(usedCellCount / 7) * 7;

    return Array.from({ length: totalCellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    });
  }, [monthIndex, year]);

  const totalsByDate = useMemo(
    () =>
      records.reduce<Record<string, number>>((totals, record) => {
        if (!record.localDate) {
          return totals;
        }

        totals[record.localDate] = (totals[record.localDate] ?? 0) + record.amount;
        return totals;
      }, {}),
    [records]
  );

  const selectedRecords = useMemo(() => {
    if (selectedDateKey === null) {
      return [];
    }

    return records
      .filter((record) => record.localDate === selectedDateKey)
      .sort((first, second) => {
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      });
  }, [records, selectedDateKey]);

  const selectedTotalAmount = selectedRecords.reduce(
    (total, record) => total + record.amount,
    0
  );
  const selectedDailySatisfaction =
    selectedDateKey === null ? null : (dailySatisfactions[selectedDateKey] ?? null);

  const moveMonth = (amount: number) => {
    setSelectedDateKey(null);
    setVisibleMonth((currentMonth) => {
      return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="이전 달"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => moveMonth(-1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}>
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>

          <Text style={styles.monthTitle}>
            {year}년 {monthIndex + 1}월
          </Text>

          <Pressable
            accessibilityLabel="다음 달"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => moveMonth(1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}>
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>

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

        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const dateKey = getDateKey(year, monthIndex, day);
            const totalAmount = totalsByDate[dateKey];
            const dailySatisfaction = dailySatisfactions[dateKey];
            const isToday = dateKey === todayDateKey;
            const isSelected = dateKey === selectedDateKey;

            return (
              <View key={dateKey} style={styles.dayCell}>
                <Pressable
                  accessibilityLabel={`${year}년 ${monthIndex + 1}월 ${day}일`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedDateKey(dateKey)}
                  style={({ pressed }) => [
                    styles.dayCellInner,
                    isToday && styles.todayCell,
                    isSelected && styles.selectedCell,
                    pressed && styles.dayCellPressed,
                  ]}>
                  <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day}</Text>
                  {dailySatisfaction ? (
                    <Text style={styles.satisfaction}>{dailySatisfaction}</Text>
                  ) : (
                    <View style={styles.satisfactionSpace} />
                  )}
                  {totalAmount !== undefined ? (
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                      numberOfLines={1}
                      style={styles.amount}>
                      {totalAmount.toLocaleString('ko-KR')}원
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        {selectedDateKey !== null ? (
          <View style={styles.detailSection}>
            <Text style={styles.detailDate}>{formatSelectedDate(selectedDateKey)}</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>하루의 소비</Text>
                <Text style={styles.summarySatisfaction}>
                  {selectedDailySatisfaction ?? '—'}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>총 소비</Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  numberOfLines={1}
                  style={styles.summaryAmount}>
                  {selectedTotalAmount.toLocaleString('ko-KR')}원
                </Text>
              </View>
            </View>

            <Text style={styles.detailListTitle}>소비 기록</Text>

            {selectedRecords.length === 0 ? (
              <View style={styles.detailEmptyState}>
                <Text style={styles.detailEmptyText}>이날은 기록한 소비가 없어요.</Text>
              </View>
            ) : (
              <View style={styles.detailList}>
                {selectedRecords.map((record) => (
                  <View key={record.id} style={styles.detailRecord}>
                    <View style={styles.detailRecordMain}>
                      <Text style={styles.detailCategory}>{record.category}</Text>
                      <View style={styles.detailAmountGroup}>
                        <Text style={styles.detailAmount}>
                          {record.amount.toLocaleString('ko-KR')}원
                        </Text>
                        <Text style={styles.detailSatisfaction}>{record.satisfaction}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRecordMeta}>
                      {record.memo ? (
                        <Text numberOfLines={2} style={styles.detailMemo}>
                          {record.memo}
                        </Text>
                      ) : (
                        <View style={styles.detailMemo} />
                      )}
                      <Text style={styles.detailTime}>{formatRecordTime(record)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FAFBF8',
    flex: 1,
  },
  content: {
    paddingBottom: 28,
    paddingHorizontal: 14,
    paddingTop: 28,
  },
  monthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthTitle: {
    color: '#20231D',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  monthButtonPressed: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
  },
  monthButtonText: {
    color: '#343832',
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 32,
    marginTop: -2,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekday: {
    color: '#6B7168',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: '14.2857%',
  },
  sunday: {
    color: '#C96D62',
  },
  saturday: {
    color: '#617C9A',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    height: 82,
    padding: 2,
    width: '14.2857%',
  },
  dayCellInner: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 2,
    paddingTop: 6,
  },
  todayCell: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
  },
  selectedCell: {
    borderColor: '#596057',
    borderWidth: 2,
  },
  dayCellPressed: {
    opacity: 0.7,
  },
  dayNumber: {
    color: '#4B5148',
    fontSize: 13,
    fontWeight: '600',
  },
  todayNumber: {
    color: BrandColors.onPrimary,
    fontWeight: '800',
  },
  satisfaction: {
    fontSize: 20,
    lineHeight: 27,
    marginTop: 1,
  },
  satisfactionSpace: {
    height: 28,
  },
  amount: {
    color: '#626960',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    maxWidth: '100%',
  },
  detailSection: {
    marginTop: 26,
    paddingHorizontal: 2,
  },
  detailDate: {
    color: '#20231D',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 24,
    paddingVertical: 14,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  summaryDivider: {
    backgroundColor: '#E8EBE5',
    width: StyleSheet.hairlineWidth,
  },
  summaryLabel: {
    color: '#777E74',
    fontSize: 12,
    fontWeight: '600',
  },
  summarySatisfaction: {
    color: '#343832',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  summaryAmount: {
    color: '#20231D',
    fontSize: 18,
    fontWeight: '800',
    maxWidth: '100%',
  },
  detailListTitle: {
    color: '#343832',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 11,
  },
  detailEmptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 22,
  },
  detailEmptyText: {
    color: '#8A9187',
    fontSize: 14,
  },
  detailList: {
    gap: 10,
  },
  detailRecord: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  detailRecordMain: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCategory: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    color: BrandColors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  detailAmountGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  detailAmount: {
    color: '#20231D',
    fontSize: 16,
    fontWeight: '800',
  },
  detailSatisfaction: {
    fontSize: 22,
  },
  detailRecordMeta: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  detailMemo: {
    color: '#656C62',
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginRight: 12,
  },
  detailTime: {
    color: '#92988F',
    fontSize: 12,
  },
});
