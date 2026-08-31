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
  localDate: string;
};

function getDateKey(year: number, monthIndex: number, day: number) {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');

  return `${year}-${month}-${date}`;
}

function getLocalDateKey(date: Date) {
  return getDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export default function CalendarScreen() {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});

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

  const moveMonth = (amount: number) => {
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

            return (
              <View key={dateKey} style={styles.dayCell}>
                <View style={[styles.dayCellInner, isToday && styles.todayCell]}>
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
                </View>
              </View>
            );
          })}
        </View>
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
});
