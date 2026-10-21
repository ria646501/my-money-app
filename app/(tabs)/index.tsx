import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
  CategoryManagerModal,
} from '@/components/category-manager-modal';
import {
  ExpenseEditValues,
  ExpenseRecordEditor,
} from '@/components/expense-record-editor';
import { HomeCharacterSlot } from '@/components/home-character-slot';
import { TimePickerModal } from '@/components/time-picker-modal';
import { BrandColors } from '@/constants/theme';
import {
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
import {
  createInitialGrowthState,
  getNextStageProgress,
  GrowthState,
} from '@/lib/growth';
import {
  grantAttendanceReward,
  grantDailyReflectionReward,
  grantExpenseRecordReward,
  loadGrowthState,
} from '@/lib/growth-storage';
import {
  CATEGORIES_STORAGE_KEY,
  DEFAULT_CATEGORIES,
  ExpenseCategory,
  parseStoredCategories,
} from '@/lib/categories';

const SATISFACTION_BACKGROUNDS: Record<Satisfaction, string> = {
  '😫': '#FFF0F2',
  '😕': '#FFF6EC',
  '😐': '#FFF9E8',
  '🙂': '#EFFAF3',
  '😍': '#F2EEFF',
};

export default function HomeScreen() {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isCategoryManagerVisible, setIsCategoryManagerVisible] = useState(false);
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
  const [growthState, setGrowthState] = useState<GrowthState>(() =>
    createInitialGrowthState()
  );
  const [isGrowthReady, setIsGrowthReady] = useState(false);
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
    isStorageReady &&
    Number(amount) > 0 &&
    categoryId !== null &&
    categories.some((item) => item.id === categoryId) &&
    satisfaction !== null;
  const totalAmount = todayRecords.reduce((total, record) => total + record.amount, 0);
  const growthProgress = getNextStageProgress(growthState.totalExp);
  const didAttendToday = growthState.attendanceHistory[todayDateKey] !== undefined;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkAttendance = async () => {
        try {
          const result = await grantAttendanceReward();

          if (isActive) {
            setGrowthState(result.state);
          }
        } catch (error) {
          console.error('출석 보상을 저장하지 못했습니다.', error);

          try {
            const storedGrowthState = await loadGrowthState();

            if (isActive) {
              setGrowthState(storedGrowthState);
            }
          } catch (loadError) {
            console.error('캐릭터 성장 데이터를 불러오지 못했습니다.', loadError);
          }
        } finally {
          if (isActive) {
            setIsGrowthReady(true);
          }
        }
      };

      void checkAttendance();

      return () => {
        isActive = false;
      };
    }, [])
  );

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

      const loadCategories = async () => {
        try {
          const savedCategories = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);

          if (!isActive) {
            return;
          }

          if (savedCategories === null) {
            setCategories(DEFAULT_CATEGORIES);
            await AsyncStorage.setItem(
              CATEGORIES_STORAGE_KEY,
              JSON.stringify(DEFAULT_CATEGORIES)
            );
            return;
          }

          const parsedCategories = parseStoredCategories(JSON.parse(savedCategories));

          if (parsedCategories === null) {
            console.error('저장된 카테고리 형식이 올바르지 않습니다.');
            return;
          }

          setCategories(parsedCategories);
          setCategoryId((currentId) =>
            currentId && parsedCategories.some((item) => item.id === currentId)
              ? currentId
              : null
          );
        } catch (error) {
          console.error('카테고리를 불러오지 못했습니다.', error);
        }
      };

      void loadCategories();

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
    const selectedCategory = categories.find((item) => item.id === categoryId);

    if (Number(amount) <= 0 || !selectedCategory || satisfaction === null) {
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
      category: selectedCategory.name,
      categoryId: selectedCategory.id,
      categoryIcon: selectedCategory.icon,
      satisfaction,
      memo: memo.trim(),
      createdAt: recordedAt.toISOString(),
      occurredAt,
      localDate,
      timeZone,
    };

    const updatedRecords = [newRecord, ...records];
    const isFirstRecordOfDate = todayRecords.length === 0;

    try {
      await AsyncStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updatedRecords));
    } catch (error) {
      console.error('소비 기록을 저장하지 못했습니다.', error);
      Alert.alert('기록을 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    setRecords(updatedRecords);
    setAmount('');
    setCategoryId(null);
    setSatisfaction(null);
    setMemo('');
    setNewRecordTime(getTimeSelection(new Date()));
    setHasCustomizedNewRecordTime(false);

    try {
      const rewardResult = await grantExpenseRecordReward({
        actionDate: localDate,
        grantedAt: recordedAt.toISOString(),
        isFirstRecordOfDate,
        recordId: newRecord.id,
        targetDate: localDate,
      });
      setGrowthState(rewardResult.state);
    } catch (error) {
      console.error('소비 기록 보상을 저장하지 못했습니다.', error);
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
      category: values.category.id === record.categoryId ? record.category : values.category.name,
      categoryId: values.category.id,
      categoryIcon:
        values.category.id === record.categoryId ? record.categoryIcon : values.category.icon,
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

  const saveCategories = async (updatedCategories: ExpenseCategory[]) => {
    try {
      await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updatedCategories));
      setCategories(updatedCategories);
      setCategoryId((currentId) =>
        currentId && updatedCategories.some((item) => item.id === currentId)
          ? currentId
          : null
      );
      return true;
    } catch (error) {
      console.error('카테고리를 저장하지 못했습니다.', error);
      Alert.alert('카테고리를 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return false;
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
    const isFirstReflection = todaySatisfaction === null;

    try {
      await AsyncStorage.setItem(
        DAILY_SATISFACTIONS_STORAGE_KEY,
        JSON.stringify(updatedDailySatisfactions)
      );
    } catch (error) {
      console.error('하루 만족도를 저장하지 못했습니다.', error);
      Alert.alert('하루 만족도를 저장하지 못했어요', '잠시 후 다시 시도해 주세요.');
      return;
    }

    setDailySatisfactions(updatedDailySatisfactions);

    if (isFirstReflection) {
      try {
        const rewardResult = await grantDailyReflectionReward({ targetDate: todayDateKey });
        setGrowthState(rewardResult.state);
      } catch (error) {
        console.error('하루 회고 보상을 저장하지 못했습니다.', error);
      }
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
            <View style={styles.menuMark}>
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>재윤님 👋</Text>
              <Text style={styles.date}>오늘도 좋은 하루예요! · {today}</Text>
            </View>
          </View>

          <HomeCharacterSlot />

          <View style={styles.growthCard}>
            <View style={styles.growthHeader}>
              <View>
                <Text style={styles.growthStageLabel}>현재 성장 단계</Text>
                <Text style={styles.growthStageName}>{growthProgress.stage.name}</Text>
              </View>
              <View style={styles.growthPointBadge}>
                <MaterialCommunityIcons color={BrandColors.primary} name="star-four-points" size={15} />
                <Text style={styles.growthPointText}>{growthState.totalPoints}P</Text>
              </View>
            </View>

            <View style={styles.growthExpRow}>
              <Text style={styles.growthExpText}>{growthState.totalExp} EXP</Text>
              <Text style={styles.growthNextText}>
                {growthProgress.nextStage
                  ? `다음 성장까지 ${growthProgress.expToNextStage} EXP`
                  : '최종 성장 단계'}
              </Text>
            </View>
            <View style={styles.growthProgressTrack}>
              <View
                style={[
                  styles.growthProgressFill,
                  { width: `${Math.round(growthProgress.progress * 100)}%` },
                ]}
              />
            </View>

            <View style={styles.growthMetaRow}>
              <Text style={styles.growthMetaText}>연속 출석 {growthState.currentStreak}일</Text>
              <Text style={styles.growthAttendanceText}>
                {isGrowthReady && didAttendToday ? '오늘 출석 완료 ✓' : '출석 확인 중'}
              </Text>
            </View>
          </View>

          <View style={styles.entryArea}>
            <View style={styles.form}>
              <View style={styles.section}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>얼마 썼어?</Text>
                  <View style={styles.directInputBadge}>
                    <Text style={styles.directInputText}>⌨  직접 입력</Text>
                  </View>
                </View>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.wonSymbol}>₩</Text>
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
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>어떤 소비야?</Text>
                <ScrollView
                  contentContainerStyle={styles.optionRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}>
                  {categories.map((item) => {
                    const isSelected = categoryId === item.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item.id}
                        onPress={() => setCategoryId(item.id)}
                        style={({ pressed }) => [
                          styles.categoryButton,
                          isSelected && styles.categoryButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <MaterialCommunityIcons
                          color={isSelected ? BrandColors.primary : '#8E93A8'}
                          name={item.icon}
                          size={21}
                        />
                        <Text
                          style={[
                            styles.categoryText,
                            isSelected && styles.categoryTextSelected,
                          ]}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityLabel="카테고리 추가 및 관리"
                    onPress={() => setIsCategoryManagerVisible(true)}
                    style={({ pressed }) => [
                      styles.categoryButton,
                      styles.categoryManageButton,
                      pressed && styles.buttonPressed,
                    ]}>
                    <MaterialCommunityIcons color={BrandColors.primary} name="plus" size={22} />
                    <Text style={[styles.categoryText, styles.categoryManageText]}>추가</Text>
                  </Pressable>
                </ScrollView>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>이 소비는 어땠어?</Text>
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
                          { backgroundColor: SATISFACTION_BACKGROUNDS[item] },
                          isSelected && styles.satisfactionButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <Text style={styles.emoji}>{item}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.compactFieldsRow}>
                <View style={[styles.section, styles.compactSection]}>
                  <Text style={styles.label}>메모 (선택)</Text>
                  <TextInput
                    accessibilityLabel="소비 메모"
                    maxLength={100}
                    onChangeText={setMemo}
                    placeholder="예) 아이스라떼, 친구랑"
                    placeholderTextColor="#9CA3AF"
                    style={styles.memoInput}
                    value={memo}
                  />
                </View>

                <View style={[styles.section, styles.compactSection]}>
                  <Text style={styles.label}>언제 썼어?</Text>
                  <Pressable
                    accessibilityLabel={`소비 시간 ${formatTimeSelection(newRecordTime)}`}
                    accessibilityRole="button"
                    onPress={openNewRecordTimePicker}
                    style={({ pressed }) => [
                      styles.timeSelector,
                      pressed && styles.buttonPressed,
                    ]}>
                    <Text numberOfLines={1} style={styles.timeSelectorText}>
                      {formatTimeSelection(newRecordTime)}
                    </Text>
                    <Text style={styles.timeSelectorArrow}>›</Text>
                  </Pressable>
                </View>
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
                ＋  기록하기
              </Text>
            </Pressable>
          </View>

          <View style={styles.recordsSection}>
            <View style={styles.recordsHeader}>
              <View style={styles.recordsTitleGroup}>
                <Text style={styles.recordsTitle}>오늘의 기록</Text>
                <View style={styles.recordCountBadge}>
                  <Text style={styles.recordCountText}>{todayRecords.length}건</Text>
                </View>
              </View>
              <Text style={styles.totalAmount}>₩ {totalAmount.toLocaleString('ko-KR')}</Text>
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
                    <View style={styles.recordCategoryMark}>
                      <MaterialCommunityIcons
                        color="#858BA1"
                        name={record.categoryIcon}
                        size={19}
                      />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordCategory}>{record.category}</Text>
                      {record.memo ? (
                        <Text numberOfLines={1} style={styles.recordMemo}>
                          {record.memo}
                        </Text>
                      ) : (
                        <Text style={styles.recordMemoEmpty}>메모 없음</Text>
                      )}
                    </View>
                    <View style={styles.recordFigures}>
                      <Text style={styles.recordTime}>{formatRecordTime(record)}</Text>
                      <Text numberOfLines={1} style={styles.recordAmount}>
                        {record.amount.toLocaleString('ko-KR')}원
                      </Text>
                    </View>
                    <View style={styles.recordMood}>
                      <Text style={styles.recordSatisfaction}>{record.satisfaction}</Text>
                    </View>
                    <Text style={styles.recordChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {todayRecords.length > 0 && isDailySatisfactionReady ? (
              <View style={styles.dailyReview}>
                <View style={styles.dailyReviewCopy}>
                  <Text style={styles.dailyReviewTitle}>오늘의 소비는 어땠어?</Text>
                  <Text style={styles.dailyReviewCaption}>하루를 한마디로 기록해봐요</Text>
                </View>
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
                          { backgroundColor: SATISFACTION_BACKGROUNDS[item] },
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
        categories={categories}
        onClose={() => setEditingRecord(null)}
        onDelete={confirmDeleteRecord}
        onSave={saveEditedRecord}
        record={editingRecord}
      />

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
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 2,
  },
  growthCard: {
    backgroundColor: BrandColors.surface,
    borderColor: BrandColors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  growthHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  growthStageLabel: { color: BrandColors.textMuted, fontSize: 10, fontWeight: '700' },
  growthStageName: { color: BrandColors.text, fontSize: 18, fontWeight: '900', marginTop: 2 },
  growthPointBadge: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  growthPointText: { color: BrandColors.primary, fontSize: 13, fontWeight: '800' },
  growthExpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 11,
  },
  growthExpText: { color: BrandColors.text, fontSize: 12, fontWeight: '800' },
  growthNextText: { color: BrandColors.textMuted, fontSize: 10, fontWeight: '600' },
  growthProgressTrack: {
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 5,
    height: 8,
    marginTop: 7,
    overflow: 'hidden',
  },
  growthProgressFill: {
    backgroundColor: BrandColors.primary,
    borderRadius: 5,
    height: '100%',
  },
  growthMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
  },
  growthMetaText: { color: BrandColors.textMuted, fontSize: 10, fontWeight: '700' },
  growthAttendanceText: { color: BrandColors.primary, fontSize: 10, fontWeight: '800' },
  menuMark: {
    gap: 5,
    marginRight: 16,
    width: 28,
  },
  menuLine: {
    backgroundColor: BrandColors.text,
    borderRadius: 2,
    height: 2,
    width: 27,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: BrandColors.text,
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  date: {
    color: BrandColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  entryArea: {
    backgroundColor: BrandColors.surface,
    borderColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: -4,
    padding: 15,
    shadowColor: '#493C7A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  form: {
    gap: 15,
  },
  section: {
    gap: 8,
  },
  cardTitle: {
    color: BrandColors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directInputBadge: {
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  directInputText: {
    color: BrandColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    color: BrandColors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: '#F0EDF7',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 76,
    paddingHorizontal: 18,
  },
  wonSymbol: {
    color: '#B1ACBE',
    fontSize: 26,
    fontWeight: '700',
    marginRight: 10,
  },
  amountInput: {
    color: BrandColors.text,
    flex: 1,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 3,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#F7F5FB',
    borderColor: '#F3F0F8',
    borderRadius: 16,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 7,
    width: 68,
  },
  categoryButtonSelected: {
    backgroundColor: BrandColors.primarySoft,
    borderColor: BrandColors.primary,
  },
  categoryManageButton: {
    borderColor: BrandColors.primarySoft,
  },
  categoryText: {
    color: BrandColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  categoryTextSelected: {
    color: BrandColors.primary,
  },
  categoryManageText: {
    color: BrandColors.primary,
  },
  satisfactionRow: {
    flexDirection: 'row',
    gap: 7,
  },
  satisfactionButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: '#EFEBF6',
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    borderColor: BrandColors.primary,
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 21,
  },
  compactFieldsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  compactSection: {
    flex: 1,
    minWidth: 138,
  },
  memoInput: {
    backgroundColor: '#F7F5FB',
    borderColor: '#F1EDF7',
    borderRadius: 13,
    borderWidth: 1,
    color: BrandColors.text,
    fontSize: 14,
    height: 45,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  timeSelector: {
    alignItems: 'center',
    backgroundColor: '#F7F5FB',
    borderColor: '#F1EDF7',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    height: 45,
    justifyContent: 'space-between',
    paddingHorizontal: 13,
  },
  timeSelectorText: {
    color: BrandColors.text,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  timeSelectorArrow: {
    color: BrandColors.primary,
    fontSize: 24,
    lineHeight: 26,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    marginTop: 17,
    minHeight: 55,
  },
  submitButtonDisabled: {
    backgroundColor: '#E9E6EF',
  },
  submitButtonPressed: {
    backgroundColor: BrandColors.primaryPressed,
    transform: [{ scale: 0.99 }],
  },
  submitButtonText: {
    color: BrandColors.onPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  submitButtonTextDisabled: {
    color: '#A5A1AE',
  },
  recordsSection: {
    backgroundColor: BrandColors.surface,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 14,
    padding: 15,
    shadowColor: '#493C7A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  recordsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recordsTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  recordsTitle: {
    color: BrandColors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  recordCountBadge: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  recordCountText: {
    color: BrandColors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  totalAmount: {
    color: BrandColors.primary,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: BrandColors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 22,
  },
  emptyStateText: {
    color: BrandColors.textMuted,
    fontSize: 14,
  },
  recordsList: {
    gap: 0,
  },
  recordItem: {
    alignItems: 'center',
    borderBottomColor: '#F0EDF5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 65,
    paddingVertical: 8,
  },
  recordItemPressed: {
    backgroundColor: BrandColors.surfaceSoft,
  },
  recordCategoryMark: {
    alignItems: 'center',
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  recordInfo: {
    flex: 1,
    minWidth: 0,
  },
  recordCategory: {
    color: BrandColors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  recordFigures: {
    alignItems: 'flex-end',
    marginLeft: 8,
    maxWidth: 100,
  },
  recordAmount: {
    color: BrandColors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  recordMood: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginLeft: 8,
    width: 32,
  },
  recordSatisfaction: {
    fontSize: 18,
  },
  recordMemo: {
    color: BrandColors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  recordMemoEmpty: {
    color: '#B1ADBB',
    fontSize: 12,
    marginTop: 3,
  },
  recordTime: {
    color: BrandColors.textMuted,
    fontSize: 11,
  },
  recordChevron: {
    color: '#C3BDCE',
    fontSize: 22,
    marginLeft: 4,
  },
  dailyReview: {
    backgroundColor: BrandColors.primarySoft,
    borderRadius: 16,
    marginTop: 14,
    padding: 13,
  },
  dailyReviewCopy: {
    marginBottom: 10,
  },
  dailyReviewTitle: {
    color: BrandColors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dailyReviewCaption: {
    color: BrandColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  dailySatisfactionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dailySatisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    height: 44,
    justifyContent: 'center',
  },
  dailySatisfactionButtonSelected: {
    borderColor: BrandColors.primary,
    borderWidth: 1.5,
  },
  dailySatisfactionEmoji: {
    fontSize: 21,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
