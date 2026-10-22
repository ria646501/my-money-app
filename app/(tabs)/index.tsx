import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
  useWindowDimensions,
  View,
} from 'react-native';

import {
  CategoryManagerModal,
} from '@/components/category-manager-modal';
import {
  CategoryIconImage,
  PRIMARY_CATEGORY_ICON_SIZE,
} from '@/components/category-icon-image';
import {
  ExpenseEditValues,
  ExpenseRecordEditor,
} from '@/components/expense-record-editor';
import { CharacterRoom } from '@/components/character-room';
import { AttendanceRewardModal } from '@/components/attendance-reward-modal';
import { GrowthCelebrationModal } from '@/components/growth-celebration-modal';
import {
  PRIMARY_SATISFACTION_ICON_SIZE,
  SatisfactionIconImage,
} from '@/components/satisfaction-icon-image';
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
  removeDailySatisfactionIfDateIsEmpty,
  SATISFACTIONS,
  Satisfaction,
  StoredExpenseRecord,
  TimeSelection,
} from '@/lib/expense-record';
import {
  createInitialGrowthState,
  getNextStageProgress,
  GrowthState,
  RewardResult,
} from '@/lib/growth';
import {
  grantAttendanceReward,
  grantDailyReflectionReward,
  grantExpenseRecordReward,
  loadGrowthState,
} from '@/lib/growth-storage';
import {
  consumePendingGrowthCelebration,
  GrowthCelebration,
  recordPendingGrowthCelebration,
} from '@/lib/growth-celebration';
import {
  consumeRewardFeedback,
  createRewardFeedback,
  RewardFeedback,
} from '@/lib/reward-feedback';
import {
  CATEGORIES_STORAGE_KEY,
  CATEGORY_CATALOG_VERSION_KEY,
  CURRENT_CATEGORY_CATALOG_VERSION,
  DEFAULT_CATEGORIES,
  ExpenseCategory,
  getHomeSelectableCategories,
  parseStoredCategories,
} from '@/lib/categories';

const SATISFACTION_BACKGROUNDS: Record<Satisfaction, string> = {
  '😫': '#EAF3FF',
  '😕': '#FFF0F7',
  '😐': '#FFF9DE',
  '🙂': '#FFF1E2',
  '😍': '#FFEFF7',
};

const HOME_COLORS = {
  background: '#FFF8F0',
  border: '#F2DEE2',
  card: '#FFFDF9',
  cardSoft: '#FFF5F5',
  ink: '#5A456A',
  muted: '#9E8C9A',
  pink: '#EF7FAA',
  pinkPressed: '#DF6595',
  pinkSoft: '#FFE7F0',
  lavenderSoft: '#F2EDFF',
} as const;

const HOME_OPTION_CARD_GAP = 1;
const HOME_OPTION_CARD_HEIGHT = 70;
const HOME_OPTION_CARD_RADIUS = 12;

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  // 웹에서도 휴대폰 프레임 안에서 카드 폭을 계산한다.
  const homeOptionCardWidth = (Math.min(windowWidth, 430) - 55) / 5;
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
  const [rewardEffects, setRewardEffects] = useState<RewardFeedback[]>([]);
  const [growthCelebration, setGrowthCelebration] = useState<GrowthCelebration | null>(null);
  const [isAttendanceModalVisible, setIsAttendanceModalVisible] = useState(false);
  const nextRecordId = useRef(0);

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

  const showRewardEffect = (result: RewardResult) => {
    const feedback = createRewardFeedback(result);

    if (feedback !== null) {
      setRewardEffects((current) => [...current.slice(-2), feedback]);
    }
  };

  const showGrowthCelebration = async (result: RewardResult) => {
    await recordPendingGrowthCelebration(result);
    const celebration = await consumePendingGrowthCelebration();

    if (celebration !== null) {
      setGrowthCelebration(celebration);
    }
  };

  const removeRewardEffect = useCallback((id: string) => {
    setRewardEffects((current) => current.filter((feedback) => feedback.id !== id));
  }, []);

  useFocusEffect(
    useCallback(() => {
      const pendingFeedback = consumeRewardFeedback();

      if (pendingFeedback.length > 0) {
        setRewardEffects((current) => [...current, ...pendingFeedback].slice(-3));
      }

      void consumePendingGrowthCelebration().then((celebration) => {
        if (celebration !== null) {
          setGrowthCelebration(celebration);
        }
      });
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const checkAttendance = async () => {
        try {
          const result = await grantAttendanceReward();

          if (isActive) {
            setGrowthState(result.state);
            showRewardEffect(result);
            void showGrowthCelebration(result);
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
          const [savedCategories, savedCatalogVersion] = await Promise.all([
            AsyncStorage.getItem(CATEGORIES_STORAGE_KEY),
            AsyncStorage.getItem(CATEGORY_CATALOG_VERSION_KEY),
          ]);

          if (!isActive) {
            return;
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
            return;
          }

          const parsedCategories = parseStoredCategories(JSON.parse(savedCategories));

          if (parsedCategories === null) {
            console.error('저장된 카테고리 형식이 올바르지 않습니다.');
            return;
          }

          if (savedCatalogVersion !== CURRENT_CATEGORY_CATALOG_VERSION) {
            await AsyncStorage.setItem(
              CATEGORY_CATALOG_VERSION_KEY,
              CURRENT_CATEGORY_CATALOG_VERSION
            );
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
      showRewardEffect(rewardResult);
      await showGrowthCelebration(rewardResult);
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

  const confirmDeleteRecord = (record: ExpenseRecord) => {
    Alert.alert('이 소비 기록을 삭제할까요?', '삭제한 기록은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void deleteRecord(record),
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
        showRewardEffect(rewardResult);
        await showGrowthCelebration(rewardResult);
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
            <Text style={styles.headerSparkle}>✧</Text>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>소비 다이어리</Text>
            </View>
            <Text style={styles.headerSparkle}>✦</Text>
          </View>

          <CharacterRoom
            onRewardEffectComplete={removeRewardEffect}
            progress={growthProgress}
            rewardEffects={rewardEffects}
          />

          <GrowthCelebrationModal
            onConfirm={() => setGrowthCelebration(null)}
            stageId={growthCelebration?.stageId ?? null}
            totalExp={growthCelebration?.totalExp ?? 0}
          />

          <AttendanceRewardModal
            growthState={growthState}
            onClose={() => setIsAttendanceModalVisible(false)}
            visible={isAttendanceModalVisible}
          />

          <Pressable
            accessibilityLabel="출석 보상 화면 열기"
            accessibilityRole="button"
            onPress={() => setIsAttendanceModalVisible(true)}
            style={({ pressed }) => [
              styles.attendanceCard,
              pressed && styles.buttonPressed,
            ]}>
            <View style={styles.attendanceCopy}>
              <Text style={styles.attendanceTitle}>
                {isGrowthReady && didAttendToday ? '✓ 오늘 출석 완료' : '오늘의 출석'}
              </Text>
              <Text style={styles.attendanceCaption}>
                {isGrowthReady
                  ? growthState.currentStreak > 0
                    ? `${growthState.currentStreak}일 연속 출석 중`
                    : '첫 출석을 기다리고 있어요'
                  : '출석 확인 중'}
              </Text>
            </View>
            <View accessibilityLabel="7일 출석 스탬프" style={styles.attendanceStamps}>
              {Array.from({ length: 7 }, (_, index) => {
                const isStamped = index < Math.min(growthState.currentStreak, 7);

                return (
                  <View
                    key={index}
                    style={[styles.attendanceStamp, isStamped && styles.attendanceStampDone]}>
                    <Text
                      style={[
                        styles.attendanceStampText,
                        isStamped && styles.attendanceStampTextDone,
                      ]}>
                      {isStamped ? '✓' : index + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
            <MaterialCommunityIcons color={HOME_COLORS.pink} name="chevron-right" size={22} />
          </Pressable>

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
                  {getHomeSelectableCategories(categories).map((item) => {
                    const isSelected = categoryId === item.id;

                    return (
                      <Pressable
                        accessibilityLabel={item.name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        key={item.id}
                        onPress={() => setCategoryId(item.id)}
                        style={({ pressed }) => [
                          styles.categoryButton,
                          { width: homeOptionCardWidth },
                          isSelected && styles.categoryButtonSelected,
                          pressed && styles.buttonPressed,
                        ]}>
                        <CategoryIconImage
                          icon={item.icon}
                          size={PRIMARY_CATEGORY_ICON_SIZE}
                        />
                        <Text numberOfLines={1} style={styles.categoryText}>
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
                      { width: homeOptionCardWidth },
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
                        <SatisfactionIconImage
                          satisfaction={item}
                          size={PRIMARY_SATISFACTION_ICON_SIZE}
                        />
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
                  <Text style={styles.label}>소비 시간</Text>
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
                <Text style={styles.recordsTitle}>✧ 오늘의 기록</Text>
                <View style={styles.recordCountBadge}>
                  <Text style={styles.recordCountText}>{todayRecords.length}건</Text>
                </View>
              </View>
              <Text style={styles.totalAmount}>₩{totalAmount.toLocaleString('ko-KR')}</Text>
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
                      <CategoryIconImage icon={record.categoryIcon} size={31} />
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
                      <SatisfactionIconImage
                        satisfaction={record.satisfaction}
                        size={PRIMARY_SATISFACTION_ICON_SIZE}
                      />
                    </View>
                    <Text style={styles.recordChevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {todayRecords.length > 0 && isDailySatisfactionReady ? (
              <View style={styles.dailyReview}>
                <View style={styles.dailyReviewCopy}>
                  <Text style={styles.dailyReviewTitle}>오늘 하루 소비는 어땠어? ✧</Text>
                  <Text style={styles.dailyReviewCaption}>하루 전체 소비 만족도를 기록해봐요</Text>
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
                        <SatisfactionIconImage
                          satisfaction={item}
                          size={PRIMARY_SATISFACTION_ICON_SIZE}
                        />
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.dailyReviewFooter}>하루를 한마디로 기록해봐요</Text>
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
        onManageCategories={() => setIsCategoryManagerVisible(true)}
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
    backgroundColor: HOME_COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 30,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 76,
    paddingHorizontal: 3,
  },
  headerSparkle: {
    color: '#6D5A88',
    fontSize: 24,
    fontWeight: '800',
    width: 34,
  },
  headerCopy: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    color: HOME_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  date: {
    color: HOME_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  attendanceCard: {
    alignItems: 'center',
    backgroundColor: '#FFF4FA',
    borderColor: '#F6CFE1',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginBottom: 10,
    marginTop: 2,
    minHeight: 76,
    paddingHorizontal: 12,
  },
  attendanceCopy: { minWidth: 88 },
  attendanceTitle: { color: HOME_COLORS.pink, fontSize: 13, fontWeight: '900' },
  attendanceCaption: { color: HOME_COLORS.muted, fontSize: 10, marginTop: 4 },
  attendanceStamps: { flex: 1, flexDirection: 'row', gap: 3, justifyContent: 'center' },
  attendanceStamp: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E9DDE4',
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  attendanceStampDone: { backgroundColor: '#FFD7E7', borderColor: '#EF7FAA' },
  attendanceStampText: { color: '#A99BA6', fontSize: 9, fontWeight: '800' },
  attendanceStampTextDone: { color: '#D94E87' },
  dailySummaryCard: {
    alignItems: 'center',
    backgroundColor: HOME_COLORS.card,
    borderColor: HOME_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  dailySummaryLabel: {
    color: HOME_COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  dailySummaryAmount: {
    color: HOME_COLORS.ink,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  dailySummaryChevron: {
    color: '#7D6E96',
    fontSize: 25,
  },
  entryArea: {
    backgroundColor: HOME_COLORS.card,
    borderColor: HOME_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: -4,
    padding: 12,
  },
  form: {
    gap: 13,
  },
  section: {
    gap: 8,
  },
  cardTitle: {
    color: HOME_COLORS.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directInputBadge: {
    backgroundColor: HOME_COLORS.lavenderSoft,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  directInputText: {
    color: '#7D6E96',
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    color: HOME_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  amountInputContainer: {
    alignItems: 'center',
    backgroundColor: '#FFF3F7',
    borderColor: '#F9DCE8',
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 82,
    paddingHorizontal: 12,
  },
  wonSymbol: {
    color: '#D59AB3',
    fontSize: 25,
    fontWeight: '700',
    marginRight: 10,
  },
  amountInput: {
    color: HOME_COLORS.ink,
    flex: 1,
    fontSize: 35,
    fontWeight: '800',
    letterSpacing: -1,
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: HOME_OPTION_CARD_GAP,
    paddingRight: 3,
  },
  categoryButton: {
    alignItems: 'center',
    backgroundColor: '#FFF7F8',
    borderColor: '#F7E6EC',
    borderRadius: HOME_OPTION_CARD_RADIUS,
    borderWidth: 1,
    height: HOME_OPTION_CARD_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
  },
  categoryButtonSelected: {
    backgroundColor: HOME_COLORS.pinkSoft,
    borderColor: HOME_COLORS.pink,
  },
  categoryManageButton: {
    borderColor: '#E4D7FD',
  },
  categoryText: {
    color: HOME_COLORS.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  categoryManageText: {
    color: '#8566DC',
  },
  satisfactionRow: {
    flexDirection: 'row',
    gap: HOME_OPTION_CARD_GAP,
  },
  satisfactionButton: {
    alignItems: 'center',
    backgroundColor: BrandColors.surfaceSoft,
    borderColor: '#F2DFE6',
    borderRadius: HOME_OPTION_CARD_RADIUS,
    borderWidth: 1,
    flex: 1,
    height: HOME_OPTION_CARD_HEIGHT,
    justifyContent: 'center',
  },
  satisfactionButtonSelected: {
    borderColor: HOME_COLORS.pink,
    borderWidth: 1.5,
  },
  compactFieldsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compactSection: {
    flex: 1,
    minWidth: 138,
  },
  memoInput: {
    backgroundColor: '#FFF7F8',
    borderColor: '#F4E2E8',
    borderRadius: 9,
    borderWidth: 1,
    color: HOME_COLORS.ink,
    fontSize: 13,
    height: 64,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  timeSelector: {
    alignItems: 'center',
    backgroundColor: '#FFF7F8',
    borderColor: '#F4E2E8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  timeSelectorText: {
    color: HOME_COLORS.ink,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  timeSelectorArrow: {
    color: HOME_COLORS.pink,
    fontSize: 23,
    lineHeight: 24,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: HOME_COLORS.pink,
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 17,
    minHeight: 68,
  },
  submitButtonDisabled: {
    backgroundColor: '#F1DFE5',
  },
  submitButtonPressed: {
    backgroundColor: HOME_COLORS.pinkPressed,
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
    marginTop: 16,
  },
  recordsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  recordsTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  recordsTitle: {
    color: BrandColors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  recordCountBadge: {
    backgroundColor: HOME_COLORS.pinkSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recordCountText: {
    color: HOME_COLORS.pink,
    fontSize: 12,
    fontWeight: '800',
  },
  totalAmount: {
    color: HOME_COLORS.pink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: HOME_COLORS.card,
    borderColor: HOME_COLORS.border,
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 22,
  },
  emptyStateText: {
    color: HOME_COLORS.muted,
    fontSize: 17,
  },
  recordsList: {
    gap: 8,
  },
  recordItem: {
    alignItems: 'center',
    backgroundColor: HOME_COLORS.card,
    borderColor: HOME_COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 94,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  recordItemPressed: {
    backgroundColor: '#FFF5F7',
  },
  recordCategoryMark: {
    alignItems: 'center',
    backgroundColor: HOME_COLORS.lavenderSoft,
    borderRadius: 17,
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
    color: HOME_COLORS.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  recordFigures: {
    alignItems: 'flex-end',
    marginLeft: 8,
    maxWidth: 100,
  },
  recordAmount: {
    color: HOME_COLORS.ink,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  recordMood: {
    alignItems: 'center',
    height: 58,
    justifyContent: 'center',
    marginLeft: 8,
    width: 58,
  },
  recordMemo: {
    color: HOME_COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  recordMemoEmpty: {
    color: '#B1ADBB',
    fontSize: 12,
    marginTop: 3,
  },
  recordTime: {
    color: HOME_COLORS.muted,
    fontSize: 11,
  },
  recordChevron: {
    color: '#C3BDCE',
    fontSize: 22,
    marginLeft: 4,
  },
  dailyReview: {
    backgroundColor: '#F1E7FF',
    borderColor: '#F6D4E1',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
    padding: 13,
  },
  dailyReviewCopy: {
    marginBottom: 10,
  },
  dailyReviewTitle: {
    color: HOME_COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  dailyReviewCaption: {
    color: HOME_COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  dailySatisfactionRow: {
    flexDirection: 'row',
    gap: HOME_OPTION_CARD_GAP,
  },
  dailySatisfactionButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFFB8',
    borderColor: '#F5DDE5',
    borderRadius: HOME_OPTION_CARD_RADIUS,
    borderWidth: 1,
    flex: 1,
    height: HOME_OPTION_CARD_HEIGHT,
    justifyContent: 'center',
  },
  dailySatisfactionButtonSelected: {
    borderColor: HOME_COLORS.pink,
    borderWidth: 1.5,
  },
  dailyReviewFooter: {
    color: HOME_COLORS.muted,
    fontSize: 11,
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
