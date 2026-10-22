import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CategoryIconImage } from '@/components/category-icon-image';
import { CategoryManagerModal } from '@/components/category-manager-modal';
import { ExpenseCategorySelector } from '@/components/expense-category-selector';
import {
  PRIMARY_SATISFACTION_ICON_SIZE,
  SatisfactionIconImage,
} from '@/components/satisfaction-icon-image';
import { TimeWheelPicker } from '@/components/time-wheel-picker';
import { BrandColors } from '@/constants/theme';
import {
  CATEGORIES_STORAGE_KEY,
  CATEGORY_CATALOG_VERSION_KEY,
  CURRENT_CATEGORY_CATALOG_VERSION,
  DEFAULT_CATEGORIES,
  ExpenseCategory,
  parseStoredCategories,
} from '@/lib/categories';
import {
  createOccurredAtFromSelection,
  DAILY_SATISFACTIONS_STORAGE_KEY,
  DailySatisfactions,
  ExpenseRecord,
  formatRecordTime,
  getCurrentTimeZone,
  getDateKey,
  getLocalDateKey,
  getRecordTimeSelection,
  getTimeSelection,
  migrateExpenseRecord,
  RECORDS_STORAGE_KEY,
  removeDailySatisfactionIfDateIsEmpty,
  SATISFACTIONS,
  Satisfaction,
  StoredExpenseRecord,
  TimeSelection,
} from '@/lib/expense-record';
import {
  grantDailyReflectionReward,
  grantExpenseRecordReward,
} from '@/lib/growth-storage';
import { recordPendingGrowthCelebration } from '@/lib/growth-celebration';
import { queueRewardFeedback } from '@/lib/reward-feedback';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const SATISFACTION_BACKGROUNDS: Record<Satisfaction, string> = {
  '😫': '#EAF3FF',
  '😕': '#FFF0F7',
  '😐': '#FFF9DE',
  '🙂': '#FFF1E6',
  '😍': '#FFEAF4',
};

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export default function CalendarScreen() {
  const editScrollRef = useRef<ScrollView>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [isCategoryManagerVisible, setIsCategoryManagerVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [isCalendarScrollEnabled, setIsCalendarScrollEnabled] = useState(true);
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [addingDateKey, setAddingDateKey] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editSatisfaction, setEditSatisfaction] = useState<Satisfaction | null>(null);
  const [editMemo, setEditMemo] = useState('');
  const [editTime, setEditTime] = useState<TimeSelection>({
    hour: 12,
    minute: 0,
    period: 'AM',
  });

  const monthSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.05,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.05,
        onPanResponderGrant: () => {
          setIsCalendarScrollEnabled(false);
        },
        onPanResponderRelease: (_, gestureState) => {
          setIsCalendarScrollEnabled(true);

          if (Math.abs(gestureState.dx) < 45 && Math.abs(gestureState.vx) < 0.35) {
            return;
          }

          const direction = gestureState.dx < 0 ? 1 : -1;
          setSelectedDateKey(null);
          setVisibleMonth((currentMonth) =>
            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1)
          );
        },
        onPanResponderTerminate: () => {
          setIsCalendarScrollEnabled(true);
        },
        onPanResponderTerminationRequest: () => false,
      }),
    []
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const today = new Date();

      setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      setSelectedDateKey(null);
      setIsMonthPickerVisible(false);
      setIsCalendarScrollEnabled(true);

      const loadCalendarData = async () => {
        try {
          const [savedRecords, savedDailySatisfactions, savedCategories, savedCatalogVersion] = await Promise.all([
            AsyncStorage.getItem(RECORDS_STORAGE_KEY),
            AsyncStorage.getItem(DAILY_SATISFACTIONS_STORAGE_KEY),
            AsyncStorage.getItem(CATEGORIES_STORAGE_KEY),
            AsyncStorage.getItem(CATEGORY_CATALOG_VERSION_KEY),
          ]);

          if (!isActive) {
            return;
          }

          if (savedRecords !== null) {
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
                  console.error(
                    '소비 시각을 보완한 기록을 다시 저장하지 못했습니다.',
                    migrationError
                  );
                }
              }
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

          if (savedCategories === null) {
            setCategories(DEFAULT_CATEGORIES);
            await AsyncStorage.setItem(
              CATEGORIES_STORAGE_KEY,
              JSON.stringify(DEFAULT_CATEGORIES)
            );
            await AsyncStorage.setItem(
              CATEGORY_CATALOG_VERSION_KEY,
              CURRENT_CATEGORY_CATALOG_VERSION
            );
          } else {
            const parsedCategories = parseStoredCategories(JSON.parse(savedCategories));

            if (parsedCategories !== null) {
              if (savedCatalogVersion !== CURRENT_CATEGORY_CATALOG_VERSION) {
                await AsyncStorage.setItem(
                  CATEGORY_CATALOG_VERSION_KEY,
                  CURRENT_CATEGORY_CATALOG_VERSION
                );
              }

              setCategories(parsedCategories);
            } else {
              console.error('저장된 카테고리 형식이 올바르지 않습니다.');
            }
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
        return new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime();
      });
  }, [records, selectedDateKey]);

  const selectedTotalAmount = selectedRecords.reduce(
    (total, record) => total + record.amount,
    0
  );
  const selectedDailySatisfaction =
    selectedDateKey === null ? null : (dailySatisfactions[selectedDateKey] ?? null);
  const canEditDailySatisfaction =
    selectedRecords.length > 0 || selectedDailySatisfaction !== null;
  const editingCategoryOption: ExpenseCategory | null = editingRecord
    ? {
        id: editingRecord.categoryId,
        name: editingRecord.category,
        icon: editingRecord.categoryIcon,
      }
    : null;
  const editCategoryOptions =
    editingCategoryOption &&
    !categories.some((item) => item.id === editingCategoryOption.id)
      ? [editingCategoryOption, ...categories]
      : categories;
  const canSaveEdit =
    (editingRecord !== null || addingDateKey !== null) &&
    Number(editAmount) > 0 &&
    editCategoryId !== null &&
    editSatisfaction !== null;

  const openAddModal = () => {
    if (selectedDateKey === null || selectedDateKey > todayDateKey) {
      return;
    }

    setEditingRecord(null);
    setAddingDateKey(selectedDateKey);
    setEditAmount('');
    setEditCategoryId(null);
    setEditSatisfaction(null);
    setEditMemo('');
    setEditTime(getTimeSelection(new Date()));
  };

  const openEditModal = (record: ExpenseRecord) => {
    setAddingDateKey(null);
    setEditingRecord(record);
    setEditAmount(String(record.amount));
    setEditCategoryId(record.categoryId);
    setEditSatisfaction(record.satisfaction);
    setEditMemo(record.memo);
    setEditTime(getRecordTimeSelection(record));
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setAddingDateKey(null);
  };

  const saveCategories = async (updatedCategories: ExpenseCategory[]) => {
    const legacyEditingCategoryId =
      editingRecord !== null &&
      !categories.some((item) => item.id === editingRecord.categoryId)
        ? editingRecord.categoryId
        : null;

    try {
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCategories));
      setCategories(updatedCategories);
      setEditCategoryId((currentId) =>
        currentId &&
        (updatedCategories.some((item) => item.id === currentId) ||
          currentId === legacyEditingCategoryId)
          ? currentId
          : null
      );
      return true;
    } catch (error) {
      console.error('달력에서 카테고리를 저장하지 못했습니다.', error);
      Alert.alert('카테고리를 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return false;
    }
  };

  const saveEditedRecord = async () => {
    if (
      !canSaveEdit ||
      editCategoryId === null ||
      editSatisfaction === null
    ) {
      return;
    }

    const fallbackRecordCategory: ExpenseCategory | null = editingRecord
      ? {
          id: editingRecord.categoryId,
          name: editingRecord.category,
          icon: editingRecord.categoryIcon,
        }
      : null;
    const selectedCategory =
      categories.find((item) => item.id === editCategoryId) ??
      (fallbackRecordCategory?.id === editCategoryId ? fallbackRecordCategory : null);

    if (selectedCategory === null) {
      return;
    }

    if (addingDateKey !== null) {
      const recordedAt = new Date();

      if (addingDateKey > getLocalDateKey(recordedAt)) {
        Alert.alert('미래 날짜에는 기록할 수 없어요');
        return;
      }

      const timeZone = getCurrentTimeZone();
      const occurredAt = createOccurredAtFromSelection(addingDateKey, timeZone, editTime);

      if (occurredAt === null) {
        Alert.alert(
          '시간을 저장할 수 없어요',
          '현재 시간대에서 사용할 수 있는 시간을 선택해 주세요.'
        );
        return;
      }

      const newRecord: ExpenseRecord = {
        id: `${recordedAt.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        amount: Number(editAmount),
        category: selectedCategory.name,
        categoryId: selectedCategory.id,
        categoryIcon: selectedCategory.icon,
        satisfaction: editSatisfaction,
        memo: editMemo.trim(),
        createdAt: recordedAt.toISOString(),
        occurredAt,
        localDate: addingDateKey,
        timeZone,
      };
      const updatedRecords = [newRecord, ...records];
      const isFirstRecordOfDate = selectedRecords.length === 0;

      try {
        await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
      } catch (error) {
        console.error('선택한 날짜의 소비 기록을 저장하지 못했습니다.', error);
        Alert.alert('기록을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
        return;
      }

      setRecords(updatedRecords);
      setAddingDateKey(null);

      try {
        const rewardResult = await grantExpenseRecordReward({
          actionDate: getLocalDateKey(recordedAt),
          grantedAt: recordedAt.toISOString(),
          isFirstRecordOfDate,
          recordId: newRecord.id,
          targetDate: addingDateKey,
        });
        queueRewardFeedback(rewardResult);
        await recordPendingGrowthCelebration(rewardResult);
      } catch (error) {
        console.error('선택한 날짜의 소비 기록 보상을 저장하지 못했습니다.', error);
      }

      return;
    }

    if (editingRecord === null) {
      return;
    }

    const updatedOccurredAt = createOccurredAtFromSelection(
      editingRecord.localDate,
      editingRecord.timeZone,
      editTime
    );

    if (updatedOccurredAt === null) {
      Alert.alert(
        '시간을 저장할 수 없어요',
        '기록 당시 시간대에서 사용할 수 있는 시간을 입력해 주세요.'
      );
      return;
    }

    const updatedRecord: ExpenseRecord = {
      ...editingRecord,
      amount: Number(editAmount),
      category:
        selectedCategory.id === editingRecord.categoryId
          ? editingRecord.category
          : selectedCategory.name,
      categoryId: selectedCategory.id,
      categoryIcon:
        selectedCategory.id === editingRecord.categoryId
          ? editingRecord.categoryIcon
          : selectedCategory.icon,
      satisfaction: editSatisfaction,
      memo: editMemo.trim(),
      occurredAt: updatedOccurredAt,
    };
    const updatedRecords = records.map((item) =>
      item.id === editingRecord.id ? updatedRecord : item
    );

    setRecords(updatedRecords);
    setEditingRecord(null);

    try {
      await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('수정한 소비 기록을 저장하지 못했습니다.', error);
    }
  };

  const deleteRecord = async (recordToDelete: ExpenseRecord) => {
    const updatedRecords = records.filter((record) => record.id !== recordToDelete.id);
    const updatedDailySatisfactions = removeDailySatisfactionIfDateIsEmpty(
      updatedRecords,
      recordToDelete,
      dailySatisfactions
    );
    const shouldDeleteDailySatisfaction = updatedDailySatisfactions !== dailySatisfactions;

    try {
      if (shouldDeleteDailySatisfaction) {
        await AsyncStorage.multiSet([
          [RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords)],
          [DAILY_SATISFACTIONS_STORAGE_KEY, JSON.stringify(updatedDailySatisfactions)],
        ]);
      } else {
        await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
      }
    } catch (error) {
      console.error('소비 기록을 삭제한 결과를 저장하지 못했습니다.', error);
      Alert.alert('소비 기록을 삭제하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    setRecords(updatedRecords);
    if (shouldDeleteDailySatisfaction) {
      setDailySatisfactions(updatedDailySatisfactions);
    }
    setEditingRecord(null);
  };

  const confirmDeleteRecord = () => {
    if (editingRecord === null) {
      return;
    }

    const recordToDelete = editingRecord;

    Alert.alert('이 소비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void deleteRecord(recordToDelete),
      },
    ]);
  };

  const updateDailySatisfaction = async (value: Satisfaction) => {
    if (selectedDateKey === null || !canEditDailySatisfaction) {
      return;
    }

    const updatedDailySatisfactions = {
      ...dailySatisfactions,
      [selectedDateKey]: value,
    };
    const isFirstReflection = selectedDailySatisfaction === null;

    try {
      await AsyncStorage.setItem(
        DAILY_SATISFACTIONS_STORAGE_KEY,
        JSON.stringify(updatedDailySatisfactions)
      );
    } catch (error) {
      console.error('선택한 날짜의 하루 만족도를 저장하지 못했습니다.', error);
      Alert.alert('하루 만족도를 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    setDailySatisfactions(updatedDailySatisfactions);

    if (isFirstReflection) {
      try {
        const rewardResult = await grantDailyReflectionReward({ targetDate: selectedDateKey });
        queueRewardFeedback(rewardResult);
        await recordPendingGrowthCelebration(rewardResult);
      } catch (error) {
        console.error('선택한 날짜의 하루 회고 보상을 저장하지 못했습니다.', error);
      }
    }
  };

  const moveMonth = (amount: number) => {
    setSelectedDateKey(null);
    setVisibleMonth((currentMonth) => {
      return new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={isCalendarScrollEnabled}
        showsVerticalScrollIndicator={false}>
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

          <Pressable
            accessibilityLabel="연도와 월 선택"
            accessibilityRole="button"
            onPress={() => {
              setPickerYear(year);
              setIsMonthPickerVisible(true);
            }}
            style={({ pressed }) => [
              styles.monthTitleButton,
              pressed && styles.monthTitleButtonPressed,
            ]}>
            <Text style={styles.monthTitle}>
              {year}년 {monthIndex + 1}월
            </Text>
            <MaterialCommunityIcons color={BrandColors.textMuted} name="chevron-down" size={19} />
          </Pressable>

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

        <View {...monthSwipeResponder.panHandlers}>
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
                    <SatisfactionIconImage
                      satisfaction={dailySatisfaction}
                      size={PRIMARY_SATISFACTION_ICON_SIZE}
                    />
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
        </View>

        {selectedDateKey !== null ? (
          <View style={styles.detailSection}>
            <Text style={styles.detailDate}>{formatSelectedDate(selectedDateKey)}</Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>하루의 소비</Text>
                {canEditDailySatisfaction ? (
                  <View style={styles.summarySatisfactionRow}>
                    {SATISFACTIONS.map((item) => {
                      const isSelected = selectedDailySatisfaction === item;

                      return (
                        <Pressable
                          accessibilityLabel={`선택한 날짜의 하루 전체 소비 만족도 ${item}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          key={item}
                          onPress={() => void updateDailySatisfaction(item)}
                          style={({ pressed }) => [
                            styles.summarySatisfactionButton,
                            isSelected && styles.summarySatisfactionButtonSelected,
                            pressed && styles.buttonPressed,
                          ]}>
                          <SatisfactionIconImage satisfaction={item} size={32} />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.summarySatisfactionEmpty}>—</Text>
                )}
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

            <View style={styles.detailListHeader}>
              <Text style={styles.detailListTitle}>소비 기록</Text>
              {selectedDateKey <= todayDateKey ? (
                <Pressable
                  accessibilityLabel={`${formatSelectedDate(selectedDateKey)} 소비 기록 추가`}
                  accessibilityRole="button"
                  onPress={openAddModal}
                  style={({ pressed }) => [
                    styles.addRecordButton,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.addRecordButtonText}>+ 소비 기록 추가</Text>
                </Pressable>
              ) : null}
            </View>

            {selectedRecords.length === 0 ? (
              <View style={styles.detailEmptyState}>
                <Text style={styles.detailEmptyText}>이날은 기록한 소비가 없어요.</Text>
              </View>
            ) : (
              <View style={styles.detailList}>
                {selectedRecords.map((record) => (
                  <Pressable
                    accessibilityLabel={`${record.category} ${record.amount.toLocaleString('ko-KR')}원 기록 수정`}
                    accessibilityRole="button"
                    key={record.id}
                    onPress={() => openEditModal(record)}
                    style={({ pressed }) => [
                      styles.detailRecord,
                      pressed && styles.detailRecordPressed,
                    ]}>
                    <View style={styles.detailRecordMain}>
                      <View style={styles.detailCategory}>
                        <CategoryIconImage icon={record.categoryIcon} size={28} />
                        <Text style={styles.detailCategoryText}>{record.category}</Text>
                      </View>
                      <View style={styles.detailAmountGroup}>
                        <Text style={styles.detailAmount}>
                          {record.amount.toLocaleString('ko-KR')}원
                        </Text>
                        <SatisfactionIconImage satisfaction={record.satisfaction} size={32} />
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
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsMonthPickerVisible(false)}
        transparent
        visible={isMonthPickerVisible}>
        <View style={styles.monthPickerOverlay}>
          <View style={styles.monthPickerCard}>
            <View style={styles.monthPickerHeader}>
              <Pressable
                accessibilityLabel="10년 전"
                onPress={() => setPickerYear((currentYear) => currentYear - 10)}
                style={styles.yearJumpButton}>
                <Text style={styles.yearJumpText}>−10</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="이전 연도"
                onPress={() => setPickerYear((currentYear) => currentYear - 1)}
                style={styles.yearButton}>
                <MaterialCommunityIcons color={BrandColors.text} name="chevron-left" size={24} />
              </Pressable>
              <Text style={styles.pickerYearText}>{pickerYear}년</Text>
              <Pressable
                accessibilityLabel="다음 연도"
                onPress={() => setPickerYear((currentYear) => currentYear + 1)}
                style={styles.yearButton}>
                <MaterialCommunityIcons color={BrandColors.text} name="chevron-right" size={24} />
              </Pressable>
              <Pressable
                accessibilityLabel="10년 후"
                onPress={() => setPickerYear((currentYear) => currentYear + 10)}
                style={styles.yearJumpButton}>
                <Text style={styles.yearJumpText}>+10</Text>
              </Pressable>
            </View>

            <View style={styles.monthPickerGrid}>
              {MONTHS.map((month) => {
                const isCurrentSelection = pickerYear === year && month === monthIndex + 1;

                return (
                  <Pressable
                    accessibilityLabel={`${pickerYear}년 ${month}월로 이동`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isCurrentSelection }}
                    key={month}
                    onPress={() => {
                      setVisibleMonth(new Date(pickerYear, month - 1, 1));
                      setSelectedDateKey(null);
                      setIsMonthPickerVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.monthPickerButton,
                      isCurrentSelection && styles.monthPickerButtonSelected,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.monthPickerButtonText,
                        isCurrentSelection && styles.monthPickerButtonTextSelected,
                      ]}>
                      {month}월
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.monthPickerFooter}>
              <Pressable
                onPress={() => {
                  const today = new Date();
                  setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                  setSelectedDateKey(null);
                  setIsMonthPickerVisible(false);
                }}
                style={styles.todayMonthButton}>
                <Text style={styles.todayMonthButtonText}>이번 달</Text>
              </Pressable>
              <Pressable
                onPress={() => setIsMonthPickerVisible(false)}
                style={styles.monthPickerCloseButton}>
                <Text style={styles.monthPickerCloseText}>닫기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeEditModal}
        transparent
        visible={editingRecord !== null || addingDateKey !== null}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalKeyboardView}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
                ref={editScrollRef}
                showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>
                      {addingDateKey !== null ? '소비 기록 추가' : '소비 기록 수정'}
                    </Text>
                    {addingDateKey !== null ? (
                      <Text style={styles.modalDate}>
                        {formatSelectedDate(addingDateKey)} · 현재 시간대
                      </Text>
                    ) : editingRecord ? (
                      <Text style={styles.modalDate}>
                        {formatSelectedDate(editingRecord.localDate)} · {editingRecord.timeZone}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityLabel="수정 닫기"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={closeEditModal}
                    style={({ pressed }) => [
                      styles.modalCloseButton,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text style={styles.modalCloseText}>×</Text>
                  </Pressable>
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>금액</Text>
                  <View style={styles.editAmountInputContainer}>
                    <TextInput
                      accessibilityLabel="수정할 소비 금액"
                      keyboardType="number-pad"
                      maxLength={10}
                      onChangeText={(value) => setEditAmount(value.replace(/[^0-9]/g, ''))}
                      style={styles.editAmountInput}
                      value={editAmount}
                    />
                    <Text style={styles.editCurrency}>원</Text>
                  </View>
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>카테고리</Text>
                  <ExpenseCategorySelector
                    categories={editCategoryOptions}
                    onManageCategories={() => setIsCategoryManagerVisible(true)}
                    onSelect={setEditCategoryId}
                    selectedCategoryId={editCategoryId}
                  />
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>이 소비는 어땠어?</Text>
                  <View style={styles.editSatisfactionRow}>
                    {SATISFACTIONS.map((item) => {
                      const isSelected = editSatisfaction === item;

                      return (
                        <Pressable
                          accessibilityLabel={`수정할 만족도 ${item}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          key={item}
                          onPress={() => setEditSatisfaction(item)}
                          style={({ pressed }) => [
                            styles.editSatisfactionButton,
                            { backgroundColor: SATISFACTION_BACKGROUNDS[item] },
                            isSelected && styles.editSatisfactionButtonSelected,
                            pressed && styles.buttonPressed,
                          ]}>
                          <SatisfactionIconImage
                            satisfaction={item}
                            size={PRIMARY_SATISFACTION_ICON_SIZE}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>메모 (선택)</Text>
                  <TextInput
                    accessibilityLabel="수정할 소비 메모"
                    maxLength={100}
                    onChangeText={setEditMemo}
                    placeholder="간단한 메모"
                    placeholderTextColor="#9CA3AF"
                    style={styles.editMemoInput}
                    value={editMemo}
                  />
                </View>

                <View style={styles.editSection}>
                  <Text style={styles.editLabel}>소비 시간</Text>
                  <TimeWheelPicker
                    onChange={setEditTime}
                    onGestureActiveChange={(isActive) => {
                      editScrollRef.current?.setNativeProps({ scrollEnabled: !isActive });
                    }}
                    value={editTime}
                  />
                </View>

                <View style={styles.modalActions}>
                  {editingRecord !== null ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={confirmDeleteRecord}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.buttonPressed,
                      ]}>
                      <Text style={styles.deleteButtonText}>삭제</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSaveEdit }}
                    disabled={!canSaveEdit}
                    onPress={() => void saveEditedRecord()}
                    style={({ pressed }) => [
                      styles.saveButton,
                      !canSaveEdit && styles.saveButtonDisabled,
                      pressed && canSaveEdit && styles.saveButtonPressed,
                    ]}>
                    <Text
                      style={[
                        styles.saveButtonText,
                        !canSaveEdit && styles.saveButtonTextDisabled,
                      ]}>
                      {addingDateKey !== null ? '기록하기' : '저장'}
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CategoryManagerModal
        categories={categories}
        onCategoriesChange={saveCategories}
        onClose={() => setIsCategoryManagerVisible(false)}
        visible={isCategoryManagerVisible}
      />
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
  monthTitleButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  monthTitleButtonPressed: {
    backgroundColor: BrandColors.primarySoft,
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
  monthPickerOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(28, 24, 42, 0.35)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  monthPickerCard: {
    backgroundColor: BrandColors.surface,
    borderRadius: 22,
    maxWidth: 390,
    padding: 18,
    width: '100%',
  },
  monthPickerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  yearJumpButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 9,
    height: 36,
    justifyContent: 'center',
    width: 45,
  },
  yearJumpText: { color: BrandColors.textMuted, fontSize: 12, fontWeight: '700' },
  yearButton: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pickerYearText: {
    color: BrandColors.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  monthPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthPickerButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: '23%',
  },
  monthPickerButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
  },
  monthPickerButtonText: { color: BrandColors.text, fontSize: 15, fontWeight: '700' },
  monthPickerButtonTextSelected: { color: BrandColors.primary, fontWeight: '800' },
  monthPickerFooter: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  todayMonthButton: {
    alignItems: 'center',
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 15,
  },
  todayMonthButtonText: { color: BrandColors.primary, fontSize: 14, fontWeight: '800' },
  monthPickerCloseButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 10,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 18,
  },
  monthPickerCloseText: { color: BrandColors.onPrimary, fontSize: 14, fontWeight: '800' },
  dayCell: {
    height: 96,
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
    paddingTop: 3,
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
    height: PRIMARY_SATISFACTION_ICON_SIZE,
  },
  amount: {
    color: '#626960',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 0,
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
    marginBottom: 24,
    paddingVertical: 12,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  summaryDivider: {
    backgroundColor: '#E8EBE5',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  summaryLabel: {
    color: '#777E74',
    fontSize: 12,
    fontWeight: '600',
  },
  summarySatisfactionRow: {
    flexDirection: 'row',
    gap: 3,
  },
  summarySatisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FAFBF8',
    borderColor: '#E3E7DF',
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 28,
  },
  summarySatisfactionButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 2,
  },
  summarySatisfactionEmoji: {
    fontSize: 18,
  },
  summarySatisfactionEmpty: {
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
  detailListHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  detailListTitle: {
    color: '#343832',
    fontSize: 17,
    fontWeight: '800',
  },
  addRecordButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 11,
  },
  addRecordButtonText: {
    color: BrandColors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
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
  detailRecordPressed: {
    backgroundColor: '#F4F7F0',
    borderColor: BrandColors.primary,
  },
  detailRecordMain: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailCategory: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  detailCategoryText: {
    color: BrandColors.primary,
    fontSize: 13,
    fontWeight: '700',
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
  modalKeyboardView: {
    flex: 1,
  },
  modalOverlay: {
    backgroundColor: 'rgba(25, 29, 23, 0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FAFBF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  modalContent: {
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  modalTitle: {
    color: '#20231D',
    fontSize: 22,
    fontWeight: '800',
  },
  modalDate: {
    color: '#7A8177',
    fontSize: 12,
    marginTop: 5,
  },
  modalCloseButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalCloseText: {
    color: '#596057',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 32,
  },
  editSection: {
    gap: 8,
    marginBottom: 18,
  },
  editLabel: {
    color: '#343832',
    fontSize: 14,
    fontWeight: '700',
  },
  editAmountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: 13,
  },
  editAmountInput: {
    color: '#20231D',
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: 8,
  },
  editCurrency: {
    color: '#596057',
    fontSize: 15,
    fontWeight: '600',
  },
  editOptionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editCategoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 11,
    borderWidth: 1,
    flexBasis: '22%',
    minHeight: 54,
    justifyContent: 'center',
  },
  editCategoryButtonSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  editSatisfactionRow: {
    flexDirection: 'row',
    gap: 1,
  },
  editSatisfactionButton: {
    alignItems: 'center',
    borderColor: '#EEDDE5',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 70,
    justifyContent: 'center',
  },
  editSatisfactionButtonSelected: {
    borderColor: '#FF75AB',
    borderWidth: 1.5,
  },
  editSatisfactionEmoji: {
    fontSize: 24,
  },
  editMemoInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#343832',
    fontSize: 14,
    height: 44,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  editTimeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  editTimeInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 11,
    borderWidth: 1,
    color: '#20231D',
    fontSize: 18,
    fontWeight: '700',
    height: 46,
    textAlign: 'center',
    width: 56,
  },
  editTimeColon: {
    color: '#596057',
    fontSize: 20,
    fontWeight: '700',
  },
  periodControl: {
    backgroundColor: '#E9EDE6',
    borderRadius: 11,
    flex: 1,
    flexDirection: 'row',
    marginLeft: 4,
    padding: 3,
  },
  periodButton: {
    alignItems: 'center',
    borderRadius: 9,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  periodButtonSelected: {
    backgroundColor: BrandColors.primary,
  },
  periodText: {
    color: '#6C736A',
    fontSize: 13,
    fontWeight: '700',
  },
  periodTextSelected: {
    color: BrandColors.onPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deleteButton: {
    alignItems: 'center',
    borderColor: '#E5B5AF',
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    width: 82,
  },
  deleteButtonText: {
    color: '#B84C43',
    fontSize: 15,
    fontWeight: '700',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E8E2',
  },
  saveButtonPressed: {
    backgroundColor: BrandColors.primaryPressed,
  },
  saveButtonText: {
    color: BrandColors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  saveButtonTextDisabled: {
    color: '#9AA097',
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
