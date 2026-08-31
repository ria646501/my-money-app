import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  ExpenseEditValues,
  ExpenseRecordEditor,
} from '@/components/expense-record-editor';
import { TimePickerModal } from '@/components/time-picker-modal';
import { BrandColors } from '@/constants/theme';
import {
  CATEGORIES,
  Category,
  createOccurredAtFromSelection,
  DAILY_SATISFACTIONS_STORAGE_KEY,
  DailySatisfactions,
  ExpenseRecord,
  formatRecordTime,
  formatTimeSelection,
  getCurrentTimeZone,
  getLocalDateKey,
  getTimeSelection,
  migrateExpenseRecord,
  RECORDS_STORAGE_KEY,
  SATISFACTIONS,
  Satisfaction,
  StoredExpenseRecord,
  TimeSelection,
} from '@/lib/expense-record';

export default function HomeScreen() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [satisfaction, setSatisfaction] = useState<Satisfaction | null>(null);
  const [memo, setMemo] = useState('');
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [dailySatisfactions, setDailySatisfactions] = useState<DailySatisfactions>({});
  const [isDailySatisfactionReady, setIsDailySatisfactionReady] = useState(false);
  const [newRecordTime, setNewRecordTime] = useState<TimeSelection>(() =>
    getTimeSelection(new Date())
  );
  const [hasCustomizedNewRecordTime, setHasCustomizedNewRecordTime] = useState(false);
  const [isNewTimePickerVisible, setIsNewTimePickerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(null);
  const nextRecordId = useRef(0);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }).format(new Date()),
    []
  );

  const todayDateKey = getLocalDateKey(new Date());
  const todayRecords = records
    .filter((record) => record.localDate === todayDateKey)
    .sort((first, second) => {
      return new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime();
    });
  const todaySatisfaction = dailySatisfactions[todayDateKey] ?? null;
  const canSubmit =
    isStorageReady && Number(amount) > 0 && category !== null && satisfaction !== null;
  const totalAmount = todayRecords.reduce((total, record) => total + record.amount, 0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsStorageReady(false);

      const loadRecords = async () => {
        try {
          const savedRecords = await AsyncStorage.getItem(RECORDS_STORAGE_KEY);

          if (savedRecords !== null && isActive) {
            const parsedRecords: unknown = JSON.parse(savedRecords);

            if (Array.isArray(parsedRecords)) {
              const storedRecords = parsedRecords as StoredExpenseRecord[];
              const needsMigration = storedRecords.some(
                (record) => !record.occurredAt || !record.localDate || !record.timeZone
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
                  console.error('보완된 소비 기록을 다시 저장하지 못했습니다.', migrationError);
                }
              }
            } else {
              console.error('저장된 소비 기록이 배열 형태가 아닙니다.');
            }
          }
        } catch (error) {
          console.error('소비 기록을 불러오지 못했습니다.', error);
        } finally {
          if (isActive) {
            setIsStorageReady(true);
          }
        }
      };

      void loadRecords();

      return () => {
        isActive = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setIsDailySatisfactionReady(false);

      const loadDailySatisfactions = async () => {
        try {
          const savedDailySatisfactions = await AsyncStorage.getItem(
            DAILY_SATISFACTIONS_STORAGE_KEY
          );

          if (savedDailySatisfactions !== null && isActive) {
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
          } else if (savedDailySatisfactions === null && isActive) {
            setDailySatisfactions({});
          }
        } catch (error) {
          console.error('하루 만족도를 불러오지 못했습니다.', error);
        } finally {
          if (isActive) {
            setIsDailySatisfactionReady(true);
          }
        }
      };

      void loadDailySatisfactions();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleAmountChange = (value: string) => {
    setAmount(value.replace(/[^0-9]/g, ''));
  };

  const handleSubmit = async () => {
    if (Number(amount) <= 0 || category === null || satisfaction === null) {
      return;
    }

    nextRecordId.current += 1;
    const recordedAt = new Date();
    const localDate = getLocalDateKey(recordedAt);
    const timeZone = getCurrentTimeZone();
    const occurredAt = hasCustomizedNewRecordTime
      ? createOccurredAtFromSelection(localDate, timeZone, newRecordTime)
      : recordedAt.toISOString();

    if (occurredAt === null) {
      Alert.alert(
        '시간을 저장할 수 없어요',
        '현재 시간대에서 사용할 수 있는 시간을 다시 선택해 주세요.'
      );
      return;
    }

    const newRecord: ExpenseRecord = {
      id: `${Date.now()}-${nextRecordId.current}`,
      amount: Number(amount),
      category,
      satisfaction,
      memo: memo.trim(),
      createdAt: recordedAt.toISOString(),
      occurredAt,
      localDate,
      timeZone,
    };

    const updatedRecords = [newRecord, ...records];

    setRecords(updatedRecords);
    setAmount('');
    setCategory(null);
    setSatisfaction(null);
    setMemo('');
    setNewRecordTime(getTimeSelection(new Date()));
    setHasCustomizedNewRecordTime(false);

    try {
      await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('소비 기록을 저장하지 못했습니다.', error);
    }
  };

  const saveEditedRecord = async (
    record: ExpenseRecord,
    values: ExpenseEditValues
  ) => {
    const occurredAt = createOccurredAtFromSelection(
      record.localDate,
      record.timeZone,
      values.time
    );

    if (occurredAt === null) {
      Alert.alert(
        '시간을 저장할 수 없어요',
        '기록 당시 시간대에서 사용할 수 있는 시간을 다시 선택해 주세요.'
      );
      return;
    }

    const updatedRecord: ExpenseRecord = {
      ...record,
      amount: values.amount,
      category: values.category,
      satisfaction: values.satisfaction,
      memo: values.memo,
      occurredAt,
    };
    const updatedRecords = records.map((item) =>
      item.id === record.id ? updatedRecord : item
    );

    setRecords(updatedRecords);
    setEditingRecord(null);

    try {
      await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('수정한 소비 기록을 저장하지 못했습니다.', error);
    }
  };

  const deleteRecord = async (recordId: string) => {
    const updatedRecords = records.filter((record) => record.id !== recordId);

    setRecords(updatedRecords);
    setEditingRecord(null);

    try {
      await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('소비 기록을 삭제한 결과를 저장하지 못했습니다.', error);
    }
  };

  const confirmDeleteRecord = (record: ExpenseRecord) => {
    Alert.alert('이 소비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void deleteRecord(record.id),
      },
    ]);
  };

  const handleDailySatisfactionSelect = async (value: Satisfaction) => {
    if (!isDailySatisfactionReady) {
      return;
    }

    const updatedDailySatisfactions = {
      ...dailySatisfactions,
      [todayDateKey]: value,
    };

    setDailySatisfactions(updatedDailySatisfactions);

    try {
      await AsyncStorage.setItem(
        DAILY_SATISFACTIONS_STORAGE_KEY,
        JSON.stringify(updatedDailySatisfactions)
      );
    } catch (error) {
      console.error('하루 만족도를 저장하지 못했습니다.', error);
    }
  };

  const openNewRecordTimePicker = () => {
    if (!hasCustomizedNewRecordTime) {
      setNewRecordTime(getTimeSelection(new Date()));
    }

    setIsNewTimePickerVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.date}>{today}</Text>
            <Text style={styles.title}>오늘의 소비</Text>
          </View>

          <View style={styles.entryArea}>
            <View style={styles.form}>
              <View style={styles.section}>
                <Text style={styles.label}>금액</Text>
                <View style={styles.amountInputContainer}>
                  <TextInput
                    accessibilityLabel="소비 금액"
                    keyboardType="number-pad"
                    maxLength={10}
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    placeholderTextColor="#B2AAA0"
                    style={styles.amountInput}
                    value={amount ? Number(amount).toLocaleString('ko-KR') : ''}
                  />
                  <Text style={styles.currency}>원</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>어디에 썼어?</Text>
                <View style={styles.optionGrid}>
                  {CATEGORIES.map((item) => {
                    const isSelected = category === item;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setCategory(item)}
                        style={({ pressed }) => [
                          styles.categoryButton,
                          isSelected && styles.categoryButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text
                          style={[
                            styles.categoryText,
                            isSelected && styles.categoryTextSelected,
                          ]}>
                          {item}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>만족도</Text>
                <View style={styles.satisfactionRow}>
                  {SATISFACTIONS.map((item) => {
                    const isSelected = satisfaction === item;

                    return (
                      <Pressable
                        accessibilityLabel={`만족도 ${item}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => setSatisfaction(item)}
                        style={({ pressed }) => [
                          styles.satisfactionButton,
                          isSelected && styles.satisfactionButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text style={styles.emoji}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>메모 (선택)</Text>
                <TextInput
                  accessibilityLabel="소비 메모"
                  maxLength={100}
                  onChangeText={setMemo}
                  placeholder="간단한 메모"
                  placeholderTextColor="#9CA3AF"
                  style={styles.memoInput}
                  value={memo}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>소비 시간</Text>
                <Pressable
                  accessibilityLabel={`소비 시간 ${formatTimeSelection(newRecordTime)}`}
                  accessibilityRole="button"
                  onPress={openNewRecordTimePicker}
                  style={({ pressed }) => [
                    styles.timeSelector,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.timeSelectorText}>
                    {formatTimeSelection(newRecordTime)}
                  </Text>
                  <Text style={styles.timeSelectorArrow}>›</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
                pressed && canSubmit && styles.submitButtonPressed,
              ]}>
              <Text
                style={[styles.submitButtonText, !canSubmit && styles.submitButtonTextDisabled]}>
                기록하기
              </Text>
            </Pressable>
          </View>

          <View style={styles.recordsSection}>
            <View style={styles.recordsHeader}>
              <Text style={styles.recordsTitle}>오늘 기록</Text>
              <Text style={styles.totalAmount}>총 {totalAmount.toLocaleString('ko-KR')}원</Text>
            </View>

            {todayRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>아직 기록한 소비가 없어요.</Text>
              </View>
            ) : (
              <View style={styles.recordsList}>
                {todayRecords.map((record) => (
                  <Pressable
                    accessibilityLabel={`${record.category} ${record.amount.toLocaleString('ko-KR')}원 기록 수정`}
                    accessibilityRole="button"
                    key={record.id}
                    onPress={() => setEditingRecord(record)}
                    style={({ pressed }) => [
                      styles.recordItem,
                      pressed && styles.recordItemPressed,
                    ]}>
                    <View style={styles.recordMainRow}>
                      <Text style={styles.recordCategory}>{record.category}</Text>
                      <View style={styles.recordAmountGroup}>
                        <Text style={styles.recordAmount}>
                          {record.amount.toLocaleString('ko-KR')}원
                        </Text>
                        <Text style={styles.recordSatisfaction}>{record.satisfaction}</Text>
                      </View>
                    </View>

                    <View style={styles.recordDetailRow}>
                      {record.memo ? (
                        <Text numberOfLines={1} style={styles.recordMemo}>
                          {record.memo}
                        </Text>
                      ) : (
                        <View style={styles.recordMemo} />
                      )}
                      <Text style={styles.recordTime}>{formatRecordTime(record)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {todayRecords.length > 0 && isDailySatisfactionReady ? (
              <View style={styles.dailyReview}>
                <Text style={styles.dailyReviewTitle}>오늘의 소비는 어땠어?</Text>
                <View style={styles.dailySatisfactionRow}>
                  {SATISFACTIONS.map((item) => {
                    const isSelected = todaySatisfaction === item;

                    return (
                      <Pressable
                        accessibilityLabel={`하루 전체 소비 만족도 ${item}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item}
                        onPress={() => void handleDailySatisfactionSelect(item)}
                        style={({ pressed }) => [
                          styles.dailySatisfactionButton,
                          isSelected && styles.dailySatisfactionButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text style={styles.dailySatisfactionEmoji}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <TimePickerModal
        onChange={(value) => {
          setNewRecordTime(value);
          setHasCustomizedNewRecordTime(true);
        }}
        onClose={() => setIsNewTimePickerVisible(false)}
        value={newRecordTime}
        visible={isNewTimePickerVisible}
      />

      <ExpenseRecordEditor
        onClose={() => setEditingRecord(null)}
        onDelete={confirmDeleteRecord}
        onSave={saveEditedRecord}
        record={editingRecord}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFBF8',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 42,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 22,
  },
  date: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  title: {
    color: '#20231D',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  entryArea: {
    flexShrink: 0,
  },
  form: {
    gap: 18,
  },
  section: {
    gap: 8,
  },
  label: {
    color: '#343832',
    fontSize: 15,
    fontWeight: '700',
  },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  amountInput: {
    color: '#20231D',
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    paddingVertical: 8,
  },
  currency: {
    color: '#555B52',
    fontSize: 16,
    fontWeight: '600',
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexBasis: '22%',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryButtonSelected: {
    backgroundColor: BrandColors.primary,
    borderColor: BrandColors.primary,
  },
  categoryText: {
    color: '#555B52',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: BrandColors.onPrimary,
  },
  satisfactionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  satisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 2,
  },
  emoji: {
    fontSize: 26,
  },
  memoInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    color: '#343832',
    fontSize: 15,
    height: 44,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  timeSelector: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 13,
  },
  timeSelectorText: {
    color: '#343832',
    fontSize: 15,
    fontWeight: '600',
  },
  timeSelectorArrow: {
    color: '#8A9187',
    fontSize: 24,
    lineHeight: 26,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 14,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E8E2',
  },
  submitButtonPressed: {
    backgroundColor: BrandColors.primaryPressed,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    color: BrandColors.onPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  submitButtonTextDisabled: {
    color: '#9AA097',
  },
  recordsSection: {
    marginTop: 34,
  },
  recordsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recordsTitle: {
    color: '#20231D',
    fontSize: 19,
    fontWeight: '800',
  },
  totalAmount: {
    color: '#555B52',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 22,
  },
  emptyStateText: {
    color: '#8A9187',
    fontSize: 14,
  },
  recordsList: {
    gap: 10,
  },
  recordItem: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordItemPressed: {
    backgroundColor: '#F4F7F0',
    borderColor: BrandColors.primary,
  },
  recordMainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordCategory: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 8,
    color: BrandColors.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recordAmountGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  recordAmount: {
    color: '#20231D',
    fontSize: 16,
    fontWeight: '800',
  },
  recordSatisfaction: {
    fontSize: 22,
  },
  recordDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  recordMemo: {
    color: '#656C62',
    flex: 1,
    fontSize: 13,
    marginRight: 12,
  },
  recordTime: {
    color: '#92988F',
    fontSize: 12,
  },
  dailyReview: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E7DF',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 14,
  },
  dailyReviewTitle: {
    color: '#343832',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  dailySatisfactionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dailySatisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FAFBF8',
    borderColor: '#E3E7DF',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  dailySatisfactionButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
    borderWidth: 2,
  },
  dailySatisfactionEmoji: {
    fontSize: 25,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
